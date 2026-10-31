"""
PayPal OAuth Views - Login with PayPal

Endpoints para conectar cuentas PayPal usando OAuth (sin Partner API).
"""
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.stores.models import Store
from .models import PayPalConnection, PaymentIntegrationLog
from .paypal_oauth_service import PayPalOAuthService
from .serializers import PayPalConnectionSerializer
import logging
import secrets

logger = logging.getLogger(__name__)

paypal_oauth_service = PayPalOAuthService()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_paypal_oauth(request, store_slug):
    """
    Inicia el flujo OAuth de PayPal.
    
    POST /api/stores/{store_slug}/payment-integrations/paypal/oauth/connect
    
    Returns:
        {
            "authorization_url": "https://paypal.com/signin/authorize?...",
            "state": "random_state_for_csrf"
        }
    """
    try:
        # Get store
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada o no tienes permisos'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if already connected
        existing = PayPalConnection.objects.filter(store=store).first()
        if existing and existing.is_connected():
            return Response(
                {'error': 'PayPal ya está conectado a esta tienda'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Store state in session for verification
        request.session[f'paypal_oauth_state_{store.id}'] = state
        
        # Generate redirect URI - usar URL fija para todas las tiendas
        # PayPal no permite wildcards, así que usamos una ruta fija
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        redirect_uri = f"{frontend_url}/paypal-callback"
        
        # Guardar store_slug en el state para recuperarlo después
        state_data = f"{state}:{store_slug}"
        
        # Get authorization URL
        auth_url = paypal_oauth_service.get_authorization_url(
            redirect_uri=redirect_uri,
            state=state_data  # Incluye store_slug en el state
        )
        
        PaymentIntegrationLog.log_event(
            store=store,
            provider='paypal',
            event_type='oauth_started',
            message='Seller initiated PayPal OAuth connection',
            request=request
        )
        
        return Response({
            'authorization_url': auth_url,
            'state': state
        })
        
    except Exception as e:
        logger.error(f"Error initiating PayPal OAuth: {e}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_paypal_oauth(request, store_slug):
    """
    Completa el flujo OAuth de PayPal.
    
    POST /api/stores/{store_slug}/payment-integrations/paypal/oauth/complete
    Body: {
        "code": "authorization_code_from_paypal",
        "state": "state_from_authorization"
    }
    
    Returns:
        {
            "success": true,
            "connection": {...}
        }
    """
    try:
        # Get store
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada o no tienes permisos'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get code and state from request
        code = request.data.get('code')
        state = request.data.get('state')
        
        if not code:
            return Response(
                {'error': 'Código de autorización no proporcionado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify state (CSRF protection)
        stored_state = request.session.get(f'paypal_oauth_state_{store.id}')
        if state and stored_state and state != stored_state:
            logger.warning(f"State mismatch for store {store.slug}")
            return Response(
                {'error': 'Estado de seguridad inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Clear state from session
        if stored_state:
            del request.session[f'paypal_oauth_state_{store.id}']
        
        # Generate redirect URI (must match the one used in authorization)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        redirect_uri = f"{frontend_url}/paypal-callback"
        
        # Complete OAuth flow
        connection = paypal_oauth_service.connect_store(
            store=store,
            code=code,
            redirect_uri=redirect_uri
        )
        
        if not connection:
            return Response(
                {'error': 'No se pudo completar la conexión con PayPal'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Serialize and return
        serializer = PayPalConnectionSerializer(connection)
        
        return Response({
            'success': True,
            'message': 'PayPal conectado exitosamente',
            'connection': serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error completing PayPal OAuth: {e}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_paypal_status(request, store_slug):
    """
    Obtiene el estado de la conexión PayPal.
    
    GET /api/stores/{store_slug}/payment-integrations/paypal/status
    
    Returns:
        {
            "connected": true/false,
            "connection": {...} or null
        }
    """
    try:
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        connection = PayPalConnection.objects.filter(store=store).first()
        
        if connection and connection.is_connected():
            serializer = PayPalConnectionSerializer(connection)
            return Response({
                'connected': True,
                'connection': serializer.data
            })
        else:
            return Response({
                'connected': False,
                'connection': None
            })
            
    except Exception as e:
        logger.error(f"Error getting PayPal status: {e}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_paypal(request, store_slug):
    """
    Desconecta PayPal de la tienda.
    
    POST /api/stores/{store_slug}/payment-integrations/paypal/disconnect
    
    Returns:
        {
            "success": true,
            "message": "..."
        }
    """
    try:
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        success = paypal_oauth_service.disconnect_store(store)
        
        if success:
            return Response({
                'success': True,
                'message': 'PayPal desconectado exitosamente'
            })
        else:
            return Response(
                {'error': 'No hay conexión PayPal para desconectar'},
                status=status.HTTP_404_NOT_FOUND
            )
            
    except Exception as e:
        logger.error(f"Error disconnecting PayPal: {e}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
