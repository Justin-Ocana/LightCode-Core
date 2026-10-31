"""
Celery tasks para procesamiento de pedidos RCON.
Worker que ejecuta entregas automáticas con reintentos.
"""
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from .models import Order, RCONJob, OrderStatusHistory
from core.rcon_service import RCONDeliveryService
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_rcon_jobs(self=None):
    """
    Worker principal que procesa jobs RCON pendientes.
    Busca jobs que:
    - Están en estado pending
    - NO están cancelados
    - Han fallado pero aún tienen intentos disponibles (auto_retry_count < max_attempts)
    - Su next_retry_at ya pasó
    """
    now = timezone.now()
    
    # Buscar jobs pendientes que están listos para reintentar
    # EXCLUIR jobs cancelados
    pending_jobs = RCONJob.objects.filter(
        status__in=[RCONJob.Status.PENDING],
        next_retry_at__lte=now,
        auto_retry_count__lt=5  # Solo jobs que no han alcanzado el máximo
    ).exclude(
        status=RCONJob.Status.CANCELLED
    ).select_related('order', 'order__store')
    
    logger.info(f"🔄 Processing {pending_jobs.count()} RCON jobs (automatic retries)")
    
    for job in pending_jobs:
        try:
            # Siempre usar apply_async para compatibilidad con Beat
            execute_rcon_job.apply_async(args=[str(job.id)], countdown=0)
            logger.info(f"✅ Queued job {job.id} for execution")
        except Exception as e:
            logger.error(f"❌ Error queuing job {job.id}: {str(e)}")
    
    return f"Processed {pending_jobs.count()} jobs"


