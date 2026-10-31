"""
Core views for common functionality.
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from .serializers import ImageUploadSerializer
from .cloudinary_utils import (
    upload_product_image,
    upload_user_avatar,
    upload_store_logo,
    upload_store_banner,
    CloudinaryImageHandler
)
import logging

logger = logging.getLogger(__name__)


class ImageUploadViewSet(viewsets.ViewSet):
    """
    ViewSet for handling image uploads to Cloudinary.
    
    Endpoints:
    - POST /api/images/product/ - Upload product image
    - POST /api/images/avatar/ - Upload user avatar
    - POST /api/images/store-logo/ - Upload store logo
    - POST /api/images/store-banner/ - Upload store banner
    - DELETE /api/images/{public_id}/ - Delete image
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'], url_path='product')
    def upload_product_image(self, request):
        """
        Upload product image.
        
        Required fields:
        - image: Image file
        - store_id: Store ID
        - product_id: Product ID
        - image_type: 'main', 'gallery', or 'thumbnail' (default: 'main')
        """
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        store_id = request.data.get('store_id')
        product_id = request.data.get('product_id')
        image_type = request.data.get('image_type', 'main')
        
        if not store_id or not product_id:
            return Response(
                {'error': 'store_id and product_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = upload_product_image(
                file=serializer.validated_data['image'],
                store_id=store_id,
                product_id=product_id,
                image_type=image_type
            )
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'], url_path='avatar')
    def upload_avatar(self, request):
        """
        Upload user avatar.
        
        Required fields:
        - image: Image file
        """
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            result = upload_user_avatar(
                file=serializer.validated_data['image'],
                user_id=request.user.id
            )
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'], url_path='store-logo')
    def upload_store_logo(self, request):
        """
        Upload store logo.
        
        Required fields:
        - image: Image file
        - store_id: Store ID
        """
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        store_id = request.data.get('store_id')
        if not store_id:
            return Response(
                {'error': 'store_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = upload_store_logo(
                file=serializer.validated_data['image'],
                store_id=store_id
            )
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'], url_path='store-banner')
    def upload_store_banner(self, request):
        """
        Upload store banner.
        
        Required fields:
        - image: Image file
        - store_id: Store ID
        """
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        store_id = request.data.get('store_id')
        if not store_id:
            return Response(
                {'error': 'store_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = upload_store_banner(
                file=serializer.validated_data['image'],
                store_id=store_id
            )
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['delete'])
    def delete_image(self, request, pk=None):
        """
        Delete image from Cloudinary.
        
        Args:
            pk: Cloudinary public_id (URL-encoded)
        """
        if not pk:
            return Response(
                {'error': 'public_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = CloudinaryImageHandler.delete_image(pk)
        
        if success:
            return Response(
                {'message': 'Image deleted successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
        else:
            return Response(
                {'error': 'Failed to delete image'},
                status=status.HTTP_400_BAD_REQUEST
            )
