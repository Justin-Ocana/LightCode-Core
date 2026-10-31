"""
Admin Tools Views - Endpoints para RCON Lab
TEMPORAL: Sin autenticación para testing
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.core.cache import cache
from .rcon_service import RCONClient, RCONTester
import hashlib


def get_session_key(user_id: int) -> str:
    """Genera una clave de sesión para almacenar config RCON temporalmente"""
    return f"rcon_lab_session_{user_id}"


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def test_connection(request):
    """
    Prueba una conexión RCON
    POST /api/admin/rcon/test-connection/
    Body: { host, port, password, debug }
    """
    host = request.data.get('host')
    port = request.data.get('port')
    password = request.data.get('password')
    debug = request.data.get('debug', False)
    
    if not all([host, port, password]):
        return Response({
            'error': 'Missing required fields: host, port, password'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        port = int(port)
    except ValueError:
        return Response({
            'error': 'Port must be a number'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Guardar config en cache (10 minutos) - usar ID fijo para testing sin auth
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    cache.set(session_key, {
        'host': host,
        'port': port,
        'password': password
    }, timeout=600)
    
    # Probar conexión con modo debug
    client = RCONClient(host, port, password, debug=debug)
    response = client.connect()
    client.disconnect()
    
    result = {
        'status': 'connected' if response.success else 'error',
        'latency': response.latency,
        'error': response.error,
        'message': RCONTester._translate_error(response.error) if response.error else 'Connection successful'
    }
    
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def execute_command(request):
    """
    Ejecuta un comando RCON
    POST /api/admin/rcon/execute/
    Body: { command, simulate }
    """
    command = request.data.get('command', '').strip()
    simulate = request.data.get('simulate', False)
    
    if not command:
        return Response({
            'error': 'Command is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener config de sesión - usar ID fijo para testing sin auth
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    config = cache.get(session_key)
    
    if not config:
        return Response({
            'error': 'No active session. Please test connection first.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Ejecutar comando
    client = RCONClient(config['host'], config['port'], config['password'])
    
    if not simulate:
        connect_response = client.connect()
        if not connect_response.success:
            return Response({
                'success': False,
                'error': connect_response.error,
                'message': RCONTester._translate_error(connect_response.error)
            })
    
    response = client.execute(command, simulate=simulate)
    client.disconnect()
    
    return Response({
        'success': response.success,
        'command': command,
        'response': response.response,
        'latency': response.latency,
        'timestamp': response.timestamp,
        'simulated': simulate,
        'error': response.error
    })


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def stress_test(request):
    """
    Ejecuta un stress test
    POST /api/admin/rcon/stress-test/
    Body: { iterations }
    """
    iterations = request.data.get('iterations', 10)
    
    try:
        iterations = int(iterations)
        if iterations < 1 or iterations > 100:
            raise ValueError()
    except ValueError:
        return Response({
            'error': 'Iterations must be between 1 and 100'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener config de sesión - usar ID fijo para testing sin auth
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    config = cache.get(session_key)
    
    if not config:
        return Response({
            'error': 'No active session. Please test connection first.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Ejecutar stress test
    result = RCONTester.stress_test(
        config['host'],
        config['port'],
        config['password'],
        iterations
    )
    
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def batch_execute(request):
    """
    Ejecuta múltiples comandos en batch
    POST /api/admin/rcon/batch/
    Body: { commands: [] }
    """
    commands = request.data.get('commands', [])
    
    if not commands or not isinstance(commands, list):
        return Response({
            'error': 'Commands array is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if len(commands) > 50:
        return Response({
            'error': 'Maximum 50 commands per batch'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener config de sesión - usar ID fijo para testing sin auth
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    config = cache.get(session_key)
    
    if not config:
        return Response({
            'error': 'No active session. Please test connection first.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Ejecutar batch
    result = RCONTester.batch_test(
        config['host'],
        config['port'],
        config['password'],
        commands
    )
    
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def check_player_online(request):
    """
    Verifica si un jugador está online
    POST /api/admin/rcon/check-player/
    Body: { username }
    """
    username = request.data.get('username', '').strip()
    
    if not username:
        return Response({
            'error': 'Username is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener config de sesión
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    config = cache.get(session_key)
    
    if not config:
        return Response({
            'error': 'No active session. Please test connection first.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Verificar jugador
    result = RCONTester.check_player_online(
        config['host'],
        config['port'],
        config['password'],
        username
    )
    
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def test_product_delivery(request):
    """
    Simula la entrega de un producto
    POST /api/admin/rcon/test-delivery/
    Body: { username, commands: [], validate_online: bool }
    """
    username = request.data.get('username', '').strip()
    commands = request.data.get('commands', [])
    validate_online = request.data.get('validate_online', False)
    
    if not username:
        return Response({
            'error': 'Username is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not commands or not isinstance(commands, list):
        return Response({
            'error': 'Commands array is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener config de sesión - usar ID fijo para testing sin auth
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    config = cache.get(session_key)
    
    if not config:
        return Response({
            'error': 'No active session. Please test connection first.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Ejecutar test de entrega con validación opcional
    result = RCONTester.test_product_delivery(
        config['host'],
        config['port'],
        config['password'],
        username,
        commands,
        validate_online=validate_online
    )
    
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def get_session_status(request):
    """
    Obtiene el estado de la sesión actual
    GET /api/admin/rcon/session/
    """
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    config = cache.get(session_key)
    
    if not config:
        return Response({
            'active': False,
            'message': 'No active session'
        })
    
    # No devolver la contraseña, solo indicar que existe
    return Response({
        'active': True,
        'host': config['host'],
        'port': config['port'],
        'has_password': bool(config.get('password'))
    })


@api_view(['DELETE'])
@permission_classes([AllowAny])  # TEMPORAL: Sin auth
def clear_session(request):
    """
    Limpia la sesión actual
    DELETE /api/admin/rcon/session/
    """
    session_key = get_session_key(request.user.id if request.user.is_authenticated else 999)
    cache.delete(session_key)
    
    return Response({
        'message': 'Session cleared successfully'
    })


# ============================================================================
# RCON QUEUE - Admin Global View
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])  # TODO: Cambiar a IsAdminUser en producción
def get_rcon_queue(request):
    """
    Vista global de la cola RCON para admins de lightcode.
    Retorna tiendas paginadas con contadores agregados de jobs.
    
    GET /api/admin/rcon-queue/
    Query params:
        - page: número de página (default: 1)
        - page_size: tamaño de página (default: 20)
        - filter: 'all' | 'with_failures' | 'with_pending' (default: 'all')
    """
    from apps.orders.models import RCONJob
    from apps.stores.models import Store
    from django.db.models import Count, Q, Min
    from django.core.paginator import Paginator
    import traceback
    
    try:
        # Parámetros de paginación
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        filter_type = request.GET.get('filter', 'all')
        
        # Obtener todas las tiendas con jobs RCON
        stores_with_jobs = Store.objects.filter(
            orders__rcon_job__isnull=False
        ).distinct().annotate(
            total_jobs=Count('orders__rcon_job'),
            delivered_jobs=Count('orders__rcon_job', filter=Q(orders__rcon_job__status=RCONJob.Status.DELIVERED)),
            pending_jobs=Count('orders__rcon_job', filter=Q(orders__rcon_job__status=RCONJob.Status.PENDING)),
            failed_jobs=Count('orders__rcon_job', filter=Q(orders__rcon_job__status=RCONJob.Status.FAILED)),
            cancelled_jobs=Count('orders__rcon_job', filter=Q(orders__rcon_job__status=RCONJob.Status.CANCELLED)),
            next_retry=Min('orders__rcon_job__next_retry_at', filter=Q(orders__rcon_job__status=RCONJob.Status.PENDING))
        ).select_related('owner')
        
        # Aplicar filtros
        if filter_type == 'with_failures':
            stores_with_jobs = stores_with_jobs.filter(failed_jobs__gt=0)
        elif filter_type == 'with_pending':
            stores_with_jobs = stores_with_jobs.filter(pending_jobs__gt=0)
        
        # Ordenar por tiendas con problemas primero
        stores_with_jobs = stores_with_jobs.order_by('-failed_jobs', '-pending_jobs', '-total_jobs')
        
        # Paginar
        paginator = Paginator(stores_with_jobs, page_size)
        page_obj = paginator.get_page(page)
        
        # Serializar
        stores_data = []
        for store in page_obj:
            stores_data.append({
                'id': store.id,
                'name': store.name,
                'slug': store.slug,
                'seller_username': store.owner.username if store.owner else 'N/A',
                'seller_email': store.owner.email if store.owner else 'N/A',
                'stats': {
                    'total': store.total_jobs,
                    'delivered': store.delivered_jobs,
                    'pending': store.pending_jobs,
                    'failed': store.failed_jobs,
                    'cancelled': store.cancelled_jobs,
                },
                'next_retry_at': store.next_retry.isoformat() if store.next_retry else None,
            })
        
        return Response({
            'stores': stores_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_pages': paginator.num_pages,
                'total_stores': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
            },
            'filter': filter_type,
        })
    
    except Exception as e:
        # Log detallado del error
        error_trace = traceback.format_exc()
        print(f"❌ Error in get_rcon_queue: {str(e)}")
        print(error_trace)
        
        return Response({
            'error': str(e),
            'trace': error_trace
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # TODO: Cambiar a IsAdminUser en producción
def get_store_rcon_jobs(request, store_id):
    """
    Obtiene todos los jobs RCON de una tienda específica (lazy loading).
    
    GET /api/admin/rcon-queue/<store_id>/jobs/
    Query params:
        - status: filtrar por estado (opcional)
    """
    from apps.orders.models import RCONJob
    from apps.stores.models import Store
    
    try:
        store = Store.objects.get(id=store_id)
    except Store.DoesNotExist:
        return Response({
            'error': 'Store not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Obtener jobs de la tienda
    jobs = RCONJob.objects.filter(
        order__store=store
    ).select_related('order', 'cancelled_by').order_by('-created_at')
    
    # Filtrar por estado si se especifica
    status_filter = request.GET.get('status')
    if status_filter:
        jobs = jobs.filter(status=status_filter)
    
    # Serializar jobs
    jobs_data = []
    for job in jobs:
        jobs_data.append({
            'id': str(job.id),
            'order_number': job.order.order_number,
            'minecraft_username': job.order.minecraft_username,
            'product_name': job.order.product.name if job.order.product else 'N/A',
            'status': job.status,
            'failure_reason_type': job.failure_reason_type,
            'failure_reason': job.failure_reason,
            'last_error_message': job.last_error_message,
            'auto_retry_count': job.auto_retry_count,
            'manual_retry_count': job.manual_retry_count,
            'attempts': job.attempts,
            'max_attempts': job.max_attempts,
            'next_retry_at': job.next_retry_at.isoformat() if job.next_retry_at else None,
            'last_attempt_at': job.last_attempt_at.isoformat() if job.last_attempt_at else None,
            'created_at': job.created_at.isoformat(),
            'delivered_at': job.delivered_at.isoformat() if job.delivered_at else None,
            'cancelled_by': job.cancelled_by.username if job.cancelled_by else None,
            'cancelled_at': job.cancelled_at.isoformat() if job.cancelled_at else None,
            'command': job.command,
            'rcon_raw_log': job.rcon_raw_log,
        })
    
    return Response({
        'store': {
            'id': store.id,
            'name': store.name,
            'slug': store.slug,
        },
        'jobs': jobs_data,
        'total': len(jobs_data),
    })


@api_view(['POST'])
@permission_classes([AllowAny])  # TODO: Cambiar a IsAdminUser en producción
def cancel_rcon_job(request, job_id):
    """
    Cancela un job RCON (solo admin).
    Solo puede cancelar jobs en estado PENDING o PROCESSING.
    
    POST /api/admin/rcon-queue/jobs/<job_id>/cancel/
    """
    from apps.orders.models import RCONJob
    from django.utils import timezone
    
    try:
        job = RCONJob.objects.get(id=job_id)
    except RCONJob.DoesNotExist:
        return Response({
            'error': 'Job not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Validar que el job pueda ser cancelado
    if job.status not in [RCONJob.Status.PENDING, RCONJob.Status.PROCESSING]:
        return Response({
            'error': f'Cannot cancel job with status {job.status}. Only PENDING or PROCESSING jobs can be cancelled.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Cancelar el job
    job.status = RCONJob.Status.CANCELLED
    job.cancelled_by = request.user if request.user.is_authenticated else None
    job.cancelled_at = timezone.now()
    job.save()
    
    return Response({
        'success': True,
        'message': f'Job {job_id} cancelled successfully',
        'job': {
            'id': str(job.id),
            'status': job.status,
            'cancelled_by': job.cancelled_by.username if job.cancelled_by else 'System',
            'cancelled_at': job.cancelled_at.isoformat(),
        }
    })