@shared_task(bind=True, max_retries=0)
def execute_rcon_job(self, job_id, force=False):
    """
    Ejecuta un job RCON individual.
    Maneja todos los casos de error y actualiza el estado.
    
    Args:
        job_id: ID del job a ejecutar
        force: Si True, ignora el límite de intentos (para retry manual)
    """
    # 🔒 LOCK: Prevenir ejecución concurrente del mismo job
    with transaction.atomic():
        try:
            job = RCONJob.objects.select_for_update(nowait=True).select_related('order', 'order__store').get(id=job_id)
        except RCONJob.DoesNotExist:
            logger.error(f"❌ Job {job_id} not found")
            return
        except Exception as e:
            # Otro proceso ya está ejecutando este job
            logger.warning(f"⚠️ Job {job_id} is locked by another process - SKIPPING")
            return
        
        # Validar que no esté cancelado
        if job.status == RCONJob.Status.CANCELLED:
            logger.warning(f"⚠️ Job {job.id} is cancelled, skipping")
            return
        
        # Validar que no esté ya entregado
        if job.status == RCONJob.Status.DELIVERED:
            logger.warning(f"⚠️ Job {job.id} already delivered - SKIPPING")
            return
        
        # Validar que no esté ya procesando
        if job.status == RCONJob.Status.PROCESSING:
            logger.warning(f"⚠️ Job {job.id} already processing - SKIPPING")
            return
        
        # Validar que no se haya alcanzado el máximo de intentos (solo para automáticos)
        if not force and job.auto_retry_count >= job.max_attempts:
            logger.warning(f"⚠️ Job {job.id} reached max auto attempts")
            _mark_job_as_failed(job, "Se alcanzó el máximo de intentos automáticos de entrega")
            return
        
        # Marcar como procesando e incrementar contadores
        job.status = RCONJob.Status.PROCESSING
    
        # Si es automático, incrementar auto_retry_count
        # Si es manual (force=True), el endpoint ya incrementó manual_retry_count y reseteó auto_retry_count
        if not force:
            job.auto_retry_count += 1
        
        # attempts solo refleja auto_retry_count (los que "gastan" intentos)
        # manual_retry_count es solo para auditoría y no penaliza
        job.attempts = job.auto_retry_count
        job.last_attempt_at = timezone.now()
        job.save()
        
        logger.info(f"🎮 Executing RCON job {job.id} (auto:{job.auto_retry_count}, manual:{job.manual_retry_count}){' [MANUAL]' if force else ''}")
    
    # 🔓 UNLOCK: Salir de transacción antes de ejecutar RCON (puede tardar)
    
    # Obtener configuración RCON del store
    store = job.order.store
    
    # CASO 1: RCON no configurado en el servidor
    if not store.rcon_host or not store.rcon_port or not store.rcon_password_encrypted:
        error_msg = "RCON no está configurado en este servidor"
        friendly_msg = "El vendedor aún no ha configurado la entrega automática. El pedido será procesado manualmente."
        logger.error(f"❌ {error_msg} for store {store.id}")
        
        job.rcon_error = "RCON_NOT_CONFIGURED"
        job.rcon_raw_log = error_msg
        job.failure_reason = friendly_msg
        job.failure_reason_type = RCONJob.FailureReason.COMMAND_ERROR
        job.last_error_message = error_msg
        job.status = RCONJob.Status.FAILED
        job.save()
        
        # Cambiar orden a REQUESTED para que el vendedor la procese manualmente
        _update_order_status(
            job.order,
            Order.Status.REQUESTED,
            f"RCON no configurado. Cambiar a entrega manual."
        )
        return
    
    # Desencriptar contraseña RCON
    try:
        from apps.stores.rcon_utils import decrypt_rcon_password
        rcon_password = decrypt_rcon_password(store.rcon_password_encrypted)
    except Exception as decrypt_error:
        error_msg = f"Error al desencriptar contraseña RCON: {str(decrypt_error)}"
        friendly_msg = "Error de configuración del servidor. Contacta al vendedor."
        logger.error(f"❌ {error_msg}")
        
        job.rcon_error = "DECRYPTION_ERROR"
        job.rcon_raw_log = error_msg
        job.failure_reason = friendly_msg
        job.failure_reason_type = RCONJob.FailureReason.AUTH_ERROR
        job.last_error_message = error_msg
        job.status = RCONJob.Status.FAILED
        job.save()
        
        _update_order_status(
            job.order,
            Order.Status.FAILED,
            f"Error de configuración RCON"
        )
        return
    
    # CASO 2: Intentar conexión RCON y ejecutar comando
    try:
        # 🔴 VALIDAR: Comando no puede estar vacío
        if not job.command or job.command.strip() == '' or job.command == '[]':
            error_msg = "Comando RCON vacío - producto sin comandos configurados"
            logger.error(f"❌ {error_msg} for job {job.id}")
            
            job.rcon_error = "EMPTY_COMMAND"
            job.rcon_raw_log = error_msg
            job.failure_reason = "El producto no tiene comandos configurados. Contacta al vendedor."
            job.failure_reason_type = RCONJob.FailureReason.COMMAND_ERROR
            job.last_error_message = error_msg
            job.status = RCONJob.Status.FAILED
            job.save()
            
            _update_order_status(
                job.order,
                Order.Status.FAILED,
                f"Producto sin comandos configurados"
            )
            return
        
        # Ejecutar entrega usando el servicio centralizado
        result = RCONDeliveryService.deliver_product(
            host=store.rcon_host,
            port=store.rcon_port,
            password=rcon_password,
            username=job.order.minecraft_username,
            commands=[job.command],
            validate_online=True,
            store_slug=store.slug
        )
        
        # CASO 3: Analizar resultado
        if result['success']:
            # Éxito - comando ejecutado
            logger.info(f"✅ RCON command executed successfully for job {job.id}")
            
            job.rcon_raw_log = result.get('message', 'Comando ejecutado exitosamente')
            job.status = RCONJob.Status.DELIVERED
            job.delivered_at = timezone.now()
            job.failure_reason_type = ''  # Limpiar tipo de error
            job.save()
            
            _update_order_status(
                job.order,
                Order.Status.DELIVERED,
                f"Entregado automáticamente via RCON"
            )
            
        elif result.get('partial_success'):
            # 🔴 ENTREGA PARCIAL: Algunos comandos fallaron
            successful = result.get('successful_commands', [])
            failed = result.get('failed_commands', [])
            
            logger.warning(f"⚠️ Partial delivery for job {job.id}: {len(successful)}/{len(successful)+len(failed)} commands succeeded")
            
            # Guardar comandos exitosos para no repetirlos
            if successful:
                if not job.rcon_raw_log:
                    job.rcon_raw_log = ''
                job.rcon_raw_log += f"\n✅ Ejecutados exitosamente:\n" + '\n'.join(f"  • {cmd}" for cmd in successful)
            
            # Actualizar comando del job para solo reintentar los fallidos
            if failed:
                job.command = '; '.join(failed)
                job.rcon_error = 'PARTIAL_FAILURE'
                
                # Mensaje detallado para el usuario
                job.failure_reason = (
                    f"⚠️ Entrega parcial: {len(successful)}/{len(successful)+len(failed)} comandos entregados.\n\n"
                    f"✅ Entregados: {len(successful)} comandos\n"
                    f"❌ Pendientes: {len(failed)} comandos\n\n"
                    f"Los comandos pendientes se reintentarán automáticamente."
                )
                
                job.failure_reason_type = RCONJob.FailureReason.NETWORK_ERROR
                job.last_error_message = result.get('message', 'Algunos comandos fallaron')
                
                # Agregar lista de comandos fallidos al log
                if not job.rcon_raw_log:
                    job.rcon_raw_log = ''
                job.rcon_raw_log += f"\n\n❌ Comandos pendientes (se reintentarán):\n" + '\n'.join(f"  • {cmd}" for cmd in failed)
                
                # Calcular próximo reintento
                job.next_retry_at = job.calculate_next_retry()
                
                if job.next_retry_at is None or job.auto_retry_count >= job.max_attempts:
                    job.status = RCONJob.Status.FAILED
                    job.failure_reason = (
                        f"❌ Entrega incompleta: {len(successful)}/{len(successful)+len(failed)} comandos entregados.\n\n"
                        f"✅ Entregados: {len(successful)} comandos\n"
                        f"❌ NO entregados: {len(failed)} comandos\n\n"
                        f"Se agotaron los reintentos automáticos. Contacta al vendedor para completar la entrega."
                    )
                else:
                    job.status = RCONJob.Status.PENDING
                
                job.save()
                
                _update_order_status(
                    job.order,
                    Order.Status.FAILED if job.status == RCONJob.Status.FAILED else Order.Status.PROCESSING,
                    f"Entrega parcial: {len(successful)}/{len(successful)+len(failed)} comandos"
                )
            else:
                # Todos fallaron (no debería pasar si partial_success=True)
                job.status = RCONJob.Status.FAILED
                job.save()
                _update_order_status(job.order, Order.Status.FAILED, "Todos los comandos fallaron")
            
        elif result.get('validation_failed'):
            # Error de validación (jugador offline, servidor apagado, etc.)
            error_msg = result.get('message', 'Error de validación')
            error_code = result.get('error', 'VALIDATION_FAILED')
            logger.warning(f"⚠️ RCON validation failed for job {job.id}: {error_msg}")
            
            # Clasificar el error
            from apps.admin_tools.rcon_service import RCONTester
            error_type = RCONTester.classify_rcon_error(error_msg, error_code)
            
            job.rcon_error = error_code
            job.rcon_raw_log = error_msg
            job.failure_reason = error_msg
            job.failure_reason_type = error_type
            job.last_error_message = error_msg
            
            # Calcular próximo reintento según el tipo de error
            job.next_retry_at = job.calculate_next_retry()
            
            # Si no hay próximo reintento (AUTH_ERROR, COMMAND_ERROR), marcar como FAILED
            if job.next_retry_at is None or job.auto_retry_count >= job.max_attempts:
                job.status = RCONJob.Status.FAILED
            else:
                job.status = RCONJob.Status.PENDING
            
            job.save()
            
            _update_order_status(
                job.order,
                Order.Status.FAILED if job.status == RCONJob.Status.FAILED else Order.Status.PROCESSING,
                f"Validación fallida (auto:{job.auto_retry_count}, manual:{job.manual_retry_count}): {error_msg}"
            )
            
        else:
            # Error en ejecución de comando
            error_msg = result.get('message', 'Error al ejecutar comando')
            error_code = result.get('error', 'COMMAND_FAILED')
            logger.error(f"❌ RCON command failed for job {job.id}: {error_msg}")
            
            # Clasificar el error
            from apps.admin_tools.rcon_service import RCONTester
            error_type = RCONTester.classify_rcon_error(error_msg, error_code)
            
            job.rcon_error = error_code
            job.rcon_raw_log = error_msg
            job.failure_reason = error_msg
            job.failure_reason_type = error_type
            job.last_error_message = error_msg
            
            # Calcular próximo reintento según el tipo de error
            job.next_retry_at = job.calculate_next_retry()
            
            # Si no hay próximo reintento, marcar como FAILED
            if job.next_retry_at is None or job.auto_retry_count >= job.max_attempts:
                job.status = RCONJob.Status.FAILED
            else:
                job.status = RCONJob.Status.PENDING
            
            job.save()
            
            _update_order_status(
                job.order,
                Order.Status.FAILED if job.status == RCONJob.Status.FAILED else Order.Status.PROCESSING,
                f"Error de comando (auto:{job.auto_retry_count}, manual:{job.manual_retry_count})"
            )
        
    except Exception as e:
        # CASO 5: Error inesperado
        error_msg = str(e)
        friendly_msg = "Ocurrió un error al procesar la entrega. Reintentaremos automáticamente."
        logger.exception(f"❌ Unexpected error in RCON job {job.id}")
        
        # Clasificar el error
        from apps.admin_tools.rcon_service import RCONTester
        error_type = RCONTester.classify_rcon_error(error_msg, type(e).__name__)
        
        job.rcon_error = type(e).__name__
        job.rcon_raw_log = error_msg
        job.failure_reason = friendly_msg
        job.failure_reason_type = error_type
        job.last_error_message = error_msg
        
        # Calcular próximo reintento según el tipo de error
        job.next_retry_at = job.calculate_next_retry()
        
        # Si no hay próximo reintento, marcar como FAILED
        if job.next_retry_at is None or job.auto_retry_count >= job.max_attempts:
            job.status = RCONJob.Status.FAILED
        else:
            job.status = RCONJob.Status.PENDING
        
        job.save()
        
        _update_order_status(
            job.order,
            Order.Status.FAILED if job.status == RCONJob.Status.FAILED else Order.Status.PROCESSING,
            f"Error: {error_msg[:100]}"
        )


