from django.db import models
from core.mixins import TimestampMixin
import uuid

class Cart(TimestampMixin):
    """
    Carrito de compras de un comprador en una tienda específica.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer = models.ForeignKey(
        'users.Buyer',
        on_delete=models.CASCADE,
        related_name='carts'
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='carts'
    )
    
    class Meta:
        db_table = 'carts'
        # Un comprador solo tiene un carrito por tienda
        unique_together = ('buyer', 'store')

    def __str__(self):
        return f"Cart: {self.buyer.minecraft_username} @ {self.store.slug}"

    @property
    def total_items(self):
        return self.items.aggregate(total=models.Sum('quantity'))['total'] or 0

    @property
    def total_price(self):
        return sum(item.subtotal for item in self.items.all())


class CartItem(TimestampMixin):
    """
    Item individual dentro de un carrito.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'cart_items'
        unique_together = ('cart', 'product')

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

    @property
    def subtotal(self):
        return self.product.price * self.quantity
