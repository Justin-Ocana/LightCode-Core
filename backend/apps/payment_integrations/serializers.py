"""
Payment Integration Serializers
"""
from rest_framework import serializers
from .models import PayPalConnection, PaymentIntegrationLog


class PayPalConnectionSerializer(serializers.ModelSerializer):
    """Serializer for PayPal connection (safe fields only)."""
    
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    is_token_expired = serializers.BooleanField(read_only=True)
    needs_refresh = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PayPalConnection
        fields = [
            'id',
            'store_name',
            'store_slug',
            'merchant_id',
            'merchant_email',
            'merchant_email_verified',
            'status',
            'connected_at',
            'last_refreshed_at',
            'expires_at',
            'is_token_expired',
            'needs_refresh',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class PaymentIntegrationLogSerializer(serializers.ModelSerializer):
    """Serializer for payment integration logs."""
    
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = PaymentIntegrationLog
        fields = [
            'id',
            'store_name',
            'provider',
            'event_type',
            'message',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields
