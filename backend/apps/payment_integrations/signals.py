"""
Payment Integration Signals

Handles automatic actions when payment connections change.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models import PayPalConnection
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=PayPalConnection)
def sync_paypal_to_store(sender, instance, created, **kwargs):
    """
    Sync PayPal connection data to Store model.
    
    When a PayPal connection is created or updated, update the store's
    paypal_merchant_id and paypal_email fields.
    """
    if instance.is_connected():
        store = instance.store
        
        # Update store fields
        updated = False
        if store.paypal_merchant_id != instance.merchant_id:
            store.paypal_merchant_id = instance.merchant_id
            updated = True
        
        if store.paypal_email != instance.merchant_email:
            store.paypal_email = instance.merchant_email
            updated = True
        
        if updated:
            store.save(update_fields=['paypal_merchant_id', 'paypal_email'])
            logger.info(f"Synced PayPal data to store {store.slug}")


@receiver(pre_delete, sender=PayPalConnection)
def clear_paypal_from_store(sender, instance, **kwargs):
    """
    Clear PayPal data from Store when connection is deleted.
    """
    store = instance.store
    store.paypal_merchant_id = None
    store.paypal_email = None
    store.save(update_fields=['paypal_merchant_id', 'paypal_email'])
    logger.info(f"Cleared PayPal data from store {store.slug}")
