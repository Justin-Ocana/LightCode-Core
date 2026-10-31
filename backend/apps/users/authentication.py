"""
Custom authentication class for Buyers using X-Buyer-Token header.
"""
from rest_framework import authentication
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.conf import settings
from apps.users.models import Buyer

User = get_user_model()

class CookieAuthentication(authentication.BaseAuthentication):
    """
    Generic authentication class that reads tokens from HttpOnly cookies.
    Works for both Sellers (dashboard) and Buyers (storefront).
    """
    def authenticate(self, request):
        # 1. Try to get seller token
        seller_token = request.COOKIES.get('seller_access_token')
        if seller_token:
            try:
                token = AccessToken(seller_token)
                if token.get('user_type') != 'seller':
                    return None # Let other backends handle it
                
                user = User.objects.get(id=token['user_id'], is_active=True)
                return (user, token)
            except Exception:
                return None

        # 2. Try to get buyer token (from any store)
        for cookie_name, token_val in request.COOKIES.items():
            if cookie_name.startswith('buyer_access_token_'):
                try:
                    token = AccessToken(token_val)
                    if token.get('type') != 'buyer':
                        continue
                    
                    buyer_id = token.get('buyer_id')
                    store_id = token.get('store_id')
                    
                    buyer = Buyer.objects.select_related('user', 'store').get(
                        id=buyer_id,
                        store_id=store_id,
                        user__is_active=True,
                        is_banned=False
                    )
                    
                    # Attach context
                    request.buyer = buyer
                    request.store = buyer.store
                    return (buyer.user, token)
                except Exception:
                    continue
                    
        return None

class BuyerAuthentication(authentication.BaseAuthentication):
    """
    Authenticates buyers using the 'X-Buyer-Token' header.
    """
    def authenticate(self, request):
        # 1. Try to get token from header
        buyer_token = request.headers.get('X-Buyer-Token')
        
        # 2. If not in header, try to get from cookie
        if not buyer_token:
            # Intentar obtener el slug de la tienda para buscar la cookie específica
            store_slug = request.headers.get('X-Store-Slug')
            
            if store_slug:
                buyer_token = request.COOKIES.get(f'buyer_access_token_{store_slug}')
            
            # Si aún no tenemos token, buscar en cualquier cookie de buyer como fallback
            if not buyer_token:
                for cookie_name, token_val in request.COOKIES.items():
                    if cookie_name.startswith('buyer_access_token_'):
                        buyer_token = token_val
                        break
        
        if not buyer_token:
            return None

        try:
            token = AccessToken(buyer_token)
            
            # 1. Verify token type
            if token.get('type') != 'buyer':
                return None  # Let it pass as anonymous
            
            # 2. Get buyer profile
            buyer_id = token.get('buyer_id')
            store_id = token.get('store_id')
            
            if not buyer_id or not store_id:
                return None  # Let it pass as anonymous
            
            try:
                buyer = Buyer.objects.select_related('user', 'store').get(
                    id=buyer_id,
                    store_id=store_id,
                    user__is_active=True,
                    is_banned=False
                )
            except Buyer.DoesNotExist:
                return None  # Let it pass as anonymous

            # 3. Attach store context to request for easy access in views
            request.buyer = buyer
            request.store = buyer.store
            
            # Return (user, token) as required by DRF
            return (buyer.user, token)

        except Exception as e:
            # Token expired or invalid - let it pass as anonymous
            return None

    def authenticate_header(self, request):
        return 'X-Buyer-Token'
