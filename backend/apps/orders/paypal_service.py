"""
PayPal Service - Maneja pagos estándar de PayPal.
Todo el dinero va a una sola cuenta (lightcode).
"""
import requests
import base64
from decimal import Decimal
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class PayPalService:
    """
    Servicio para integración con PayPal estándar.
    Usa Orders API v2 sin Partner Fees.
    """
    
    def __init__(self):
        self.client_id = settings.PAYPAL_CLIENT_ID
        self.client_secret = settings.PAYPAL_CLIENT_SECRET
        self.mode = settings.PAYPAL_MODE  # 'sandbox' o 'live'
        
        if self.mode == 'sandbox':
            self.base_url = 'https://api-m.sandbox.paypal.com'
        else:
            self.base_url = 'https://api-m.paypal.com'
        
        self.access_token = None
    
    def get_access_token(self):
        """Obtiene access token de PayPal."""
        if self.access_token:
            return self.access_token
        
        url = f"{self.base_url}/v1/oauth2/token"
        
        # Encode credentials
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {encoded_credentials}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = {'grant_type': 'client_credentials'}
        
        try:
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            self.access_token = response.json()['access_token']
            logger.info("✅ PayPal access token obtained")
            return self.access_token
            
        except Exception as e:
            logger.error(f"❌ Error getting PayPal token: {str(e)}")
            raise
    
    def create_order(self, amount, description="Compra en lightcode", order_reference=None, return_url=None, cancel_url=None, payee_email=None):
        """
        Crea una orden de PayPal con pago directo al vendedor.
        
        Args:
            amount: Monto total que paga el comprador (Decimal)
            description: Descripción del producto
            order_reference: Referencia de la orden en tu sistema (opcional)
            return_url: URL de retorno después de aprobar (opcional)
            cancel_url: URL de cancelación (opcional)
            payee_email: Email PayPal del vendedor (dinero va directo a él)
        
        Returns:
            dict con order_id y approval_url
        """
        token = self.get_access_token()
        url = f"{self.base_url}/v2/checkout/orders"
        
        amount_str = str(amount.quantize(Decimal('0.01')))
        
        # URLs por defecto si no se proporcionan
        if not return_url:
            frontend_url = settings.FRONTEND_URL.rstrip('/')
            return_url = f"{frontend_url}/checkout/success"
        if not cancel_url:
            frontend_url = settings.FRONTEND_URL.rstrip('/')
            cancel_url = f"{frontend_url}/checkout/cancel"
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        }
        
        # Estructura de la orden con payee (pago directo al vendedor)
        purchase_unit = {
            "description": description,
            "reference_id": order_reference or "default",
            "amount": {
                "currency_code": "USD",
                "value": amount_str
            }
        }
        
        # Si hay payee_email, el dinero va directo al vendedor
        if payee_email:
            purchase_unit["payee"] = {
                "email_address": payee_email
            }
            logger.info(f"💰 Payment will go directly to: {payee_email}")
        else:
            logger.warning(f"⚠️ No payee_email provided - payment will go to platform account")
        
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [purchase_unit],
            "application_context": {
                "brand_name": "lightcode",
                "landing_page": "NO_PREFERENCE",
                "user_action": "PAY_NOW",
                "return_url": return_url,
                "cancel_url": cancel_url
            }
        }
        
        logger.info(f"🔗 Creating PayPal order with return_url: {return_url}")
        logger.info(f"📦 PayPal Order Payload: {payload}")
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            order_data = response.json()
            order_id = order_data['id']
            
            # Obtener approval URL
            approval_url = next(
                (link['href'] for link in order_data['links'] if link['rel'] == 'approve'),
                None
            )
            
            logger.info(f"✅ PayPal order created: {order_id}")
            
            return {
                'order_id': order_id,
                'approval_url': approval_url,
                'status': order_data['status']
            }
            
        except requests.exceptions.HTTPError as e:
            # Log detailed error from PayPal
            error_detail = "No details available"
            try:
                error_detail = e.response.json()
                logger.error(f"❌ PayPal API error details: {error_detail}")
            except:
                logger.error(f"❌ PayPal API error (no JSON): {e.response.text}")
            logger.error(f"❌ Error creating PayPal order: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"❌ Error creating PayPal order: {str(e)}")
            raise
    
    def capture_order(self, order_id):
        """
        Captura el pago de una orden aprobada.
        
        Args:
            order_id: ID de la orden de PayPal
        
        Returns:
            dict con detalles del pago capturado incluyendo fees
        """
        token = self.get_access_token()
        url = f"{self.base_url}/v2/checkout/orders/{order_id}/capture"
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        try:
            response = requests.post(url, headers=headers)
            response.raise_for_status()
            
            capture_data = response.json()
            
            # Extraer datos importantes
            purchase_unit = capture_data['purchase_units'][0]
            capture = purchase_unit['payments']['captures'][0]
            payer = capture_data['payer']
            
            # Extraer fee de PayPal si está disponible
            paypal_fee = Decimal('0.00')
            net_amount = Decimal(capture['amount']['value'])
            
            if 'seller_receivable_breakdown' in capture:
                breakdown = capture['seller_receivable_breakdown']
                
                # Monto bruto (lo que pagó el cliente)
                gross_amount = Decimal(breakdown.get('gross_amount', {}).get('value', capture['amount']['value']))
                
                # Fee de PayPal
                if 'paypal_fee' in breakdown:
                    paypal_fee = Decimal(breakdown['paypal_fee']['value'])
                
                # Monto neto (lo que recibe el vendedor)
                if 'net_amount' in breakdown:
                    net_amount = Decimal(breakdown['net_amount']['value'])
                
                logger.info(f"💰 PayPal breakdown - Gross: ${gross_amount}, Fee: ${paypal_fee}, Net: ${net_amount}")
            else:
                gross_amount = Decimal(capture['amount']['value'])
                logger.warning(f"⚠️ No seller_receivable_breakdown in PayPal response")
            
            result = {
                'order_id': order_id,
                'transaction_id': capture['id'],
                'status': capture['status'],
                'gross_amount': gross_amount,  # Lo que pagó el cliente
                'paypal_fee': paypal_fee,      # Comisión de PayPal
                'net_amount': net_amount,      # Lo que recibe el vendedor
                'amount': gross_amount,        # Alias para compatibilidad
                'currency': capture['amount']['currency_code'],
                'payer_id': payer.get('payer_id', ''),
                'payer_email': payer.get('email_address', ''),
                'payer_name': f"{payer.get('name', {}).get('given_name', '')} {payer.get('name', {}).get('surname', '')}".strip(),
                'create_time': capture['create_time'],
                'update_time': capture['update_time']
            }
            
            logger.info(f"✅ PayPal order captured: {order_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error capturing PayPal order: {str(e)}")
            raise
    
    def get_order_details(self, order_id):
        """
        Obtiene detalles de una orden.
        
        Args:
            order_id: ID de la orden de PayPal
        
        Returns:
            dict con detalles de la orden
        """
        token = self.get_access_token()
        url = f"{self.base_url}/v2/checkout/orders/{order_id}"
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"❌ Error getting PayPal order details: {str(e)}")
            raise
    
    def verify_webhook_signature(self, headers, body):
        """
        Verifica la firma de un webhook de PayPal.
        
        Args:
            headers: Headers del request
            body: Body del request (raw)
        
        Returns:
            bool - True si la firma es válida
        """
        token = self.get_access_token()
        url = f"{self.base_url}/v1/notifications/verify-webhook-signature"
        
        webhook_id = settings.PAYPAL_WEBHOOK_ID
        
        payload = {
            "transmission_id": headers.get('PAYPAL-TRANSMISSION-ID'),
            "transmission_time": headers.get('PAYPAL-TRANSMISSION-TIME'),
            "cert_url": headers.get('PAYPAL-CERT-URL'),
            "auth_algo": headers.get('PAYPAL-AUTH-ALGO'),
            "transmission_sig": headers.get('PAYPAL-TRANSMISSION-SIG'),
            "webhook_id": webhook_id,
            "webhook_event": body
        }
        
        request_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        try:
            response = requests.post(url, json=payload, headers=request_headers)
            response.raise_for_status()
            
            result = response.json()
            is_valid = result.get('verification_status') == 'SUCCESS'
            
            if is_valid:
                logger.info("✅ PayPal webhook signature verified")
            else:
                logger.warning("⚠️ PayPal webhook signature verification failed")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"❌ Error verifying webhook signature: {str(e)}")
            return False


# Singleton instance
paypal_service = PayPalService()
