"""
Store models - Multi-tenant store system.

Architecture:
- Each Seller can own multiple stores (limited by subscription)
- Stores are isolated tenants with their own products, orders, buyers
- Slug-based routing for SEO-friendly URLs
- Soft delete for data preservation
"""
from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from django.utils import timezone as django_timezone
from core.mixins import TimestampMixin, SoftDeleteMixin
import logging
import uuid
import re
import secrets

logger = logging.getLogger(__name__)


# Reserved slugs that cannot be used for stores
RESERVED_SLUGS = {
    'admin', 'api', 'auth', 'login', 'logout', 'register', 'dashboard',
    'settings', 'profile', 'store', 'stores', 'product', 'products',
    'order', 'orders', 'payment', 'payments', 'checkout', 'cart',
    'search', 'help', 'support', 'about', 'contact', 'terms', 'privacy',
    'docs', 'documentation', 'blog', 'news', 'static', 'media', 'assets',
    'health', 'status', 'metrics', 'webhook', 'webhooks', 'callback',
    'lightcode', 'system', 'root', 'webmaster', 'support', 'staff',
}


def validate_slug(value):
    """
    Validate store slug.
    
    Rules:
    - Only lowercase letters, numbers, and hyphens
    - Cannot start or end with hyphen
    - Cannot be a reserved word
    - Minimum 3 characters, maximum 30
    """
    if not value:
        raise ValidationError('El slug no puede estar vacío.')
    
    value = value.lower()
    
    if value in RESERVED_SLUGS:
        raise ValidationError(
            f'"{value}" es una palabra reservada y no puede usarse como slug.'
        )
    
    if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', value):
        raise ValidationError(
            'El slug solo puede contener letras minúsculas, números y guiones. '
            'No puede empezar ni terminar con guion.'
        )
    
    if len(value) < 3:
        raise ValidationError('El slug debe tener al menos 3 caracteres.')
    
    if len(value) > 50:
        raise ValidationError('El slug no puede exceder los 50 caracteres.')


class StoreQuerySet(models.QuerySet):
    """Custom queryset for Store model."""
    
    def active(self):
        """Return only active stores."""
        return self.filter(status='active', is_deleted=False)
    
    def verified(self):
        """Return only verified stores."""
        return self.filter(is_verified=True, is_deleted=False)
    
    def public(self):
        """Return stores visible to public."""
        return self.filter(
            status='active',
            is_verified=True,
            is_deleted=False
        )
    
    def for_owner(self, user):
        """Return stores owned by user."""
        return self.filter(owner=user, is_deleted=False)


class StoreManager(models.Manager):
    """Custom manager for Store model."""
    
    def get_queryset(self):
        return StoreQuerySet(self.model, using=self._db)
    
    def active(self):
        return self.get_queryset().active()
    
    def verified(self):
        return self.get_queryset().verified()
    
    def public(self):
        return self.get_queryset().public()
    
    def for_owner(self, user):
        return self.get_queryset().for_owner(user)


