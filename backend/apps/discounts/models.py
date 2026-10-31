from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.mixins import TimestampMixin, SoftDeleteMixin
import uuid
import random
import string

class DiscountType(models.TextChoices):
    PERCENTAGE = 'PERCENTAGE', 'Percentage (%)'
    FIXED_AMOUNT = 'FIXED_AMOUNT', 'Fixed Amount ($)'

class DiscountScope(models.TextChoices):
    ALL_STORE = 'ALL_STORE', 'All Store'
    SPECIFIC_PRODUCTS = 'SPECIFIC_PRODUCTS', 'Specific Products'
    SPECIFIC_CATEGORIES = 'SPECIFIC_CATEGORIES', 'Specific Categories'

class DiscountCodeType(models.TextChoices):
    GENERAL = 'GENERAL', 'General (Reusable)'
    PERSONAL = 'PERSONAL', 'Personal (Single-use)'

class Discount(TimestampMixin, SoftDeleteMixin):
    """
    Modelo de Descuentos Pro para lightcode.
    Soporta códigos generales, personales y reglas inteligentes.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='discounts'
    )
    
    name = models.CharField(max_length=100, help_text="Nombre interno del descuento")
    code = models.CharField(max_length=50, db_index=True, help_text="Código que el usuario ingresará")
    
    code_type = models.CharField(
        max_length=20,
        choices=DiscountCodeType.choices,
        default=DiscountCodeType.GENERAL
    )
    
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE
    )
    
    value = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    
    # Reglas de Aplicación
    scope = models.CharField(
        max_length=20,
        choices=DiscountScope.choices,
        default=DiscountScope.ALL_STORE
    )
    
    applicable_products = models.ManyToManyField(
        'products.Product',
        blank=True,
        related_name='discounts'
    )
    
    applicable_categories = models.ManyToManyField(
        'products.ProductCategory',
        blank=True,
        related_name='discounts'
    )
    
    # Condiciones
    min_purchase_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    min_items_count = models.PositiveIntegerField(default=0)
    only_first_purchase = models.BooleanField(default=False)
    
    # Limitaciones
    max_uses_global = models.PositiveIntegerField(
        null=True, 
        blank=True, 
        help_text="Usos totales permitidos en la tienda"
    )
    
    max_uses_per_user = models.PositiveIntegerField(
        default=1,
        help_text="Usos permitidos por cada comprador único"
    )
    
    is_combinable = models.BooleanField(
        default=False,
        help_text="¿Se puede usar junto a otros descuentos?"
    )
    
    # Tiempo
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True)
    
    # Estado
    is_active = models.BooleanField(default=True)
    
    # Metadata para analytics
    total_uses = models.PositiveIntegerField(default=0)
    total_discounted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = 'discounts'
        unique_together = ('store', 'code')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} ({self.discount_type}) - {self.store.name}"

    def is_valid(self, buyer=None, cart_total=0, cart_items_count=0, cart_products=None):
        """
        Valida si el descuento es aplicable según las reglas.
        Retorna (is_valid: bool, message: str, details: dict)
        """
        from django.utils import timezone
        now = timezone.now()
        
        # 1. Verificar si está activo
        if not self.is_active:
            return False, "El cupón no está activo", {
                'code': 'INACTIVE',
                'reason': 'Este cupón ha sido desactivado por el vendedor'
            }
        
        # 2. Verificar fecha de inicio
        if self.start_date and self.start_date > now:
            start_formatted = self.start_date.strftime('%d/%m/%Y %H:%M')
            return False, f"El cupón estará disponible desde el {start_formatted}", {
                'code': 'NOT_STARTED',
                'reason': f'Este cupón aún no está disponible',
                'start_date': start_formatted
            }
        
        # 3. Verificar fecha de expiración
        if self.end_date and self.end_date < now:
            end_formatted = self.end_date.strftime('%d/%m/%Y %H:%M')
            return False, f"El cupón expiró el {end_formatted}", {
                'code': 'EXPIRED',
                'reason': 'Este cupón ya no está disponible',
                'end_date': end_formatted
            }
        
        # 4. Verificar límite global de usos
        if self.max_uses_global and self.total_uses >= self.max_uses_global:
            return False, "El cupón ha alcanzado su límite máximo de usos", {
                'code': 'LIMIT_REACHED',
                'reason': f'Este cupón ya fue usado {self.total_uses} veces (límite: {self.max_uses_global})',
                'uses': self.total_uses,
                'max_uses': self.max_uses_global
            }
        
        # 5. Verificar monto mínimo de compra
        if cart_total < float(self.min_purchase_amount):
            return False, f"La compra mínima debe ser de ${self.min_purchase_amount}", {
                'code': 'MIN_AMOUNT_NOT_REACHED',
                'reason': f'Tu carrito tiene ${cart_total:.2f}, necesitas ${self.min_purchase_amount} para usar este cupón',
                'current': cart_total,
                'required': float(self.min_purchase_amount)
            }
        
        # 6. Verificar cantidad mínima de items
        if cart_items_count < self.min_items_count:
            return False, f"Debes tener al menos {self.min_items_count} productos en el carrito", {
                'code': 'MIN_ITEMS_NOT_REACHED',
                'reason': f'Tienes {cart_items_count} producto(s), necesitas {self.min_items_count} para usar este cupón',
                'current': cart_items_count,
                'required': self.min_items_count
            }
        
        # 7. Verificar alcance del descuento (productos específicos)
        if self.scope == DiscountScope.SPECIFIC_PRODUCTS and cart_products:
            applicable_product_ids = set(self.applicable_products.values_list('id', flat=True))
            cart_product_ids = set(cart_products)
            
            # Verificar si hay al menos un producto aplicable en el carrito
            if not applicable_product_ids.intersection(cart_product_ids):
                return False, "Este cupón no aplica a los productos en tu carrito", {
                    'code': 'PRODUCTS_NOT_APPLICABLE',
                    'reason': 'Este cupón solo aplica a productos específicos que no están en tu carrito',
                    'applicable_count': len(applicable_product_ids)
                }
        
        # 8. Verificar alcance del descuento (categorías específicas)
        if self.scope == DiscountScope.SPECIFIC_CATEGORIES and cart_products:
            from apps.products.models import Product
            
            # Obtener categorías aplicables
            applicable_category_ids = set(self.applicable_categories.values_list('id', flat=True))
            
            # Obtener categorías de los productos en el carrito
            cart_categories = Product.objects.filter(
                id__in=cart_products
            ).values_list('category_id', flat=True)
            cart_category_ids = set(cart_categories)
            
            # Verificar si hay al menos una categoría aplicable
            if not applicable_category_ids.intersection(cart_category_ids):
                return False, "Este cupón no aplica a las categorías de productos en tu carrito", {
                    'code': 'CATEGORIES_NOT_APPLICABLE',
                    'reason': 'Este cupón solo aplica a categorías específicas que no están en tu carrito',
                    'applicable_count': len(applicable_category_ids)
                }
        
        # 9. Verificar si es solo para primera compra
        if self.only_first_purchase and buyer:
            # Aquí se verificaría si el buyer ya ha hecho compras antes
            # Por ahora es un placeholder
            pass
        
        # 10. Verificar usos por usuario
        if buyer and self.max_uses_per_user:
            from .models import DiscountUsage
            user_uses = DiscountUsage.objects.filter(
                discount=self,
                buyer=buyer
            ).count()
            
            if user_uses >= self.max_uses_per_user:
                return False, f"Ya has usado este cupón {user_uses} vez(ces)", {
                    'code': 'USER_LIMIT_REACHED',
                    'reason': f'Solo puedes usar este cupón {self.max_uses_per_user} vez(ces)',
                    'uses': user_uses,
                    'max_uses': self.max_uses_per_user
                }
        
        # Si pasa todas las validaciones
        return True, "Cupón válido", {
            'code': 'VALID',
            'discount_type': self.discount_type,
            'value': float(self.value)
        }

    @staticmethod
    def generate_random_code(length=8):
        """Genera un código aleatorio único."""
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

class DiscountUsage(TimestampMixin):
    """
    Registra cada vez que se usa un descuento para analytics y control de límites.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    discount = models.ForeignKey(Discount, on_delete=models.CASCADE, related_name='usages')
    buyer = models.ForeignKey('users.Buyer', on_delete=models.CASCADE, related_name='discount_usages')
    # order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='discount_usages')
    amount_saved = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'discount_usages'
