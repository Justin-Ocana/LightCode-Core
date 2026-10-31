"""
Serializers for user authentication and management - Simplified for white-label.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Seller, Buyer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Base user serializer."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'user_type', 'is_superuser', 'is_staff', 'created_at'
        ]
        read_only_fields = ['id', 'user_type', 'is_superuser', 'is_staff', 'created_at']


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Contraseña actual incorrecta")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class SellerProfileSerializer(serializers.ModelSerializer):
    """Seller profile serializer - Simplified."""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Seller
        fields = [
            'id', 'user', 'total_stores', 'total_sales', 'total_revenue', 'created_at'
        ]
        read_only_fields = [
            'id', 'total_stores', 'total_sales', 'total_revenue', 'created_at'
        ]


class BuyerProfileSerializer(serializers.ModelSerializer):
    """Buyer profile serializer."""
    user = UserSerializer(read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = Buyer
        fields = [
            'id', 'user', 'store', 'store_name', 'minecraft_username',
            'minecraft_uuid', 'total_purchases', 'total_spent', 'is_banned', 'created_at'
        ]
        read_only_fields = [
            'id', 'store', 'total_purchases', 'total_spent',
            'is_banned', 'created_at'
        ]


# ============= REGISTRATION SERIALIZERS =============

class SellerRegistrationSerializer(serializers.Serializer):
    """
    Seller registration - Simplified (no beta keys needed).
    """
    username = serializers.CharField(max_length=30, min_length=3)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=8, max_length=128)
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    
    def validate_username(self, value):
        """Check if username exists for sellers."""
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("El nombre de usuario debe tener al menos 3 caracteres")
        if User.objects.filter(username=value, user_type='seller').exists():
            raise serializers.ValidationError("Este nombre de usuario ya está en uso")
        return value
    
    def validate_email(self, value):
        """Check if email exists for sellers."""
        value = value.strip().lower()
        if User.objects.filter(email=value, user_type='seller').exists():
            raise serializers.ValidationError("Este email ya está registrado")
        return value
    
    def validate_password(self, value):
        """Validate password strength."""
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value
    
    def validate(self, data):
        """Validate passwords match."""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                "password_confirm": "Las contraseñas no coinciden"
            })
        return data
    
    def create(self, validated_data):
        """Create seller user and profile."""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            user_type='seller'
        )
        user.set_password(password)
        user.save()
        
        # Create seller profile
        Seller.objects.create(user=user)
        
        return user


class BuyerRegistrationSerializer(serializers.Serializer):
    """
    Buyer registration - SIMPLIFIED
    Required: email, password
    Optional: minecraft_username
    """
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=8, max_length=128)
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})
    minecraft_username = serializers.CharField(max_length=16, min_length=3, required=False, allow_blank=True)
    
    def __init__(self, *args, **kwargs):
        self.store = kwargs.pop('store', None)
        super().__init__(*args, **kwargs)
    
    def validate_minecraft_username(self, value):
        """Check if Minecraft username exists in THIS store (optional field)."""
        if not value or not value.strip():
            return None
            
        value = value.strip()
        if len(value) < 3 or len(value) > 16:
            raise serializers.ValidationError("El nombre de Minecraft debe tener entre 3 y 16 caracteres")
        
        if self.store and Buyer.objects.filter(
            store=self.store,
            minecraft_username=value
        ).exists():
            raise serializers.ValidationError(
                "Este usuario de Minecraft ya está registrado en esta tienda"
            )
        return value

    def validate_email(self, value):
        """Normalize and validate email."""
        value = value.strip().lower()
        
        # Check if email already exists for this store
        if self.store:
            existing_buyer = Buyer.objects.filter(
                store=self.store,
                user__email=value
            ).first()
            if existing_buyer:
                raise serializers.ValidationError(
                    "Este email ya está registrado en esta tienda"
                )
        
        return value
    
    def validate(self, data):
        """Validate passwords match."""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        
        try:
            validate_password(data['password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        
        return data
    
    def create(self, validated_data):
        """Create buyer user and profile for specific store."""
        if not self.store:
            raise serializers.ValidationError("Store context required")
        
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        minecraft_username = validated_data.pop('minecraft_username', None)
        email = validated_data['email']
        
        # Check if user with this email already exists as buyer
        user = User.objects.filter(
            email=email,
            user_type='buyer'
        ).first()
        
        if not user:
            # Generate unique username from email
            base_username = email.split('@')[0][:20]  # Max 20 chars from email
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                user_type='buyer'
            )
        
        # Check if this user is already a buyer in THIS store
        if Buyer.objects.filter(user=user, store=self.store).exists():
            raise serializers.ValidationError(
                "Ya tienes una cuenta registrada en esta tienda con este email"
            )
        
        # Create buyer profile for THIS store
        # If minecraft_username is empty, use a default based on username
        if not minecraft_username or not minecraft_username.strip():
            minecraft_username = user.username[:16]  # Max 16 chars for Minecraft
        
        buyer = Buyer.objects.create(
            user=user,
            store=self.store,
            minecraft_username=minecraft_username
        )
        
        return buyer


# ============= LOGIN SERIALIZERS =============

class SellerLoginSerializer(serializers.Serializer):
    """Seller login at /admin/login"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.strip().lower()


class BuyerLoginSerializer(serializers.Serializer):
    """Buyer login - SIMPLIFIED: only email and password required"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.strip().lower()
        return value.strip().lower()


class AdminLoginSerializer(serializers.Serializer):
    """Admin login - same as seller login."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.strip().lower()
