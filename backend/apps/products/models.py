"""
Product models - Sistema de productos con comandos y cola de entrega.

Arquitectura de 3 capas:
1. Product: El producto en el catálogo
2. ProductCommand: Los comandos a ejecutar en diferentes eventos
3. DeliveryQueue: Cola de entrega con reintentos (se crea al comprar)
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from core.mixins import TimestampMixin, SoftDeleteMixin
import uuid
import re
from decimal import Decimal


class PurchaseType(models.TextChoices):
    """Tipo de compra."""
    ONE_TIME = 'ONE_TIME', 'One Time'
    SUBSCRIPTION = 'SUBSCRIPTION', 'Subscription'


class SubscriptionInterval(models.TextChoices):
    """Intervalo de suscripción."""
    MONTHLY = 'MONTHLY', 'Monthly'
    QUARTERLY = 'QUARTERLY', 'Quarterly'
    YEARLY = 'YEARLY', 'Yearly'


class DeliveryMode(models.TextChoices):
    """Modo de entrega de comandos."""
    MANUAL = 'MANUAL', 'Manual'
    RCON = 'RCON', 'RCON'
    PLUGIN = 'PLUGIN', 'Plugin'


class ProductStatus(models.TextChoices):
    """Estado del producto."""
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    DRAFT = 'DRAFT', 'Draft'


class CommandEvent(models.TextChoices):
    """Eventos que disparan comandos."""
    ON_PURCHASE = 'ON_PURCHASE', 'On Purchase'
    ON_EXPIRY = 'ON_EXPIRY', 'On Expiry'
    ON_REFUND = 'ON_REFUND', 'On Refund'
    ON_CHARGEBACK = 'ON_CHARGEBACK', 'On Chargeback'
    ON_RENEWAL = 'ON_RENEWAL', 'On Renewal'


class CommandExecType(models.TextChoices):
    """Desde dónde se ejecuta el comando (solo para Mod/Bedrock)."""
    PLAYER  = 'player',  'Desde el jugador que compró'
    WORLD   = 'world',   'Desde overworld (global)'
    ANY     = 'any',     'Cualquier jugador online (fallback)'


class DeliveryStatus(models.TextChoices):
    """Estado de entrega en la cola."""
    PENDING = 'PENDING', 'Pending'
    DELIVERED = 'DELIVERED', 'Delivered'
    FAILED = 'FAILED', 'Failed'
    SKIPPED = 'SKIPPED', 'Skipped'


# Categorías globales predefinidas
GLOBAL_CATEGORIES = [
    {'slug': 'rank', 'name': 'Rank', 'description': 'Rangos y permisos del servidor', 'icon': 'rank'},
    {'slug': 'kit', 'name': 'Kit', 'description': 'Kits con items y recursos', 'icon': 'kit'},
    {'slug': 'item', 'name': 'Item', 'description': 'Items individuales, monedas, tokens', 'icon': 'item'},
    {'slug': 'cosmetic', 'name': 'Cosmetic', 'description': 'Cosméticos, partículas, trails', 'icon': 'cosmetic'},
    {'slug': 'subscription', 'name': 'Subscription', 'description': 'Suscripciones recurrentes', 'icon': 'subscription'},
    {'slug': 'custom', 'name': 'Custom', 'description': 'Comandos personalizados', 'icon': 'custom'},
]


# Variables permitidas en comandos
ALLOWED_COMMAND_VARIABLES = {
    '{username}',
    '{uuid}',
    '{price}',
    '{product_name}',
    '{transaction_id}',
    '{store_slug}',
    '{player}',  # Alias de {username} para Bedrock/PlugsEssentials
}


def validate_command_variables(command):
    """
    Valida que el comando solo use variables permitidas.
    
    Encuentra todas las variables {variable} y verifica que estén en la lista permitida.
    """
    if not command:
        return
    
    # Encontrar todas las variables {algo}
    variables = re.findall(r'\{([^}]+)\}', command)
    
    for var in variables:
        full_var = f'{{{var}}}'
        if full_var not in ALLOWED_COMMAND_VARIABLES:
            raise ValidationError(
                f'Variable "{full_var}" no permitida. '
                f'Variables válidas: {", ".join(sorted(ALLOWED_COMMAND_VARIABLES))}'
            )


class ProductCategoryQuerySet(models.QuerySet):
    """Custom queryset para ProductCategory."""
    
    def default_categories(self):
        """Categorías base."""
        return self.filter(is_default=True, is_deleted=False)
    
    def for_store(self, store):
        """Categorías disponibles para una tienda."""
        return self.filter(store=store, is_deleted=False)


class ProductCategoryManager(models.Manager):
    """Custom manager para ProductCategory."""
    
    def get_queryset(self):
        return ProductCategoryQuerySet(self.model, using=self._db)
    
    def default_categories(self):
        return self.get_queryset().default_categories()
    
    def for_store(self, store):
        return self.get_queryset().for_store(store)


class ProductCategory(TimestampMixin, SoftDeleteMixin):
    """
    Categoría de producto.
    
    Puede ser:
    - Default (is_default=True): Categorías predefinidas creadas al inicio
    - Custom (is_default=False): Categorías adicionales creadas por el seller
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relación con tienda
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='categories',
        null=True,
        blank=True,
        db_index=True,
        help_text="Tienda a la que pertenece la categoría"
    )
    
    # Información básica
    name = models.CharField(
        max_length=100,
        help_text="Nombre de la categoría"
    )
    slug = models.SlugField(
        max_length=100,
        help_text="Slug único por tienda"
    )
    description = models.TextField(
        blank=True,
        max_length=500,
        help_text="Descripción de la categoría"
    )
    icon = models.CharField(
        max_length=50,
        blank=True,
        help_text="Identificador del icono (ej: rank, kit, item)"
    )
    
    # Tipo
    is_default = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Si es una de las categorías base (rank, kit, etc.)"
    )
    
    # Orden
    sort_order = models.IntegerField(
        default=0,
        help_text="Orden de visualización"
    )
    
    objects = ProductCategoryManager()
    
    class Meta:
        db_table = 'product_categories'
        ordering = ['sort_order', 'name']
        verbose_name = 'Product Category'
        verbose_name_plural = 'Product Categories'
        indexes = [
            models.Index(fields=['store', 'slug']),
            models.Index(fields=['is_default']),
        ]
        constraints = [
            # Slug único por tienda
            models.UniqueConstraint(
                fields=['store', 'slug'],
                name='unique_store_category_slug'
            ),
        ]
    
    def __str__(self):
        return f"{self.icon} {self.name} ({self.store.slug})"
    
    def __repr__(self):
        return f"<ProductCategory: {self.name} - {self.store.slug}>"
    
    def clean(self):
        """Validaciones."""
        super().clean()
        
        # Debe tener store
        if not self.store:
            raise ValidationError({
                'store': 'La categoría debe tener una tienda asociada.'
            })
        
        # Auto-generar slug si no existe
        if not self.slug:
            self.slug = slugify(self.name)
        
        # Validar unicidad de slug (solo entre categorías no eliminadas)
        if self.is_default:
            # Slug único por tienda (categorías base)
            exists = ProductCategory.objects.filter(
                store=self.store,
                is_default=True,
                slug=self.slug,
                is_deleted=False
            ).exclude(pk=self.pk).exists()
            
            if exists:
                raise ValidationError({
                    'slug': f'Ya existe una categoría base con el slug "{self.slug}" en esta tienda.'
                })
        else:
            # Slug único por tienda
            exists = ProductCategory.objects.filter(
                store=self.store,
                slug=self.slug,
                is_default=False,
                is_deleted=False
            ).exclude(pk=self.pk).exists()
            
            if exists:
                raise ValidationError({
                    'slug': f'Ya existe una categoría con el slug "{self.slug}" en esta tienda.'
                })
    
    def save(self, *args, **kwargs):
        """Override save para validaciones."""
        self.full_clean()
        super().save(*args, **kwargs)


