"""
Admin para el sistema de finances.
"""
from django.contrib import admin
from .models import FinancialRecord, Transaction, PaymentBreakdown, MonthlyReport


@admin.register(FinancialRecord)
class FinancialRecordAdmin(admin.ModelAdmin):
    list_display = ['seller', 'total_gross_revenue', 'total_net_revenue', 'total_transactions', 'updated_at']
    search_fields = ['seller__username', 'seller__email']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Seller', {
            'fields': ('seller',)
        }),
        ('Totales', {
            'fields': ('total_gross_revenue', 'total_fees_paid', 'total_net_revenue')
        }),
        ('Contadores', {
            'fields': ('total_transactions', 'successful_transactions')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


class PaymentBreakdownInline(admin.StackedInline):
    model = PaymentBreakdown
    extra = 0
    readonly_fields = ['created_at']


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'financial_record', 'transaction_type', 'gross_amount', 'status', 'transaction_date']
    list_filter = ['transaction_type', 'payment_method', 'status', 'transaction_date']
    search_fields = ['external_transaction_id', 'external_order_id', 'financial_record__seller__username']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [PaymentBreakdownInline]
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('financial_record', 'order', 'transaction_type', 'payment_method', 'status')
        }),
        ('IDs Externos', {
            'fields': ('external_transaction_id', 'external_order_id')
        }),
        ('Montos', {
            'fields': ('gross_amount', 'currency')
        }),
        ('Fechas', {
            'fields': ('transaction_date', 'created_at', 'updated_at')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )


@admin.register(PaymentBreakdown)
class PaymentBreakdownAdmin(admin.ModelAdmin):
    list_display = ['transaction', 'gross_amount', 'paypal_fee', 'lightcode_fee', 'net_amount', 'seller_plan']
    list_filter = ['seller_plan']
    search_fields = ['transaction__external_transaction_id']
    readonly_fields = ['created_at', 'total_fees', 'fee_percentage']
    
    fieldsets = (
        ('Transacción', {
            'fields': ('transaction',)
        }),
        ('Montos', {
            'fields': ('gross_amount', 'net_amount')
        }),
        ('Fees PayPal', {
            'fields': ('paypal_fee', 'paypal_fee_percentage')
        }),
        ('Fees lightcode', {
            'fields': ('lightcode_fee', 'lightcode_fee_percentage', 'seller_plan')
        }),
        ('Descuentos', {
            'fields': ('discount_code', 'discount_amount')
        }),
        ('Calculados', {
            'fields': ('total_fees', 'fee_percentage', 'created_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MonthlyReport)
class MonthlyReportAdmin(admin.ModelAdmin):
    list_display = ['financial_record', 'year', 'month', 'gross_revenue', 'net_revenue', 'total_transactions']
    list_filter = ['year', 'month']
    search_fields = ['financial_record__seller__username']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Período', {
            'fields': ('financial_record', 'year', 'month')
        }),
        ('Estadísticas', {
            'fields': ('total_transactions', 'successful_transactions')
        }),
        ('Montos', {
            'fields': ('gross_revenue', 'total_fees', 'net_revenue')
        }),
        ('Desglose de Fees', {
            'fields': ('paypal_fees', 'lightcode_fees')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
