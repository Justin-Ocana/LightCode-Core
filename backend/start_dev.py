#!/usr/bin/env python
"""
Script para iniciar el servidor de desarrollo local
"""
import os
import sys
import subprocess
from pathlib import Path

def main():
    # Cambiar al directorio del backend
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print("🚀 Iniciando servidor de desarrollo LightCode Core")
    print("=" * 50)
    
    # Verificar que estamos usando la configuración correcta
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.development')
    
    print(f"📁 Directorio: {backend_dir}")
    print(f"⚙️  Configuración: {os.environ.get('DJANGO_SETTINGS_MODULE')}")
    
    # Ejecutar migraciones si es necesario
    print("\n📦 Verificando migraciones...")
    try:
        result = subprocess.run([sys.executable, 'manage.py', 'migrate'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Migraciones aplicadas correctamente")
        else:
            print("⚠️  Error en migraciones:")
            print(result.stderr)
    except Exception as e:
        print(f"⚠️  Error ejecutando migraciones: {e}")
    
    # Iniciar el servidor
    print("\n🌐 Iniciando servidor Django...")
    print("📍 URL: http://localhost:8000")
    print("🛑 Para detener: Ctrl+C")
    print("=" * 50)
    
    try:
        subprocess.run([sys.executable, 'manage.py', 'runserver', '0.0.0.0:8000'])
    except KeyboardInterrupt:
        print("\n👋 Servidor detenido")

if __name__ == '__main__':
    main()