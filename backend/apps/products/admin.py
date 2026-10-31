"""
Product admin - Panel de administración.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import Product, ProductCommand, DeliveryQueue, ProductCategory


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    """Admin para categorías de productos."""
    
    list_display = [
        'icon_display',
        'name',
        'slug',
        'is_default',
        'store',
        'products_count',
        'sort_order',
        'created_at',
    ]
    
    list_filter = [
        'is_default',
        'created_at',
    ]
    
    search_fields = [
        'name',
        'slug',
        'description',
        'store__name',
    ]
    
    readonly_fields = [
        'id',
        'products_count',
        'created_at',
        'updated_at',
    ]
    
    fieldsets = [
        ('Información Básica', {
            'fields': [
                'id',
                'name',
                'slug',
                'description',
                'icon',
            ]
        }),
        ('Configuración', {
            'fields': [
                'is_default',
                'store',
                'sort_order',
            ]
        }),
        ('Estadísticas', {
            'fields': [
                'products_count',
            ]
        }),
        ('Metadata', {
            'fields': [
                'created_at',
                'updated_at',
            ],
            'classes': ['collapse'],
        }),
    ]
    
    def icon_display(self, obj):
        """Mostrar icono."""
        return obj.icon if obj.icon else '-'
    icon_display.short_description = 'Icon'
    
    def products_count(self, obj):
        """Número de productos en esta categoría."""
        return obj.products.filter(is_deleted=False).count()
    products_count.short_description = 'Products'


class ProductCommandInline(admin.TabularInline):
    """Inline para comandos de producto."""
    model = ProductCommand
    extra = 1
    fields = ['event', 'command', 'order']
    ordering = ['event', 'order']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    """Admin para productos."""
    
    list_display = [
        'name',
        'store',
        'category',
        'price',
        'status',
        'total_sold',
        'is_available',
        'created_at',
    ]
    
    list_filter = [
        'status',
        'category',
        'purchase_type',
        'delivery_mode',
        'is_deleted',
        'created_at',
    ]
    
    search_fields = [
        'name',
        'description',
        'store__name',
        'store__slug',
    ]
    
    readonly_fields = [
        'id',
        'total_sold',
        'is_available',
        'image_preview',
        'created_at',
        'updated_at',
    ]
    
    fieldsets = [
        ('Información Básica', {
            'fields': [
                'id',
                'store',
                'name',
                'description',
                'image',
                'image_preview',
                'price',
            ]
        }),
        ('Categorización', {
            'fields': [
                'category',
                'purchase_type',
                'subscription_interval',
            ]
        }),
        ('Límites', {
            'fields': [
                'global_limit',
                'per_player_limit',
            ]
        }),
        ('Configuración de Entrega', {
            'fields': [
                'require_online',
                'command_delay',
                'delivery_mode',
            ]
        }),
        ('Estado', {
            'fields': [
                'status',
                'sort_order',
                'total_sold',
                'is_available',
            ]
        }),
        ('Metadata', {
            'fields': [
                'created_at',
                'updated_at',
                'is_deleted',
                'deleted_at',
            ],
            'classes': ['collapse'],
        }),
    ]
    
    inlines = [ProductCommandInline]
    
    actions = ['activate_products', 'deactivate_products', 'mark_as_draft']
    
    def image_preview(self, obj):
        """Preview de la imagen."""
        if obj.image:
            url = obj.get_image_url()
            if url:
                return format_html(
                    '<img src="{}" style="max-width: 200px; max-height: 200px;" />',
                    url
                )
        return '-'
    image_preview.short_description = 'Preview'
    
    def activate_products(self, request, queryset):
        """Activar productos."""
        updated = queryset.update(status='ACTIVE')
        self.message_user(request, f'{updated} productos activados.')
    activate_products.short_description = 'Activar productos seleccionados'
    
    def deactivate_products(self, request, queryset):
        """Desactivar productos."""
        updated = queryset.update(status='INACTIVE')
        self.message_user(request, f'{updated} productos desactivados.')
    deactivate_products.short_description = 'Desactivar productos seleccionados'
    
    def mark_as_draft(self, request, queryset):
        """Marcar como borrador."""
        updated = queryset.update(status='DRAFT')
        self.message_user(request, f'{updated} productos marcados como borrador.')
    mark_as_draft.short_description = 'Marcar como borrador'


@admin.register(ProductCommand)
class ProductCommandAdmin(admin.ModelAdmin):
    """Admin para comandos."""
    
    list_display = [
        'product',
        'event',
        'command_preview',
        'order',
        'created_at',
    ]
    
    list_filter = [
        'event',
        'created_at',
    ]
    
    search_fields = [
        'product__name',
        'command',
    ]
    
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = [
        ('Comando', {
            'fields': [
                'id',
                'product',
                'event',
                'command',
                'order',
            ]
        }),
        ('Metadata', {
            'fields': [
                'created_at',
                'updated_at',
            ],
            'classes': ['collapse'],
        }),
    ]
    
    def command_preview(self, obj):
        """Preview del comando."""
        if len(obj.command) > 50:
            return obj.command[:50] + '...'
        return obj.command
    command_preview.short_description = 'Comando'


@admin.register(DeliveryQueue)
class DeliveryQueueAdmin(admin.ModelAdmin):
    """Admin para cola de entrega."""
    
    list_display = [
        'id',
        'order_id',
        'status',
        'attempts',
        'command_preview',
        'delivered_at',
        'created_at',
    ]
    
    list_filter = [
        'status',
        'attempts',
        'created_at',
        'delivered_at',
    ]
    
    search_fields = [
        'order_id',
        'command',
        'error_message',
    ]
    
    readonly_fields = [
        'id',
        'order_id',
        'command',
        'attempts',
        'last_attempt_at',
        'delivered_at',
        'created_at',
        'updated_at',
    ]
    
    fieldsets = [
        ('Entrega', {
            'fields': [
                'id',
                'order_id',
                'command',
                'status',
            ]
        }),
        ('Tracking', {
            'fields': [
                'attempts',
                'last_attempt_at',
                'delivered_at',
                'error_message',
            ]
        }),
        ('Metadata', {
            'fields': [
                'created_at',
                'updated_at',
            ],
            'classes': ['collapse'],
        }),
    ]
    
    actions = ['retry_delivery', 'mark_as_delivered', 'mark_as_skipped']
    
    def command_preview(self, obj):
        """Preview del comando."""
        if len(obj.command) > 50:
            return obj.command[:50] + '...'
        return obj.command
    command_preview.short_description = 'Comando'
    
    def retry_delivery(self, request, queryset):
        """Reintentar entrega."""
        for item in queryset:
            item.retry()
        self.message_user(request, f'{queryset.count()} entregas reintentadas.')
    retry_delivery.short_description = 'Reintentar entrega'
    
    def mark_as_delivered(self, request, queryset):
        """Marcar como entregado."""
        for item in queryset:
            item.mark_as_delivered()
        self.message_user(request, f'{queryset.count()} entregas marcadas como entregadas.')
    mark_as_delivered.short_description = 'Marcar como entregado'
    
    def mark_as_skipped(self, request, queryset):
        """Marcar como omitido."""
        for item in queryset:
            item.mark_as_skipped('Marcado manualmente por admin')
        self.message_user(request, f'{queryset.count()} entregas marcadas como omitidas.')
    mark_as_skipped.short_description = 'Marcar como omitido'
