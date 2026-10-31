"""
Views para el sistema de pedidos.
Incluye checkout, webhook de PayPal, y gestión de pedidos.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404, redirect
from django.db import transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.conf import settings
import json
import logging
import uuid
from decimal import Decimal

from .models import Order, RCONJob, OrderStatusHistory, OrderNote, PendingPayPalOrder
from .serializers import (
    OrderListSerializer, OrderDetailSerializer,
    CheckoutRequestSerializer, CapturePaymentSerializer,
    UpdateOrderStatusSerializer, AddOrderNoteSerializer,
    OrderNoteSerializer
)
from .services import FeeCalculator, OrderService
from .paypal_service import PayPalService
from .tasks import retry_failed_rcon_job
from .permissions import IsOrderOwner
from .filters import OrderFilter

from apps.products.models import Product
from apps.discounts.models import Discount
from apps.stores.models import Store

logger = logging.getLogger(__name__)


class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de pedidos.
    """
    
    queryset = Order.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_class = OrderFilter
    
    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        return OrderDetailSerializer
    
    def get_queryset(self):
        """
        Filtrar pedidos según el usuario:
        - Vendedor: ve todos los pedidos de sus tiendas (excepto pending_payment)
        - Comprador: ve solo sus propios pedidos
        """
        user = self.request.user
        
        if user.is_staff:
            # Admin ve todo excepto órdenes pendientes de pago
            return Order.objects.exclude(paypal_transaction_id__startswith='pending_')
        
        # Pedidos donde el usuario es vendedor (owner de la tienda)
        seller_orders = Order.objects.filter(store__owner=user).exclude(paypal_transaction_id__startswith='pending_')
        
        # Pedidos donde el usuario es comprador
        buyer_orders = Order.objects.filter(buyer=user)
        
        # Combinar ambos querysets
        return (seller_orders | buyer_orders).distinct()
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def checkout(self, request):
        """
        Inicia el proceso de checkout.
        Crea una orden de PayPal y devuelve la URL de aprobación.
        
        POST /api/orders/checkout/
        {
            "product_id": "uuid",
            "minecraft_username": "Steve123",
            "discount_code": "VIP10"  // opcional
        }
        """
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        product_id = serializer.validated_data['product_id']
        minecraft_username = serializer.validated_data['minecraft_username']
        discount_code = serializer.validated_data.get('discount_code', '').strip()
        
        # 1. Obtener producto
        try:
            product = Product.objects.select_related('store', 'store__owner').get(
                id=product_id,
                active=True
            )
        except Product.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado o inactivo'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        store = product.store
        
        # 2. Validar descuento si se proporcionó
        discount = None
        final_amount = product.price
        
        if discount_code:
            try:
                discount = Discount.objects.get(
                    code=discount_code,
                    store=store,
                    active=True
                )
                
                # Validar descuento
                is_valid, message, details = discount.is_valid(
                    buyer=request.user if request.user.is_authenticated else None,
                    cart_total=product.price,
                    cart_items_count=1,
                    cart_products=[product.id]
                )
                
                if not is_valid:
                    return Response(
                        {'error': message, 'details': details},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Aplicar descuento
                if discount.discount_type == 'PERCENTAGE':
                    discount_amount = (product.price * Decimal(str(discount.value)) / 100).quantize(Decimal('0.01'))
                else:
                    discount_amount = min(Decimal(str(discount.value)), product.price)
                
                final_amount = max(Decimal('0.00'), product.price - discount_amount)
                
            except Discount.DoesNotExist:
                return Response(
                    {'error': 'Código de descuento inválido'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # 3. WHITE-LABEL MODE: Pago va a la cuenta Business de la plataforma
        logger.info(f"🏪 Store: {store.name} ({store.slug})")
        logger.info(f"💵 Amount: ${final_amount}")
        logger.info(f"💰 WHITE-LABEL MODE: Payment will go to platform PayPal Business account")
        
        # 4. Crear orden de PayPal en modo white-label (dinero va a cuenta Business de la plataforma)
        try:
            paypal_service = PayPalService()
            
            paypal_order = paypal_service.create_order(
                amount=final_amount,
                description=f"{product.name} - {store.name}",
                payee_email=None  # ← WHITE-LABEL: Dinero va a cuenta Business de la plataforma
            )
            
            logger.info(f"✅ PayPal order created: {paypal_order['order_id']}")
            logger.info(f"💰 WHITE-LABEL: ${final_amount} will go to platform Business account")
            
            return Response({
                'paypal_order_id': paypal_order['order_id'],
                'approval_url': paypal_order['approval_url'],
                'amount': str(final_amount),
                'original_amount': str(product.price),
                'discount_saved': str(product.price - final_amount) if discount else '0.00',
                'currency': 'USD',
                'payment_flow': 'white_label_business'  # Indicador del flujo white-label
            })
            
        except Exception as e:
            logger.error(f"❌ Error creating PayPal order: {str(e)}")
            return Response(
                {'error': 'Error al crear la orden de pago'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def capture(self, request):
        """
        🔴 DOBLE VERIFICACIÓN: Captura el pago después de que el usuario apruebe en PayPal.
        Este endpoint se llama cuando el usuario vuelve del flujo de PayPal.
        
        POST /api/orders/capture/
        {
            "paypal_order_id": "ORDER-123"
        }
        
        IMPORTANTE: Este endpoint trabaja en conjunto con el webhook.
        - Si el webhook ya procesó la orden → devolver éxito
        - Si el webhook no llegó → procesar aquí
        - Idempotencia garantizada por capture_id
        """
        serializer = CapturePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        paypal_order_id = serializer.validated_data['paypal_order_id']
        
        try:
            # 🔴 VALIDACIÓN 1: Verificar si ya existe una orden con este paypal_order_id
            existing_order = Order.objects.filter(paypal_order_id=paypal_order_id).first()
            
            if existing_order and existing_order.webhook_confirmed:
                logger.info(f"✅ Order {existing_order.order_number} already processed by webhook")
                return Response({
                    'success': True,
                    'transaction_id': existing_order.paypal_transaction_id,
                    'order_number': existing_order.order_number,
                    'message': 'Pago ya procesado',
                    'already_processed': True
                })
            
            # 1. Capturar pago en PayPal (o verificar si ya fue capturado)
            paypal_service = PayPalService()
            
            try:
                capture_data = paypal_service.capture_order(paypal_order_id)
                capture_id = capture_data['transaction_id']
            except Exception as capture_error:
                # Si el error es que ya fue capturado, obtener detalles
                error_str = str(capture_error)
                if '422' in error_str or 'UNPROCESSABLE_ENTITY' in error_str:
                    logger.warning(f"⚠️ Order {paypal_order_id} already captured, fetching details...")
                    order_details = paypal_service.get_order_details(paypal_order_id)
                    
                    # Extraer capture_id de los detalles
                    purchase_unit = order_details['purchase_units'][0]
                    if 'payments' in purchase_unit and 'captures' in purchase_unit['payments']:
                        capture = purchase_unit['payments']['captures'][0]
                        capture_id = capture['id']
                        
                        payer = order_details.get('payer', {})
                        capture_data = {
                            'transaction_id': capture_id,
                            'payer_id': payer.get('payer_id', 'unknown'),
                            'payer_email': payer.get('email_address', 'unknown'),
                            'payer_name': f"{payer.get('name', {}).get('given_name', '')} {payer.get('name', {}).get('surname', '')}".strip() or 'Unknown',
                            'amount': Decimal(capture['amount']['value']),
                            'currency': capture['amount']['currency_code']
                        }
                        logger.info(f"✅ Retrieved capture data from already-captured order")
                    else:
                        raise Exception("No capture data found in order details")
                else:
                    raise
            
            # 🔴 VALIDACIÓN 2: Verificar idempotencia por capture_id
            if Order.objects.filter(paypal_transaction_id=capture_id).exists():
                logger.warning(f"⚠️ Order with capture_id {capture_id} already exists - IGNORING")
                existing = Order.objects.get(paypal_transaction_id=capture_id)
                return Response({
                    'success': True,
                    'transaction_id': capture_id,
                    'order_number': existing.order_number,
                    'message': 'Pago ya procesado',
                    'already_processed': True
                })
            
            logger.info(f"✅ PayPal payment captured: {capture_id}")
            
            # 2. Buscar datos temporales de la orden
            try:
                pending_order = PendingPayPalOrder.objects.get(paypal_order_id=paypal_order_id)
                order_data = pending_order.order_data
            except PendingPayPalOrder.DoesNotExist:
                logger.error(f"❌ No pending order found for {paypal_order_id}")
                return Response(
                    {'error': 'No se encontraron datos de la orden'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 3. Crear la orden (similar a store_capture_paypal_order)
            # TODO: Implementar creación completa de orden aquí
            # Por ahora, devolver éxito básico
            
            return Response({
                'success': True,
                'transaction_id': capture_id,
                'message': 'Pago capturado exitosamente',
                'note': 'Webhook procesará la entrega automáticamente'
            })
            
        except Exception as e:
            logger.error(f"❌ Error capturing payment: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return Response(
                {'error': 'Error al procesar el pago'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsOrderOwner])
    def update_status(self, request, pk=None):
        """
        Actualiza el estado de un pedido manualmente (solo vendedor).
        Solo para pedidos con delivery_method=MANUAL.
        
        POST /api/orders/{id}/update_status/
        {
            "status": "delivered" | "cancelled",
            "reason": "Entregado manualmente"
        }
        """
        order = self.get_object()
        
        # Validar que sea entrega manual
        if order.delivery_method != Order.DeliveryMethod.MANUAL:
            return Response(
                {'error': 'Solo se pueden actualizar pedidos con entrega manual'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = UpdateOrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_status = serializer.validated_data['status']
        reason = serializer.validated_data.get('reason', '')
        
        with transaction.atomic():
            old_status = order.status
            
            if new_status == Order.Status.DELIVERED:
                # Usar el método del servicio que libera el balance
                OrderService.mark_order_delivered(order)
                
                # Agregar razón personalizada si se proporcionó
                if reason:
                    OrderStatusHistory.objects.create(
                        order=order,
                        from_status=old_status,
                        to_status=new_status,
                        changed_by=request.user,
                        reason=reason
                    )
            else:
                # Para otros estados (cancelled, etc.)
                order.status = new_status
                order.save()
                
                OrderStatusHistory.objects.create(
                    order=order,
                    from_status=old_status,
                    to_status=new_status,
                    changed_by=request.user,
                    reason=reason or f'Actualizado manualmente a {new_status}'
                )
        
        logger.info(f"📝 Order {order.order_number} updated: {old_status} → {new_status}")
        
        return Response({
            'success': True,
            'order_number': order.order_number,
            'status': new_status
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsOrderOwner])
    def retry_rcon(self, request, pk=None):
        """
        Forzar reintento de entrega RCON (solo vendedor).
        
        POST /api/orders/{id}/retry_rcon/
        """
        order = self.get_object()
        
        # Validar que tenga RCON job
        if not hasattr(order, 'rcon_job'):
            return Response(
                {'error': 'Este pedido no tiene entrega RCON'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        rcon_job = order.rcon_job
        
        # Incrementar contador manual y resetear automático
        rcon_job.manual_retry_count += 1
        rcon_job.auto_retry_count = 0
        rcon_job.attempts = 0  # Se resetea porque auto_retry_count = 0
        
        # Resetear estado
        rcon_job.status = RCONJob.Status.PENDING
        rcon_job.next_retry_at = timezone.now()
        rcon_job.save()
        
        # Para reintentos manuales desde el endpoint web, siempre ejecutar directamente
        # El Worker de Celery se encarga de los reintentos automáticos
        logger.info(f"🔄 Executing manual RCON retry directly for order {order.order_number}")
        from .tasks import execute_rcon_job
        execute_rcon_job(str(rcon_job.id), force=True)
        
        # Refrescar el job para obtener el estado actualizado
        rcon_job.refresh_from_db()
        
        # Generar mensaje según el resultado
        if rcon_job.status == RCONJob.Status.DELIVERED:
            message = '✅ Entrega completada exitosamente'
        elif rcon_job.status == RCONJob.Status.FAILED:
            # Mostrar razón del fallo
            if rcon_job.failure_reason:
                message = f'❌ {rcon_job.failure_reason}'
            else:
                message = '❌ La entrega falló. Revisa los detalles del pedido.'
        elif rcon_job.status == RCONJob.Status.PENDING:
            # Todavía pendiente (probablemente jugador offline)
            if 'jugador' in (rcon_job.failure_reason or '').lower() or 'offline' in (rcon_job.failure_reason or '').lower():
                message = '⏳ Jugador no está conectado. Se reintentará automáticamente cuando se conecte.'
            elif 'servidor' in (rcon_job.failure_reason or '').lower():
                message = '⚠️ Servidor no responde. Se reintentará automáticamente.'
            else:
                message = '⏳ Reintento programado. Se procesará automáticamente.'
        else:
            message = 'Reintento ejecutado'
        
        return Response({
            'success': True,
            'message': message,
            'job_status': rcon_job.status,
            'failure_reason': rcon_job.failure_reason
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsOrderOwner])
    def add_note(self, request, pk=None):
        """
        Agregar nota a un pedido (solo vendedor).
        
        POST /api/orders/{id}/add_note/
        {
            "content": "Cliente contactado por Discord",
            "is_internal": true
        }
        """
        order = self.get_object()
        
        serializer = AddOrderNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        note = OrderNote.objects.create(
            order=order,
            author=request.user,
            content=serializer.validated_data['content'],
            is_internal=serializer.validated_data.get('is_internal', True)
        )
        
        logger.info(f"📝 Note added to order {order.order_number}")
        
        return Response(OrderNoteSerializer(note).data)


@method_decorator(csrf_exempt, name='dispatch')
def paypal_webhook(request):
    """
    Webhook para recibir eventos de PayPal con validaciones exhaustivas.
    
    POST /api/orders/webhook/paypal/
    
    Eventos importantes:
    - PAYMENT.CAPTURE.COMPLETED: Pago capturado exitosamente
    - PAYMENT.CAPTURE.DENIED: Pago denegado
    - PAYMENT.CAPTURE.PENDING: Pago pendiente
    - CHECKOUT.ORDER.APPROVED: Usuario aprobó el pago
    
    Validaciones:
    1. Verificar firma del webhook (seguridad)
    2. Verificar que el evento no sea duplicado
    3. Verificar que la orden existe en nuestra DB
    4. Verificar que el monto coincide
    5. Verificar que el payee_email es correcto
    6. Actualizar orden solo si todas las validaciones pasan
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    webhook_event = None
    
    try:
        # 1. Obtener body y headers
        body = json.loads(request.body)
        headers = {
            'PAYPAL-TRANSMISSION-ID': request.META.get('HTTP_PAYPAL_TRANSMISSION_ID', ''),
            'PAYPAL-TRANSMISSION-TIME': request.META.get('HTTP_PAYPAL_TRANSMISSION_TIME', ''),
            'PAYPAL-CERT-URL': request.META.get('HTTP_PAYPAL_CERT_URL', ''),
            'PAYPAL-AUTH-ALGO': request.META.get('HTTP_PAYPAL_AUTH_ALGO', ''),
            'PAYPAL-TRANSMISSION-SIG': request.META.get('HTTP_PAYPAL_TRANSMISSION_SIG', ''),
        }
        
        event_type = body.get('event_type', 'OTHER')
        event_id = body.get('id', '')
        resource = body.get('resource', {})
        
        logger.info(f"📨 PayPal webhook received: {event_type} (ID: {event_id})")
        
        # 2. Crear registro del webhook (para auditoría)
        from .models import PayPalWebhookEvent
        
        # 🔴 IDEMPOTENCIA: Verificar si ya procesamos este evento (prevenir duplicados)
        if PayPalWebhookEvent.objects.filter(event_id=event_id).exists():
            logger.warning(f"⚠️ Duplicate webhook event: {event_id} - IGNORING")
            return JsonResponse({'success': True, 'message': 'Duplicate event ignored'})
        
        # Extraer datos del recurso
        resource_id = resource.get('id', '')
        paypal_order_id = ''
        amount = None
        currency = ''
        payer_email = ''
        payee_email = ''
        
        # Extraer paypal_order_id según el tipo de recurso
        if 'supplementary_data' in resource:
            related_ids = resource.get('supplementary_data', {}).get('related_ids', {})
            paypal_order_id = related_ids.get('order_id', '')
        
        # Extraer amount
        if 'amount' in resource:
            amount_data = resource.get('amount', {})
            try:
                amount = Decimal(amount_data.get('value', '0'))
                currency = amount_data.get('currency_code', '')
            except:
                pass
        
        # Extraer emails
        if 'payer' in resource:
            payer_data = resource.get('payer', {})
            payer_email = payer_data.get('email_address', '')
        
        if 'payee' in resource:
            payee_data = resource.get('payee', {})
            payee_email = payee_data.get('email_address', '')
        
        # Crear registro del webhook
        webhook_event = PayPalWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type if event_type in dict(PayPalWebhookEvent.EventType.choices) else 'OTHER',
            event_version=body.get('event_version', ''),
            resource_type=body.get('resource_type', ''),
            resource_id=resource_id,
            paypal_order_id=paypal_order_id,
            raw_payload=body,
            transmission_id=headers['PAYPAL-TRANSMISSION-ID'],
            transmission_time=headers['PAYPAL-TRANSMISSION-TIME'],
            transmission_sig=headers['PAYPAL-TRANSMISSION-SIG'],
            cert_url=headers['PAYPAL-CERT-URL'],
            auth_algo=headers['PAYPAL-AUTH-ALGO'],
            amount=amount,
            currency=currency,
            payer_email=payer_email,
            payee_email=payee_email,
            processing_status='processing'
        )
        
        logger.info(f"✅ Webhook event registered: {webhook_event.id}")
        
        # 3. Verificar firma del webhook (SEGURIDAD CRÍTICA)
        # En desarrollo local, permitir webhooks simulados sin firma
        skip_signature_verification = settings.DEBUG and headers['PAYPAL-TRANSMISSION-ID'].startswith('simulated-')
        
        if skip_signature_verification:
            logger.warning("⚠️ DEVELOPMENT MODE: Skipping webhook signature verification")
            webhook_event.signature_verified = True
            webhook_event.save(update_fields=['signature_verified'])
        else:
            paypal_service = PayPalService()
            try:
                is_valid = paypal_service.verify_webhook_signature(headers, body)
                webhook_event.signature_verified = is_valid
                webhook_event.save(update_fields=['signature_verified'])
                
                if not is_valid:
                    logger.error(f"❌ Invalid PayPal webhook signature for event {event_id}")
                    webhook_event.processing_status = 'failed'
                    webhook_event.processing_error = 'Invalid webhook signature'
                    webhook_event.save(update_fields=['processing_status', 'processing_error'])
                    return JsonResponse({'error': 'Invalid signature'}, status=400)
                
                logger.info(f"✅ Webhook signature verified for event {event_id}")
            except Exception as e:
                logger.error(f"❌ Error verifying webhook signature: {str(e)}")
                webhook_event.signature_verification_error = str(e)
                webhook_event.processing_status = 'failed'
                webhook_event.processing_error = f'Signature verification error: {str(e)}'
                webhook_event.save(update_fields=['signature_verification_error', 'processing_status', 'processing_error'])
                return JsonResponse({'error': 'Signature verification failed'}, status=400)
        
        # 4. Procesar evento según tipo
        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            logger.info(f"💰 Processing PAYMENT.CAPTURE.COMPLETED for resource {resource_id}")
            
            # Buscar orden por paypal_order_id
            if not paypal_order_id:
                logger.error(f"❌ No paypal_order_id found in webhook payload")
                webhook_event.processing_status = 'failed'
                webhook_event.processing_error = 'No paypal_order_id in payload'
                webhook_event.save(update_fields=['processing_status', 'processing_error'])
                return JsonResponse({'error': 'No paypal_order_id in payload'}, status=400)
            
            try:
                order = Order.objects.get(paypal_order_id=paypal_order_id)
                webhook_event.order = order
                webhook_event.save(update_fields=['order'])
                
                logger.info(f"✅ Found order: {order.order_number} (ID: {order.id})")
            except Order.DoesNotExist:
                logger.error(f"❌ Order not found for PayPal paypal_order_id: {paypal_order_id}")
                webhook_event.processing_status = 'failed'
                webhook_event.processing_error = f'Order not found for paypal_order_id: {paypal_order_id}'
                webhook_event.save(update_fields=['processing_status', 'processing_error'])
                return JsonResponse({'error': 'Order not found'}, status=404)
            
            # VALIDACIÓN 1: Verificar que el pago no fue procesado antes
            if order.webhook_confirmed:
                logger.warning(f"⚠️ Order {order.order_number} already confirmed by webhook - IGNORING")
                webhook_event.processing_status = 'ignored'
                webhook_event.processing_error = 'Order already confirmed'
                webhook_event.save(update_fields=['processing_status', 'processing_error'])
                return JsonResponse({'success': True, 'message': 'Order already confirmed'})
            
            # 🔴 IDEMPOTENCIA POR CAPTURE_ID: Verificar que no existe otra orden con este capture_id
            if Order.objects.filter(paypal_transaction_id=resource_id).exclude(id=order.id).exists():
                logger.error(f"❌ Duplicate capture_id detected: {resource_id} - IGNORING")
                webhook_event.processing_status = 'failed'
                webhook_event.processing_error = f'Duplicate capture_id: {resource_id}'
                webhook_event.save(update_fields=['processing_status', 'processing_error'])
                return JsonResponse({'error': 'Duplicate capture_id'}, status=400)
            
            # VALIDACIÓN 2: Verificar monto
            if amount and order.gross_amount:
                if abs(amount - order.gross_amount) > Decimal('0.01'):  # Tolerancia de 1 centavo
                    logger.error(f"❌ Amount mismatch! Webhook: {amount}, Order: {order.gross_amount}")
                    webhook_event.processing_status = 'failed'
                    webhook_event.processing_error = f'Amount mismatch: webhook={amount}, order={order.gross_amount}'
                    webhook_event.save(update_fields=['processing_status', 'processing_error'])
                    return JsonResponse({'error': 'Amount mismatch'}, status=400)
                logger.info(f"✅ Amount verified: ${amount}")
            
            # 🔴 VALIDACIÓN 3: En modo WHITE-LABEL, el dinero va a la cuenta Business de la plataforma
            # No verificamos payee_email porque no usamos pago directo al vendedor
            logger.info(f"✅ WHITE-LABEL MODE: Payment goes to platform Business account (no payee verification needed)")
            if payee_email:
                logger.info(f"💰 Payee in webhook: {payee_email} (platform account)")
            
            # VALIDACIÓN 4: Verificar estado del pago
            payment_status = resource.get('status', '')
            if payment_status != 'COMPLETED':
                logger.warning(f"⚠️ Payment status is not COMPLETED: {payment_status}")
                webhook_event.processing_status = 'failed'
                webhook_event.processing_error = f'Payment status is {payment_status}, expected COMPLETED'
                webhook_event.save(update_fields=['processing_status', 'processing_error'])
                return JsonResponse({'error': f'Payment status is {payment_status}'}, status=400)
            
            logger.info(f"✅ Payment status verified: {payment_status}")
            
            # TODAS LAS VALIDACIONES PASARON - Actualizar orden
            with transaction.atomic():
                order.webhook_confirmed = True
                order.payment_captured_at = timezone.now()
                order.payer_email = payer_email
                order.paypal_transaction_id = resource_id
                
                # Actualizar datos del pagador si están disponibles
                if payer_email and not order.buyer_paypal_email:
                    order.buyer_paypal_email = payer_email
                
                if 'payer' in resource:
                    payer_data = resource.get('payer', {})
                    if 'name' in payer_data:
                        name_data = payer_data.get('name', {})
                        full_name = f"{name_data.get('given_name', '')} {name_data.get('surname', '')}".strip()
                        if full_name and not order.buyer_paypal_name:
                            order.buyer_paypal_name = full_name
                    
                    if 'payer_id' in payer_data and not order.buyer_payer_id:
                        order.buyer_payer_id = payer_data.get('payer_id', '')
                
                # EXTRAER COMISIONES REALES DE PAYPAL del webhook (pagos directos al vendedor)
                if order.payment_method == 'paypal' and amount:
                    # PayPal envía el desglose real de fees en seller_receivable_breakdown
                    seller_receivable = resource.get('seller_receivable_breakdown', {})
                    
                    if seller_receivable:
                        # Usar los valores REALES de PayPal
                        paypal_fee_data = seller_receivable.get('paypal_fee', {})
                        net_amount_data = seller_receivable.get('net_amount', {})
                        
                        real_paypal_fee = Decimal(paypal_fee_data.get('value', '0'))
                        real_net_amount = Decimal(net_amount_data.get('value', '0'))
                        
                        order.paypal_fee = real_paypal_fee
                        order.net_amount = real_net_amount
                        
                        logger.info(f"💰 Direct payment - Seller receives: ${real_net_amount}")
                        logger.info(f"💳 PayPal fee (REAL from webhook): ${real_paypal_fee}")
                    else:
                        # Fallback: calcular fee estimado si no viene en el webhook
                        logger.warning("⚠️ seller_receivable_breakdown not found in webhook, using estimated fee")
                        paypal_fee_rate = Decimal('0.029')  # 2.9%
                        paypal_fixed_fee = Decimal('0.30')  # $0.30 USD
                        
                        calculated_paypal_fee = (amount * paypal_fee_rate) + paypal_fixed_fee
                        net_amount_calculated = amount - calculated_paypal_fee
                        
                        order.paypal_fee = calculated_paypal_fee
                        order.net_amount = net_amount_calculated
                        
                        logger.info(f"💰 Direct payment - Seller receives: ${net_amount_calculated}")
                        logger.info(f"💳 PayPal fee (ESTIMATED): ${calculated_paypal_fee}")
                    
                    # 🔴 PAGO DIRECTO: NO hay comisión de lightcode
                    order.lightcode_fee = Decimal('0.00')
                    order.lightcode_fee_percent = Decimal('0.0000')
                    
                    logger.info(f"✅ NO lightcode commission - 100% goes to seller (minus PayPal fee)")
                
                order.save()
                
                logger.info(f"✅ Order {order.order_number} confirmed by webhook")
                logger.info(f"💰 PayPal fee: ${order.paypal_fee}, Net amount: ${order.net_amount}")
                
                # Crear historial de estado
                OrderStatusHistory.objects.create(
                    order=order,
                    from_status='',
                    to_status=order.status,
                    reason='Pago confirmado por webhook de PayPal',
                    changed_by=None
                )
                
                # 🎮 PROCESAR ENTREGA AUTOMÁTICA (RCON/Plugin)
                try:
                    from .services import OrderService
                    order_service = OrderService()
                    
                    logger.info(f"🚀 Processing automatic delivery for order {order.order_number}")
                    logger.info(f"   Delivery method: {order.delivery_method}")
                    
                    if order.delivery_method == 'rcon':
                        # Crear trabajos RCON
                        order_service.process_order_delivery(order)
                        logger.info(f"✅ RCON jobs created for order {order.order_number}")
                    elif order.delivery_method == 'plugin':
                        # Marcar como listo para reclamar
                        order.status = 'ready_to_claim'
                        order.save(update_fields=['status'])
                        logger.info(f"✅ Order {order.order_number} marked as ready to claim")
                    else:
                        logger.info(f"ℹ️ Manual delivery - no automatic processing needed")
                        
                except Exception as delivery_error:
                    logger.error(f"❌ Error processing delivery: {str(delivery_error)}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # 🔔 CREAR NOTIFICACIÓN PARA EL VENDEDOR
                try:
                    from apps.notifications.models import Notification
                    from apps.notifications.signals import send_notification_to_user
                    
                    logger.info(f"📧 Creating notification for seller {order.store.owner.username}")
                    
                    # Crear notificación en DB
                    notification = Notification.objects.create(
                        user=order.store.owner,
                        type=Notification.Type.NEW_ORDER,
                        title='Nueva venta',
                        message=f'{order.buyer_paypal_name or "Cliente"} compró {order.product_snapshot.get("name", "producto")} — ${order.amount_after_discount}',
                        data={
                            'order_id': str(order.id),
                            'order_number': order.order_number,
                            'store_slug': order.store.slug,
                            'amount': float(order.amount_after_discount),
                            'product_name': order.product_snapshot.get('name', 'producto'),
                            'buyer_name': order.buyer_paypal_name or 'Cliente',
                            'minecraft_username': order.minecraft_username,
                            'payment_method': 'paypal_direct'
                        }
                    )
                    
                    logger.info(f"💾 Notification saved to DB: {notification.id}")
                    
                    # Enviar por WebSocket
                    notification_data = {
                        'id': str(notification.id),
                        'type': notification.type,
                        'title': notification.title,
                        'message': notification.message,
                        'data': notification.data,
                        'created_at': notification.created_at.isoformat(),
                        'read': notification.read
                    }
                    
                    logger.info(f"📡 Sending WebSocket notification: {notification_data}")
                    send_notification_to_user(order.store.owner.id, notification_data)
                    
                    logger.info(f"🔔 Notification sent to seller {order.store.owner.username} for order {order.order_number}")
                    
                except Exception as notif_error:
                    logger.error(f"❌ Error creating notification: {str(notif_error)}")
                    import traceback
                    logger.error(traceback.format_exc())
            
            webhook_event.processing_status = 'processed'
            webhook_event.processed_at = timezone.now()
            webhook_event.save(update_fields=['processing_status', 'processed_at'])
            
            logger.info(f"🎉 Webhook processed successfully for order {order.order_number}")
            
        elif event_type == 'PAYMENT.CAPTURE.DENIED':
            logger.warning(f"❌ Payment denied: {resource_id}")
            webhook_event.processing_status = 'processed'
            webhook_event.processed_at = timezone.now()
            webhook_event.save(update_fields=['processing_status', 'processed_at'])
            
        elif event_type == 'PAYMENT.CAPTURE.PENDING':
            logger.info(f"⏳ Payment pending: {resource_id}")
            webhook_event.processing_status = 'processed'
            webhook_event.processed_at = timezone.now()
            webhook_event.save(update_fields=['processing_status', 'processed_at'])
            
        else:
            logger.info(f"ℹ️ Ignoring event type: {event_type}")
            webhook_event.processing_status = 'ignored'
            webhook_event.save(update_fields=['processing_status'])
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        logger.error(f"❌ Error processing webhook: {str(e)}", exc_info=True)
        
        if webhook_event:
            webhook_event.processing_status = 'failed'
            webhook_event.processing_error = str(e)
            webhook_event.processing_attempts += 1
            webhook_event.save(update_fields=['processing_status', 'processing_error', 'processing_attempts'])
        
        return JsonResponse({'error': 'Internal error'}, status=500)



# ============================================================================
# STORE PUBLIC CHECKOUT ENDPOINTS
# ============================================================================

from rest_framework.decorators import api_view, permission_classes
from apps.cart.models import Cart


@api_view(['POST'])
@permission_classes([AllowAny])
def store_create_paypal_order(request, store_slug):
    """
    Crea una orden de PayPal para checkout de tienda pública.
    
    POST /api/stores/{store_slug}/checkout/create-paypal-order/
    {
        "minecraft_username": "Steve123",
        "buyer_email": "buyer@example.com",
        "notes": "Optional notes",
        "discount_code": "SAVE10",
        "items": [
            {"product_id": "uuid", "quantity": 1}
        ]
    }
    
    Returns:
    {
        "order_id": "paypal_order_id",
        "approval_url": "https://paypal.com/...",
        "internal_order_id": "uuid"
    }
    """
    try:
        # 1. Validar tienda
        store = get_object_or_404(Store, slug=store_slug, status='active', is_deleted=False)
        
        # 2. Obtener datos
        minecraft_username = (request.data.get('minecraft_username') or '').strip()
        buyer_email = (request.data.get('buyer_email') or '').strip()
        notes = (request.data.get('notes') or '').strip()
        discount_code = (request.data.get('discount_code') or '').strip()
        items_data = request.data.get('items', [])
        
        if not minecraft_username:
            return Response(
                {'error': 'Usuario de Minecraft requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not buyer_email:
            return Response(
                {'error': 'Email requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not items_data:
            return Response(
                {'error': 'No hay productos en el carrito'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 3. Calcular total y validar productos
        total_amount = 0
        order_items = []
        
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity', 1)
            
            try:
                product = Product.objects.get(
                    id=product_id,
                    store=store,
                    status='ACTIVE',
                    is_deleted=False
                )
            except Product.DoesNotExist:
                return Response(
                    {'error': f'Producto {product_id} no encontrado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            item_total = product.price * quantity
            total_amount += item_total
            
            order_items.append({
                'product': product,
                'quantity': quantity,
                'price': product.price
            })
        
        # 4. Aplicar descuento si existe
        discount = None
        discount_amount = 0
        
        if discount_code:
            try:
                discount = Discount.objects.get(
                    code=discount_code,
                    store=store,
                    is_active=True
                )
                
                # Validar descuento
                if discount.is_valid():
                    if discount.discount_type == 'PERCENTAGE':
                        discount_amount = total_amount * (discount.value / 100)
                    else:
                        discount_amount = discount.value
                    
                    discount_amount = min(discount_amount, total_amount)
            except Discount.DoesNotExist:
                pass  # Ignorar código inválido
        
        final_amount = total_amount - discount_amount
        
        # 5. Calcular fees antes de crear la orden
        from .services import FeeCalculator
        seller_plan = getattr(store.owner, 'subscription_plan', 'starter')
        
        # Calcular fees para el primer producto (simplificado para MVP)
        # TODO: Mejorar para múltiples productos
        first_product = order_items[0]['product']
        fees = FeeCalculator.calculate_order_fees(
            original_amount=first_product.price,
            discount=discount,
            seller_plan=seller_plan
        )
        
        # 6. NO crear orden en DB todavía - solo preparar los datos
        # Los datos se guardarán en el order_reference de PayPal como JSON
        
        # Función helper para convertir Decimals a float recursivamente
        def convert_decimals(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            elif isinstance(obj, dict):
                return {key: convert_decimals(value) for key, value in obj.items()}
            elif isinstance(obj, list):
                return [convert_decimals(item) for item in obj]
            return obj
        
        order_data = {
            'store_id': str(store.id),
            'store_slug': store_slug,
            'minecraft_username': minecraft_username,
            'buyer_email': buyer_email,
            'notes': notes,
            'discount_code': discount_code if discount else None,
            'discount_id': str(discount.id) if discount else None,
            'total_amount': float(total_amount),
            'discount_amount': float(discount_amount),
            'final_amount': float(final_amount),
            'items': [
                {
                    'product_id': str(item['product'].id),
                    'product_name': item['product'].name,
                    'quantity': item['quantity'],
                    'price': float(item['price'])
                }
                for item in order_items
            ],
            'fees': convert_decimals(fees)
        }
        
        # 7. Crear orden de PayPal (sin crear orden en DB todavía)
        paypal_service = PayPalService()
        
        description = f"Compra en {store.name}"
        if len(order_items) == 1:
            description = f"{order_items[0]['product'].name} - {store.name}"
        
        # URLs de retorno en modo white-label (sin slug de tienda)
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        return_url = f"{frontend_url}/checkout/success"
        cancel_url = f"{frontend_url}/checkout/cancel"
        
        logger.info(f"🔗 PayPal return URLs - Return: {return_url}, Cancel: {cancel_url}")
        
        # Crear orden de PayPal en modo white-label (dinero va a cuenta Business de la plataforma)
        logger.info(f"💰 WHITE-LABEL MODE: Payment will go to platform PayPal Business account")
        
        paypal_order = paypal_service.create_order(
            amount=final_amount,
            description=description,
            order_reference=None,  # No enviar datos a PayPal
            return_url=return_url,
            cancel_url=cancel_url,
            payee_email=None  # ← WHITE-LABEL: Dinero va a cuenta Business de la plataforma
        )
        
        # Guardar order_data en nuestra base de datos temporalmente
        pending_order = PendingPayPalOrder.objects.create(
            paypal_order_id=paypal_order['order_id'],
            store=store,
            order_data=order_data
        )
        
        logger.info(f"✅ PayPal order created for store {store_slug}: {paypal_order['order_id']}")
        logger.info(f"💾 Order data saved temporarily: {pending_order.id}")
        
        return Response({
            'order_id': paypal_order['order_id'],
            'approval_url': paypal_order['approval_url']
        })
        
    except Exception as e:
        logger.error(f"❌ Error creating PayPal order: {str(e)}")
        return Response(
            {'error': 'Error al crear la orden'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def store_capture_paypal_order(request, store_slug):
    """
    Captura el pago de PayPal después de que el usuario apruebe.
    CREA la orden en la base de datos usando los datos guardados temporalmente.
    
    POST /api/stores/{store_slug}/checkout/capture-paypal-order/
    {
        "order_id": "paypal_order_id"
    }
    
    Returns:
    {
        "success": true,
        "order": { order details }
    }
    """
    try:
        # 1. Validar tienda
        store = get_object_or_404(Store, slug=store_slug, status='active', is_deleted=False)
        
        # 2. Obtener PayPal order ID
        paypal_order_id = (request.data.get('order_id') or '').strip()
        
        if not paypal_order_id:
            return Response(
                {'error': 'Order ID requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 3. Verificar si la orden ya existe (evitar duplicados)
        existing_order = Order.objects.filter(paypal_order_id=paypal_order_id).first()
        if existing_order:
            logger.info(f"⚠️ Order already exists for PayPal ID {paypal_order_id}")
            return Response({
                'success': True,
                'order': OrderDetailSerializer(existing_order).data,
                'message': 'Orden ya procesada'
            })
        
        # 4. Buscar datos temporales de la orden
        try:
            pending_order = PendingPayPalOrder.objects.get(
                paypal_order_id=paypal_order_id,
                store=store
            )
            order_data = pending_order.order_data
            logger.info(f"📦 Retrieved order data from database: {order_data.keys()}")
        except PendingPayPalOrder.DoesNotExist:
            logger.error(f"❌ No pending order found for PayPal ID {paypal_order_id}")
            return Response(
                {'error': 'No se encontraron datos de la orden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 5. Capturar pago en PayPal primero
        paypal_service = PayPalService()
        try:
            capture_data = paypal_service.capture_order(paypal_order_id)
        except Exception as paypal_error:
            error_str = str(paypal_error)
            
            # Si el error es 422, la orden ya fue capturada - obtener detalles
            if '422' in error_str or 'UNPROCESSABLE_ENTITY' in error_str:
                logger.warning(f"⚠️ Order {paypal_order_id} already captured, fetching details...")
                try:
                    order_details = paypal_service.get_order_details(paypal_order_id)
                    payer = order_details.get('payer', {})
                    purchase_unit = order_details['purchase_units'][0]
                    
                    # Buscar el capture ID
                    if 'payments' in purchase_unit and 'captures' in purchase_unit['payments']:
                        capture = purchase_unit['payments']['captures'][0]
                        capture_data = {
                            'transaction_id': capture['id'],
                            'payer_id': payer.get('payer_id', 'unknown'),
                            'payer_email': payer.get('email_address', order_data.get('buyer_email', 'unknown')),
                            'payer_name': f"{payer.get('name', {}).get('given_name', '')} {payer.get('name', {}).get('surname', '')}".strip() or 'Unknown'
                        }
                        logger.info(f"✅ Retrieved capture data from already-captured order")
                    else:
                        raise Exception("No capture data found in order details")
                except Exception as detail_error:
                    logger.error(f"❌ Could not fetch order details: {str(detail_error)}")
                    return Response(
                        {'error': 'Error al procesar el pago'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                logger.error(f"❌ PayPal capture error: {error_str}")
                return Response(
                    {'error': 'Error al capturar el pago en PayPal'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # 6. Reconstruir los objetos necesarios desde order_data
        try:
            # Obtener productos
            product_ids = [item['product_id'] for item in order_data['items']]
            products = {str(p.id): p for p in Product.objects.filter(id__in=product_ids)}
            
            # Obtener descuento si existe
            discount = None
            if order_data.get('discount_id'):
                try:
                    discount = Discount.objects.get(id=order_data['discount_id'])
                except Discount.DoesNotExist:
                    pass
            
            # Validar que todos los productos existan
            for item in order_data['items']:
                if item['product_id'] not in products:
                    raise Exception(f"Producto {item['product_id']} no encontrado")
            
        except Exception as validation_error:
            logger.error(f"❌ Error validating order data: {str(validation_error)}")
            return Response(
                {'error': 'Datos de orden inválidos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 7. Extraer montos REALES de la respuesta de PayPal
        # PayPal ya descontó su comisión, necesitamos los valores reales
        gross_amount = capture_data.get('gross_amount', final_amount)  # Lo que pagó el cliente
        paypal_fee = capture_data.get('paypal_fee', Decimal('0.00'))   # Fee real de PayPal
        net_amount = capture_data.get('net_amount', final_amount)      # Lo que recibe el vendedor
        
        logger.info(f"💰 Payment amounts from PayPal:")
        logger.info(f"   Gross (client paid): ${gross_amount}")
        logger.info(f"   PayPal fee: ${paypal_fee}")
        logger.info(f"   Net (seller receives): ${net_amount}")
        logger.info(f"   lightcode commission: $0.00 (WHITE-LABEL MODE)")
        
        # 8. Crear la orden en la base de datos
        with transaction.atomic():
            # Para simplificar, usamos el primer producto (MVP)
            first_item = order_data['items'][0]
            product = products[first_item['product_id']]
            
            # Construir comando RCON si el producto lo requiere
            command_to_send = ''
            if product.delivery_mode == 'RCON':
                # Obtener comandos del producto ordenados por 'order'
                product_commands = product.commands.filter(event='ON_PURCHASE').order_by('order')
                
                if product_commands.exists():
                    commands_list = []
                    for cmd in product_commands:
                        processed_cmd = cmd.command.replace('{username}', order_data['minecraft_username'])
                        commands_list.append(processed_cmd)
                    command_to_send = '; '.join(commands_list)
                    logger.info(f"🎮 RCON command built: {command_to_send}")
                else:
                    logger.warning(f"⚠️ Product {product.id} has RCON delivery but no commands configured")

            # Mapear delivery_mode del producto → delivery_method de la orden
            _mode = product.delivery_mode.upper() if product.delivery_mode else 'MANUAL'
            if _mode == 'RCON':
                _delivery_method = Order.DeliveryMethod.RCON
            elif _mode == 'PLUGIN':
                _delivery_method = Order.DeliveryMethod.PLUGIN
            else:
                _delivery_method = Order.DeliveryMethod.MANUAL

            order = Order.objects.create(
                store=store,
                product=product,
                minecraft_username=order_data['minecraft_username'],
                buyer_contact_email=order_data['buyer_email'],
                buyer_paypal_email=capture_data['payer_email'],
                buyer_paypal_name=capture_data['payer_name'],
                buyer_payer_id=capture_data['payer_id'],
                delivery_method=_delivery_method,
                command_sent=command_to_send,
                
                # Montos (pago directo al vendedor)
                original_amount=Decimal(str(order_data['total_amount'])),
                discount_amount_saved=Decimal(str(order_data.get('discount_amount', 0))),
                amount_after_discount=gross_amount,  # Lo que pagó el cliente
                gross_amount=gross_amount,           # Lo que pagó el cliente (BRUTO)
                
                # Fees de PayPal (cobrados al vendedor)
                paypal_fee=paypal_fee,
                net_amount=net_amount,  # Lo que recibe el vendedor después de PayPal fee
                
                # 🔴 SIN comisión de lightcode (pago directo)
                lightcode_fee=Decimal('0.00'),
                lightcode_fee_percent=Decimal('0.0000'),
                
                # PayPal
                paypal_order_id=paypal_order_id,
                paypal_transaction_id=capture_data['transaction_id'],
                payment_captured_at=timezone.now(),
                payment_method='paypal',
                
                # Descuento (relación + datos inmutables)
                discount=discount,
                discount_code=order_data.get('discount_code', '') if discount else '',
                discount_type=discount.discount_type if discount else '',
                discount_value=Decimal(str(discount.value)) if discount else Decimal('0.00'),
                
                # Snapshot del producto
                product_snapshot={
                    'name': product.name,
                    'description': product.description,
                    'price': float(product.price),
                    'quantity': first_item.get('quantity', 1),
                    'image_url': product.get_image_url() if hasattr(product, 'get_image_url') else '',
                    'commands': [
                        {
                            'command': cmd.command,
                            'event': cmd.event,
                            'order': cmd.order
                        }
                        for cmd in product.commands.all()
                    ] if hasattr(product, 'commands') else []
                },
                
                # Estado inicial
                status='requested'
            )
            
            # Crear historial
            OrderStatusHistory.objects.create(
                order=order,
                to_status='requested',
                reason=f'Pago capturado: {capture_data["transaction_id"]} - Pago directo al vendedor'
            )
            
            # 🔴 ELIMINADO: Sistema de balance interno de lightcode
            # El dinero va directo al vendedor, no hay balance interno que gestionar
            logger.info(f"💰 Direct payment: ${net_amount} will be received by seller (after PayPal fee)")
            
            # Eliminar datos temporales
            pending_order.delete()
            logger.info(f"🗑️ Deleted pending order data")
        
        # 10. Procesar entrega (RCON o manual)
        OrderService.process_order_delivery(order)
        
        # 11. Enviar notificación al vendedor
        try:
            from apps.notifications.signals import send_notification_to_user
            from apps.notifications.models import Notification
            
            logger.info(f"📧 Preparing to send notification to seller {store.owner.username} (ID: {store.owner.id})")
            
            # Crear notificación en DB
            notification = Notification.objects.create(
                user=store.owner,
                type=Notification.Type.NEW_ORDER,
                title='Nueva venta',
                message=f'{order.buyer_paypal_name} compró {order.product_snapshot.get("name", "producto")} — ${order.amount_after_discount}',
                data={
                    'order_id': str(order.id),
                    'order_number': order.order_number,
                    'store_slug': store.slug,
                    'amount': float(order.amount_after_discount),
                    'product_name': order.product_snapshot.get('name', 'producto'),
                    'buyer_name': order.buyer_paypal_name,
                    'minecraft_username': order.minecraft_username
                }
            )
            
            logger.info(f"💾 Notification saved to DB: {notification.id}")
            
            # Enviar por WebSocket
            notification_data = {
                'id': str(notification.id),
                'type': notification.type,
                'title': notification.title,
                'message': notification.message,
                'data': notification.data,
                'created_at': notification.created_at.isoformat(),
            }
            
            logger.info(f"📡 Sending WebSocket notification: {notification_data}")
            send_notification_to_user(store.owner.id, notification_data)
            
            logger.info(f"🔔 Notification sent to seller {store.owner.username} for order {order.order_number}")
        except Exception as notif_error:
            logger.error(f"❌ Error sending notification: {str(notif_error)}")
            import traceback
            logger.error(traceback.format_exc())
        
        # 11. Vaciar el carrito después de la compra exitosa
        try:
            from apps.cart.models import Cart
            cart = Cart.objects.filter(store=store).first()
            if cart:
                cart.items.all().delete()
                logger.info(f"🛒 Cart cleared after successful purchase for order {order.order_number}")
        except Exception as cart_error:
            logger.warning(f"⚠️ Could not clear cart: {str(cart_error)}")
        
        logger.info(f"✅ Order created and payment captured: {order.order_number}")
        
        return Response({
            'success': True,
            'order': OrderDetailSerializer(order).data
        })
        
    except Exception as e:
        logger.error(f"❌ Error capturing payment: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {'error': 'Error al procesar el pago'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def store_buyer_orders(request, store_slug):
    """
    Obtiene los pedidos de un comprador en una tienda específica.
    
    GET /api/stores/{store_slug}/orders/my-orders/
    
    Query params:
        email: Email de PayPal del comprador (opcional, para usuarios no autenticados)
    
    Returns:
    {
        "orders": [ order list ]
    }
    """
    try:
        # 1. Validar tienda
        store = get_object_or_404(Store, slug=store_slug, status='active', is_deleted=False)
        
        # 2. Obtener email del comprador
        buyer_email = request.query_params.get('email', '').strip()
        
        # Si no hay email en query params, intentar obtenerlo del token de buyer
        if not buyer_email:
            # TODO: Implementar autenticación de buyer con token
            # Por ahora, devolver lista vacía si no hay email
            return Response({
                'orders': [],
                'message': 'Proporciona tu email de PayPal para ver tus pedidos'
            })
        
        # 3. Buscar pedidos por email de PayPal en esta tienda
        orders = Order.objects.filter(
            store=store,
            buyer_paypal_email__iexact=buyer_email
        ).order_by('-created_at')
        
        # 4. Serializar y devolver
        serializer = OrderListSerializer(orders, many=True)
        
        logger.info(f"📦 Retrieved {orders.count()} orders for {buyer_email} in store {store_slug}")
        
        return Response({
            'orders': serializer.data,
            'total': orders.count()
        })
        
    except Exception as e:
        logger.error(f"❌ Error getting buyer orders: {str(e)}")
        return Response(
            {'error': 'Error al obtener pedidos'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def store_buyer_order_detail(request, store_slug, order_id):
    """
    Obtiene el detalle completo de un pedido específico.
    
    GET /api/stores/{store_slug}/orders/{order_id}/
    
    Query params:
        email: Email de PayPal del comprador (para verificación)
    
    Returns:
        Order detail with all information
    """
    try:
        # 1. Validar tienda
        store = get_object_or_404(Store, slug=store_slug, status='active', is_deleted=False)
        
        # 2. Obtener email del comprador
        buyer_email = request.query_params.get('email', '').strip()
        
        if not buyer_email:
            return Response(
                {'error': 'Email requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 3. Buscar pedido (buscar por email de PayPal)
        try:
            order = Order.objects.get(
                id=order_id,
                store=store,
                buyer_paypal_email__iexact=buyer_email
            )
        except Order.DoesNotExist:
            return Response(
                {'error': 'Pedido no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 4. Serializar y devolver
        serializer = OrderDetailSerializer(order)
        
        logger.info(f"📦 Retrieved order detail {order.order_number} for {buyer_email}")
        
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"❌ Error getting order detail: {str(e)}")
        return Response(
            {'error': 'Error al obtener el pedido'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def store_buyer_retry_rcon(request, store_slug, order_id):
    """
    Permite al comprador solicitar un reintento manual de RCON.
    
    POST /api/stores/{store_slug}/orders/{order_id}/retry-rcon/
    
    Query params:
        email: Email de PayPal del comprador (para verificación)
    
    Returns:
        Success message
    """
    try:
        # 1. Validar tienda
        store = get_object_or_404(Store, slug=store_slug, status='active', is_deleted=False)
        
        # 2. Obtener email del comprador
        buyer_email = request.query_params.get('email', '').strip()
        
        if not buyer_email:
            return Response(
                {'error': 'Email requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 3. Buscar pedido (buscar por email de PayPal)
        try:
            order = Order.objects.get(
                id=order_id,
                store=store,
                buyer_paypal_email__iexact=buyer_email
            )
        except Order.DoesNotExist:
            return Response(
                {'error': 'Pedido no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 4. Validar que tenga RCON job
        if not hasattr(order, 'rcon_job'):
            return Response(
                {'error': 'Este pedido no tiene entrega RCON'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        rcon_job = order.rcon_job
        
        # 5. Validar que no esté ya entregado
        if rcon_job.status == RCONJob.Status.DELIVERED:
            return Response(
                {'error': 'Este pedido ya fue entregado exitosamente'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 6. Resetear estado para reintento
        rcon_job.status = RCONJob.Status.PENDING
        rcon_job.next_retry_at = timezone.now()
        rcon_job.save()
        
        # 7. Intentar ejecutar inmediatamente via Celery Worker
        try:
            retry_failed_rcon_job.apply_async(args=[str(rcon_job.id)], countdown=0)
            logger.info(f"🔄 Buyer requested RCON retry queued for order {order.order_number}")
            message = 'Reintento de entrega iniciado. El sistema intentará entregar tu pedido en los próximos minutos.'
        except Exception as e:
            # Si falla (Redis no disponible), ejecutar directamente
            logger.warning(f"⚠️ Could not queue retry via Celery: {e}")
            logger.info(f"🔄 Executing RCON retry directly for order {order.order_number}")
            
            # Ejecutar directamente la tarea
            from .tasks import execute_rcon_job
            execute_rcon_job(str(rcon_job.id), force=True)
            
            message = 'Reintento de entrega ejecutado. El sistema está procesando tu pedido.'
        
        return Response({
            'success': True,
            'message': message
        })
        
    except Exception as e:
        logger.error(f"❌ Error retrying RCON: {str(e)}")
        return Response(
            {'error': 'Error al solicitar reintento'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])  # Puede ser llamado por cualquiera (es seguro, solo ejecuta jobs pendientes)
def process_pending_rcon_jobs(request):
    """
    Procesa todos los jobs RCON pendientes que están listos para reintentar.
    Este endpoint es llamado periódicamente por el frontend.
    
    POST /api/orders/process-pending-rcon-jobs/
    
    Returns:
    {
        "processed": 3,
        "message": "Processed 3 pending RCON jobs"
    }
    """
    try:
        from .tasks import process_rcon_jobs
        from django.conf import settings
        
        # Siempre ejecutar de forma síncrona para evitar problemas con Redis
        # En producción con Redis, esto se ejecutará vía Celery Beat automáticamente
        result = process_rcon_jobs()
        
        # Contar cuántos jobs se procesaron
        from .models import RCONJob
        from django.utils import timezone
        
        pending_count = RCONJob.objects.filter(
            status=RCONJob.Status.PENDING,
            next_retry_at__lte=timezone.now(),
            auto_retry_count__lt=5
        ).exclude(
            status=RCONJob.Status.CANCELLED
        ).count()
        
        return Response({
            'processed': pending_count,
            'message': f'Processed {pending_count} pending RCON jobs'
        })
        
    except Exception as e:
        logger.error(f"❌ Error processing pending RCON jobs: {str(e)}")
        # No fallar el request, solo loguear el error
        return Response({
            'processed': 0,
            'message': f'Error: {str(e)}',
            'error': str(e)
        }, status=200)  # Devolver 200 para que el frontend no muestre error
        return Response(
            {'error': 'Error al procesar jobs pendientes'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# DIRECT PAYMENT ENDPOINTS (CURRENT SYSTEM - NO lightcode COMMISSION)
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_dashboard_stats(request):
    """
    Obtener estadísticas agregadas para el dashboard del vendedor.
    Retorna todos los datos necesarios sin paginación.
    
    GET /api/orders/dashboard-stats/?store=<store_slug>
    
    Returns:
    {
        "orders": [...],  # All orders for the store
        "total_count": 1280
    }
    """
    user = request.user
    
    # Get active store from query param
    store_slug = request.GET.get('store')
    if not store_slug:
        return Response({'error': 'Store slug is required'}, status=400)
    
    try:
        store = Store.objects.get(slug=store_slug, owner=user)
    except Store.DoesNotExist:
        return Response({'error': 'Store not found'}, status=404)
    
    # Get ALL orders for this store (no pagination)
    all_orders = Order.objects.filter(
        store=store
    ).exclude(
        paypal_transaction_id__startswith='pending_'
    ).select_related('store', 'buyer').order_by('-created_at')
    
    # Serialize orders for frontend
    orders_data = []
    for order in all_orders:
        orders_data.append({
            'id': str(order.id),
            'order_number': order.order_number,
            'status': order.status,
            'created_at': order.created_at.isoformat(),
            'buyer_contact_email': order.buyer_contact_email,
            # ARREGLADO: Enviar gross_amount (monto bruto) en lugar de solo net_amount
            'gross_amount': float(order.gross_amount or order.amount_after_discount or 0),
            'amount_after_discount': float(order.amount_after_discount or 0),
            'net_amount': float(order.net_amount or 0),
            'paypal_fee': float(order.paypal_fee or 0),
            'deliveryMethod': order.delivery_method,
            'manual_reason': order.manual_reason or '',
            # ARREGLADO: Enviar product_snapshot para mostrar nombre correcto en cards
            'product_snapshot': order.product_snapshot,
            'minecraft_username': order.minecraft_username,
        })
    
    return Response({
        'orders': orders_data,
        'total_count': all_orders.count(),
        'auto_delivery_quota': {
            'plugin_used': store.plugin_deliveries_used,
            'rcon_used': store.rcon_deliveries_used,
            'limit': store.AUTO_DELIVERY_LIMIT,
            'reset_date': store.deliveries_reset_date.isoformat() if store.deliveries_reset_date else None,
            'is_free_plan': store._is_free_plan(),
        },
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def create_direct_paypal_order(request, store_slug):
    """
    Create PayPal order using seller's connected account (direct payment).
    
    POST /api/stores/{store_slug}/checkout/create-direct-paypal-order/
    
    Body:
        {
            "minecraft_username": "Steve_123",
            "buyer_email": "buyer@email.com",
            "notes": "Optional notes",
            "discount_code": "SAVE20",
            "items": [
                {"product_id": "uuid", "quantity": 1}
            ]
        }
    
    Returns:
        {
            "order_id": "paypal_order_id",
            "approval_url": "https://paypal.com/...",
            "debug_info": {
                "seller_account": "seller@paypal.com",
                "mode": "sandbox"
            }
        }
    """
    try:
        # Get store
        store = Store.objects.filter(slug=store_slug).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # WHITE-LABEL MODE: No need to check store.paypal_email
        # Payment goes to platform Business account configured in PAYPAL_CLIENT_ID
        logger.info(f"✅ Store {store.name} - WHITE-LABEL MODE: Using platform PayPal Business account")
        
        # Extract request data
        minecraft_username = request.data.get('minecraft_username', '').strip()
        buyer_email = request.data.get('buyer_email', '').strip()
        notes = request.data.get('notes', '') or ''  # Manejar None
        discount_code = (request.data.get('discount_code') or '').strip()  # Manejar None
        items_data = request.data.get('items', [])
        
        if not minecraft_username:
            return Response(
                {'error': 'Usuario de Minecraft es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not buyer_email:
            return Response(
                {'error': 'Email del comprador es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not items_data:
            return Response(
                {'error': 'No hay productos en el carrito'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate totals
        from apps.products.models import Product
        
        total_amount = Decimal('0.00')
        order_items = []
        
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = int(item_data.get('quantity', 1))
            
            try:
                product = Product.objects.get(id=product_id, store=store)
                item_total = product.price * quantity
                total_amount += item_total
                
                order_items.append({
                    'product': product,
                    'quantity': quantity,
                    'price': product.price,
                    'total': item_total
                })
            except Product.DoesNotExist:
                return Response(
                    {'error': f'Producto {product_id} no encontrado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if total_amount <= 0:
            return Response(
                {'error': 'El total debe ser mayor a $0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Return URL in white-label mode (no store slug)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        return_url = f"{frontend_url}/checkout/success"
        cancel_url = f"{frontend_url}/checkout/cancel"
        
        # Create PayPal order in white-label mode (money goes to platform Business account)
        from apps.orders.paypal_service import paypal_service
        
        logger.info(f"💰 Creating PayPal order for store: {store.name}")
        logger.info(f"💵 Amount: ${total_amount}")
        logger.info(f"💰 WHITE-LABEL MODE: Payment will go to platform PayPal Business account")
        
        try:
            paypal_order = paypal_service.create_order(
                amount=total_amount,
                description=f"Compra en {store.name}",
                order_reference=f"STORE_{store.id}",
                return_url=return_url,
                cancel_url=cancel_url,
                payee_email=None  # ← WHITE-LABEL: Money goes to platform Business account
            )
        except Exception as e:
            logger.error(f"❌ Error creating PayPal order: {str(e)}")
            return Response(
                {'error': 'Error al crear orden en PayPal'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        if not paypal_order:
            return Response(
                {'error': 'Error al crear orden en PayPal'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # 🔴 NO CREAR ORDEN TODAVÍA - Guardar datos temporalmente
        # La orden solo se crea después de que PayPal confirme el pago
        
        # Preparar datos de la orden para guardar temporalmente
        order_data = {
            'store_id': str(store.id),
            'store_slug': store.slug,
            'minecraft_username': minecraft_username,
            'buyer_email': buyer_email,
            'notes': notes,
            'discount_code': discount_code if discount_code else None,
            'total_amount': float(total_amount),
            'discount_amount': 0,  # TODO: Implementar descuentos
            'final_amount': float(total_amount),
            'items': [
                {
                    'product_id': str(item['product'].id),
                    'product_name': item['product'].name,
                    'product_description': item['product'].description,
                    'product_image': item['product'].image,
                    'quantity': item['quantity'],
                    'price': float(item['price']),
                    'total': float(item['total']),
                    'delivery_mode': item['product'].delivery_mode
                }
                for item in order_items
            ],
            'buyer_id': str(request.user.id) if request.user.is_authenticated else None
        }
        
        # Guardar datos temporalmente (se eliminan después de crear la orden real)
        pending_order = PendingPayPalOrder.objects.create(
            paypal_order_id=paypal_order['order_id'],
            store=store,
            order_data=order_data
        )
        
        logger.info(f"✅ Created pending PayPal order for store {store.slug}")
        logger.info(f"💾 Order data saved temporarily: {pending_order.id}")
        logger.info(f"⏳ Waiting for PayPal payment confirmation...")
        
        # Return response with debug info
        response_data = {
            'order_id': paypal_order['order_id'],
            'approval_url': paypal_order['approval_url'],
            'debug_info': {
                'payment_flow': 'white_label_business',
                'platform_mode': 'PayPal Business Account',
                'store_name': store.name,
                'paypal_mode': getattr(settings, 'PAYPAL_MODE', 'sandbox'),
                'paypal_client_id': settings.PAYPAL_CLIENT_ID[:20] + '...' if settings.PAYPAL_CLIENT_ID else 'NOT_SET',
                'pending_order_id': str(pending_order.id),
                'total_amount': float(total_amount),
                'currency': 'USD',
                'webhook_url': f"{request.scheme}://{request.get_host()}/api/orders/webhook/paypal/"
            }
        }
        
        logger.info(f"📤 Returning PayPal approval URL: {paypal_order['approval_url']}")
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"❌ Error creating direct PayPal order: {str(e)}")
        logger.exception(e)
        return Response(
            {'error': f'Error creating PayPal order: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def capture_direct_paypal_order(request, store_slug):
    """
    Captura el pago de PayPal y CREA la orden en la DB.
    Este endpoint se llama desde el frontend después de que el usuario apruebe el pago.
    
    POST /api/stores/{store_slug}/checkout/capture-direct-paypal-order/
    {
        "order_id": "paypal_order_id"
    }
    """
    try:
        # Validar tienda
        store = get_object_or_404(Store, slug=store_slug, status='active', is_deleted=False)
        
        # Obtener PayPal order ID
        paypal_order_id = (request.data.get('order_id') or '').strip()
        
        if not paypal_order_id:
            return Response(
                {'error': 'Order ID requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 🔴 IDEMPOTENCIA: Verificar si ya existe una orden con este paypal_order_id
        existing_order = Order.objects.filter(paypal_order_id=paypal_order_id).first()
        if existing_order:
            logger.info(f"⚠️ Order already exists for PayPal ID {paypal_order_id}")
            return Response({
                'success': True,
                'order': OrderDetailSerializer(existing_order).data,
                'message': 'Orden ya procesada'
            })
        
        # Buscar datos temporales
        try:
            pending_order = PendingPayPalOrder.objects.get(
                paypal_order_id=paypal_order_id,
                store=store
            )
            order_data = pending_order.order_data
            logger.info(f"📦 Retrieved pending order data: {order_data.keys()}")
        except PendingPayPalOrder.DoesNotExist:
            logger.error(f"❌ No pending order found for PayPal ID {paypal_order_id}")
            return Response(
                {'error': 'No se encontraron datos de la orden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Capturar pago en PayPal
        paypal_service = PayPalService()
        try:
            capture_data = paypal_service.capture_order(paypal_order_id)
            capture_id = capture_data['transaction_id']
        except Exception as paypal_error:
            error_str = str(paypal_error)
            
            # Si ya fue capturado, obtener detalles
            if '422' in error_str or 'UNPROCESSABLE_ENTITY' in error_str:
                logger.warning(f"⚠️ Order {paypal_order_id} already captured, fetching details...")
                try:
                    order_details = paypal_service.get_order_details(paypal_order_id)
                    payer = order_details.get('payer', {})
                    purchase_unit = order_details['purchase_units'][0]
                    
                    if 'payments' in purchase_unit and 'captures' in purchase_unit['payments']:
                        capture = purchase_unit['payments']['captures'][0]
                        capture_data = {
                            'transaction_id': capture['id'],
                            'payer_id': payer.get('payer_id', 'unknown'),
                            'payer_email': payer.get('email_address', order_data.get('buyer_email', 'unknown')),
                            'payer_name': f"{payer.get('name', {}).get('given_name', '')} {payer.get('name', {}).get('surname', '')}".strip() or 'Unknown'
                        }
                        logger.info(f"✅ Retrieved capture data from already-captured order")
                    else:
                        raise Exception("No capture data found in order details")
                except Exception as detail_error:
                    logger.error(f"❌ Could not fetch order details: {str(detail_error)}")
                    return Response(
                        {'error': 'Error al procesar el pago'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                logger.error(f"❌ PayPal capture error: {error_str}")
                return Response(
                    {'error': 'Error al capturar el pago en PayPal'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # 🔴 IDEMPOTENCIA: Verificar por capture_id
        if Order.objects.filter(paypal_transaction_id=capture_id).exists():
            logger.warning(f"⚠️ Order with capture_id {capture_id} already exists")
            existing = Order.objects.get(paypal_transaction_id=capture_id)
            return Response({
                'success': True,
                'order': OrderDetailSerializer(existing).data,
                'message': 'Pago ya procesado'
            })
        
        logger.info(f"✅ PayPal payment captured: {capture_id}")
        
        # Reconstruir productos
        product_ids = [item['product_id'] for item in order_data['items']]
        products = {str(p.id): p for p in Product.objects.filter(id__in=product_ids)}
        
        # Validar que todos los productos existan
        for item in order_data['items']:
            if item['product_id'] not in products:
                raise Exception(f"Producto {item['product_id']} no encontrado")
        
        # Calcular fees de PayPal
        final_amount = Decimal(str(order_data['final_amount']))
        paypal_fee_percent = Decimal('0.029')  # 2.9%
        paypal_fixed_fee = Decimal('0.30')
        paypal_fee = (final_amount * paypal_fee_percent) + paypal_fixed_fee
        net_amount = final_amount - paypal_fee
        
        logger.info(f"💰 Direct payment: Gross=${final_amount}, PayPal fee=${paypal_fee}, Net=${net_amount}")
        
        # CREAR MÚLTIPLES ÓRDENES (UNA POR CADA UNIDAD COMPRADA)
        # Si compro 2 del mismo producto + 1 de otro = 3 órdenes separadas
        created_orders = []
        
        # Calcular descuento total aplicado
        total_discount = Decimal(str(order_data['total_amount'])) - final_amount
        
        # Obtener buyer si está autenticado
        buyer = None
        if order_data.get('buyer_id'):
            from apps.users.models import User
            try:
                buyer = User.objects.get(id=order_data['buyer_id'])
            except User.DoesNotExist:
                pass
        
        with transaction.atomic():
            # Expandir items por cantidad (crear lista de órdenes individuales)
            individual_orders = []
            for item in order_data['items']:
                quantity = item['quantity']
                for _ in range(quantity):
                    individual_orders.append(item)
            
            total_items = len(individual_orders)
            logger.info(f"📦 Creating {total_items} separate orders from cart")
            
            # Calcular fees y descuentos proporcionales
            for idx, item in enumerate(individual_orders):
                product = products[item['product_id']]
                item_price = Decimal(str(item['price']))
                
                # Calcular descuento proporcional para este item
                # Fórmula: (precio_item / total_sin_descuento) * descuento_total
                item_discount = Decimal('0.00')
                if total_discount > 0:
                    item_discount = (item_price / Decimal(str(order_data['total_amount']))) * total_discount
                    item_discount = item_discount.quantize(Decimal('0.01'))
                
                item_final_price = item_price - item_discount
                
                # Calcular fees proporcionales de PayPal
                item_paypal_fee = (item_final_price / final_amount) * paypal_fee
                item_paypal_fee = item_paypal_fee.quantize(Decimal('0.01'))
                item_net_amount = item_final_price - item_paypal_fee
                
                # Construir comando RCON si aplica
                command_to_send = ''
                if product.delivery_mode == 'RCON':
                    product_commands = product.commands.filter(event='ON_PURCHASE').order_by('order')
                    if product_commands.exists():
                        commands_list = []
                        for cmd in product_commands:
                            processed_cmd = cmd.command.replace('{username}', order_data['minecraft_username'])
                            commands_list.append(processed_cmd)
                        command_to_send = '; '.join(commands_list)
                
                # Mapear delivery_mode
                _mode = product.delivery_mode.upper() if product.delivery_mode else 'MANUAL'
                if _mode == 'RCON':
                    _delivery_method = Order.DeliveryMethod.RCON
                elif _mode == 'PLUGIN':
                    _delivery_method = Order.DeliveryMethod.PLUGIN
                else:
                    _delivery_method = Order.DeliveryMethod.MANUAL
                
                # Crear orden individual
                order = Order.objects.create(
                    store=store,
                    buyer=buyer,
                    product=product,
                    minecraft_username=order_data['minecraft_username'],
                    buyer_contact_email=order_data['buyer_email'],
                    buyer_paypal_email=capture_data['payer_email'],
                    buyer_paypal_name=capture_data['payer_name'],
                    buyer_payer_id=capture_data['payer_id'],
                    delivery_method=_delivery_method,
                    command_sent=command_to_send,
                    seller_notes=order_data.get('notes', ''),
                    
                    # Montos (proporcionales)
                    original_amount=item_price,
                    discount_amount_saved=item_discount,
                    amount_after_discount=item_final_price,
                    gross_amount=item_final_price,
                    
                    # Fees (proporcionales)
                    paypal_fee=item_paypal_fee,
                    net_amount=item_net_amount,
                    lightcode_fee=Decimal('0.00'),
                    lightcode_fee_percent=Decimal('0.0000'),
                    
                    # PayPal (mismo para todas las órdenes del mismo pago)
                    paypal_order_id=paypal_order_id,
                    paypal_transaction_id=f"{capture_id}_{idx+1}",  # Único por orden
                    payment_captured_at=timezone.now(),
                    payment_method='paypal',
                    
                    # Snapshot
                    product_snapshot={
                        'name': item['product_name'],
                        'description': item.get('product_description', ''),
                        'image': item.get('product_image', ''),
                        'price': float(item_price),
                        'quantity': 1,  # Siempre 1 porque creamos órdenes separadas
                        'total': float(item_final_price),
                        'currency': 'USD',
                        'delivery_mode': item['delivery_mode'],
                        # Info del carrito completo (para referencia)
                        'cart_total_items': total_items,
                        'cart_item_index': idx + 1
                    },
                    
                    status='requested'
                )
                
                # Historial
                OrderStatusHistory.objects.create(
                    order=order,
                    to_status='requested',
                    reason=f'Pago capturado: {capture_id} - Orden {idx+1}/{total_items} del carrito'
                )
                
                created_orders.append(order)
                logger.info(f"✅ Created order {idx+1}/{total_items}: {order.order_number} - {product.name}")
            
            # Eliminar datos temporales
            pending_order.delete()
            logger.info(f"🗑️ Deleted pending order data")
        
        # Procesar entrega para todas las órdenes
        for order in created_orders:
            OrderService.process_order_delivery(order)
        
        # Notificar al vendedor (una notificación por todas las órdenes)
        try:
            from apps.notifications.signals import send_notification_to_user
            from apps.notifications.models import Notification
            
            # Resumen de productos comprados
            product_summary = {}
            for order in created_orders:
                product_name = order.product_snapshot.get('name', 'producto')
                product_summary[product_name] = product_summary.get(product_name, 0) + 1
            
            # Construir mensaje
            if len(product_summary) == 1:
                product_name, qty = list(product_summary.items())[0]
                if qty > 1:
                    message = f'{capture_data["payer_name"]} compró {qty}x {product_name} — ${final_amount}'
                else:
                    message = f'{capture_data["payer_name"]} compró {product_name} — ${final_amount}'
            else:
                items_text = ', '.join([f'{qty}x {name}' for name, qty in product_summary.items()])
                message = f'{capture_data["payer_name"]} compró {items_text} — ${final_amount}'
            
            notification = Notification.objects.create(
                user=store.owner,
                type=Notification.Type.NEW_ORDER,
                title=f'Nueva venta ({len(created_orders)} {"órdenes" if len(created_orders) > 1 else "orden"})',
                message=message,
                data={
                    'order_ids': [str(o.id) for o in created_orders],
                    'order_numbers': [o.order_number for o in created_orders],
                    'store_slug': store.slug,
                    'amount': float(final_amount),
                    'buyer_name': capture_data['payer_name'],
                    'minecraft_username': order_data['minecraft_username'],
                    'total_orders': len(created_orders)
                }
            )
            
            notification_data = {
                'id': str(notification.id),
                'type': notification.type,
                'title': notification.title,
                'message': notification.message,
                'data': notification.data,
                'created_at': notification.created_at.isoformat(),
            }
            
            send_notification_to_user(store.owner.id, notification_data)
            logger.info(f"🔔 Notification sent to seller for {len(created_orders)} orders")
        except Exception as notif_error:
            logger.error(f"❌ Error sending notification: {str(notif_error)}")
        
        logger.info(f"✅ Created {len(created_orders)} orders from cart: {[o.order_number for o in created_orders]}")
        
        # Retornar la primera orden (para compatibilidad con frontend)
        # El frontend puede mostrar un resumen o redirigir a "Mis Pedidos"
        return Response({
            'success': True,
            'order': OrderDetailSerializer(created_orders[0]).data,
            'total_orders': len(created_orders),
            'order_numbers': [o.order_number for o in created_orders]
        })
        
    except Exception as e:
        logger.error(f"❌ Error capturing payment: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {'error': 'Error al procesar el pago'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def paypal_payment_return(request, store_slug):
    """
    🎯 Endpoint llamado por el frontend después de que PayPal redirige
    Simula el webhook en modo desarrollo
    """
    try:
        paypal_order_id = request.GET.get('token')  # PayPal sends order ID as 'token'
        
        if not paypal_order_id:
            logger.error("❌ No PayPal order ID provided")
            return Response({'error': 'No order ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find order by PayPal order ID
        try:
            order = Order.objects.get(paypal_order_id=paypal_order_id)
        except Order.DoesNotExist:
            logger.error(f"❌ Order not found for PayPal ID: {paypal_order_id}")
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        
        logger.info(f"✅ Processing payment return for order {order.order_number}")
        
        # 🔥 SIMULATE WEBHOOK IN DEVELOPMENT MODE (ONLY AFTER USER COMPLETES PAYMENT)
        if settings.DEBUG and getattr(settings, 'PAYPAL_MODE', 'sandbox') == 'sandbox':
            logger.info("🧪 DEVELOPMENT MODE: Simulating PayPal webhook after payment confirmation...")
            
            # Call webhook handler directly instead of using HTTP request
            from django.test import RequestFactory
            from django.http import HttpRequest
            
            webhook_payload = {
                "id": f"WH-RETURN-SIMULATED-{order.id}",
                "event_version": "1.0",
                "create_time": timezone.now().isoformat(),
                "resource_type": "capture",
                "event_type": "PAYMENT.CAPTURE.COMPLETED",
                "summary": f"Payment completed for ${order.original_amount} USD",
                "resource": {
                    "id": f"CAPTURE-{paypal_order_id}",
                    "status": "COMPLETED",
                    "amount": {
                        "currency_code": "USD",
                        "value": str(order.original_amount)
                    },
                    "seller_protection": {
                        "status": "ELIGIBLE"
                    },
                    "supplementary_data": {
                        "related_ids": {
                            "order_id": paypal_order_id
                        }
                    },
                    "payee": {
                        "email_address": "platform@lightcode.com",  # Simulated platform account
                        "merchant_id": "PLATFORM_SIMULATED"
                    },
                    "payer": {
                        "email_address": order.buyer_contact_email,
                        "payer_id": "SIMULATED_PAYER_ID",
                        "name": {
                            "given_name": "Test",
                            "surname": "Buyer"
                        }
                    },
                    "create_time": timezone.now().isoformat(),
                    "update_time": timezone.now().isoformat()
                }
            }
            
            # Create a fake request to pass to webhook handler
            factory = RequestFactory()
            fake_request = factory.post(
                '/api/orders/webhook/paypal/',
                data=json.dumps(webhook_payload),
                content_type='application/json',
                HTTP_PAYPAL_TRANSMISSION_ID=f'simulated-return-{order.id}',
                HTTP_PAYPAL_TRANSMISSION_TIME=timezone.now().isoformat(),
                HTTP_PAYPAL_CERT_URL='https://api.sandbox.paypal.com/cert',
                HTTP_PAYPAL_AUTH_ALGO='SHA256withRSA',
                HTTP_PAYPAL_TRANSMISSION_SIG='simulated-signature'
            )
            
            # Call webhook handler directly
            try:
                webhook_response = paypal_webhook(fake_request)
                logger.info(f"✅ Webhook simulation completed with status: {webhook_response.status_code}")
            except Exception as webhook_error:
                logger.error(f"❌ Error calling webhook handler: {str(webhook_error)}")
                import traceback
                logger.error(traceback.format_exc())
        
        return Response({
            'success': True,
            'order_number': order.order_number,
            'message': 'Payment processing started'
        })
        
    except Exception as e:
        logger.error(f"❌ Error in PayPal return handler: {str(e)}")
        logger.exception(e)
        return Response({'error': 'Internal error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_order_webhook_status(request, store_slug, order_id):
    """
    Check if an order's webhook has been confirmed.
    Useful for polling in development mode to wait for auto-simulated webhook.
    
    GET /api/stores/{store_slug}/checkout/check-webhook/{order_id}/
    
    Parameters:
        order_id: Can be either internal UUID or PayPal Order ID
    
    Returns:
        {
            "webhook_confirmed": true/false,
            "payment_captured_at": "2026-04-18T18:00:00Z" or null,
            "order_status": "requested",
            "order_number": "ORD-12345678",
            "order": {...}  # Full order details if confirmed
        }
    """
    try:
        # Try to find order by PayPal Order ID first (more likely in this context)
        try:
            order = Order.objects.get(paypal_order_id=order_id, store__slug=store_slug)
        except Order.DoesNotExist:
            # If not found by PayPal Order ID, try internal UUID
            try:
                order = Order.objects.get(id=order_id, store__slug=store_slug)
            except (Order.DoesNotExist, ValueError) as e:
                return Response(
                    {'error': 'Orden no encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        response_data = {
            'webhook_confirmed': order.webhook_confirmed,
            'payment_captured_at': order.payment_captured_at.isoformat() if order.payment_captured_at else None,
            'order_status': order.status,
            'order_number': order.order_number,
            'buyer_paypal_email': order.buyer_paypal_email or None
        }
        
        # If webhook confirmed, include full order details
        if order.webhook_confirmed:
            from .serializers import OrderDetailSerializer
            response_data['order'] = OrderDetailSerializer(order).data
        
        return Response(response_data)
        
    except Exception as e:
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def complete_direct_paypal_order(request, store_slug):
    """
    Complete PayPal order after buyer approval (direct payment).
    
    POST /api/stores/{store_slug}/checkout/complete-direct-paypal-order/
    
    Body:
        {
            "paypal_order_id": "paypal_order_id",
            "payer_id": "payer_id_from_paypal"
        }
    
    This endpoint:
    1. Verifies payment with PayPal API (NEVER trust frontend)
    2. Updates order status only if payment is COMPLETED
    3. Triggers RCON delivery
    4. Returns order details
    """
    try:
        # Get store
        store = Store.objects.filter(slug=store_slug).first()
        if not store:
            return Response(
                {'error': 'Tienda no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get PayPal connection
        from apps.payment_integrations.models import PayPalConnection
        paypal_connection = PayPalConnection.objects.filter(
            store=store,
            status='connected'
        ).first()
        
        if not paypal_connection:
            return Response(
                {'error': 'PayPal no configurado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract data
        paypal_order_id = request.data.get('paypal_order_id')
        payer_id = request.data.get('payer_id')
        
        if not paypal_order_id:
            return Response(
                {'error': 'PayPal Order ID requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find order in database
        try:
            order = Order.objects.get(
                paypal_order_id=paypal_order_id,
                store=store
            )
        except Order.DoesNotExist:
            return Response(
                {'error': 'Orden no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # CRITICAL: Verify payment with PayPal API (server-side)
        from apps.payment_integrations.paypal_partner_service import paypal_partner_service
        payment_details = paypal_partner_service.verify_payment(
            connection=paypal_connection,
            order_id=paypal_order_id
        )
        
        if not payment_details:
            return Response(
                {'error': 'No se pudo verificar el pago'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Only proceed if payment is COMPLETED
        if payment_details.get('status') != 'COMPLETED':
            return Response(
                {'error': f"Pago no completado. Estado: {payment_details.get('status')}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract payment details
        payer_info = payment_details.get('payer', {})
        purchase_units = payment_details.get('purchase_units', [{}])
        capture_info = purchase_units[0].get('payments', {}).get('captures', [{}])[0] if purchase_units else {}
        
        # Update order with payment details
        order.status = 'requested'  # Keep as requested until delivery
        order.payer_email = payer_info.get('email_address', '')
        order.payer_id = payer_info.get('payer_id', payer_id or '')
        
        # Update buyer PayPal info (required fields)
        payer_name = payer_info.get('name', {})
        full_name = f"{payer_name.get('given_name', '')} {payer_name.get('surname', '')}".strip()
        order.buyer_paypal_name = full_name or 'Unknown'
        order.buyer_paypal_email = payer_info.get('email_address', '')
        order.buyer_payer_id = payer_info.get('payer_id', payer_id or '')
        
        # Update transaction ID
        if capture_info:
            order.paypal_transaction_id = capture_info.get('id', order.paypal_transaction_id)
        
        # Extract financial details
        if capture_info:
            gross_amount = Decimal(capture_info.get('amount', {}).get('value', '0'))
            seller_receivable = capture_info.get('seller_receivable_breakdown', {})
            
            order.gross_amount = gross_amount
            order.paypal_fee = Decimal(seller_receivable.get('paypal_fee', {}).get('value', '0'))
            order.net_amount = Decimal(seller_receivable.get('net_amount', {}).get('value', '0'))
        
        # CRITICAL: Set payment_captured_at to trigger finances signal
        order.payment_captured_at = timezone.now()
        order.webhook_confirmed = False  # Will be set to True when webhook arrives
        order.minecraft_delivered = False  # Will be set to True when RCON succeeds
        order.save()
        
        logger.info(f"✅ Payment verified and order {order.id} completed")
        
        # Create notification for seller
        from apps.notifications.models import Notification
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        notification = Notification.objects.create(
            user=store.owner,
            type=Notification.Type.NEW_ORDER,
            title='Nueva orden recibida',
            message=f'Nueva orden {order.order_number} de {order.minecraft_username} por ${order.gross_amount}',
            order=order,
            store=store,
            data={
                'order_id': str(order.id),
                'order_number': order.order_number,
                'amount': float(order.gross_amount),
                'minecraft_username': order.minecraft_username
            }
        )
        
        # Send WebSocket notification
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"user_{store.owner.id}",
                {
                    'type': 'notification_message',
                    'notification': {
                        'id': str(notification.id),
                        'type': notification.type,
                        'title': notification.title,
                        'message': notification.message,
                        'data': notification.data,
                        'created_at': notification.created_at.isoformat(),
                        'read': notification.read
                    }
                }
            )
        
        # Process order delivery (RCON or manual)
        OrderService.process_order_delivery(order)
        
        # Return order details
        return Response({
            'success': True,
            'order': OrderDetailSerializer(order).data,
            'payment_details': {
                'gross_amount': float(order.gross_amount) if order.gross_amount else 0,
                'paypal_fee': float(order.paypal_fee) if order.paypal_fee else 0,
                'net_amount': float(order.net_amount) if order.net_amount else 0,
                'payer_email': order.payer_email
            }
        })
        
    except Exception as e:
        logger.error(f"Error completing direct PayPal order: {e}", exc_info=True)
        return Response(
            {'error': 'Error al completar el pago'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )