# 📄 Resumen de Configuración - Referencia Rápida

Este documento contiene todos los valores de configuración en un solo lugar para copiar y pegar rápidamente.

---

## 🎯 VERCEL - Frontend

### Framework Settings:
```
Framework Preset: Vite
Root Directory: LightCodeCore/frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Environment Variables:
```env
VITE_APP_NAME=Mi Servidor MC
VITE_BACKEND_URL=https://lightcode-backend.onrender.com
VITE_PLUGIN_COMMAND=shop
VITE_SHOW_FOOTER_BRANDING=false
```

**Aplicar a:** Production, Preview, Development

---

## 🚀 RENDER - Backend

### 1. PostgreSQL Database
```
Name: lightcode-db
Database: lightcode
User: lightcode_user
Region: Oregon
Plan: Free o Starter ($7/mes)
```

**Después de crear, copiar:** Internal Database URL

---

### 2. Redis Instance
```
Name: lightcode-redis
Region: Oregon
Plan: Free o Starter ($10/mes)
```

**Después de crear, copiar:** Internal Redis URL

---

### 3. Web Service (Backend Principal)

#### Build Settings:
```
Name: lightcode-backend
Region: Oregon
Branch: main
Root Directory: LightCodeCore/backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: daphne -b 0.0.0.0 -p $PORT asgi:application
Plan: Free o Starter ($7/mes)
```

#### Environment Variables:
```env
# Django Core
DJANGO_SETTINGS_MODULE=settings.production
SECRET_KEY=[Generate]
DEBUG=False
PYTHON_VERSION=3.11.0

# Hosts y CORS
ALLOWED_HOSTS=lightcode-backend.onrender.com
CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app

# Base de Datos
DATABASE_URL=[Internal Database URL del paso 1]

# Redis
REDIS_URL=[Internal Redis URL del paso 2]

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
CLOUDINARY_SECURE=True

# PayPal
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=tu-paypal-client-id
PAYPAL_CLIENT_SECRET=tu-paypal-client-secret
PAYPAL_WEBHOOK_ID=tu-webhook-id

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu-email@gmail.com
EMAIL_HOST_PASSWORD=tu-app-password-de-gmail
DEFAULT_FROM_EMAIL=LightCode <noreply@tuservidor.com>

# Frontend
FRONTEND_URL=https://tu-frontend.vercel.app

# Seguridad
AUTH_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True
RENDER=True
```

#### Comandos Post-Despliegue:
```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput
```

---

### 4. Background Worker (Celery Worker)

#### Build Settings:
```
Name: lightcode-celery-worker
Region: Oregon
Branch: main
Root Directory: LightCodeCore/backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: celery -A celery_app worker --loglevel=info --pool=solo --concurrency=2
Plan: Free o Starter ($7/mes)
```

#### Environment Variables:
```
[Copiar las mismas del Web Service, excepto:]
- FRONTEND_URL
- AUTH_COOKIE_SECURE
- SECURE_SSL_REDIRECT
```

---

### 5. Cron Job (Celery Beat)

#### Build Settings:
```
Name: lightcode-celery-beat
Region: Oregon
Branch: main
Root Directory: LightCodeCore/backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Command: celery -A celery_app beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
Schedule: Every 1 minute
```

#### Environment Variables:
```
[Copiar las mismas del Background Worker]
```

---

## 🔗 Conexión Frontend-Backend

### Después de desplegar ambos:

**Actualizar en Render (Web Service):**
```env
FRONTEND_URL=https://tu-proyecto.vercel.app
CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
ALLOWED_HOSTS=lightcode-backend.onrender.com,tu-proyecto.vercel.app
```

**Actualizar en Vercel:**
```env
VITE_BACKEND_URL=https://lightcode-backend.onrender.com
```

---

## 💳 PayPal Webhook

### Configuración:
```
URL: https://lightcode-backend.onrender.com/api/payments/paypal/webhook/

Eventos:
- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.DENIED
- PAYMENT.CAPTURE.REFUNDED
```

**Después de crear, actualizar en Render:**
```env
PAYPAL_WEBHOOK_ID=tu-nuevo-webhook-id
```

---

## 🌐 Dominio Personalizado (Opcional)

### Frontend (Vercel):
```
Dominio: tuservidor.com