def _mark_job_as_failed(job, reason):
    """Helper para marcar un job como fallido definitivamente."""
    job.status = RCONJob.Status.FAILED
    job.failure_reason = reason
    job.save()
    
    _update_order_status(
        job.order,
        Order.Status.FAILED,
        reason
    )


def _update_order_status(order, new_status, reason):
    """Helper para actualizar el estado de una orden y crear historial."""
    from .services import OrderService
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    
    logger.info(f"📝 Updating order {order.order_number} status: {order.status} → {new_status}")
    
    with transaction.atomic():
        # 🔒 LOCK: Prevenir actualizaciones concurrentes de la orden
        order = Order.objects.select_for_update().get(id=order.id)
        old_status = order.status
        
        # Verificar que no esté ya entregada (idempotencia)
        if old_status == Order.Status.DELIVERED and new_status == Order.Status.DELIVERED:
            logger.warning(f"⚠️ Order {order.order_number} already delivered - SKIPPING")
            return
        
        if new_status == Order.Status.DELIVERED:
            # Usar el método del servicio que libera el balance
            logger.info(f"✅ Calling OrderService.mark_order_delivered for order {order.order_number}")
            OrderService.mark_order_delivered(order)
            
            # Agregar razón específica del RCON
            OrderStatusHistory.objects.create(
                order=order,
                from_status=old_status,
                to_status=new_status,
                reason=reason
            )
        else:
            # Para otros estados
            order.status = new_status
            order.save()
            
            # Crear entrada en el historial
            OrderStatusHistory.objects.create(
                order=order,
                from_status=old_status,
                to_status=new_status,
                reason=reason
            )
        
        logger.info(f"📝 Order {order.order_number}: {old_status} → {new_status}")
        
        # 🔔 Enviar actualización por WebSocket
        try:
            # Refrescar para obtener datos actualizados incluyendo rcon_job
            order.refresh_from_db()
            
            channel_layer = get_channel_layer()
            if channel_layer:
                # Enviar a todos los usuarios del store (vendedores)
                seller_id = order.store.owner_id
                
                # Preparar datos del RCON job si existe
                rcon_job_data = None
                if hasattr(order, 'rcon_job') and order.rcon_job:
                    job = order.rcon_job
                    rcon_job_data = {
                        'id': str(job.id),
                        'status': job.status,
                        'attempts': job.attempts,
                        'auto_retry_count': job.auto_retry_count,
                        'manual_retry_count': job.manual_retry_count,
                        'max_attempts': job.max_attempts,
                        'last_attempt_at': job.last_attempt_at.isoformat() if job.last_attempt_at else None,
                        'next_retry_at': job.next_retry_at.isoformat() if job.next_retry_at else None,
                        'delivered_at': job.delivered_at.isoformat() if job.delivered_at else None,
                        'failure_reason': job.failure_reason,
                        'failure_reason_type': job.failure_reason_type,
                        'last_error_message': job.last_error_message,
                    }
                
                async_to_sync(channel_layer.group_send)(
                    f'notifications_{seller_id}',
                    {
                        'type': 'rcon_job_update',
                        'data': {
                            'order_id': str(order.id),
                            'order_number': order.order_number,
                            'status': order.status,
                            'minecraft_username': order.minecraft_username,
                            'rcon_job': rcon_job_data,
                            'reason': reason,
                        }
                    }
                )
                logger.info(f"🔔 Sent RCON job update via WebSocket for order {order.order_number}")
        except Exception as e:
            logger.error(f"❌ Error sending WebSocket update: {str(e)}")


