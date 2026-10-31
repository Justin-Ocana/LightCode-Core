#!/usr/bin/env python
"""
Script para verificar que el despliegue esté listo
"""
import os
import sys
import json

def verify_deployment():
    """Verificar que todo esté listo para el despliegue"""
    print("🔍 VERIFICANDO DESPLIEGUE...")
    print("=" * 50)
    
    issues = []
    
    # 1. Verificar archivo de datos
    print("1. Verificando archivo de datos...")
    data_file = 'LightCodeCore/production_data.json'
    if os.path.exists(data_file):
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"   ✅ production_data.json válido ({len(data)} objetos)")
        except Exception as e:
            print(f"   ❌ Error en production_data.json: {e}")
            issues.append("Archivo de datos inválido")
    else:
        print("   ❌ production_data.json no encontrado")
        issues.append("Archivo de datos faltante")
    
    # 2. Verificar archivos del frontend
    print("2. Verificando frontend...")
    frontend_files = [
        'LightCodeCore/frontend/public/manifest.json',
        'LightCodeCore/frontend/public/loader.svg',
        'LightCodeCore/frontend/src/hooks/useWhiteLabelStore.js'
    ]
    
    for file_path in frontend_files:
        if os.path.exists(file_path):
            print(f"   ✅ {file_path}")
        else:
            print(f"   ❌ {file_path} no encontrado")
            issues.append(f"Archivo frontend faltante: {file_path}")
    
    # 3. Verificar Dockerfile
    print("3. Verificando Dockerfile...")
    dockerfile_path = 'LightCodeCore/backend/Dockerfile'
    if os.path.exists(dockerfile_path):
        with open(dockerfile_path, 'r', encoding='utf-8') as f:
            dockerfile_content = f.read()
        
        if 'create_initial_data' in dockerfile_content:
            print("   ✅ Dockerfile incluye carga de datos")
        else:
            print("   ❌ Dockerfile no incluye carga de datos")
            issues.append("Dockerfile sin carga de datos")
            
        if 'quick_check.py' in dockerfile_content:
            print("   ✅ Dockerfile incluye verificación rápida")
        else:
            print("   ❌ Dockerfile no incluye verificación rápida")
            issues.append("Dockerfile sin verificación")
    else:
        print("   ❌ Dockerfile no encontrado")
        issues.append("Dockerfile faltante")
    
    # 4. Verificar render.yaml
    print("4. Verificando render.yaml...")
    if os.path.exists('LightCodeCore/render.yaml'):
        print("   ✅ render.yaml encontrado")
    else:
        print("   ❌ render.yaml no encontrado")
        issues.append("render.yaml faltante")
    
    # 5. Verificar manifest.json
    print("5. Verificando manifest.json...")
    manifest_path = 'LightCodeCore/frontend/public/manifest.json'
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_content = f.read()
        
        if '"/loader.svg"' in manifest_content:
            print("   ✅ Manifest referencia loader.svg correctamente")
        else:
            print("   ❌ Manifest no referencia loader.svg correctamente")
            issues.append("Manifest con referencia incorrecta")
    
    # 6. Verificar comando de carga de datos
    print("6. Verificando comando de carga de datos...")
    command_path = 'LightCodeCore/backend/apps/users/management/commands/create_initial_data.py'
    if os.path.exists(command_path):
        with open(command_path, 'r', encoding='utf-8') as f:
            command_content = f.read()
        
        if 'create_minimal_data' in command_content:
            print("   ✅ Comando incluye creación de datos mínimos")
        else:
            print("   ❌ Comando no incluye datos mínimos de respaldo")
            issues.append("Comando sin datos de respaldo")
    else:
        print("   ❌ Comando de carga de datos no encontrado")
        issues.append("Comando de carga faltante")
    
    # Resumen
    print("\n" + "=" * 50)
    if issues:
        print("❌ PROBLEMAS ENCONTRADOS:")
        for issue in issues:
            print(f"   - {issue}")
        print("\n🔧 Corrige estos problemas antes del despliegue")
        return False
    else:
        print("✅ TODO LISTO PARA DESPLIEGUE")
        print("\n🚀 Puedes proceder con el despliegue en Render")
        print("\n📋 Próximos pasos:")
        print("   1. git add .")
        print("   2. git commit -m 'Fix: Errores de manifest y No store found'")
        print("   3. git push origin main")
        print("   4. Redesplegar en Render")
        return True

if __name__ == "__main__":
    success = verify_deployment()
    sys.exit(0 if success else 1)