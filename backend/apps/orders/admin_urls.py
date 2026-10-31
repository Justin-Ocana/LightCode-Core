# apps/orders/admin_urls.py
"""
URLs para el panel de administración de lightcode.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .admin_views import (
    AdminDashboardViewSet,
    AdminUsersViewSet,
    AdminStoresViewSet,
    AdminFinancesViewSet
)

router = DefaultRouter()
router.register(r'dashboard', AdminDashboardViewSet, basename='admin-dashboard')
router.register(r'users', AdminUsersViewSet, basename='admin-users')
router.register(r'stores', AdminStoresViewSet, basename='admin-stores')
router.register(r'finances', AdminFinancesViewSet, basename='admin-finances')

urlpatterns = [
    path('', include(router.urls)),
]
