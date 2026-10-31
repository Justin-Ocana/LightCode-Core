"""
Store views - Endpoints para gestión de tiendas.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
import logging

from .models import Store, StoreSettings
from .serializers import (
    StoreListSerializer,
    StoreCreateSerializer,
    StoreDetailSerializer,
)

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def store_list(request):
    """
    GET /api/stores/django/
    
    Lista las tiendas del usuario autenticado.
    Solo sellers pueden tener tiendas.
    """
    user = request.user
    
    # Verificar que sea seller
    if user.user_type != 'seller':
        return Response(
            {'error': 'Solo los vendedores pueden tener tiendas.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Obtener tiendas del usuario (no eliminadas)
    stores = Store.objects.filter(
        owner=user,
        is_deleted=False
    ).order_by('-created_at')
    
    serializer = StoreListSerializer(stores, many=True)
    
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def store_create(request):
    """
    POST /api/stores/django/create/
    
    Crea una nueva tienda para el usuario autenticado.
    Valida límites de suscripción y datos de entrada.
    """
    user = request.user
    
    # Log para debug
    logger.info(f"Store creation attempt by {user.username}")
    logger.info(f"Request data: {request.data}")
    
    # Verificar que sea seller
    if user.user_type != 'seller':
        logger.warning(f"Non-seller user {user.username} tried to create store")
        return Response(
            {'error': 'Solo los vendedores pueden crear tiendas.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Verificar que tenga seller_profile
    if not hasattr(user, 'seller_profile'):
        logger.error(f"Seller {user.username} has no seller_profile")
        return Response(
            {'error': 'Perfil de vendedor no encontrado.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Crear serializer con contexto
        serializer = StoreCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        
        # Validar datos
        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            
            # Formatear errores para el frontend
            errors = {}
            for field, messages in serializer.errors.items():
                if field == 'error':
                    # Error general
                    error_msg = messages[0] if isinstance(messages, list) else messages
                    logger.error(f"General error: {error_msg}")
                    return Response(
                        {'error': error_msg},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                errors[field] = messages[0] if isinstance(messages, list) else messages
            
            logger.error(f"Field errors: {errors}")
            return Response(
                {'errors': errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Crear tienda
        store = serializer.save()
        
        # Retornar tienda creada
        response_serializer = StoreDetailSerializer(store)
        
        logger.info(f"Store created: {store.slug} by {user.username}")
        
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )
    
    except DjangoValidationError as e:
        # Errores de validación del modelo
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    except Exception as e:
        # Error inesperado
        logger.error(f"Error creating store: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al crear la tienda. Por favor intenta de nuevo.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def store_detail(request, store_id):
    """
    GET /api/stores/{id}/ - Obtiene los detalles de una tienda
    PATCH /api/stores/{id}/ - Actualiza una tienda
    DELETE /api/stores/{id}/ - Elimina una tienda (soft delete)
    
    Solo el owner puede ver/editar/eliminar su tienda.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para acceder a esta tienda.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        serializer = StoreDetailSerializer(store)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PATCH':
        try:
            from core.cloudinary_utils import upload_store_logo, upload_store_banner
            from django.conf import settings
            import cloudinary.uploader
            
            # Actualizar solo campos permitidos
            allowed_fields = [
                'name', 'description', 'tagline', 'currency', 'timezone',
                'language', 'email', 'phone', 'discord_invite',
                'minecraft_server_ip', 'minecraft_server_port', 'minecraft_version',
                'primary_color', 'secondary_color',
            ]
            
            for field in allowed_fields:
                if field in request.data:
                    setattr(store, field, request.data[field])
            
            # Manejar eliminación de logo
            if request.data.get('remove_logo') == 'true':
                if store.logo:
                    try:
                        if settings.USE_CLOUDINARY:
                            cloudinary.uploader.destroy(store.logo)
                            logger.info(f"Logo deleted from Cloudinary: {store.logo}")
                    except Exception as e:
                        logger.error(f"Error deleting logo from Cloudinary: {str(e)}")
                store.logo = ''  # Set to empty string, not None
                logger.info("Logo removed from store")
            # Manejar subida de logo
            elif 'logo_file' in request.FILES:
                logo_file = request.FILES['logo_file']
                try:
                    if settings.USE_CLOUDINARY:
                        result = upload_store_logo(logo_file, store.id)
                        store.logo = result['public_id']
                        logger.info(f"Logo uploaded: {result['public_id']}")
                    else:
                        logger.warning("Cloudinary not configured")
                except ValidationError as e:
                    # Validation error - return immediately without saving
                    error_message = str(e.messages[0]) if hasattr(e, 'messages') else str(e)
                    logger.error(f"Logo validation failed: {error_message}")
                    return Response(
                        {'error': error_message},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                except Exception as e:
                    logger.error(f"Error uploading logo: {str(e)}", exc_info=True)
                    return Response(
                        {'error': f'Error al subir el logo: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            # Manejar eliminación de banner
            if request.data.get('remove_banner') == 'true':
                if store.banner:
                    try:
                        if settings.USE_CLOUDINARY:
                            cloudinary.uploader.destroy(store.banner)
                            logger.info(f"Banner deleted from Cloudinary: {store.banner}")
                    except Exception as e:
                        logger.error(f"Error deleting banner from Cloudinary: {str(e)}")
                store.banner = ''  # Set to empty string, not None
                logger.info("Banner removed from store")
            # Manejar subida de banner
            elif 'banner_file' in request.FILES:
                banner_file = request.FILES['banner_file']
                logger.info(f"Banner file found: {banner_file.name}, size: {banner_file.size}")
                try:
                    if settings.USE_CLOUDINARY:
                        result = upload_store_banner(banner_file, store.id)
                        store.banner = result['public_id']
                        logger.info(f"Banner uploaded to Cloudinary: {result['public_id']}")
                    else:
                        logger.warning("Cloudinary not configured, skipping banner upload")
                except ValidationError as e:
                    # Validation error - return immediately without saving
                    error_message = str(e.messages[0]) if hasattr(e, 'messages') else str(e)
                    logger.error(f"Banner validation failed: {error_message}")
                    return Response(
                        {'error': error_message},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                except Exception as e:
                    logger.error(f"Error uploading banner: {str(e)}", exc_info=True)
                    return Response(
                        {'error': f'Error al subir el banner: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            else:
                logger.info("No banner_file in request.FILES")
            
            # Validar y guardar
            try:
                store.full_clean()
                store.save()
                store.refresh_from_db()
            except Exception as e:
                logger.error(f"Error validating store: {str(e)}")
                return Response(
                    {'error': f'Error de validación: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = StoreDetailSerializer(store)
            
            logger.info(f"Store updated: {store.slug}")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error updating store: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al actualizar la tienda.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            # Soft delete
            store.soft_delete()
            
            # Actualizar contador del seller
            seller = request.user.seller_profile
            seller.total_stores = Store.objects.filter(
                owner=request.user,
                is_deleted=False
            ).count()
            seller.save(update_fields=['total_stores'])
            
            logger.info(f"Store deleted: {store.slug} by {request.user.username}")
            
            return Response(
                {'message': 'Tienda eliminada exitosamente.'},
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Error deleting store: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al eliminar la tienda.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



@api_view(['GET'])
@permission_classes([AllowAny])  # Public endpoint for listing stores
@authentication_classes([])
@throttle_classes([])
def store_list_public(request):
    """
    GET /api/stores/public/
    
    Lista todas las tiendas activas y verificadas.
    Public endpoint - no authentication required.
    Para white-label, solo retorna la primera tienda con auto-selección.
    """
    # Para white-label, ser más flexible con los filtros
    stores = Store.objects.filter(
        is_deleted=False
    ).order_by('created_at')[:1]  # Solo la primera tienda
    
    # Si no hay tiendas con filtros estrictos, intentar con filtros más flexibles
    if not stores.exists():
        stores = Store.objects.filter(
            is_deleted=False
        ).order_by('created_at')[:1]
    
    serializer = StoreListSerializer(stores, many=True)
    
    # Para white-label con una sola tienda, agregar metadata
    response_data = {
        'stores': serializer.data,
        'is_single_store': len(serializer.data) == 1,
        'auto_select': True  # Indica al frontend que debe auto-seleccionar
    }
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])  # Public endpoint for store pages
@authentication_classes([])
@throttle_classes([])  # SPA hits this on every route; global anon throttle causes 429 in dev
def store_by_slug(request, slug):
    """
    GET /api/stores/slug/{slug}/
    
    Obtiene una tienda por su slug.
    Incrementa el contador de vistas.
    Public endpoint - no authentication required.
    """
    try:
        store = Store.objects.get(slug=slug, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Incrementar vistas (solo si no es el owner o no está autenticado)
    if request.user.is_authenticated and store.owner == request.user:
        # Owner viewing their own store - show full details
        serializer = StoreDetailSerializer(store)
    else:
        # Public view or other users
        # Para white-label, ser más flexible - no requerir verificación
        if store.status == 'inactive':
            return Response(
                {'error': 'Tienda no disponible.'},
                status=status.HTTP_404_NOT_FOUND
            )
        # Increment views for public/non-owner access
        store.increment_views()
        serializer = StoreListSerializer(store)
    
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def buyer_orders(request, slug):
    """
    GET /api/stores/{slug}/orders/my-orders/?email={email}
    
    Obtiene los pedidos de un comprador por su email.
    Public endpoint - no authentication required.
    
    Query params:
        - email: Email del comprador (requerido)
    """
    email = request.GET.get('email')
    
    if not email:
        return Response(
            {'error': 'Email es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        store = Store.objects.get(slug=slug, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Buscar pedidos por email del comprador
    # Puede estar en buyer.email o en buyer_contact_email (para compras sin registro)
    from apps.orders.models import Order
    from apps.orders.serializers import OrderListSerializer
    from django.db.models import Q
    
    orders = Order.objects.filter(
        store=store
    ).filter(
        Q(buyer__email=email) | Q(buyer_contact_email=email)
    ).exclude(
        paypal_transaction_id__startswith='pending_'  # Excluir órdenes pendientes de pago
    ).select_related(
        'buyer', 'store', 'product', 'discount'
    ).prefetch_related(
        'rcon_job'
    ).order_by('-created_at')
    
    serializer = OrderListSerializer(orders, many=True)
    
    return Response({
        'orders': serializer.data,
        'count': orders.count()
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def buyer_order_detail(request, slug, order_id):
    """
    GET /api/stores/{slug}/orders/{order_id}/?email={email}
    
    Obtiene el detalle de un pedido específico.
    Public endpoint - no authentication required.
    Requiere que el email coincida con el comprador.
    
    Query params:
        - email: Email del comprador (requerido)
    """
    email = request.GET.get('email')
    
    if not email:
        return Response(
            {'error': 'Email es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        store = Store.objects.get(slug=slug, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Buscar pedido por ID y verificar que pertenece al comprador
    from apps.orders.models import Order
    from apps.orders.serializers import OrderDetailSerializer
    from django.db.models import Q
    
    try:
        order = Order.objects.select_related(
            'buyer', 'store', 'product', 'discount'
        ).prefetch_related(
            'rcon_job', 'status_history', 'notes'
        ).get(
            id=order_id,
            store=store
        )
        
        # Verificar que el email coincide con el comprador
        if not ((order.buyer and order.buyer.email == email) or order.buyer_contact_email == email):
            return Response(
                {'error': 'No tienes permiso para ver este pedido'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Excluir órdenes pendientes de pago
        if order.paypal_transaction_id and order.paypal_transaction_id.startswith('pending_'):
            return Response(
                {'error': 'Pedido no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = OrderDetailSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Pedido no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def buyer_retry_rcon(request, slug, order_id):
    """
    POST /api/stores/{slug}/orders/{order_id}/retry-rcon/?email={email}
    
    Solicita un reintento manual de entrega RCON.
    Public endpoint - no authentication required.
    Requiere que el email coincida con el comprador.
    
    Query params:
        - email: Email del comprador (requerido)
    """
    email = request.GET.get('email')
    
    if not email:
        return Response(
            {'error': 'Email es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        store = Store.objects.get(slug=slug, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Buscar pedido y verificar permisos
    from apps.orders.models import Order, RCONJob
    from django.db.models import Q
    from django.utils import timezone
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        order = Order.objects.select_related('store').prefetch_related('rcon_job').get(
            id=order_id,
            store=store
        )
        
        # Verificar que el email coincide
        if not ((order.buyer and order.buyer.email == email) or order.buyer_contact_email == email):
            return Response(
                {'error': 'No tienes permiso para realizar esta acción'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verificar que tenga RCON job
        if not hasattr(order, 'rcon_job'):
            return Response(
                {'error': 'Este pedido no tiene entrega RCON'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        rcon_job = order.rcon_job
        
        # Verificar que no esté ya procesando
        if rcon_job.status == RCONJob.Status.PROCESSING:
            return Response(
                {'error': 'El pedido ya está siendo procesado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que no esté ya entregado
        if rcon_job.status == RCONJob.Status.DELIVERED:
            return Response(
                {'error': 'El pedido ya fue entregado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Incrementar contador manual y resetear automático
        rcon_job.manual_retry_count += 1
        rcon_job.auto_retry_count = 0
        rcon_job.attempts = 0
        
        # Resetear estado
        rcon_job.status = RCONJob.Status.PENDING
        rcon_job.next_retry_at = timezone.now()
        rcon_job.save()
        
        logger.info(f"🔄 Buyer requested manual RCON retry for order {order.order_number}")
        
        # Ejecutar directamente
        from apps.orders.tasks import execute_rcon_job
        execute_rcon_job(str(rcon_job.id), force=True)
        
        # Refrescar para obtener estado actualizado
        rcon_job.refresh_from_db()
        
        # Generar mensaje según resultado
        if rcon_job.status == RCONJob.Status.DELIVERED:
            message = '✅ Entrega completada exitosamente'
        elif rcon_job.status == RCONJob.Status.PENDING:
            if 'jugador' in (rcon_job.failure_reason or '').lower():
                message = '⏳ Jugador no conectado. Se reintentará automáticamente.'
            else:
                message = '⏳ Reintento programado. Se procesará automáticamente.'
        else:
            message = rcon_job.failure_reason or 'Reintento ejecutado'
        
        return Response({
            'success': True,
            'message': message,
            'job_status': rcon_job.status
        }, status=status.HTTP_200_OK)
        
    except Order.DoesNotExist:
        return Response(
            {'error': 'Pedido no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def store_stats(request, store_id):
    """
    GET /api/stores/{id}/stats/
    
    Obtiene estadísticas de una tienda.
    Solo el owner puede ver stats.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para ver estas estadísticas.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    stats = {
        'total_products': store.total_products,
        'total_orders': store.total_orders,
        'total_revenue': float(store.total_revenue),
        'total_buyers': store.total_buyers,
        'views_count': store.views_count,
        'last_order_at': store.last_order_at,
        'status': store.status,
        'is_verified': store.is_verified,
        'created_at': store.created_at,
    }
    
    return Response(stats, status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def store_settings(request, store_id):
    """
    GET/PATCH /api/stores/{id}/settings/
    
    Obtiene o actualiza la configuración de una tienda.
    Solo el owner puede acceder.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para acceder a esta configuración.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Obtener o crear settings
    settings, created = StoreSettings.objects.get_or_create(store=store)
    
    if request.method == 'GET':
        from .serializers import StoreSettingsSerializer
        serializer = StoreSettingsSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PATCH':
        from .serializers import StoreSettingsSerializer
        serializer = StoreSettingsSerializer(
            settings,
            data=request.data,
            partial=True
        )
        
        if not serializer.is_valid():
            return Response(
                {'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer.save()
        
        logger.info(f"Store settings updated: {store.slug} by {request.user.username}")
        
        return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def store_restore(request, store_id):
    """
    POST /api/stores/{id}/restore/
    
    Restaura una tienda eliminada (soft delete).
    Solo el owner puede restaurar.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=True)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada o no está eliminada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para restaurar esta tienda.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Restaurar
        store.restore()
        
        # Actualizar contador del seller
        seller = request.user.seller_profile
        seller.total_stores = Store.objects.filter(
            owner=request.user,
            is_deleted=False
        ).count()
        seller.save(update_fields=['total_stores'])
        
        serializer = StoreDetailSerializer(store)
        
        logger.info(f"Store restored: {store.slug} by {request.user.username}")
        
        return Response(
            {
                'message': 'Tienda restaurada exitosamente.',
                'store': serializer.data
            },
            status=status.HTTP_200_OK
        )
    
    except Exception as e:
        logger.error(f"Error restoring store: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al restaurar la tienda.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# RCON CONFIGURATION ENDPOINTS
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rcon_test_connection(request, store_id):
    """
    POST /api/stores/{id}/rcon/test/
    
    Prueba la conexión RCON sin guardar.
    Retorna estado, latencia y errores traducidos.
    """
    from .rcon_utils import encrypt_rcon_password
    from apps.admin_tools.rcon_service import RCONClient, RCONTester
    
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para configurar RCON en esta tienda.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Validar datos
    host = request.data.get('host', '').strip()
    port = request.data.get('port')
    password = request.data.get('password', '').strip()
    
    # Si password es "stored", usar la contraseña guardada en la DB
    if password == 'stored':
        if not store.rcon_enabled or not store.rcon_password_encrypted:
            return Response(
                {'error': 'No hay contraseña RCON guardada para esta tienda'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            from .rcon_utils import decrypt_rcon_password
            password = decrypt_rcon_password(store.rcon_password_encrypted)
        except Exception as e:
            logger.error(f"Error decrypting stored RCON password: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al desencriptar la contraseña guardada'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    if not all([host, port, password]):
        return Response(
            {'error': 'Todos los campos son requeridos: host, port, password'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validar que el host no contenga puerto
    if ':' in host:
        return Response({
            'status': 'error',
            'error': 'INVALID_HOST_FORMAT',
            'message': 'El host no debe incluir el puerto. Separa la IP y el puerto en campos diferentes.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Validar puerto
    try:
        port = int(port)
        if port < 1 or port > 65535:
            raise ValueError()
    except (ValueError, TypeError):
        return Response({
            'status': 'error',
            'error': 'INVALID_PORT',
            'message': 'El puerto debe ser un número entre 1 y 65535'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Advertencia si el puerto es 25565 (puerto del juego)
    if port == 25565:
        return Response({
            'status': 'warning',
            'error': 'POSSIBLE_WRONG_PORT',
            'message': '⚠️ El puerto 25565 es el puerto del juego, no el puerto RCON. El puerto RCON suele ser 25575.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Probar conexión
    try:
        result = RCONTester.test_connection(host, port, password, debug=False)
        
        if result['status'] == 'connected':
            return Response({
                'status': 'connected',
                'latency': result['latency'],
                'message': 'Conexión exitosa'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'status': 'error',
                'error': result['error'],
                'message': result['message'],
                'latency': result.get('latency', 0)
            }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error testing RCON connection: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'error': 'UNKNOWN_ERROR',
            'message': f'Error inesperado: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rcon_save_config(request, store_id):
    """
    POST /api/stores/{id}/rcon/save/
    
    Guarda la configuración RCON después de una prueba exitosa.
    Encripta la contraseña antes de guardar.
    """
    from .rcon_utils import encrypt_rcon_password
    
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para configurar RCON en esta tienda.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Validar datos
    host = request.data.get('host', '').strip()
    port = request.data.get('port')
    password = request.data.get('password', '').strip()
    latency = request.data.get('latency', 0)
    
    if not all([host, port, password]):
        return Response(
            {'error': 'Todos los campos son requeridos'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        port = int(port)
    except (ValueError, TypeError):
        return Response(
            {'error': 'Puerto inválido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Encriptar contraseña
    try:
        encrypted_password = encrypt_rcon_password(password)
    except Exception as e:
        logger.error(f"Error encrypting RCON password: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al encriptar la contraseña'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Guardar configuración
    try:
        store.rcon_enabled = True
        store.rcon_host = host
        store.rcon_port = port
        store.rcon_password_encrypted = encrypted_password
        store.rcon_last_test = timezone.now()
        store.rcon_last_latency = latency
        store.save(update_fields=[
            'rcon_enabled',
            'rcon_host',
            'rcon_port',
            'rcon_password_encrypted',
            'rcon_last_test',
            'rcon_last_latency'
        ])
        
        logger.info(f"RCON configured for store {store.slug} by {request.user.username}")
        
        return Response({
            'success': True,
            'message': 'Configuración RCON guardada exitosamente',
            'rcon_enabled': True,
            'rcon_host': host,
            'rcon_port': port,
            'rcon_last_test': store.rcon_last_test,
            'rcon_last_latency': latency
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error saving RCON config: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al guardar la configuración'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rcon_get_config(request, store_id):
    """
    GET /api/stores/{id}/rcon/
    
    Obtiene la configuración RCON actual (sin la contraseña).
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para ver la configuración RCON.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    return Response({
        'rcon_enabled': store.rcon_enabled,
        'rcon_host': store.rcon_host or '',
        'rcon_port': store.rcon_port or 25575,
        'has_password': bool(store.rcon_password_encrypted),
        'rcon_last_test': store.rcon_last_test,
        'rcon_last_latency': store.rcon_last_latency
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def rcon_delete_config(request, store_id):
    """
    DELETE /api/stores/{id}/rcon/
    
    Elimina la configuración RCON de la tienda.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para eliminar la configuración RCON.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        store.rcon_enabled = False
        store.rcon_host = ''
        store.rcon_port = None
        store.rcon_password_encrypted = ''
        store.rcon_last_test = None
        store.rcon_last_latency = None
        store.save(update_fields=[
            'rcon_enabled',
            'rcon_host',
            'rcon_port',
            'rcon_password_encrypted',
            'rcon_last_test',
            'rcon_last_latency'
        ])
        
        logger.info(f"RCON config deleted for store {store.slug} by {request.user.username}")
        
        return Response({
            'success': True,
            'message': 'Configuración RCON eliminada'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error deleting RCON config: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al eliminar la configuración'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rcon_execute_command(request, store_id):
    """
    POST /api/stores/{id}/rcon/execute/
    
    Ejecuta un comando RCON usando la configuración guardada de la tienda.
    """
    from .rcon_utils import decrypt_rcon_password
    from core.rcon_service import RCONDeliveryService
    
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para ejecutar comandos RCON.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Verificar que RCON esté configurado
    if not store.rcon_enabled or not store.rcon_password_encrypted:
        return Response(
            {'error': 'RCON no está configurado para esta tienda'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener comando
    command = request.data.get('command', '').strip()
    if not command:
        return Response(
            {'error': 'El comando es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Desencriptar contraseña
        password = decrypt_rcon_password(store.rcon_password_encrypted)
        
        # Ejecutar comando usando el servicio centralizado
        result = RCONDeliveryService.execute_command(
            host=store.rcon_host,
            port=store.rcon_port,
            password=password,
            command=command
        )
        
        logger.info(f"RCON command executed on store {store.slug}: {command}")
        
        return Response(result, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error executing RCON command: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rcon_test_delivery(request, store_id):
    """
    POST /api/stores/{id}/rcon/test-delivery/
    
    Simula la entrega de un producto usando la configuración guardada.
    """
    from .rcon_utils import decrypt_rcon_password
    from core.rcon_service import RCONDeliveryService
    
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para probar entregas RCON.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Verificar que RCON esté configurado
    if not store.rcon_enabled or not store.rcon_password_encrypted:
        return Response(
            {'error': 'RCON no está configurado para esta tienda'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener datos
    username = request.data.get('username', '').strip()
    commands = request.data.get('commands', [])
    validate_online = request.data.get('validate_online', True)
    
    if not username:
        return Response(
            {'error': 'El nombre de usuario es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not commands or not isinstance(commands, list):
        return Response(
            {'error': 'Los comandos son requeridos'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Desencriptar contraseña
        password = decrypt_rcon_password(store.rcon_password_encrypted)
        
        # Usar el servicio centralizado de entrega
        result = RCONDeliveryService.deliver_product(
            host=store.rcon_host,
            port=store.rcon_port,
            password=password,
            username=username,
            commands=commands,
            validate_online=validate_online,
            store_slug=store.slug
        )
        
        return Response(result, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error testing delivery: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def paypal_config(request, store_id):
    """
    GET/POST /api/stores/{id}/paypal/
    
    Obtiene o actualiza la configuración de PayPal de la tienda.
    Requiere contraseña de lightcode para confirmar cambios.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para gestionar la configuración de PayPal.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        # Retornar configuración actual
        return Response({
            'paypal_email': store.paypal_email or '',
            'has_paypal': bool(store.paypal_email)
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        # Actualizar configuración
        paypal_email = request.data.get('paypal_email', '').strip()
        password = request.data.get('password', '').strip()
        
        # Si se está desconectando PayPal (email vacío), no requerir contraseña
        if not paypal_email:
            # Desconectar PayPal
            store.paypal_email = None
            store.save(update_fields=['paypal_email'])
            
            logger.info(f"PayPal disconnected for store {store.slug} by {request.user.username}")
            
            return Response({
                'success': True,
                'message': 'PayPal desconectado exitosamente',
                'paypal_email': '',
                'has_paypal': False
            }, status=status.HTTP_200_OK)
        
        # Para conectar/cambiar email de PayPal, sí requerir contraseña
        if not password:
            return Response(
                {'error': 'La contraseña de lightcode es requerida para confirmar cambios'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar contraseña usando check_password en lugar de authenticate
        if not request.user.check_password(password):
            return Response(
                {'error': 'Contraseña incorrecta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar email de PayPal si se proporciona
        if paypal_email:
            from django.core.validators import validate_email
            from django.core.exceptions import ValidationError
            
            try:
                validate_email(paypal_email)
            except ValidationError:
                return Response(
                    {'error': 'Email de PayPal inválido'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Actualizar
        store.paypal_email = paypal_email if paypal_email else None
        store.save(update_fields=['paypal_email'])
        
        logger.info(f"PayPal config updated for store {store.slug} by {request.user.username}")
        
        return Response({
            'success': True,
            'message': 'Configuración de PayPal actualizada',
            'paypal_email': store.paypal_email or '',
            'has_paypal': bool(store.paypal_email)
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_store_config(request, store_id):
    """
    GET /api/stores/django/{store_id}/check-config/
    
    Verifica qué configuraciones están completas en la tienda.
    Útil para mostrar advertencias al crear productos.
    
    Returns:
        {
            'rcon': {
                'configured': bool,
                'enabled': bool,
                'last_test': datetime or null
            },
            'paypal': {
                'configured': bool,
                'email': str or null
            }
        }
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user:
        return Response(
            {'error': 'No tienes permiso para ver esta tienda'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Verificar configuraciones
    rcon_configured = bool(
        store.rcon_host and 
        store.rcon_port and 
        store.rcon_password_encrypted
    )
    
    paypal_configured = bool(store.paypal_email)
    
    return Response({
        'rcon': {
            'configured': rcon_configured,
            'enabled': store.rcon_enabled,
            'last_test': store.rcon_last_test,
            'host': store.rcon_host if rcon_configured else None,
            'port': store.rcon_port if rcon_configured else None,
        },
        'paypal': {
            'configured': paypal_configured,
            'email': store.paypal_email if paypal_configured else None,
        },
        'bedrock': {
            'configured': bool(store.mod_api_key),
            'server_type': store.server_type,
        }
    }, status=status.HTTP_200_OK)



# ============================================================================
# META TAGS FOR SOCIAL SHARING (Discord, Facebook, etc.)
# ============================================================================

from django.shortcuts import render, get_object_or_404
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt


@require_http_methods(["GET"])
@csrf_exempt
def store_meta_view(request, slug):
    """
    GET /store/{slug}/meta/
    
    Sirve HTML con meta tags para bots de Discord, Facebook, etc.
    Redirige a usuarios normales a la SPA.
    
    Este endpoint es llamado por bots que no ejecutan JavaScript,
    permitiendo que vean los meta tags correctos de cada tienda.
    """
    store = get_object_or_404(Store, slug=slug, is_deleted=False, status='active')
    
    # Construir URLs de imágenes
    from core.cloudinary_utils import CloudinaryImageHandler
    
    # Preferir banner sobre logo para OG image (mejor para previews)
    if store.banner:
        image_url = CloudinaryImageHandler.get_transformed_url(
            store.banner,
            transformation='banner'
        )
    elif store.logo:
        image_url = CloudinaryImageHandler.get_transformed_url(
            store.logo,
            transformation='store_logo'
        )
    else:
        # Fallback a imagen de lightcode
        image_url = 'https://www.lightcodehub.com/image_lightcode.png'
    
    # Construir descripción
    description = store.description or store.tagline or f"Compra rangos, items y más en {store.name}"
    
    # Limitar descripción a 160 caracteres para SEO
    if len(description) > 160:
        description = description[:157] + '...'
    
    context = {
        'store_name': store.name,
        'title': f"{store.name} — Tienda de Minecraft",
        'description': description,
        'image': image_url,
        'url': f"https://www.lightcodehub.com/store/{slug}",
    }
    
    logger.info(f"Meta tags served for store: {slug}")
    
    return render(request, 'store_meta.html', context)
