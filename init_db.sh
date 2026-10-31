#!/bin/bash
# Script para inicializar la base de datos SQLite local

echo "🗄️  Inicializando base de datos SQLite..."

cd backend

# Eliminar base de datos anterior si existe
if [ -f "db.sqlite3" ]; then
    echo "⚠️  Eliminando base de datos anterior..."
    rm db.sqlite3
fi

# Ejecutar migraciones
echo "📦 Ejecutando migraciones..."
python manage.py migrate

echo "✅ Base de datos inicializada correctamente"
echo ""
echo "Ahora puedes crear un usuario admin con:"
echo "  python create_admin.py"
