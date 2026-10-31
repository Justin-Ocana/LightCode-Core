# 🚀 Render - Configuración Rápida

Esta es una guía rápida para configurar el backend en Render. Para la guía completa, consulta `GUIA_DESPLIEGUE_VERCEL_RENDER.md`.

---

## 📋 Orden de Creación de Servicios

Crea los servicios en este orden:

1. ✅ PostgreSQL Database
2. ✅ Redis Instance
3. ✅ Web Service (Backend Principal)
4. ✅ Background Worker (Celery Worker)
5. ✅ Cron Job (Celery Beat)

---

## 1️⃣ PostgreSQL Database

| Campo | Valor |
|-------|-------|
| **Name** | `lightcode-db` |
| **Database** | `lightcode` |
| **User** | `lightcode_user` |
| **Region** | Oregon |
| **Plan** | Free (o Starter $7/mes) |

**IMPORTANTE:** Guarda la **Internal Database URL** que aparece después de crear la base de datos.

---

## 2️⃣ Redis Instance

| Campo | Valor |
|-------|-------|
| **Name** | `lightcode-redis` |
| **Region** | Oregon |
| **Plan** | Free (o Starter $10/mes) |

**IMPORTANTE:** Guarda la **Internal Redis URL** que aparece después de crear Redis.

---

## 3️⃣ Web Service (Backend Principal)

### Build & Deploy Settings:

| Campo | Valor |
|-------|-------|
| **Name** | `lightcode-backend` |
| **Region** | Oregon |
| **Branch** | `main` |
| **Root Directory** | `LightCodeCore/backend` ⚠️ Usa `/` no `\` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `daphne -b 0.0.0.0 -p $PORT asgi:application` |

### Environment Variables:

```env
# Django Core
DJANGO_SETTINGS_MODULE=settings.production
SECRET_KEY=[Click "Generate" para crear una clave segura]
DEBUG=False
PYTHON_VERSION=3.11.0

# Hosts y CORS (actualiza después de desplegar en Vercel)
ALLOWED_HOSTS=lightcode-backend.onrender.com
CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app

# Base de Datos (usa la Internal Database URL del paso 1)
DATABASE_URL=postgresql://lightcode_user:password@host:5432/lightcode

# Redis (usa la Internal Redis URL del paso 2)
REDIS_URL=redis://red-xxxxx:6379

# Cloudinary (obtén en https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
CLOUDINARY_SECURE=True

# PayPal (obtén en https://developer.paypal.com)
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=tu-paypal-client-id
PAYPAL_CLIENT_SECRET=tu-paypal-client-secret
PAYPAL_WEBHOOK_ID=tu-webhook-id

# Email (opcional - Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu-email@gmail.com
EMAIL_HOST_PASSWORD=tu-app-password-de-gmail
DEFAULT_FROM_EMAIL=LightCode <noreply@tuservidor.com>

# Frontend URL (actualiza después de desplegar en Vercel)
FRONTEND_URL=https://tu-frontend.vercel.app

# Seguridad
AUTH_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True
RENDER=True
```

### Después de crear el servicio:

1. Ve a **Shell** en el menú lateral
2. Ejecuta estos comandos:

```bash
# Migrar base de datos
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Recopilar archivos estáticos
python manage.py collectstatic --noinput
```

3. Guarda las credenciales del superusuario

---

## 4️⃣ Background Worker (Celery Worker)

### Build & Deploy Settings:

| Campo | Valor |
|-------|-------|
| **Name** | `lightcode-celery-worker` |
| **Region** | Oregon |
| **Branch** | `main` |
| **Root Directory** | `LightCodeCore/backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `celery -A celery_app worker --loglevel=info --pool=solo --concurrency=2` |

### Environment Variables:

Usa las **mismas variables** que el Web Service, excepto:
- ❌ No necesitas `FRONTEND_URL`
- ❌ No necesitas `AUTH_COOKIE_SECURE`
- ❌ No necesitas `SECURE_SSL_REDIRECT`

---

## 5️⃣ Cron Job (Celery Beat)

### Build & Deploy Settings:

