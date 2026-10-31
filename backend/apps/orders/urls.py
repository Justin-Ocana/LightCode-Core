from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrderViewSet, paypal_webhook,
    seller_dashboard_stats,
    process_pending_rcon_jobs
)

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    # Payment webhook
    path('webhook/paypal/', paypal_webhook, name='paypal-webhook'),
    
    # RCON processing endpoint
    path('process-pending-rcon-jobs/', process_pending_rcon_jobs, name='process-pending-rcon-jobs'),
    
    # Dashboard stats endpoint
    path('dashboard-stats/', seller_dashboard_stats, name='dashboard-stats'),
    
    # REST endpoints
    path('', include(router.urls)),
]



