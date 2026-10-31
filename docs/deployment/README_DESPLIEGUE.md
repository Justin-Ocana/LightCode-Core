# 🚀 Despliegue de LightCode Core en Vercel + Render

Esta carpeta contiene toda la documentación necesaria para desplegar **LightCode Core** usando **Vercel** (frontend) y **Render** (backend).

---

## 📚 Documentación Disponible

Hemos creado **7 documentos** diferentes para cubrir todos los casos de uso:

### 🎯 Para Principiantes:
- **[GUIA_DESPLIEGUE_VERCEL_RENDER.md](GUIA_DESPLIEGUE_VERCEL_RENDER.md)** - Guía completa paso a paso (⭐ Empieza aquí)
- **[CHECKLIST_DESPLIEGUE.md](CHECKLIST_DESPLIEGUE.md)** - Lista de verificación interactiva

### 📖 Guías Visuales:
- **[CONFIGURACION_VERCEL_VISUAL.md](CONFIGURACION_VERCEL_VISUAL.md)** - Cómo llenar el formulario de Vercel
- **[CONFIGURACION_RENDER_VISUAL.md](CONFIGURACION_RENDER_VISUAL.md)** - Cómo llenar los formularios de Render

### ⚡ Guías Rápidas:
- **[VERCEL_QUICKSTART.md](VERCEL_QUICKSTART.md)** - Solo frontend (Vercel)
- **[RENDER_QUICKSTART.md](RENDER_QUICKSTART.md)** - Solo backend (Render)

### 📄 Referencia:
- **[RESUMEN_CONFIGURACION.md](RESUMEN_CONFIGURACION.md)** - Todos los valores en un solo lugar

### 📑 Índice:
- **[INDICE_DESPLIEGUE.md](INDICE_DESPLIEGUE.md)** - Índice completo de toda la documentación

---

## 🎯 ¿Por dónde empezar?

### Si es tu primera vez:
```
1. Lee: GUIA_DESPLIEGUE_VERCEL_RENDER.md
2. Usa: CHECKLIST_DESPLIEGUE.md mientras despliegas
3. Consulta: CONFIGURACION_VERCEL_VISUAL.md y CONFIGURACION_RENDER_VISUAL.md
```

### Si ya sabes lo que haces:
```
1. Abre: RESUMEN_CONFIGURACION.md
2. Copia y pega los valores
```

### Si solo necesitas una parte:
```
Frontend: VERCEL_QUICKSTART.md
Backend: RENDER_QUICKSTART.md
```

---

## 📋 Resumen del Proceso

### 1️⃣ Preparación (10 minutos)
- Crear cuentas en Vercel y Render
- Obtener credenciales de Cloudinary y PayPal
- Preparar repositorio Git

### 2️⃣ Backend en Render (30-40 minutos)
- Crear PostgreSQL Database
- Crear Redis Instance
- Crear Web Service (Backend)
- Crear Background Worker (Celery)
- Crear Cron Job (Celery Beat)
- Ejecutar migraciones

### 3️⃣ Frontend en Vercel (10-15 minutos)
- Importar repositorio
- Configurar proyecto
- Agregar variables de entorno
- Desplegar

### 4️⃣ Conexión (5 minutos)
- Actualizar variables en Render
- Actualizar variables en Vercel
- Verificar conexión

### 5️⃣ Post-Configuración (15-20 minutos)
- Configurar PayPal Webhook
- Verificar funcionalidad
- Configurar RCON (opcional)

**Tiempo total estimado: 1-2 horas**

---

## 💰 Costos

### Plan Gratuito (Desarrollo):
```
✅ Vercel: Gratis
✅ Render PostgreSQL: Gratis (expira en 90 días)
✅ Render Redis: Gratis
✅ Render Web Service: Gratis (se duerme después de 15 min)
✅ Cloudinary: Gratis

Total: $0/mes
```

### Plan Producción (Recomendado):
```
💰 Vercel Pro: $20/mes
💰 Render PostgreSQL: $7/mes
💰 Render Redis: $10/mes
💰 Render Web Service: $7/mes
💰 Render Worker: $7/mes

Total: $51/mes
```

---

