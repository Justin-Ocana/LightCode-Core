"""
Cloudinary utilities for secure image upload and management.
"""
import cloudinary
import cloudinary.uploader
import cloudinary.api
from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

# Configure Cloudinary
if settings.USE_CLOUDINARY:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
        api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
        api_secret=settings.CLOUDINARY_STORAGE['API_SECRET'],
        secure=settings.CLOUDINARY_STORAGE['SECURE']
    )


class CloudinaryImageHandler:
    """
    Handler for Cloudinary image operations with validation and optimization.
    """
    
    ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    
    # Límites específicos
    SIZE_LIMITS = {
        'store_logo': 2 * 1024 * 1024,      # 2MB
        'banner': 5 * 1024 * 1024,          # 5MB
        'product_image': 3 * 1024 * 1024,   # 3MB
        'avatar': 2 * 1024 * 1024,          # 2MB
        'chat_attachment': 5 * 1024 * 1024, # 5MB
    }
    
    # Preset transformations for different use cases
    TRANSFORMATIONS = {
        'product_image': {
            'width': 600,
            'height': 600,
            'crop': 'fit',
            'quality': 'auto:best',
            'fetch_format': 'auto',
            'background': 'transparent',
        },
        'product_thumbnail': {
            'width': 300,
            'height': 300,
            'crop': 'fit',
            'quality': 'auto:good',
            'fetch_format': 'auto',
            'background': 'transparent',
        },
        'product_main': {
            'width': 800,
            'height': 800,
            'crop': 'limit',
            'quality': 'auto:best',
            'fetch_format': 'auto',
        },
        'avatar': {
            'width': 200,
            'height': 200,
            'crop': 'fill',
            'gravity': 'face',
            'quality': 'auto:good',
            'fetch_format': 'auto',
        },
        'banner': {
            'width': 1920,
            'height': 600,
            'crop': 'fill',
            'quality': 'auto:best',
            'fetch_format': 'auto',
        },
        'store_logo': {
            'width': 400,
            'height': 400,
            'crop': 'fit',
            'quality': 'auto:best',
            'format': 'png',  # Preservar PNG para transparencia
        },
    }
    
    @staticmethod
    def validate_image(file, transformation_type=None):
        """
        Validate uploaded image file.
        
        Args:
            file: Django UploadedFile object
            transformation_type: Optional type to apply specific size limits
            
        Raises:
            ValidationError: If validation fails
        """
        # Check specific or global file size
        limit = CloudinaryImageHandler.SIZE_LIMITS.get(
            transformation_type, 
            CloudinaryImageHandler.MAX_FILE_SIZE
        )
        
        if file.size > limit:
            logger.error(f"File size validation failed: file.size={file.size}, limit={limit}, type={transformation_type}")
            raise ValidationError(
                f'El archivo excede el tamaño máximo permitido de {limit / (1024*1024)}MB (Tamaño actual: {round(file.size / (1024*1024), 2)}MB)'
            )
        
        # Check file type
        try:
            # Si el archivo tiene un atributo 'file' (como InMemoryUploadedFile), úsalo
            # de lo contrario usa el archivo directamente (si es un path o similar)
            file_to_open = getattr(file, 'file', file)
            img = Image.open(file_to_open)
            img.verify()
            
            # Check format
            if img.format.lower() not in CloudinaryImageHandler.ALLOWED_FORMATS:
                raise ValidationError(
                    f'Formato de imagen no válido. Formatos permitidos: {", ".join(CloudinaryImageHandler.ALLOWED_FORMATS)}'
                )
            
            # Reset file pointer after verify
            if hasattr(file, 'seek'):
                file.seek(0)
            if hasattr(file_to_open, 'seek'):
                file_to_open.seek(0)
            
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError(f'Archivo de imagen no válido: {str(e)}')
    
    @staticmethod
    def upload_image(file, folder, public_id=None, transformation=None, tags=None):
        """
        Upload image to Cloudinary with folder organization and random naming.
        """
        import uuid
        
        if not settings.USE_CLOUDINARY:
            logger.error("Attempted to upload image but Cloudinary is not configured.")
            raise ValidationError('El sistema de almacenamiento de imágenes no está configurado correctamente.')
        
        try:
            # Validate image with specific limits if transformation is a string key
            CloudinaryImageHandler.validate_image(file, transformation if isinstance(transformation, str) else None)
            
            # Generar public_id/nombre de archivo aleatorio por seguridad si no existe
            if not public_id:
                public_id = str(uuid.uuid4())
            
            # Prepare upload options
            upload_options = {
                'folder': folder,
                'resource_type': 'image',
                'overwrite': True,
                'invalidate': True,
                'unique_filename': True, # Forzar unicidad
                'use_filename': False,   # No usar nombre original por seguridad
                'public_id': public_id,
            }
            
            # Add transformation
            if transformation:
                if isinstance(transformation, str):
                    # Use preset transformation
                    upload_options['transformation'] = CloudinaryImageHandler.TRANSFORMATIONS.get(
                        transformation, {}
                    )
                elif isinstance(transformation, dict):
                    upload_options['transformation'] = transformation
            
            # Add tags
            if tags:
                upload_options['tags'] = tags if isinstance(tags, list) else [tags]
            
            # Upload to Cloudinary
            result = cloudinary.uploader.upload(file, **upload_options)
            
            logger.info(f"Image uploaded successfully to {folder}/{result.get('public_id')}")
            
            return {
                'url': result.get('secure_url'),
                'public_id': result.get('public_id'),
                'format': result.get('format'),
                'width': result.get('width'),
                'height': result.get('height'),
                'bytes': result.get('bytes'),
                'created_at': result.get('created_at'),
            }
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Failed to upload image to Cloudinary: {str(e)}")
            raise ValidationError(f'Error al subir la imagen a la nube: {str(e)}')
    
    @staticmethod
    def copy_image_from_public_id(source_public_id, folder, public_id, resource_type='image'):
        """
        Crea un nuevo asset en Cloudinary copiando uno existente (misma cuenta).
        Sube desde la URL de entrega del original para no compartir public_id
        (así borrar un producto no afecta al duplicado).
        """
        if not settings.USE_CLOUDINARY:
            return None
        if not source_public_id:
            return None
        try:
            src_url = cloudinary.CloudinaryImage(source_public_id).build_url(secure=True)
            upload_options = {
                'folder': folder,
                'public_id': public_id,
                'resource_type': resource_type,
                'overwrite': True,
                'unique_filename': False,
            }
            result = cloudinary.uploader.upload(src_url, **upload_options)
            return result.get('public_id')
        except Exception as e:
            logger.error(
                'Failed to copy Cloudinary image %s -> %s/%s: %s',
                source_public_id,
                folder,
                public_id,
                str(e),
            )
            raise ValidationError(f'Failed to copy image: {str(e)}')

    @staticmethod
    def delete_image(public_id):
        """
        Delete image from Cloudinary.
        """
        if not public_id:
            return False
            
        if not settings.USE_CLOUDINARY:
            logger.error(f"Attempted to delete image {public_id} but Cloudinary is not configured.")
            return False
        
        try:
            result = cloudinary.uploader.destroy(public_id)
            success = result.get('result') == 'ok'
            
            if success:
                logger.info(f"Image deleted successfully from Cloudinary: {public_id}")
            else:
                logger.warning(f"Failed to delete image from Cloudinary: {public_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error deleting image {public_id} from Cloudinary: {str(e)}")
            return False
    
    @staticmethod
    def get_transformed_url(public_id, transformation='product_main'):
        """
        Get transformed image URL from Cloudinary.
        """
        if not public_id:
            return None
            
        if not settings.USE_CLOUDINARY:
            logger.error(f"Attempted to get URL for {public_id} but Cloudinary is not configured.")
            return None
        
        try:
            if isinstance(transformation, str):
                transform_dict = CloudinaryImageHandler.TRANSFORMATIONS.get(transformation, {})
            else:
                transform_dict = transformation
            
            url = cloudinary.CloudinaryImage(public_id).build_url(**transform_dict)
            return url
            
        except Exception as e:
            logger.error(f"Error generating transformed URL from Cloudinary: {str(e)}")
            return None
    
    @staticmethod
    def bulk_delete(folder):
        """
        Delete all images in a folder.
        
        Args:
            folder: Cloudinary folder path
            
        Returns:
            dict: Deletion result
        """
        if not settings.USE_CLOUDINARY:
            return {'deleted': 0}
        
        try:
            result = cloudinary.api.delete_resources_by_prefix(folder)
            logger.info(f"Bulk deleted images from folder: {folder}")
            return result
            
        except Exception as e:
            logger.error(f"Error bulk deleting from {folder}: {str(e)}")
            return {'deleted': 0}


