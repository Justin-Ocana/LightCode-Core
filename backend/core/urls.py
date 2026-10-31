"""
Core URLs for common functionality.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ImageUploadViewSet

router = DefaultRouter()
router.register(r'images', ImageUploadViewSet, basename='images')

urlpatterns = [
    path('', include(router.urls)),
]
