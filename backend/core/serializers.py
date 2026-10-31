"""
Core serializers for common functionality.
"""
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .cloudinary_utils import CloudinaryImageHandler


class ImageUploadSerializer(serializers.Serializer):
    """
    Serializer for image upload validation.
    """
    image = serializers.ImageField(required=True)
    folder = serializers.CharField(required=False, max_length=255)
    transformation = serializers.CharField(required=False, max_length=50)
    
    def validate_image(self, value):
        """Validate image file."""
        try:
            CloudinaryImageHandler.validate_image(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(str(e))
        return value


class CloudinaryImageField(serializers.Field):
    """
    Custom field for Cloudinary images.
    Stores public_id and returns full URL.
    """
    
    def to_representation(self, value):
        """Convert public_id to full URL."""
        if not value:
            return None
        
        # If it's already a URL, return it
        if value.startswith('http'):
            return value
        
        # Otherwise, generate URL from public_id
        return CloudinaryImageHandler.get_transformed_url(value)
    
    def to_internal_value(self, data):
        """Accept public_id or URL."""
        if not data:
            return None
        
        # If it's a URL, extract public_id
        if data.startswith('http'):
            # Extract public_id from Cloudinary URL
            # Format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
            parts = data.split('/')
            if 'cloudinary.com' in data and len(parts) > 7:
                public_id = '/'.join(parts[7:]).split('.')[0]
                return public_id
        
        return data
