"""
URLs for user authentication.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, ProfileView, ChangePasswordView
from .buyer_views import (
    BuyerProfileView,
    BuyerChangePasswordView,
    BuyerOrdersView,
    BuyerSettingsView,
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')

urlpatterns = [
    path('', include(router.urls)),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    
    # Buyer-specific endpoints
    path('auth/buyer/profile/', BuyerProfileView.as_view(), name='buyer-profile'),
    path('auth/buyer/change-password/', BuyerChangePasswordView.as_view(), name='buyer-change-password'),
    path('auth/buyer/orders/', BuyerOrdersView.as_view(), name='buyer-orders'),
    path('auth/buyer/settings/', BuyerSettingsView.as_view(), name='buyer-settings'),
]
