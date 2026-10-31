from django.contrib import admin
from .models import Order, RCONJob, OrderStatusHistory, OrderNote, PayPalWebhookEvent
from .balance_models import SellerBalance, BalanceTransaction, Withdrawal, lightcodeEarnings
from .mod_models import ModCommand


@admin.register(PayPalWebhookEvent)
class PayPalWebhookEventAdmin(admin.ModelAdmin):
    list_display = ['event_id_short', 'event_type', 'processing_status', 'signature_verified', 'order_link', 'amount', 'created_at']
    list_filter = ['event_type', 'processing_status', 'signature_verified', 'created_at']
    search_fields = ['event_id', 'resource_id', 'paypal_order_id', 'payer_email', 'payee_email']
    readonly_fields = ['id', 'event_id', 'created_at', 'processed_at', 'raw_payload']
    ordering = ['-created_at']
    
    def event_id_short(self, obj):
        return obj.event_id[:20] + '...' if len(obj.event_id) > 20 else obj.event_id
    event_id_short.short_description = 'Event ID'
    
    def order_link(self, obj):
        if obj.order:
            from django.urls import reverse
            from django.utils.html import format_html
            url = reverse('admin:orders_order_change', args=[obj.order.id])
            return format_html('<a href="{}">{}</a>', url, obj.order.order_number)
        return '-'
    order_link.short_description = 'Order'
    
    fieldsets = (
        ('Evento', {
            'fields': ('id', 'event_id', 'event_type', 'event_version', 'created_at')
        }),
        ('Recurso', {
            'fields': ('resource_type', 'resource_id', 'paypal_order_id', 'order')
        }),
        ('Datos Financieros', {
            'fields': ('amount', 'currency', 'payer_email', 'payee_email')
        }),
        ('Verificación', {
            'fields': ('signature_verified', 'signature_verification_error', 'transmission_id', 'transmission_time', 'cert_url', 'auth_algo')
        }),
        ('Procesamiento', {
            'fields': ('processing_status', 'processing_error', 'processing_attempts', 'processed_at')
        }),
        ('Payload', {
            'fields': ('raw_payload',),
            'classes': ('collapse',)
        }),
    )


@admin.register(ModCommand)
class ModCommandAdmin(admin.ModelAdmin):
    list_display  = ['id', 'store', 'status', 'source', 'player', 'short_command', 'created_at']
    list_filter   = ['status', 'source', 'created_at']
    search_fields = ['command', 'player', 'store__slug']
    readonly_fields = ['id', 'created_at', 'updated_at', 'processing_at', 'completed_at']
    ordering = ['-created_at']

    def short_command(self, obj):
        return obj.command[:60]
    short_command.short_description = 'Comando'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'minecraft_username', 'status', 'delivery_method', 'seller_credited', 'created_at']
    list_filter = ['status', 'delivery_method', 'lightcode_plan', 'balance_credited', 'balance_released', 'created_at']
    search_fields = ['order_number', 'minecraft_username', 'buyer_paypal_email', 'paypal_transaction_id']
    readonly_fields = ['id', 'order_number', 'created_at', 'updated_at', 'payment_captured_at', 'delivered_at']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store', 'buyer', 'product', 'discount')
    
    fieldsets = (
        ('Identificación', {
            'fields': ('id', 'order_number', 'status', 'delivery_method')
        }),
        ('Relaciones', {
            'fields': ('store', 'buyer', 'product', 'discount')
        }),
        ('Comprador', {
            'fields': ('buyer_paypal_name', 'buyer_paypal_email', 'buyer_payer_id', 'paypal_transaction_id', 'paypal_order_id', 'payment_ip')
        }),
        ('Producto/Servidor', {
            'fields': ('minecraft_username', 'server_address', 'command_sent', 'product_snapshot')
        }),
        ('Desglose Financiero', {
            'fields': (
                'original_amount', 'discount_code', 'discount_type', 'discount_value', 'discount_amount_saved',
                'amount_after_discount', 'paypal_receive_fee', 'paypal_receive_fee_percent',
                'lightcode_fee', 'lightcode_fee_percent', 'lightcode_plan', 'seller_credited', 'currency'
            )
        }),
        ('Balance Interno', {
            'fields': ('balance_credited', 'balance_released')
        }),
        ('Notas', {
            'fields': ('seller_notes',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'delivered_at', 'payment_captured_at')
        }),
    )


