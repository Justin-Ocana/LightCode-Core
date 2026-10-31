from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone
import uuid

User = get_user_model()

# Import balance models
from .balance_models import SellerBalance, BalanceTransaction, Withdrawal, lightcodeEarnings


class PayPalWebhookEvent(models.Model):
    """
    Registro de todos los eventos de webhook de PayPal para auditoría y debugging.
    """
    class EventType(models.TextChoices):
        PAYMENT_CAPTURE_COMPLETED = 'PAYMENT.CAPTURE.COMPLETED', 'Pago Completado'
        PAYMENT_CAPTURE_DENIED = 'PAYMENT.CAPTURE.DENIED', 'Pago Denegado'
        PAYMENT_CAPTURE_PENDING = 'PAYMENT.CAPTURE.PENDING', 'Pago Pendiente'
        PAYMENT_CAPTURE_REFUNDED = 'PAYMENT.CAPTURE.REFUNDED', 'Pago Reembolsado'
        CHECKOUT_ORDER_APPROVED = 'CHECKOUT.ORDER.APPROVED', 'Orden Aprobada'
        CHECKOUT_ORDER_COMPLETED = 'CHECKOUT.ORDER.COMPLETED', 'Orden Completada'
        OTHER = 'OTHER', 'Otro'
    
    class ProcessingStatus(models.TextChoices):
        RECEIVED = 'received', 'Recibido'
        PROCESSING = 'processing', 'Procesando'
        PROCESSED = 'processed', 'Procesado'
        FAILED = 'failed', 'Fallido'
        IGNORED = 'ignored', 'Ignorado'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Datos del webhook
    event_id = models.CharField(max_length=100, unique=True, db_index=True, help_text="ID del evento de PayPal")
    event_type = models.CharField(max_length=100, choices=EventType.choices, default=EventType.OTHER, db_index=True)
    event_version = models.CharField(max_length=20, blank=True)
    
    # Datos del recurso (payment/order)
    resource_type = models.CharField(max_length=50, blank=True)
    resource_id = models.CharField(max_length=100, db_index=True, help_text="ID del pago o orden")
    paypal_order_id = models.CharField(max_length=100, blank=True, db_index=True, help_text="PayPal Order ID")
    
    # Relación con orden interna
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='webhook_events')
    
    # Payload completo
    raw_payload = models.JSONField(help_text="Payload completo del webhook")
    
    # Headers de verificación
    transmission_id = models.CharField(max_length=100, blank=True)
    transmission_time = models.CharField(max_length=100, blank=True)
    transmission_sig = models.CharField(max_length=500, blank=True)
    cert_url = models.URLField(blank=True)
    auth_algo = models.CharField(max_length=50, blank=True)
    
    # Validación
    signature_verified = models.BooleanField(default=False, help_text="Si la firma del webhook fue verificada")
    signature_verification_error = models.TextField(blank=True)
    
    # Procesamiento
    processing_status = models.CharField(max_length=20, choices=ProcessingStatus.choices, default=ProcessingStatus.RECEIVED, db_index=True)
    processing_error = models.TextField(blank=True)
    processing_attempts = models.IntegerField(default=0)
    
    # Datos extraídos (para búsqueda rápida)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    payer_email = models.EmailField(blank=True)
    payee_email = models.EmailField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at', 'event_type']),
            models.Index(fields=['processing_status', 'event_type']),
            models.Index(fields=['resource_id']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {self.event_id[:8]}"


class Order(models.Model):
    """
    Pedido completo con transparencia total.
    Guarda TODOS los datos en el momento de la transacción (inmutabilidad).
    """
    
    class Status(models.TextChoices):
        CREATED = 'created', '⚪ Creado'  # Orden creada, esperando aprobación de PayPal
        APPROVED = 'approved', '🟡 Aprobado'  # Usuario aprobó en PayPal, esperando captura
        REQUESTED = 'requested', '🟠 Solicitado'  # Pago capturado, esperando entrega
        PROCESSING = 'processing', '🔵 Procesando'  # Entrega en proceso
        DELIVERED = 'delivered', '🟢 Entregado'  # Entregado exitosamente
        FAILED = 'failed', '🔴 Fallido'  # Falló la entrega
        CANCELLED = 'cancelled', '⚫ Cancelado'  # Cancelado por usuario/vendedor
        REFUNDED = 'refunded', '🟣 Reembolsado'  # Reembolsado
    
    class DeliveryMethod(models.TextChoices):
        RCON   = 'rcon',   'RCON Automático'
        MANUAL = 'manual', 'Manual'
        PLUGIN = 'plugin', 'PlugsEssentials (Bedrock)'

    class ManualReason(models.TextChoices):
        NONE          = '',              'N/A'
        LIMIT_REACHED = 'limit_reached', 'Límite de entregas automáticas alcanzado'
        SELLER_CHOICE = 'seller_choice', 'Configurado como manual por el vendedor'
    
    # Identificadores
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=20, unique=True, db_index=True)
    
    # Relaciones
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='orders')
    buyer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, blank=True)
    product_snapshot = models.JSONField()  # Snapshot completo del producto
    discount = models.ForeignKey('discounts.Discount', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Estado
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED, db_index=True)
    delivery_method = models.CharField(max_length=10, choices=DeliveryMethod.choices)
    manual_reason = models.CharField(
        max_length=20,
        choices=ManualReason.choices,
        default='',
        blank=True,
        help_text="Razón por la que el pedido es manual (si aplica)"
    )
    
    # Datos del comprador
    # Email de contacto (ingresado por el usuario en checkout)
    buyer_contact_email = models.EmailField(blank=True, default='', help_text="Email de contacto ingresado por el comprador")
    
    # Datos de PayPal (obtenidos después de capturar el pago)
    buyer_paypal_name = models.CharField(max_length=255)
    buyer_paypal_email = models.EmailField()
    buyer_payer_id = models.CharField(max_length=100, db_index=True)
    paypal_transaction_id = models.CharField(max_length=100, unique=True, db_index=True)
    paypal_order_id = models.CharField(max_length=100, blank=True)
    payment_ip = models.GenericIPAddressField(null=True, blank=True)
    
    # NUEVOS CAMPOS - PAGOS DIRECTOS SIN COMISIÓN
    # Información de pago directo al vendedor
    payer_email = models.EmailField(blank=True, help_text="Email del pagador en PayPal")
    payer_id = models.CharField(max_length=50, blank=True, help_text="ID del pagador en PayPal")
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="Monto bruto pagado")
    paypal_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="Comisión de PayPal")
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="Monto neto recibido por el vendedor")
    payment_method = models.CharField(max_length=20, default='paypal', help_text="Método de pago usado")
    webhook_confirmed = models.BooleanField(default=False, help_text="Si el webhook de PayPal confirmó el pago")
    minecraft_delivered = models.BooleanField(default=False, help_text="Si el comando RCON/PlugsEssentials se ejecutó exitosamente")
    
    # Datos del producto/servidor
    minecraft_username = models.CharField(max_length=16, db_index=True)
    server_address = models.CharField(max_length=255, blank=True)
    command_sent = models.TextField(blank=True)
    
    # DESGLOSE FINANCIERO COMPLETO (inmutable)
    # Precio y descuento
    original_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])
    discount_code = models.CharField(max_length=50, blank=True)
    discount_type = models.CharField(max_length=20, blank=True)  # PERCENTAGE, FIXED_AMOUNT
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discount_amount_saved = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    amount_after_discount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])
    
    # Fees (calculados sobre amount_after_discount)
    # PayPal fee al RECIBIR el pago (lightcode recibe)
    paypal_receive_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    paypal_receive_fee_percent = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.0690'))  # 6.9%
    
    # Comisión de lightcode
    lightcode_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    lightcode_fee_percent = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.0430'))  # 4.3%
    lightcode_plan = models.CharField(max_length=20, default='starter')  # starter, pro
    
    # Monto que se acredita al vendedor (en balance interno)
    seller_credited = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Monto acreditado al balance del vendedor"
    )
    
    # Balance status
    balance_credited = models.BooleanField(
        default=False,
        help_text="Si ya se acreditó al balance del vendedor"
    )
    balance_released = models.BooleanField(
        default=False,
        help_text="Si el balance pasó de pending a available (orden entregada)"
    )
    
    currency = models.CharField(max_length=3, default='USD')
    
    # Timestamps de pago
    payment_captured_at = models.DateTimeField(null=True, blank=True)
    
    # Notas del vendedor
    seller_notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at', 'status']),
            models.Index(fields=['store', 'status']),
            models.Index(fields=['minecraft_username']),
            models.Index(fields=['paypal_transaction_id']),
        ]
    
    def __str__(self):
        return f"Order {self.order_number} - {self.minecraft_username}"
    
    def save(self, *args, **kwargs):
        # Solo generar order_number si no existe
        if not self.order_number:
            # Generar nuevo formato: ORD-XXXXXXXX (8 caracteres hexadecimales)
            import uuid
            random_hex = uuid.uuid4().hex[:8].upper()
            self.order_number = f"ORD-{random_hex}"
        super().save(*args, **kwargs)


