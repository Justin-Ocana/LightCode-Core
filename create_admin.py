#!/usr/bin/env python3
"""
Script para crear usuario administrador para el dashboard interno.

Uso:
    python create_admin.py

Genera un email y contraseña aleatorios y los guarda en .admin_credentials
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

def save_credentials(email, password):
    """Guarda las credenciales en un archivo"""
    credentials_file = Path('.admin_credentials')
    
    with open(credentials_file, 'w') as f:
        f.write(f"# Credenciales del Dashboard Interno\n")
        f.write(f"# Generado automáticamente - NO COMPARTIR\n\n")
        f.write(f"ADMIN_EMAIL={email}\n")
        f.write(f"ADMIN_PASSWORD={password}\n")
    
    # Hacer el archivo solo lectura para el propietario
    os.chmod(credentials_file, 0o600)
    
    return credentials_file

def setup_django():
    """Configura Django para poder usar los modelos"""
    import sys
    from pathlib import Path
    
    # Agregar el directorio backend al path
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

def create_admin_user(email, password):
    """Crea el usuario administrador en la base de datos"""
    from django.contrib.auth import get_user_model
    from apps.stores.models import Store
    from apps.users.models import Seller
    
    User = get_user_model()
    
    # Verificar si ya existe un admin
    existing_admin = User.objects.filter(user_type='seller', is_superuser=True).first()
    
    if existing_admin:
        print_warning(f"Ya existe un usuario admin: {existing_admin.email}")
        response = input("¿Deseas crear uno nuevo de todas formas? (y/N): ").strip().lower()
        if response != 'y':
            print_info("Operación cancelada")
            return None
    
    # Crear usuario
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
    seller = Seller.objects.create(user=user)
    print_success(f"Perfil de seller creado")
    
    # Crear tienda por defecto si no existe ninguna
    store_count = Store.objects.filter(is_deleted=False).count()
    
    # Slug fijo para white-label (simplifica la lógica del frontend)
    FIXED_SLUG = "store"
    
    if store_count == 0:
        print_info("Creando tienda por defecto con slug fijo 'store'...")
        store = Store.objects.create(
            owner=user,
            name="Mi Servidor",
            slug=FIXED_SLUG,
            description="Tienda del servidor",
            status='active',
            is_verified=True,
            currency='USD',
            language='es'
        )
        print_success(f"Tienda creada: {store.name} (@{store.slug})")
        print_info(f"URL pública: http://localhost:5173/")
    else:
        # Verificar si existe tienda con el slug fijo
        existing_store = Store.objects.filter(slug=FIXED_SLUG, is_deleted=False).first()
        if not existing_store:
            print_warning(f"Existe(n) {store_count} tienda(s) pero ninguna con slug '{FIXED_SLUG}'")
            print_info(f"Actualizando la primera tienda para usar slug '{FIXED_SLUG}'...")
            first_store = Store.objects.filter(is_deleted=False).first()
            first_store.slug = FIXED_SLUG
            first_store.owner = user
            first_store.status = 'active'
            first_store.is_verified = True
            first_store.save()
            print_success(f"Tienda actualizada: {first_store.name} (@{first_store.slug})")
        else:
            print_info(f"Tienda existente: {existing_store.name} (@{existing_store.slug})")
            # Actualizar propietario si es necesario
            if existing_store.owner != user:
                existing_store.owner = user
                existing_store.save()
                print_success(f"Propietario actualizado a {user.email}")
    
    return user

def main():
    print_header("🔐 CREAR ADMIN - DASHBOARD INTERNO")
    
    # Generar credenciales
    print_info("Generando credenciales seguras...")
    email = generate_email()
    password = generate_password()
    
    print_success("Credenciales generadas:")
    print(f"  Email:    {Colors.BOLD}{email}{Colors.ENDC}")
    print(f"  Password: {Colors.BOLD}{password}{Colors.ENDC}")
    
    # Guardar en archivo
    credentials_file = save_credentials(email, password)
    print_success(f"Credenciales guardadas en: {credentials_file}")
    
    # Preguntar si desea crear en la BD
    print("\n" + "="*60)
    print_warning("¿Deseas crear este usuario en la base de datos ahora?")
    print_info("(Requiere que la base de datos esté configurada)")
    response = input("Continuar? (y/N): ").strip().lower()
    
    if response != 'y':
        print_info("\nCredenciales guardadas. Puedes crear el usuario más tarde con:")
        print(f"  {Colors.OKCYAN}python manage.py createsuperuser{Colors.ENDC}")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        return
    
    # Setup Django
    if not setup_django():
        print_error("No se pudo conectar a Django")
        print_info("Asegúrate de que backend/.env esté configurado correctamente")
        return
    
    # Crear usuario
    try:
        user = create_admin_user(email, password)
        if user:
            print_header("✅ ADMIN CREADO EXITOSAMENTE")
            print(f"\n{Colors.OKGREEN}Puedes acceder al dashboard en:{Colors.ENDC}")
            print(f"  {Colors.BOLD}http://localhost:5173/dashboard{Colors.ENDC}")
            print(f"\n{Colors.OKGREEN}Credenciales:{Colors.ENDC}")
            print(f"  Email:    {Colors.BOLD}{email}{Colors.ENDC}")
            print(f"  Password: {Colors.BOLD}{password}{Colors.ENDC}")
            print(f"\n{Colors.WARNING}⚠ IMPORTANTE:{Colors.ENDC}")
            print(f"  - Guarda estas credenciales en un lugar seguro")
            print(f"  - Las credenciales también están en: {credentials_file}")
            print(f"  - NO compartas este archivo con nadie")
            print(f"  - Puedes cambiar la contraseña desde el dashboard\n")
    except Exception as e:
        print_error(f"Error al crear usuario: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n")
        print_warning("Operación cancelada por el usuario")
        sys.exit(0)
    except Exception as e:
        print_error(f"Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