DNS:
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Backend (Render):
```
Dominio: api.tuservidor.com

DNS:
Type: CNAME
Name: api
Value: lightcode-backend.onrender.com
```

### Actualizar Variables:

**En Render:**
```env
ALLOWED_HOSTS=api.tuservidor.com,tuservidor.com
CORS_ALLOWED_ORIGINS=https://tuservidor.com
FRONTEND_URL=https://tuservidor.com
```

**En Vercel:**
```env
VITE_BACKEND_URL=https://api.tuservidor.com
```

---

## 🎮 RCON (Opcional)

### Configuración en Panel Admin:
```
Host: IP de tu servidor Minecraft
Port: 25575
Password: tu-password-rcon
```

### Habilitar en server.properties:
```properties
enable-rcon=true
rcon.port=25575
rcon.password=tu-password-seguro
```

---

## 📧 Email (Gmail)

### Obtener App Password:
1. Ve a https://myaccount.google.com/apppasswords
2. Genera una contraseña de aplicación
3. Usa esa contraseña en `EMAIL_HOST_PASSWORD`

---

## ☁️ Cloudinary

### Obtener Credenciales:
1. Ve a https://cloudinary.com/console
2. Copia:
   - Cloud Name
   - API Key
   - API Secret

---

## 💰 PayPal

### Obtener Credenciales:
1. Ve a https://developer.paypal.com/dashboard/applications
2. Crea una app
3. Copia:
   - Client ID
   - Client Secret

### Modos:
- `sandbox`: Para pruebas (usa credenciales de sandbox)
- `live`: Para producción (usa credenciales de live)

---

## 📊 Costos Mensuales

### Plan Gratuito (Desarrollo):
```
Vercel: $0
Render PostgreSQL: $0 (expira en 90 días)
Render Redis: $0
Render Web Service: $0 (se duerme después de 15 min)
Render Worker: $0
Cloudinary: $0
Total: $0/mes
```

### Plan Producción (Recomendado):
```
Vercel Pro: $20/mes
Render PostgreSQL Starter: $7/mes
Render Redis Starter: $10/mes
Render Web Service Starter: $7/mes
Render Background Worker: $7/mes
Cloudinary Plus: $99/mes (opcional)
Total: ~$51/mes (sin Cloudinary Plus)
Total: ~$150/mes (con Cloudinary Plus)
```

---

## 🔒 Checklist de Seguridad

Antes de producción:

- [ ] `DEBUG=False`
- [ ] `SECRET_KEY` único y seguro
- [ ] `ALLOWED_HOSTS` solo con tus dominios
- [ ] `CORS_ALLOWED_ORIGINS` solo con tu frontend
- [ ] `AUTH_COOKIE_SECURE=True`
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] HTTPS habilitado
- [ ] No hay `.env` en Git
- [ ] No hay `.admin_credentials` en Git
- [ ] PayPal en modo `live` con credenciales de producción
- [ ] Webhook de PayPal actualizado
- [ ] Backups de base de datos habilitados

---

## 🐛 Comandos de Diagnóstico

### Ver logs en Render:
```
Dashboard → [Servicio] → Logs
```

### Ver logs en Vercel:
```
Dashboard → [Proyecto] → Deployments → [Deployment] → View Function Logs
```

### Ejecutar comandos en Render:
```
Dashboard → [Web Service] → Shell
```

### Redesplegar en Vercel:
```bash
vercel --prod
```

---

## 📞 Soporte


---

## 📚 Documentación Completa

- `GUIA_DESPLIEGUE_VERCEL_RENDER.md` - Guía completa paso a paso
- `VERCEL_QUICKSTART.md` - Guía rápida de Vercel
- `RENDER_QUICKSTART.md` - Guía rápida de Render
- `CONFIGURACION_VERCEL_VISUAL.md` - Configuración visual de Vercel
- `CONFIGURACION_RENDER_VISUAL.md` - Configuración visual de Render
- `CHECKLIST_DESPLIEGUE.md` - Checklist interactivo
- `RESUMEN_CONFIGURACION.md` - Este documento

---

*Desarrollado por LightCode • Hecho para la comunidad de Minecraft*
