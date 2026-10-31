# apps/orders/balance_models.py
"""
Sistema de Balances Internos de lightcode

En lugar de usar PayPal Marketplace splits, lightcode recibe TODO el dinero
y mantiene un balance interno de cuánto le debe a cada vendedor.

Flujo:
1. Comprador paga → lightcode recibe todo
2. Sistema anota: X para vendedor (pending), Y para lightcode (comisión)
3. Orden entregada → pending → available
4. Vendedor retira → lightcode envía desde su PayPal
"""

from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid


class SellerBalance(models.Model):
    """
    Balance de cada vendedor en lightcode.
    Un registro por vendedor - se actualiza con cada transacción.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.OneToOneField(
        'users.User',
        on_delete=models.CASCADE,
        related_name='seller_balance'
    )
    
    # Balance disponible para retirar AHORA
    available_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    
    # Balance en órdenes no entregadas (bloqueado)
    pending_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    
    # Histórico total ganado desde siempre
    total_earned = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    
    # Histórico total retirado desde siempre
    total_withdrawn = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    
    currency = models.CharField(max_length=3, default='USD')
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'seller_balances'
        verbose_name = 'Balance de Vendedor'
        verbose_name_plural = 'Balances de Vendedores'
    
    def __str__(self):
        return f"{self.seller.username} - ${self.available_balance} disponible"
    
    @property
    def total_balance(self):
        """Balance total (disponible + pendiente)"""
        return self.available_balance + self.pending_balance


class BalanceTransaction(models.Model):
    """
    Libro contable - cada movimiento de balance.
    NUNCA se borra, solo se añaden filas.
    """
    TYPE_CHOICES = [
        ('sale', 'Venta'),
        ('withdrawal', 'Retiro'),
        ('refund', 'Reembolso'),
        ('adjustment', 'Ajuste Manual'),
        ('fee', 'Fee'),
        ('delivery', 'Entrega Completada'),  # pending → available
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='balance_transactions'
    )
    
    # Referencias opcionales
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='balance_transactions'
    )
    withdrawal = models.ForeignKey(
        'orders.Withdrawal',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='balance_transactions'
    )
    
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    
    # Monto del movimiento (positivo o negativo)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Snapshots del balance antes y después
    balance_before = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Descripción legible
    description = models.TextField()
    
    # Metadata adicional (JSON)
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'balance_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['seller', '-created_at']),
            models.Index(fields=['type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.seller.username} - {self.type} - ${self.amount}"


class Withdrawal(models.Model):
    """
    Solicitudes de retiro de vendedores.
    """
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('processing', 'Procesando'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
        ('cancelled', 'Cancelado'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='withdrawals'
    )
    
    # Montos
    amount_requested = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('5.00'))]  # Mínimo $5
    )
    
    # Fee de PayPal al ENVIAR dinero (PayPal Payouts)
    paypal_fee_withdraw = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    paypal_fee_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal('0.0190')  # 1.9% típico
    )
    
    # Lo que realmente recibe el vendedor
    amount_received = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # PayPal info
    paypal_transaction_id = models.CharField(max_length=100, blank=True)
    paypal_destination = models.EmailField()  # Email PayPal del vendedor
    paypal_batch_id = models.CharField(max_length=100, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    failure_reason = models.TextField(blank=True)
    
    # Metadata
    notes = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_withdrawals'
    )
    
    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'withdrawals'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['seller', '-requested_at']),
            models.Index(fields=['status', '-requested_at']),
        ]
    
    def __str__(self):
        return f"Retiro {self.seller.username} - ${self.amount_requested} - {self.status}"
    
    def calculate_fees(self):
        """Calcula el fee de PayPal y el monto neto"""
        self.paypal_fee_withdraw = (self.amount_requested * self.paypal_fee_rate).quantize(Decimal('0.01'))
        self.amount_received = self.amount_requested - self.paypal_fee_withdraw


class lightcodeEarnings(models.Model):
    """
    Registro de ganancias de lightcode por cada venta.
    Esto es el libro financiero de lightcode.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='lightcode_earnings'
    )
    seller = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='lightcode_earnings_from'
    )
    
    # Desglose financiero completo
    gross_payment = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Lo que pagó el comprador (con o sin descuento)"
    )
    
    paypal_fee_receive = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Fee de PayPal al RECIBIR el pago"
    )
    
    amount_after_paypal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Lo que quedó después del fee de PayPal"
    )
    
    lightcode_fee_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Comisión de lightcode"
    )
    
    seller_credited = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Lo que se acreditó al vendedor"
    )
    
    # Metadata del momento
    lightcode_plan = models.CharField(max_length=20)  # starter, pro
    lightcode_fee_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        help_text="% de comisión lightcode en ese momento"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'lightcode_earnings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['seller', '-created_at']),
        ]
    
    def __str__(self):
        return f"lightcode ganó ${self.lightcode_fee_amount} de orden {self.order.order_number}"
