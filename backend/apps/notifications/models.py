"""
Notification models for real-time updates.
"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class Notification(models.Model):
    """
    Notification model for storing user notifications.
    """
    
    class Type(models.TextChoices):
        NEW_ORDER = 'new_order', 'Nueva Orden'
        ORDER_DELIVERED = 'order_delivered', 'Orden Entregada'
        ORDER_FAILED = 'order_failed', 'Orden Fallida'
        PAYMENT_RECEIVED = 'payment_received', 'Pago Recibido'
        LOW_STOCK = 'low_stock', 'Stock Bajo'
        SERVER_OFFLINE = 'server_offline', 'Servidor Offline'
        SYSTEM = 'system', 'Sistema'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=Type.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Optional related objects
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, null=True, blank=True)
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, null=True, blank=True)
    
    # Metadata
    data = models.JSONField(default=dict, blank=True)
    
    # Status
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'read']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"
