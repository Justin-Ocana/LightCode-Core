"""
Ejemplos de uso del sistema de productos.

Este archivo muestra cómo usar los modelos y utilidades de productos.
NO ejecutar en producción - solo para referencia.
"""
from apps.products.models import Product, ProductCommand, DeliveryQueue, CommandEvent
from apps.products.utils import create_delivery_queue_for_order
from apps.stores.models import Store
from apps.users.models import User


def example_create_rank_product():
    """Ejemplo: Crear un producto de tipo RANK."""
    
    # Obtener tienda
    store = Store.objects.first()
    
    # Crear producto
    product = Product.objects.create(
        store=store,
        name="VIP Rank",
        description="Rango VIP con beneficios exclusivos",
        price=9.99,
        category="RANK",
        purchase_type="ONE_TIME",
        delivery_mode="RCON",
        status="ACTIVE",
        sort_order=0
    )
    
    # Agregar comandos
    ProductCommand.objects.create(
        product=product,
        command="lp user {username} parent set vip",
        event=CommandEvent.ON_PURCHASE,
        order=0
    )
    
    ProductCommand.objects.create(
        product=product,
        command="broadcast {username} compró VIP!",
        event=CommandEvent.ON_PURCHASE,
        order=1
    )
    
    print(f"✅ Producto creado: {product.name}")
    return product


def example_create_subscription_product():
    """Ejemplo: Crear un producto de suscripción."""
    
    store = Store.objects.first()
    
    product = Product.objects.create(
        store=store,
        name="VIP Mensual",
        description="Suscripción VIP renovable cada mes",
        price=4.99,
        category="SUBSCRIPTION",
        purchase_type="SUBSCRIPTION",
        subscription_interval="MONTHLY",
        delivery_mode="RCON",
        status="ACTIVE"
    )
    
    # Comando al comprar
    ProductCommand.objects.create(
        product=product,
        command="lp user {username} parent set vip",
        event=CommandEvent.ON_PURCHASE,
        order=0
    )
    
    # Comando al expirar
    ProductCommand.objects.create(
        product=product,
        command="lp user {username} parent remove vip",
        event=CommandEvent.ON_EXPIRY,
        order=0
    )
    
    # Comando al renovar
    ProductCommand.objects.create(
        product=product,
        command="lp user {username} parent set vip",
        event=CommandEvent.ON_RENEWAL,
        order=0
    )
    
    print(f"✅ Suscripción creada: {product.name}")
    return product


def example_create_kit_product():
    """Ejemplo: Crear un kit con múltiples comandos."""
    
    store = Store.objects.first()
    
    product = Product.objects.create(
        store=store,
        name="Starter Kit",
        description="Kit inicial con items básicos",
        price=2.99,
        category="KIT",
        purchase_type="ONE_TIME",
        per_player_limit=1,  # Solo 1 por jugador
        delivery_mode="RCON",
        status="ACTIVE"
    )
    
    # Múltiples comandos en secuencia
    commands = [
        "give {username} diamond_sword 1",
        "give {username} diamond_pickaxe 1",
        "give {username} diamond_axe 1",
        "give {username} golden_apple 16",
        "eco give {username} 1000",
    ]
    
    for i, cmd in enumerate(commands):
        ProductCommand.objects.create(
            product=product,
            command=cmd,
            event=CommandEvent.ON_PURCHASE,
            order=i
        )
    
    print(f"✅ Kit creado: {product.name} con {len(commands)} comandos")
    return product


def example_create_delivery_queue():
    """Ejemplo: Crear cola de entrega para una compra."""
    
    # Obtener producto
    product = Product.objects.filter(category="RANK").first()
    
    if not product:
        print("❌ No hay productos de tipo RANK")
        return
    
    # Contexto de la compra
    context = {
        'username': 'Steve',
        'uuid': '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        'price': str(product.price),
        'product_name': product.name,
        'transaction_id': 'txn_example_123',
        'store_slug': product.store.slug
    }
    
    # Crear cola de entrega
    queue_entries = create_delivery_queue_for_order(
        order_id='order_example_123',
        product=product,
        context=context,
        event=CommandEvent.ON_PURCHASE
    )
    
    print(f"✅ Cola de entrega creada: {len(queue_entries)} comandos")
    
    for entry in queue_entries:
        print(f"   - {entry.command}")
    
    return queue_entries


def example_check_availability():
    """Ejemplo: Verificar disponibilidad de un producto."""
    
    product = Product.objects.first()
    user = User.objects.filter(user_type='buyer').first()
    
    if not product or not user:
        print("❌ Necesitas productos y usuarios para este ejemplo")
        return
    
    # Verificar disponibilidad
    can_purchase, error_msg = product.can_purchase(user, quantity=1)
    
    if can_purchase:
        print(f"✅ {user.username} puede comprar {product.name}")
    else:
        print(f"❌ {user.username} NO puede comprar {product.name}: {error_msg}")
    
    # Mostrar info del producto
    print(f"\nInfo del producto:")
    print(f"  - Precio: ${product.price}")
    print(f"  - Vendidos: {product.total_sold}")
    print(f"  - Límite global: {product.global_limit or 'Ilimitado'}")
    print(f"  - Límite por jugador: {product.per_player_limit or 'Ilimitado'}")
    print(f"  - Estado: {product.status}")


def example_interpolate_command():
    """Ejemplo: Interpolar variables en un comando."""
    
    product = Product.objects.first()
    
    if not product:
        print("❌ No hay productos")
        return
    
    command = product.commands.first()
    
    if not command:
        print("❌ El producto no tiene comandos")
        return
    
    # Contexto de ejemplo
    context = {
        'username': 'Notch',
        'uuid': '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        'price': '19.99',
        'product_name': 'Admin Rank',
        'transaction_id': 'txn_abc123',
        'store_slug': 'my-awesome-store'
    }
    
    # Interpolar
    original = command.command
    interpolated = command.interpolate(context)
    
    print(f"Comando original:")
    print(f"  {original}")
    print(f"\nComando interpolado:")
    print(f"  {interpolated}")


def run_all_examples():
    """Ejecutar todos los ejemplos."""
    print("=" * 60)
    print("EJEMPLOS DE USO - SISTEMA DE PRODUCTOS")
    print("=" * 60)
    
    print("\n1. Crear producto RANK")
    print("-" * 60)
    example_create_rank_product()
    
    print("\n2. Crear producto SUBSCRIPTION")
    print("-" * 60)
    example_create_subscription_product()
    
    print("\n3. Crear producto KIT")
    print("-" * 60)
    example_create_kit_product()
    
    print("\n4. Crear cola de entrega")
    print("-" * 60)
    example_create_delivery_queue()
    
    print("\n5. Verificar disponibilidad")
    print("-" * 60)
    example_check_availability()
    
    print("\n6. Interpolar comando")
    print("-" * 60)
    example_interpolate_command()
    
    print("\n" + "=" * 60)
    print("✅ Ejemplos completados")
    print("=" * 60)


if __name__ == '__main__':
    # Para ejecutar: python manage.py shell < apps/products/example_usage.py
    run_all_examples()
