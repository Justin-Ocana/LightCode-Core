"""
Modelos para el sistema de finanzas y contabilidad.
Maneja todas las transacciones financieras por seller.
"""
import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class FinancialRecord(models.Model):
    """
    Registro financiero principal para cada seller.
    Contiene el resumen de todas las transacciones.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='financial_record'
    )
    
    # Totales acumulados
    total_gross_revenue = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
        help_text="Total bruto recibido (lo que pagaron los compradores)"
    )
    total_fees_paid = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
        help_text="Total de fees pagados (PayPal + lightcode)"
    )
    total_net_revenue = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
        help_text="Total neto recibido (después de fees)"
    )
    
    # Contadores
    total_transactions = models.PositiveIntegerField(
        default=0,
        help_text="Número total de transacciones"
    )
    successful_transactions = models.PositiveIntegerField(
        default=0,
        help_text="Transacciones exitosas"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'finances_financial_record'
        verbose_name = 'Financial Record'
        verbose_name_plural = 'Financial Records'
    
    def __str__(self):
        return f"Financial Record - {self.seller.username}"


class Transaction(models.Model):
    """
    Registro individual de cada transacción financiera.
    Inmutable una vez creado.
    """
    
    class TransactionType(models.TextChoices):
        SALE = 'sale', 'Sale'
        REFUND = 'refund', 'Refund'
        CHARGEBACK = 'chargeback', 'Chargeback'
        ADJUSTMENT = 'adjustment', 'Adjustment'
    
    class PaymentMethod(models.TextChoices):
        PAYPAL_DIRECT = 'paypal_direct', 'PayPal Direct'
        PAYPAL_lightcode = 'paypal_lightcode', 'PayPal via lightcode'
        STRIPE = 'stripe', 'Stripe'
        CRYPTO = 'crypto', 'Cryptocurrency'
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'
        REFUNDED = 'refunded', 'Refunded'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    financial_record = models.ForeignKey(
        FinancialRecord, 
        on_delete=models.CASCADE, 
        related_name='transactions'
    )
    
    # Referencia a la orden (si aplica)
    order = models.OneToOneField(
        'orders.Order', 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='financial_transaction'
    )
    
    # Información básica
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # IDs externos
    external_transaction_id = models.CharField(
        max_length=255, null=True, blank=True,
        help_text="ID de la transacción en PayPal, Stripe, etc."
    )
    external_order_id = models.CharField(
        max_length=255, null=True, blank=True,
        help_text="ID de la orden en el sistema externo"
    )
    
    # Montos financieros
    gross_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Monto bruto (lo que pagó el comprador)"
    )
    currency = models.CharField(max_length=3, default='USD')
    
    # Timestamps
    transaction_date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Metadata
    metadata = models.JSONField(
        default=dict, blank=True,
        help_text="Información adicional de la transacción"
    )
    
    class Meta:
        db_table = 'finances_transaction'
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['financial_record', '-transaction_date']),
            models.Index(fields=['external_transaction_id']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Transaction {self.id} - {self.gross_amount} {self.currency}"


class PaymentBreakdown(models.Model):
    """
    Desglose detallado de fees y montos para cada transacción.
    """
    
    transaction = models.OneToOneField(
        Transaction, 
        on_delete=models.CASCADE, 
        related_name='breakdown'
    )
    
    # Montos base
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Fees de PayPal
    paypal_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    paypal_fee_percentage = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal('0.0000'),
        help_text="Porcentaje de fee de PayPal (ej: 0.0349 = 3.49%)"
    )
    
    # Fees de lightcode (solo para sistema legacy)
    lightcode_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    lightcode_fee_percentage = models.DecimalField(
        max_digits=5, decimal_places=4, default=Decimal('0.0000'),
        help_text="Porcentaje de fee de lightcode"
    )
    
    # Plan del seller en el momento de la transacción
    seller_plan = models.CharField(
        max_length=20, default='starter',
        help_text="Plan del seller cuando se hizo la transacción"
    )
    
    # Monto neto final
    net_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Monto que recibe el seller después de todos los fees"
    )
    
    # Información de descuentos (si aplica)
    discount_code = models.CharField(max_length=50, null=True, blank=True)
    discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'finances_payment_breakdown'
        verbose_name = 'Payment Breakdown'
        verbose_name_plural = 'Payment Breakdowns'
    
    def __str__(self):
        return f"Breakdown for {self.transaction.id}"
    
    @property
    def total_fees(self):
        """Calcula el total de fees pagados."""
        return self.paypal_fee + self.lightcode_fee
    
    @property
    def fee_percentage(self):
        """Calcula el porcentaje total de fees."""
        if self.gross_amount > 0:
            return (self.total_fees / self.gross_amount) * 100
        return Decimal('0.00')


class MonthlyReport(models.Model):
    """
    Reporte mensual agregado para cada seller.
    Se genera automáticamente al final de cada mes.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    financial_record = models.ForeignKey(
        FinancialRecord, 
        on_delete=models.CASCADE, 
        related_name='monthly_reports'
    )
    
    # Período del reporte
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()  # 1-12
    
    # Estadísticas del mes
    total_transactions = models.PositiveIntegerField(default=0)
    successful_transactions = models.PositiveIntegerField(default=0)
    
    # Montos del mes
    gross_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Desglose de fees
    paypal_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    lightcode_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'finances_monthly_report'
        verbose_name = 'Monthly Report'
        verbose_name_plural = 'Monthly Reports'
        unique_together = ['financial_record', 'year', 'month']
        ordering = ['-year', '-month']
    
    def __str__(self):
        return f"Report {self.year}-{self.month:02d} - {self.financial_record.seller.username}"