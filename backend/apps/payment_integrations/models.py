"""
Payment Integration Models

Stores encrypted credentials and connection status for third-party payment providers.
Based on PayPal Partner Referrals API v2: https://developer.paypal.com/docs/platforms/seller-onboarding/
"""
from django.db import models
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)


def get_encryption_key():
    """Get encryption key from settings."""
    key = getattr(settings, 'PAYMENT_ENCRYPTION_KEY', None)
    if not key:
        raise ValueError(
            "PAYMENT_ENCRYPTION_KEY not found in settings. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return key.encode() if isinstance(key, str) else key


class PayPalConnection(models.Model):
    """
    PayPal OAuth connection for a seller's store.
    
    Uses PayPal Partner Referrals API to connect seller accounts.
    Stores encrypted access tokens and merchant information.
    
    Flow:
    1. lightcode generates referral link (create_referral_link)
    2. Seller clicks "Connect PayPal" and authorizes
    3. PayPal redirects back with merchant_id and auth_code
    4. lightcode exchanges auth_code for access_token
    5. Tokens stored encrypted in this model
    
    Docs: https://developer.paypal.com/docs/platforms/seller-onboarding/before-you-start/
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending Connection'),
        ('connected', 'Connected'),
        ('expired', 'Token Expired'),
        ('revoked', 'Access Revoked'),
        ('error', 'Connection Error'),
    ]
    
    CONNECTION_TYPE_CHOICES = [
        ('partner', 'Partner Referrals API'),
        ('oauth', 'OAuth (Login with PayPal)'),
    ]
    
    # Relationship
    store = models.OneToOneField(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='paypal_connection',
        help_text="Store this PayPal account is connected to"
    )
    
    # PayPal Account Info
    merchant_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="PayPal Merchant ID (merchant_id_in_paypal)"
    )
    merchant_email = models.EmailField(
        max_length=254,
        help_text="PayPal account email"
    )
    merchant_email_verified = models.BooleanField(
        default=False,
        help_text="Whether PayPal email is verified"
    )
    
    # OAuth Tokens (encrypted)
    access_token_encrypted = models.TextField(
        help_text="Encrypted OAuth access token (Fernet)"
    )
    refresh_token_encrypted = models.TextField(
        help_text="Encrypted OAuth refresh token (Fernet)"
    )
    
    # Token Metadata
    token_type = models.CharField(
        max_length=20,
        default='Bearer',
        help_text="Token type (usually 'Bearer')"
    )
    expires_at = models.DateTimeField(
        help_text="When access token expires"
    )
    scope = models.TextField(
        blank=True,
        help_text="OAuth scopes granted (space-separated)"
    )
    
    # Connection Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True,
        help_text="Connection status"
    )
    
    connection_type = models.CharField(
        max_length=20,
        choices=CONNECTION_TYPE_CHOICES,
        default='oauth',
        help_text="Type of PayPal connection"
    )
    
    # Onboarding Data
    referral_link = models.URLField(
        max_length=500,
        blank=True,
        help_text="PayPal referral link for onboarding"
    )
    action_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Action URL from PayPal response"
    )
    partner_referral_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Partner referral ID from PayPal"
    )
    
    # Timestamps
    connected_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When connection was established"
    )
    last_refreshed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time token was refreshed"
    )
    disconnected_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When seller disconnected"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Error tracking
    last_error = models.TextField(
        blank=True,
        help_text="Last error message"
    )
    last_error_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When last error occurred"
    )
    
    class Meta:
        db_table = 'paypal_connections'
        verbose_name = 'PayPal Connection'
        verbose_name_plural = 'PayPal Connections'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['merchant_id']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"PayPal: {self.merchant_email} → {self.store.name}"
    
    def __repr__(self):
        return f"<PayPalConnection: {self.merchant_id} ({self.status})>"
    
    # Encryption/Decryption Methods
    
    def encrypt_token(self, token):
        """Encrypt a token using Fernet."""
        if not token:
            return ''
        
        try:
            fernet = Fernet(get_encryption_key())
            return fernet.encrypt(token.encode()).decode()
        except Exception as e:
            logger.error(f"Token encryption failed: {e}")
            raise
    
    def decrypt_token(self, encrypted_token):
        """Decrypt a token using Fernet."""
        if not encrypted_token:
            return ''
        
        try:
            fernet = Fernet(get_encryption_key())
            return fernet.decrypt(encrypted_token.encode()).decode()
        except Exception as e:
            logger.error(f"Token decryption failed: {e}")
            raise
    
    def set_access_token(self, token):
        """Set access token (encrypts automatically)."""
        self.access_token_encrypted = self.encrypt_token(token)
    
    def get_access_token(self):
        """Get decrypted access token."""
        return self.decrypt_token(self.access_token_encrypted)
    
    def set_refresh_token(self, token):
        """Set refresh token (encrypts automatically)."""
        self.refresh_token_encrypted = self.encrypt_token(token)
    
    def get_refresh_token(self):
        """Get decrypted refresh token."""
        return self.decrypt_token(self.refresh_token_encrypted)
    
    # Status Methods
    
    def is_connected(self):
        """Check if connection is active."""
        return self.status == 'connected'
    
    def is_token_expired(self):
        """Check if access token is expired."""
        if not self.expires_at:
            return True
        return timezone.now() >= self.expires_at
    
    def needs_refresh(self):
        """Check if token needs refresh (expires in < 5 minutes)."""
        if not self.expires_at:
            return True
        return timezone.now() >= (self.expires_at - timezone.timedelta(minutes=5))
    
    def mark_connected(self):
        """Mark connection as active."""
        self.status = 'connected'
        self.connected_at = timezone.now()
        self.last_error = ''
        self.last_error_at = None
        self.save(update_fields=['status', 'connected_at', 'last_error', 'last_error_at', 'updated_at'])
    
    def mark_expired(self):
        """Mark token as expired."""
        self.status = 'expired'
        self.save(update_fields=['status', 'updated_at'])
    
    def mark_revoked(self):
        """Mark access as revoked."""
        self.status = 'revoked'
        self.disconnected_at = timezone.now()
        self.save(update_fields=['status', 'disconnected_at', 'updated_at'])
    
    def mark_error(self, error_message):
        """Mark connection as error."""
        self.status = 'error'
        self.last_error = error_message[:1000]  # Limit error message length
        self.last_error_at = timezone.now()
        self.save(update_fields=['status', 'last_error', 'last_error_at', 'updated_at'])
    
    def disconnect(self):
        """Disconnect PayPal account."""
        self.status = 'revoked'
        self.disconnected_at = timezone.now()
        
        # Clear sensitive data
        self.access_token_encrypted = ''
        self.refresh_token_encrypted = ''
        
        self.save()
        logger.info(f"PayPal disconnected for store {self.store.slug}")


class StripeConnection(models.Model):
    """
    Stripe Connect integration (future implementation).
    
    Placeholder for Stripe Connect OAuth flow.
    Docs: https://stripe.com/docs/connect
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending Connection'),
        ('connected', 'Connected'),
        ('restricted', 'Restricted'),
        ('disconnected', 'Disconnected'),
    ]
    
    store = models.OneToOneField(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='stripe_connection'
    )
    
    stripe_account_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Stripe Connect account ID (acct_...)"
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    # Timestamps
    connected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'stripe_connections'
        verbose_name = 'Stripe Connection'
        verbose_name_plural = 'Stripe Connections'
    
    def __str__(self):
        return f"Stripe: {self.stripe_account_id} → {self.store.name}"


