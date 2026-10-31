"""
Script para limpiar la base de datos y empezar de cero.
"""
import os
import sys
import django

# Agregar backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Eliminar todas las tablas
    cursor.execute("""
        DO $$ DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
    """)
    print("✅ Todas las tablas eliminadas")

print("✅ Base de datos limpia. Ahora ejecuta: python manage.py migrate")
