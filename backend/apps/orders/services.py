"""
Servicios para cálculo de fees y creación de pedidos.
"""
from decimal import Decimal
from django.utils import timezone
from .models import Order, RCONJob, OrderStatusHistory
import logging

logger = logging.getLogger(__name__)


class FeeCalculator:
    """
    Calcula todos los fees de forma transparente.
    Todos los porcentajes se guardan en el momento de la transacción.
    
    SISTEMA DE BALANCES INTERNOS:
    - lightcode recibe TODO el dinero
    - Se calcula cuánto le pertenece al vendedor
    - Se acredita a su balance interno
    - El vendedor retira cuando quiera (fee de retiro se cobra en ese momento)
    """
    
    # Fees de PayPal al RECIBIR (lightcode recibe el pago)
    PAYPAL_RECEIVE_FEE_PERCENT = Decimal('0.0690')  # 6.9%
    
    # Fees de lightcode según plan
    lightcode_FEE_STARTER = Decimal('0.0430')  # 4.3%
    lightcode_FEE_PRO = Decimal('0.0270')  # 2.7%
    
    @classmethod
    def calculate_order_fees(cls, original_amount, discount=None, seller_plan='starter'):
        """
        Calcula el desglose completo de un pedido con balance interno.
        
        Flujo:
        1. Comprador paga $20.00 → lightcode recibe
        2. PayPal cobra fee de entrada ($1.38)
        3. lightcode se queda con su comisión ($0.86)
        4. El resto se acredita al vendedor ($17.76)
        
        Args:
            original_amount: Precio original del producto
            discount: Objeto Discount o None
            seller_plan: 'starter' o 'pro'
        
        Returns:
            dict con todos los montos y porcentajes
        """
        original_amount = Decimal(str(original_amount))
        
        # 1. Aplicar descuento
        discount_data = cls._calculate_discount(original_amount, discount)
        amount_after_discount = discount_data['amount_after_discount']
        
        # 2. Fee de PayPal al RECIBIR (lightcode recibe el pago)
        paypal_receive_fee = (amount_after_discount * cls.PAYPAL_RECEIVE_FEE_PERCENT).quantize(Decimal('0.01'))
        amount_after_paypal = amount_after_discount - paypal_receive_fee
        
        # 3. Fee de lightcode según plan
        lightcode_fee_percent = cls.lightcode_FEE_STARTER if seller_plan == 'starter' else cls.lightcode_FEE_PRO
        lightcode_fee = (amount_after_paypal * lightcode_fee_percent).quantize(Decimal('0.01'))
        
        # 4. Lo que se acredita al vendedor (en su balance interno)
        seller_credited = amount_after_paypal - lightcode_fee
        
        return {
            # Precio y descuento
            'original_amount': original_amount,
            'discount_code': discount_data['discount_code'],
            'discount_type': discount_data['discount_type'],
            'discount_value': discount_data['discount_value'],
            'discount_amount_saved': discount_data['discount_amount_saved'],
            'amount_after_discount': amount_after_discount,
            
            # Fees
            'paypal_receive_fee': paypal_receive_fee,
            'paypal_receive_fee_percent': cls.PAYPAL_RECEIVE_FEE_PERCENT,
            'lightcode_fee': lightcode_fee,
            'lightcode_fee_percent': lightcode_fee_percent,
            'lightcode_plan': seller_plan,
            
            # Monto acreditado al vendedor
            'seller_credited': seller_credited,
            'currency': 'USD'
        }
    
    @classmethod
    def _calculate_discount(cls, original_amount, discount):
        """Calcula el descuento aplicado."""
        if not discount:
            return {
                'discount_code': '',
                'discount_type': '',
                'discount_value': Decimal('0.00'),
                'discount_amount_saved': Decimal('0.00'),
                'amount_after_discount': original_amount
            }
        
        discount_value = Decimal(str(discount.value))
        
        if discount.discount_type == 'PERCENTAGE':
            discount_amount_saved = (original_amount * discount_value / 100).quantize(Decimal('0.01'))
        elif discount.discount_type == 'FIXED_AMOUNT':
            discount_amount_saved = min(discount_value, original_amount)
        else:
            discount_amount_saved = Decimal('0.00')
        
        amount_after_discount = max(Decimal('0.00'), original_amount - discount_amount_saved)
        
        return {
            'discount_code': discount.code,
            'discount_type': discount.discount_type,
            'discount_value': discount_value,
            'discount_amount_saved': discount_amount_saved,
            'amount_after_discount': amount_after_discount
        }


