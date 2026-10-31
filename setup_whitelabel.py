#!/usr/bin/env python3
"""
Script de configuración para White-Label
Configura el nombre de la tienda y crea el usuario admin

Uso:
    python setup_whitelabel.py
"""

import os
import sys
import secrets
import string
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

def generate_password(length=16):
    """Genera una contraseña segura aleatoria"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password

def generate_email():
    """Genera un email único para el admin"""
    random_suffix = secrets.token_hex(4)
    return f"admin-{random_suffix}@internal.local"

def get_store_name():
    """Solicita el nombre de la tienda al usuario"""
    print_info("Ingresa el nombre de tu servidor/tienda:")
    print(f"  {Colors.WARNING}Ejemplos: SkyBlock Legends, MiServidor MC, Survival Pro{Colors.ENDC}")
    
    while True:
        store_name = input(f"\n{Colors.BOLD}Nombre de la tienda:{Colors.ENDC} ").strip()
        
        if not store_name:
            print_error("El nombre no puede estar vacío")
            continue
        
        if len(store_name) < 3:
            print_error("El nombre debe tener al menos 3 caracteres")
            continue
        
        if len(store_name) > 50:
            print_error("El nombre no puede tener más de 50 caracteres")
            continue
        
        # Confirmar
        print(f"\n{Colors.OKCYAN}Nombre de la tienda: {Colors.BOLD}{store_name}{Colors.ENDC}")
        confirm = input("¿Es correcto? (s/N): ").strip().lower()
        
        if confirm == 's':
            return store_name

def setup_django():
    """Configura Django para poder usar los modelos"""
    backend_dir = Path(__file__).parent / 'backend'
    sys.path.insert(0, str(backend_dir.absolute()))
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.base')
    
    try:
        import django
        django.setup()
        return True
    except Exception as e:
        print_error(f"Error al configurar Django: {e}")
        return False

def create_store_and_admin(store_name):
    """Crea la tienda y el usuario admin"""
    from django.contrib.auth import get_user_model
    from apps.stores.models import Store
    from apps.users.models import Seller
    from django.utils.text import slugify
    
    User = get_user_model()
    
    # Generar credenciales de admin
    email = generate_email()
    password = generate_password()
    
    print_info("Generando credenciales de administrador...")
    
    # Crear usuario admin
    username = email.split('@')[0]
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        user_type='seller',
        is_staff=True,
        is_superuser=True
    )
    print_success(f"Usuario admin creado: {email}")
    
    # Crear perfil de seller
    seller = Seller.objects.create(
        user=user,
        total_stores=1
    )
    print_success("Perfil de vendedor creado")
    
    # Verificar si ya existe alguna tienda
    existing_stores = Store.objects.filter(is_deleted=False)
    
    if existing_stores.exists():
        print_warning(f"Ya existe(n) {existing_stores.count()} tienda(s) en el sistema")
        print_info("Actualizando la primera tienda...")
        
        store = existing_stores.first()
        store.owner = user
        store.name = store_name
        store.status = 'active'
        store.is_verified = True
        store.save()
        
        print_success(f"Tienda actualizada: {store.name} (@{store.slug})")
    else:
        # Crear nueva tienda
        print_info("Creando tienda...")
        
        # El slug se genera automáticamente en el modelo Store
        store = Store.objects.create(
            owner=user,
            name=store_name,
            description=f"Tienda oficial de {store_name}",
            status='active',
            is_verified=True,
            currency='USD',
            language='es'
        )
        
        print_success(f"Tienda creada: {store.name} (@{store.slug})")
    
    # Guardar credenciales
    credentials_file = Path('.admin_credentials')
    with open(credentials_file, 'w') as f:
        f.write(f"# Credenciales de Administrador\n")
        f.write(f"# Generadas automáticamente - NO COMPARTIR\n\n")
        f.write(f"ADMIN_EMAIL={email}\n")
        f.write(f"ADMIN_PASSWORD={password}\n")
        f.write(f"\n# Información de la tienda\n")
        f.write(f"STORE_NAME={store.name}\n")
        f.write(f"STORE_SLUG={store.slug}\n")
        f.write(f"STORE_ID={store.id}\n")
    
    os.chmod(credentials_file, 0o600)
    print_success(f"Credenciales guardadas en: {credentials_file}")
    
    return {
        'email': email,
        'password': password,
        'store': store
    }

def main():
    print_header("🚀 CONFIGURACIÓN WHITE-LABEL")
    
    print(f"{Colors.OKCYAN}Este script configurará tu tienda y creará el usuario administrador.{Colors.ENDC}\n")
    
    # Solicitar nombre de la tienda
    store_name = get_store_name()
    
    # Setup Django
    print_info("\nConectando a la base de datos...")
    if not setup_django():
        print_error("No se pudo conectar a Django")
        print_info("Asegúrate de que backend/.env esté configurado correctamente")
        return
    
    print_success("Conexión establecida")
    
    # Crear tienda y admin
    try:
        result = create_store_and_admin(store_name)
        
        print_header("✅ CONFIGURACIÓN COMPLETADA")
        
        print(f"\n{Colors.OKGREEN}🏪 Tienda configurada:{Colors.ENDC}")
        print(f"   Nombre: {Colors.BOLD}{result['store'].name}{Colors.ENDC}")
        print(f"   Slug:   {Colors.BOLD}{result['store'].slug}{Colors.ENDC}")
        print(f"   URL:    {Colors.BOLD}http://localhost:5173/{Colors.ENDC}")
        
        print(f"\n{Colors.OKGREEN}👤 Credenciales de administrador:{Colors.ENDC}")
        print(f"   Email:    {Colors.BOLD}{result['email']}{Colors.ENDC}")
        print(f"   Password: {Colors.BOLD}{result['password']}{Colors.ENDC}")
        
        print(f"\n{Colors.OKGREEN}🔗 Accesos:{Colors.ENDC}")
        print(f"   Tienda pública: {Colors.BOLD}http://localhost:5173/{Colors.ENDC}")
        print(f"   Panel admin:    {Colors.BOLD}http://localhost:5173/admin/login{Colors.ENDC}")
        
        print(f"\n{Colors.WARNING}⚠️  IMPORTANTE:{Colors.ENDC}")
        print(f"   - Las credenciales están guardadas en: .admin_credentials")
        print(f"   - NO compartas este archivo con nadie")
        print(f"   - Puedes cambiar la contraseña desde el dashboard")
        
        print(f"\n{Colors.OKCYAN}📝 Próximos pasos:{Colors.ENDC}")
        print(f"   1. Inicia el backend: cd backend && python manage.py runserver")
        print(f"   2. Inicia el frontend: npm run dev")
        print(f"   3. Accede al panel admin con las credenciales generadas")
        print(f"   4. Personaliza tu tienda desde el dashboard\n")
        
    except Exception as e:
        print_error(f"Error durante la configuración: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n")
        print_warning("Configuración cancelada por el usuario")
        sys.exit(0)
    except Exception as e:
        print_error(f"Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
