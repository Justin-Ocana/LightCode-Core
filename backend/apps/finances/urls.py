"""
URLs para la API de finances.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'records', views.FinancialRecordViewSet, basename='financial-record')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')
router.register(r'reports', views.MonthlyReportViewSet, basename='monthly-report')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard-stats/', views.dashboard_stats, name='dashboard-stats'),
]
