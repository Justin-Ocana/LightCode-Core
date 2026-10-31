"""
Views para la API de finances.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import FinancialRecord, Transaction, PaymentBreakdown, MonthlyReport
from .serializers import (
    FinancialRecordSerializer, TransactionSerializer,
    PaymentBreakdownSerializer, MonthlyReportSerializer,
    FinancialSummarySerializer
)
from .services import TransactionProcessor


class FinancialRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para consultar registros financieros.
    Solo lectura - los registros se crean automáticamente.
    """
    
    serializer_class = FinancialRecordSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Solo el seller puede ver su propio registro."""
        return FinancialRecord.objects.filter(seller=self.request.user)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Obtiene el resumen financiero del seller actual.
        
        GET /api/finances/summary/
        """
        summary = TransactionProcessor.get_seller_summary(request.user)
        serializer = FinancialSummarySerializer(summary)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def period_summary(self, request):
        """
        Obtiene resumen financiero para un período específico.
        
        GET /api/finances/period-summary/?start=2024-01-01&end=2024-12-31
        """
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'Se requieren parámetros start y end'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            financial_record = FinancialRecord.objects.get(seller=request.user)
        except FinancialRecord.DoesNotExist:
            return Response({
                'total_gross_revenue': 0,
                'total_fees_paid': 0,
                'total_net_revenue': 0,
                'total_transactions': 0,
                'successful_transactions': 0,
                'average_transaction': 0,
                'total_paypal_fees': 0,
                'total_lightcode_fees': 0,
                'period_start': start_date,
                'period_end': end_date
            })
        
        # Filtrar transacciones por período
        transactions = Transaction.objects.filter(
            financial_record=financial_record,
            transaction_date__gte=start_date,
            transaction_date__lte=end_date,
            status=Transaction.Status.COMPLETED
        )
        
        # Calcular totales
        totals = transactions.aggregate(
            total_gross=Sum('gross_amount'),
            total_count=Count('id')
        )
        
        # Calcular fees
        breakdowns = PaymentBreakdown.objects.filter(
            transaction__in=transactions
        ).aggregate(
            total_paypal=Sum('paypal_fee'),
            total_lightcode=Sum('lightcode_fee'),
            total_net=Sum('net_amount')
        )
        
        summary = {
            'total_gross_revenue': totals['total_gross'] or Decimal('0.00'),
            'total_fees_paid': (breakdowns['total_paypal'] or Decimal('0.00')) + (breakdowns['total_lightcode'] or Decimal('0.00')),
            'total_net_revenue': breakdowns['total_net'] or Decimal('0.00'),
            'total_transactions': totals['total_count'] or 0,
            'successful_transactions': totals['total_count'] or 0,
            'average_transaction': (totals['total_gross'] / totals['total_count']) if totals['total_count'] > 0 else Decimal('0.00'),
            'total_paypal_fees': breakdowns['total_paypal'] or Decimal('0.00'),
            'total_lightcode_fees': breakdowns['total_lightcode'] or Decimal('0.00'),
            'period_start': start_date,
            'period_end': end_date
        }
        
        serializer = FinancialSummarySerializer(summary)
        return Response(serializer.data)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para consultar transacciones.
    Solo lectura - las transacciones se crean automáticamente.
    """
    
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Solo el seller puede ver sus propias transacciones."""
        try:
            financial_record = FinancialRecord.objects.get(seller=self.request.user)
            return Transaction.objects.filter(financial_record=financial_record)
        except FinancialRecord.DoesNotExist:
            return Transaction.objects.none()
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """
        Obtiene las transacciones más recientes.
        
        GET /api/finances/transactions/recent/?limit=10
        """
        limit = int(request.query_params.get('limit', 10))
        transactions = self.get_queryset()[:limit]
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)


class MonthlyReportViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para consultar reportes mensuales.
    """
    
    serializer_class = MonthlyReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Solo el seller puede ver sus propios reportes."""
        try:
            financial_record = FinancialRecord.objects.get(seller=self.request.user)
            return MonthlyReport.objects.filter(financial_record=financial_record)
        except FinancialRecord.DoesNotExist:
            return MonthlyReport.objects.none()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Obtiene estadísticas para el dashboard del seller.
    Solo cuenta transacciones de órdenes ENTREGADAS (delivered).
    
    GET /api/finances/dashboard-stats/
    """
    try:
        financial_record = FinancialRecord.objects.get(seller=request.user)
    except FinancialRecord.DoesNotExist:
        return Response({
            'today': {'revenue': 0, 'transactions': 0},
            'this_week': {'revenue': 0, 'transactions': 0},
            'this_month': {'revenue': 0, 'transactions': 0},
            'all_time': {'revenue': 0, 'transactions': 0}
        })
    
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    # IMPORTANTE: Solo contar transacciones de órdenes ENTREGADAS
    # Hoy
    today_trans = Transaction.objects.filter(
        financial_record=financial_record,
        transaction_date__gte=today_start,
        status=Transaction.Status.COMPLETED,
        order__status='delivered'  # Solo órdenes entregadas
    )
    today_breakdown = PaymentBreakdown.objects.filter(
        transaction__in=today_trans
    ).aggregate(total=Sum('gross_amount'))  # CAMBIADO: usar gross_amount en lugar de net_amount
    
    # Esta semana
    week_trans = Transaction.objects.filter(
        financial_record=financial_record,
        transaction_date__gte=week_start,
        status=Transaction.Status.COMPLETED,
        order__status='delivered'  # Solo órdenes entregadas
    )
    week_breakdown = PaymentBreakdown.objects.filter(
        transaction__in=week_trans
    ).aggregate(total=Sum('gross_amount'))  # CAMBIADO: usar gross_amount en lugar de net_amount
    
    # Este mes
    month_trans = Transaction.objects.filter(
        financial_record=financial_record,
        transaction_date__gte=month_start,
        status=Transaction.Status.COMPLETED,
        order__status='delivered'  # Solo órdenes entregadas
    )
    month_breakdown = PaymentBreakdown.objects.filter(
        transaction__in=month_trans
    ).aggregate(total=Sum('gross_amount'))  # CAMBIADO: usar gross_amount en lugar de net_amount
    
    # Todo el tiempo - solo órdenes entregadas
    all_time_trans = Transaction.objects.filter(
        financial_record=financial_record,
        status=Transaction.Status.COMPLETED,
        order__status='delivered'  # Solo órdenes entregadas
    )
    all_time_breakdown = PaymentBreakdown.objects.filter(
        transaction__in=all_time_trans
    ).aggregate(total=Sum('gross_amount'))  # CAMBIADO: usar gross_amount en lugar de net_amount
    
    return Response({
        'today': {
            'revenue': float(today_breakdown['total'] or 0),
            'transactions': today_trans.count()
        },
        'this_week': {
            'revenue': float(week_breakdown['total'] or 0),
            'transactions': week_trans.count()
        },
        'this_month': {
            'revenue': float(month_breakdown['total'] or 0),
            'transactions': month_trans.count()
        },
        'all_time': {
            'revenue': float(all_time_breakdown['total'] or 0),
            'transactions': all_time_trans.count()
        }
    })
