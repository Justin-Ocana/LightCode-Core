"""
Serializers para la API de finances.
"""
from rest_framework import serializers
from .models import FinancialRecord, Transaction, PaymentBreakdown, MonthlyReport


class PaymentBreakdownSerializer(serializers.ModelSerializer):
    """Serializer para desglose de pagos."""
    
    total_fees = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    fee_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    
    class Meta:
        model = PaymentBreakdown
        fields = [
            'gross_amount', 'paypal_fee', 'paypal_fee_percentage',
            'lightcode_fee', 'lightcode_fee_percentage', 'seller_plan',
            'net_amount', 'discount_code', 'discount_amount',
            'total_fees', 'fee_percentage', 'created_at'
        ]


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer para transacciones individuales."""
    
    breakdown = PaymentBreakdownSerializer(read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Información de la orden relacionada
    order_number = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    minecraft_username = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_type', 'transaction_type_display',
            'payment_method', 'payment_method_display',
            'status', 'status_display',
            'external_transaction_id', 'external_order_id',
            'gross_amount', 'currency', 'transaction_date',
            'order_number', 'product_name', 'minecraft_username',
            'breakdown', 'metadata', 'created_at'
        ]
    
    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else None
    
    def get_product_name(self, obj):
        if obj.order and obj.order.product_snapshot:
            return obj.order.product_snapshot.get('name', 'Unknown')
        return obj.metadata.get('product_name', 'Unknown')
    
    def get_minecraft_username(self, obj):
        if obj.order:
            return obj.order.minecraft_username
        return obj.metadata.get('minecraft_username', 'Unknown')


class FinancialRecordSerializer(serializers.ModelSerializer):
    """Serializer para el registro financiero del seller."""
    
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    average_transaction = serializers.SerializerMethodField()
    success_rate = serializers.SerializerMethodField()
    
    class Meta:
        model = FinancialRecord
        fields = [
            'id', 'seller_username',
            'total_gross_revenue', 'total_fees_paid', 'total_net_revenue',
            'total_transactions', 'successful_transactions',
            'average_transaction', 'success_rate',
            'created_at', 'updated_at'
        ]
    
    def get_average_transaction(self, obj):
        if obj.total_transactions > 0:
            return float(obj.total_gross_revenue / obj.total_transactions)
        return 0.0
    
    def get_success_rate(self, obj):
        if obj.total_transactions > 0:
            return round((obj.successful_transactions / obj.total_transactions) * 100, 2)
        return 0.0


class MonthlyReportSerializer(serializers.ModelSerializer):
    """Serializer para reportes mensuales."""
    
    month_name = serializers.SerializerMethodField()
    average_transaction = serializers.SerializerMethodField()
    
    class Meta:
        model = MonthlyReport
        fields = [
            'id', 'year', 'month', 'month_name',
            'total_transactions', 'successful_transactions',
            'gross_revenue', 'total_fees', 'net_revenue',
            'paypal_fees', 'lightcode_fees',
            'average_transaction', 'created_at'
        ]
    
    def get_month_name(self, obj):
        months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]
        return months[obj.month - 1]
    
    def get_average_transaction(self, obj):
        if obj.total_transactions > 0:
            return float(obj.gross_revenue / obj.total_transactions)
        return 0.0


class FinancialSummarySerializer(serializers.Serializer):
    """Serializer para resumen financiero completo."""
    
    # Totales
    total_gross_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_fees_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_net_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    
    # Contadores
    total_transactions = serializers.IntegerField()
    successful_transactions = serializers.IntegerField()
    
    # Promedios
    average_transaction = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    # Desglose de fees
    total_paypal_fees = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_lightcode_fees = serializers.DecimalField(max_digits=12, decimal_places=2)
    
    # Período
    period_start = serializers.DateTimeField(required=False)
    period_end = serializers.DateTimeField(required=False)
