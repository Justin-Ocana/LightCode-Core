#!/usr/bin/env python3
"""
lightcode White-Label Setup Script
================================
Configura automáticamente una instancia de lightcode para un cliente específico.

Uso:
    python setup_client.py

El script lee client-config.json y:
1. Crea el archivo .env con las configuraciones
2. Crea el usuario admin
3. Crea la tienda única del cliente
4. Aplica el branding (colores, logo, etc.)
5. Configura RCON y PayPal
"""

import json
import os
import sys
import secrets
import django
from pathlib import Path

# Colores para terminal
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(text):
    print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")

def print_error(text):
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")

def print_warning(text):
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")

def print_info(text):
    print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")

def load_config():
    """Carga la configuración del cliente desde client-config.json"""
    config_path = Path('client-config.json')
    
    if not config_path.exists():
        print_error("No se encontró client-config.json")
        print_info("Crea el archivo client-config.json con la configuración del cliente")
        sys.exit(1)
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print_success("Configuración cargada correctamente")
        return config
    except json.JSONDecodeError as e:
        print_error(f"Error al parsear client-config.json: {e}")
        sys.exit(1)

def create_env_file(config):
    """Crea el archivo .env con las configuraciones necesarias"""
    print_info("Creando archivo .env...")
    
    env_content = f"""# lightcode White-Label - {config['serverName']}
# Generado automáticamente por setup_client.py

# Django
DEBUG=True
SECRET_KEY={secrets.token_urlsafe(50)}
ALLOWED_HOSTS=localhost,127.0.0.1,.vercel.app

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Cloudinary (para imágenes)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# Celery / Redis (opcional para tareas asíncronas)
REDIS_URL=redis://localhost:6379/0

# Cliente Config
CLIENT_NAME={config['serverName']}
CLIENT_SLUG={config['serverName'].lower().replace(' ', '-')}
"""
    
    env_path = Path('backend/.env')
    
    if env_path.exists():
        print_warning(".env ya existe. ¿Sobrescribir? (y/N): ")
        response = input().strip().lower()
        if response != 'y':
            print_info("Manteniendo .env existente")
            return
    
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print_success("Archivo .env creado")
    print_warning("⚠ IMPORTANTE: Edita backend/.env y configura:")
    print("  - DATABASE_URL (Neon PostgreSQL)")
    print("  - CLOUDINARY_* (para subir imágenes)")
    print("  - PAYPAL_* (para pagos)")

def setup_django():
    """Configura Django para poder usar los modelos"""
    sys.path.insert(0, str(Path('backend').absolute()))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    django.setup()

def create_admin_user(config):
    """Crea el usuario administrador"""
    from django.contrib.auth import get_user_model
    
    print_info("Creando usuario administrador...")
    
    User = get_user_model()
    admin_config = config['admin']
    
    # Verificar si ya existe
    if User.objects.filter(email=admin_config['email']).exists():
        print_warning(f"Usuario {admin_config['email']} ya existe")
        return User.objects.get(email=admin_config['email'])
    
    # Crear usuario
    user = User.objects.create_user(
        username=admin_config['username'],
        email=admin_config['email'],
        password=admin_config['password'],
        user_type='seller',  # Tipo seller para poder crear tienda
        is_email_verified=True,
        is_staff=True,
        is_superuser=True
    )
    
    print_success(f"Usuario admin creado: {admin_config['email']}")
    print_info(f"  Username: {admin_config['username']}")
    print_info(f"  Password: {admin_config['password']}")
    print_warning("  ⚠ Cambia la contraseña después del primer login")
    
    return user

def create_store(config, owner):
    """Crea la tienda única del cliente"""
    from apps.stores.models import Store
    
    print_info("Creando tienda...")
    
    slug = config['serverName'].lower().replace(' ', '-')[:50]
    
    # Verificar si ya existe
    if Store.objects.filter(slug=slug).exists():
        print_warning(f"Tienda '{slug}' ya existe")
        return Store.objects.get(slug=slug)
    
    # Crear tienda
    store = Store.objects.create(
        owner=owner,
        name=config['serverName'],
        slug=slug,
        description=config.get('description', ''),
        tagline=config.get('tagline', ''),
        primary_color=config['branding']['primaryColor'],
        secondary_color=config['branding']['secondaryColor'],
        currency=config['settings']['currency'],
        timezone=config['settings']['timezone'],
        language=config['settings']['language'],
        minecraft_server_ip=config['serverIP'],
        minecraft_server_port=config.get('serverPort', 25565),
        server_type=config['settings']['serverType'],
        email=config['admin']['email'],
        discord_invite=config['social'].get('discord', ''),
        twitter_handle=config['social'].get('twitter', ''),
        instagram_handle=config['social'].get('instagram', ''),
        website=config['social'].get('website', ''),
        status='active',
        is_verified=True,
        rcon_enabled=config['rcon']['enabled'],
        rcon_host=config['rcon'].get('host', ''),
        rcon_port=config['rcon'].get('port', 25575),
        paypal_email=config['paypal'].get('email', ''),
    )
    
    print_success(f"Tienda creada: {store.name} (@{store.slug})")
    print_info(f"  URL: /store/{store.slug}")
    
    return store

def configure_rcon(config, store):
    """Configura RCON si está habilitado"""
    if not config['rcon']['enabled']:
        print_info("RCON deshabilitado en la configuración")
        return
    
    print_info("Configurando RCON...")
    
    # Aquí se encriptaría la contraseña RCON
    # Por ahora solo mostramos un mensaje
    print_warning("⚠ Configura la contraseña RCON manualmente en el panel")
    print_info(f"  Host: {config['rcon']['host']}")
    print_info(f"  Port: {config['rcon']['port']}")

