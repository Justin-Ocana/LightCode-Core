"""
Signals for user app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import User, Seller
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_seller_profile(sender, instance, created, **kwargs):
    """
    Automatically create Seller profile when a seller User is created.
    Sets default subscription to 'free' to simplify onboarding.
    """
    if created and instance.user_type == 'seller':
        # Check if profile already exists (shouldn't happen, but be safe)
        if not hasattr(instance, 'seller_profile'):
            try:
                Seller.objects.create(
                    user=instance,
                    onboarding_step='create_store',
                    onboarding_data={
                        'auto_assigned': True
                    }
                )
                logger.info(f"Created Seller profile for {instance.username}")
            except Exception as e:
                logger.error(f"Failed to create Seller profile for {instance.username}: {e}")
