from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer
from apps.products.models import Product
from apps.stores.models import Store
from apps.users.authentication import BuyerAuthentication, CookieAuthentication

class CartViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar el carrito de compras.
    Permite acceso sin autenticación para usuarios anónimos (carrito en sesión).
    """
    serializer_class = CartSerializer
    authentication_classes = [CookieAuthentication, BuyerAuthentication]  # CookieAuth first
    permission_classes = [permissions.AllowAny]  # Permitir acceso sin autenticación

    def get_queryset(self):
        # Filtrar por el comprador autenticado (disponible en request.buyer vía BuyerAuthentication)
        buyer = getattr(self.request, 'buyer', None)
        if not buyer and self.request.user.is_authenticated:
            # TODO: Implement buyer profile system
            # Buyer model no longer exists - using User with roles
            # buyer = Buyer.objects.filter(user=self.request.user).first()
            pass
        
        if not buyer:
            return Cart.objects.none()
            
        return Cart.objects.filter(buyer=buyer)

    def get_cart(self):
        """Obtener o crear el carrito para el comprador y tienda actual."""
        # 1. Intentar obtener el buyer desde el request (establecido por la autenticación)
        buyer = getattr(self.request, 'buyer', None)
        if not buyer:
            buyer = getattr(self.request._request, 'buyer', None)
        
        # 2. Si no está en el request, intentar obtenerlo del usuario autenticado
        if not buyer and self.request.user.is_authenticated:
            from apps.users.models import Buyer
            store_slug = self.request.headers.get('X-Store-Slug')
            if store_slug:
                buyer = Buyer.objects.filter(
                    user=self.request.user, 
                    store__slug__iexact=store_slug
                ).first()
            
            # Fallback: primer perfil de buyer si no hay slug
            if not buyer:
                buyer = Buyer.objects.filter(user=self.request.user).first()
        
        # 3. Si hay buyer autenticado, usar carrito de BD
        if buyer:
            cart, created = Cart.objects.get_or_create(
                buyer=buyer,
                store=buyer.store
            )
            return cart
        
        # 4. Usuario anónimo: retornar None (el frontend maneja el carrito local)
        return None

    def list(self, request, *args, **kwargs):
        cart = self.get_cart()
        
        # Usuario autenticado con carrito en BD
        if cart:
            serializer = self.get_serializer(cart)
            return Response(serializer.data)
        
        # Usuario anónimo: devolver carrito vacío (el frontend maneja el carrito local)
        return Response({
            "items": [],
            "total_items": 0,
            "total_price": "0.00"
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='add')
    def add_item(self, request):
        """Añadir un producto al carrito."""
        try:
            product_id = request.data.get('product_id')
            quantity = int(request.data.get('quantity', 1))

            if not product_id:
                return Response({"error": "product_id es requerido."}, status=status.HTTP_400_BAD_REQUEST)

            # Obtener tienda desde header
            store_slug = request.headers.get('X-Store-Slug')
            if not store_slug:
                return Response(
                    {"error": "X-Store-Slug header es requerido."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Verificar que el producto existe y pertenece a la tienda
            try:
                store = Store.objects.get(slug__iexact=store_slug, is_deleted=False, status='active')
                product = Product.objects.get(id=product_id, store=store, is_deleted=False)
            except Store.DoesNotExist:
                return Response(
                    {"error": "Tienda no encontrada o inactiva."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            except Product.DoesNotExist:
                return Response(
                    {"error": "Producto no encontrado en esta tienda."}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            cart = self.get_cart()
            
            # Usuario autenticado: usar carrito de BD
            if cart:
                item, created = CartItem.objects.get_or_create(
                    cart=cart,
                    product=product,
                    defaults={'quantity': quantity}
                )

                if not created:
                    item.quantity += quantity
                    item.save()

                return Response(self.get_serializer(cart).data, status=status.HTTP_200_OK)
            
            # Usuario anónimo: devolver datos del producto para que el frontend lo maneje
            # Obtener URL de imagen de forma segura
            image_url = None
            try:
                if hasattr(product, 'image') and product.image:
                    image_url = product.image.url
            except Exception:
                pass
            
            return Response({
                "message": "Producto agregado (carrito local)",
                "product": {
                    "id": str(product.id),
                    "name": product.name,
                    "price": str(product.price),
                    "image": image_url,
                },
                "quantity": quantity
            }, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response(
                {"error": "Cantidad inválida."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Log del error para depuración
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in add_item: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {"error": "Error interno del servidor."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['patch'], url_path='update-item')
    def update_item(self, request):
        """Actualizar la cantidad de un item en el carrito."""
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        if not product_id:
            return Response({"error": "product_id es requerido."}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart()
        
        # Usuario autenticado
        if cart:
            item = get_object_or_404(CartItem, cart=cart, product_id=product_id)
            
            if quantity <= 0:
                item.delete()
            else:
                item.quantity = quantity
                item.save()

            return Response(self.get_serializer(cart).data)
        
        # Usuario anónimo: el frontend maneja esto localmente
        return Response({
            "message": "Actualizado (carrito local)",
            "product_id": product_id,
            "quantity": quantity
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete'], url_path='remove-item')
    def remove_item(self, request):
        """Eliminar un item del carrito."""
        product_id = request.query_params.get('product_id')

        if not product_id:
            return Response({"error": "product_id es requerido como query param."}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart()
        
        # Usuario autenticado
        if cart:
            item = get_object_or_404(CartItem, cart=cart, product_id=product_id)
            item.delete()
            return Response(self.get_serializer(cart).data)
        
        # Usuario anónimo: el frontend maneja esto localmente
        return Response({
            "message": "Eliminado (carrito local)",
            "product_id": product_id
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete'], url_path='clear')
    def clear_cart(self, request):
        """Vaciar el carrito completo."""
        cart = self.get_cart()
        
        # Usuario autenticado
        if cart:
            cart.items.all().delete()
            return Response(self.get_serializer(cart).data)
        
        # Usuario anónimo: el frontend maneja esto localmente
        return Response({
            "message": "Carrito vaciado (carrito local)",
            "items": [],
            "total_items": 0,
            "total_price": "0.00"
        }, status=status.HTTP_200_OK)
