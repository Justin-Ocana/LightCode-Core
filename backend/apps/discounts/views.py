from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Discount, DiscountUsage, DiscountCodeType
from .serializers import DiscountSerializer
from apps.stores.models import Store

class DiscountViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar descuentos desde el Dashboard.
    """
    serializer_class = DiscountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filtrar por tienda específica si viene en los params
        store_id = self.request.query_params.get('store')
        queryset = Discount.objects.filter(store__owner=self.request.user)
        
        if store_id:
            queryset = queryset.filter(store_id=store_id)
            
        return queryset

    def perform_create(self, serializer):
        # Asignar la tienda automáticamente (vía store_id en el body o contexto)
        store_id = self.request.data.get('store')
        if not store_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'store': 'Store ID is required'})
            
        store = get_object_or_404(Store, id=store_id, owner=self.request.user)
        discount = serializer.save(store=store)
        
        # Log para debug
        print(f"Descuento creado: {discount.id} - {discount.code}")
        return discount

    @action(detail=False, methods=['post'], url_path='validate', permission_classes=[])
    def validate_code(self, request):
        """
        Endpoint público para validar un código desde el checkout.
        Retorna validación detallada con mensajes específicos.
        """
        code = request.data.get('code', '').strip().upper()
        store_slug = request.headers.get('X-Store-Slug', '').strip()
        
        if not code:
            return Response({
                'error': 'Código requerido',
                'details': {
                    'code': 'MISSING_CODE',
                    'reason': 'Debes proporcionar un código de cupón'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not store_slug:
            return Response({
                'error': 'Tienda no identificada',
                'details': {
                    'code': 'MISSING_STORE',
                    'reason': 'No se pudo identificar la tienda'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Buscar el descuento
        discount = Discount.objects.filter(
            store__slug__iexact=store_slug, 
            code__iexact=code
        ).first()

        if not discount:
            return Response({
                'error': 'Cupón no encontrado',
                'details': {
                    'code': 'NOT_FOUND',
                    'reason': f'El cupón "{code}" no existe o no está disponible en esta tienda'
                }
            }, status=status.HTTP_404_NOT_FOUND)

        # Obtener datos del carrito
        cart_total = float(request.data.get('cart_total', 0))
        cart_items_count = int(request.data.get('cart_items_count', 0))
        cart_products = request.data.get('cart_products', [])  # Lista de IDs de productos
        
        # Obtener buyer si está autenticado
        buyer = None
        if request.user.is_authenticated and hasattr(request.user, 'buyer_profile'):
            buyer = request.user.buyer_profile
        
        # Validar con todas las reglas
        is_valid, message, details = discount.is_valid(
            buyer=buyer,
            cart_total=cart_total,
            cart_items_count=cart_items_count,
            cart_products=cart_products
        )
        
        if not is_valid:
            return Response({
                'error': message,
                'details': details
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calcular el descuento aplicable
        discount_amount = 0
        if discount.discount_type == 'PERCENTAGE':
            discount_amount = cart_total * (float(discount.value) / 100)
        else:
            discount_amount = min(float(discount.value), cart_total)

        return Response({
            'id': discount.id,
            'code': discount.code,
            'name': discount.name,
            'discount_type': discount.discount_type,
            'value': float(discount.value),
            'scope': discount.scope,
            'discount_amount': round(discount_amount, 2),
            'message': '¡Cupón aplicado exitosamente!',
            'details': details
        })

    @action(detail=False, methods=['post'], url_path='bulk-generate')
    def bulk_generate(self, request):
        """
        Generar múltiples códigos personales a la vez.
        """
        count = int(request.data.get('count', 1))
        store_id = request.data.get('store')
        store = get_object_or_404(Store, id=store_id, owner=self.request.user)
        
        # Datos base para los códigos
        base_data = {
            'store': store,
            'name': request.data.get('name', 'Bulk Generated'),
            'code_type': DiscountCodeType.PERSONAL,
            'discount_type': request.data.get('discount_type', 'PERCENTAGE'),
            'value': request.data.get('value', 0),
            'max_uses_global': 1,
            'max_uses_per_user': 1,
        }

        generated = []
        for _ in range(min(count, 100)): # Límite de 100 por vez
            code = Discount.generate_random_code()
            discount = Discount.objects.create(code=code, **base_data)
            generated.append(DiscountSerializer(discount).data)

        return Response(generated, status=status.HTTP_201_CREATED)
