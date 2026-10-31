"""
Store admin configuration.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import Store, StoreSettings


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    """Admin interface for Store model."""
    
    list_display = [
        'name',
        'slug',
        'owner_link',
        'status_badge',
        'verified_badge',
        'total_products',
        'total_orders',
        'views_count',
        'created_at',
    ]
    
    list_filter = [
        'status',
        'is_verified',
        'is_deleted',
        'currency',
        'language',
        'created_at',
    ]
    
    search_fields = [
        'name',
        'slug',
        'owner__username',
        'owner__email',
        'description',
    ]
    
    readonly_fields = [
        'id',
        'slug',
        'created_at',
        'updated_at',
        'deleted_at',
        'total_products',
        'total_orders',
        'total_revenue',
        'total_buyers',
        'views_count',
        'last_order_at',
    ]
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'id',
                'owner',
                'name',
                'slug',
                'description',
                'tagline',
            )
        }),
        ('Branding', {
            'fields': (
                'logo',
                'banner',
                'favicon',
                'primary_color',
                'secondary_color',
            )
        }),
        ('Configuración', {
            'fields': (
                'currency',
                'timezone',
                'language',
            )
        }),
        ('Contacto', {
            'fields': (
                'email',
                'phone',
                'website',
                'discord_invite',
                'twitter_handle',
                'instagram_handle',
            )
        }),
        ('Minecraft', {
            'fields': (
                'minecraft_server_ip',
                'minecraft_server_port',
                'minecraft_version',
            ),
            'classes': ('collapse',),
        }),
        ('Estado', {
            'fields': (
                'status',
                'is_verified',
                'verified_at',
            )
        }),
        ('SEO', {
            'fields': (
                'meta_title',
                'meta_description',
                'meta_keywords',
            ),
            'classes': ('collapse',),
        }),
        ('Estadísticas', {
            'fields': (
                'total_products',
                'total_orders',
                'total_revenue',
                'total_buyers',
                'views_count',
                'last_order_at',
            ),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at',
                'deleted_at',
            ),
            'classes': ('collapse',),
        }),
    )
    
    actions = ['verify_stores', 'suspend_stores', 'activate_stores']
    
    def owner_link(self, obj):
        """Link to owner's admin page."""
        url = reverse('admin:users_user_change', args=[obj.owner.id])
        return format_html('<a href="{}">{}</a>', url, obj.owner.username)
    owner_link.short_description = 'Owner'
    
    def status_badge(self, obj):
        """Display status as colored badge."""
        colors = {
            'active': 'green',
            'inactive': 'gray',
            'suspended': 'red',
            'maintenance': 'orange',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def verified_badge(self, obj):
        """Display verification status."""
        if obj.is_verified:
            return format_html(
                '<span style="color: green;">✓ Verified</span>'
            )
        return format_html(
            '<span style="color: gray;">✗ Not Verified</span>'
        )
    verified_badge.short_description = 'Verified'
    
    def verify_stores(self, request, queryset):
        """Bulk action to verify stores."""
        count = 0
        for store in queryset:
            if not store.is_verified:
                store.is_verified = True
                store.verified_at = timezone.now()
                store.save(update_fields=['is_verified', 'verified_at'])
                count += 1
        
        self.message_user(request, f'{count} store(s) verified successfully.')
    verify_stores.short_description = 'Verify selected stores'
    
    def suspend_stores(self, request, queryset):
        """Bulk action to suspend stores."""
        count = queryset.update(status='suspended')
        self.message_user(request, f'{count} store(s) suspended.')
    suspend_stores.short_description = 'Suspend selected stores'
    
    def activate_stores(self, request, queryset):
        """Bulk action to activate stores."""
        count = queryset.update(status='active')
        self.message_user(request, f'{count} store(s) activated.')
    activate_stores.short_description = 'Activate selected stores'


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    """Admin interface for StoreSettings model."""
    
    list_display = [
        'store',
        'email_notifications',
        'discord_notifications',
        'auto_deliver',
        'tax_rate',
    ]
    
    list_filter = [
        'email_notifications',
        'discord_notifications',
        'auto_deliver',
        'require_minecraft_verification',
        'allow_guest_checkout',
    ]
    
    search_fields = [
        'store__name',
        'store__slug',
    ]
    
    fieldsets = (
        ('Store', {
            'fields': ('store',)
        }),
        ('Notifications', {
            'fields': (
                'email_notifications',
                'discord_notifications',
                'discord_webhook_url',
            )
        }),
        ('Orders', {
            'fields': (
                'auto_deliver',
                'require_minecraft_verification',
                'allow_guest_checkout',
            )
        }),
        ('Payment', {
            'fields': (
                'payment_methods',
                'tax_rate',
            )
        }),
        ('Policies', {
            'fields': (
                'terms_of_service',
                'refund_policy',
                'privacy_policy',
            ),
            'classes': ('collapse',),
        }),
        ('Advanced', {
            'fields': ('advanced_settings',),
            'classes': ('collapse',),
        }),
    )
