"""
Buyer-specific views for profile management and orders.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .authentication import BuyerAuthentication
from .serializers import BuyerProfileSerializer, UserSerializer
from apps.orders.models import Order
from apps.orders.serializers import OrderListSerializer
import logging

logger = logging.getLogger(__name__)


class BuyerProfileView(APIView):
    """
    Get and update buyer profile.
    """
    authentication_classes = [BuyerAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current buyer profile."""
        buyer = request.buyer
        return Response({
            'user': UserSerializer(buyer.user).data,
            'buyer_profile': BuyerProfileSerializer(buyer).data,
        })

    def patch(self, request):
        """Update buyer profile."""
        buyer = request.buyer
        user = buyer.user
        
        # Update user fields
        user_data = {}
        if 'email' in request.data:
            user_data['email'] = request.data['email']
        
        if user_data:
            user_serializer = UserSerializer(user, data=user_data, partial=True)
            if user_serializer.is_valid():
                user_serializer.save()
            else:
                return Response(user_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Update buyer profile fields
        buyer_data = {}
        if 'minecraft_username' in request.data:
            buyer_data['minecraft_username'] = request.data['minecraft_username']
        
        if buyer_data:
            buyer_serializer = BuyerProfileSerializer(buyer, data=buyer_data, partial=True)
            if buyer_serializer.is_valid():
                buyer_serializer.save()
            else:
                return Response(buyer_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Buyer profile updated: {buyer.user.username}")
        
        return Response({
            'user': UserSerializer(user).data,
            'buyer_profile': BuyerProfileSerializer(buyer).data,
            'message': 'Perfil actualizado correctamente'
        })


class BuyerChangePasswordView(APIView):
    """
    Change buyer password.
    """
    authentication_classes = [BuyerAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Change password."""
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response({
                'message': 'Se requiere contraseña actual y nueva contraseña'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify current password
        if not user.check_password(current_password):
            return Response({
                'message': 'La contraseña actual es incorrecta'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate new password length
        if len(new_password) < 8:
            return Response({
                'message': 'La nueva contraseña debe tener al menos 8 caracteres'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        logger.info(f"Password changed for buyer: {user.username}")
        
        return Response({
            'message': 'Contraseña actualizada correctamente'
        })


class BuyerOrdersView(APIView):
    """
    Get buyer orders.
    """
    authentication_classes = [BuyerAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all orders for current buyer."""
        buyer = request.buyer
        
        # Get orders for this buyer in this store
        # Note: Order.buyer is a ForeignKey to User, not Buyer model
        orders = Order.objects.filter(
            buyer=buyer.user,  # Use buyer.user instead of buyer
            store=buyer.store
        ).order_by('-created_at')
        
        logger.info(f"Found {orders.count()} orders for buyer {buyer.user.username} in store {buyer.store.name}")
        
        serializer = OrderListSerializer(orders, many=True)
        
        return Response({
            'results': serializer.data,
            'count': orders.count()
        })


class BuyerSettingsView(APIView):
    """
    Get and update buyer settings (notifications, language, etc.).
    Note: This is a placeholder for future implementation.
    """
    authentication_classes = [BuyerAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get buyer settings."""
        # For now, return default settings
        return Response({
            'email_notifications': True,
            'order_updates': True,
            'promotional_emails': False,
            'language': 'es',
        })

    def patch(self, request):
        """Update buyer settings."""
        # For now, just acknowledge the update
        # In the future, store these in a BuyerSettings model
        return Response({
            'message': 'Configuración guardada correctamente'
        })
