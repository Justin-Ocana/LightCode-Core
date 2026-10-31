"""
Authentication utility functions for setting cookies and managing tokens.
"""
from django.conf import settings
from django.middleware.csrf import get_token
import logging

logger = logging.getLogger(__name__)

def set_auth_cookies(response, tokens, prefix='seller', slug=None, request=None):
    """
    Helper to set authentication cookies in the response.
    """
    access_cookie_name = f'{prefix}_access_token'
    refresh_cookie_name = f'{prefix}_refresh_token'
    
    if slug:
        access_cookie_name = f'buyer_access_token_{slug}'
        refresh_cookie_name = f'buyer_refresh_token_{slug}'
        
    # Cookie security settings
    cookie_kwargs = {
        'httponly': getattr(settings, 'AUTH_COOKIE_HTTP_ONLY', True),
        'secure': getattr(settings, 'AUTH_COOKIE_SECURE', False),
        'samesite': getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax'),
        'domain': getattr(settings, 'AUTH_COOKIE_DOMAIN', None),
    }
    
    # Access token - Aumentado a 24 horas para mejor persistencia
    response.set_cookie(
        access_cookie_name,
        tokens['access'],
        max_age=24 * 3600,  # 24 horas
        **cookie_kwargs
    )
    
    # Refresh token - Aumentado a 14 días
    response.set_cookie(
        refresh_cookie_name,
        tokens['refresh'],
        max_age=14 * 24 * 3600,  # 14 días
        **cookie_kwargs
    )
    
    # CSRF Token (Explicito para React)
    if request:
        try:
            # Use the underlying Django request for get_token
            django_request = getattr(request, '_request', request)
            csrf_token = get_token(django_request)
            response.set_cookie(
                'csrftoken',
                csrf_token,
                max_age=24 * 3600, # 1 day
                httponly=False, # React needs to read it
                secure=cookie_kwargs['secure'],
                samesite=cookie_kwargs['samesite'],
            )
        except Exception as e:
            logger.error(f"Error setting CSRF cookie: {str(e)}")
    
    return response
