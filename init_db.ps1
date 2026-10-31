# Script para inicializar la base de datos SQLite local (Windows PowerShell)

Write-Host "🗄️  Inicializando base de datos SQLite..." -ForegroundColor Cyan

Set-Location backend

# Eliminar base de datos anterior si existe
if (Test-Path "db.sqlite3") {
    Write-Host "⚠️  Eliminando base de datos anterior..." -ForegroundColor Yellow
    Remove-Item "db.sqlite3"
}

# Ejecutar migraciones
Write-Host "📦 Ejecutando migraciones..." -ForegroundColor Cyan
python manage.py migrate

Write-Host "✅ Base de datos inicializada correctamente" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora puedes crear un usuario admin con:" -ForegroundColor White
Write-Host "  python create_admin.py" -ForegroundColor Yellow
