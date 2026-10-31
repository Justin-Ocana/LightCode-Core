"""
Serializers for notifications.
"""
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications."""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'message', 'data',
            'read', 'read_at', 'created_at',
            'order', 'store'
        ]
        read_only_fields = ['id', 'created_at']
