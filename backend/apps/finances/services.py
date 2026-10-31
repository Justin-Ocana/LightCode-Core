"""
Servicios para cálculos financieros y procesamiento de transacciones.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import logging

from .models import FinancialRecord, Transaction, PaymentBreakdown

logger = logging.getLogger(__name__)


class FinanceCalculator:
    """
    Calculadora centralizada para todos los cálculos financieros.
    """
    
    # PayPal fees (Direct payment)
    PAYPAL_PERCENTAGE = Decimal('0.0349')  # 3.49%
    PAYPAL_FIXED_FEE = Decimal('0.49')     # $0.49
    
    # lightcode fees (Legacy system)
    lightcode_FEES = {
        'starter': Decimal('0.10'),  # 10%
        'pro': Decimal('0.05'),      # 5%
        'enterprise': Decimal('0.02') # 2%
    }
    
    @classmethod
    def calculate_paypal_fee(cls, gross_amount):
        """
        Calcula el fee de PayPal para pagos directos.
        Formula: (amount * 3.49%) + $0.49
        """
        percentage_fee = gross_amount * cls.PAYPAL_PERCENTAGE
        total_fee = percentage_fee + cls.PAYPAL_FIXED_FEE
        return total_fee.quantize(Decimal('0.01'))
    
    @classmethod
    def calculate_lightcode_fee(cls, amount, seller_plan='starter'):
        """
        Calcula el fee de lightcode (solo para sistema legacy).
        """
        fee_percentage = cls.lightcode_FEES.get(seller_plan, cls.lightcode_FEES['starter'])
        fee = amount * fee_percentage
        return fee.quantize(Decimal('0.01'))
    
    @classmethod
    def calculate_direct_payment_breakdown(cls, gross_amount, seller_plan='starter'):
        """
        Calcula el desglose completo para pagos directos (sin comisión lightcode).
        
        Returns:
            dict con gross_amount, paypal_fee, net_amount, etc.
        """
        paypal_fee = cls.calculate_paypal_fee(gross_amount)
        net_amount = gross_amount - paypal_fee
        
        return {
            'gross_amount': gross_amount,
            'paypal_fee': paypal_fee,
            'paypal_fee_percentage': cls.PAYPAL_PERCENTAGE,
            'lightcode_fee': Decimal('0.00'),
            'lightcode_fee_percentage': Decimal('0.00'),
            'net_amount': net_amount,
            'seller_plan': seller_plan,
            'payment_method': 'paypal_direct'
        }
    
    @classmethod
    def calculate_legacy_payment_breakdown(cls, gross_amount, seller_plan='starter'):
        """
        Calcula el desglose para el sistema legacy (con comisión lightcode).
        
        Returns:
            dict con gross_amount, paypal_fee, lightcode_fee, net_amount, etc.
        """
        # PayPal fee sobre el monto bruto
        paypal_fee = cls.calculate_paypal_fee(gross_amount)
        amount_after_paypal = gross_amount - paypal_fee
        
        # lightcode fee sobre el monto después de PayPal
        lightcode_fee = cls.calculate_lightcode_fee(amount_after_paypal, seller_plan)
        net_amount = amount_after_paypal - lightcode_fee
        
        return {
            'gross_amount': gross_amount,
            'paypal_fee': paypal_fee,
            'paypal_fee_percentage': cls.PAYPAL_PERCENTAGE,
            'lightcode_fee': lightcode_fee,
            'lightcode_fee_percentage': cls.lightcode_FEES.get(seller_plan, cls.lightcode_FEES['starter']),
            'net_amount': net_amount,
            'seller_plan': seller_plan,
            'payment_method': 'paypal_lightcode'
        }


class TransactionProcessor:
    """
    Procesador de transacciones financieras.
    Crea y actualiza registros financieros.
    """
    
    @classmethod
    @transaction.atomic
    def create_transaction_from_order(cls, order):
        """
        Crea una transacción financiera a partir de una orden.
        
        Args:
            order: Instancia de Order
            
        Returns:
            Transaction instance
        """
        # Obtener o crear el registro financiero del seller
        financial_record, created = FinancialRecord.objects.get_or_create(
            seller=order.store.owner
        )
        
        if created:
            logger.info(f"✅ Created financial record for seller {order.store.owner.username}")
        
        # Determinar el tipo de pago
        is_direct_payment = order.payment_method == 'paypal' and order.net_amount is not None
        
        # Calcular breakdown
        seller_plan = getattr(order.store.owner, 'subscription_plan', 'starter')
        
        if is_direct_payment:
            # Usar los datos reales de la orden (ya calculados por PayPal)
            breakdown_data = {
                'gross_amount': order.gross_amount or order.amount_after_discount,
                'paypal_fee': order.paypal_fee or Decimal('0.00'),
                'paypal_fee_percentage': FinanceCalculator.PAYPAL_PERCENTAGE,
                'lightcode_fee': Decimal('0.00'),
                'lightcode_fee_percentage': Decimal('0.00'),
                'net_amount': order.net_amount or Decimal('0.00'),
                'seller_plan': seller_plan,
                'payment_method': 'paypal_direct'
            }
        else:
            # Sistema legacy - calcular fees
            breakdown_data = FinanceCalculator.calculate_legacy_payment_breakdown(
                order.amount_after_discount,
                seller_plan
            )
        
        # Crear la transacción
        trans = Transaction.objects.create(
            financial_record=financial_record,
            order=order,
            transaction_type=Transaction.TransactionType.SALE,
            payment_method=Transaction.PaymentMethod.PAYPAL_DIRECT if is_direct_payment else Transaction.PaymentMethod.PAYPAL_lightcode,
            status=Transaction.Status.COMPLETED,
            external_transaction_id=order.paypal_transaction_id,
            external_order_id=order.paypal_order_id,
            gross_amount=breakdown_data['gross_amount'],
            currency='USD',
            transaction_date=order.payment_captured_at or timezone.now(),
            metadata={
                'order_number': order.order_number,
                'product_name': order.product_snapshot.get('name', 'Unknown'),
                'minecraft_username': order.minecraft_username,
                'store_slug': order.store.slug,
                'discount_code': order.discount_code,
            }
        )
        
        # Crear el breakdown
        PaymentBreakdown.objects.create(
            transaction=trans,
            gross_amount=breakdown_data['gross_amount'],
            paypal_fee=breakdown_data['paypal_fee'],
            paypal_fee_percentage=breakdown_data['paypal_fee_percentage'],
            lightcode_fee=breakdown_data['lightcode_fee'],
            lightcode_fee_percentage=breakdown_data['lightcode_fee_percentage'],
            seller_plan=breakdown_data['seller_plan'],
            net_amount=breakdown_data['net_amount'],
            discount_code=order.discount_code,
            discount_amount=order.discount_amount_saved or Decimal('0.00')
        )
        
        # Actualizar el registro financiero
        financial_record.total_gross_revenue += breakdown_data['gross_amount']
        financial_record.total_fees_paid += (breakdown_data['paypal_fee'] + breakdown_data['lightcode_fee'])
        financial_record.total_net_revenue += breakdown_data['net_amount']
        financial_record.total_transactions += 1
        financial_record.successful_transactions += 1
        financial_record.save()
        
        logger.info(f"✅ Created transaction {trans.id} for order {order.order_number}")
        logger.info(f"   Gross: ${breakdown_data['gross_amount']}, Net: ${breakdown_data['net_amount']}")
        
        return trans
    
    @classmethod
    def get_seller_summary(cls, seller):
        """
        Obtiene el resumen financiero de un seller.
        """
        try:
            financial_record = FinancialRecord.objects.get(seller=seller)
            return {
                'total_gross_revenue': float(financial_record.total_gross_revenue),
                'total_fees_paid': float(financial_record.total_fees_paid),
                'total_net_revenue': float(financial_record.total_net_revenue),
                'total_transactions': financial_record.total_transactions,
                'successful_transactions': financial_record.successful_transactions,
                'average_transaction': float(financial_record.total_gross_revenue / financial_record.total_transactions) if financial_record.total_transactions > 0 else 0,
            }
        except FinancialRecord.DoesNotExist:
            return {
                'total_gross_revenue': 0,
                'total_fees_paid': 0,
                'total_net_revenue': 0,
                'total_transactions': 0,
                'successful_transactions': 0,
                'average_transaction': 0,
            }