# Helper functions for specific use cases

def upload_product_image(file, store_id, product_id, image_type='main'):
    """
    Upload product image with proper folder structure.
    
    Args:
        file: Image file
        store_id: Store ID
        product_id: Product ID
        image_type: 'main', 'gallery', or 'thumbnail'
    """
    folder = f'products/store_{store_id}'
    public_id = f'product_{product_id}_{image_type}'
    transformation = 'product_main' if image_type == 'main' else 'product_thumbnail'
    tags = ['product', f'store_{store_id}', f'product_{product_id}']
    
    return CloudinaryImageHandler.upload_image(
        file=file,
        folder=folder,
        public_id=public_id,
        transformation=transformation,
        tags=tags
    )


def upload_user_avatar(file, user_id):
    """
    Upload user avatar image.
    """
    folder = 'avatars'
    public_id = f'user_{user_id}'
    transformation = 'avatar'
    tags = ['avatar', f'user_{user_id}']
    
    return CloudinaryImageHandler.upload_image(
        file=file,
        folder=folder,
        public_id=public_id,
        transformation=transformation,
        tags=tags
    )


def upload_store_logo(file, store_id):
    """
    Upload store logo.
    """
    folder = 'stores'
    public_id = f'store_{store_id}_logo'
    transformation = 'store_logo'
    tags = ['store', 'logo', f'store_{store_id}']
    
    return CloudinaryImageHandler.upload_image(
        file=file,
        folder=folder,
        public_id=public_id,
        transformation=transformation,
        tags=tags
    )


def upload_store_banner(file, store_id):
    """
    Upload store banner image.
    """
    folder = 'stores'
    public_id = f'store_{store_id}_banner'
    transformation = 'banner'
    tags = ['store', 'banner', f'store_{store_id}']
    
    return CloudinaryImageHandler.upload_image(
        file=file,
        folder=folder,
        public_id=public_id,
        transformation=transformation,
        tags=tags
    )


def upload_category_icon(file, category_id, category_slug):
    """
    Upload category icon.
    """
    folder = 'categories'
    public_id = f'category_{category_slug}'
    transformation = 'product_thumbnail'
    tags = ['category', f'category_{category_id}']
    
    return CloudinaryImageHandler.upload_image(
        file=file,
        folder=folder,
        public_id=public_id,
        transformation=transformation,
        tags=tags
    )


def delete_product_images(store_id, product_id):
    """
    Delete all images for a product.
    """
    folder = f'products/store_{store_id}/product_{product_id}'
    return CloudinaryImageHandler.bulk_delete(folder)
