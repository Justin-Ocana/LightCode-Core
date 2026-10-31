# apps/orders/admin_views.py
"""
Views para el panel de administración de lightcode.
Solo accesible para superusers.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Q, F
from django.utils import timezone
from datetime import timedelta

from core.permissions import IslightcodeAdmin
from .models import Order
from .balance_models import SellerBalance, BalanceTransaction, Withdrawal, lightcodeEarnings
from .balance_service import BalanceService
from apps.stores.models import Store

User = get_user_model()


class AdminDashboardViewSet(viewsets.ViewSet):
    """
    ViewSet para el dashboard principal del admin.
    """
    permission_classes = [IslightcodeAdmin]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Estadísticas generales del sistema.
        GET /api/admin/dashboard/stats/
        """
        # Usuarios
        total_users = User.objects.count()
        users_this_month = User.objects.filter(
            date_joined__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        # Tiendas
        total_stores = Store.objects.count()
        active_stores = Store.objects.filter(status='active').count()
        
        # Pedidos
        total_orders = Order.objects.count()
        orders_today = Order.objects.filter(
            created_at__date=timezone.now().date()
        ).count()
        
        # Ingresos
        total_revenue = Order.objects.aggregate(
            total=Sum('amount_after_discount')
        )['total'] or 0
        
        revenue_this_month = Order.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=30)
        ).aggregate(
            total=Sum('amount_after_discount')
        )['total'] or 0
        
        return Response({
            'users': {
                'total': total_users,
                'this_month': users_this_month,
                'change_percent': self._calculate_change(total_users, users_this_month)
            },
            'stores': {
                'total': total_stores,
                'active': active_stores,
                'change_percent': '+8%'  # TODO: calcular real
            },
            'orders': {
                'total': total_orders,
                'today': orders_today,
                'change_percent': '+23%'  # TODO: calcular real
            },
            'revenue': {
                'total': float(total_revenue),
                'this_month': float(revenue_this_month),
                'change_percent': '+15%'  # TODO: calcular real
            }
        })
    
    @action(detail=False, methods=['get'])
    def recent_activity(self, request):
        """
        Actividad reciente del sistema.
        GET /api/admin/dashboard/recent_activity/
        """
        activities = []
        
        # Últimos usuarios
        recent_users = User.objects.order_by('-date_joined')[:5]
        for user in recent_users:
            activities.append({
                'type': 'user',
                'message': f'Nuevo usuario registrado: {user.email}',
                'time': user.date_joined.isoformat()
            })
        
        # Últimas tiendas
        recent_stores = Store.objects.order_by('-created_at')[:5]
        for store in recent_stores:
            activities.append({
                'type': 'store',
                'message': f'Nueva tienda creada: {store.name}',
                'time': store.created_at.isoformat()
            })
        
        # Últimos pedidos completados
        recent_orders = Order.objects.filter(
            status=Order.Status.DELIVERED
        ).order_by('-delivered_at')[:5]
        for order in recent_orders:
            activities.append({
                'type': 'order',
                'message': f'Pedido {order.order_number} completado',
                'time': order.delivered_at.isoformat() if order.delivered_at else order.created_at.isoformat()
            })
        
        # Ordenar por tiempo
        activities.sort(key=lambda x: x['time'], reverse=True)
        
        return Response(activities[:10])
    
    def _calculate_change(self, total, recent):
        """Calcula el porcentaje de cambio"""
        if total == 0:
            return '+0%'
        percent = (recent / total) * 100
        return f'+{percent:.0f}%'


class AdminUsersViewSet(viewsets.ViewSet):
    """
    ViewSet para gestión de usuarios.
    """
    permission_classes = [IslightcodeAdmin]
    
    def list(self, request):
        """
        Lista todos los usuarios.
        GET /api/admin/users/
        """
        users = User.objects.all().order_by('-date_joined')
        
        # Filtros opcionales
        search = request.query_params.get('search', '')
        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search)
            )
        
        data = []
        for user in users:
            stores_count = Store.objects.filter(owner=user).count()
            orders_count = Order.objects.filter(store__owner=user).count()
            
            data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'subscription_plan': getattr(user, 'subscription_plan', 'starter'),
                'stores_count': stores_count,
                'orders_count': orders_count,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined.isoformat()
            })
        
        return Response(data)


class AdminStoresViewSet(viewsets.ViewSet):
    """
    ViewSet para gestión de tiendas.
    """
    permission_classes = [IslightcodeAdmin]
    
    def list(self, request):
        """
        Lista todas las tiendas.
        GET /api/admin/stores/
        """
        from apps.products.models import Product
        
        stores = Store.objects.select_related('owner').all().order_by('-created_at')
        
        data = []
        for store in stores:
            orders_count = Order.objects.filter(store=store).count()
            revenue = Order.objects.filter(store=store).aggregate(
                total=Sum('amount_after_discount')
            )['total'] or 0
            
            # Contar productos de la tienda
            products_count = Product.objects.filter(store=store).count()
            
            # Obtener logo URL si existe
            logo_url = None
            if store.logo:
                try:
                    from core.cloudinary_utils import CloudinaryImageHandler
                    logo_url = CloudinaryImageHandler.get_transformed_url(
                        store.logo,
                        transformation='store_logo'
                    )
                except Exception:
                    pass
            
            data.append({
                'id': str(store.id),
                'name': store.name,
                'slug': store.slug,
                'logo': logo_url,
                'owner': store.owner.username,
                'owner_email': store.owner.email,
                'is_active': store.status == 'active',
                'products_count': products_count,
                'orders_count': orders_count,
                'total_revenue': float(revenue),
                'created_at': store.created_at.isoformat()
            })
        
        return Response(data)


