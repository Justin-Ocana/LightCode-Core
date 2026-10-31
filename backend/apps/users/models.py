"""
Simplified User models for white-label store.

Architecture:
- Seller: Admin user (manages the dashboard)
- Buyer: Customer user (buys products from the store)
"""
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import RegexValidator
from core.mixins import TimestampMixin, SoftDeleteMixin
import uuid


class User(AbstractUser, TimestampMixin):
    """
    Simplified User model - Only seller (admin) and buyer (customer).
    """
    USER_TYPE_CHOICES = [
        ('seller', 'Seller'),  # Admin del dashboard
        ('buyer', 'Buyer'),    # Cliente/comprador
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(
        max_length=30,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9._]{3,30}$',
                message='Username must be 3-30 characters and can only contain letters, numbers, dots, and underscores.'
            )
        ]
    )
    email = models.EmailField(max_length=254)
    user_type = models.CharField(
        max_length=10,
        choices=USER_TYPE_CHOICES,
        default='buyer',
        db_index=True
    )
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email', 'user_type']),
            models.Index(fields=['username', 'user_type']),
        ]
        constraints = [
            # Username unique per user_type
            models.UniqueConstraint(
                fields=['username', 'user_type'],
                name='unique_username_per_user_type'
            ),
            # Email unique per user_type
            models.UniqueConstraint(
                fields=['email', 'user_type'],
                name='unique_email_per_user_type'
            ),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.user_type})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username


class Seller(TimestampMixin, SoftDeleteMixin):
    """
    Seller profile - Admin que gestiona el dashboard.
    Solo hay UN seller por instancia (el dueño del servidor).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='seller_profile',
        limit_choices_to={'user_type': 'seller'}
    )
    
    # Stats (denormalized for performance)
    total_stores = models.IntegerField(default=0)
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    class Meta:
        db_table = 'sellers'
    
    def __str__(self):
        return f"Seller: {self.user.username}"


class Buyer(TimestampMixin, SoftDeleteMixin):
    """
    Buyer profile - Cliente que compra productos.
    
    SIMPLIFICADO: Solo email, contraseña y username de Minecraft.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='buyer_profiles',
        limit_choices_to={'user_type': 'buyer'}
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='buyers'
    )
    
    # Minecraft info (REQUIRED for buyers)
    minecraft_username = models.CharField(
        max_length=16,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9_]{3,16}$',
                message='Minecraft username must be 3-16 characters and only contain letters, numbers, and underscores.'
            )
        ]
    )
    minecraft_uuid = models.CharField(max_length=36, blank=True, null=True)
    
    # Stats (denormalized)
    total_purchases = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Status
    is_banned = models.BooleanField(default=False)
    ban_reason = models.TextField(blank=True, null=True)
    banned_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'buyers'
        unique_together = [
            ('user', 'store'),  # Same user can't be buyer twice in same store
            ('store', 'minecraft_username'),  # Minecraft username unique per store
        ]
        indexes = [
            models.Index(fields=['store', 'minecraft_username']),
            models.Index(fields=['store', 'is_banned']),
        ]
    
    def __str__(self):
        return f"Buyer: {self.user.username} @ {self.store.name}"


class UserSession(TimestampMixin):
    """
    Track user sessions for security and analytics.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    
    # Session info
    token_jti = models.CharField(max_length=255, unique=True, db_index=True)
    refresh_token_jti = models.CharField(max_length=255, blank=True, null=True)
    
    # Context (for buyers)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Store context for buyer sessions"
    )
    
    # Device info
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    device_type = models.CharField(max_length=50, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    last_activity = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_sessions'
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['token_jti']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Session: {self.user.username} - {self.ip_address}"
