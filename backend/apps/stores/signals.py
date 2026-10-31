"""
Store signals - Automatización de tareas.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.core.cache import cache
import logging

from .models import Store, StoreSettings

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Store)
def create_store_settings(sender, instance, created, **kwargs):
    """
    Crear configuración por defecto cuando se crea una tienda.
    """
    if created:
        try:
            StoreSettings.objects.get_or_create(store=instance)
            logger.info(f"Settings created for store: {instance.slug}")
        except Exception as e:
            logger.error(f"Error creating settings for store {instance.slug}: {e}")


@receiver(post_save, sender=Store)
def invalidate_store_cache(sender, instance, **kwargs):
    """
    Invalidar caché cuando se actualiza una tienda.
    """
    try:
        cache_keys = [
            f'store:{instance.id}',
            f'store:slug:{instance.slug}',
            f'store:owner:{instance.owner.id}',
            'stores:list',
        ]
        
        for key in cache_keys:
            cache.delete(key)
        
        logger.debug(f"Cache invalidated for store: {instance.slug}")
    except Exception as e:
        logger.error(f"Error invalidating cache for store {instance.slug}: {e}")


@receiver(pre_delete, sender=Store)
def cleanup_store_assets(sender, instance, **kwargs):
    """
    Limpiar assets de Cloudinary cuando se elimina una tienda.
    Solo se ejecuta en hard delete (no en soft delete).
    """
    try:
        # TODO: Implementar limpieza de Cloudinary cuando esté configurado
        # from core.cloudinary_utils import CloudinaryImageHandler
        
        # if instance.logo:
        #     CloudinaryImageHandler.delete_image(instance.logo)
        #     logger.info(f"Deleted logo for store: {instance.slug}")
        
        # if instance.banner:
        #     CloudinaryImageHandler.delete_image(instance.banner)
        #     logger.info(f"Deleted banner for store: {instance.slug}")
        
        # if instance.favicon:
        #     CloudinaryImageHandler.delete_image(instance.favicon)
        #     logger.info(f"Deleted favicon for store: {instance.slug}")
        
        logger.info(f"Cleanup triggered for store: {instance.slug}")
    except Exception as e:
        logger.error(f"Error cleaning up assets for store {instance.slug}: {e}")