class RCONJob(models.Model):
    """
    Jobs de entrega RCON con reintentos automáticos.
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        PROCESSING = 'processing', 'Procesando'
        DELIVERED = 'delivered', 'Entregado'
        FAILED = 'failed', 'Fallido'
        CANCELLED = 'cancelled', 'Cancelado'
    
    class FailureReason(models.TextChoices):
        NETWORK_ERROR = 'network_error', 'Error de Red'
        AUTH_ERROR = 'auth_error', 'Error de Autenticación'
        COMMAND_ERROR = 'command_error', 'Error de Comando'
        PLAYER_OFFLINE_ERROR = 'player_offline_error', 'Jugador Offline'
        UNKNOWN = 'unknown', 'Desconocido'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='rcon_job')
    
    # Comando y servidor
    command = models.TextField()
    server_host = models.CharField(max_length=255)
    server_port = models.IntegerField()
    
    # Estado
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    auto_retry_count = models.IntegerField(default=0)  # Contador de reintentos automáticos
    manual_retry_count = models.IntegerField(default=0)  # Contador de reintentos manuales
    attempts = models.IntegerField(default=0)  # Total de intentos (legacy, mantener por compatibilidad)
    max_attempts = models.IntegerField(default=5)
    
    # Logs y errores
    rcon_raw_log = models.TextField(blank=True)  # Respuesta técnica exacta
    rcon_error = models.CharField(max_length=500, blank=True)  # ECONNREFUSED, Auth failed, etc
    failure_reason_type = models.CharField(
        max_length=30, 
        choices=FailureReason.choices, 
        blank=True,
        db_index=True
    )  # Tipo de error clasificado
    failure_reason = models.TextField(blank=True)  # Mensaje amigable para el comprador
    last_error_message = models.TextField(blank=True)  # Mensaje completo del último error
    
    # Cancelación (auditoría)
    cancelled_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_rcon_jobs'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    # Reintentos
    next_retry_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'next_retry_at']),
        ]
    
    def __str__(self):
        return f"RCON Job {self.order.order_number} - {self.status}"
    
    def calculate_next_retry(self):
        """
        Backoff exponencial basado en el tipo de error:
        - NETWORK_ERROR: 10s, 30s, 1min, 2min, 5min
        - PLAYER_OFFLINE_ERROR: 10s, 30s, 1min, 2min, 5min (mismo que network)
        - Otros: no reintentar automáticamente
        
        NOTA: Tiempos optimizados para desarrollo y testing.
        En producción, considera aumentar los intervalos si tienes muchos pedidos.
        """
        if self.auto_retry_count >= self.max_attempts:
            return None
        
        # Backoff rápido para errores recuperables (en segundos)
        backoff_schedule_seconds = [10, 30, 60, 120, 300]  # 10s, 30s, 1min, 2min, 5min
        
        if self.failure_reason_type in [
            self.FailureReason.NETWORK_ERROR,
            self.FailureReason.PLAYER_OFFLINE_ERROR
        ]:
            if self.auto_retry_count < len(backoff_schedule_seconds):
                seconds = backoff_schedule_seconds[self.auto_retry_count]
                return timezone.now() + timezone.timedelta(seconds=seconds)
        
        # AUTH_ERROR, COMMAND_ERROR, UNKNOWN: no reintentar automáticamente
        return None


class OrderStatusHistory(models.Model):
    """
    Timeline de cambios de estado.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, choices=Order.Status.choices, blank=True)
    to_status = models.CharField(max_length=20, choices=Order.Status.choices)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Order status histories'
    
    def __str__(self):
        return f"{self.order.order_number}: {self.from_status} → {self.to_status}"


class OrderNote(models.Model):
    """
    Notas del vendedor sobre el pedido.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    content = models.TextField()
    is_internal = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Note on {self.order.order_number} by {self.author}"



class PendingPayPalOrder(models.Model):
    """
    Almacena temporalmente los datos de una orden antes de que PayPal capture el pago.
    Se elimina después de crear la orden real o después de 24 horas.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paypal_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE)
    order_data = models.JSONField(help_text="Datos completos de la orden para crear después del pago")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['paypal_order_id']),
            models.Index(fields=['expires_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Expira en 3 horas (tiempo máximo que PayPal mantiene una orden)
            self.expires_at = timezone.now() + timezone.timedelta(hours=3)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Pending PayPal Order {self.paypal_order_id}"

# lightcode Mod Delivery
from .mod_models import ModCommand

__all__ = ['ModCommand']
