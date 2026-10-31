import os
import json
import hmac
import hashlib
import secrets
from datetime import timedelta
from django.conf import settings
from django.http import FileResponse, JsonResponse, HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import (
    PlugsEssentialsSubscription,
    PlugsEssentialsDownload,
    PayPalWebhookEvent,
    FreeDownloadToken
)


def get_client_ip(request):
    """Obtiene la IP del cliente"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_subscription(request):
    """
    Crear suscripción después de que PayPal apruebe el pago
    """
    try:
        subscription_id = request.data.get('subscription_id')
        plan_id = request.data.get('plan_id')
        tier = request.data.get('tier')
        
        if not all([subscription_id, plan_id, tier]):
            return Response(
                {'error': 'Faltan datos requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar si ya existe una suscripción
        existing = PlugsEssentialsSubscription.objects.filter(user=request.user).first()
        if existing:
            # Actualizar suscripción existente
            existing.tier = tier
            existing.paypal_subscription_id = subscription_id
            existing.paypal_plan_id = plan_id
            existing.status = 'active'
            existing.next_billing_date = timezone.now() + timezone.timedelta(days=30)
            existing.save()
            subscription = existing
        else:
            # Crear nueva suscripción
            subscription = PlugsEssentialsSubscription.objects.create(
                user=request.user,
                tier=tier,
                paypal_subscription_id=subscription_id,
                paypal_plan_id=plan_id,
                status='active',
                next_billing_date=timezone.now() + timezone.timedelta(days=30),
                downloads_reset_date=timezone.now() + timezone.timedelta(days=30)
            )
        
        return Response({
            'success': True,
            'subscription': {
                'id': subscription.id,
                'tier': subscription.tier,
                'status': subscription.status,
                'max_servers': subscription.max_servers,
                'price': subscription.price,
                'downloads_remaining': subscription.downloads_remaining,
                'next_billing_date': subscription.next_billing_date
            }
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subscription(request):
    """
    Obtener la suscripción del usuario actual
    """
    try:
        subscription = PlugsEssentialsSubscription.objects.filter(user=request.user).first()
        
        if not subscription:
            return Response({
                'has_subscription': False
            })
        
        # Resetear descargas si es necesario
        subscription.reset_downloads_if_needed()
        
        # Obtener servidores autorizados
        authorized_servers = [
            {
                'id': server.id,
                'name': server.name,
                'code': server.server_code,
                'last_seen': server.last_seen
            }
            for server in subscription.authorized_servers.all()
        ]
        
        return Response({
            'has_subscription': True,
            'subscription': {
                'id': subscription.id,
                'tier': subscription.tier,
                'tier_name': subscription.get_tier_display(),
                'status': subscription.status,
                'max_servers': subscription.max_servers,
                'price': subscription.price,
                'downloads_this_month': subscription.downloads_this_month,
                'downloads_remaining': subscription.downloads_remaining,
                'downloads_limit': 3,
                'next_billing_date': subscription.next_billing_date,
                'downloads_reset_date': subscription.downloads_reset_date,
                'authorized_servers': authorized_servers
            }
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def download_pack(request):
    """
    Descargar BP o RP (versión premium).
    Body: { pack_type: 'bp'|'rp', delivery: true|false }
    delivery=true  → versión con entregas automáticas lightcode (solo BDS/Aternos)
    delivery=false → versión estándar (todos los entornos)
    """
    try:
        pack_type = request.data.get('pack_type')  # 'bp' o 'rp'
        delivery  = bool(request.data.get('delivery', False))

        if pack_type not in ['bp', 'rp']:
            return Response(
                {'error': 'Tipo de pack inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Obtener suscripción
        subscription = PlugsEssentialsSubscription.objects.filter(user=request.user).first()

        if not subscription:
            return Response(
                {'error': 'No tienes una suscripción activa'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verificar si puede descargar
        if not subscription.can_download():
            return Response(
                {
                    'error': 'Has alcanzado el límite de descargas este mes',
                    'downloads_remaining': subscription.downloads_remaining
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Registrar descarga
        if not subscription.register_download():
            return Response(
                {'error': 'No se pudo registrar la descarga'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Crear registro de descarga
        PlugsEssentialsDownload.objects.create(
            subscription=subscription,
            pack_type=pack_type,
            delivery=delivery,
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        # Determinar nombre del archivo
        if pack_type == 'bp':
            if delivery:
                file_name = 'PlugsEssentials 0.1.1 -1 Premium BP Delivery.mcaddon'
            else:
                file_name = 'PlugsEssentials 0.1.1 -1 Premium BP.mcaddon'
        else:
            # RP es el mismo para todas las variantes
            file_name = 'PlugsE RP.mcaddon'

        file_path = os.path.join(settings.MEDIA_ROOT, 'plugsessentials', pack_type, file_name)

        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            return Response(
                {'error': 'Archivo no encontrado. Contacta soporte.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Servir archivo
        response = FileResponse(
            open(file_path, 'rb'),
            content_type='application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'

        return response

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription(request):
    """
    Cancelar suscripción
    """
    try:
        subscription = PlugsEssentialsSubscription.objects.filter(user=request.user).first()
        
        if not subscription:
            return Response(
                {'error': 'No tienes una suscripción activa'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Marcar como cancelada
        subscription.status = 'cancelled'
        subscription.cancelled_at = timezone.now()
        subscription.save()
        
        # TODO: Llamar a PayPal API para cancelar la suscripción
        
        return Response({
            'success': True,
            'message': 'Suscripción cancelada exitosamente'
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@require_http_methods(["POST"])
def paypal_webhook(request):
    """
    Webhook de PayPal para recibir eventos de suscripciones
    """
    try:
        # Obtener el payload
        payload = json.loads(request.body.decode('utf-8'))
        event_type = payload.get('event_type')
        event_id = payload.get('id')
        
        # Verificar si ya procesamos este evento
        if PayPalWebhookEvent.objects.filter(event_id=event_id).exists():
            return JsonResponse({'status': 'already_processed'})
        
        # Guardar evento
        webhook_event = PayPalWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            resource_type=payload.get('resource_type'),
            resource_id=payload.get('resource', {}).get('id'),
            payload=payload
        )
        
        # Procesar según el tipo de evento
        resource = payload.get('resource', {})
        subscription_id = resource.get('id')
        
        if not subscription_id:
            return JsonResponse({'status': 'no_subscription_id'})
        
        # Buscar la suscripción
        subscription = PlugsEssentialsSubscription.objects.filter(
            paypal_subscription_id=subscription_id
        ).first()
        
        if event_type == 'BILLING.SUBSCRIPTION.ACTIVATED':
            if subscription:
                subscription.status = 'active'
                subscription.save()
        
        elif event_type == 'BILLING.SUBSCRIPTION.CANCELLED':
            if subscription:
                subscription.status = 'cancelled'
                subscription.cancelled_at = timezone.now()
                subscription.save()
        
        elif event_type == 'BILLING.SUBSCRIPTION.SUSPENDED':
            if subscription:
                subscription.status = 'suspended'
                subscription.save()
        
        elif event_type == 'BILLING.SUBSCRIPTION.EXPIRED':
            if subscription:
                subscription.status = 'expired'
                subscription.save()
        
        elif event_type == 'PAYMENT.SALE.COMPLETED':
            # Pago completado - resetear descargas si es un nuevo ciclo
            if subscription:
                subscription.reset_downloads_if_needed()
        
        # Marcar como procesado
        webhook_event.processed = True
        webhook_event.processed_at = timezone.now()
        webhook_event.save()
        
        return JsonResponse({'status': 'success'})
        
    except Exception as e:
        return JsonResponse(
            {'status': 'error', 'message': str(e)},
            status=500
        )


@csrf_exempt
@require_http_methods(["GET"])
def redirect_to_download_with_token(request):
    """
    URL estática que genera un token y redirige automáticamente a la página de descarga
    Esta es la URL que debes poner en Linkvertise
    
    IMPORTANTE: No usa @api_view para poder hacer redirects HTTP correctamente
    """
    try:
        print("[LINKVERTISE] Redirect endpoint called")
        print(f"[LINKVERTISE] IP: {get_client_ip(request)}")
        print(f"[LINKVERTISE] User-Agent: {request.META.get('HTTP_USER_AGENT', '')}")
        
        # Generar token único
        token = secrets.token_urlsafe(32)
        print(f"[LINKVERTISE] Generated token: {token[:16]}...")
        
        # Crear token en la base de datos
        download_token = FreeDownloadToken.objects.create(
            token=token,
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            expires_at=timezone.now() + timedelta(hours=1)  # Expira en 1 hora
        )
        print(f"[LINKVERTISE] Token saved to DB with ID: {download_token.id}")
        
        # URL de retorno con el token
        frontend_url = settings.FRONTEND_URL or 'http://localhost:5173'
        redirect_url = f"{frontend_url}/plugsessentials/download-success?token={token}"
        print(f"[LINKVERTISE] Redirecting to: {redirect_url}")
        
        # Redirigir automáticamente usando HttpResponseRedirect
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect(redirect_url)
        
    except Exception as e:
        print(f"[LINKVERTISE] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse(
            {'error': str(e), 'message': 'Error al generar token de descarga'},
            status=500
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def generate_free_download_token(request):
    """
    Genera un token de un solo uso para descarga gratuita
    Este endpoint se llama ANTES de redirigir a Linkvertise
    """
    try:
        # Generar token único
        token = secrets.token_urlsafe(32)
        
        # Crear token en la base de datos
        download_token = FreeDownloadToken.objects.create(
            token=token,
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            expires_at=timezone.now() + timedelta(hours=1)  # Expira en 1 hora
        )
        
        # URL de retorno con el token
        frontend_url = settings.FRONTEND_URL or 'http://localhost:5174'
        return_url = f"{frontend_url}/plugsessentials/download-success?token={token}"
        
        return Response({
            'token': token,
            'return_url': return_url,
            'expires_in': 3600  # segundos
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@require_http_methods(["GET"])
def download_free_pack(request):
    """
    Descarga el pack gratuito.
    Query params: type=bp|rp, delivery=1|0
    delivery=1 → versión con entregas automáticas lightcode (solo BDS/Aternos)
    delivery=0 → versión estándar (todos los entornos)
    """
    try:
        pack_type = request.GET.get('type')   # 'bp' o 'rp'
        delivery  = request.GET.get('delivery', '0') == '1'

        print(f"[DEBUG] Download request - Type: {pack_type}, Delivery: {delivery}")

        if not pack_type:
            return HttpResponse('Tipo de pack requerido', status=400)

        if pack_type not in ['bp', 'rp']:
            return HttpResponse('Tipo de pack inválido', status=400)

        # Determinar nombre del archivo
        if pack_type == 'bp':
            if delivery:
                file_name = 'PlugsEssentials 0.1.1 -1 Free BP Delivery.mcaddon'
            else:
                file_name = 'PlugsEssentials 0.1.1 -1 Free BP.mcaddon'
        else:
            file_name = 'PlugsE RP.mcaddon'

        file_path = os.path.join(settings.MEDIA_ROOT, 'plugsessentials', pack_type, file_name)
        print(f"[DEBUG] File path: {file_path}")
        print(f"[DEBUG] File exists: {os.path.exists(file_path)}")

        if not os.path.exists(file_path):
            print(f"[DEBUG] File not found at path: {file_path}")
            return HttpResponse('Archivo no encontrado. Contacta soporte.', status=404)

        print(f"[DEBUG] Serving file: {file_name}")

        response = FileResponse(
            open(file_path, 'rb'),
            content_type='application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'

        return response

    except Exception as e:
        print(f"[DEBUG] Exception in download_free_pack: {str(e)}")
        import traceback
        traceback.print_exc()
        return HttpResponse(f'Error: {str(e)}', status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def validate_download_token(request):
    """
    Valida si un token es válido (sin marcarlo como usado)
    """
    try:
        token = request.data.get('token')
        
        print(f"[DEBUG] Validating token: {token}")
        
        if not token:
            print("[DEBUG] No token provided")
            return Response(
                {'error': 'Token requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            download_token = FreeDownloadToken.objects.get(token=token)
            print(f"[DEBUG] Token found in DB: {download_token}")
            print(f"[DEBUG] Token used: {download_token.used}")
            print(f"[DEBUG] Token expires_at: {download_token.expires_at}")
            print(f"[DEBUG] Current time: {timezone.now()}")
        except FreeDownloadToken.DoesNotExist:
            print(f"[DEBUG] Token not found in database")
            return Response({
                'valid': False,
                'reason': 'Token no encontrado'
            })
        
        is_valid = download_token.is_valid()
        print(f"[DEBUG] Token is_valid: {is_valid}")
        
        return Response({
            'valid': is_valid,
            'used': download_token.used,
            'expired': timezone.now() >= download_token.expires_at,
            'expires_at': download_token.expires_at
        })
        
    except Exception as e:
        print(f"[DEBUG] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