| Campo | Valor |
|-------|-------|
| **Name** | `lightcode-celery-beat` |
| **Region** | Oregon |
| **Branch** | `main` |
| **Root Directory** | `LightCodeCore/backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Command** | `celery -A celery_app beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler` |
| **Schedule** | Every 1 minute |

### Environment Variables:

Usa las **mismas variables** que el Background Worker.

---

## 🔗 Conectar con Vercel

Después de desplegar el backend, actualiza estas variables en el **Web Service**:

```env
FRONTEND_URL=https://tu-proyecto.vercel.app
CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
ALLOWED_HOSTS=lightcode-backend.onrender.com,tu-proyecto.vercel.app
```

Y en **Vercel**, actualiza:

```env
VITE_BACKEND_URL=https://lightcode-backend.onrender.com
```

---

## ⚙️ Configurar PayPal Webhook

1. Ve a [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/webhooks)
2. Click en **"Add Webhook"**
3. Configura:
   - **Webhook URL:** `https://lightcode-backend.onrender.com/api/payments/paypal/webhook/`
   - **Event types:** 
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`
4. Copia el **Webhook ID** y actualízalo en Render:
   ```env
   PAYPAL_WEBHOOK_ID=tu-nuevo-webhook-id
   ```

---

## 🌐 Dominio Personalizado (Opcional)

### Agregar dominio en Render:

1. Ve a tu Web Service → **Settings** → **Custom Domain**
2. Click en **Add Custom Domain**
3. Ingresa tu subdominio (ej: `api.tuservidor.com`)
4. Render te dará un registro CNAME para configurar

### Configurar DNS:

Agrega este registro en tu proveedor de DNS:

```
Type: CNAME
Name: api
Value: lightcode-backend.onrender.com
```

### Actualizar variables después de agregar dominio:

```env
ALLOWED_HOSTS=api.tuservidor.com,tuservidor.com
CORS_ALLOWED_ORIGINS=https://tuservidor.com
FRONTEND_URL=https://tuservidor.com
```

---

## 🐛 Solución de Problemas

### Error: "Application failed to respond"
**Solución:** Verifica que el Start Command use `$PORT`:
```bash
daphne -b 0.0.0.0 -p $PORT asgi:application
```

### Error: "502 Bad Gateway"
**Solución:** 
1. Revisa los logs en Render
2. Verifica que las migraciones se ejecutaron: `python manage.py migrate`
3. Considera upgradar a un plan con más RAM

### Error: "CORS policy"
**Solución:** Verifica que `CORS_ALLOWED_ORIGINS` incluya la URL exacta de tu frontend (sin barra final).

### Celery no procesa tareas
**Solución:** 
1. Verifica que `REDIS_URL` sea correcto
2. Asegúrate de que el Background Worker esté activo
3. Revisa los logs del Worker

---

## 📊 Límites del Plan Gratuito

| Servicio | Límite Gratuito |
|----------|-----------------|
| Web Service | 750 horas/mes, se duerme después de 15 min de inactividad |
| PostgreSQL | 1 GB storage, expira en 90 días |
| Redis | 25 MB |
| Background Worker | 750 horas/mes |
| Cron Job | Ilimitado |

**Nota:** Para producción, se recomienda el plan Starter ($7/mes por servicio) que mantiene los servicios siempre activos.

---

## ✅ Checklist de Despliegue

- [ ] PostgreSQL Database creada
- [ ] Redis Instance creada
- [ ] Web Service desplegado exitosamente
- [ ] Migraciones ejecutadas (`python manage.py migrate`)
- [ ] Superusuario creado
- [ ] Background Worker activo
- [ ] Cron Job configurado
- [ ] Variables de entorno configuradas
- [ ] Health Check configurado (`/api/health/`)
- [ ] PayPal Webhook configurado
- [ ] Frontend conectado (CORS configurado)
- [ ] Login funciona desde el frontend
- [ ] Productos se pueden crear
- [ ] Imágenes se suben a Cloudinary

---

## 🎯 Próximos Pasos

1. ✅ Despliega el frontend en Vercel (ver `VERCEL_QUICKSTART.md`)
2. ✅ Conecta frontend y backend actualizando variables
3. ✅ Prueba el flujo completo de compra
4. ✅ Configura RCON para entrega automática
5. ✅ Cambia a producción (`PAYPAL_MODE=live`)

---

*¿Necesitas ayuda? Consulta la guía completa en `GUIA_DESPLIEGUE_VERCEL_RENDER.md`*
