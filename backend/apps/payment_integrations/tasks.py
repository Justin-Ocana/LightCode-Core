"""
Payment Integration Tasks

Celery tasks for:
1. Token refresh automation
2. RCON retry queue (independent of payment flow)
3. Webhook processing
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def refresh_paypal_tokens(self):
    """
    Periodic task to refresh PayPal access tokens before they expire.
    
    Runs every 6 hours to refresh tokens that expire in 8 hours.
    """
    from .models import PayPalConnection
    from .paypal_partner_service import paypal_partner_service
    
    try:
        # Find connections that need refresh (expire in next 2 hours)
        expiry_threshold = timezone.now() + timedelta(hours=2)
        connections_to_refresh = PayPalConnection.objects.filter(
            status='connected',
            expires_at__lte=expiry_threshold
        )
        
        refreshed_count = 0
        failed_count = 0
        
        for connection in connections_to_refresh:
            try:
                success = paypal_partner_service.refresh_access_token(connection)
                if success:
                    refreshed_count += 1
                    logger.info(f"✅ Refreshed token for store {connection.store.slug}")
                else:
                    failed_count += 1
                    logger.error(f"❌ Failed to refresh token for store {connection.store.slug}")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Error refreshing token for store {connection.store.slug}: {e}")
        
        logger.info(f"Token refresh completed: {refreshed_count} success, {failed_count} failed")
        return {
            'refreshed': refreshed_count,
            'failed': failed_count
        }
        
    except Exception as e:
        logger.error(f"Token refresh task failed: {e}")
        raise self.retry(countdown=300, exc=e)  # Retry in 5 minutes


@shared_task(bind=True, max_retries=5)
def retry_failed_rcon_delivery(self, order_id):
    """
    Independent RCON retry queue.
    
    This runs AFTER payment is confirmed and saved.
    If RCON fails, payment is still valid - we just keep retrying delivery.
    
    Args:
        order_id: UUID of the order to retry RCON delivery
    """
    from apps.orders.models import Order
    from apps.orders.tasks import execute_rcon_job
    
    try:
        order = Order.objects.get(id=order_id)
        
        # Only retry if payment is confirmed but RCON not delivered
        if order.status != 'completed':
            logger.warning(f"Order {order_id} not completed, skipping RCON retry")
            return
            
        if order.minecraft_delivered:
            logger.info(f"Order {order_id} already delivered, skipping retry")
            return
        
        # Check if store has RCON configured
        if not order.store.rcon_host or not order.store.rcon_port:
            logger.error(f"Store {order.store.slug} has no RCON config, cannot deliver order {order_id}")
            return
        
        # Attempt RCON delivery
        logger.info(f"🔄 Retrying RCON delivery for order {order_id} (attempt {self.request.retries + 1})")
        
        # Use existing RCON task
        result = execute_rcon_job.delay(str(order_id))
        
        # Wait for result (with timeout)
        try:
            success = result.get(timeout=30)
            if success:
                order.minecraft_delivered = True
                order.save(update_fields=['minecraft_delivered'])
                logger.info(f"✅ RCON delivery successful for order {order_id}")
                return True
            else:
                raise Exception("RCON execution failed")
                
        except Exception as rcon_error:
            logger.error(f"RCON delivery failed for order {order_id}: {rcon_error}")
            
            # Exponential backoff: 5min, 15min, 45min, 2h, 6h
            countdown = 300 * (3 ** self.request.retries)  # 5 * 3^retry
            
            raise self.retry(
                countdown=countdown,
                exc=rcon_error,
                max_retries=5
            )
        
    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found for RCON retry")
        return False
        
    except Exception as e:
        logger.error(f"RCON retry task failed for order {order_id}: {e}")
        
        # Exponential backoff
        countdown = 300 * (3 ** self.request.retries)
        raise self.retry(countdown=countdown, exc=e)


@shared_task(bind=True)
def process_paypal_webhook(self, webhook_data, headers):
    """
    Process PayPal webhook events asynchronously.
    
    This provides secondary confirmation for payments.
    The primary confirmation happens in the redirect flow.
    """
    from .models import PaymentIntegrationLog
    from apps.orders.models import Order
    
    try:
        event_type = webhook_data.get('event_type')
        resource = webhook_data.get('resource', {})
        
        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            # Find order by PayPal order ID
            paypal_order_id = resource.get('supplementary_data', {}).get('related_ids', {}).get('order_id')
            
            if paypal_order_id:
                try:
                    order = Order.objects.get(paypal_order_id=paypal_order_id)
                    
                    # Mark webhook as confirmed
                    order.webhook_confirmed = True
                    order.save(update_fields=['webhook_confirmed'])
                    
                    # Log webhook confirmation
                    PaymentIntegrationLog.log_event(
                        store=order.store,
                        provider='paypal',
                        event_type='webhook_confirmed',
                        message=f'Webhook confirmed payment for order {order.id}',
                        metadata={'paypal_order_id': paypal_order_id}
                    )
                    
                    logger.info(f"✅ Webhook confirmed payment for order {order.id}")
                    
                    # If RCON not delivered yet, trigger retry
                    if not order.minecraft_delivered:
                        retry_failed_rcon_delivery.delay(str(order.id))
                    
                except Order.DoesNotExist:
                    logger.warning(f"Order not found for PayPal order ID: {paypal_order_id}")
            
        return True
        
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
        raise self.retry(countdown=60, exc=e)


@shared_task
def cleanup_expired_connections():
    """
    Clean up expired PayPal connections that haven't been refreshed.
    
    Runs daily to mark connections as expired if token refresh failed.
    """
    from .models import PayPalConnection
    
    try:
        expired_threshold = timezone.now() - timedelta(hours=1)
        expired_connections = PayPalConnection.objects.filter(
            status='connected',
            expires_at__lte=expired_threshold
        )
        
        count = 0
        for connection in expired_connections:
            connection.mark_expired()
            count += 1
            logger.info(f"Marked connection as expired for store {connection.store.slug}")
        
        logger.info(f"Cleaned up {count} expired connections")
        return count
        
    except Exception as e:
        logger.error(f"Connection cleanup failed: {e}")
        return 0