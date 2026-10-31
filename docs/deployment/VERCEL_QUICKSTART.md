# ⚡ Vercel - Configuración Rápida

Esta es una guía rápida para configurar el frontend en Vercel. Para la guía completa con backend en Render, consulta `GUIA_DESPLIEGUE_VERCEL_RENDER.md`.

---

## 📋 Configuración en Vercel Dashboard

### 1. Import Settings

Cuando importes el proyecto en Vercel, usa esta configuración:

| Campo | Valor |
|-------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `LightCodeCore/frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 2. Environment Variables

Agrega estas variables en **Settings → Environment Variables**:

#### Para todos los entornos (Production, Preview, Development):

```env
VITE_APP_NAME=Mi Servidor MC
VITE_BACKEND_URL=https://tu-backend.onrender.com
VITE_PLUGIN_COMMAND=shop
VITE_SHOW_FOOTER_BRANDING=false
```

**IMPORTANTE:** 
- Reemplaza `tu-backend.onrender.com` con la URL real de tu backend
- NO incluyas `/api` al final de `VITE_BACKEND_URL`
- NO incluyas barra final `/` en la URL

### 3. Ejemplo de Configuración Visual

```
┌─────────────────────────────────────────────────────────┐
│ Environment Variables                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Key: VITE_APP_NAME                                      │
│ Value: Mi Servidor MC                                   │
│ Environments: ☑ Production ☑ Preview ☑ Development     │
│                                                          │
│ Key: VITE_BACKEND_URL                                   │
│ Value: https://lightcode-backend.onrender.com          │
│ Environments: ☑ Production ☑ Preview ☑ Development     │
│                                                          │
│ Key: VITE_PLUGIN_COMMAND                                │
│ Value: shop                                             │
│ Environments: ☑ Production ☑ Preview ☑ Development     │
│                                                          │
│ Key: VITE_SHOW_FOOTER_BRANDING                          │
│ Value: false                                            │
│ Environments: ☑ Production ☑ Preview ☑ Development     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔗 Después del Despliegue

Una vez que Vercel termine de desplegar:

1. **Copia la URL de tu proyecto** (ej: `https://tu-proyecto.vercel.app`)

2. **Actualiza el backend en Render** con estas variables:
   ```env
   FRONTEND_URL=https://tu-proyecto.vercel.app
   CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
   ALLOWED_HOSTS=tu-backend.onrender.com,tu-proyecto.vercel.app
   ```

3. **Verifica que funcione:**
   - Abre `https://tu-proyecto.vercel.app`
   - Deberías ver la tienda funcionando
   - Ve a `/dashboard` para acceder al panel admin

---

## 🌐 Dominio Personalizado (Opcional)

### Agregar tu dominio en Vercel:

1. Ve a tu proyecto → **Settings** → **Domains**
2. Click en **Add Domain**
3. Ingresa tu dominio (ej: `tuservidor.com`)
4. Vercel te dará instrucciones para configurar DNS

### Configurar DNS:

Agrega estos registros en tu proveedor de DNS:

**Para dominio raíz (tuservidor.com):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**Para www (www.tuservidor.com):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Actualizar variables después de agregar dominio:

**En Vercel:**
```env
# No necesitas cambiar nada, Vercel maneja automáticamente
```

**En Render (Backend):**
```env
FRONTEND_URL=https://tuservidor.com
CORS_ALLOWED_ORIGINS=https://tuservidor.com,https://www.tuservidor.com
ALLOWED_HOSTS=api.tuservidor.com,tuservidor.com,www.tuservidor.com
```

---

## 🔧 Comandos Útiles

### Redesplegar manualmente:
```bash
# Desde tu terminal local
vercel --prod
```

### Ver logs en tiempo real:
```bash
vercel logs
```

### Ver información del proyecto:
```bash
vercel inspect
```

---

## 🐛 Solución de Problemas

### Error: "Failed to compile"
**Causa:** Error en el código o dependencias faltantes.
**Solución:** 
1. Revisa los logs de build en Vercel
2. Ejecuta `npm run build` localmente para reproducir el error
3. Verifica que todas las dependencias estén en `package.json`

### Error: "404 Not Found" en rutas
**Causa:** Vercel no está redirigiendo correctamente las rutas de React Router.
**Solución:** Asegúrate de que existe `vercel.json` con la configuración de rewrites.

### Frontend no se conecta al backend
**Causa:** `VITE_BACKEND_URL` incorrecta o CORS mal configurado.
**Solución:** 
1. Verifica que `VITE_BACKEND_URL` sea correcta (sin `/api` al final)
2. Verifica que el backend tenga `CORS_ALLOWED_ORIGINS` con la URL de Vercel
3. Abre la consola del navegador (F12) para ver errores específicos

### Cambios en variables de entorno no se reflejan
**Causa:** Vercel cachea el build anterior.
**Solución:** 
1. Ve a **Deployments** en Vercel
2. Click en el último deployment → **Redeploy**
3. Marca **Use existing Build Cache** como OFF

---

## 📊 Límites del Plan Gratuito

| Recurso | Límite Gratuito |
|---------|-----------------|
| Bandwidth | 100 GB/mes |
| Build Time | 100 horas/mes |
| Deployments | Ilimitados |
| Dominios | Ilimitados |
| Team Members | 1 (solo tú) |

**Nota:** Para proyectos en producción con tráfico alto, considera el plan Pro ($20/mes) que incluye 1 TB de bandwidth.

---

## ✅ Checklist de Despliegue

Antes de considerar el despliegue completo:

- [ ] Proyecto importado en Vercel
- [ ] Root Directory configurado a `LightCodeCore/frontend`
- [ ] Framework Preset configurado a Vite
- [ ] Variables de entorno agregadas
- [ ] Build exitoso (sin errores)
- [ ] Frontend accesible en la URL de Vercel
- [ ] Backend actualizado con URL del frontend
- [ ] CORS configurado correctamente
- [ ] Login funciona en `/dashboard`
- [ ] Tienda pública funciona
- [ ] Imágenes cargan correctamente
- [ ] (Opcional) Dominio personalizado configurado

---

## 🎯 Próximos Pasos

1. ✅ Configura el backend en Render (ver `GUIA_DESPLIEGUE_VERCEL_RENDER.md`)
2. ✅ Conecta frontend y backend actualizando variables
3. ✅ Configura PayPal webhook
4. ✅ Prueba el flujo completo de compra
5. ✅ Personaliza colores y logo desde el panel admin
6. ✅ Agrega productos y configura RCON
7. ✅ Cambia a producción (`PAYPAL_MODE=live`)

---

*¿Necesitas ayuda? Consulta la guía completa en `GUIA_DESPLIEGUE_VERCEL_RENDER.md`*

postgresql://usuario:password@host.neon.tech/neondb?sslmode=require