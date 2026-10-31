"""
Store serializers - Validación y transformación de datos.
"""
from rest_framework import serializers
from django.db import transaction
import bleach
import logging
from .models import Store, StoreSettings, RESERVED_SLUGS

logger = logging.getLogger(__name__)


class StoreListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listado de tiendas."""
    
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    logo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'slug',
            'tagline',
            'logo_url',
            'primary_color',
            'status',
            'is_verified',
            'owner_username',
            'total_products',
            'total_orders',
            'created_at',
        ]
        read_only_fields = fields
    
    def get_logo_url(self, obj):
        return obj.get_logo_url()


class StoreCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear tiendas con validaciones de negocio."""
    
    name = serializers.CharField(max_length=50, min_length=3)
    slug = serializers.CharField(max_length=30, min_length=3, required=False, allow_blank=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    
    # Archivos opcionales (se manejarán después)
    logo_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    banner_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Store
        fields = [
            'name',
            'slug',
            'description',
            'tagline',
            'currency',
            'timezone',
            'language',
            'email',
            'phone',
            'discord_invite',
            'minecraft_server_ip',
            'minecraft_server_port',
            'logo_file',
            'banner_file',
        ]
    
    def validate_name(self, value):
        """Validar nombre de tienda."""
        value = bleach.clean(value.strip(), tags=[], strip=True)
        
        if len(value) < 3:
            raise serializers.ValidationError(
                "El nombre debe tener al menos 3 caracteres."
            )
        
        if len(value) > 50:
            raise serializers.ValidationError(
                "El nombre no puede exceder 50 caracteres."
            )
        
        return value
    
    def validate_slug(self, value):
        """Validar slug único y no reservado."""
        if not value:
            return value  # Se auto-generará en el modelo
        
        value = value.lower().strip()
        
        if not value.replace('-', '').isalnum():
            raise serializers.ValidationError(
                "El slug solo puede contener letras, números y guiones."
            )
        
        if len(value) < 3:
            raise serializers.ValidationError("El slug debe tener al menos 3 caracteres.")
        
        if len(value) > 30:
            raise serializers.ValidationError("El slug no puede exceder 30 caracteres.")
        
        # Verificar palabras reservadas
        if value in RESERVED_SLUGS:
            raise serializers.ValidationError(
                f'"{value}" es una palabra reservada y no puede usarse.'
            )
        
        # Verificar unicidad
        if Store.objects.filter(slug=value).exists():
            raise serializers.ValidationError(
                f'Ya existe una tienda con el slug "{value}".'
            )
        
        return value
    
    def validate_email(self, value):
        """Validar email si se proporciona."""
        if value:
            value = value.strip().lower()
        return value
    
    def validate_discord_invite(self, value):
        """Validar URL de Discord."""
        if value and not value.startswith('https://discord.gg/'):
            raise serializers.ValidationError(
                "La URL de Discord debe comenzar con https://discord.gg/"
            )
        return value
    
    def validate_minecraft_server_port(self, value):
        """Validar puerto de Minecraft."""
        # Si es string vacío, convertir a None
        if value == '' or value is None:
            return None
            
        # Convertir a int si es string
        if isinstance(value, str):
            try:
                value = int(value)
            except ValueError:
                raise serializers.ValidationError(
                    "El puerto debe ser un número válido."
                )
        
        if value < 1 or value > 65535:
            raise serializers.ValidationError(
                "El puerto debe estar entre 1 y 65535."
            )
        
        return value
    
    def validate(self, attrs):
        """Validaciones a nivel de objeto."""
        request = self.context.get('request')
        
        if not request or not request.user:
            raise serializers.ValidationError("Autenticación requerida.")
        
        user = request.user
        
        # Verificar que el usuario sea seller
        if user.user_type != 'seller':
            raise serializers.ValidationError({
                'error': 'Solo los vendedores pueden crear tiendas.'
            })
        
        # Verificar que tenga seller_profile
        if not hasattr(user, 'seller_profile'):
            raise serializers.ValidationError({
                'error': 'Perfil de vendedor no encontrado.'
            })
        
        seller = user.seller_profile
        
        # White-label: No store limits (single store per instance)
        
        return attrs
    
    @transaction.atomic
    def create(self, validated_data):
        """Crear tienda con configuración por defecto."""
        from core.cloudinary_utils import upload_store_logo, upload_store_banner
        
        # Extraer archivos
        logo_file = validated_data.pop('logo_file', None)
        banner_file = validated_data.pop('banner_file', None)
        
        # Obtener usuario del contexto
        request = self.context.get('request')
        validated_data['owner'] = request.user
        
        # Crear tienda
        store = Store.objects.create(**validated_data)
        
        # Subir logo a Cloudinary si existe
        if logo_file:
            try:
                logger.info(f"Uploading logo during creation for store {store.id}")
                result = upload_store_logo(logo_file, store.id)
                store.logo = result['public_id']
                store.save(update_fields=['logo'])
                logger.info(f"Logo uploaded during creation: {result['public_id']}")
            except Exception as e:
                logger.error(f"Error uploading logo during creation: {str(e)}")
        
        # Subir banner a Cloudinary si existe
        if banner_file:
            try:
                logger.info(f"Uploading banner during creation for store {store.id}")
                result = upload_store_banner(banner_file, store.id)
                store.banner = result['public_id']
                store.save(update_fields=['banner'])
                logger.info(f"Banner uploaded during creation: {result['public_id']}")
            except Exception as e:
                logger.error(f"Error uploading banner during creation: {str(e)}")
        
        # Actualizar contador del seller
        seller = request.user.seller_profile
        seller.total_stores = Store.objects.filter(
            owner=request.user,
            is_deleted=False
        ).count()
        
        # Marcar onboarding como completado si es la primera tienda
        if seller.total_stores == 1 and not seller.onboarding_completed:
            seller.onboarding_completed = True
            seller.onboarding_step = 'completed'
            seller.save(update_fields=['total_stores', 'onboarding_completed', 'onboarding_step'])
            logger.info(f"Onboarding completed for seller {request.user.username}")
        else:
            seller.save(update_fields=['total_stores'])
        
        return store
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Actualizar tienda con soporte para archivos."""
        from core.cloudinary_utils import upload_store_logo, upload_store_banner, CloudinaryImageHandler
        from django.conf import settings
        
        # Extraer archivos
        logo_file = validated_data.pop('logo_file', None)
        banner_file = validated_data.pop('banner_file', None)
        
        logger.info(f"Update store {instance.id}: logo_file={logo_file}, banner_file={banner_file}")
        
        # Actualizar campos básicos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Subir logo a Cloudinary si existe
        if logo_file:
            try:
                logger.info(f"Uploading logo for store {instance.id}")
                # Eliminar logo anterior si existe
                if instance.logo:
                    CloudinaryImageHandler.delete_image(instance.logo)
                
                result = upload_store_logo(logo_file, instance.id)
                instance.logo = result['public_id']
                instance.save(update_fields=['logo'])
                logger.info(f"Logo uploaded successfully: {result['public_id']}")
            except Exception as e:
                logger.error(f"Error uploading logo: {str(e)}", exc_info=True)
        
        # Subir banner a Cloudinary si existe
        if banner_file:
            try:
                logger.info(f"Uploading banner for store {instance.id}")
                # Eliminar banner anterior si existe
                if instance.banner:
                    CloudinaryImageHandler.delete_image(instance.banner)
                
                result = upload_store_banner(banner_file, instance.id)
                instance.banner = result['public_id']
                instance.save(update_fields=['banner'])
                logger.info(f"Banner uploaded successfully: {result['public_id']}")
            except Exception as e:
                logger.error(f"Error uploading banner: {str(e)}", exc_info=True)
        
        return instance


class StoreDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalles de tienda."""
    
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    can_add_product = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'tagline',
            'logo',
            'logo_url',
            'banner',
            'banner_url',
            'primary_color',
            'secondary_color',
            'currency',
            'timezone',
            'language',
            'email',
            'phone',
            'discord_invite',
            'minecraft_server_ip',
            'minecraft_server_port',
            'minecraft_version',
            'status',
            'is_verified',
            'verified_at',
            'total_products',
            'total_orders',
            'total_revenue',
            'total_buyers',
            'views_count',
            'owner_username',
            'can_add_product',
            'paypal_email',  # PayPal configuration
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'slug',
            'is_verified',
            'verified_at',
            'total_products',
            'total_orders',
            'total_revenue',
            'total_buyers',
            'views_count',
            'created_at',
            'updated_at',
        ]
    
    def get_logo_url(self, obj):
        return obj.get_logo_url()
    
    def get_banner_url(self, obj):
        return obj.get_banner_url()


class StoreSettingsSerializer(serializers.ModelSerializer):
    """Serializer para configuración de tienda."""
    
    class Meta:
        model = StoreSettings
        fields = [
            'email_notifications',
            'discord_notifications',
            'discord_webhook_url',
            'auto_deliver',
            'require_minecraft_verification',
            'allow_guest_checkout',
            'payment_methods',
            'tax_rate',
            'terms_of_service',
            'refund_policy',
            'privacy_policy',
            'advanced_settings',
        ]
    
    def validate_tax_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "La tasa de impuesto debe estar entre 0 y 100."
            )
        return value
    
    def validate_discord_webhook_url(self, value):
        if value and not value.startswith('https://discord.com/api/webhooks/'):
            raise serializers.ValidationError(
                "URL de webhook de Discord inválida."
            )
        return value
