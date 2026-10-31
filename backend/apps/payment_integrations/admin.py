"""
Payment Integration Admin
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import PayPalConnection, StripeConnection, PaymentIntegrationLog


@admin.register(PayPalConnection)
class PayPalConnectionAdmin(admin.ModelAdmin):
    """Admin for PayPal connections."""
    
    list_display = [
        'store_name',
        'merchant_email',
        'status_badge',
        'connected_at',
        'expires_at',
        'needs_refresh_badge'
    ]
    
    list_filter = [
        'status',
        'merchant_email_verified',
        'connected_at',
    ]
    
    search_fields = [
        'store__name',
        'store__slug',
        'merchant_id',
        'merchant_email',
    ]
    
    readonly_fields = [
        'store',
        'merchant_id',
        'merchant_email',
        'merchant_email_verified',
        'access_token_encrypted',
        'refresh_token_encrypted',
        'token_type',
        'expires_at',
        'scope',
        'referral_link',
        'action_url',
        'partner_referral_id',
        'connected_at',
        'last_refreshed_at',
        'disconnected_at',
        'created_at',
        'updated_at',
        'last_error',
        'last_error_at',
    ]
    
    fieldsets = (
        ('Store', {
            'fields': ('store',)
        }),
        ('PayPal Account', {
            'fields': (
                'merchant_id',
                'merchant_email',
                'merchant_email_verified',
            )
        }),
        ('OAuth Tokens (Encrypted)', {
            'fields': (
                'access_token_encrypted',
                'refresh_token_encrypted',
                'token_type',
                'expires_at',
                'scope',
            ),
            'classes': ('collapse',)
        }),
        ('Onboarding', {
            'fields': (
                'referral_link',
                'action_url',
                'partner_referral_id',
            ),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': (
                'status',
                'connected_at',
                'last_refreshed_at',
                'disconnected_at',
            )
        }),
        ('Errors', {
            'fields': (
                'last_error',
                'last_error_at',
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at',
            )
        }),
    )
    
    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = 'Store'
    
    def status_badge(self, obj):
        colors = {
            'pending': 'orange',
            'connected': 'green',
            'expired': 'red',
            'revoked': 'gray',
            'error': 'red',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def needs_refresh_badge(self, obj):
        if obj.needs_refresh():
            return format_html('<span style="color: orange;">⚠️ Needs Refresh</span>')
        return format_html('<span style="color: green;">✓ Valid</span>')
    needs_refresh_badge.short_description = 'Token Status'


@admin.register(StripeConnection)
class StripeConnectionAdmin(admin.ModelAdmin):
    """Admin for Stripe connections (future)."""
    
    list_display = [
        'store',
        'stripe_account_id',
        'status',
        'connected_at',
    ]
    
    list_filter = ['status']
    search_fields = ['store__name', 'stripe_account_id']


@admin.register(PaymentIntegrationLog)
class PaymentIntegrationLogAdmin(admin.ModelAdmin):
    """Admin for payment integration logs."""
    
    list_display = [
        'created_at',
        'store_name',
        'provider_badge',
        'event_type',
        'message_short',
    ]
    
    list_filter = [
        'provider',
        'event_type',
        'created_at',
    ]
    
    search_fields = [
        'store__name',
        'store__slug',
        'message',
    ]
    
    readonly_fields = [
        'store',
        'provider',
        'event_type',
        'message',
        'metadata',
        'ip_address',
        'user_agent',
        'created_at',
    ]
    
    fieldsets = (
        ('Event', {
            'fields': (
                'store',
                'provider',
                'event_type',
                'message',
            )
        }),
        ('Metadata', {
            'fields': (
                'metadata',
                'ip_address',
                'user_agent',
            ),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = 'Store'
    
    def provider_badge(self, obj):
        colors = {
            'paypal': '#0070ba',
            'stripe': '#635bff',
            'mercadopago': '#00b1ea',
        }
        color = colors.get(obj.provider, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.provider.upper()
        )
    provider_badge.short_description = 'Provider'
    
    def message_short(self, obj):
        return obj.message[:100] + '...' if len(obj.message) > 100 else obj.message
    message_short.short_description = 'Message'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
