# apps/orders/balance_service.py
"""
Servicio de gestión de balances internos de lightcode.
"""

from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from .balance_models import SellerBalance, BalanceTransaction, Withdrawal, lightcodeEarnings
from .models import Order


class BalanceService:
    """
    Gestiona todos los movimientos de balance de vendedores.
    """
    
    @staticmethod
    def get_or_create_balance(seller):
        """Obtiene o crea el balance de un vendedor"""
        balance, created = SellerBalance.objects.get_or_create(
            seller=seller,
            defaults={'currency': 'USD'}
        )
        return balance
    
    @staticmethod
    @transaction.atomic
    def credit_sale(order):
        """
        Acredita una venta al balance del vendedor (pending).
        Se llama cuando el pago es capturado por PayPal.
        
        Args:
            order: Instancia de Order con todos los fees calculados
        
        Returns:
            tuple: (BalanceTransaction, lightcodeEarnings)
        """
        # Verificar si ya fue acreditado
        if order.balance_credited:
            # Ya fue procesado, buscar registros existentes
            existing_tx = BalanceTransaction.objects.filter(order=order, type='sale').first()
            existing_earning = lightcodeEarnings.objects.filter(order=order).first()
            return existing_tx, existing_earning
        
        seller = order.store.owner
        balance = BalanceService.get_or_create_balance(seller)
        
        # El monto que se acredita al vendedor
        seller_credited = order.seller_credited
        
        # Snapshot del balance antes
        balance_before = balance.pending_balance
        
        # Actualizar balance (va a pending porque aún no se entrega)
        balance.pending_balance += seller_credited
        balance.total_earned += seller_credited
        balance.save()
        
        # Crear transacción en el libro contable
        transaction_record = BalanceTransaction.objects.create(
            seller=seller,
            order=order,
            type='sale',
            amount=seller_credited,
            balance_before=balance_before,
            balance_after=balance.pending_balance,
            description=f"Venta {order.order_number} — {order.product_snapshot.get('name', 'Producto')}",
            metadata={
                'order_number': order.order_number,
                'product_name': order.product_snapshot.get('name'),
                'minecraft_username': order.minecraft_username,
                'gross_payment': str(order.amount_after_discount),
                'paypal_fee': str(order.paypal_receive_fee),
                'lightcode_fee': str(order.lightcode_fee),
            }
        )
        
        # Registrar ganancia de lightcode
        lightcode_earning = lightcodeEarnings.objects.create(
            order=order,
            seller=seller,
            gross_payment=order.amount_after_discount,
            paypal_fee_receive=order.paypal_receive_fee,
            amount_after_paypal=order.amount_after_discount - order.paypal_receive_fee,
            lightcode_fee_amount=order.lightcode_fee,
            seller_credited=seller_credited,
            lightcode_plan=order.lightcode_plan,
            lightcode_fee_rate=order.lightcode_fee_percent
        )
        
        # Marcar orden como acreditada
        order.balance_credited = True
        order.save(update_fields=['balance_credited'])
        
        return transaction_record, lightcode_earning
    
    @staticmethod
    @transaction.atomic
    def release_pending_to_available(order):
        """
        Mueve el balance de pending a available cuando la orden se entrega.
        
        Args:
            order: Instancia de Order que fue entregada
        """
        if order.balance_released:
            return None  # Ya fue liberado
        
        seller = order.store.owner
        balance = BalanceService.get_or_create_balance(seller)
        
        amount = order.seller_credited
        
        # Snapshot del balance antes
        pending_before = balance.pending_balance
        available_before = balance.available_balance
        
        # Mover de pending a available
        balance.pending_balance -= amount
        balance.available_balance += amount
        balance.save()
        
        # Crear transacción
        transaction_record = BalanceTransaction.objects.create(
            seller=seller,
            order=order,
            type='delivery',
            amount=amount,
            balance_before=available_before,
            balance_after=balance.available_balance,
            description=f"Orden {order.order_number} entregada — Balance disponible",
            metadata={
                'order_number': order.order_number,
                'pending_before': str(pending_before),
                'available_after': str(balance.available_balance),
            }
        )
        
        # Marcar orden como liberada
        order.balance_released = True
        order.delivered_at = timezone.now()
        order.save(update_fields=['balance_released', 'delivered_at'])
        
        return transaction_record
    
    @staticmethod
    @transaction.atomic
    def refund_order(order):
        """
        Reembolsa una orden - quita el monto del balance pending.
        
        Args:
            order: Instancia de Order que se reembolsa
        """
        seller = order.store.owner
        balance = BalanceService.get_or_create_balance(seller)
        
        amount = order.seller_credited
        
        # Snapshot del balance antes
        balance_before = balance.pending_balance
        
        # Quitar de pending
        balance.pending_balance -= amount
        balance.total_earned -= amount  # También del histórico
        balance.save()
        
        # Crear transacción
        transaction_record = BalanceTransaction.objects.create(
            seller=seller,
            order=order,
            type='refund',
            amount=-amount,  # Negativo
            balance_before=balance_before,
            balance_after=balance.pending_balance,
            description=f"Reembolso orden {order.order_number}",
            metadata={
                'order_number': order.order_number,
                'reason': 'Orden cancelada/reembolsada',
            }
        )
        
        return transaction_record
    
    @staticmethod
    @transaction.atomic
    def create_withdrawal(seller, amount_requested, paypal_destination):
        """
        Crea una solicitud de retiro.
        
        Args:
            seller: Usuario vendedor
            amount_requested: Monto a retirar (Decimal)
            paypal_destination: Email PayPal del vendedor
        
        Returns:
            Withdrawal instance
        """
        balance = BalanceService.get_or_create_balance(seller)
        
        # Validar que tenga suficiente balance
        if balance.available_balance < amount_requested:
            raise ValueError(f"Balance insuficiente. Disponible: ${balance.available_balance}")
        
        # Validar mínimo
        if amount_requested < Decimal('5.00'):
            raise ValueError("El monto mínimo de retiro es $5.00")
        
        # Crear withdrawal
        withdrawal = Withdrawal.objects.create(
            seller=seller,
            amount_requested=amount_requested,
            paypal_destination=paypal_destination,
            status='pending'
        )
        
        # Calcular fees
        withdrawal.calculate_fees()
        withdrawal.save()
        
        # Descontar del balance available
        balance_before = balance.available_balance
        balance.available_balance -= amount_requested
        balance.save()
        
        # Crear transacción
        BalanceTransaction.objects.create(
            seller=seller,
            withdrawal=withdrawal,
            type='withdrawal',
            amount=-amount_requested,  # Negativo
            balance_before=balance_before,
            balance_after=balance.available_balance,
            description=f"Retiro solicitado a {paypal_destination}",
            metadata={
                'withdrawal_id': str(withdrawal.id),
                'paypal_destination': paypal_destination,
                'paypal_fee': str(withdrawal.paypal_fee_withdraw),
                'amount_received': str(withdrawal.amount_received),
            }
        )
        
        return withdrawal
    
    @staticmethod
    @transaction.atomic
    def complete_withdrawal(withdrawal, paypal_transaction_id, paypal_batch_id=None):
        """
        Marca un retiro como completado.
        
        Args:
            withdrawal: Instancia de Withdrawal
            paypal_transaction_id: ID de transacción de PayPal
            paypal_batch_id: ID de batch de PayPal (opcional)
        """
        withdrawal.status = 'completed'
        withdrawal.paypal_transaction_id = paypal_transaction_id
        if paypal_batch_id:
            withdrawal.paypal_batch_id = paypal_batch_id
        withdrawal.completed_at = timezone.now()
        withdrawal.save()
        
        # Actualizar total retirado
        balance = BalanceService.get_or_create_balance(withdrawal.seller)
        balance.total_withdrawn += withdrawal.amount_requested
        balance.save()
        
        return withdrawal
    
    @staticmethod
    @transaction.atomic
    def fail_withdrawal(withdrawal, reason):
        """
        Marca un retiro como fallido y devuelve el balance.
        
        Args:
            withdrawal: Instancia de Withdrawal
            reason: Razón del fallo
        """
        withdrawal.status = 'failed'
        withdrawal.failure_reason = reason
        withdrawal.save()
        
        # Devolver el balance
        seller = withdrawal.seller
        balance = BalanceService.get_or_create_balance(seller)
        
        balance_before = balance.available_balance
        balance.available_balance += withdrawal.amount_requested
        balance.save()
        
        # Crear transacción de devolución
        BalanceTransaction.objects.create(
            seller=seller,
            withdrawal=withdrawal,
            type='adjustment',
            amount=withdrawal.amount_requested,  # Positivo (devuelve)
            balance_before=balance_before,
            balance_after=balance.available_balance,
            description=f"Retiro fallido - Balance devuelto",
            metadata={
                'withdrawal_id': str(withdrawal.id),
                'failure_reason': reason,
            }
        )
        
        return withdrawal
    
    @staticmethod
    def get_seller_balance_summary(seller):
        """
        Obtiene un resumen completo del balance de un vendedor.
        
        Returns:
            dict con toda la info del balance
        """
        balance = BalanceService.get_or_create_balance(seller)
        
        # Últimas transacciones
        recent_transactions = BalanceTransaction.objects.filter(
            seller=seller
        ).select_related('order', 'withdrawal')[:10]
        
        # Retiros pendientes
        pending_withdrawals = Withdrawal.objects.filter(
            seller=seller,
            status__in=['pending', 'processing']
        )
        
        return {
            'balance': balance,
            'recent_transactions': recent_transactions,
            'pending_withdrawals': pending_withdrawals,
            'total_balance': balance.total_balance,
        }
    
    @staticmethod
    def get_lightcode_financial_summary():
        """
        Obtiene el resumen financiero completo de lightcode.
        Para el panel de admin.
        
        Returns:
            dict con todas las métricas financieras
        """
        from django.db.models import Sum, Count
        from datetime import datetime, timedelta
        
        # Total adeudado a vendedores
        total_owed = SellerBalance.objects.aggregate(
            total_available=Sum('available_balance'),
            total_pending=Sum('pending_balance')
        )
        
        # Ganancias de lightcode
        lightcode_earnings = lightcodeEarnings.objects.aggregate(
            total_lightcode_fees=Sum('lightcode_fee_amount'),
            total_paypal_fees=Sum('paypal_fee_receive'),
            total_gross=Sum('gross_payment'),
            total_seller_credited=Sum('seller_credited')
        )
        
        # Ganancias hoy
        today = timezone.now().date()
        today_earnings = lightcodeEarnings.objects.filter(
            created_at__date=today
        ).aggregate(
            today_fees=Sum('lightcode_fee_amount')
        )
        
        # Ganancias este mes
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_earnings = lightcodeEarnings.objects.filter(
            created_at__gte=month_start
        ).aggregate(
            month_fees=Sum('lightcode_fee_amount')
        )
        
        # Retiros
        withdrawals_summary = Withdrawal.objects.aggregate(
            total_withdrawn=Sum('amount_requested', filter=models.Q(status='completed')),
            total_fees_paid=Sum('paypal_fee_withdraw', filter=models.Q(status='completed')),
            pending_count=Count('id', filter=models.Q(status='pending'))
        )
        
        # Órdenes
        orders_summary = Order.objects.aggregate(
            total_orders=Count('id'),
            total_revenue=Sum('amount_after_discount')
        )
        
        return {
            'total_owed_available': total_owed['total_available'] or Decimal('0.00'),
            'total_owed_pending': total_owed['total_pending'] or Decimal('0.00'),
            'total_owed': (total_owed['total_available'] or Decimal('0.00')) + (total_owed['total_pending'] or Decimal('0.00')),
            
            'lightcode_fees_total': lightcode_earnings['total_lightcode_fees'] or Decimal('0.00'),
            'lightcode_fees_today': today_earnings['today_fees'] or Decimal('0.00'),
            'lightcode_fees_month': month_earnings['month_fees'] or Decimal('0.00'),
            
            'paypal_fees_total': lightcode_earnings['total_paypal_fees'] or Decimal('0.00'),
            'total_gross_received': lightcode_earnings['total_gross'] or Decimal('0.00'),
            'total_seller_credited': lightcode_earnings['total_seller_credited'] or Decimal('0.00'),
            
            'total_withdrawn': withdrawals_summary['total_withdrawn'] or Decimal('0.00'),
            'withdrawal_fees_paid': withdrawals_summary['total_fees_paid'] or Decimal('0.00'),
            'pending_withdrawals_count': withdrawals_summary['pending_count'] or 0,
            
            'total_orders': orders_summary['total_orders'] or 0,
            'total_revenue': orders_summary['total_revenue'] or Decimal('0.00'),
        }
