from django.contrib import admin
from .models import (
    PlugsEssentialsSubscription,
    PlugsEssentialsDownload,
    AuthorizedServer,
    PayPalWebhookEvent
)


@admin.register(PlugsEssentialsSubscription)
class PlugsEssentialsSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'tier', 'status', 'downloads_this_month', 'next_billing_date', 'created_at']
    list_filter = ['tier', 'status', 'created_at']
    search_fields = ['user__username', 'user__email', 'paypal_subscription_id']
    readonly_fields = ['created_at', 'updated_at', 'paypal_subscription_id']


@admin.register(PlugsEssentialsDownload)
class PlugsEssentialsDownloadAdmin(admin.ModelAdmin):
    list_display = ['subscription', 'pack_type', 'downloaded_at', 'ip_address']
    list_filter = ['pack_type', 'downloaded_at']
    search_fields = ['subscription__user__username']
    readonly_fields = ['downloaded_at']


@admin.register(AuthorizedServer)
class AuthorizedServerAdmin(admin.ModelAdmin):
    list_display = ['name', 'server_code', 'subscription', 'created_at', 'last_seen']
    search_fields = ['name', 'server_code', 'subscription__user__username']
    readonly_fields = ['created_at']


@admin.register(PayPalWebhookEvent)
class PayPalWebhookEventAdmin(admin.ModelAdmin):
    list_display = ['event_id', 'event_type', 'resource_type', 'processed', 'created_at']
    list_filter = ['event_type', 'processed', 'created_at']
    search_fields = ['event_id', 'resource_id']
    readonly_fields = ['created_at', 'processed_at', 'payload']

