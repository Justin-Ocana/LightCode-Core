"""
Product signals - Automatización y side effects.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.db.models import F
import logging

from .models import Product, ProductCommand, ProductCategory, GLOBAL_CATEGORIES
from apps.stores.models import Store

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Store)
def store_post_save(sender, instance, created, **kwargs):
    """
    Signal después de guardar una tienda.
    
    - Si es nueva, crear categorías globales por defecto para esta tienda.
    """
    if created:
        logger.info(f"Store created: {instance.slug}. Initializing default categories...")
        
        for i, cat_data in enumerate(GLOBAL_CATEGORIES):
            try:
                ProductCategory.objects.create(
                    store=instance,
                    name=cat_data['name'],
                    slug=cat_data['slug'],
                    description=cat_data['description'],
                    icon=cat_data['icon'],
                    sort_order=i,
                    is_default=True # Son las categorías base creadas al inicio
                )
            except Exception as e:
                logger.error(f"Error creating default category {cat_data['slug']} for store {instance.slug}: {str(e)}")


@receiver(post_save, sender=Product)
def product_post_save(sender, instance, created, **kwargs):
    """
    Signal después de guardar un producto.
    
    - Si es nuevo, loggear creación
    - Invalidar cache si es necesario
    """
    if created:
        logger.info(f"Product created: {instance.name} in store {instance.store.slug}")
    else:
        logger.info(f"Product updated: {instance.name}")


@receiver(pre_delete, sender=Product)
def product_pre_delete(sender, instance, **kwargs):
    """
    Signal antes de eliminar un producto.
    
    - Limpiar imagen de Cloudinary
    - Actualizar contador de la tienda
    """
    # Limpiar imagen de Cloudinary
    if instance.image:
        try:
            from core.cloudinary_utils import CloudinaryImageHandler
            CloudinaryImageHandler.delete_image(instance.image)
            logger.info(f"Product image deleted from Cloudinary: {instance.image}")
        except Exception as e:
            logger.error(f"Error deleting product image: {str(e)}")
    
    # Actualizar contador de la tienda (solo si no es soft delete)
    if not instance.is_deleted:
        try:
            instance.store.__class__.objects.filter(pk=instance.store.pk).update(
                total_products=F('total_products') - 1
            )
        except Exception as e:
            logger.error(f"Error updating store product count: {str(e)}")


@receiver(post_save, sender=ProductCommand)
def product_command_post_save(sender, instance, created, **kwargs):
    """Signal después de guardar un comando."""
    if created:
        logger.info(
            f"Command created for product {instance.product.name}: "
            f"{instance.event} - {instance.command[:50]}"
        )