class OrderService:
    """
    Servicio para crear y gestionar pedidos.
    """
    
    @classmethod
    def create_order(cls, store, product, buyer, minecraft_username, discount=None, paypal_data=None):
        """
        Crea un pedido completo con todos los datos.
        
        Args:
            store: Store object
            product: Product object
            buyer: User object (puede ser None si es guest)
            minecraft_username: str
            discount: Discount object o None
            paypal_data: dict con datos de PayPal
        
        Returns:
            Order object
        """
        # 1. Calcular fees
        seller_plan = store.owner.subscription_plan if hasattr(store.owner, 'subscription_plan') else 'starter'
        fees = FeeCalculator.calculate_order_fees(
            original_amount=product.price,
            discount=discount,
            seller_plan=seller_plan
        )
        
        # 2. Crear snapshot del producto
        product_snapshot = {
            'id': str(product.id),
            'name': product.name,
            'description': product.description,
            'price': str(product.price),
            'image': product.image.url if product.image else None,
            'delivery_mode': product.delivery_mode,
            'command_template': product.command_template if product.delivery_mode == 'RCON' else None,
        }
        
        # 3. Determinar método de entrega
        if product.delivery_mode == 'RCON':
            delivery_method = Order.DeliveryMethod.RCON
        elif product.delivery_mode == 'PLUGIN':
            delivery_method = Order.DeliveryMethod.PLUGIN
        else:
            delivery_method = Order.DeliveryMethod.MANUAL
        
        # 4. Preparar comando RCON si aplica
        command_sent = ''
        server_address = ''
        if delivery_method == Order.DeliveryMethod.RCON:
            # Obtener comandos del producto (nuevo sistema)
            from apps.products.models import ProductCommand
            
            commands = ProductCommand.objects.filter(
                product=product,
                event='ON_PURCHASE'
            ).order_by('order')
            
            if commands.exists():
                # Unir todos los comandos
                command_list = []
                for cmd in commands:
                    resolved = cmd.command.replace('{username}', minecraft_username).replace('{player}', minecraft_username)
                    command_list.append(resolved)
                command_sent = '; '.join(command_list)
            elif hasattr(product, 'command_template') and product.command_template:
                # Fallback: usar command_template viejo
                command_sent = product.command_template.replace('{mc_user}', minecraft_username)
            
            server_address = f"{store.rcon_host}:{store.rcon_port}" if store.rcon_host else ''
        
        # 5. Crear orden
        order = Order.objects.create(
            store=store,
            buyer=buyer,
            product=product,
            product_snapshot=product_snapshot,
            discount=discount,
            status=Order.Status.REQUESTED,
            delivery_method=delivery_method,
            
            # Datos del comprador
            buyer_paypal_name=paypal_data.get('payer_name', '') if paypal_data else '',
            buyer_paypal_email=paypal_data.get('payer_email', '') if paypal_data else '',
            buyer_payer_id=paypal_data.get('payer_id', '') if paypal_data else '',
            paypal_transaction_id=paypal_data.get('transaction_id', '') if paypal_data else '',
            paypal_order_id=paypal_data.get('order_id', '') if paypal_data else '',
            payment_ip=paypal_data.get('ip_address') if paypal_data else None,
            
            # Datos del producto
            minecraft_username=minecraft_username,
            server_address=server_address,
            command_sent=command_sent,
            
            # Desglose financiero
            **fees,
            
            # Timestamps
            payment_captured_at=timezone.now() if paypal_data else None
        )
        
        # 6. Crear historial inicial
        OrderStatusHistory.objects.create(
            order=order,
            to_status=Order.Status.REQUESTED,
            reason='Pedido creado'
        )
        
        # 7. Si es RCON, crear job
        if delivery_method == Order.DeliveryMethod.RCON:
            cls._create_rcon_job(order, store, command_sent)
        
        logger.info(f"✅ Order {order.order_number} created for {minecraft_username}")
        
        return order
    
    @classmethod
    def _create_mod_commands(cls, order, store):
        """
        Crea ModCommands para entrega via PlugsEssentials (Bedrock).
        Repite los comandos según la cantidad comprada.
        """
        from .mod_models import ModCommand
        from apps.products.models import ProductCommand

        commands = ProductCommand.objects.filter(
            product=order.product,
            event='ON_PURCHASE'
        ).order_by('order')

        # Obtener cantidad comprada del snapshot
        quantity = 1
        if order.product_snapshot:
            # Intentar desde items[0].quantity (nuevo formato)
            items = order.product_snapshot.get('items', [])
            if items and isinstance(items, list):
                quantity = int(items[0].get('quantity', 1))
            else:
                # Fallback al formato antiguo
                quantity = int(order.product_snapshot.get('quantity', 1))
        quantity = max(1, quantity)

        if not commands.exists():
            if order.command_sent:
                for _ in range(quantity):
                    ModCommand.objects.create(
                        store=store,
                        order=order,
                        command=order.command_sent,
                        player=order.minecraft_username,
                        source=ModCommand.Source.ORDER,
                        exec_type=ModCommand.ExecType.PLAYER,
                        delay_seconds=0,
                        status=ModCommand.Status.PENDING_CLAIM,
                        required_slots=getattr(order.product, 'required_slots', 0) or 0,
                    )
                logger.info(f"📦 {quantity} ModCommand(s) created (fallback) for order {order.order_number}")
            return

        delivery_config = {}
        if order.product:
            delivery_config = order.product.delivery_config or {}

        max_retry_hours = delivery_config.get('max_retry_hours', 5)
        from django.utils import timezone as tz
        expires_at = tz.now() + tz.timedelta(hours=max_retry_hours)

        slots = getattr(order.product, 'required_slots', 0) or 0
        created = 0

        # Repetir todos los comandos por cada unidad comprada
        for _ in range(quantity):
            for cmd in commands:
                resolved_cmd = cmd.command.replace('{player}', order.minecraft_username).replace('{username}', order.minecraft_username)
                ModCommand.objects.create(
                    store=store,
                    order=order,
                    command=resolved_cmd,
                    player=order.minecraft_username,
                    source=ModCommand.Source.ORDER,
                    exec_type=cmd.exec_type if hasattr(cmd, 'exec_type') else ModCommand.ExecType.PLAYER,
                    delay_seconds=cmd.delay_seconds if hasattr(cmd, 'delay_seconds') else 0,
                    expires_at=expires_at,
                    status=ModCommand.Status.PENDING_CLAIM,
                    required_slots=slots,
                )
                created += 1

        logger.info(f"📦 {created} ModCommand(s) created (qty={quantity}) for order {order.order_number}")

    @classmethod
    def _create_rcon_job(cls, order, store, command):
        """Crea un job RCON para el pedido."""
        from apps.products.models import ProductCommand
        
        # Obtener comandos del producto (nuevo sistema)
        commands = ProductCommand.objects.filter(
            product=order.product,
            event='ON_PURCHASE'
        ).order_by('order')
        
        # Construir comando completo
        if commands.exists():
            # Unir todos los comandos con punto y coma
            command_list = []
            for cmd in commands:
                resolved = cmd.command.replace('{username}', order.minecraft_username).replace('{player}', order.minecraft_username)
                command_list.append(resolved)
            
            final_command = '; '.join(command_list)
        else:
            # Fallback: usar command_template viejo si existe
            if hasattr(order.product, 'command_template') and order.product.command_template:
                final_command = order.product.command_template.replace('{mc_user}', order.minecraft_username)
            else:
                final_command = command  # Usar el que se pasó como parámetro
        
        job = RCONJob.objects.create(
            order=order,
            command=final_command,
            server_host=store.rcon_host or '',
            server_port=store.rcon_port or 25575,
            status=RCONJob.Status.PENDING,
            next_retry_at=timezone.now(),  # Ejecutar inmediatamente
            attempts=0,  # Se incrementará en el primer intento
            auto_retry_count=0,
            manual_retry_count=0
        )
        
        logger.info(f"🎮 RCON job {job.id} created for order {order.order_number} with {len(command_list) if commands.exists() else 1} commands")
        
        # NO ejecutar aquí - se ejecutará en process_order_delivery()
        return job
    
    @classmethod
    def process_order_delivery(cls, order):
        """
        Procesa la entrega de un pedido después de que el pago fue capturado.
        Verifica cuota de entregas automáticas (plan free = 15 por método/30 días).
        """
        store = order.store

        # ── Verificar cuota antes de intentar entrega automática ──────────────
        if order.delivery_method == Order.DeliveryMethod.RCON:
            if not store.can_auto_deliver_rcon():
                cls._downgrade_to_manual(order, 'limit_reached', 'rcon')
                return order

        elif order.delivery_method == Order.DeliveryMethod.PLUGIN:
            if not store.can_auto_deliver_plugin():
                cls._downgrade_to_manual(order, 'limit_reached', 'plugin')
                return order
        # ──────────────────────────────────────────────────────────────────────

        if order.delivery_method == Order.DeliveryMethod.RCON:
            # Si ya tiene un RCON job, reactivarlo
            if hasattr(order, 'rcon_job'):
                rcon_job = order.rcon_job
                rcon_job.status = RCONJob.Status.PENDING
                rcon_job.next_retry_at = timezone.now()
                rcon_job.save()
                logger.info(f"🔄 RCON job reactivated for order {order.order_number}")
                
                # Queue for immediate execution via Celery Worker
                from .tasks import execute_rcon_job
                
                try:
                    # Always use apply_async to queue to Worker
                    execute_rcon_job.apply_async(args=[str(rcon_job.id)], countdown=1)
                    logger.info(f"✅ RCON job {rcon_job.id} queued for immediate execution")
                except Exception as e:
                    # Si falla (Redis no disponible), ejecutar directamente
                    logger.warning(f"⚠️ Could not queue RCON job {rcon_job.id} immediately: {e}")
                    logger.info(f"🔄 Executing RCON job directly")
                    try:
                        execute_rcon_job(str(rcon_job.id))
                        logger.info(f"✅ RCON job {rcon_job.id} executed directly")
                    except Exception as exec_error:
                        logger.error(f"❌ Failed to execute RCON job {rcon_job.id}: {exec_error}")
                        logger.info(f"📋 Job will be processed by Celery Beat when available")
            else:
                # Crear nuevo RCON job (ya ejecuta inmediatamente)
                rcon_job = cls._create_rcon_job(order, order.store, order.command_sent)
            
            # Actualizar estado a processing para RCON
            order.status = Order.Status.PROCESSING
            order.save()
            
            OrderStatusHistory.objects.create(
                order=order,
                to_status=Order.Status.PROCESSING,
                reason='Entrega RCON iniciada'
            )
            
            # Registrar uso de cuota
            store.register_rcon_delivery()
            
            logger.info(f"🎮 RCON delivery started for order {order.order_number}")
            
            # Queue job for immediate execution via Celery Worker
            from .tasks import execute_rcon_job
            
            try:
                # Always use apply_async to queue to Worker
                execute_rcon_job.apply_async(args=[str(rcon_job.id)], countdown=1)
                logger.info(f"✅ RCON job {rcon_job.id} queued for immediate execution")
            except Exception as e:
                # Si falla (Redis no disponible), ejecutar directamente
                logger.warning(f"⚠️ Could not queue RCON job {rcon_job.id} immediately: {e}")
                logger.info(f"🔄 Executing RCON job directly")
                try:
                    execute_rcon_job(str(rcon_job.id))
                    logger.info(f"✅ RCON job {rcon_job.id} executed directly")
                except Exception as exec_error:
                    logger.error(f"❌ Failed to execute RCON job {rcon_job.id}: {exec_error}")
                    logger.info(f"📋 Job will be processed by Celery Beat when available")
            
        elif order.delivery_method == Order.DeliveryMethod.MANUAL:
            # Entrega manual - se queda en REQUESTED hasta que el vendedor la marque como entregada
            OrderStatusHistory.objects.create(
                order=order,
                to_status=Order.Status.REQUESTED,
                reason='Pago confirmado. Esperando entrega manual del vendedor'
            )
            logger.info(f"📦 Manual delivery pending for order {order.order_number} - Status: REQUESTED")

        else:
            # PLUGIN (Bedrock / PlugsEssentials)
            cls._create_mod_commands(order, order.store)

            order.status = Order.Status.PROCESSING
            order.save()

            OrderStatusHistory.objects.create(
                order=order,
                to_status=Order.Status.PROCESSING,
                reason='Comandos encolados para entrega via PlugsEssentials'
            )

            # Registrar uso de cuota
            store.register_plugin_delivery()

            logger.info(f"🟩 Bedrock delivery queued for order {order.order_number}")
        
        return order
    
    @classmethod
    def _downgrade_to_manual(cls, order, reason, method):
        """
        Convierte un pedido automático a manual cuando se agota la cuota.
        Notifica al vendedor y deja el pedido en REQUESTED para entrega manual.
        """
        order.delivery_method = Order.DeliveryMethod.MANUAL
        order.manual_reason = Order.ManualReason.LIMIT_REACHED
        order.save(update_fields=['delivery_method', 'manual_reason'])

        method_label = 'RCON' if method == 'rcon' else 'PlugsEssentials'
        OrderStatusHistory.objects.create(
            order=order,
            to_status=Order.Status.REQUESTED,
            reason=f'Límite de entregas automáticas ({method_label}) alcanzado. Pasó a entrega manual.'
        )

        # Notificación al vendedor
        try:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=order.store.owner,
                type='system',
                title='Límite de entregas automáticas alcanzado',
                message=(
                    f'Has alcanzado el límite de 15 entregas automáticas via {method_label} '
                    f'de tu plan gratuito. El pedido {order.order_number} pasó a entrega manual. '
                    f'Actualiza tu plan de lightcode para entregas ilimitadas.'
                ),
                order=order,
                store=order.store,
                data={'action_url': f'/dashboard/{order.store.slug}/orders', 'method': method},
            )
        except Exception as e:
            logger.warning(f"Could not create limit notification: {e}")

        logger.warning(
            f"⚠️ Auto-delivery limit reached ({method_label}) for store {order.store.slug}. "
            f"Order {order.order_number} downgraded to manual."
        )

    @classmethod
    def mark_order_delivered(cls, order):
        """
        Marca una orden como entregada y libera el balance del vendedor.
        Se llama cuando:
        - RCON job se completa exitosamente
        - Vendedor marca manualmente como entregada
        
        Args:
            order: Order object
        """
        from .balance_service import BalanceService
        
        # Actualizar estado
        old_status = order.status
        order.status = Order.Status.DELIVERED
        order.delivered_at = timezone.now()
        order.save()
        
        # Crear historial
        OrderStatusHistory.objects.create(
            order=order,
            from_status=old_status,
            to_status=Order.Status.DELIVERED,
            reason='Orden entregada exitosamente'
        )
        
        # Liberar balance de pending a available
        if not order.balance_released:
            balance_tx = BalanceService.release_pending_to_available(order)
            logger.info(f"💰 Balance released to available for order {order.order_number}: ${order.seller_credited}")
        
        logger.info(f"✅ Order {order.order_number} marked as delivered")
        
        return order
