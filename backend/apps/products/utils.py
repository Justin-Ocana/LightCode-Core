"""
Product utilities - Helpers para productos y comandos.
"""
from typing import Dict, List
from .models import Product, ProductCommand, DeliveryQueue, CommandEvent
import logging

logger = logging.getLogger(__name__)


def create_delivery_queue_for_order(order_id: str, product: Product, context: Dict[str, str], event: str = CommandEvent.ON_PURCHASE) -> List[DeliveryQueue]:
    """
    Crea entradas en DeliveryQueue para una orden.
    
    Args:
        order_id: ID de la orden
        product: Producto comprado
        context: Diccionario con valores para interpolar
            {
                'username': 'Steve',
                'uuid': '069a79f4-44e9-4726-a5be-fca90e38aaf5',
                'price': '9.99',
                'product_name': 'VIP Rank',
                'transaction_id': 'txn_123',
                'store_slug': 'my-store'
            }
        event: Evento que dispara los comandos (default: ON_PURCHASE)
    
    Returns:
        List[DeliveryQueue]: Lista de entradas creadas en la cola
    """
    # Obtener comandos del producto para el evento
    commands = ProductCommand.objects.filter(
        product=product,
        event=event
    ).order_by('order')
    
    if not commands.exists():
        logger.warning(f"No commands found for product {product.id} and event {event}")
        return []
    
    # Crear entradas en DeliveryQueue
    queue_entries = []
    
    for cmd in commands:
        try:
            # Interpolar comando
            interpolated_command = cmd.interpolate(context)
            
            # Crear entrada en cola
            queue_entry = DeliveryQueue.objects.create(
                order_id=order_id,
                command=interpolated_command,
                status='PENDING'
            )
            
            queue_entries.append(queue_entry)
            
            logger.info(
                f"DeliveryQueue entry created: order={order_id}, "
                f"command={interpolated_command[:50]}"
            )
        
        except Exception as e:
            logger.error(
                f"Error creating DeliveryQueue entry for command {cmd.id}: {str(e)}",
                exc_info=True
            )
    
    return queue_entries


def get_pending_deliveries(limit: int = 100) -> List[DeliveryQueue]:
    """
    Obtiene entregas pendientes para procesar.
    
    Args:
        limit: Número máximo de entregas a retornar
    
    Returns:
        List[DeliveryQueue]: Lista de entregas pendientes
    """
    return DeliveryQueue.objects.filter(
        status='PENDING'
    ).order_by('created_at')[:limit]


def retry_failed_deliveries(max_attempts: int = 3) -> int:
    """
    Reintenta entregas fallidas que no han excedido el máximo de intentos.
    
    Args:
        max_attempts: Número máximo de intentos permitidos
    
    Returns:
        int: Número de entregas reintentadas
    """
    failed_deliveries = DeliveryQueue.objects.filter(
        status='FAILED',
        attempts__lt=max_attempts
    )
    
    count = 0
    for delivery in failed_deliveries:
        try:
            delivery.retry()
            count += 1
        except Exception as e:
            logger.error(f"Error retrying delivery {delivery.id}: {str(e)}")
    
    logger.info(f"Retried {count} failed deliveries")
    return count


def validate_product_availability(product: Product, user, quantity: int = 1) -> tuple:
    """
    Valida si un producto está disponible para compra.
    
    Args:
        product: Producto a validar
        user: Usuario que intenta comprar
        quantity: Cantidad a comprar
    
    Returns:
        tuple: (is_available: bool, error_message: str)
    """
    # Verificar que el producto esté activo
    if not product.is_available:
        return False, "Producto no disponible"
    
    # Verificar límites
    can_purchase, error_msg = product.can_purchase(user, quantity)
    if not can_purchase:
        return False, error_msg
    
    return True, ""


def get_product_stats(product: Product) -> Dict:
    """
    Obtiene estadísticas de un producto.
    
    Args:
        product: Producto
    
    Returns:
        dict: Estadísticas del producto
    """
    return {
        'total_sold': product.total_sold,
        'is_available': product.is_available,
        'commands_count': product.commands.count(),
        'revenue': float(product.price * product.total_sold),
        'availability_percentage': (
            ((product.global_limit - product.total_sold) / product.global_limit * 100)
            if product.global_limit
            else 100
        ),
    }


def bulk_update_product_status(product_ids: List[str], status: str) -> int:
    """
    Actualiza el estado de múltiples productos.
    
    Args:
        product_ids: Lista de IDs de productos
        status: Nuevo estado
    
    Returns:
        int: Número de productos actualizados
    """
    updated = Product.objects.filter(
        id__in=product_ids,
        is_deleted=False
    ).update(status=status)
    
    logger.info(f"Updated {updated} products to status {status}")
    return updated


def get_products_by_category(store, category: str, active_only: bool = True):
    """
    Obtiene productos de una tienda por categoría.
    
    Args:
        store: Tienda
        category: Categoría del producto
        active_only: Si solo retornar productos activos
    
    Returns:
        QuerySet: Productos filtrados
    """
    queryset = Product.objects.filter(
        store=store,
        category=category,
        is_deleted=False
    )
    
    if active_only:
        queryset = queryset.filter(status='ACTIVE')
    
    return queryset.order_by('sort_order', '-created_at')


def get_best_selling_products(store, limit: int = 10):
    """
    Obtiene los productos más vendidos de una tienda.
    
    Args:
        store: Tienda
        limit: Número de productos a retornar
    
    Returns:
        QuerySet: Productos ordenados por ventas
    """
    return Product.objects.filter(
        store=store,
        is_deleted=False
    ).order_by('-total_sold')[:limit]