class ProductQuerySet(models.QuerySet):
    """Custom queryset para Product."""
    
    def active(self):
        """Productos activos."""
        return self.filter(status=ProductStatus.ACTIVE, is_deleted=False)
    
    def for_store(self, store):
        """Productos de una tienda."""
        return self.filter(store=store, is_deleted=False)
    
    def by_category(self, category):
        """Productos por categoría."""
        return self.filter(category=category, is_deleted=False)
    
    def public(self):
        """Productos visibles públicamente."""
        return self.filter(
            status=ProductStatus.ACTIVE,
            is_deleted=False,
            store__status='active',
            store__is_verified=True
        )


class ProductManager(models.Manager):
    """Custom manager para Product."""
    
    def get_queryset(self):
        return ProductQuerySet(self.model, using=self._db)
    
    def active(self):
        return self.get_queryset().active()
    
    def for_store(self, store):
        return self.get_queryset().for_store(store)
    
    def by_category(self, category):
        return self.get_queryset().by_category(category)
    
    def public(self):
        return self.get_queryset().public()


class Product(TimestampMixin, SoftDeleteMixin):
    """
    Producto en el catálogo de una tienda.
    
    Representa cualquier cosa que se pueda vender: rangos, kits, items, etc.
    La lógica de qué hace el producto está en ProductCommand.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relación con tienda
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='products',
        db_index=True,
        help_text="Tienda a la que pertenece el producto"
    )
    
    # Información básica
    name = models.CharField(
        max_length=100,
        help_text="Nombre del producto"
    )
    description = models.TextField(
        blank=True,
        max_length=2000,
        help_text="Descripción del producto (max 2000 caracteres)"
    )
    image = models.CharField(
        max_length=500,
        blank=True,
        help_text="Cloudinary public_id de la imagen principal del producto"
    )
    
    # Galería de imágenes
    show_gallery = models.BooleanField(
        default=False,
        help_text="Mostrar galería de imágenes adicionales"
    )
    
    # Precio
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal('0.01')),
            MaxValueValidator(Decimal('9999.99'))
        ],
        help_text="Precio en la moneda de la tienda"
    )
    
    # Categorización
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT,  # No permitir eliminar categorías en uso
        related_name='products',
        db_index=True,
        help_text="Categoría del producto"
    )
    
    # Tipo de compra
    purchase_type = models.CharField(
        max_length=20,
        choices=PurchaseType.choices,
        default=PurchaseType.ONE_TIME,
        db_index=True,
        help_text="Tipo de compra: única o suscripción"
    )
    subscription_interval = models.CharField(
        max_length=20,
        choices=SubscriptionInterval.choices,
        null=True,
        blank=True,
        help_text="Intervalo de renovación (solo para suscripciones)"
    )
    
    # Límites
    global_limit = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(99999)],
        help_text="Límite global de ventas (null = ilimitado)"
    )
    per_player_limit = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(99999)],
        help_text="Límite de compras por jugador (null = ilimitado)"
    )
    
    # Configuración de entrega
    require_online = models.BooleanField(
        default=False,
        help_text="Si el jugador debe estar online para recibir el producto"
    )
    command_delay = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(3600)],
        help_text="Segundos de delay antes de ejecutar comandos (max 1 hora)"
    )
    delivery_mode = models.CharField(
        max_length=20,
        choices=DeliveryMode.choices,
        default=DeliveryMode.RCON,
        help_text="Modo de entrega: RCON o Plugin"
    )
    required_slots = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(36)],
        help_text="Slots de inventario que el jugador necesita libres para recibir este producto (0 = sin requisito)"
    )

    # Configuración avanzada de entrega (JSON)
    # Estructura:
    # {
    #   "retry_if_offline": true,       # reintentar si jugador offline
    #   "max_retry_hours": 5,           # horas máximas de reintento
    #   "success_message": "...",       # mensaje web al comprador
    #   "server_chat_message": "...",   # mensaje en chat del servidor (opcional)
    #   "server_chat_enabled": false,   # activar mensaje en chat del servidor
    #   "notify_seller_on_fail": true   # notificar al seller si falla
    # }
    delivery_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configuración avanzada de entrega para el mod"
    )
    
    content = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de items incluidos en el producto (formato: [{icon, text}])"
    )
    
    # Estado y orden
    status = models.CharField(
        max_length=20,
        choices=ProductStatus.choices,
        default=ProductStatus.DRAFT,
        db_index=True,
        help_text="Estado del producto"
    )
    sort_order = models.IntegerField(
        default=0,
        db_index=True,
        help_text="Orden de visualización (menor = primero)"
    )
    
    # Estadísticas (denormalizadas)
    total_sold = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Total de unidades vendidas"
    )
    
    objects = ProductManager()
    
    class Meta:
        db_table = 'products'
        ordering = ['sort_order', '-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['store', 'category']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['status', 'is_deleted']),
            models.Index(fields=['sort_order']),
            models.Index(fields=['-total_sold']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(price__gte=0),
                name='products_price_positive'
            ),
            models.CheckConstraint(
                check=models.Q(total_sold__gte=0),
                name='products_total_sold_positive'
            ),
            models.CheckConstraint(
                check=models.Q(command_delay__gte=0),
                name='products_command_delay_positive'
            ),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.store.name})"
    
    def __repr__(self):
        return f"<Product: {self.name} - {self.category} - ${self.price}>"
    
    def clean(self):
        """Validaciones a nivel de modelo."""
        super().clean()
        
        # Sanitizar nombre
        import bleach
        if self.name:
            self.name = bleach.clean(self.name.strip(), tags=[], strip=True)
            
        # Sanitizar descripción
        if self.description:
            self.description = bleach.clean(self.description.strip(), tags=[], strip=True)
            
        # Si es suscripción, debe tener intervalo
        if self.purchase_type == PurchaseType.SUBSCRIPTION:
            if not self.subscription_interval:
                raise ValidationError({
                    'subscription_interval': 'Las suscripciones deben tener un intervalo definido.'
                })
        else:
            # Si no es suscripción, no debe tener intervalo
            if self.subscription_interval:
                raise ValidationError({
                    'subscription_interval': 'Solo las suscripciones pueden tener intervalo.'
                })
        
        # Validar límites
        if self.global_limit is not None and self.global_limit < 1:
            raise ValidationError({
                'global_limit': 'El límite global debe ser al menos 1.'
            })
        
        if self.per_player_limit is not None and self.per_player_limit < 1:
            raise ValidationError({
                'per_player_limit': 'El límite por jugador debe ser al menos 1.'
            })
        
        # Validar que no se exceda el límite global
        if self.global_limit is not None and self.total_sold >= self.global_limit:
            if self.status == ProductStatus.ACTIVE:
                raise ValidationError({
                    'status': f'No se puede activar: límite global alcanzado ({self.total_sold}/{self.global_limit}).'
                })
    
    def save(self, *args, **kwargs):
        """Override save para validaciones."""
        self.full_clean()
        super().save(*args, **kwargs)
    
    def get_image_url(self):
        """Obtener URL de Cloudinary con transformación."""
        if not self.image:
            return None
        
        try:
            from core.cloudinary_utils import CloudinaryImageHandler
            return CloudinaryImageHandler.get_transformed_url(
                self.image,
                transformation='product_image'
            )
        except Exception:
            return None
    
    @property
    def is_available(self):
        """Verifica si el producto está disponible para compra."""
        if self.status != ProductStatus.ACTIVE or self.is_deleted:
            return False
        
        # Verificar límite global
        if self.global_limit is not None and self.total_sold >= self.global_limit:
            return False
        
        # Verificar que la tienda esté activa
        if self.store.status != 'active' or not self.store.is_verified:
            return False
        
        return True
    
    def can_purchase(self, user, quantity=1):
        """
        Verifica si un usuario puede comprar este producto.
        
        Returns: (bool, str) - (puede_comprar, mensaje_error)
        """
        if not self.is_available:
            return False, "Producto no disponible"
        
        # Verificar límite global
        if self.global_limit is not None:
            remaining = self.global_limit - self.total_sold
            if quantity > remaining:
                return False, f"Solo quedan {remaining} unidades disponibles"
        
        # Verificar límite por jugador
        if self.per_player_limit is not None and user:
            from apps.orders.models import Order
            purchased_count = Order.objects.filter(
                buyer=user,
                items__product=self,
                status__in=['completed', 'processing']
            ).count()
            
            if purchased_count + quantity > self.per_player_limit:
                remaining = self.per_player_limit - purchased_count
                return False, f"Límite por jugador: {remaining} compras restantes"
        
        return True, ""
    
    def increment_sold(self, quantity=1):
        """Incrementa el contador de ventas (operación atómica)."""
        from django.db.models import F
        Product.objects.filter(pk=self.pk).update(
            total_sold=F('total_sold') + quantity
        )
        self.refresh_from_db(fields=['total_sold'])


class ProductCommand(TimestampMixin):
    """
    Comando asociado a un producto.
    
    Define qué comandos ejecutar en diferentes eventos del ciclo de vida
    de una compra (compra, expiración, reembolso, etc.).
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='commands',
        db_index=True,
        help_text="Producto al que pertenece el comando"
    )
    
    command = models.TextField(
        max_length=1000,
        help_text="Comando a ejecutar (puede incluir variables)"
    )
    
    event = models.CharField(
        max_length=20,
        choices=CommandEvent.choices,
        default=CommandEvent.ON_PURCHASE,
        db_index=True,
        help_text="Evento que dispara el comando"
    )
    
    order = models.IntegerField(
        default=0,
        help_text="Orden de ejecución (menor = primero)"
    )

    # Configuración específica para Mod (Bedrock / PlugsEssentials)
    exec_type = models.CharField(
        max_length=6,
        choices=CommandExecType.choices,
        default=CommandExecType.PLAYER,
        help_text="Desde dónde ejecutar el comando (solo aplica para delivery_mode=PLUGIN)"
    )
    delay_seconds = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(3600)],
        help_text="Segundos de espera antes de ejecutar este comando (respecto al anterior)"
    )
    
    class Meta:
        db_table = 'product_commands'
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['product', 'event']),
            models.Index(fields=['event', 'order']),
        ]
    
    def __str__(self):
        return f"{self.product.name} - {self.event} - {self.command[:50]}"
    
    def __repr__(self):
        return f"<ProductCommand: {self.event} - {self.command[:30]}>"
    
    def clean(self):
        """Validar comando."""
        super().clean()
        
        # Validar que el comando no esté vacío
        if not self.command or not self.command.strip():
            raise ValidationError({
                'command': 'El comando no puede estar vacío.'
            })
        
        # Validar variables en el comando
        try:
            validate_command_variables(self.command)
        except ValidationError as e:
            raise ValidationError({'command': e.message})
        
        # Validar longitud
        if len(self.command) > 1000:
            raise ValidationError({
                'command': 'El comando no puede exceder 1000 caracteres.'
            })
    
    def save(self, *args, **kwargs):
        """Override save para validaciones."""
        self.full_clean()
        super().save(*args, **kwargs)
    
    def interpolate(self, context):
        """
        Interpola las variables del comando con valores reales.
        
        Args:
            context (dict): Diccionario con valores para las variables
                {
                    'username': 'Steve',
                    'uuid': '069a79f4-44e9-4726-a5be-fca90e38aaf5',
                    'price': '9.99',
                    'product_name': 'VIP Rank',
                    'transaction_id': 'txn_123',
                    'store_slug': 'my-store'
                }
        
        Returns:
            str: Comando con variables reemplazadas
        """
        command = self.command
        
        # Reemplazar cada variable
        for key, value in context.items():
            placeholder = f'{{{key}}}'
            if placeholder in command:
                command = command.replace(placeholder, str(value))
        
        return command