## 🔑 Credenciales Necesarias

Antes de empezar, necesitas:

### Cloudinary (Gratis):
- Cloud Name
- API Key
- API Secret
- Obtén en: https://cloudinary.com/console

### PayPal (Gratis):
- Client ID
- Client Secret
- Webhook ID (se obtiene después)
- Obtén en: https://developer.paypal.com

### Gmail (Opcional):
- Email
- App Password
- Obtén en: https://myaccount.google.com/apppasswords

---

## 📊 Arquitectura del Despliegue

```
┌─────────────────────────────────────────────────────────┐
│                        VERCEL                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Frontend (React + Vite)                   │ │
│  │  - Tienda pública                                 │ │
│  │  - Panel de administración                        │ │
│  │  - Dashboard                                      │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                        RENDER                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Web Service (Django + Daphne)             │ │
│  │  - API REST                                       │ │
│  │  - WebSockets                                     │ │
│  │  - Autenticación                                  │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Background Worker (Celery)                │ │
│  │  - Procesamiento de tareas RCON                   │ │
│  │  - Entregas automáticas                           │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Cron Job (Celery Beat)                    │ │
│  │  - Scheduler de tareas periódicas                 │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│  ┌─────────────┐    ┌─────────────┐                   │
│  │ PostgreSQL  │    │   Redis     │                   │
│  │  Database   │    │   Cache     │                   │
│  └─────────────┘    └─────────────┘                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  SERVICIOS EXTERNOS                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Cloudinary  │  │   PayPal    │  │    Gmail    │   │
│  │  Imágenes   │  │    Pagos    │  │   Emails    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist Rápido

### Antes de empezar:
- [ ] Cuenta en Vercel
- [ ] Cuenta en Render
- [ ] Credenciales de Cloudinary
- [ ] Credenciales de PayPal
- [ ] Repositorio Git

### Backend (Render):
- [ ] PostgreSQL Database creada
- [ ] Redis Instance creada
- [ ] Web Service desplegado
- [ ] Background Worker desplegado
- [ ] Cron Job creado
- [ ] Migraciones ejecutadas
- [ ] Superusuario creado

### Frontend (Vercel):
- [ ] Proyecto importado
- [ ] Variables de entorno configuradas
- [ ] Despliegue exitoso

### Conexión:
- [ ] Variables actualizadas en Render
- [ ] Variables actualizadas en Vercel
- [ ] Login funciona
- [ ] Dashboard carga

### Post-Configuración:
- [ ] PayPal Webhook configurado
- [ ] Productos se pueden crear
- [ ] Imágenes se suben
- [ ] Compra de prueba exitosa

---

## 🐛 Problemas Comunes

### "Application failed to respond"
**Solución:** Verifica que el Start Command use `$PORT`

### "CORS policy error"
**Solución:** Verifica `CORS_ALLOWED_ORIGINS` en Render

### "502 Bad Gateway"
**Solución:** Revisa los logs en Render, puede ser falta de memoria

### "Frontend no se conecta"
**Solución:** Verifica `VITE_BACKEND_URL` en Vercel

### "Imágenes no se suben"
**Solución:** Verifica credenciales de Cloudinary

### "PayPal no funciona"
**Solución:** Verifica credenciales y webhook

---

## 📞 Soporte


---

## 🎉 ¡Listo!

Una vez que completes el despliegue:

1. ✅ Tu tienda estará en línea 24/7
2. ✅ Podrás vender productos automáticamente
3. ✅ Los pagos llegarán directo a tu PayPal
4. ✅ Las entregas RCON serán automáticas
5. ✅ Tendrás un panel admin completo

---

## 📚 Más Información

Para información detallada sobre cada paso, consulta:

- **Guía completa:** [GUIA_DESPLIEGUE_VERCEL_RENDER.md](GUIA_DESPLIEGUE_VERCEL_RENDER.md)
- **Índice completo:** [INDICE_DESPLIEGUE.md](INDICE_DESPLIEGUE.md)
- **Checklist:** [CHECKLIST_DESPLIEGUE.md](CHECKLIST_DESPLIEGUE.md)

---

*Desarrollado por LightCode • Hecho para la comunidad de Minecraft*
