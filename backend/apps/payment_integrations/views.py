"""
Payment Integration Views

Endpoints for connecting/disconnecting payment providers.
"""
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.stores.models import Store
from .models import PayPalConnection, PaymentIntegrationLog
from .paypal_partner_service import PayPalPartnerService
from .paypal_oauth_service import PayPalOAuthService
from .serializers import PayPalConnectionSerializer
import logging

logger = logging.getLogger(__name__)

paypal_partner_service = PayPalPartnerService()
paypal_oauth_service = PayPalOAuthService()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_paypal_connection(request, store_slug):
    """
    Step 1: Generate PayPal referral link for seller onboarding.
    
    POST /api/stores/{store_slug}/payment-integrations/paypal/connect
    
    Returns:
        {
            "action_url": "https://paypal.com/...",
            "referral_id": "..."
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
        
        # Generate return URL with store slug
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        return_url = f"{frontend_url}/dashboard/{store_slug}/payment-methods"
        
        # Create referral link
        result = paypal_partner_service.create_referral_link(store, return_url)
        
        if not result:
            return Response(
                {'error': 'No se pudo generar el link de PayPal. Intenta de nuevo.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Save or update connection record
        if existing:
            existing.referral_link = result['action_url']
            existing.partner_referral_id = result['referral_id']
            existing.status = 'pending'
            existing.save()
        else:
            PayPalConnection.objects.create(
                store=store,
                merchant_id='',  # Will be filled after callback
                merchant_email='',
                access_token_encrypted='',
                refresh_token_encrypted='',
                expires_at=timezone.now(),
                referral_link=result['action_url'],
                partner_referral_id=result['referral_id'],
                status='pending'
            )
        
        PaymentIntegrationLog.log_event(
            store=store,
            provider='paypal',
            event_type='connection_started',
            message='Seller initiated PayPal connection',
            request=request
        )
        
        return Response({
            'action_url': result['action_url'],
            'referral_id': result['referral_id']
        })
        
    except Exception as e:
        logger.error(f"Error initiating PayPal connection: {e}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_paypal_connection(request, store_slug):
    """
    Step 2: Complete PayPal connection after redirect.
    
    POST /api/stores/{store_slug}/payment-integrations/paypal/complete
    
    Body:
        {
            "merchantIdInPayPal": "...",
            "permissionsGranted": true,
            "consentStatus": true,
            "merchantId": "..."  // Your tracking_id (store.id)
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
        
        # Extract data from callback
        merchant_id = request.data.get('merchantIdInPayPal')
        permissions_granted = request.data.get('permissionsGranted')
        consent_status = request.data.get('consentStatus')
        
        if not merchant_id:
            return Response(
                {'error': 'Datos de PayPal incompletos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not permissions_granted or not consent_status:
            return Response(
                {'error': 'Debes otorgar los permisos necesarios en PayPal'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get merchant info from PayPal
        merchant_info = paypal_partner_service.get_merchant_credentials(
            merchant_id,
            None  # auth_code not used in Partner Referrals
        )
        
        if not merchant_info:
            return Response(
                {'error': 'No se pudo verificar la cuenta de PayPal'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Get platform access token
        token_info = paypal_partner_service.get_merchant_access_token(merchant_id)
        
        if not token_info:
            return Response(
                {'error': 'No se pudo obtener el token de acceso'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Update or create connection
        from django.db import transaction
        
        try:
            with transaction.atomic():
                connection, created = PayPalConnection.objects.update_or_create(
                    store=store,
                    defaults={
                        'merchant_id': merchant_id,
                        'merchant_email': merchant_info.get('primary_email', ''),
                        'merchant_email_verified': merchant_info.get('primary_email_confirmed', False),
                        'access_token_encrypted': '',  # Will be set below
                        'refresh_token_encrypted': '',
                        'token_type': 'Bearer',
                        'expires_at': timezone.now() + timezone.timedelta(hours=8),
                        'status': 'connected',
                        'connected_at': timezone.now(),
                    }
                )
                
                # Encrypt and store tokens
                connection.set_access_token(token_info['access_token'])
                connection.set_refresh_token('')  # No refresh token for Partner Referrals
                connection.save()
                
        except Exception as db_error:
            logger.error(f"Database error creating PayPal connection: {db_error}")
            return Response(
                {'error': 'Error de base de datos. Intenta de nuevo en unos segundos.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Update store's paypal fields
        try:
            with transaction.atomic():
                store.paypal_merchant_id = merchant_id
                store.paypal_email = merchant_info.get('primary_email', '')
                store.save(update_fields=['paypal_merchant_id', 'paypal_email'])
        except Exception as store_error:
            logger.error(f"Error updating store PayPal fields: {store_error}")
            # No retornar error aquí, la conexión ya se creó exitosamente
        
        PaymentIntegrationLog.log_event(
            store=store,
            provider='paypal',
            event_type='connection_completed',
            message='PayPal connection completed successfully',
            metadata={
                'merchant_id': merchant_id,
                'email': merchant_info.get('primary_email'),
                'payments_receivable': merchant_info.get('payments_receivable')
            },
            request=request
        )
        
        return Response({
            'success': True,
            'connection': PayPalConnectionSerializer(connection).data
        })
        
    except Exception as e:
        logger.error(f"Error completing PayPal connection: {e}", exc_info=True)
        return Response(
            {'error': 'Error al completar la conexión'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_paypal_connection_status(request, store_slug):
    """
    Get PayPal connection status for a store.
    
    GET /api/stores/{store_slug}/payment-integrations/paypal/status
    """
    try:
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        connection = PayPalConnection.objects.filter(store=store).first()
        
        if not connection:
            return Response({
                'connected': False,
                'status': None
            })
        
        # Check if token needs refresh
        if connection.is_connected() and connection.needs_refresh():
            success = paypal_partner_service.refresh_access_token(connection)
            if not success:
                connection.mark_expired()
        
        return Response({
            'connected': connection.is_connected(),
            'status': connection.status,
            'connection': PayPalConnectionSerializer(connection).data if connection.is_connected() else None
        })
        
    except Exception as e:
        logger.error(f"Error getting PayPal status: {e}", exc_info=True)
        return Response(
            {'error': 'Error al obtener el estado'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_paypal(request, store_slug):
    """
    Disconnect PayPal from store.
    
    POST /api/stores/{store_slug}/payment-integrations/paypal/disconnect
    """
    try:
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        connection = PayPalConnection.objects.filter(store=store).first()
        if not connection:
            return Response(
                {'error': 'No hay conexión de PayPal para desconectar'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Disconnect
        paypal_partner_service.disconnect_merchant(connection)
        
        # Clear store's paypal fields
        store.paypal_merchant_id = None
        store.paypal_email = None
        store.save(update_fields=['paypal_merchant_id', 'paypal_email'])
        
        return Response({
            'success': True,
            'message': 'PayPal desconectado exitosamente'
        })
        
    except Exception as e:
        logger.error(f"Error disconnecting PayPal: {e}", exc_info=True)
        return Response(
            {'error': 'Error al desconectar PayPal'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_payment_methods(request, store_slug):
    """
    List all payment methods and their connection status.
    
    GET /api/stores/{store_slug}/payment-integrations/methods
    """
    try:
        store = Store.objects.filter(slug=store_slug, owner=request.user).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # PayPal
        paypal_connection = PayPalConnection.objects.filter(store=store).first()
        paypal_status = {
            'provider': 'paypal',
            'name': 'PayPal',
            'connected': paypal_connection.is_connected() if paypal_connection else False,
            'status': paypal_connection.status if paypal_connection else None,
            'email': paypal_connection.merchant_email if paypal_connection and paypal_connection.is_connected() else None,
            'connected_at': paypal_connection.connected_at if paypal_connection else None
        }
        
        # Stripe (future)
        stripe_status = {
            'provider': 'stripe',
            'name': 'Stripe',
            'connected': False,
            'status': 'coming_soon',
            'available': False
        }
        
        # MercadoPago (future)
        mercadopago_status = {
            'provider': 'mercadopago',
            'name': 'MercadoPago',
            'connected': False,
            'status': 'coming_soon',
            'available': False
        }
        
        return Response({
            'methods': [
                paypal_status,
                stripe_status,
                mercadopago_status
            ]
        })
        
    except Exception as e:
        logger.error(f"Error listing payment methods: {e}", exc_info=True)
        return Response(
            {'error': 'Error al obtener métodos de pago'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def paypal_webhook(request):
    """
    PayPal webhook endpoint for payment confirmations.
    
    POST /api/webhooks/paypal/
    
    This provides secondary confirmation for payments.
    Primary confirmation happens in the redirect flow.
    """
    from django.views.decorators.csrf import csrf_exempt
    from django.utils.decorators import method_decorator
    from .tasks import process_paypal_webhook
    import json
    
    try:
        # Get webhook data
        webhook_data = request.data if hasattr(request, 'data') else json.loads(request.body)
        headers = dict(request.META)
        
        # Process webhook asynchronously
        process_paypal_webhook.delay(webhook_data, headers)
        
        # Always return 200 to PayPal
        return Response({'status': 'received'}, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Still return 200 to avoid PayPal retries
        return Response({'status': 'error'}, status=status.HTTP_200_OK)