class Store(TimestampMixin, SoftDeleteMixin):
    """
    Store model - Represents a seller's online store.
    
    Each store is an isolated tenant with:
    - Unique slug for URL routing
    - Own products, orders, buyers
    - Custom configuration (currency, timezone, theme)
    - Branding (logo, banner, colors)
    """
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
        ('maintenance', 'Maintenance'),
    ]
    
    CURRENCY_CHOICES = [
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('MXN', 'Mexican Peso'),
        ('ARS', 'Argentine Peso'),
        ('COP', 'Colombian Peso'),
        ('CLP', 'Chilean Peso'),
        ('BRL', 'Brazilian Real'),
    ]
    
    LANGUAGE_CHOICES = [
        ('es', 'Español'),
        ('en', 'English'),
        ('pt', 'Português'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Owner (must be seller)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,  # Prevent accidental user deletion
        related_name='owned_stores',
        db_index=True
    )
    
    # Identity
    name = models.CharField(
        max_length=100,
        help_text="Display name of the store"
    )
    slug = models.SlugField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[validate_slug],
        help_text="URL-friendly unique identifier"
    )
    description = models.TextField(
        blank=True,
        max_length=500,
        help_text="Store description (max 500 characters)"
    )
    tagline = models.CharField(
        max_length=100,
        blank=True,
        help_text="Short tagline or slogan"
    )
    
    # Branding
    logo = models.CharField(
        max_length=500,
        blank=True,
        help_text="Cloudinary public_id for store logo"
    )
    banner = models.CharField(
        max_length=500,
        blank=True,
        help_text="Cloudinary public_id for store banner"
    )
    favicon = models.CharField(
        max_length=500,
        blank=True,
        help_text="Cloudinary public_id for favicon"
    )
    primary_color = models.CharField(
        max_length=7,
        default='#3B82F6',
        validators=[
            RegexValidator(
                regex=r'^#[0-9A-Fa-f]{6}$',
                message='Must be a valid hex color (e.g., #3B82F6)'
            )
        ],
        help_text="Primary brand color (hex format)"
    )
    secondary_color = models.CharField(
        max_length=7,
        default='#10B981',
        validators=[
            RegexValidator(
                regex=r'^#[0-9A-Fa-f]{6}$',
                message='Must be a valid hex color (e.g., #10B981)'
            )
        ],
        help_text="Secondary brand color (hex format)"
    )
    
    # Configuration
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default='USD',
        help_text="Store currency"
    )
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="Store timezone (e.g., America/Mexico_City)"
    )
    language = models.CharField(
        max_length=5,
        default='es',
        choices=LANGUAGE_CHOICES,
        help_text="Store default language"
    )
    
    # Contact & Social
    email = models.EmailField(
        blank=True,
        help_text="Store contact email"
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        help_text="Store contact phone"
    )
    website = models.URLField(
        blank=True,
        help_text="External website URL"
    )
    discord_invite = models.URLField(
        blank=True,
        help_text="Discord server invite link"
    )
    twitter_handle = models.CharField(
        max_length=50,
        blank=True,
        help_text="Twitter/X handle (without @)"
    )
    instagram_handle = models.CharField(
        max_length=50,
        blank=True,
        help_text="Instagram handle (without @)"
    )
    
    # Minecraft Server Info
    minecraft_server_ip = models.CharField(
        max_length=255,
        blank=True,
        help_text="Minecraft server IP address"
    )
    minecraft_server_port = models.IntegerField(
        null=True,
        blank=True,
        help_text="Minecraft server port (default: 25565)"
    )
    minecraft_version = models.CharField(
        max_length=50,
        blank=True,
        help_text="Minecraft version (e.g., 1.20.1)"
    )
    
    # RCON Configuration
    rcon_enabled = models.BooleanField(
        default=False,
        help_text="Whether RCON is configured and enabled"
    )
    rcon_host = models.CharField(
        max_length=255,
        blank=True,
        help_text="RCON host (IP or domain)"
    )
    rcon_port = models.IntegerField(
        null=True,
        blank=True,
        help_text="RCON port (default: 25575)"
    )
    rcon_password_encrypted = models.TextField(
        blank=True,
        help_text="Encrypted RCON password (Fernet)"
    )
    rcon_last_test = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last successful RCON connection test"
    )
    rcon_last_latency = models.IntegerField(
        null=True,
        blank=True,
        help_text="Last connection latency in ms"
    )
    
    # PayPal Configuration
    paypal_email = models.EmailField(
        max_length=254,
        null=True,
        blank=True,
        help_text="PayPal email for receiving payments"
    )
    paypal_merchant_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="PayPal Merchant ID for Marketplace integration"
    )

    # PlugsEssentials / lightcode Mod Delivery
    mod_api_key = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="API key para autenticar el mod PlugsEssentials (lightcode Delivery)"
    )
    mod_last_poll = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Última vez que el mod hizo polling (indica si está conectado)"
    )

    # Límites de entregas automáticas (plan free de lightcode = 15 plugin + 15 RCON por 30 días)
    plugin_deliveries_used = models.IntegerField(
        default=0,
        help_text="Entregas automáticas via Plugin usadas en el período actual"
    )
    rcon_deliveries_used = models.IntegerField(
        default=0,
        help_text="Entregas automáticas via RCON usadas en el período actual"
    )
    deliveries_reset_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha en que se resetean los contadores (30 días desde la primera entrega)"
    )
    AUTO_DELIVERY_LIMIT = 15  # límite por método en plan free

    # Tipo de servidor Minecraft
    SERVER_TYPE_CHOICES = [
        ('java',    'Java / Crossplay (RCON)'),
        ('bedrock', 'Bedrock puro (PlugsEssentials)'),
    ]
    server_type = models.CharField(
        max_length=10,
        choices=SERVER_TYPE_CHOICES,
        default='java',
        help_text="Tipo de servidor: java usa RCON, bedrock usa el mod"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        db_index=True,
        help_text="Store operational status"
    )
    is_verified = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether store is verified by admin"
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When store was verified"
    )
    
    # Custom domain (future feature)
    custom_domain = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text="Custom domain (e.g., shop.example.com)"
    )
    domain_verified = models.BooleanField(
        default=False,
        help_text="Whether custom domain is verified"
    )
    
    # SEO
    meta_title = models.CharField(
        max_length=60,
        blank=True,
        help_text="SEO meta title (max 60 chars)"
    )
    meta_description = models.CharField(
        max_length=160,
        blank=True,
        help_text="SEO meta description (max 160 chars)"
    )
    meta_keywords = models.CharField(
        max_length=255,
        blank=True,
        help_text="SEO keywords (comma-separated)"
    )
    
    # Stats (denormalized for performance)
    total_products = models.IntegerField(default=0, db_index=True)
    total_orders = models.IntegerField(default=0, db_index=True)
    total_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Total revenue in store currency"
    )
    total_buyers = models.IntegerField(default=0)
    views_count = models.IntegerField(default=0)
    last_order_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Last order timestamp"
    )
    
    objects = StoreManager()
    
    class Meta:
        db_table = 'stores'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', 'status']),
            models.Index(fields=['slug']),
            models.Index(fields=['status', 'is_verified']),
            models.Index(fields=['is_deleted', 'status']),
            models.Index(fields=['-total_orders']),
            models.Index(fields=['-views_count']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(total_products__gte=0),
                name='stores_total_products_positive'
            ),
            models.CheckConstraint(
                check=models.Q(total_orders__gte=0),
                name='stores_total_orders_positive'
            ),
            models.CheckConstraint(
                check=models.Q(total_revenue__gte=0),
                name='stores_total_revenue_positive'
            ),
        ]
    
    def __str__(self):
        return f"{self.name} (@{self.slug})"
    
    def __repr__(self):
        return f"<Store: {self.slug} (owner={self.owner.username})>"
    
    def clean(self):
        """Validaciones a nivel de modelo."""
        super().clean()
        
        # Sanitizar nombre
        import bleach
        if self.name:
            self.name = bleach.clean(self.name.strip(), tags=[], strip=True)
            
        # Sanitizar eslogan
        if self.tagline:
            self.tagline = bleach.clean(self.tagline.strip(), tags=[], strip=True)
            
        # Sanitizar descripción (permitir algunas etiquetas)
        if self.description:
            allowed_tags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li']
            self.description = bleach.clean(self.description.strip(), tags=allowed_tags, strip=True)
            
        # Ensure slug is lowercase
        if self.slug:
            self.slug = self.slug.lower()
        
        # Validate owner is seller
        if self.owner_id and hasattr(self.owner, 'user_type'):
            if self.owner.user_type != 'seller':
                raise ValidationError({
                    'owner': 'Only sellers can own stores.'
                })
    
    def save(self, *args, **kwargs):
        """Override save para asegurar validación."""
        
        # Auto-generate slug if not provided
        if not self.slug:
            self.slug = self.generate_unique_slug()
        
        # Ensure slug is lowercase
        self.slug = self.slug.lower()
        
        # Set meta_title from name if not provided
        if not self.meta_title:
            self.meta_title = self.name[:60]
        
        # Auto-set verified_at if verified
        if self.is_verified and not self.verified_at:
            self.verified_at = django_timezone.now()
        
        # Run full clean
        self.full_clean()
        
        super().save(*args, **kwargs)
    
    def generate_unique_slug(self):
        """
        Generate unique slug from store name.
        
        If slug exists, append number (e.g., my-store-1, my-store-2)
        Excludes soft-deleted stores from uniqueness check.
        """
        base_slug = slugify(self.name)[:45]  # Leave room for counter
        
        if not base_slug or base_slug in RESERVED_SLUGS:
            # Fallback if name has no valid characters or is reserved
            base_slug = f"store-{uuid.uuid4().hex[:8]}"
        
        slug = base_slug
        counter = 1
        
        # Check uniqueness against ACTIVE (non-deleted) stores only
        while Store.objects.filter(slug=slug, is_deleted=False).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
            # Safety check to prevent infinite loop
            if counter > 1000:
                slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"
                break
        
        return slug
    
    def get_logo_url(self):
        """Get Cloudinary logo URL with transformation."""
        if not self.logo:
            return None
        
        try:
            from core.cloudinary_utils import CloudinaryImageHandler
            return CloudinaryImageHandler.get_transformed_url(
                self.logo,
                transformation='store_logo'
            )
        except Exception:
            return None
    
    def get_banner_url(self):
        """Get Cloudinary banner URL with transformation."""
        if not self.banner:
            return None
        
        try:
            from core.cloudinary_utils import CloudinaryImageHandler
            return CloudinaryImageHandler.get_transformed_url(
                self.banner,
                transformation='banner'
            )
        except Exception:
            return None
    
    def soft_delete(self):
        """
        Override soft_delete to append UUID to slug, freeing it up.
        """
        old_slug = self.slug
        self.slug = f"{old_slug}-deleted-{uuid.uuid4().hex[:8]}"
        self.is_deleted = True
        self.deleted_at = django_timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at', 'slug'])
        logger.info(f"Store soft-deleted. Slug freed: {old_slug} -> {self.slug}")

    def restore(self):
        """
        Restore soft-deleted object and try to regain original slug.
        """
        # Remove the '-deleted-...' suffix to get original slug
        if '-deleted-' in self.slug:
            original_slug = self.slug.split('-deleted-')[0]
            
            # Check if original slug is available
            if not Store.objects.filter(slug=original_slug, is_deleted=False).exists():
                self.slug = original_slug
            else:
                # If taken, generate a new unique one
                self.slug = self.generate_unique_slug()
        
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'slug'])
    
    def get_absolute_url(self):
        """Get store URL."""
        return f"/store/{self.slug}/"

    @property
    def can_add_product(self):
        """Check if store can add more products based on owner's subscription."""
        try:
            if not hasattr(self.owner, 'seller_profile'):
                return False
            
            # White-label: No product limits
            return True
        except Exception:
            return False
    
    @property
    def is_active_and_verified(self):
        """Check if store is active and verified."""
        return (
            self.status == 'active' and 
            self.is_verified and 
            not self.is_deleted
        )
    
    def _is_free_plan(self):
        """White-label: Always return False (no free plan restrictions)."""
        return False

    def _reset_deliveries_if_needed(self):
        """Resetea contadores si ya pasaron 30 días desde el reset anterior."""
        if self.deliveries_reset_date and django_timezone.now() >= self.deliveries_reset_date:
            self.plugin_deliveries_used = 0
            self.rcon_deliveries_used = 0
            self.deliveries_reset_date = django_timezone.now() + django_timezone.timedelta(days=30)
            Store.objects.filter(pk=self.pk).update(
                plugin_deliveries_used=0,
                rcon_deliveries_used=0,
                deliveries_reset_date=self.deliveries_reset_date,
            )

    def can_auto_deliver_plugin(self):
        """True si puede hacer una entrega automática via Plugin."""
        if not self._is_free_plan():
            return True
        self._reset_deliveries_if_needed()
        return self.plugin_deliveries_used < self.AUTO_DELIVERY_LIMIT

    def can_auto_deliver_rcon(self):
        """True si puede hacer una entrega automática via RCON."""
        if not self._is_free_plan():
            return True
        self._reset_deliveries_if_needed()
        return self.rcon_deliveries_used < self.AUTO_DELIVERY_LIMIT

    def register_plugin_delivery(self):
        """Incrementa el contador de entregas Plugin y arranca el período si es la primera."""
        from django.db.models import F
        if not self.deliveries_reset_date:
            reset = django_timezone.now() + django_timezone.timedelta(days=30)
            Store.objects.filter(pk=self.pk).update(
                plugin_deliveries_used=F('plugin_deliveries_used') + 1,
                deliveries_reset_date=reset,
            )
        else:
            Store.objects.filter(pk=self.pk).update(
                plugin_deliveries_used=F('plugin_deliveries_used') + 1,
            )
        self.refresh_from_db(fields=['plugin_deliveries_used', 'deliveries_reset_date'])

    def register_rcon_delivery(self):
        """Incrementa el contador de entregas RCON y arranca el período si es la primera."""
        from django.db.models import F
        if not self.deliveries_reset_date:
            reset = django_timezone.now() + django_timezone.timedelta(days=30)
            Store.objects.filter(pk=self.pk).update(
                rcon_deliveries_used=F('rcon_deliveries_used') + 1,
                deliveries_reset_date=reset,
            )
        else:
            Store.objects.filter(pk=self.pk).update(
                rcon_deliveries_used=F('rcon_deliveries_used') + 1,
            )
        self.refresh_from_db(fields=['rcon_deliveries_used', 'deliveries_reset_date'])

    def generate_mod_api_key(self):
        """Genera y guarda una nueva api_key para el mod. Devuelve la key generada."""
        key = secrets.token_urlsafe(32)
        self.mod_api_key = key
        self.save(update_fields=['mod_api_key'])
        return key

    def increment_views(self):
        """Increment store views counter (atomic operation)."""
        from django.db.models import F
        Store.objects.filter(pk=self.pk).update(views_count=F('views_count') + 1)
        self.refresh_from_db(fields=['views_count'])
    
    def update_stats(self):
        """Update denormalized stats from related models."""
        # This will be implemented when products/orders are ready
        pass