class PaymentIntegrationLog(models.Model):
    """
    Audit log for payment integration events.
    
    Tracks connection attempts, token refreshes, errors, etc.
    """
    
    EVENT_TYPES = [
        ('referral_created', 'Referral Link Created'),
        ('connection_started', 'Connection Started'),
        ('connection_completed', 'Connection Completed'),
        ('token_refreshed', 'Token Refreshed'),
        ('token_expired', 'Token Expired'),
        ('connection_error', 'Connection Error'),
        ('disconnected', 'Disconnected'),
    ]
    
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='payment_integration_logs'
    )
    
    provider = models.CharField(
        max_length=20,
        help_text="Payment provider (paypal, stripe, etc.)"
    )
    
    event_type = models.CharField(
        max_length=30,
        choices=EVENT_TYPES,
        db_index=True
    )
    
    message = models.TextField(
        help_text="Event description"
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event data"
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of request"
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'payment_integration_logs'
        verbose_name = 'Payment Integration Log'
        verbose_name_plural = 'Payment Integration Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'provider']),
            models.Index(fields=['event_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.provider.upper()}: {self.event_type} - {self.store.slug}"
    
    @classmethod
    def log_event(cls, store, provider, event_type, message, metadata=None, request=None):
        """Helper method to create log entries."""
        log_data = {
            'store': store,
            'provider': provider,
            'event_type': event_type,
            'message': message,
            'metadata': metadata or {},
        }
        
        if request:
            log_data['ip_address'] = cls.get_client_ip(request)
            log_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')[:500]
        
        return cls.objects.create(**log_data)
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