class DeliveryQueue(TimestampMixin):
    """
    Cola de entrega de comandos.
    
    Cuando se compra un producto, se crean entradas en esta tabla
    con los comandos ya interpolados. Esto permite:
    - Reintentos si el jugador está offline
    - Tracking de entregas
    - Auditoría de comandos ejecutados
    
    NOTA: El campo 'order' se agregará cuando el modelo Order esté implementado.
    Por ahora usamos order_id como CharField para permitir desarrollo incremental.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relación con orden (temporal hasta que Order exista)
    # TODO: Cambiar a FK cuando Order esté implementado
    order_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="ID de la orden asociada (temporal)"
    )
    
    # Comando interpolado (ya con valores reales)
    command = models.TextField(
        max_length=1000,
        help_text="Comando con variables ya reemplazadas"
    )
    
    # Estado de entrega
    status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
        db_index=True,
        help_text="Estado de la entrega"
    )
    
    # Tracking de intentos
    attempts = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Número de intentos de entrega"
    )
    last_attempt_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Última vez que se intentó entregar"
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Cuándo se entregó exitosamente"
    )
    
    # Error tracking
    error_message = models.TextField(
        blank=True,
        max_length=500,
        help_text="Mensaje de error si falló"
    )
    
    class Meta:
        db_table = 'delivery_queue'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['order_id', 'status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['status', 'attempts']),
            models.Index(fields=['-delivered_at']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(attempts__gte=0),
                name='delivery_queue_attempts_positive'
            ),
        ]
    
    def __str__(self):
        return f"Delivery {self.id} - {self.status} - {self.command[:50]}"
    
    def __repr__(self):
        return f"<DeliveryQueue: {self.status} - attempts={self.attempts}>"
    
    def mark_as_delivered(self):
        """Marca el comando como entregado."""
        from django.utils import timezone
        self.status = DeliveryStatus.DELIVERED
        self.delivered_at = timezone.now()
        self.error_message = ''
        self.save(update_fields=['status', 'delivered_at', 'error_message', 'updated_at'])
    
    def mark_as_failed(self, error_message):
        """Marca el comando como fallido."""
        from django.utils import timezone
        self.status = DeliveryStatus.FAILED
        self.error_message = error_message[:500]  # Truncar si es muy largo
        self.last_attempt_at = timezone.now()
        self.attempts += 1
        self.save(update_fields=['status', 'error_message', 'last_attempt_at', 'attempts', 'updated_at'])
    
    def mark_as_skipped(self, reason):
        """Marca el comando como omitido."""
        self.status = DeliveryStatus.SKIPPED
        self.error_message = reason[:500]
        self.save(update_fields=['status', 'error_message', 'updated_at'])
    
    def retry(self):
        """Reintentar entrega."""
        from django.utils import timezone
        self.status = DeliveryStatus.PENDING
        self.last_attempt_at = timezone.now()
        self.attempts += 1
        self.save(update_fields=['status', 'last_attempt_at', 'attempts', 'updated_at'])



class ProductImage(TimestampMixin):
    """
    Imagen adicional de un producto para galería.
    
    Permite múltiples imágenes por producto con orden personalizable.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='gallery_images',
        db_index=True,
        help_text="Producto al que pertenece la imagen"
    )
    
    image = models.CharField(
        max_length=500,
        help_text="Cloudinary public_id de la imagen"
    )
    
    order = models.IntegerField(
        default=0,
        help_text="Orden de visualización (menor = primero)"
    )
    
    class Meta:
        db_table = 'product_images'
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['product', 'order']),
        ]
    
    def __str__(self):
        return f"Image {self.order} for {self.product.name}"
    
    def __repr__(self):
        return f"<ProductImage: {self.product.name} - order={self.order}>"
    
    def get_image_url(self):
        """Obtener URL de Cloudinary con transformación."""
        if not self.image:
            return None
        
        try:
            from core.cloudinary_utils import CloudinaryImageHandler
            return CloudinaryImageHandler.get_transformed_url(
                self.image,
                transformation='product_image'
            )
        except Exception:
            return None
