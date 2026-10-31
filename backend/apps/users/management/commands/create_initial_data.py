"""
Comando para cargar tus datos reales en producción
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
import json
import os

class Command(BaseCommand):
    help = 'Cargar tus datos reales en producción'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 Cargando tus datos reales...'))
        
        # Buscar el archivo de datos
        data_file = 'production_data.json'
        
        if not os.path.exists(data_file):
            self.stdout.write(self.style.ERROR(f'❌ No se encontró {data_file}'))
            self.stdout.write(self.style.ERROR(f'📁 Directorio actual: {os.getcwd()}'))
            self.stdout.write(self.style.ERROR(f'📋 Archivos disponibles: {os.listdir(".")}'))
            
            # Intentar crear datos mínimos si no existe el archivo
            self.stdout.write(self.style.WARNING('🔧 Creando datos mínimos...'))
            self.create_minimal_data()
            return
        
        try:
            # Verificar que el archivo es válido
            with open(data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.stdout.write(self.style.SUCCESS(f'📊 Archivo válido con {len(data)} objetos'))
            
            # Mostrar resumen
            models_count = {}
            for obj in data:
                model = obj.get('model', 'unknown')
                models_count[model] = models_count.get(model, 0) + 1
            
            self.stdout.write(self.style.SUCCESS('📋 Datos a cargar:'))
            for model, count in sorted(models_count.items()):
                self.stdout.write(f'  - {model}: {count} objetos')
            
            # Cargar datos
            self.stdout.write(self.style.SUCCESS('📥 Cargando datos...'))
            call_command('loaddata', data_file, verbosity=2)
            
            self.stdout.write(self.style.SUCCESS('🎉 ¡Tus datos reales cargados exitosamente!'))
            self.stdout.write(self.style.SUCCESS('✅ Tu tienda con todos los productos ya está disponible'))
            
        except json.JSONDecodeError as e:
            self.stdout.write(self.style.ERROR(f'❌ Error en JSON: {e}'))
            self.create_minimal_data()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error cargando datos: {e}'))
            self.create_minimal_data()
    
    def create_minimal_data(self):
        """Crear datos mínimos si no se pueden cargar los datos de producción"""
        from apps.users.models import User
        from apps.stores.models import Store
        
        try:
            # Crear usuario admin si no existe
            admin_user, created = User.objects.get_or_create(
                username='admin',
                defaults={
                    'email': 'admin@lightcode.com',
                    'user_type': 'seller',
                    'is_superuser': True,
                    'is_staff': True,
                }
            )
            
            if created:
                admin_user.set_password('admin123')
                admin_user.save()
                self.stdout.write(self.style.SUCCESS('👤 Usuario admin creado'))
            
            # Crear tienda mínima si no existe
            store, created = Store.objects.get_or_create(
                slug='lightcode-store',
                defaults={
                    'name': 'LightCode Store',
                    'description': 'Tienda de ejemplo',
                    'owner': admin_user,
                    'status': 'active',
                    'is_verified': True,
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS('🏪 Tienda mínima creada'))
            
            self.stdout.write(self.style.SUCCESS('✅ Datos mínimos creados exitosamente'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error creando datos mínimos: {e}'))