class StoreSettings(TimestampMixin):
    """
    Extended store settings.
    
    Stores additional configuration that doesn't need to be indexed.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.OneToOneField(
        Store,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    
    # Notification settings
    email_notifications = models.BooleanField(
        default=True,
        help_text="Send email notifications for orders"
    )
    discord_notifications = models.BooleanField(
        default=False,
        help_text="Send Discord notifications for orders"
    )
    discord_webhook_url = models.URLField(
        blank=True,
        max_length=500,
        help_text="Discord webhook URL for notifications"
    )
    
    # Order settings
    auto_deliver = models.BooleanField(
        default=False,
        help_text="Automatically deliver digital products"
    )
    require_minecraft_verification = models.BooleanField(
        default=True,
        help_text="Require Minecraft username verification"
    )
    allow_guest_checkout = models.BooleanField(
        default=False,
        help_text="Allow checkout without account"
    )
    
    # Payment settings
    payment_methods = models.JSONField(
        default=dict,
        blank=True,
        help_text="Enabled payment methods configuration"
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Tax rate percentage (e.g., 16.00 for 16%)"
    )
    
    # Terms & Policies
    terms_of_service = models.TextField(
        blank=True,
        help_text="Store terms of service"
    )
    refund_policy = models.TextField(
        blank=True,
        help_text="Store refund policy"
    )
    privacy_policy = models.TextField(
        blank=True,
        help_text="Store privacy policy"
    )
    
    # Advanced settings (JSON for flexibility)
    advanced_settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional settings (JSON)"
    )
    
    class Meta:
        db_table = 'store_settings'
        verbose_name = 'Store Settings'
        verbose_name_plural = 'Store Settings'
    
    def __str__(self):
        return f"Settings for {self.store.name}"
    
    def clean(self):
        """Validate settings before saving."""
        super().clean()
        
        # Validate tax rate
        if self.tax_rate < 0 or self.tax_rate > 100:
            raise ValidationError({
                'tax_rate': 'Tax rate must be between 0 and 100.'
            })
        
        # Validate Discord webhook URL
        if self.discord_webhook_url:
            if not self.discord_webhook_url.startswith('https://discord.com/api/webhooks/'):
                raise ValidationError({
                    'discord_webhook_url': 'Invalid Discord webhook URL.'
                })
