from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    # PlugsEssentials Subscriptions
    path('plugsessentials/create-subscription/', views.create_subscription, name='create_subscription'),
    path('plugsessentials/subscription/', views.get_subscription, name='get_subscription'),
    path('plugsessentials/download/', views.download_pack, name='download_pack'),
    path('plugsessentials/cancel/', views.cancel_subscription, name='cancel_subscription'),
    
    # Free Download with Token System
    # IMPORTANTE: Este endpoint debe ser accesible sin autenticación desde Linkvertise
    path('plugsessentials/linkvertise-redirect/', views.redirect_to_download_with_token, name='linkvertise_redirect'),
    path('plugsessentials/generate-token/', views.generate_free_download_token, name='generate_free_download_token'),
    path('plugsessentials/download-free/', views.download_free_pack, name='download_free_pack'),
    path('plugsessentials/validate-token/', views.validate_download_token, name='validate_download_token'),
    
    # PayPal Webhook
    path('webhooks/paypal/', views.paypal_webhook, name='paypal_webhook'),
]