class AdminFinancesViewSet(viewsets.ViewSet):
    """
    ViewSet para el panel de finanzas.
    """
    permission_classes = [IslightcodeAdmin]
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Resumen financiero completo.
        GET /api/admin/finances/summary/
        """
        summary = BalanceService.get_lightcode_financial_summary()
        
        # TODO: Obtener saldo real de PayPal via API
        # Por ahora calculamos el esperado
        paypal_balance = summary['total_revenue'] - summary['paypal_fees_total']
        
        return Response({
            'paypal_balance': float(paypal_balance),
            'total_owed_available': float(summary['total_owed_available']),
            'total_owed_pending': float(summary['total_owed_pending']),
            'lightcode_available': float(paypal_balance - summary['total_owed']),
            'lightcode_fees_today': float(summary['lightcode_fees_today']),
            'lightcode_fees_month': float(summary['lightcode_fees_month']),
            'lightcode_fees_total': float(summary['lightcode_fees_total']),
            'total_orders': summary['total_orders'],
            'total_revenue': float(summary['total_revenue']),
        })
    
    @action(detail=False, methods=['get'])
    def orders(self, request):
        """
        Ventas recientes con desglose.
        GET /api/admin/finances/orders/
        """
        orders = Order.objects.select_related(
            'store', 'store__owner'
        ).order_by('-created_at')[:50]
        
        data = []
        for order in orders:
            data.append({
                'id': str(order.id),
                'order_number': order.order_number,
                'seller': order.store.owner.username,
                'buyer': order.buyer_paypal_email,
                'product': order.product_snapshot.get('name', 'N/A'),
                'paid': float(order.amount_after_discount),
                'discount': float(order.discount_amount_saved),
                'paypal_fee': float(order.paypal_receive_fee),
                'lightcode_fee': float(order.lightcode_fee),
                'seller_receives': float(order.seller_credited),
                'status': order.status,
                'created_at': order.created_at.isoformat()
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def balances(self, request):
        """
        Balances por vendedor.
        GET /api/admin/finances/balances/
        """
        balances = SellerBalance.objects.select_related('seller').all()
        
        data = []
        for balance in balances:
            # Último retiro
            last_withdrawal = Withdrawal.objects.filter(
                seller=balance.seller,
                status='completed'
            ).order_by('-completed_at').first()
            
            data.append({
                'id': str(balance.id),
                'seller': balance.seller.username,
                'plan': getattr(balance.seller, 'subscription_plan', 'starter'),
                'available': float(balance.available_balance),
                'pending': float(balance.pending_balance),
                'total_earned': float(balance.total_earned),
                'total_withdrawn': float(balance.total_withdrawn),
                'last_withdrawal': last_withdrawal.completed_at.isoformat() if last_withdrawal else None
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def withdrawals(self, request):
        """
        Lista de retiros.
        GET /api/admin/finances/withdrawals/
        """
        withdrawals = Withdrawal.objects.select_related('seller').order_by('-requested_at')
        
        # Filtro por estado
        status_filter = request.query_params.get('status', 'all')
        if status_filter != 'all':
            withdrawals = withdrawals.filter(status=status_filter)
        
        data = []
        for withdrawal in withdrawals:
            data.append({
                'id': str(withdrawal.id),
                'seller': withdrawal.seller.username,
                'requested': float(withdrawal.amount_requested),
                'paypal_fee': float(withdrawal.paypal_fee_withdraw),
                'receives': float(withdrawal.amount_received) if withdrawal.amount_received else 0,
                'status': withdrawal.status,
                'requested_at': withdrawal.requested_at.isoformat(),
                'completed_at': withdrawal.completed_at.isoformat() if withdrawal.completed_at else None
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def transactions(self, request):
        """
        Libro contable global.
        GET /api/admin/finances/transactions/
        """
        transactions = BalanceTransaction.objects.select_related(
            'seller', 'order', 'withdrawal'
        ).order_by('-created_at')[:100]
        
        data = []
        for tx in transactions:
            reference = ''
            if tx.order:
                reference = tx.order.order_number
            elif tx.withdrawal:
                reference = f'WD-{str(tx.withdrawal.id)[:8]}'
            
            data.append({
                'id': str(tx.id),
                'date': tx.created_at.isoformat(),
                'type': tx.type,
                'seller': tx.seller.username,
                'reference': reference,
                'amount': float(tx.amount),
                'balance_before': float(tx.balance_before),
                'balance_after': float(tx.balance_after),
                'description': tx.description
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def reconciliation(self, request):
        """
        Cuadre automático.
        GET /api/admin/finances/reconciliation/
        """
        summary = BalanceService.get_lightcode_financial_summary()
        
        # Calcular cuadre
        total_received = float(summary['total_revenue'])
        paypal_fees = float(summary['paypal_fees_total'])
        seller_credited = float(summary['total_seller_credited'])
        lightcode_fees = float(summary['lightcode_fees_total'])
        
        total_withdrawn = float(summary['total_withdrawn'])
        withdrawal_fees = float(summary['withdrawal_fees_paid'])
        
        balance_owed = float(summary['total_owed'])
        expected_balance = total_received - paypal_fees - balance_owed
        actual_balance = expected_balance  # TODO: obtener de PayPal API
        
        matches = abs(expected_balance - actual_balance) < 0.01
        
        return Response({
            'total_received': total_received,
            'paypal_fees': paypal_fees,
            'seller_credited': seller_credited,
            'lightcode_fees': lightcode_fees,
            'total_withdrawn': total_withdrawn,
            'withdrawal_fees': withdrawal_fees,
            'balance_owed': balance_owed,
            'expected_balance': expected_balance,
            'actual_balance': actual_balance,
            'matches': matches,
            'difference': expected_balance - actual_balance
        })
