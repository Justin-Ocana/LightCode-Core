"""
PayPal OAuth Service - Login with PayPal

Permite a los vendedores conectar su cuenta PayPal usando OAuth.
Similar a "Login with Google" pero para PayPal.

Flow:
1. Vendedor hace clic en "Conectar PayPal"
2. Redirige a PayPal OAuth
3. Vendedor autoriza
4. PayPal devuelve code
5. Intercambiamos code por access_token
6. Obtenemos email + payer_id del vendedor
7. Guardamos en DB

Luego en pagos:
- Usamos payee.email_address para enviar dinero directo al vendedor
- Sin intermediarios, sin Partner API
"""
import requests
import base64
import logging
from django.conf import settings
from .models import PayPalConnection, PaymentIntegrationLog

logger = logging.getLogger(__name__)


class PayPalOAuthService:
    """Service for PayPal OAuth (Login with PayPal)."""
    
    def __init__(self):
        """Initialize with credentials from settings."""
        self.client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '')
        self.mode = getattr(settings, 'PAYPAL_MODE', 'sandbox')
        
        # API Base URLs
        if self.mode == 'live':
            self.base_url = 'https://api.paypal.com'
            self.auth_url = 'https://www.paypal.com'
        else:
            self.base_url = 'https://api.sandbox.paypal.com'
            self.auth_url = 'https://www.sandbox.paypal.com'
        
        # Validate credentials (configured via .env)
        if not all([self.client_id, self.client_secret]):
            pass  # Credentials configured per whitelabel instance
    
    def _get_auth_header(self):
        """Get Basic Auth header for API requests."""
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    def get_authorization_url(self, redirect_uri, state=None):
        """
        Generate PayPal OAuth authorization URL.
        
        Args:
            redirect_uri: URL where PayPal will redirect after authorization
            state: Optional state parameter for CSRF protection
        
        Returns:
            str: Authorization URL to redirect user to
        
        Docs: https://developer.paypal.com/docs/log-in-with-paypal/integrate/
        """
        # Scopes we need
        scopes = [
            'openid',           # Required for OAuth
            'email',            # Get user's email
            'profile',          # Get user's name
        ]
        
        params = {
            'client_id': self.client_id,
            'response_type': 'code',
            'scope': ' '.join(scopes),
            'redirect_uri': redirect_uri,
        }
        
        if state:
            params['state'] = state
        
        # Build URL
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        auth_url = f"{self.auth_url}/signin/authorize?{query_string}"
        
        logger.info(f"Generated PayPal OAuth URL: {auth_url[:100]}...")
        
        return auth_url
    
    def exchange_code_for_token(self, code, redirect_uri):
        """
        Exchange authorization code for access token.
        
        Args:
            code: Authorization code from PayPal callback
            redirect_uri: Same redirect_uri used in authorization
        
        Returns:
            dict with access_token, refresh_token, etc. or None on error
        
        Docs: https://developer.paypal.com/docs/log-in-with-paypal/integrate/
        """
        url = f"{self.base_url}/v1/oauth2/token"
        
        headers = {
            'Authorization': self._get_auth_header(),
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            logger.info("✅ Successfully exchanged code for token")
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to exchange code for token: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
    
    def get_user_info(self, access_token):
        """
        Get user information using access token.
        
        Args:
            access_token: Access token from exchange_code_for_token
        
        Returns:
            dict with user info (email, payer_id, name) or None on error
        
        Docs: https://developer.paypal.com/docs/log-in-with-paypal/integrate/
        """
        url = f"{self.base_url}/v1/identity/openidconnect/userinfo?schema=openid"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            user_info = response.json()
            
            # Extract relevant info
            result = {
                'email': user_info.get('email'),
                'payer_id': user_info.get('payer_id') or user_info.get('user_id'),
                'name': user_info.get('name'),
                'given_name': user_info.get('given_name'),
                'family_name': user_info.get('family_name'),
                'verified_account': user_info.get('verified_account', False),
            }
            
            logger.info(f"✅ Retrieved user info for {result['email']}")
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get user info: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
    
    def connect_store(self, store, code, redirect_uri):
        """
        Complete OAuth flow and connect store to PayPal account.
        
        Args:
            store: Store instance
            code: Authorization code from PayPal callback
            redirect_uri: Redirect URI used in authorization
        
        Returns:
            PayPalConnection instance or None on error
        """
        # Exchange code for token
        token_data = self.exchange_code_for_token(code, redirect_uri)
        if not token_data:
            logger.error("Failed to exchange code for token")
            return None
        
        access_token = token_data.get('access_token')
        refresh_token = token_data.get('refresh_token')
        
        if not access_token:
            logger.error("No access token in response")
            return None
        
        # Get user info
        user_info = self.get_user_info(access_token)
        if not user_info or not user_info.get('email'):
            logger.error("Failed to get user info or email")
            return None
        
        # Create or update PayPalConnection
        connection, created = PayPalConnection.objects.update_or_create(
            store=store,
            defaults={
                'merchant_email': user_info['email'],
                'merchant_id': user_info.get('payer_id', ''),
                'status': 'connected',
                'connection_type': 'oauth',
            }
        )
        
        # Store tokens (encrypted)
        if access_token:
            connection.set_access_token(access_token)
        if refresh_token:
            connection.set_refresh_token(refresh_token)
        
        connection.mark_connected()
        
        # Log event
        PaymentIntegrationLog.log_event(
            store=store,
            provider='paypal',
            event_type='oauth_connected',
            message=f'PayPal account connected via OAuth: {user_info["email"]}',
            metadata={
                'email': user_info['email'],
                'payer_id': user_info.get('payer_id'),
                'verified': user_info.get('verified_account', False),
            }
        )
        
        action = "created" if created else "updated"
        logger.info(f"✅ PayPal connection {action} for store {store.slug}")
        logger.info(f"   Email: {user_info['email']}")
        logger.info(f"   Payer ID: {user_info.get('payer_id')}")
        
        return connection
    
    def disconnect_store(self, store):
        """
        Disconnect PayPal account from store.
        
        Args:
            store: Store instance
        
        Returns:
            bool: True if disconnected successfully
        """
        try:
            connection = PayPalConnection.objects.get(store=store)
            connection.disconnect()
            
            PaymentIntegrationLog.log_event(
                store=store,
                provider='paypal',
                event_type='oauth_disconnected',
                message='PayPal account disconnected'
            )
            
            logger.info(f"✅ PayPal disconnected for store {store.slug}")
            
            return True
            
        except PayPalConnection.DoesNotExist:
            logger.warning(f"No PayPal connection found for store {store.slug}")
            return False
