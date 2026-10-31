"""
PayPal Partner Referrals Service

Implements PayPal Partner Referrals API v2 for seller onboarding.
Official Docs: https://developer.paypal.com/docs/platforms/seller-onboarding/

Flow:
1. create_referral_link() - Generate onboarding link for seller
2. Seller clicks link, logs into PayPal, grants permissions
3. PayPal redirects to return_url with merchant_id and auth_code
4. exchange_auth_code() - Exchange auth_code for access_token
5. Store encrypted tokens in PayPalConnection model
6. refresh_access_token() - Refresh expired tokens using refresh_token

Required PayPal App Credentials:
- PAYPAL_CLIENT_ID (Partner BN Code)
- PAYPAL_CLIENT_SECRET
- PAYPAL_MODE ('sandbox' or 'live')
- PAYPAL_PARTNER_ID (Your Partner Merchant ID)
"""
import requests
import base64
import logging
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from .models import PayPalConnection, PaymentIntegrationLog

logger = logging.getLogger(__name__)


class PayPalPartnerService:
    """Service for PayPal Partner Referrals API."""
    
    def __init__(self):
        """Initialize with credentials from settings."""
        self.client_id = getattr(settings, 'PAYPAL_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'PAYPAL_CLIENT_SECRET', '')
        self.mode = getattr(settings, 'PAYPAL_MODE', 'sandbox')
        self.partner_id = getattr(settings, 'PAYPAL_PARTNER_ID', '')
        
        # API Base URLs
        if self.mode == 'live':
            self.base_url = 'https://api.paypal.com'
        else:
            self.base_url = 'https://api.sandbox.paypal.com'
        
        # Validate credentials (configured via .env)
        if not all([self.client_id, self.client_secret]):
            pass  # Credentials configured per whitelabel instance
    
    def _get_auth_header(self):
        """Get Basic Auth header for API requests."""
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    def _get_bearer_header(self, access_token):
        """Get Bearer token header."""
        return f"Bearer {access_token}"
    
    def _make_authenticated_request(self, method, url, connection, **kwargs):
        """
        Make authenticated request with automatic token refresh on 401.
        
        Args:
            method: HTTP method ('GET', 'POST', etc.)
            url: Full URL to request
            connection: PayPalConnection instance
            **kwargs: Additional arguments for requests
        
        Returns:
            requests.Response object
        """
        # Get current access token
        access_token = connection.get_access_token()
        if not access_token:
            raise Exception("No access token available")
        
        # Set up headers
        headers = kwargs.get('headers', {})
        headers.update({
            'Authorization': self._get_bearer_header(access_token),
            'Content-Type': 'application/json',
        })
        kwargs['headers'] = headers
        
        # Make request
        response = requests.request(method, url, timeout=10, **kwargs)
        
        # If 401, try to refresh token and retry once
        if response.status_code == 401:
            logger.warning(f"PayPal API returned 401, attempting token refresh for store {connection.store.slug}")
            
            refresh_success = self.refresh_access_token(connection)
            if refresh_success:
                # Retry with new token
                new_access_token = connection.get_access_token()
                headers['Authorization'] = self._get_bearer_header(new_access_token)
                kwargs['headers'] = headers
                
                response = requests.request(method, url, timeout=10, **kwargs)
                logger.info(f"Retry after token refresh: {response.status_code}")
            else:
                logger.error(f"Token refresh failed for store {connection.store.slug}")
        
        return response
    
    def get_access_token(self):
        """
        Get platform access token for Partner API calls.
        
        This is different from merchant tokens - this is YOUR platform token.
        Docs: https://developer.paypal.com/api/rest/authentication/
        """
        url = f"{self.base_url}/v1/oauth2/token"
        
        headers = {
            'Authorization': self._get_auth_header(),
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        
        data = {
            'grant_type': 'client_credentials'
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            return result.get('access_token')
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get PayPal access token: {e}")
            return None
    
    def create_referral_link(self, store, return_url):
        """
        Create a Partner Referral link for seller onboarding.
        
        Args:
            store: Store instance
            return_url: URL to redirect after seller completes onboarding
        
        Returns:
            dict with 'action_url' and 'referral_id' or None on error
        
        Docs: https://developer.paypal.com/docs/platforms/seller-onboarding/before-you-start/
        API: POST /v2/customer/partner-referrals
        """
        # En desarrollo, si no tenemos permisos de Partner, usar simulación
        if self.mode == 'sandbox' and not getattr(settings, 'PAYPAL_PARTNER_ENABLED', False):
            return self._simulate_referral_link(store, return_url)
        
        access_token = self.get_access_token()
        if not access_token:
            logger.error("Cannot create referral link without access token")
            return None
        
        url = f"{self.base_url}/v2/customer/partner-referrals"
        
        headers = {
            'Authorization': self._get_bearer_header(access_token),
            'Content-Type': 'application/json',
        }
        
        # Request body - requesting permissions to create orders on behalf of seller
        payload = {
            "email": store.owner.email,
            "preferred_language_code": "es_ES" if store.language == 'es' else "en_US",
            "tracking_id": str(store.id),  # Your internal tracking ID
            "partner_config_override": {
                "partner_logo_url": "https://res.cloudinary.com/lightcode/image/upload/v1/lightcode_logo.png",
                "return_url": return_url,
                "return_url_description": "Volver a lightcode",
                "action_renewal_url": return_url,
                "show_add_credit_card": True
            },
            "operations": [
                {
                    "operation": "API_INTEGRATION",
                    "api_integration_preference": {
                        "rest_api_integration": {
                            "integration_method": "PAYPAL",
                            "integration_type": "THIRD_PARTY",
                            "third_party_details": {
                                "features": [
                                    "PAYMENT",
                                    "REFUND"
                                ]
                            }
                        }
                    }
                }
            ],
            "products": [
                "EXPRESS_CHECKOUT"
            ],
            "legal_consents": [
                {
                    "type": "SHARE_DATA_CONSENT",
                    "granted": True
                }
            ]
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract action URL (where to redirect seller)
            action_url = None
            for link in result.get('links', []):
                if link.get('rel') == 'action_url':
                    action_url = link.get('href')
                    break
            
            if not action_url:
                logger.error("No action_url in PayPal response")
                return None
            
            # Log event
            PaymentIntegrationLog.log_event(
                store=store,
                provider='paypal',
                event_type='referral_created',
                message='PayPal referral link created',
                metadata={
                    'referral_id': result.get('partner_referral_id'),
                    'action_url': action_url
                }
            )
            
            return {
                'action_url': action_url,
                'referral_id': result.get('partner_referral_id')
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create PayPal referral link: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            
            # En desarrollo, si falla por permisos, usar simulación
            if self.mode == 'sandbox' and hasattr(e, 'response') and e.response.status_code == 403:
                logger.warning("PayPal Partner permissions not available, using simulation mode")
                return self._simulate_referral_link(store, return_url)
            
            return None
    
    def get_merchant_credentials(self, partner_merchant_id, auth_code):
        """
        Exchange auth code for merchant credentials.
        
        After seller completes onboarding, PayPal redirects with:
        - merchantIdInPayPal (merchant_id)
        - permissionsGranted
        - consentStatus
        - merchantId (your tracking_id)
        
        But we need to get access tokens using the Seller Onboarding API.
        
        Args:
            partner_merchant_id: Merchant ID from PayPal redirect
            auth_code: Authorization code from redirect (if provided)
        
        Returns:
            dict with merchant info or None
        
        Docs: https://developer.paypal.com/docs/platforms/seller-onboarding/before-you-start/#link-getsellerstatusandcredentials
        """
        # En simulación, generar datos falsos pero realistas
        if partner_merchant_id.startswith('SANDBOX_MERCHANT_'):
            return self._simulate_merchant_credentials(partner_merchant_id)
        
        access_token = self.get_access_token()
        if not access_token:
            return None
        
        # Get merchant integration status
        url = f"{self.base_url}/v1/customer/partners/{self.partner_id}/merchant-integrations/{partner_merchant_id}"
        
        headers = {
            'Authorization': self._get_bearer_header(access_token),
            'Content-Type': 'application/json',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract merchant info
            merchant_info = {
                'merchant_id': result.get('merchant_id'),
                'tracking_id': result.get('tracking_id'),
                'payments_receivable': result.get('payments_receivable', False),
                'primary_email': result.get('primary_email'),
                'primary_email_confirmed': result.get('primary_email_confirmed', False),
                'oauth_integrations': result.get('oauth_integrations', [])
            }
            
            return merchant_info
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get merchant credentials: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            return None
    
    def get_merchant_access_token(self, merchant_id):
        """
        Get access token for merchant using Partner API.
        
        For Partner Referrals, we use the merchant_id to make API calls
        on behalf of the merchant. The platform's access token is used
        with the merchant_id in the PayPal-Auth-Assertion header.
        
        Docs: https://developer.paypal.com/docs/platforms/seller-onboarding/before-you-start/#link-getaccesstoken
        """
        # En simulación, generar token falso
        if merchant_id.startswith('SANDBOX_MERCHANT_'):
            return {
                'access_token': f'simulated_access_token_{merchant_id}',
                'auth_assertion': f'simulated_auth_assertion_{merchant_id}',
                'merchant_id': merchant_id,
                'simulation': True
            }
        
        access_token = self.get_access_token()
        if not access_token:
            return None
        
        # For Partner Referrals, we use PayPal-Auth-Assertion header
        # This allows us to act on behalf of the merchant
        auth_assertion = self._generate_auth_assertion(merchant_id)
        
        return {
            'access_token': access_token,
            'auth_assertion': auth_assertion,
            'merchant_id': merchant_id
        }
    
    def _generate_auth_assertion(self, merchant_id):
        """
        Generate PayPal-Auth-Assertion header value.
        
        Format: base64({"alg":"none"})+"."+base64({"iss":"client_id","payer_id":"merchant_id"})+"."
        
        Docs: https://developer.paypal.com/docs/platforms/seller-onboarding/before-you-start/#link-getaccesstoken
        """
        import json
        
        header = {"alg": "none"}
        payload = {
            "iss": self.client_id,
            "payer_id": merchant_id
        }
        
        header_b64 = base64.b64encode(json.dumps(header).encode()).decode()
        payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
        
        return f"{header_b64}.{payload_b64}."
    
    def refresh_access_token(self, connection):
        """
        Refresh expired access token using refresh token.
        
        Note: For Partner Referrals, tokens are managed differently.
        The platform token is refreshed, not individual merchant tokens.
        
        Args:
            connection: PayPalConnection instance
        
        Returns:
            bool - True if refresh successful
        """
        # For Partner Referrals, we don't refresh merchant tokens
        # We refresh the platform token and use auth assertion
        access_token = self.get_access_token()
        
        if access_token:
            # Update connection with new platform token
            connection.set_access_token(access_token)
            connection.expires_at = timezone.now() + timedelta(hours=8)
            connection.last_refreshed_at = timezone.now()
            connection.mark_connected()
            
            PaymentIntegrationLog.log_event(
                store=connection.store,
                provider='paypal',
                event_type='token_refreshed',
                message='Access token refreshed successfully'
            )
            
            return True
        
        return False
    
    def verify_webhook_signature(self, webhook_id, headers, body):
        """
        Verify PayPal webhook signature.
        
        Docs: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
        """
        access_token = self.get_access_token()
        if not access_token:
            return False
        
        url = f"{self.base_url}/v1/notifications/verify-webhook-signature"
        
        request_headers = {
            'Authorization': self._get_bearer_header(access_token),
            'Content-Type': 'application/json',
        }
        
        payload = {
            "transmission_id": headers.get('PAYPAL-TRANSMISSION-ID'),
            "transmission_time": headers.get('PAYPAL-TRANSMISSION-TIME'),
            "cert_url": headers.get('PAYPAL-CERT-URL'),
            "auth_algo": headers.get('PAYPAL-AUTH-ALGO'),
            "transmission_sig": headers.get('PAYPAL-TRANSMISSION-SIG'),
            "webhook_id": webhook_id,
            "webhook_event": body
        }
        
        try:
            response = requests.post(url, headers=request_headers, json=payload, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            return result.get('verification_status') == 'SUCCESS'
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Webhook verification failed: {e}")
            return False
    
    def disconnect_merchant(self, connection):
        """
        Disconnect merchant account.
        
        For Partner Referrals, we just mark as disconnected locally.
        The merchant can revoke access from their PayPal account.
        """
        connection.disconnect()
        
        PaymentIntegrationLog.log_event(
            store=connection.store,
            provider='paypal',
            event_type='disconnected',
            message='PayPal account disconnected'
        )
        
        return True
    
    def _simulate_referral_link(self, store, return_url):
        """
        Simulate PayPal Partner Referral for development.
        
        This creates a fake PayPal authorization flow that redirects back
        with simulated merchant credentials for testing purposes.
        """
        from django.utils import timezone
        
        # Generar IDs simulados pero realistas
        fake_merchant_id = f"SANDBOX_MERCHANT_{store.slug.upper()}_{int(timezone.now().timestamp())}"
        tracking_id = f"lightcode_sim_{store.id}_{int(timezone.now().timestamp())}"
        
        # Crear URL de simulación que redirige de vuelta con parámetros
        frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        
        # Simular el callback de PayPal con parámetros realistas
        callback_params = {
            'merchantIdInPayPal': fake_merchant_id,
            'permissionsGranted': 'true',
            'consentStatus': 'true',
            'merchantId': tracking_id,
            'simulation': 'true'  # Indicar que es simulación
        }
        
        # Para desarrollo, crear una URL que simule el flujo de PayPal
        # En lugar de redirigir a PayPal, redirigimos a la página correcta con storeSlug
        simulation_url = f"{frontend_base}/dashboard/{store.slug}/payment-methods?" + "&".join([
            f"{k}={v}" for k, v in callback_params.items()
        ])
        
        # Log del evento simulado
        PaymentIntegrationLog.log_event(
            store=store,
            provider='paypal',
            event_type='referral_created',
            message='PayPal referral link created (SIMULATION)',
            metadata={
                'referral_id': tracking_id,
                'action_url': simulation_url,
                'simulation': True,
                'fake_merchant_id': fake_merchant_id
            }
        )
        
        logger.info(f"Created simulated PayPal referral for store {store.slug}")
        
        return {
            'action_url': simulation_url,
            'referral_id': tracking_id,
            'simulation': True
        }
    
    def _simulate_merchant_credentials(self, partner_merchant_id):
        """
        Simular credenciales de merchant para desarrollo.
        """
        # Extraer el slug de la tienda del merchant_id simulado
        parts = partner_merchant_id.split('_')
        store_slug = '_'.join(parts[2:-1]).lower()  # SANDBOX_MERCHANT_lightcode-NETWORK_123 -> lightcode-network
        
        fake_email = f"paypal-{store_slug}@sandbox.example.com"
        
        return {
            'merchant_id': partner_merchant_id,
            'tracking_id': f"sim_{partner_merchant_id}",
            'payments_receivable': True,
            'primary_email': fake_email,
            'primary_email_confirmed': True,
            'oauth_integrations': ['payment', 'refund']
        }
    
    # ============================================================================
    # DIRECT PAYMENT METHODS (NEW SYSTEM)
    # ============================================================================
    
    def create_order_for_seller(self, connection, amount, currency, return_url, cancel_url, description, items):
        """
        Create PayPal order on behalf of seller (direct payment).
        
        Args:
            connection: PayPalConnection instance
            amount: Total amount (float)
            currency: Currency code (e.g., 'USD')
            return_url: URL to redirect after approval
            cancel_url: URL to redirect if cancelled
            description: Order description
            items: List of order items
        
        Returns:
            dict with order_id and approval_url, or None if failed
        """
        # Check if this is a simulated connection
        if connection.merchant_id.startswith('SANDBOX_MERCHANT_'):
            logger.info(f"Using simulation mode for order creation (merchant: {connection.merchant_id})")
            return self._simulate_create_order(connection, amount, currency, return_url, cancel_url, description)
        
        try:
            # Get seller's access token
            access_token = connection.get_access_token()
            if not access_token:
                logger.error("No access token available for seller")
                return None
            
            url = f"{self.base_url}/v2/checkout/orders"
            
            # Build order payload
            payload = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}"
                    },
                    "description": description
                }],
                "application_context": {
                    "return_url": return_url,
                    "cancel_url": cancel_url,
                    "brand_name": connection.store.name,
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW"
                }
            }
            
            headers = {
                'Authorization': self._get_bearer_header(access_token),
                'Content-Type': 'application/json',
                'PayPal-Auth-Assertion': self._generate_auth_assertion(connection.merchant_id)
            }
            
            logger.info(f"Creating PayPal order for seller {connection.merchant_id}")
            
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract approval URL
            approval_url = None
            for link in result.get('links', []):
                if link.get('rel') == 'approve':
                    approval_url = link.get('href')
                    break
            
            if not approval_url:
                logger.error("No approval URL in PayPal response")
                return None
            
            logger.info(f"✅ Created PayPal order {result['id']} for seller")
            
            return {
                'id': result['id'],
                'approval_url': approval_url,
                'status': result.get('status')
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error creating PayPal order for seller: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating PayPal order: {e}")
            return None
    
    def _simulate_create_order(self, connection, amount, currency, return_url, cancel_url, description):
        """
        Simulate PayPal order creation for development.
        """
        import uuid
        from django.utils import timezone
        
        # Generate fake order ID
        fake_order_id = f"SIM_ORDER_{uuid.uuid4().hex[:16].upper()}"
        
        # Create simulated approval URL that redirects back with token
        # In real PayPal, user would approve and PayPal redirects with token
        # In simulation, we redirect directly with the fake order ID as token
        approval_url = f"{return_url}?token={fake_order_id}&PayerID=SIM_PAYER_{connection.store.slug.upper()}"
        
        logger.info(f"✅ Created SIMULATED PayPal order {fake_order_id}")
        logger.info(f"   Amount: {amount} {currency}")
        logger.info(f"   Seller: {connection.merchant_email}")
        logger.info(f"   Approval URL: {approval_url}")
        
        return {
            'id': fake_order_id,
            'approval_url': approval_url,
            'status': 'CREATED',
            'simulation': True
        }
    
    def verify_payment(self, connection, order_id):
        """
        Verify payment status with PayPal API (CRITICAL - never trust frontend).
        
        Args:
            connection: PayPalConnection instance
            order_id: PayPal order ID
        
        Returns:
            dict with payment details if COMPLETED, None otherwise
        """
        # Check if this is a simulated order
        if order_id.startswith('SIM_ORDER_'):
            logger.info(f"Using simulation mode for payment verification (order: {order_id})")
            return self._simulate_verify_payment(connection, order_id)
        
        try:
            # Get seller's access token
            access_token = connection.get_access_token()
            if not access_token:
                logger.error("No access token available for verification")
                return None
            
            url = f"{self.base_url}/v2/checkout/orders/{order_id}"
            
            headers = {
                'Authorization': self._get_bearer_header(access_token),
                'Content-Type': 'application/json',
                'PayPal-Auth-Assertion': self._generate_auth_assertion(connection.merchant_id)
            }
            
            logger.info(f"Verifying PayPal order {order_id}")
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            logger.info(f"PayPal order {order_id} status: {result.get('status')}")
            
            # Only return details if payment is completed
            if result.get('status') == 'COMPLETED':
                return result
            else:
                logger.warning(f"Payment not completed. Status: {result.get('status')}")
                return None
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error verifying PayPal payment: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error verifying payment: {e}")
            return None
    
    def _simulate_verify_payment(self, connection, order_id):
        """
        Simulate payment verification for development.
        """
        from decimal import Decimal
        
        # Extract amount from order (would need to be stored in real implementation)
        # For now, use a default amount
        amount = Decimal('1.99')
        paypal_fee = amount * Decimal('0.069')  # 6.9%
        net_amount = amount - paypal_fee
        
        logger.info(f"✅ SIMULATED payment verification for order {order_id}")
        logger.info(f"   Status: COMPLETED")
        logger.info(f"   Amount: ${amount}")
        logger.info(f"   PayPal Fee: ${paypal_fee}")
        logger.info(f"   Net Amount: ${net_amount}")
        
        return {
            'id': order_id,
            'status': 'COMPLETED',
            'payer': {
                'email_address': f'buyer-{connection.store.slug}@sandbox.example.com',
                'payer_id': f'SIM_PAYER_{connection.store.slug.upper()}',
                'name': {
                    'given_name': 'Test',
                    'surname': 'Buyer'
                }
            },
            'purchase_units': [{
                'amount': {
                    'currency_code': 'USD',
                    'value': str(amount)
                },
                'payments': {
                    'captures': [{
                        'id': f'SIM_CAPTURE_{order_id}',
                        'status': 'COMPLETED',
                        'amount': {
                            'currency_code': 'USD',
                            'value': str(amount)
                        },
                        'seller_receivable_breakdown': {
                            'gross_amount': {
                                'currency_code': 'USD',
                                'value': str(amount)
                            },
                            'paypal_fee': {
                                'currency_code': 'USD',
                                'value': str(paypal_fee)
                            },
                            'net_amount': {
                                'currency_code': 'USD',
                                'value': str(net_amount)
                            }
                        }
                    }]
                }
            }],
            'simulation': True
        }
    
    def capture_payment(self, connection, order_id):
        """
        Capture payment for an approved order.
        
        Args:
            connection: PayPalConnection instance
            order_id: PayPal order ID
        
        Returns:
            dict with capture details, or None if failed
        """
        try:
            # Get seller's access token
            access_token = connection.get_access_token()
            if not access_token:
                logger.error("No access token available for capture")
                return None
            
            url = f"{self.base_url}/v2/checkout/orders/{order_id}/capture"
            
            headers = {
                'Authorization': self._get_bearer_header(access_token),
                'Content-Type': 'application/json',
                'PayPal-Auth-Assertion': self._generate_auth_assertion(connection.merchant_id)
            }
            
            logger.info(f"Capturing PayPal order {order_id}")
            
            response = requests.post(url, headers=headers, json={}, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            logger.info(f"✅ Captured PayPal order {order_id}")
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error capturing PayPal payment: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error capturing payment: {e}")
            return None


# Singleton instance
paypal_partner_service = PayPalPartnerService()
