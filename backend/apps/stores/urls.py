"""
Store URL configuration.
"""
from django.urls import path
from . import views

app_name = 'stores'

urlpatterns = [
    # Endpoints principales que el frontend espera
    path('django/', views.store_list, name='store-list'),
    path('django/create/', views.store_create, name='store-create'),
    
    # Public endpoints (no authentication required)
    path('public/', views.store_list_public, name='store-list-public'),
    
    # Meta tags para bots (Discord, Facebook, etc.)
    path('meta/<slug:slug>/', views.store_meta_view, name='store-meta'),
    
    # Por slug (debe ir antes de <uuid> para evitar conflictos)
    path('slug/<slug:slug>/', views.store_by_slug, name='store-by-slug'),
    
    # Stats y settings (deben ir antes de <uuid> para evitar conflictos)
    path('<uuid:store_id>/stats/', views.store_stats, name='store-stats'),
    path('<uuid:store_id>/settings/', views.store_settings, name='store-settings'),
    path('<uuid:store_id>/restore/', views.store_restore, name='store-restore'),
    
    # RCON Configuration
    path('<uuid:store_id>/rcon/', views.rcon_get_config, name='rcon-get-config'),
    path('<uuid:store_id>/rcon/test/', views.rcon_test_connection, name='rcon-test'),
    path('<uuid:store_id>/rcon/save/', views.rcon_save_config, name='rcon-save'),
    path('<uuid:store_id>/rcon/delete/', views.rcon_delete_config, name='rcon-delete'),
    path('<uuid:store_id>/rcon/execute/', views.rcon_execute_command, name='rcon-execute'),
    path('<uuid:store_id>/rcon/test-delivery/', views.rcon_test_delivery, name='rcon-test-delivery'),
    
    # PayPal Configuration
    path('<uuid:store_id>/paypal/', views.paypal_config, name='paypal-config'),
    path('<uuid:store_id>/paypal/config/', views.paypal_config, name='paypal-config-alt'),
    path('<uuid:store_id>/paypal/config', views.paypal_config, name='paypal-config-no-slash'),
    
    # Check configurations
    path('<uuid:store_id>/check-config/', views.check_store_config, name='check-config'),
    
    # Buyer orders (public endpoint)
    path('<slug:slug>/orders/my-orders/', views.buyer_orders, name='buyer-orders'),
    path('<slug:slug>/orders/<uuid:order_id>/', views.buyer_order_detail, name='buyer-order-detail'),
    path('<slug:slug>/orders/<uuid:order_id>/retry-rcon/', views.buyer_retry_rcon, name='buyer-retry-rcon'),
    
    # CRUD por ID (GET, PATCH, DELETE en la misma ruta)
    path('<uuid:store_id>/', views.store_detail, name='store-detail'),
]
