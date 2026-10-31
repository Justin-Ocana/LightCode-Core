"""
Authentication views for multi-tenant system.
"""
from rest_framework import status, viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .authentication import BuyerAuthentication
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from apps.stores.models import Store
from .models import Seller, Buyer
from .serializers import (
    UserSerializer,
    SellerProfileSerializer,
    BuyerProfileSerializer,
    SellerRegistrationSerializer,
    BuyerRegistrationSerializer,
    SellerLoginSerializer,
    BuyerLoginSerializer,
    AdminLoginSerializer,
)
from .tokens import (
    get_tokens_for_seller,
    get_tokens_for_buyer,
    get_tokens_for_admin,
)
from .utils import set_auth_cookies
import logging
import uuid
from datetime import timedelta
from rest_framework.throttling import AnonRateThrottle

User = get_user_model()
logger = logging.getLogger(__name__)

class AuthThrottle(AnonRateThrottle):
    scope = 'auth'

class RegisterThrottle(AnonRateThrottle):
    scope = 'register'

class AuthViewSet(viewsets.ViewSet):
    """
    Authentication endpoints for all user types.
    
    Endpoints:
    - GET /api/auth/csrf/ - Get CSRF token
    - POST /api/auth/seller/register/ - Register as seller
    - POST /api/auth/seller/login/ - Login as seller
    - POST /api/auth/buyer/register/ - Register as buyer (requires store_slug)
    - POST /api/auth/buyer/login/ - Login as buyer (requires store_slug)
    - POST /api/auth/admin/login/ - Login as admin
    - POST /api/auth/logout/ - Logout (invalidate token)
    - GET /api/auth/me/ - Get current user info
    """
    
    # ============= CSRF TOKEN =============
    
    @action(detail=False, methods=['get'], permission_classes=[AllowAny], url_path='csrf')
    def get_csrf_token(self, request):
        """
        Get CSRF token for authentication.
        This endpoint sets the CSRF cookie.
        """
        from django.middleware.csrf import get_token
        csrf_token = get_token(request)
        return Response({
            'csrfToken': csrf_token
        }, status=status.HTTP_200_OK)
    
    # ============= SELLER AUTH =============
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='seller/register', throttle_classes=[RegisterThrottle])
    def seller_register(self, request):
        """
        Register new seller at lightcode.com/register
        """
        serializer = SellerRegistrationSerializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as e:
            # Formatear errores para el frontend
            errors = {}
            for field, messages in e.detail.items():
                if isinstance(messages, list):
                    errors[field] = messages[0]
                else:
                    errors[field] = str(messages)
            
            return Response({
                'errors': errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = serializer.save()

        # Generate 6-digit verification code (expires in 15 minutes)
        import random
        code = str(random.randint(100000, 999999))
        user.email_verification_token = code
        user.email_verification_token_expires_at = timezone.now() + timedelta(minutes=15)
        user.save(update_fields=['email_verification_token', 'email_verification_token_expires_at'])

        # Send verification email — Celery si está disponible, directo como fallback
        try:
            from core.tasks import send_verification_email
            try:
                send_verification_email.delay(str(user.id))
                logger.info(f"Verification email queued via Celery for {user.username}")
            except Exception:
                # Celery no disponible — enviar directo
                send_verification_email(str(user.id))
                logger.info(f"Verification email sent directly for {user.username}")
        except Exception as e:
            logger.warning(f"Could not send verification email for {user.username}: {e}")
            print(f"\nVerification Code for {user.email}: {code}\n")

        tokens = get_tokens_for_seller(user)
        
        logger.info(f"New seller registered: {user.username}")
        
        response = Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
            'message': 'Cuenta creada exitosamente. Revisá tu email para verificar tu cuenta.',
            'email_verification_required': True,
        }, status=status.HTTP_201_CREATED)
        
        return set_auth_cookies(response, tokens, prefix='seller', request=request)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='seller/login', throttle_classes=[])
    def seller_login(self, request):
        """
        Login seller at lightcode.com/login
        """
        serializer = SellerLoginSerializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as e:
            # Manejar errores de validación del serializer
            errors = {}
            for field, messages in e.detail.items():
                if isinstance(messages, list):
                    errors[field] = messages[0]
                else:
                    errors[field] = str(messages)
            
            # Devolver el primer error encontrado
            first_field = list(errors.keys())[0]
            first_error = errors[first_field]
            
            return Response({
                'error': first_error,
                'field': first_field
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        # Find seller user
        try:
            user = User.objects.get(email=email, user_type='seller')
        except User.DoesNotExist:
            return Response(
                {
                    'error': 'No existe una cuenta con este email',
                    'field': 'email'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check password
        if not user.check_password(password):
            return Response(
                {
                    'error': 'Contraseña incorrecta',
                    'field': 'password'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if account is active
        if not user.is_active:
            return Response(
                {
                    'error': 'Tu cuenta ha sido desactivada. Contacta a soporte.',
                    'field': 'general'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # White-label: No email verification required
        
        # Get tokens
        try:
            tokens = get_tokens_for_seller(user)
        except Exception as e:
            logger.error(f"Error generating tokens for {user.username}: {str(e)}")
            return Response(
                {'error': 'Error al generar tokens de acceso'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Get profile data safely
        seller_profile_data = None
        if hasattr(user, 'seller_profile'):
            seller_profile_data = SellerProfileSerializer(user.seller_profile).data
        else:
            # Si no tiene perfil, crearlo (esto no debería pasar pero lo hacemos por robustez)
            try:
                profile = Seller.objects.create(user=user)
                seller_profile_data = SellerProfileSerializer(profile).data
            except Exception as e:
                logger.error(f"Error creating missing seller profile for {user.username}: {str(e)}")
        
        logger.info(f"Seller logged in: {user.username}")
        
        response = Response({
            'user': UserSerializer(user).data,
            'seller_profile': seller_profile_data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)
        
        return set_auth_cookies(response, tokens, prefix='seller', request=request)
    
    # ============= EMAIL VERIFICATION =============

    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='verify-email')
    def verify_email(self, request):
        """
        Verify seller email via 6-digit code.
        POST /api/auth/verify-email/  { "email": "...", "code": "123456" }
        """
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()

        if not email or not code:
            return Response(
                {'error': 'Email y código son requeridos', 'code': 'missing_fields'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # White-label: Email verification disabled
        return Response(
            {'message': 'Verificación de email no requerida en modo white-label', 'code': 'not_required'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='resend-verification')
    def resend_verification(self, request):
        """
        Resend verification email. Rate limited to 1 per 5 minutes.
        POST /api/auth/resend-verification/  { "email": "..." }
        """
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {'error': 'Email requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # White-label: Email verification disabled
        return Response(
            {'message': 'Verificación de email no requerida en modo white-label', 'code': 'not_required'},
            status=status.HTTP_200_OK
        )

    # ============= BUYER AUTH =============
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='buyer/register', throttle_classes=[])
    def buyer_register(self, request):
        """
        Register buyer at lightcode.com/store/{store_slug}/register
        
        Required: store_slug in request data
        """
        try:
            store_slug = request.data.get('store_slug')
            if not store_slug:
                return Response(
                    {'error': 'store_slug is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get store
            try:
                store = Store.objects.get(slug__iexact=store_slug, is_deleted=False)
                if store.status != 'active':
                    return Response(
                        {'error': f'La tienda "{store_slug}" no está activa actualmente.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            except Store.DoesNotExist:
                return Response(
                    {'error': f'La tienda "{store_slug}" no existe.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = BuyerRegistrationSerializer(
                data=request.data,
                store=store
            )
            serializer.is_valid(raise_exception=True)
            
            buyer = serializer.save()
            tokens = get_tokens_for_buyer(buyer.user, store.id, buyer.id)
            
            logger.info(f"New buyer registered: {buyer.user.username} @ {store.name}")
            
            response = Response({
                'user': UserSerializer(buyer.user).data,
                'buyer_profile': BuyerProfileSerializer(buyer).data,
                'tokens': tokens,
                'message': f'Registered successfully in {store.name}'
            }, status=status.HTTP_201_CREATED)
            
            return set_auth_cookies(response, tokens, prefix='buyer', slug=store_slug, request=request)
        except serializers.ValidationError as e:
            return Response({'errors': e.detail}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error in buyer_register: {str(e)}", exc_info=True)
            return Response({'error': 'Internal server error during registration'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='buyer/login', throttle_classes=[])
    def buyer_login(self, request):
        """
        Login buyer - SIMPLIFIED
        Required: store_slug, email, password
        """
        serializer = BuyerLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        store_slug = request.data.get('store_slug')
        if not store_slug:
            return Response(
                {'error': 'store_slug is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get store
        try:
            store = Store.objects.get(slug__iexact=store_slug, is_deleted=False)
            if store.status != 'active':
                return Response(
                    {'error': f'La tienda "{store_slug}" no está activa actualmente.'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Store.DoesNotExist:
            return Response(
                {'error': f'La tienda "{store_slug}" no existe.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        # Find buyer in THIS store by email only
        try:
            buyer = Buyer.objects.select_related('user').get(
                user__email=email,
                store=store
            )
        except Buyer.DoesNotExist:
            return Response(
                {'error': 'No existe una cuenta con este email en esta tienda'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check password
        if not buyer.user.check_password(password):
            return Response(
                {'error': 'Contraseña incorrecta'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if banned
        if buyer.is_banned:
            return Response(
                {'error': f'Account banned: {buyer.ban_reason}'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if user is active
        if not buyer.user.is_active:
            return Response(
                {'error': 'Account is disabled'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        tokens = get_tokens_for_buyer(buyer.user, store.id, buyer.id)
        
        logger.info(f"Buyer logged in: {buyer.user.username} @ {store.name}")
        
        response = Response({
            'user': UserSerializer(buyer.user).data,
            'buyer_profile': BuyerProfileSerializer(buyer).data,
            'store': {
                'id': str(store.id),
                'name': store.name,
                'slug': store.slug,
            },
            'tokens': tokens,
        }, status=status.HTTP_200_OK)
        
        return set_auth_cookies(response, tokens, prefix='buyer', slug=store_slug, request=request)
    
    # ============= ADMIN AUTH =============
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='admin/login', throttle_classes=[])
    def admin_login(self, request):
        """
        Login admin at lightcode.com/admin
        
        Only for superusers.
        """
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        # Authenticate
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if superuser
        if not user.is_superuser:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        tokens = get_tokens_for_admin(user)
        
        logger.info(f"Admin logged in: {user.username}")
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)
    
    # ============= COMMON =============
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        Get current authenticated user info.
        """
        user = request.user
        
        # White-label: No email verification required
        
        data = {
            'user': UserSerializer(user).data,
        }
        
        # Add profile based on user type
        if user.user_type == 'seller' and hasattr(user, 'seller_profile'):
            data['seller_profile'] = SellerProfileSerializer(user.seller_profile).data
        elif user.user_type == 'buyer':
            # Get buyer profiles (can have multiple)
            buyer_profiles = user.buyer_profiles.all()
            data['buyer_profiles'] = BuyerProfileSerializer(buyer_profiles, many=True).data
        
        return Response(data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        """
        Logout user (invalidates refresh token).
        """
        from rest_framework_simplejwt.tokens import RefreshToken
        
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            logger.info(f"User logged out: {request.user.username}")
            response = Response({
                'message': 'Sesión cerrada exitosamente'
            }, status=status.HTTP_200_OK)
            
            # Clear cookies (seller/admin and generic buyer ones)
            response.delete_cookie('seller_access_token')
            response.delete_cookie('seller_refresh_token')
            
            # Note: For buyers with slug-based cookies, it's harder to clear all
            # but we can clear the one if slug is provided in request
            store_slug = request.data.get('store_slug')
            if store_slug:
                response.delete_cookie(f'buyer_access_token_{store_slug}')
                response.delete_cookie(f'buyer_refresh_token_{store_slug}')
                
            return response
        except Exception as e:
            logger.error(f"Logout error for {request.user.username}: {str(e)}")
            return Response({
                'error': 'Error al cerrar sesión'
            }, status=status.HTTP_400_BAD_REQUEST)

    # ============= SELLER ACCOUNT =============

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='seller/me')
    def seller_me(self, request):
        """
        Get current authenticated seller info with their store.
        Auto-selects the seller's store for white-label setup.
        """
        if request.user.user_type != 'seller':
            return Response({
                'error': 'Solo los vendedores pueden acceder a esta información'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Obtener el perfil del seller
            seller_profile = request.user.seller_profile
            
            # Obtener la tienda del seller (debería ser solo una)
            from apps.stores.models import Store
            from apps.stores.serializers import StoreListSerializer
            
            store = Store.objects.filter(
                owner=request.user,
                is_deleted=False,
                status='active'
            ).first()
            
            response_data = {
                'user': UserSerializer(request.user).data,
                'seller_profile': SellerProfileSerializer(seller_profile).data,
                'store': None,
                'has_store': False
            }
            
            if store:
                response_data['store'] = StoreListSerializer(store).data
                response_data['has_store'] = True
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting seller info for {request.user.username}: {str(e)}")
            return Response({
                'error': 'Error obteniendo información del vendedor'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ============= BUYER ACCOUNT =============

    @action(detail=False, methods=['get'], authentication_classes=[BuyerAuthentication], permission_classes=[IsAuthenticated], url_path='buyer/me')
    def buyer_me(self, request):
        """
        Get current authenticated buyer info for a specific store.
        Uses X-Buyer-Token.
        """
        buyer = request.buyer
        return Response({
            'user': UserSerializer(request.user).data,
            'buyer_profile': BuyerProfileSerializer(buyer).data,
            'store': {
                'id': str(buyer.store.id),
                'name': buyer.store.name,
                'slug': buyer.store.slug,
            }
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='select-subscription')
    def select_subscription(self, request):
        """
        White-label: Subscription selection not supported.
        """
        return Response(
            {'message': 'Subscription selection not available in white-label mode'},
            status=status.HTTP_200_OK
        )


# ============= PROFILE MANAGEMENT =============

from rest_framework.views import APIView
from .serializers import ChangePasswordSerializer

class ProfileView(APIView):
    """
    Get and update user profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current user profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        """Update user profile."""
        from core.cloudinary_utils import CloudinaryImageHandler
        
        user = request.user
        image_uploaded = False
        
        # 1. Handle profile image upload
        if 'profile_image' in request.FILES:
            image_file = request.FILES['profile_image']
            try:
                # Upload to Cloudinary
                result = CloudinaryImageHandler.upload_image(
                    image_file,
                    folder='avatars',
                    transformation='avatar'
                )
                
                # Delete old avatar if exists
                if user.avatar:
                    try:
                        CloudinaryImageHandler.delete_image(user.avatar)
                    except:
                        pass
                
                # Update avatar field with public_id
                user.avatar = result['public_id']
                user.save()
                image_uploaded = True
                logger.info(f"Avatar updated for user {user.username}")
                
            except Exception as e:
                logger.error(f"Error uploading profile image: {str(e)}")
                return Response(
                    {'message': f'Error al subir la imagen: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # 2. Handle profile image deletion
        elif 'profile_image' in request.data and request.data['profile_image'] == '':
            if user.avatar:
                try:
                    CloudinaryImageHandler.delete_image(user.avatar)
                except Exception as e:
                    logger.error(f"Error deleting profile image: {str(e)}")
                
                user.avatar = None
                user.save()
        
        # 3. Update other fields (username, email, etc.)
        # Obtenemos un diccionario plano de los datos para limpiar campos no deseados
        data = {}
        for key, value in request.data.items():
            # No pasar archivos o campos de imagen al serializer de usuario
            if key not in ['profile_image', 'avatar', 'avatar_url']:
                data[key] = value

        serializer = UserSerializer(user, data=data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            logger.info(f"User profile data updated for {user.username}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Loguear error exacto para debugging
        logger.error(f"Profile update validation errors for {user.username}: {serializer.errors}")
        
        return Response({
            'message': 'Error de validación en los datos del perfil',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """
    Change user password.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Change password."""
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            # Set new password
            request.user.set_password(serializer.validated_data['new_password'])
            request.user.save()
            
            logger.info(f"Password changed for user: {request.user.username}")
            
            return Response({
                'message': 'Contraseña actualizada correctamente'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
