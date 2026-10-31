# ✅ Checklist de Despliegue - LightCode Core

Usa este checklist para asegurarte de que no te saltes ningún paso durante el despliegue.

---

## 📋 PREPARACIÓN (Antes de empezar)

- [ ] Tengo cuenta en [Vercel](https://vercel.com)
- [ ] Tengo cuenta en [Render](https://render.com)
- [ ] Tengo cuenta en [Cloudinary](https://cloudinary.com)
- [ ] Tengo cuenta PayPal Business
- [ ] Mi código está en un repositorio Git (GitHub/GitLab/Bitbucket)
- [ ] He leído `GUIA_DESPLIEGUE_VERCEL_RENDER.md`

---

## 🔑 CREDENCIALES (Reúne antes de empezar)

### Cloudinary:
- [ ] `CLOUDINARY_CLOUD_NAME`: _______________
- [ ] `CLOUDINARY_API_KEY`: _______________
- [ ] `CLOUDINARY_API_SECRET`: _______________

### PayPal:
- [ ] `PAYPAL_CLIENT_ID`: _______________
- [ ] `PAYPAL_CLIENT_SECRET`: _______________
- [ ] `PAYPAL_MODE`: sandbox (para pruebas) o live (producción)

### Email (Gmail):
- [ ] `EMAIL_HOST_USER`: _______________@gmail.com
- [ ] `EMAIL_HOST_PASSWORD`: _______________ (App Password)

---

## 🚀 PARTE 1: RENDER (Backend)

### 1.1 PostgreSQL Database
- [ ] Crear PostgreSQL Database en Render
- [ ] Name: `lightcode-db`
- [ ] Database: `lightcode`
- [ ] User: `lightcode_user`
- [ ] Region: Oregon
- [ ] Plan seleccionado (Free o Starter)
- [ ] **COPIAR Internal Database URL:** _______________

### 1.2 Redis Instance
- [ ] Crear Redis Instance en Render
- [ ] Name: `lightcode-redis`
- [ ] Region: Oregon
- [ ] Plan seleccionado (Free o Starter)
- [ ] **COPIAR Internal Redis URL:** _______________

### 1.3 Web Service (Backend Principal)
- [ ] Crear Web Service en Render
- [ ] Repositorio conectado
- [ ] Name: `lightcode-backend`
- [ ] Region: Oregon
- [ ] Branch: `main`
- [ ] Root Directory: `LightCodeCore/backend`
- [ ] Runtime: Python 3
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `daphne -b 0.0.0.0 -p $PORT asgi:application`
- [ ] Plan seleccionado (Free o Starter)

#### Variables de Entorno del Web Service:
- [ ] `DJANGO_SETTINGS_MODULE=settings.production`
- [ ] `SECRET_KEY` (generado por Render)
- [ ] `DEBUG=False`
- [ ] `PYTHON_VERSION=3.11.0`
- [ ] `ALLOWED_HOSTS=lightcode-backend.onrender.com`
- [ ] `CORS_ALLOWED_ORIGINS` (actualizar después de Vercel)
- [ ] `DATABASE_URL` (Internal Database URL del paso 1.1)
- [ ] `REDIS_URL` (Internal Redis URL del paso 1.2)
- [ ] `CLOUDINARY_CLOUD_NAME`
- [ ] `CLOUDINARY_API_KEY`
- [ ] `CLOUDINARY_API_SECRET`
- [ ] `CLOUDINARY_SECURE=True`
- [ ] `PAYPAL_MODE`
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_CLIENT_SECRET`
- [ ] `PAYPAL_WEBHOOK_ID` (configurar después)
- [ ] `EMAIL_HOST=smtp.gmail.com`
- [ ] `EMAIL_PORT=587`
- [ ] `EMAIL_USE_TLS=True`
- [ ] `EMAIL_HOST_USER`
- [ ] `EMAIL_HOST_PASSWORD`
- [ ] `DEFAULT_FROM_EMAIL`
- [ ] `FRONTEND_URL` (actualizar después de Vercel)
- [ ] `AUTH_COOKIE_SECURE=True`
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] `RENDER=True`

#### Después del Despliegue:
- [ ] Web Service desplegado exitosamente
- [ ] **COPIAR URL del backend:** _______________
- [ ] Abrir Shell en Render
- [ ] Ejecutar: `python manage.py migrate`
- [ ] Ejecutar: `python manage.py createsuperuser`
- [ ] **GUARDAR credenciales del superusuario:**
  - Username: _______________
  - Email: _______________
  - Password: _______________
- [ ] Ejecutar: `python manage.py collectstatic --noinput`
- [ ] Configurar Health Check Path: `/api/health/`

### 1.4 Background Worker (Celery Worker)
- [ ] Crear Background Worker en Render
- [ ] Repositorio conectado
- [ ] Name: `lightcode-celery-worker`
- [ ] Region: Oregon
- [ ] Branch: `main`
- [ ] Root Directory: `LightCodeCore/backend`
- [ ] Runtime: Python 3
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `celery -A celery_app worker --loglevel=info --pool=solo --concurrency=2`
- [ ] Plan seleccionado (Free o Starter)
- [ ] Variables de entorno copiadas del Web Service (sin FRONTEND_URL, AUTH_COOKIE_SECURE, SECURE_SSL_REDIRECT)
- [ ] Worker desplegado exitosamente

### 1.5 Cron Job (Celery Beat)
- [ ] Crear Cron Job en Render
- [ ] Repositorio conectado
- [ ] Name: `lightcode-celery-beat`
- [ ] Region: Oregon
- [ ] Branch: `main`
- [ ] Root Directory: `LightCodeCore/backend`
- [ ] Runtime: Python 3
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Command: `celery -A celery_app beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler`
- [ ] Schedule: Every 1 minute
- [ ] Variables de entorno copiadas del Worker
- [ ] Cron Job creado exitosamente

---

## 🎨 PARTE 2: VERCEL (Frontend)

### 2.1 Importar Proyecto
- [ ] Ir a [Vercel Dashboard](https://vercel.com/dashboard)
- [ ] Click en "Add New... → Project"
- [ ] Repositorio conectado
- [ ] Repositorio seleccionado

### 2.2 Configurar Proyecto
- [ ] Framework Preset: `Vite`
- [ ] Root Directory: `LightCodeCore/frontend`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

### 2.3 Variables de Entorno
- [ ] `VITE_APP_NAME=Mi Servidor MC`
- [ ] `VITE_BACKEND_URL` (URL del backend de Render)
- [ ] `VITE_PLUGIN_COMMAND=shop`
- [ ] `VITE_SHOW_FOOTER_BRANDING=false`
- [ ] Todas las variables aplicadas a Production, Preview y Development

### 2.4 Desplegar
- [ ] Click en "Deploy"
- [ ] Esperar a que termine el build (2-5 minutos)
- [ ] Build completado sin errores
- [ ] **COPIAR URL del frontend:** _______________
- [ ] Frontend accesible en el navegador

---

## 🔗 PARTE 3: CONECTAR FRONTEND Y BACKEND

### 3.1 Actualizar Backend en Render
- [ ] Ir al Web Service en Render
- [ ] Ir a "Environment"
- [ ] Actualizar `FRONTEND_URL` con la URL de Vercel
- [ ] Actualizar `CORS_ALLOWED_ORIGINS` con la URL de Vercel
- [ ] Actualizar `ALLOWED_HOSTS` para incluir ambas URLs
- [ ] Guardar cambios
- [ ] Esperar a que el servicio se reinicie

### 3.2 Verificar Conexión
- [ ] Abrir frontend en el navegador
- [ ] Ir a `/dashboard`
- [ ] Intentar iniciar sesión con el superusuario
- [ ] Login exitoso
- [ ] Dashboard carga correctamente
- [ ] No hay errores en la consola del navegador (F12)

---

## ⚙️ PARTE 4: CONFIGURACIÓN POST-DESPLIEGUE

### 4.1 PayPal Webhook
- [ ] Ir a [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/webhooks)
- [ ] Click en "Add Webhook"
- [ ] Webhook URL: `https://[tu-backend].onrender.com/api/payments/paypal/webhook/`
- [ ] Seleccionar eventos:
  - [ ] `PAYMENT.CAPTURE.COMPLETED`
  - [ ] `PAYMENT.CAPTURE.DENIED`
  - [ ] `PAYMENT.CAPTURE.REFUNDED`
- [ ] Guardar webhook
- [ ] **COPIAR Webhook ID:** _______________
- [ ] Actualizar `PAYPAL_WEBHOOK_ID` en Render
- [ ] Guardar y reiniciar servicio

### 4.2 Verificar Funcionalidad Completa
- [ ] Dashboard carga correctamente
- [ ] Puedo crear productos
- [ ] Puedo subir imágenes (se guardan en Cloudinary)
- [ ] Puedo crear cupones
- [ ] La tienda pública funciona
- [ ] El carrito funciona
- [ ] PayPal se carga en el checkout
- [ ] Puedo hacer una compra de prueba (modo sandbox)
- [ ] La orden se registra en el panel admin
- [ ] Las notificaciones funcionan

### 4.3 Configurar RCON (Opcional)
- [ ] Ir al panel admin → Configuración → RCON
- [ ] Configurar:
  - [ ] Host: _______________
  - [ ] Port: 25575
  - [ ] Password: _______________
- [ ] Probar conexión
- [ ] Conexión exitosa
- [ ] Guardar configuración

---

## 🌐 PARTE 5: DOMINIO PERSONALIZADO (Opcional)

### 5.1 Frontend (Vercel)
- [ ] Ir a proyecto en Vercel → Settings → Domains
- [ ] Agregar dominio: _______________
- [ ] Configurar DNS según instrucciones de Vercel
- [ ] Dominio verificado y activo

### 5.2 Backend (Render)
- [ ] Ir a Web Service en Render → Settings → Custom Domain
- [ ] Agregar subdominio: api._______________
- [ ] Configurar registro CNAME en DNS
- [ ] Dominio verificado y activo

### 5.3 Actualizar Variables
- [ ] Actualizar `FRONTEND_URL` en Render con el nuevo dominio
- [ ] Actualizar `CORS_ALLOWED_ORIGINS` en Render
- [ ] Actualizar `ALLOWED_HOSTS` en Render
- [ ] Actualizar `VITE_BACKEND_URL` en Vercel
- [ ] Actualizar PayPal Webhook URL con el nuevo dominio
- [ ] Verificar que todo funciona con los nuevos dominios

---

## 🔒 PARTE 6: SEGURIDAD Y PRODUCCIÓN

### 6.1 Verificar Configuración de Seguridad
- [ ] `DEBUG=False` en todas las variables de entorno
- [ ] `SECRET_KEY` es único y seguro (no el de ejemplo)
- [ ] `ALLOWED_HOSTS` incluye solo mis dominios
- [ ] `CORS_ALLOWED_ORIGINS` incluye solo mi frontend
- [ ] `AUTH_COOKIE_SECURE=True` está configurado
- [ ] `SECURE_SSL_REDIRECT=True` está configurado
- [ ] HTTPS está habilitado en ambos servicios
- [ ] No hay archivos `.env` en el repositorio Git
- [ ] `.admin_credentials` no está en el repositorio

### 6.2 Cambiar a Producción (Cuando estés listo)
- [ ] Cambiar `PAYPAL_MODE=live` en Render
- [ ] Actualizar credenciales de PayPal a producción
- [ ] Actualizar Webhook de PayPal con credenciales de producción
- [ ] Hacer una compra de prueba real
- [ ] Verificar que el dinero llega a tu cuenta PayPal
- [ ] Verificar que la entrega RCON funciona (si aplica)

### 6.3 Backups y Monitoreo
- [ ] Habilitar backups automáticos en PostgreSQL (plan Starter)
- [ ] Configurar alertas en Render para downtime
- [ ] Configurar alertas en Vercel para errores
- [ ] Documentar credenciales en un lugar seguro
- [ ] Configurar monitoreo de logs

---

## 📊 PARTE 7: PERSONALIZACIÓN

### 7.1 Branding
- [ ] Cambiar nombre de la tienda en el panel admin
- [ ] Subir logo personalizado
- [ ] Cambiar colores del tema (si aplica)
- [ ] Configurar información de contacto
- [ ] Configurar redes sociales

### 7.2 Contenido
- [ ] Crear categorías de productos
- [ ] Agregar productos con descripciones e imágenes
- [ ] Configurar comandos RCON para cada producto
- [ ] Crear cupones de descuento
- [ ] Probar el flujo completo de compra

---

## ✅ VERIFICACIÓN FINAL

- [ ] ✅ Backend desplegado y funcionando
- [ ] ✅ Frontend desplegado y funcionando
- [ ] ✅ Base de datos conectada
- [ ] ✅ Redis conectado
- [ ] ✅ Celery Worker activo
- [ ] ✅ Celery Beat activo
- [ ] ✅ Cloudinary funcionando
- [ ] ✅ PayPal configurado
- [ ] ✅ Webhook de PayPal funcionando
- [ ] ✅ Email configurado (opcional)
- [ ] ✅ RCON configurado (opcional)
- [ ] ✅ Dominio personalizado (opcional)
- [ ] ✅ HTTPS habilitado
- [ ] ✅ Seguridad verificada
- [ ] ✅ Compra de prueba exitosa
- [ ] ✅ Entrega automática funcionando (si aplica)

---

## 🎉 ¡LISTO PARA PRODUCCIÓN!

Si todos los checkboxes están marcados, tu tienda está lista para recibir clientes.

### Próximos pasos:
1. Promociona tu tienda en tu servidor de Minecraft
2. Monitorea las ventas desde el panel admin
3. Responde a los clientes a través del sistema de notificaciones
4. Mantén el software actualizado
5. Revisa los logs regularmente

---

## 📞 ¿Necesitas Ayuda?

Si algo no funciona:

1. Revisa los logs en Render y Vercel
2. Verifica que todas las variables de entorno estén correctas
3. Consulta `GUIA_DESPLIEGUE_VERCEL_RENDER.md`
4. Abre un issue en el repositorio

---

*Desarrollado por LightCode • Hecho para la comunidad de Minecraft*
