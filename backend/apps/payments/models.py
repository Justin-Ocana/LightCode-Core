from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class PlugsEssentialsSubscription(models.Model):
    """Modelo para suscripciones de PlugsEssentials"""
    
    TIER_CHOICES = [
        ('tier1', 'Tier 1 - 1 Servidor'),
        ('tier2', 'Tier 2 - 3 Servidores'),
        ('tier3', 'Tier 3 - 5 Servidores'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Activa'),
        ('cancelled', 'Cancelada'),
        ('expired', 'Expirada'),
        ('suspended', 'Suspendida'),
    ]
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='plugsessentials_subscription'
    )
    tier = models.CharField(max_length=10, choices=TIER_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    # PayPal info
    paypal_subscription_id = models.CharField(max_length=255, unique=True)
    paypal_plan_id = models.CharField(max_length=255)
    
    # Fechas
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    next_billing_date = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    # Descargas
    downloads_this_month = models.IntegerField(default=0)
    downloads_reset_date = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'plugsessentials_subscriptions'
        verbose_name = 'PlugsEssentials Subscription'
        verbose_name_plural = 'PlugsEssentials Subscriptions'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_tier_display()} ({self.status})"
    
    @property
    def max_servers(self):
        """Retorna el número máximo de servidores según el tier"""
        tier_servers = {
            'tier1': 1,
            'tier2': 3,
            'tier3': 5,
        }
        return tier_servers.get(self.tier, 1)
    
    @property
    def price(self):
        """Retorna el precio mensual según el tier"""
        tier_prices = {
            'tier1': 7,
            'tier2': 10,
            'tier3': 15,
        }
        return tier_prices.get(self.tier, 7)
    
    @property
    def downloads_remaining(self):
        """Retorna las descargas restantes este mes"""
        return max(0, 3 - self.downloads_this_month)
    
    def reset_downloads_if_needed(self):
        """Resetea el contador de descargas si ya pasó el mes"""
        if timezone.now() >= self.downloads_reset_date:
            self.downloads_this_month = 0
            # Próximo reset en 30 días
            self.downloads_reset_date = timezone.now() + timezone.timedelta(days=30)
            self.save()
    
    def can_download(self):
        """Verifica si el usuario puede descargar"""
        self.reset_downloads_if_needed()
        return self.status == 'active' and self.downloads_remaining > 0
    
    def register_download(self):
        """Registra una descarga"""
        self.reset_downloads_if_needed()
        if self.can_download():
            self.downloads_this_month += 1
            self.save()
            return True
        return False


class PlugsEssentialsDownload(models.Model):
    """Registro de descargas de PlugsEssentials"""
    
    PACK_TYPE_CHOICES = [
        ('bp', 'Behavior Pack'),
        ('rp', 'Resource Pack'),
    ]
    
    subscription = models.ForeignKey(
        PlugsEssentialsSubscription,
        on_delete=models.CASCADE,
        related_name='downloads'
    )
    pack_type = models.CharField(max_length=2, choices=PACK_TYPE_CHOICES)
    delivery = models.BooleanField(default=False)  # True = versión con entregas automáticas lightcode
    downloaded_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'plugsessentials_downloads'
        verbose_name = 'PlugsEssentials Download'
        verbose_name_plural = 'PlugsEssentials Downloads'
        ordering = ['-downloaded_at']
    
    def __str__(self):
        return f"{self.subscription.user.username} - {self.get_pack_type_display()} - {self.downloaded_at}"


class AuthorizedServer(models.Model):
    """Servidores autorizados para usar PlugsEssentials"""
    
    subscription = models.ForeignKey(
        PlugsEssentialsSubscription,
        on_delete=models.CASCADE,
        related_name='authorized_servers'
    )
    name = models.CharField(max_length=255)
    server_code = models.CharField(max_length=50, unique=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'plugsessentials_authorized_servers'
        verbose_name = 'Authorized Server'
        verbose_name_plural = 'Authorized Servers'
    
    def __str__(self):
        return f"{self.name} ({self.server_code})"


class PayPalWebhookEvent(models.Model):
    """Registro de eventos de webhook de PayPal"""
    
    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=100, null=True, blank=True)
    resource_id = models.CharField(max_length=255, null=True, blank=True)
    
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'paypal_webhook_events'
        verbose_name = 'PayPal Webhook Event'
        verbose_name_plural = 'PayPal Webhook Events'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.event_type} - {self.event_id}"



class FreeDownloadToken(models.Model):
    """Token de un solo uso para descargas gratuitas"""
    token = models.CharField(max_length=64, unique=True, db_index=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        db_table = 'free_download_tokens'
        verbose_name = 'Free Download Token'
        verbose_name_plural = 'Free Download Tokens'
    
    def __str__(self):
        return f"Token {self.token[:8]}... - {'Usado' if self.used else 'Válido'}"
    
    def is_valid(self):
        """Verifica si el token es válido"""
        return not self.used and timezone.now() < self.expires_at
    
    def mark_as_used(self):
        """Marca el token como usado"""
        self.used = True
        self.used_at = timezone.now()
        self.save()
