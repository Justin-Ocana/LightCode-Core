"""
Product serializers - Validación y transformación de datos.
"""
from rest_framework import serializers
from django.db import transaction
from django.utils.text import slugify
import bleach
import logging
from .models import (
    Product, ProductCommand, DeliveryQueue, ProductCategory, ProductImage,
    PurchaseType, SubscriptionInterval,
    DeliveryMode, ProductStatus, CommandEvent,
    validate_command_variables
)

logger = logging.getLogger(__name__)


class ProductCategorySerializer(serializers.ModelSerializer):
    """Serializer para categorías de productos."""
    
    is_custom = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'is_default',
            'is_custom',
            'sort_order',
            'products_count',
            'created_at',
        ]
        read_only_fields = ['id', 'is_default', 'created_at']
    
    def get_is_custom(self, obj):
        """Indica si es categoría personalizada."""
        return not obj.is_default
    
    def get_products_count(self, obj):
        """Número de productos en esta categoría."""
        return obj.products.filter(status=ProductStatus.ACTIVE, is_deleted=False).count()


class ProductCategoryCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear categorías personalizadas."""
    
    class Meta:
        model = ProductCategory
        fields = [
            'name',
            'slug',
            'description',
            'icon',
            'sort_order',
        ]
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }
    
    def validate_name(self, value):
        """Validar nombre."""
        value = bleach.clean(value.strip(), tags=[], strip=True)
        
        if len(value) < 2:
            raise serializers.ValidationError("El nombre debe tener al menos 2 caracteres.")
        
        if len(value) > 100:
            raise serializers.ValidationError("El nombre no puede exceder 100 caracteres.")
        
        return value
    
    def validate_description(self, value):
        """Sanitizar descripción."""
        if not value:
            return value
        return bleach.clean(value.strip(), tags=[], strip=True)
    
    def validate_slug(self, value):
        """Validar slug."""
        if not value:
            return value  # Se auto-generará
        
        value = value.lower().strip()
        
        # Verificar formato
        if not value.replace('-', '').replace('_', '').isalnum():
            raise serializers.ValidationError(
                "El slug solo puede contener letras, números, guiones y guiones bajos."
            )
        
        return value
    
    def validate(self, attrs):
        """Validaciones a nivel de objeto."""
        request = self.context.get('request')
        store = self.context.get('store')
        
        if not store:
            raise serializers.ValidationError("Se requiere una tienda.")
        
        # Verificar que el usuario sea el owner
        if request and request.user != store.owner:
            raise serializers.ValidationError("No tienes permiso para crear categorías en esta tienda.")
        
        # Auto-generar slug si no existe
        if not attrs.get('slug'):
            attrs['slug'] = slugify(attrs['name'])
        
        # White-label: No category limits
        
        return attrs
    
    def create(self, validated_data):
        """Crear categoría personalizada."""
        store = self.context.get('store')
        validated_data['store'] = store
        validated_data['is_default'] = False
        
        return ProductCategory.objects.create(**validated_data)


class ProductCommandSerializer(serializers.ModelSerializer):
    """Serializer para comandos de producto."""
    
    class Meta:
        model = ProductCommand
        fields = [
            'id',
            'command',
            'event',
            'order',
            'exec_type',
            'delay_seconds',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate_command(self, value):
        """Validar comando — permite {player} además de las variables estándar."""
        if not value or not value.strip():
            raise serializers.ValidationError("El comando no puede estar vacío.")
        return value.strip()


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listado de productos."""
    
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    currency = serializers.CharField(source='store.currency', read_only=True)
    image_url = serializers.SerializerMethodField()
    is_available = serializers.BooleanField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'image_url',
            'price',
            'category',
            'category_name',
            'category_icon',
            'purchase_type',
            'subscription_interval',
            'status',
            'total_sold',
            'is_available',
            'store_name',
            'store_slug',
            'currency',
            'sort_order',
            'created_at',
        ]
        read_only_fields = fields
    
    def get_image_url(self, obj):
        return obj.get_image_url()


class ProductDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalles de producto."""
    
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    currency = serializers.CharField(source='store.currency', read_only=True)
    image_url = serializers.SerializerMethodField()
    is_available = serializers.BooleanField(read_only=True)
    category_data = ProductCategorySerializer(source='category', read_only=True)
    commands = ProductCommandSerializer(many=True, read_only=True)
    gallery_images = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'content',
            'image',
            'image_url',
            'show_gallery',
            'gallery_images',
            'price',
            'category',
            'category_data',
            'purchase_type',
            'subscription_interval',
            'global_limit',
            'per_player_limit',
            'require_online',
            'command_delay',
            'delivery_mode',
            'status',
            'sort_order',
            'total_sold',
            'is_available',
            'store_name',
            'store_slug',
            'currency',
            'commands',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'total_sold',
            'is_available',
            'created_at',
            'updated_at',
        ]
    
    def get_content(self, obj):
        """Parse content from JSON string to array."""
        import json
        if not obj.content:
            return []
        try:
            if isinstance(obj.content, str):
                return json.loads(obj.content)
            return obj.content if isinstance(obj.content, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    def get_image_url(self, obj):
        return obj.get_image_url()
    
    def get_gallery_images(self, obj):
        """Imágenes de galería ordenadas (definición de ProductImageSerializer más abajo)."""
        qs = obj.gallery_images.all().order_by('order', 'created_at')
        return ProductImageSerializer(qs, many=True).data


class ProductCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear productos."""
    
    name = serializers.CharField(max_length=100, min_length=3)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01, max_value=9999.99)
    
    # Archivo de imagen opcional
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    
    # Comandos inline (opcional al crear)
    commands = ProductCommandSerializer(many=True, required=False)
    
    class Meta:
        model = Product
        fields = [
            'store',
            'name',
            'description',
            'content',
            'image_file',
            'show_gallery',
            'price',
            'category',
            'purchase_type',
            'subscription_interval',
            'global_limit',
            'per_player_limit',
            'require_online',
            'command_delay',
            'delivery_mode',
            'status',
            'sort_order',
            'commands',
        ]
    
    def validate_name(self, value):
        """Validar nombre."""
        value = bleach.clean(value.strip(), tags=[], strip=True)
        
        if len(value) < 3:
            raise serializers.ValidationError("El nombre debe tener al menos 3 caracteres.")
        
        if len(value) > 100:
            raise serializers.ValidationError("El nombre no puede exceder 100 caracteres.")
        
        return value

    def validate_description(self, value):
        """Sanitizar descripción."""
        if not value:
            return value
        return bleach.clean(value.strip(), tags=[], strip=True)

    def validate_content(self, value):
        """Sanitizar contenido (lista de items {icon, text})."""
        if not value:
            return []
        
        if not isinstance(value, list):
            # Si por alguna razón llega como string (JSON string sin parsear), DRF JSONField ya debería haberlo parseado
            # pero por seguridad manejamos el caso
            return value

        # Sanitizar cada item de la lista
        sanitized_list = []
        allowed_tags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3']
        
        for item in value:
            if not isinstance(item, dict):
                continue
            
            icon = item.get('icon', '')
            text = item.get('text', '')
            
            # Sanitizar icono (sin tags)
            sanitized_icon = bleach.clean(str(icon).strip(), tags=[], strip=True)
            # Sanitizar texto (con tags de formato permitidos)
            sanitized_text = bleach.clean(str(text).strip(), tags=allowed_tags, strip=True)
            
            sanitized_list.append({
                'icon': sanitized_icon,
                'text': sanitized_text
            })
            
        return sanitized_list
    
    def validate(self, attrs):
        """Validaciones a nivel de objeto."""
        # Validar suscripción
        if attrs.get('purchase_type') == PurchaseType.SUBSCRIPTION:
            if not attrs.get('subscription_interval'):
                raise serializers.ValidationError({
                    'subscription_interval': 'Las suscripciones deben tener un intervalo.'
                })
        else:
            if attrs.get('subscription_interval'):
                attrs['subscription_interval'] = None
        
        # Validar límites
        if attrs.get('global_limit') is not None and attrs['global_limit'] < 1:
            raise serializers.ValidationError({
                'global_limit': 'El límite global debe ser al menos 1.'
            })
        
        if attrs.get('per_player_limit') is not None and attrs['per_player_limit'] < 1:
            raise serializers.ValidationError({
                'per_player_limit': 'El límite por jugador debe ser al menos 1.'
            })
        
        # Validar que la tienda pertenezca al usuario
        request = self.context.get('request')
        if request and request.user:
            store = attrs.get('store')
            if store and store.owner != request.user:
                raise serializers.ValidationError({
                    'store': 'No tienes permiso para crear productos en esta tienda.'
                })
            
            # Validar que la categoría pertenezca a la tienda
            category = attrs.get('category')
            if category:
                if category.store != store:
                    raise serializers.ValidationError({
                        'category': 'La categoría no pertenece a esta tienda.'
                    })
            
            # White-label: No product limits
        
        return attrs
    
    @transaction.atomic
    def create(self, validated_data):
        """Crear producto con comandos opcionales."""
        from core.cloudinary_utils import CloudinaryImageHandler
        from django.conf import settings
        
        # Extraer datos relacionados
        image_file = validated_data.pop('image_file', None)
        commands_data = validated_data.pop('commands', [])
        
        # Crear producto
        product = Product.objects.create(**validated_data)
        
        # Subir imagen a Cloudinary si existe
        if image_file:
            try:
                from core.cloudinary_utils import CloudinaryImageHandler
                result = CloudinaryImageHandler.upload_image(
                    image_file,
                    folder=f'products/{product.store.slug}',
                    public_id=f'product_{product.id}',
                    transformation='product_image'
                )
                product.image = result['public_id']
                product.save(update_fields=['image'])
            except Exception as e:
                logger.error(f"Error uploading product image: {str(e)}")
                # Opcional: podrías lanzar un error aquí si quieres que la creación falle
                # pero es mejor dejar que el producto se cree sin imagen si el error es de Cloudinary
        
        # Crear comandos si se proporcionaron
        for cmd_data in commands_data:
            ProductCommand.objects.create(product=product, **cmd_data)
        
        # Actualizar contador de productos en la tienda
        from django.db.models import F
        product.store.__class__.objects.filter(pk=product.store.pk).update(
            total_products=F('total_products') + 1
        )
        
        return product


class ProductUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar productos."""
    
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Product
        fields = [
            'name',
            'description',
            'content',
            'image_file',
            'show_gallery',
            'price',
            'category',
            'purchase_type',
            'subscription_interval',
            'global_limit',
            'per_player_limit',
            'require_online',
            'command_delay',
            'delivery_mode',
            'status',
            'sort_order',
        ]
    
    def validate(self, attrs):
        """Validaciones."""
        # Validar suscripción
        purchase_type = attrs.get('purchase_type', self.instance.purchase_type)
        subscription_interval = attrs.get('subscription_interval', self.instance.subscription_interval)
        
        if purchase_type == PurchaseType.SUBSCRIPTION:
            if not subscription_interval:
                raise serializers.ValidationError({
                    'subscription_interval': 'Las suscripciones deben tener un intervalo.'
                })
        else:
            attrs['subscription_interval'] = None
        
        return attrs
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Actualizar producto."""
        from core.cloudinary_utils import CloudinaryImageHandler
        from django.conf import settings
        
        # Extraer imagen
        image_file = validated_data.pop('image_file', None)
        
        # Actualizar campos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Actualizar imagen si se proporciona
        if image_file:
            try:
                # Eliminar imagen anterior
                if instance.image:
                    CloudinaryImageHandler.delete_image(instance.image)
                
                # Subir nueva
                result = CloudinaryImageHandler.upload_image(
                    image_file,
                    folder=f'products/{instance.store.slug}',
                    public_id=f'product_{instance.id}',
                    transformation='product_image'
                )
                instance.image = result['public_id']
                instance.save(update_fields=['image'])
            except Exception as e:
                logger.error(f"Error updating product image: {str(e)}")
        
        return instance


class DeliveryQueueSerializer(serializers.ModelSerializer):
    """Serializer para cola de entrega."""
    
    class Meta:
        model = DeliveryQueue
        fields = [
            'id',
            'order_id',
            'command',
            'status',
            'attempts',
            'last_attempt_at',
            'delivered_at',
            'error_message',
            'created_at',
        ]
        read_only_fields = fields



class ProductImageSerializer(serializers.ModelSerializer):
    """Serializer para imágenes de galería de productos."""
    
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductImage
        fields = [
            'id',
            'image',
            'image_url',
            'order',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_image_url(self, obj):
        return obj.get_image_url()


class ProductImageCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear imágenes de galería."""
    
    image_file = serializers.ImageField(write_only=True, required=True)
    
    class Meta:
        model = ProductImage
        fields = ['image_file', 'order']
    
    def create(self, validated_data):
        import uuid
        from core.cloudinary_utils import CloudinaryImageHandler
        from django.conf import settings
        
        image_file = validated_data.pop('image_file')
        product = self.context.get('product')
        
        if not product:
            raise serializers.ValidationError("Se requiere un producto.")
        
        # Subir imagen a Cloudinary
        try:
            result = CloudinaryImageHandler.upload_image(
                image_file,
                folder=f'products/{product.store.slug}/gallery',
                public_id=f'gallery_{product.id}_{uuid.uuid4().hex[:8]}'
            )
            validated_data['image'] = result['public_id']
        except Exception as e:
            logger.error(f"Error uploading gallery image: {str(e)}")
            raise serializers.ValidationError("Error al subir la imagen.")
        
        validated_data['product'] = product
        return ProductImage.objects.create(**validated_data)