@admin.register(RCONJob)
class RCONJobAdmin(admin.ModelAdmin):
    list_display = ['order', 'status', 'attempts', 'max_attempts', 'next_retry_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['order__order_number', 'server_host']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['order', 'from_status', 'to_status', 'changed_by', 'created_at']
    list_filter = ['to_status', 'created_at']
    search_fields = ['order__order_number']
    readonly_fields = ['created_at']


@admin.register(OrderNote)
class OrderNoteAdmin(admin.ModelAdmin):
    list_display = ['order', 'author', 'is_internal', 'created_at']
    list_filter = ['is_internal', 'created_at']
    search_fields = ['order__order_number', 'content']
    readonly_fields = ['created_at']


# Balance System Admin

@admin.register(SellerBalance)
class SellerBalanceAdmin(admin.ModelAdmin):
    list_display = ['seller', 'available_balance', 'pending_balance', 'total_earned', 'total_withdrawn', 'updated_at']
    list_filter = ['currency', 'updated_at']
    search_fields = ['seller__username', 'seller__email']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Vendedor', {
            'fields': ('seller',)
        }),
        ('Balances', {
            'fields': ('available_balance', 'pending_balance', 'total_earned', 'total_withdrawn', 'currency')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(BalanceTransaction)
class BalanceTransactionAdmin(admin.ModelAdmin):
    list_display = ['seller', 'type', 'amount', 'balance_after', 'created_at']
    list_filter = ['type', 'created_at']
    search_fields = ['seller__username', 'description', 'order__order_number']
    readonly_fields = ['id', 'created_at']
    
    fieldsets = (
        ('Transacción', {
            'fields': ('seller', 'type', 'amount', 'description')
        }),
        ('Referencias', {
            'fields': ('order', 'withdrawal')
        }),
        ('Balance', {
            'fields': ('balance_before', 'balance_after')
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at')
        }),
    )


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ['seller', 'amount_requested', 'amount_received', 'status', 'requested_at', 'completed_at']
    list_filter = ['status', 'requested_at']
    search_fields = ['seller__username', 'paypal_destination', 'paypal_transaction_id']
    readonly_fields = ['id', 'requested_at', 'processed_at', 'completed_at']
    
    fieldsets = (
        ('Vendedor', {
            'fields': ('seller', 'paypal_destination')
        }),
        ('Montos', {
            'fields': ('amount_requested', 'paypal_fee_withdraw', 'paypal_fee_rate', 'amount_received')
        }),
        ('Estado', {
            'fields': ('status', 'failure_reason', 'notes')
        }),
        ('PayPal', {
            'fields': ('paypal_transaction_id', 'paypal_batch_id')
        }),
        ('Procesamiento', {
            'fields': ('processed_by', 'requested_at', 'processed_at', 'completed_at')
        }),
    )


@admin.register(lightcodeEarnings)
class lightcodeEarningsAdmin(admin.ModelAdmin):
    list_display = ['order', 'seller', 'lightcode_fee_amount', 'seller_credited', 'lightcode_plan', 'created_at']
    list_filter = ['lightcode_plan', 'created_at']
    search_fields = ['order__order_number', 'seller__username']
    readonly_fields = ['id', 'created_at']
    
    fieldsets = (
        ('Orden', {
            'fields': ('order', 'seller')
        }),
        ('Desglose Financiero', {
            'fields': (
                'gross_payment', 'paypal_fee_receive', 'amount_after_paypal',
                'lightcode_fee_amount', 'seller_credited'
            )
        }),
        ('Plan y Comisión', {
            'fields': ('lightcode_plan', 'lightcode_fee_rate')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
