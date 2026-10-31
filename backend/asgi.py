"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

# Monkey patch for channels-redis 4.3.0 compatibility with Python 3.14
# The require_valid_group_name and require_valid_channel_name methods were removed
# but are still being called via assertions. We add them back as simple validators.
try:
    from channels_redis.core import RedisChannelLayer
    
    def require_valid_group_name(self, name):
        """Validate group name format."""
        if not isinstance(name, str):
            return False
        if len(name) == 0 or len(name) > 100:
            return False
        # Group names should be alphanumeric with underscores, hyphens, and dots
        import re
        return bool(re.match(r'^[a-zA-Z0-9_\-\.]+$', name))
    
    def require_valid_channel_name(self, name, receive=False):
        """Validate channel name format."""
        if not isinstance(name, str):
            return False
        if len(name) == 0 or len(name) > 100:
            return False
        # Channel names should be alphanumeric with underscores, hyphens, dots, and exclamation marks
        import re
        return bool(re.match(r'^[a-zA-Z0-9_\-\.!]+$', name))
    
    # Only patch if methods don't exist
    if not hasattr(RedisChannelLayer, 'require_valid_group_name'):
        RedisChannelLayer.require_valid_group_name = require_valid_group_name
    if not hasattr(RedisChannelLayer, 'require_valid_channel_name'):
        RedisChannelLayer.require_valid_channel_name = require_valid_channel_name
except ImportError:
    pass  # channels-redis not installed or different version

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.production')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

from core.routing import websocket_urlpatterns
from core.jwt_auth_middleware import JWTAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
