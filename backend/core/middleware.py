"""
Custom middleware for the application.
"""
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
import logging

logger = logging.getLogger(__name__)


class CsrfExemptBuyerAuthMiddleware(MiddlewareMixin):
    """
    Exempt buyer authentication endpoints from CSRF validation.
    
    Buyer auth uses JWT tokens, not session cookies, so CSRF is not needed.
    This middleware must be placed BEFORE CsrfViewMiddleware in settings.
    """
    
    EXEMPT_PATHS = [
        '/api/users/auth/buyer/login/',
        '/api/users/auth/buyer/register/',
        '/api/users/auth/buyer/profile/',
        '/api/users/auth/buyer/change-password/',
        '/api/users/auth/buyer/orders/',
        '/api/users/auth/buyer/settings/',
        '/api/users/auth/buyer/me/',
        '/api/stores/',  # Todas las rutas públicas de tiendas (checkout, productos, etc.)
    ]
    
    def process_request(self, request):
        """Mark buyer auth endpoints as CSRF exempt."""
        if any(request.path.startswith(path) for path in self.EXEMPT_PATHS):
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None


class AutomaticTokenRefreshMiddleware(MiddlewareMixin):
    """
    Automatically refresh JWT tokens when they're close to expiring.
    
    Checks access token expiration and refreshes if needed, updating the cookie
    to keep the session alive.
    """
    
    def process_request(self, request):
        """Check and refresh tokens if needed."""
        from apps.users.utils import set_auth_cookies
        from rest_framework_simplejwt.tokens import RefreshToken
        
        # 1. Check seller token
        seller_access = request.COOKIES.get('seller_access_token')
        seller_refresh = request.COOKIES.get('seller_refresh_token')
        
        if seller_access and seller_refresh:
            try:
                token = AccessToken(seller_access)
                
                # Check if token is close to expiring (less than 1 hour left)
                import time
                exp_timestamp = token.get('exp')
                current_timestamp = time.time()
                time_until_expiry = exp_timestamp - current_timestamp
                
                # If less than 1 hour until expiry, refresh it
                if time_until_expiry < 3600:  # 1 hour
                    try:
                        refresh = RefreshToken(seller_refresh)
                        new_access = str(refresh.access_token)
                        
                        # Store new tokens to set in response
                        request._new_seller_tokens = {
                            'access': new_access,
                            'refresh': str(refresh)
                        }
                        
                        # Update the Authorization header for this request
                        request.META['HTTP_AUTHORIZATION'] = f'Bearer {new_access}'
                        
                    except (TokenError, InvalidToken):
                        pass
                
            except (TokenError, InvalidToken, KeyError):
                pass
        
        # 2. Check buyer tokens (for all stores)
        for cookie_name, cookie_value in request.COOKIES.items():
            if cookie_name.startswith('buyer_access_token_'):
                slug = cookie_name.replace('buyer_access_token_', '')
                refresh_cookie_name = f'buyer_refresh_token_{slug}'
                buyer_refresh = request.COOKIES.get(refresh_cookie_name)
                
                if buyer_refresh:
                    try:
                        token = AccessToken(cookie_value)
                        
                        # Check if token is close to expiring (less than 2 hours left)
                        import time
                        exp_timestamp = token.get('exp')
                        current_timestamp = time.time()
                        time_until_expiry = exp_timestamp - current_timestamp
                        
                        # If less than 2 hours until expiry, refresh it
                        if time_until_expiry < 7200:  # 2 hours
                            try:
                                refresh = RefreshToken(buyer_refresh)
                                new_access = str(refresh.access_token)
                                
                                # Store new tokens to set in response
                                if not hasattr(request, '_new_buyer_tokens'):
                                    request._new_buyer_tokens = {}
                                
                                request._new_buyer_tokens[slug] = {
                                    'access': new_access,
                                    'refresh': str(refresh)
                                }
                                
                                # Update the Authorization header for this request if it matches
                                auth_header = request.META.get('HTTP_AUTHORIZATION', '')
                                if auth_header == f'Bearer {cookie_value}':
                                    request.META['HTTP_AUTHORIZATION'] = f'Bearer {new_access}'
                                
                            except (TokenError, InvalidToken):
                                pass
                    
                    except (TokenError, InvalidToken, KeyError):
                        pass
        
        return None
    
    def process_response(self, request, response):
        """Update cookies with refreshed tokens."""
        from apps.users.utils import set_auth_cookies
        
        # Update seller tokens if refreshed
        if hasattr(request, '_new_seller_tokens'):
            set_auth_cookies(response, request._new_seller_tokens, prefix='seller', request=request)
            response['X-Token-Refreshed'] = 'true'
        
        # Update buyer tokens if refreshed
        if hasattr(request, '_new_buyer_tokens'):
            for slug, tokens in request._new_buyer_tokens.items():
                set_auth_cookies(response, tokens, prefix='buyer', slug=slug, request=request)
            response['X-Token-Refreshed'] = 'true'
        
        return response
