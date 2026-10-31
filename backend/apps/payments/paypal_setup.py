"""
Script para crear los planes de suscripción de PayPal automáticamente
Ejecutar: python apps/payments/paypal_setup.py
"""
import os
import sys
import requests
import json
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(env_path)

def get_paypal_access_token():
    """Obtener token de acceso de PayPal"""
    client_id = os.getenv('PAYPAL_CLIENT_ID')
    client_secret = os.getenv('PAYPAL_CLIENT_SECRET')
    mode = os.getenv('PAYPAL_MODE', 'sandbox')
    
    print(f"🔍 Mode: {mode}")
    print(f"🔍 Client ID: {client_id[:20]}..." if client_id else "❌ No Client ID")
    
    if not client_id or not client_secret:
        print("❌ Error: PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET deben estar configurados en .env")
        return None
    
    url = f"https://api-m.{'sandbox.' if mode == 'sandbox' else ''}paypal.com/v1/oauth2/token"
    
    response = requests.post(
        url,
        headers={'Accept': 'application/json', 'Accept-Language': 'en_US'},
        auth=(client_id, client_secret),
        data={'grant_type': 'client_credentials'}
    )
    
    if response.status_code == 200:
        return response.json()['access_token']
    else:
        print(f"❌ Error obteniendo token: {response.text}")
        return None

def create_product(access_token, mode='sandbox'):
    """Crear producto en PayPal"""
    url = f"https://api-m.{'sandbox.' if mode == 'sandbox' else ''}paypal.com/v1/catalogs/products"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}'
    }
    
    data = {
        "name": "PlugsEssentials Subscription",
        "description": "Suscripción mensual para PlugsEssentials - Plugin premium para Minecraft",
        "type": "SERVICE",
        "category": "SOFTWARE"
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 201:
        product_id = response.json()['id']
        print(f"✅ Producto creado: {product_id}")
        return product_id
    else:
        print(f"❌ Error creando producto: {response.text}")
        return None

def create_plan(access_token, product_id, tier_name, price, servers, mode='sandbox'):
    """Crear plan de suscripción en PayPal"""
    url = f"https://api-m.{'sandbox.' if mode == 'sandbox' else ''}paypal.com/v1/billing/plans"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}',
        'Prefer': 'return=representation'
    }
    
    data = {
        "product_id": product_id,
        "name": f"PlugsEssentials {tier_name}",
        "description": f"Plan {tier_name} - {servers} servidor{'es' if servers > 1 else ''} autorizado{'s' if servers > 1 else ''}",
        "status": "ACTIVE",
        "billing_cycles": [
            {
                "frequency": {
                    "interval_unit": "MONTH",
                    "interval_count": 1
                },
                "tenure_type": "REGULAR",
                "sequence": 1,
                "total_cycles": 0,
                "pricing_scheme": {
                    "fixed_price": {
                        "value": str(price),
                        "currency_code": "USD"
                    }
                }
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee": {
                "value": "0",
                "currency_code": "USD"
            },
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 201:
        plan_id = response.json()['id']
        print(f"✅ Plan {tier_name} creado: {plan_id}")
        return plan_id
    else:
        print(f"❌ Error creando plan {tier_name}: {response.text}")
        return None

def main():
    print("🚀 Iniciando creación de planes de PayPal...\n")
    
    mode = os.getenv('PAYPAL_MODE', 'sandbox')
    print(f"📍 Modo: {mode.upper()}\n")
    
    # Obtener token de acceso
    print("🔑 Obteniendo token de acceso...")
    access_token = get_paypal_access_token()
    if not access_token:
        return
    
    # Crear producto
    print("\n📦 Creando producto...")
    product_id = create_product(access_token, mode)
    if not product_id:
        return
    
    # Crear planes
    print("\n💳 Creando planes de suscripción...")
    
    plans = [
        ("Tier 1", 7, 1),
        ("Tier 2", 10, 3),
        ("Tier 3", 15, 5)
    ]
    
    plan_ids = {}
    for tier_name, price, servers in plans:
        plan_id = create_plan(access_token, product_id, tier_name, price, servers, mode)
        if plan_id:
            tier_key = tier_name.lower().replace(" ", "")
            plan_ids[tier_key] = plan_id
    
    # Mostrar resumen
    print("\n" + "="*60)
    print("✅ PLANES CREADOS EXITOSAMENTE")
    print("="*60)
    print("\nAgrega estos IDs a tu archivo backend/.env:\n")
    
    for tier_key, plan_id in plan_ids.items():
        env_var = f"PAYPAL_PLAN_{tier_key.upper()}"
        print(f"{env_var}={plan_id}")
    
    print("\nY también agrégalos a frontend/.env:\n")
    for tier_key, plan_id in plan_ids.items():
        env_var = f"VITE_PAYPAL_PLAN_{tier_key.upper()}"
        print(f"{env_var}={plan_id}")
    
    print("\n" + "="*60)
    print("🎉 ¡Configuración completada!")
    print("="*60)

if __name__ == "__main__":
    main()
