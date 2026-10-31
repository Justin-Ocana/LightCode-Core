"""
Management command para inicializar categorías globales.

Usage:
    python manage.py init_global_categories
"""
from django.core.management.base import BaseCommand
from apps.products.models import ProductCategory, GLOBAL_CATEGORIES
from apps.stores.models import Store


class Command(BaseCommand):
    help = 'Inicializa las categorías base para todas las tiendas que no las tengan'
    
    def handle(self, *args, **options):
        self.stdout.write('Inicializando categorías base para todas las tiendas...\n')
        
        stores = Store.objects.filter(is_deleted=False)
        total_created = 0
        
        for store in stores:
            self.stdout.write(f'Procesando tienda: {store.slug}...')
            
            for i, cat_data in enumerate(GLOBAL_CATEGORIES):
                category, created = ProductCategory.objects.get_or_create(
                    store=store,
                    slug=cat_data['slug'],
                    defaults={
                        'name': cat_data['name'],
                        'description': cat_data['description'],
                        'icon': cat_data['icon'],
                        'sort_order': i,
                        'is_default': True,
                    }
                )
                
                if created:
                    total_created += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  ✓ Creada: {category.icon} {category.name}'
                        )
                    )
        
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Proceso completado:'
                f'\n  - Total categorías creadas: {total_created}'
                f'\n  - Total tiendas procesadas: {stores.count()}\n'
            )
        )
