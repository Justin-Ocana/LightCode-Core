"""
Payment Integration URLs
"""
from django.urls import path
from . import views, oauth_views

app_name = 'payment_integrations'

urlpatterns = [
    # List all payment methods
    path(
        'stores/<slug:store_slug>/payment-integrations/methods',
        views.list_payment_methods,
        name='list_payment_methods'
    ),
    
    # PayPal OAuth endpoints (NEW - recommended)
    path(
        'stores/<slug:store_slug>/payment-integrations/paypal/oauth/connect',
        oauth_views.initiate_paypal_oauth,
        name='paypal_oauth_connect'
    ),
    path(
        'stores/<slug:store_slug>/payment-integrations/paypal/oauth/complete',
        oauth_views.complete_paypal_oauth,
        name='paypal_oauth_complete'
    ),
    path(
        'stores/<slug:store_slug>/payment-integrations/paypal/status',
        oauth_views.get_paypal_status,
        name='paypal_status'
    ),
    path(
        'stores/<slug:store_slug>/payment-integrations/paypal/disconnect',
        oauth_views.disconnect_paypal,
        name='paypal_disconnect'
    ),
    
    # PayPal Partner endpoints (OLD - requires Partner approval)
    path(
        'stores/<slug:store_slug>/payment-integrations/paypal/partner/connect',
        views.initiate_paypal_connection,
        name='paypal_partner_connect'
    ),
    path(
        'stores/<slug:store_slug>/payment-integrations/paypal/partner/complete',
        views.complete_paypal_connection,
        name='paypal_partner_complete'
    ),
    
    # Webhook endpoint
    path(
        'webhooks/paypal/',
        views.paypal_webhook,
        name='paypal_webhook'
    ),
]