def create_frontend_config(config):
    """Crea el archivo de configuración del frontend"""
    print_info("Creando configuración del frontend...")
    
    template = config.get('template', 'classic')
    
    config_content = f"""// Configuración del cliente - Generado automáticamente
// NO editar manualmente, usa client-config.json y ejecuta setup_client.py

const CLIENT_CONFIG = {{
  // Información del servidor
  serverName: "{config['serverName']}",
  serverIP: "{config['serverIP']}",
  serverPort: {config.get('serverPort', 25565)},
  description: "{config.get('description', '')}",
  tagline: "{config.get('tagline', '')}",
  
  // Template (classic, modern, gaming, minimal)
  template: "{template}",
  
  // Branding
  branding: {{
    primaryColor: "{config['branding']['primaryColor']}",
    secondaryColor: "{config['branding']['secondaryColor']}",
    accentColor: "{config['branding'].get('accentColor', '#F59E0B')}",
    logo: "{config['branding'].get('logo', '')}",
    banner: "{config['branding'].get('banner', '')}",
    favicon: "{config['branding'].get('favicon', '')}",
  }},
  
  // Social
  social: {{
    discord: "{config['social'].get('discord', '')}",
    twitter: "{config['social'].get('twitter', '')}",
    instagram: "{config['social'].get('instagram', '')}",
    website: "{config['social'].get('website', '')}",
  }},
  
  // Settings
  currency: "{config['settings']['currency']}",
  language: "{config['settings']['language']}",
  
  // Store slug (para las rutas del frontend)
  storeSlug: "{config['serverName'].lower().replace(' ', '-')[:50]}",
}};

// API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default CLIENT_CONFIG;
"""
    
    config_path = Path('frontend/src/config/client.js')
    config_path.parent.mkdir(exist_ok=True)
    
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(config_content)
    
    print_success(f"Configuración del frontend creada (template: {template})")

def print_next_steps(config):
    """Muestra los siguientes pasos"""
    print_header("✅ SETUP COMPLETADO")
    
    print(f"{Colors.OKGREEN}La configuración básica está lista.{Colors.ENDC}\n")
    
    print(f"{Colors.BOLD}📋 SIGUIENTES PASOS:{Colors.ENDC}\n")
    
    print("1. Configura las variables de entorno:")
    print(f"   {Colors.OKCYAN}cd backend && nano .env{Colors.ENDC}")
    print("   - DATABASE_URL (Neon PostgreSQL)")
    print("   - CLOUDINARY_* (para imágenes)")
    print("   - PAYPAL_* (para pagos)\n")
    
    print("2. Ejecuta las migraciones:")
    print(f"   {Colors.OKCYAN}cd backend && python manage.py migrate{Colors.ENDC}\n")
    
    print("3. Inicia el backend:")
    print(f"   {Colors.OKCYAN}cd backend && python manage.py runserver{Colors.ENDC}\n")
    
    print("4. Inicia el frontend:")
    print(f"   {Colors.OKCYAN}cd frontend && npm install && npm run dev{Colors.ENDC}\n")
    
    print("5. Accede al panel de administración:")
    print(f"   {Colors.OKCYAN}http://localhost:5173/dashboard{Colors.ENDC}")
    print(f"   Email: {config['admin']['email']}")
    print(f"   Password: {config['admin']['password']}\n")
    
    print("6. Accede a la tienda pública:")
    slug = config['serverName'].lower().replace(' ', '-')[:50]
    print(f"   {Colors.OKCYAN}http://localhost:5173/store/{slug}{Colors.ENDC}\n")
    
    print(f"{Colors.WARNING}⚠ IMPORTANTE:{Colors.ENDC}")
    print("  - Cambia la contraseña del admin después del primer login")
    print("  - Sube el logo y banner en el panel de personalización")
    print("  - Configura RCON en el panel si lo necesitas")
    print("  - Crea tus productos y categorías\n")

def main():
    """Función principal"""
    print_header("🚀 lightcode WHITE-LABEL SETUP")
    
    # 1. Cargar configuración
    config = load_config()
    
    # 2. Crear .env
    create_env_file(config)
    
    # 3. Crear configuración del frontend
    create_frontend_config(config)
    
    print_info("\n¿Deseas crear el usuario admin y la tienda ahora?")
    print_warning("(Requiere que la base de datos esté configurada)")
    print("Presiona Enter para continuar o Ctrl+C para salir...")
    try:
        input()
    except KeyboardInterrupt:
        print("\n")
        print_info("Setup pausado. Ejecuta este script nuevamente después de configurar la BD")
        sys.exit(0)
    
    # 4. Setup Django
    try:
        setup_django()
    except Exception as e:
        print_error(f"Error al configurar Django: {e}")
        print_warning("Configura la base de datos en backend/.env y ejecuta este script nuevamente")
        sys.exit(1)
    
    # 5. Crear admin
    try:
        admin_user = create_admin_user(config)
    except Exception as e:
        print_error(f"Error al crear usuario admin: {e}")
        sys.exit(1)
    
    # 6. Crear tienda
    try:
        store = create_store(config, admin_user)
    except Exception as e:
        print_error(f"Error al crear tienda: {e}")
        sys.exit(1)
    
    # 7. Configurar RCON
    configure_rcon(config, store)
    
    # 8. Mostrar siguientes pasos
    print_next_steps(config)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n")
        print_warning("Setup cancelado por el usuario")
        sys.exit(0)
    except Exception as e:
        print_error(f"Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
