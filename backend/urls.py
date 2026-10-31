"""
URL configuration for backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from django.http import JsonResponse
from apps.orders.views import (
    store_create_paypal_order,
    store_capture_paypal_order,
    store_buyer_orders,
    store_buyer_order_detail,
    store_buyer_retry_rcon,
    create_direct_paypal_order,
    capture_direct_paypal_order,
    check_order_webhook_status,
    complete_direct_paypal_order,
    paypal_payment_return,
)

from apps.orders.mod_views import mc_test_page

def health_check(request):
    return JsonResponse({"status": "healthy", "environment": "production" if not settings.DEBUG else "development"})

urlpatterns = [
    # Health Check
    path('health/', health_check),
    
    # Admin
    path('admin/', admin.site.urls),
    
    # Admin API (lightcode Admin Panel)
    path('api/admin/', include('apps.orders.admin_urls')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # JWT Authentication
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Core (Image uploads, etc.)
    path('api/', include('core.urls')),
    
    # Users & Authentication
    path('api/users/', include('apps.users.urls')),
    
    # Stores
    path('api/stores/', include('apps.stores.urls')),
    
    # Products
    path('api/', include('apps.products.urls')),
    
    # Cart
    path('api/cart/', include('apps.cart.urls')),
    
    # Discounts
    path('api/discounts/', include('apps.discounts.urls')),
    
    # Admin Tools (RCON Lab)
    path('api/admin/', include('apps.admin_tools.urls')),
    
    # Orders
    path('api/orders/', include('apps.orders.urls')),
    
    # Finances (Contabilidad)
    path('api/finances/', include('apps.finances.urls')),
    
    # Notifications
    path('api/', include('apps.notifications.urls')),
    
    # Payment Integrations (PayPal Partner Referrals)
    path('api/', include('apps.payment_integrations.urls')),
    
    # Store-specific checkout endpoints (must be separate to avoid /api/orders/ prefix)
    path('api/stores/<slug:store_slug>/checkout/create-paypal-order/', 
         store_create_paypal_order, 
         name='store-create-paypal-order'),
    path('api/stores/<slug:store_slug>/checkout/capture-paypal-order/', 
         store_capture_paypal_order, 
         name='store-capture-paypal-order'),
    
    # NEW: Direct payment endpoints (no lightcode commission)
    path('api/stores/<slug:store_slug>/checkout/create-direct-paypal-order/',
         create_direct_paypal_order,
         name='store-create-direct-paypal-order'),
    path('api/stores/<slug:store_slug>/checkout/capture-direct-paypal-order/',
         capture_direct_paypal_order,
         name='store-capture-direct-paypal-order'),
    path('api/stores/<slug:store_slug>/checkout/paypal-return/',
         paypal_payment_return,
         name='store-paypal-return'),
    path('api/stores/<slug:store_slug>/checkout/check-webhook/<str:order_id>/',
         check_order_webhook_status,
         name='store-check-webhook-status'),
    path('api/stores/<slug:store_slug>/checkout/complete-direct-paypal-order/',
         complete_direct_paypal_order,
         name='store-complete-direct-paypal-order'),
    
    path('api/stores/<slug:store_slug>/orders/my-orders/', 
         store_buyer_orders, 
         name='store-buyer-orders'),
    path('api/stores/<slug:store_slug>/orders/<uuid:order_id>/', 
         store_buyer_order_detail, 
         name='store-buyer-order-detail'),
    path('api/stores/<slug:store_slug>/orders/<uuid:order_id>/retry-rcon/', 
         store_buyer_retry_rcon, 
         name='store-buyer-retry-rcon'),
    
    # Apps URLs (add as you implement them)
    # Payments & PlugsEssentials
    path('api/payments/', include('apps.payments.urls')),

    # lightcode Mod Delivery (PlugsEssentials)
    path('api/mc/', include('apps.orders.mod_urls')),

    # Página de prueba interna (URL secreta, no indexada)
    path('mc-internal/test/<str:token>/', mc_test_page, name='mc-test-page'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