@shared_task
def retry_failed_rcon_job(job_id):
    """
    Forzar reintento de un job fallido (llamado por el vendedor).
    Este reintento IGNORA el límite de intentos automáticos.
    """
    # 🔒 LOCK: Prevenir reintentos concurrentes
    with transaction.atomic():
        try:
            job = RCONJob.objects.select_for_update(nowait=True).get(id=job_id)
        except RCONJob.DoesNotExist:
            logger.error(f"❌ Job {job_id} not found for retry")
            return f"Job {job_id} not found"
        except Exception as e:
            logger.warning(f"⚠️ Job {job_id} is locked - retry already in progress")
            return f"Job {job_id} is already being retried"
        
        # Validar que no esté ya procesando
        if job.status == RCONJob.Status.PROCESSING:
            logger.warning(f"⚠️ Job {job_id} is already processing")
            return f"Job {job_id} is already processing"
        
        # Validar que no esté ya entregado
        if job.status == RCONJob.Status.DELIVERED:
            logger.warning(f"⚠️ Job {job_id} already delivered")
            return f"Job {job_id} already delivered"
        
        # Resetear estado
        job.status = RCONJob.Status.PENDING
        job.next_retry_at = timezone.now()
        job.save()
        
        logger.info(f"🔄 Forced retry for job {job_id}")
    
    # 🔓 UNLOCK: Salir de transacción antes de ejecutar
    # Ejecutar inmediatamente con force=True usando apply_async
    execute_rcon_job.apply_async(args=[str(job_id), True], countdown=0)
    
    return f"Job {job_id} queued for retry"
