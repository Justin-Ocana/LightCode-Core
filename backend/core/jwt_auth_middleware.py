"""
JWT Authentication Middleware for Django Channels WebSocket.
"""
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from urllib.parse import parse_qs
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_string):
    """
    Get user from JWT token.
    """
    try:
        # Validate and decode the token
        access_token = AccessToken(token_string)
        user_id = access_token['user_id']
        
        # Get the user
        user = User.objects.get(id=user_id)
        logger.info(f"✅ WebSocket authenticated user: {user.username} (ID: {user.id})")
        return user
    except (InvalidToken, TokenError) as e:
        logger.warning(f"⚠️ Invalid WebSocket token: {str(e)}")
        return AnonymousUser()
    except User.DoesNotExist:
        logger.warning(f"⚠️ User not found for token")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"❌ Error authenticating WebSocket: {str(e)}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    
    Token can be provided in:
    1. Query parameter: ?token=<jwt_token>
    2. Headers: Authorization: Bearer <jwt_token>
    """
    
    async def __call__(self, scope, receive, send):
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        # If no token in query, try headers
        if not token:
            headers = dict(scope.get('headers', []))
            auth_header = headers.get(b'authorization', b'').decode()
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        # Authenticate user
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            logger.warning("⚠️ No token provided for WebSocket connection")
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """
    Convenience function to wrap URLRouter with JWT authentication.
    """
    return JWTAuthMiddleware(inner)
