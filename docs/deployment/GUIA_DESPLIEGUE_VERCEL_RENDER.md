# 🚀 Guía de Despliegue: Vercel + Render

Esta guía te explica paso a paso cómo desplegar **LightCode Core** usando:
- **Vercel** para el frontend (React + Vite)
- **Render** para el backend (Django + Celery + Redis)

---

## 📋 Requisitos Previos

Antes de comenzar, necesitas:

1. ✅ Cuenta en [Vercel](https://vercel.com) (gratis)
2. ✅ Cuenta en [Render](https://render.com) (gratis o de pago)
3. ✅ Repositorio Git (GitHub, GitLab o Bitbucket)
4. ✅ Cuenta en [Cloudinary](https://cloudinary.com) (gratis)
5. ✅ Cuenta PayPal Business con credenciales de API
6. ✅ Base de datos PostgreSQL (Render la proporciona gratis)

---

## 🎯 PARTE 1: Desplegar Backend en Render

### Paso 1.1: Crear Base de Datos PostgreSQL

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"PostgreSQL"**
3. Configura:
   - **Name:** `lightcode-db`
   - **Database:** `lightcode`
   - **User:** `lightcode_user`
   - **Region:** Oregon (o el más cercano a ti)
   - **Plan:** Free (o Starter si necesitas más recursos)
4. Click en **"Create Database"**
5. **IMPORTANTE:** Guarda la **Internal Database URL** que aparece en la página de la base de datos
   - Formato: `postgresql://user:password@host:5432/database`

### Paso 1.2: Crear Redis Instance

1. En Render Dashboard, click en **"New +"** → **"Redis"**
2. Configura:
   - **Name:** `lightcode-redis`
   - **Region:** Oregon (mismo que la base de datos)
   - **Plan:** Free (o Starter)
3. Click en **"Create Redis"**
4. **IMPORTANTE:** Guarda la **Internal Redis URL**
   - Formato: `redis://red-xxxxx:6379`

### Paso 1.3: Crear Web Service (Backend Principal)

1. En Render Dashboard, click en **"New +"** → **"Web Service"**
2. Conecta tu repositorio Git
3. Configura el servicio:

#### Build & Deploy Settings:
```
Name: lightcode-backend
Region: Oregon
Branch: main
Root Directory: LightCodeCore/backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: daphne -b 0.0.0.0 -p $PORT asgi:application
```

**⚠️ IMPORTANTE:** Si estás en Windows, asegúrate de usar barras normales (`/`) en lugar de barras invertidas (`\`):
- ✅ Correcto: `LightCodeCore/backend`
- ❌ Incorrecto: `LightCodeCore\backend`

#### Environment Variables:
Click en **"Advanced"** → **"Add Environment Variable"** y agrega:

```env
# Django Core
DJANGO_SETTINGS_MODULE=settings.production
SECRET_KEY=[Click en "Generate" para crear una clave segura]
DEBUG=False
PYTHON_VERSION=3.11.0

# Hosts y CORS
ALLOWED_HOSTS=lightcode-backend.onrender.com,tudominio.com
CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app,https://tudominio.com

# Base de Datos (usa la Internal Database URL de Paso 1.1)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (usa la Internal Redis URL de Paso 1.2)
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

# Frontend URL (lo configurarás después de desplegar en Vercel)
FRONTEND_URL=https://tu-frontend.vercel.app

# Seguridad
AUTH_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True
RENDER=True
```

4. Click en **"Create Web Service"**
5. Espera a que termine el despliegue (5-10 minutos)
6. **IMPORTANTE:** Guarda la URL del servicio (ej: `https://lightcode-backend.onrender.com`)

### Paso 1.4: Crear Background Worker (Celery Worker)

1. En Render Dashboard, click en **"New +"** → **"Background Worker"**
2. Conecta el mismo repositorio
3. Configura:

```
Name: lightcode-celery-worker
Region: Oregon
Branch: main
Root Directory: LightCodeCore/backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: celery -A celery_app worker --loglevel=info --pool=solo --concurrency=2
```

4. Agrega las **mismas variables de entorno** que el Web Service (excepto FRONTEND_URL y las de seguridad)
5. Click en **"Create Background Worker"**

### Paso 1.5: Crear Cron Job (Celery Beat)

1. En Render Dashboard, click en **"New +"** → **"Cron Job"**
2. Conecta el mismo repositorio
3. Configura:

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

4. Agrega las **mismas variables de entorno** que el Worker
5. Click en **"Create Cron Job"**

### Paso 1.6: Ejecutar Migraciones y Crear Admin

1. Ve al **Web Service** (lightcode-backend)
2. Click en **"Shell"** en el menú lateral
3. Ejecuta estos comandos:

```bash
# Migrar base de datos
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Recopilar archivos estáticos
python manage.py collectstatic --noinput
```

4. Guarda las credenciales del superusuario

### Paso 1.7: Configurar Health Check

1. En el Web Service, ve a **"Settings"**
2. En **"Health Check Path"** pon: `/api/health/`
3. Click en **"Save Changes"**

---

## 🎨 PARTE 2: Desplegar Frontend en Vercel

### Paso 2.1: Preparar Variables de Entorno del Frontend

Primero, necesitas crear un archivo `.env` en `LightCodeCore/frontend/` con estas variables:

```env
VITE_APP_NAME=Mi Servidor MC
VITE_BACKEND_URL=https://lightcode-backend.onrender.com
VITE_PLUGIN_COMMAND=shop
VITE_SHOW_FOOTER_BRANDING=false
```

**IMPORTANTE:** Reemplaza `lightcode-backend.onrender.com` con la URL real de tu backend de Render.

### Paso 2.2: Importar Proyecto en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en **"Add New..."** → **"Project"**
3. Importa tu repositorio Git
4. Configura el proyecto:

#### Framework Preset:
```
Framework Preset: Vite
```

#### Root Directory:
```
Root Directory: LightCodeCore/frontend
```

#### Build and Output Settings:
```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Paso 2.3: Configurar Variables de Entorno en Vercel

1. En la página de configuración del proyecto, ve a **"Environment Variables"**
2. Agrega estas variables para **Production**, **Preview** y **Development**:

```
VITE_APP_NAME=Mi Servidor MC
VITE_BACKEND_URL=https://lightcode-backend.onrender.com
VITE_PLUGIN_COMMAND=shop
VITE_SHOW_FOOTER_BRANDING=false
```

**IMPORTANTE:** Usa la URL real de tu backend de Render.

3. Click en **"Deploy"**

### Paso 2.4: Esperar el Despliegue

1. Vercel construirá y desplegará tu frontend (2-5 minutos)
2. Una vez completado, obtendrás una URL como: `https://tu-proyecto.vercel.app`
3. **IMPORTANTE:** Guarda esta URL

---

## 🔗 PARTE 3: Conectar Frontend y Backend

### Paso 3.1: Actualizar Variables de Backend

1. Ve a tu **Web Service** en Render
2. Ve a **"Environment"**
3. Actualiza estas variables:

```env
FRONTEND_URL=https://tu-proyecto.vercel.app
CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
ALLOWED_HOSTS=lightcode-backend.onrender.com,tu-proyecto.vercel.app
```

4. Click en **"Save Changes"**
5. El servicio se reiniciará automáticamente

### Paso 3.2: Configurar Dominio Personalizado (Opcional)

#### En Vercel (Frontend):
1. Ve a tu proyecto → **"Settings"** → **"Domains"**
2. Agrega tu dominio (ej: `tuservidor.com`)
3. Configura los DNS según las instrucciones de Vercel

#### En Render (Backend):
1. Ve a tu Web Service → **"Settings"** → **"Custom Domain"**
2. Agrega un subdominio (ej: `api.tuservidor.com`)
3. Configura el registro CNAME en tu proveedor de DNS

#### Actualizar Variables:
```env
# En Render:
FRONTEND_URL=https://tuservidor.com
CORS_ALLOWED_ORIGINS=https://tuservidor.com
ALLOWED_HOSTS=api.tuservidor.com,tuservidor.com

# En Vercel:
VITE_BACKEND_URL=https://api.tuservidor.com
```

---

## ⚙️ PARTE 4: Configuración Post-Despliegue

### Paso 4.1: Configurar PayPal Webhook

1. Ve a [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/webhooks)
2. Click en **"Add Webhook"**
3. Configura:
   - **Webhook URL:** `https://lightcode-backend.onrender.com/api/payments/paypal/webhook/`
   - **Event types:** Selecciona:
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`
4. Click en **"Save"**
5. Copia el **Webhook ID** y actualízalo en las variables de entorno de Render:
   ```env
   PAYPAL_WEBHOOK_ID=tu-nuevo-webhook-id
   ```

### Paso 4.2: Verificar Funcionamiento

1. Accede a tu frontend: `https://tu-proyecto.vercel.app`
2. Accede al panel admin: `https://tu-proyecto.vercel.app/dashboard`
3. Inicia sesión con las credenciales del superusuario
4. Verifica:
   - ✅ Dashboard carga correctamente
   - ✅ Puedes crear productos
   - ✅ Las imágenes se suben a Cloudinary
   - ✅ La tienda pública funciona
   - ✅ El carrito funciona
   - ✅ PayPal se carga en el checkout

### Paso 4.3: Configurar RCON (Opcional)

Si vas a usar entrega automática:

1. Ve al panel admin → **Configuración** → **RCON**
2. Configura:
   - **Host:** IP de tu servidor Minecraft
   - **Port:** 25575 (por defecto)
   - **Password:** Tu contraseña RCON
3. Click en **"Probar Conexión"**
4. Si funciona, guarda la configuración

---

## 📊 PARTE 5: Monitoreo y Logs

### Ver Logs en Render:

1. Ve a tu servicio en Render
2. Click en **"Logs"** en el menú lateral
3. Aquí verás todos los logs en tiempo real

### Ver Logs en Vercel:

1. Ve a tu proyecto en Vercel
2. Click en **"Deployments"**
3. Click en un despliegue → **"View Function Logs"**

### Monitorear Rendimiento:

- **Render:** Dashboard muestra CPU, memoria y ancho de banda
- **Vercel:** Analytics muestra visitas, rendimiento y errores

---

## 🔒 Checklist de Seguridad

Antes de ir a producción, verifica:

- [ ] `DEBUG=False` en todas las variables de entorno
- [ ] `SECRET_KEY` es único y seguro (generado por Render)
- [ ] `ALLOWED_HOSTS` incluye solo tus dominios
- [ ] `CORS_ALLOWED_ORIGINS` incluye solo tu frontend
- [ ] `AUTH_COOKIE_SECURE=True` está configurado
- [ ] `SECURE_SSL_REDIRECT=True` está configurado
- [ ] HTTPS está habilitado en ambos servicios
- [ ] Credenciales de PayPal son de producción (`PAYPAL_MODE=live`)
- [ ] Webhook de PayPal está configurado correctamente
- [ ] Base de datos tiene backups automáticos habilitados
- [ ] No hay archivos `.env` en el repositorio Git
- [ ] `.admin_credentials` no está en el repositorio

---

## 💰 Costos Estimados

### Plan Gratuito (Desarrollo/Pruebas):
- **Vercel:** Gratis (100 GB bandwidth/mes)
- **Render PostgreSQL:** Gratis (1 GB storage, expira en 90 días)
- **Render Redis:** Gratis (25 MB)
- **Render Web Service:** Gratis (750 horas/mes, se duerme después de 15 min de inactividad)
- **Cloudinary:** Gratis (25 GB storage, 25 GB bandwidth/mes)
- **Total:** $0/mes

### Plan Producción (Recomendado):
- **Vercel Pro:** $20/mes (1 TB bandwidth)
- **Render PostgreSQL Starter:** $7/mes (10 GB storage)
- **Render Redis Starter:** $10/mes (1 GB)
- **Render Web Service Starter:** $7/mes (siempre activo)
- **Render Background Worker:** $7/mes
- **Cloudinary Plus:** $99/mes (100 GB storage, 100 GB bandwidth)
- **Total:** ~$150/mes

---

## 🐛 Solución de Problemas Comunes

### Error: "Application failed to respond"
**Causa:** El backend no está respondiendo en el puerto correcto.
**Solución:** Verifica que el Start Command use `$PORT`:
```bash
daphne -b 0.0.0.0 -p $PORT asgi:application
```

### Error: "CORS policy: No 'Access-Control-Allow-Origin'"
**Causa:** CORS no está configurado correctamente.
**Solución:** Verifica que `CORS_ALLOWED_ORIGINS` incluya la URL exacta de tu frontend (sin barra final).

### Error: "502 Bad Gateway" en Render
**Causa:** El servicio se quedó sin memoria o crasheó.
**Solución:** 
1. Revisa los logs en Render
2. Considera upgradar a un plan con más RAM
3. Verifica que las migraciones se ejecutaron correctamente

### Frontend no se conecta al backend
**Causa:** URL del backend incorrecta.
**Solución:** 
1. Verifica `VITE_BACKEND_URL` en Vercel
2. Asegúrate de que no tenga barra final
3. Verifica que el backend esté activo en Render

### Imágenes no se suben
**Causa:** Credenciales de Cloudinary incorrectas.
**Solución:** 
1. Verifica las credenciales en Render
2. Asegúrate de que `CLOUDINARY_SECURE=True`
3. Revisa los logs para ver el error específico

### PayPal no funciona
**Causa:** Credenciales incorrectas o webhook mal configurado.
**Solución:** 
1. Verifica que `PAYPAL_MODE` sea correcto (sandbox/live)
2. Verifica Client ID y Secret
3. Asegúrate de que el webhook apunte a la URL correcta
4. Revisa que el Webhook ID sea correcto

### Celery no procesa tareas
**Causa:** Redis no está conectado o Worker no está corriendo.
**Solución:** 
1. Verifica que `REDIS_URL` sea correcto
2. Asegúrate de que el Background Worker esté activo en Render
3. Revisa los logs del Worker

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs en Render y Vercel
2. Verifica que todas las variables de entorno estén correctas
3. Consulta la documentación oficial:
   - [Render Docs](https://render.com/docs)
   - [Vercel Docs](https://vercel.com/docs)
4. Contacta al desarrollador:

---

## 🎉 ¡Listo!

Tu tienda ya está desplegada y funcionando. Ahora puedes:

1. ✅ Configurar productos desde el panel admin
2. ✅ Configurar cupones y descuentos
3. ✅ Conectar tu servidor Minecraft vía RCON
4. ✅ Empezar a vender

**Próximos pasos:**
- Personaliza los colores y el logo desde el panel admin
- Configura tu dominio personalizado
- Prueba el flujo completo de compra
- Configura los comandos RCON para cada producto
- Cambia a `PAYPAL_MODE=live` cuando estés listo para producción

---

*Desarrollado por LightCode • Hecho para la comunidad de Minecraft*
