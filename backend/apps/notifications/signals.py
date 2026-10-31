"""
Signals for sending real-time notifications.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.orders.models import Order
from .models import Notification
import logging

logger = logging.getLogger(__name__)


def send_notification_to_user(user_id, notification_data):
    """
    Send a notification to a specific user via WebSocket.
    
    Args:
        user_id: ID of the user to send notification to
        notification_data: Dict with notification data
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning("Channel layer not configured, skipping WebSocket notification")
            return
        
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user_id}',
            {
                'type': 'notification_message',
                'data': notification_data
            }
        )
        logger.info(f"✅ Notification sent to user {user_id}: {notification_data.get('title')}")
    except Exception as e:
        logger.error(f"❌ Error sending notification: {str(e)}")


@receiver(post_save, sender=Order)
def notify_new_order(sender, instance, created, **kwargs):
    """
    Send notification when a new order is created.
    
    DISABLED: Notifications are now sent manually in store_capture_paypal_order
    after payment is confirmed, not when the order is first created.
    """
    # Disabled - notifications are sent after payment capture
    return
    
    if not created:
        return
    
    order = instance
    seller = order.store.owner
    
    # Create notification in database
    notification = Notification.objects.create(
        user=seller,
        type=Notification.Type.NEW_ORDER,
        title='Nueva venta',
        message=f'{order.minecraft_username} compró {order.product_snapshot.get("name")} — ${order.amount_after_discount}',
        order=order,
        store=order.store,
        data={
            'order_id': str(order.id),
            'order_number': order.order_number,
            'amount': str(order.amount_after_discount),
            'product_name': order.product_snapshot.get('name'),
            'minecraft_username': order.minecraft_username,
        }
    )
    
    # Send real-time notification
    send_notification_to_user(seller.id, {
        'id': str(notification.id),
        'type': notification.type,
        'title': notification.title,
        'message': notification.message,
        'data': notification.data,
        'created_at': notification.created_at.isoformat(),
    })


def notify_order_delivered(order):
    """
    Send notification when an order is delivered.
    """
    seller = order.store.owner
    
    # Create notification in database
    notification = Notification.objects.create(
        user=seller,
        type=Notification.Type.ORDER_DELIVERED,
        title='Orden entregada',
        message=f'Orden {order.order_number} entregada exitosamente',
        order=order,
        store=order.store,
        data={
            'order_id': str(order.id),
            'order_number': order.order_number,
        }
    )
    
    # Send real-time notification
    send_notification_to_user(seller.id, {
        'id': str(notification.id),
        'type': notification.type,
        'title': notification.title,
        'message': notification.message,
        'data': notification.data,
        'created_at': notification.created_at.isoformat(),
    })


def notify_order_failed(order, reason):
    """
    Send notification when an order fails.
    """
    seller = order.store.owner
    
    # Create notification in database
    notification = Notification.objects.create(
        user=seller,
        type=Notification.Type.ORDER_FAILED,
        title='Error en entrega',
        message=f'Orden {order.order_number} falló: {reason}',
        order=order,
        store=order.store,
        data={
            'order_id': str(order.id),
            'order_number': order.order_number,
            'reason': reason,
        }
    )
    
    # Send real-time notification
    send_notification_to_user(seller.id, {
        'id': str(notification.id),
        'type': notification.type,
        'title': notification.title,
        'message': notification.message,
        'data': notification.data,
        'created_at': notification.created_at.isoformat(),
    })
