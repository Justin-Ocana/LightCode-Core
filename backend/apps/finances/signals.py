"""
Signals para conectar automáticamente con el sistema de orders.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

from apps.orders.models import Order
from .services import TransactionProcessor

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Order)
def create_financial_transaction(sender, instance, created, **kwargs):
    """
    Crea automáticamente una transacción financiera cuando se completa un pago.
    
    Se ejecuta cuando:
    - La orden tiene payment_captured_at (pago confirmado)
    - No existe ya una transacción financiera para esta orden
    
    NOTA: Las transacciones se crean cuando se captura el pago, pero el dashboard
    solo muestra las de órdenes entregadas.
    """
    # Solo procesar si el pago fue capturado
    if not instance.payment_captured_at:
        return
    
    # Verificar si ya existe una transacción
    if hasattr(instance, 'financial_transaction') and instance.financial_transaction:
        return
    
    # Crear la transacción financiera
    try:
        transaction = TransactionProcessor.create_transaction_from_order(instance)
        logger.info(f"✅ Financial transaction created for order {instance.order_number}")
    except Exception as e:
        logger.error(f"❌ Error creating financial transaction for order {instance.order_number}: {e}")
