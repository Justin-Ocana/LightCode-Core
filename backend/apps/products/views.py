"""
Product views - Endpoints para gestión de productos.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Prefetch, F
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
import logging
import uuid

from .models import Product, ProductCommand, ProductCategory, ProductStatus, ProductImage
from .serializers import (
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateSerializer,
    ProductUpdateSerializer,
    ProductCommandSerializer,
    ProductCategorySerializer,
    ProductCategoryCreateSerializer,
    ProductImageSerializer,
    ProductImageCreateSerializer,
)
from apps.stores.models import Store
from core.cloudinary_utils import CloudinaryImageHandler

logger = logging.getLogger(__name__)


# ============================================================================
# CATEGORY ENDPOINTS
# ============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_list(request, store_id):
    """
    GET /api/stores/{store_id}/categories/
    
    Lista categorías disponibles para una tienda (globales + personalizadas).
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos (solo owner puede ver)
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para ver las categorías de esta tienda.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Obtener categorías (globales + personalizadas de la tienda)
    categories = ProductCategory.objects.for_store(store).order_by('sort_order', 'name')
    
    serializer = ProductCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def category_create(request, store_id):
    """
    POST /api/stores/{store_id}/categories/
    
    Crea una categoría personalizada para la tienda.
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para crear categorías en esta tienda.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        serializer = ProductCategoryCreateSerializer(
            data=request.data,
            context={'request': request, 'store': store}
        )
        
        if not serializer.is_valid():
            return Response(
                {'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = serializer.save()
        
        response_serializer = ProductCategorySerializer(category)
        logger.info(f"Category created: {category.name} for store {store.slug}")
        
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )
    
    except Exception as e:
        logger.error(f"Error creating category: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al crear la categoría.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def category_detail(request, category_id):
    """
    PATCH /api/categories/{id}/ - Actualiza una categoría
    DELETE /api/categories/{id}/ - Elimina una categoría
    """
    try:
        category = ProductCategory.objects.get(id=category_id)
    except ProductCategory.DoesNotExist:
        return Response(
            {'error': 'Categoría no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if category.store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para modificar esta categoría.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'PATCH':
        try:
            serializer = ProductCategoryCreateSerializer(
                category,
                data=request.data,
                partial=True,
                context={'request': request, 'store': category.store}
            )
            
            if not serializer.is_valid():
                return Response(
                    {'errors': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            category = serializer.save()
            
            response_serializer = ProductCategorySerializer(category)
            logger.info(f"Category updated: {category.name}")
            
            return Response(
                response_serializer.data,
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Error updating category: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al actualizar la categoría.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            # Verificar que no sea una categoría por defecto
            if category.is_default:
                return Response(
                    {'error': 'No se pueden eliminar las categorías predeterminadas.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Soft delete - no verificamos productos porque solo ocultamos la categoría
            category.soft_delete()
            
            logger.info(f"Category soft deleted: {category.name}")
            
            return Response(
                {'message': 'Categoría eliminada exitosamente.'},
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Error deleting category: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al eliminar la categoría.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([AllowAny])
def public_categories(request, store_slug):
    """
    GET /api/public/stores/{slug}/categories/
    
    Lista categorías públicas de una tienda (solo las que tienen productos activos).
    """
    try:
        store = Store.objects.get(
            slug=store_slug,
            status='active',
            is_verified=True,
            is_deleted=False
        )
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Obtener categorías que tienen productos activos
    categories = ProductCategory.objects.for_store(store).filter(
        products__status=ProductStatus.ACTIVE,
        products__is_deleted=False
    ).distinct().order_by('sort_order', 'name')
    
    serializer = ProductCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# ============================================================================
# PRODUCT ENDPOINTS
# ============================================================================


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def product_list_create(request, store_id):
    """
    GET /api/stores/{store_id}/products/ - Lista productos de una tienda
    POST /api/stores/{store_id}/products/ - Crea un producto
    """
    # Verificar que la tienda existe
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        # Listar productos
        # Si es el owner, mostrar todos; si no, solo activos
        if store.owner == request.user or request.user.is_superuser:
            products = Product.objects.filter(
                store=store,
                is_deleted=False
            ).order_by('sort_order', '-created_at')
        else:
            products = Product.objects.filter(
                store=store,
                status=ProductStatus.ACTIVE,
                is_deleted=False
            ).order_by('sort_order', '-created_at')
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        # Crear producto
        # Solo el owner puede crear
        if store.owner != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'No tienes permiso para crear productos en esta tienda.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verificar que sea seller
        if request.user.user_type != 'seller':
            return Response(
                {'error': 'Solo los vendedores pueden crear productos.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Agregar store al data
            data = request.data.copy()
            data['store'] = store.id
            
            serializer = ProductCreateSerializer(
                data=data,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                logger.error(f"Validation errors: {serializer.errors}")
                return Response(
                    {'errors': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            product = serializer.save()
            
            response_serializer = ProductDetailSerializer(product)
            logger.info(f"Product created: {product.name} in store {store.slug}")
            
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error creating product: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al crear el producto.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def product_detail(request, product_id):
    """
    GET /api/products/{id}/ - Obtiene detalles de un producto (público si está activo)
    PATCH /api/products/{id}/ - Actualiza un producto
    DELETE /api/products/{id}/ - Elimina un producto (soft delete)
    """
    try:
        product = (
            Product.objects.prefetch_related('gallery_images')
            .get(id=product_id, is_deleted=False)
        )
    except Product.DoesNotExist:
        return Response(
            {'error': 'Producto no encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        store_slug = request.query_params.get('store_slug')
        if store_slug and product.store.slug != store_slug:
            return Response(
                {'error': 'Producto no encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )

        user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        is_owner_or_admin = user and (product.store.owner_id == user.id or user.is_superuser)

        if is_owner_or_admin:
            serializer = ProductDetailSerializer(product)
            return Response(serializer.data, status=status.HTTP_200_OK)

        if product.status == ProductStatus.ACTIVE:
            serializer = ProductDetailSerializer(product)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(
            {'error': 'No tienes permiso para acceder a este producto.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Escritura: requiere autenticación
    if not request.user.is_authenticated:
        return Response(
            {'detail': 'Las credenciales de autenticación no se proveyeron.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if product.store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para acceder a este producto.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'PATCH':
        try:
            serializer = ProductUpdateSerializer(
                product,
                data=request.data,
                partial=True,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                return Response(
                    {'errors': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            product = serializer.save()
            
            response_serializer = ProductDetailSerializer(product)
            logger.info(f"Product updated: {product.name}")
            
            return Response(
                response_serializer.data,
                status=status.HTTP_200_OK
            )
        
        except DjangoValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error updating product: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al actualizar el producto.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            # Soft delete
            product.soft_delete()
            
            # Actualizar contador de la tienda
            from django.db.models import F
            product.store.__class__.objects.filter(pk=product.store.pk).update(
                total_products=F('total_products') - 1
            )
            
            logger.info(f"Product deleted: {product.name}")
            
            return Response(
                {'message': 'Producto eliminado exitosamente.'},
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Error deleting product: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al eliminar el producto.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def product_duplicate(request, product_id):
    """
    POST /api/products/{id}/duplicate/

    Duplica un producto: mismos datos, total_sold=0, imágenes (principal y galería)
    clonadas en Cloudinary con nuevos public_id, mismo orden en galería y comandos.
    """
    try:
        source = Product.objects.prefetch_related(
            Prefetch(
                'gallery_images',
                queryset=ProductImage.objects.order_by('order', 'created_at'),
            ),
            Prefetch(
                'commands',
                queryset=ProductCommand.objects.order_by('order', 'created_at'),
            ),
        ).get(id=product_id, is_deleted=False)
    except Product.DoesNotExist:
        return Response(
            {'error': 'Producto no encontrado.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    store = source.store
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para duplicar este producto.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.user.user_type != 'seller' and not request.user.is_superuser:
        return Response(
            {'error': 'Solo los vendedores pueden duplicar productos.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    seller = getattr(request.user, 'seller_profile', None)
    if seller is None and not request.user.is_superuser:
        return Response(
            {'error': 'Perfil de vendedor no encontrado.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # White-label: No product limits
    current_products = Product.objects.filter(store=store, is_deleted=False).count()

    raw_name = request.data.get('name')
    if raw_name is not None:
        name = str(raw_name).strip()
        if len(name) < 3:
            return Response(
                {'errors': {'name': 'El nombre debe tener al menos 3 caracteres.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(name) > 255:
            return Response(
                {'errors': {'name': 'El nombre no puede exceder 255 caracteres.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        name = f'{source.name} (copia)'

    raw_status = request.data.get('status', ProductStatus.DRAFT)
    if raw_status not in dict(ProductStatus.choices):
        return Response(
            {'errors': {'status': 'Estado no válido.'}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    new_status = raw_status

    try:
        with transaction.atomic():
            new_product = Product.objects.create(
                store=store,
                name=name,
                description=source.description,
                image='',
                show_gallery=source.show_gallery,
                price=source.price,
                category=source.category,
                purchase_type=source.purchase_type,
                subscription_interval=source.subscription_interval,
                global_limit=source.global_limit,
                per_player_limit=source.per_player_limit,
                require_online=source.require_online,
                command_delay=source.command_delay,
                delivery_mode=source.delivery_mode,
                status=new_status,
                sort_order=source.sort_order,
                total_sold=0,
            )

            if settings.USE_CLOUDINARY and source.image:
                new_pid = CloudinaryImageHandler.copy_image_from_public_id(
                    source.image,
                    folder=f'products/{store.slug}',
                    public_id=f'product_{new_product.id}',
                )
                if new_pid:
                    new_product.image = new_pid
                    new_product.save(update_fields=['image'])
            elif source.image:
                new_product.image = source.image
                new_product.save(update_fields=['image'])

            if settings.USE_CLOUDINARY:
                for img in source.gallery_images.all():
                    if not img.image:
                        continue
                    new_g_pid = CloudinaryImageHandler.copy_image_from_public_id(
                        img.image,
                        folder=f'products/{store.slug}/gallery',
                        public_id=f'gallery_{new_product.id}_{uuid.uuid4().hex[:8]}',
                    )
                    if new_g_pid:
                        ProductImage.objects.create(
                            product=new_product,
                            image=new_g_pid,
                            order=img.order,
                        )
            else:
                for img in source.gallery_images.all():
                    if img.image:
                        ProductImage.objects.create(
                            product=new_product,
                            image=img.image,
                            order=img.order,
                        )

            for cmd in source.commands.all():
                ProductCommand.objects.create(
                    product=new_product,
                    command=cmd.command,
                    event=cmd.event,
                    order=cmd.order,
                )

            Store.objects.filter(pk=store.pk).update(
                total_products=F('total_products') + 1
            )

        dup = Product.objects.prefetch_related('gallery_images').get(pk=new_product.pk)
        serializer = ProductDetailSerializer(dup)
        logger.info('Product duplicated: %s -> %s', source.id, new_product.id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    except DjangoValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error('Error duplicating product: %s', str(e), exc_info=True)
        return Response(
            {'error': 'Error al duplicar el producto.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def product_commands(request, product_id):
    """
    GET /api/products/{id}/commands/ - Lista comandos de un producto
    POST /api/products/{id}/commands/ - Agrega un comando
    """
    try:
        product = Product.objects.get(id=product_id, is_deleted=False)
    except Product.DoesNotExist:
        return Response(
            {'error': 'Producto no encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Solo el owner puede gestionar comandos
    if product.store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para gestionar comandos de este producto.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        commands = product.commands.all().order_by('event', 'order')
        serializer = ProductCommandSerializer(commands, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        try:
            serializer = ProductCommandSerializer(data=request.data)
            
            if not serializer.is_valid():
                return Response(
                    {'errors': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            command = serializer.save(product=product)
            
            logger.info(f"Command added to product {product.name}: {command.event}")
            
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        except Exception as e:
            logger.error(f"Error creating command: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al crear el comando.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def product_command_detail(request, command_id):
    """
    PATCH /api/products/commands/{id}/ - Actualiza un comando
    DELETE /api/products/commands/{id}/ - Elimina un comando
    """
    try:
        command = ProductCommand.objects.get(id=command_id)
    except ProductCommand.DoesNotExist:
        return Response(
            {'error': 'Comando no encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if command.product.store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para modificar este comando.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'PATCH':
        try:
            serializer = ProductCommandSerializer(
                command,
                data=request.data,
                partial=True
            )
            
            if not serializer.is_valid():
                return Response(
                    {'errors': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            command = serializer.save()
            
            logger.info(f"Command updated: {command.id}")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error updating command: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al actualizar el comando.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            command.delete()
            
            logger.info(f"Command deleted: {command.id}")
            
            return Response(
                {'message': 'Comando eliminado exitosamente.'},
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Error deleting command: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al eliminar el comando.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([AllowAny])
def public_products(request, store_slug):
    """
    GET /api/public/stores/{slug}/products/ - Lista productos públicos de una tienda
    """
    try:
        store = Store.objects.get(
            slug=store_slug,
            status='active',
            is_verified=True,
            is_deleted=False
        )
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Solo productos activos
    products = Product.objects.filter(
        store=store,
        status=ProductStatus.ACTIVE,
        is_deleted=False
    ).order_by('sort_order', '-created_at')
    
    serializer = ProductListSerializer(products, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_update_order(request, store_id):
    """
    POST /api/stores/{store_id}/products/reorder/
    
    Actualiza el orden de múltiples productos.
    Body: [{"id": "uuid", "sort_order": 0}, ...]
    """
    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Solo el owner puede reordenar
    if store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para reordenar productos.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        updates = request.data
        
        if not isinstance(updates, list):
            return Response(
                {'error': 'Se esperaba una lista de actualizaciones.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            for item in updates:
                product_id = item.get('id')
                sort_order = item.get('sort_order')
                
                if not product_id or sort_order is None:
                    continue
                
                Product.objects.filter(
                    id=product_id,
                    store=store,
                    is_deleted=False
                ).update(sort_order=sort_order)
        
        logger.info(f"Products reordered in store {store.slug}")
        
        return Response(
            {'message': 'Orden actualizado exitosamente.'},
            status=status.HTTP_200_OK
        )
    
    except Exception as e:
        logger.error(f"Error reordering products: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Error al actualizar el orden.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# PRODUCT GALLERY ENDPOINTS
# ============================================================================


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def product_gallery(request, product_id):
    """
    GET /api/products/{id}/gallery/ - Lista imágenes de galería
    POST /api/products/{id}/gallery/ - Sube una imagen a la galería
    """
    try:
        product = Product.objects.get(id=product_id, is_deleted=False)
    except Product.DoesNotExist:
        return Response(
            {'error': 'Producto no encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Solo el owner puede gestionar galería
    if product.store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para gestionar la galería de este producto.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        images = product.gallery_images.all().order_by('order')
        serializer = ProductImageSerializer(images, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        try:
            serializer = ProductImageCreateSerializer(
                data=request.data,
                context={'product': product}
            )
            
            if not serializer.is_valid():
                return Response(
                    {'errors': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            image = serializer.save()
            
            response_serializer = ProductImageSerializer(image)
            logger.info(f"Gallery image added to product {product.name}")
            
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        except Exception as e:
            logger.error(f"Error uploading gallery image: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al subir la imagen.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def product_gallery_image(request, image_id):
    """
    PATCH /api/products/gallery/{id}/ - Actualiza orden de imagen
    DELETE /api/products/gallery/{id}/ - Elimina imagen de galería
    """
    try:
        image = ProductImage.objects.get(id=image_id)
    except ProductImage.DoesNotExist:
        return Response(
            {'error': 'Imagen no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar permisos
    if image.product.store.owner != request.user and not request.user.is_superuser:
        return Response(
            {'error': 'No tienes permiso para modificar esta imagen.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'PATCH':
        try:
            order = request.data.get('order')
            if order is not None:
                image.order = order
                image.save(update_fields=['order'])
            
            serializer = ProductImageSerializer(image)
            logger.info(f"Gallery image updated: {image.id}")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error updating gallery image: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al actualizar la imagen.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'DELETE':
        try:
            # Eliminar de Cloudinary
            from core.cloudinary_utils import CloudinaryImageHandler
            from django.conf import settings
            
            if image.image and settings.USE_CLOUDINARY:
                try:
                    CloudinaryImageHandler.delete_image(image.image)
                except Exception as e:
                    logger.warning(f"Error deleting image from Cloudinary: {str(e)}")
            
            image.delete()
            
            logger.info(f"Gallery image deleted: {image.id}")
            
            return Response(
                {'message': 'Imagen eliminada exitosamente.'},
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Error deleting gallery image: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error al eliminar la imagen.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def public_product_list(request):
    """
    GET /api/products/ - Lista productos públicos de una tienda
    
    Query params:
    - store: UUID de la tienda (requerido)
    - category: UUID de categoría - Filtrar por categoría
    - limit: int - Limitar resultados
    - offset: int - Offset para paginación
    """
    store_id = request.query_params.get('store')
    
    if not store_id:
        return Response(
            {'error': 'Se requiere el parámetro store'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        store = Store.objects.get(id=store_id, is_deleted=False, status='active', is_verified=True)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada o no disponible'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Filtrar solo productos activos
    products = Product.objects.filter(
        store=store,
        status=ProductStatus.ACTIVE,
        is_deleted=False
    )
    
    # Filtros opcionales
    category_id = request.query_params.get('category')
    if category_id:
        products = products.filter(category_id=category_id)

    ids = request.query_params.get('ids')
    if ids:
        id_list = [id.strip() for id in ids.split(',') if id.strip()]
        if id_list:
            products = products.filter(id__in=id_list)

    featured = request.query_params.get('featured')
    if featured == 'true':
        # En el futuro podrías tener un campo 'is_featured' en el modelo
        # Por ahora devolvemos los más vendidos o simplemente los primeros
        products = products.order_by('-total_sold', 'sort_order', '-created_at')

    price_min = request.query_params.get('price_min')
    price_max = request.query_params.get('price_max')
    if price_min:
        try:
            products = products.filter(price__gte=Decimal(str(price_min)))
        except (InvalidOperation, ValueError, TypeError):
            pass
    if price_max:
        try:
            products = products.filter(price__lte=Decimal(str(price_max)))
        except (InvalidOperation, ValueError, TypeError):
            pass

    sort = request.query_params.get('sort') or request.query_params.get('ordering') or 'newest'
    if sort == 'price_asc':
        products = products.order_by('sort_order', 'price', '-created_at')
    elif sort == 'price_desc':
        products = products.order_by('sort_order', '-price', '-created_at')
    elif sort == 'popular':
        products = products.order_by('sort_order', '-total_sold', '-created_at')
    else:
        products = products.order_by('sort_order', '-created_at')
    
    # Paginación
    limit = request.query_params.get('limit')
    offset = request.query_params.get('offset', 0)
    
    if limit:
        try:
            limit = int(limit)
            offset = int(offset)
            products = products[offset:offset + limit]
        except (ValueError, TypeError):
            pass
    
    serializer = ProductListSerializer(products, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def public_category_list(request):
    """
    GET /api/categories/ - Lista categorías públicas de una tienda
    
    Query params:
    - store: UUID de la tienda (requerido)
    """
    store_id = request.query_params.get('store')
    
    if not store_id:
        return Response(
            {'error': 'Se requiere el parámetro store'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        store = Store.objects.get(id=store_id, is_deleted=False, status='active', is_verified=True)
    except Store.DoesNotExist:
        return Response(
            {'error': 'Tienda no encontrada o no disponible'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Obtener categorías disponibles para la tienda (globales + personalizadas)
    categories = ProductCategory.objects.for_store(store).order_by('sort_order', 'name')
    
    serializer = ProductCategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
