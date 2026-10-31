# 📝 Configuración Visual para Vercel

Esta guía te muestra **exactamente** qué poner en cada campo del formulario de Vercel.

---

## 🎯 Paso 1: Import Git Repository

Cuando hagas click en **"Add New... → Project"** en Vercel:

```
┌────────────────────────────────────────────────────────────┐
│  Import Git Repository                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Select your Git provider:                                 │
│  ○ GitHub    ○ GitLab    ○ Bitbucket                      │
│                                                             │
│  Select repository:                                        │
│  🔍 Search repositories...                                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ✓ tu-usuario/lightcode-core                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  [Import] ←── Click aquí                                   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Paso 2: Configure Project

Después de importar, verás este formulario:

```
┌────────────────────────────────────────────────────────────┐
│  Configure Project                                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Project Name                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ lightcode-frontend                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│  (Puedes cambiarlo a lo que quieras)                      │
│                                                             │
│  Framework Preset                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Vite                                    ▼             │ │ ← IMPORTANTE
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  Root Directory                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ LightCodeCore/frontend                  [Edit]        │ │ ← IMPORTANTE
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  Build and Output Settings                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Build Command                                         │ │
│  │ npm run build                                         │ │ ← Automático
│  │                                                        │ │
│  │ Output Directory                                      │ │
│  │ dist                                                  │ │ ← Automático
│  │                                                        │ │
│  │ Install Command                                       │ │
│  │ npm install                                           │ │ ← Automático
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  Environment Variables                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [Add Environment Variables] ←── Click aquí           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  [Deploy] ←── Click aquí cuando termines                   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Paso 3: Add Environment Variables

Cuando hagas click en **"Add Environment Variables"**:

```
┌────────────────────────────────────────────────────────────┐
│  Environment Variables                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Variable 1:                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Key                                                   │ │
│  │ VITE_APP_NAME                                         │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Value                                                 │ │
│  │ Mi Servidor MC                                        │ │
│  └──────────────────────────────────────────────────────┘ │
│  Environments:                                             │
│  ☑ Production  ☑ Preview  ☑ Development                   │
│                                                             │
│  ─────────────────────────────────────────────────────────│
│                                                             │
│  Variable 2:                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Key                                                   │ │
│  │ VITE_BACKEND_URL                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Value                                                 │ │
│  │ https://lightcode-backend.onrender.com                │ │
│  └──────────────────────────────────────────────────────┘ │
│  Environments:                                             │
│  ☑ Production  ☑ Preview  ☑ Development                   │
│                                                             │
│  ⚠️ IMPORTANTE: Reemplaza con la URL real de tu backend   │
│                                                             │
│  ─────────────────────────────────────────────────────────│
│                                                             │
│  Variable 3:                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Key                                                   │ │
│  │ VITE_PLUGIN_COMMAND                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Value                                                 │ │
│  │ shop                                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  Environments:                                             │
│  ☑ Production  ☑ Preview  ☑ Development                   │
│                                                             │
│  ─────────────────────────────────────────────────────────│
│                                                             │
│  Variable 4:                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Key                                                   │ │
│  │ VITE_SHOW_FOOTER_BRANDING                             │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Value                                                 │ │
│  │ false                                                 │ │
│  └──────────────────────────────────────────────────────┘ │
│  Environments:                                             │
│  ☑ Production  ☑ Preview  ☑ Development                   │
│                                                             │
│  [Save] ←── Click aquí                                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Resumen de Valores

Copia y pega estos valores exactos:

### Framework Preset:
```
Vite
```

### Root Directory:
```
LightCodeCore/frontend
```

### Build Command:
```
npm run build
```

### Output Directory:
```
dist
```

### Install Command:
```
npm install
```

### Environment Variables:

| Key | Value | Environments |
|-----|-------|--------------|
| `VITE_APP_NAME` | `Mi Servidor MC` | Production, Preview, Development |
| `VITE_BACKEND_URL` | `https://tu-backend.onrender.com` | Production, Preview, Development |
| `VITE_PLUGIN_COMMAND` | `shop` | Production, Preview, Development |
| `VITE_SHOW_FOOTER_BRANDING` | `false` | Production, Preview, Development |

---

## ⚠️ Errores Comunes

### ❌ Error: "No Build Output"

**Causa:** Root Directory incorrecto.

**Solución:** Asegúrate de que Root Directory sea exactamente:
```
LightCodeCore/frontend
```

### ❌ Error: "Module not found"

**Causa:** Dependencias no instaladas correctamente.

**Solución:** Verifica que Install Command sea:
```
npm install
```

### ❌ Error: "404 Not Found" en rutas

**Causa:** Falta configuración de rewrites.

**Solución:** Asegúrate de que existe el archivo `vercel.json` en `LightCodeCore/frontend/`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## ✅ Verificación Final

Después de desplegar, verifica:

1. ✅ Build completado sin errores
2. ✅ Deployment exitoso
3. ✅ URL del proyecto accesible
4. ✅ Página principal carga correctamente
5. ✅ Dashboard accesible en `/dashboard`
6. ✅ No hay errores en la consola del navegador (F12)

---

## 🔗 Siguiente Paso

Una vez que tu frontend esté desplegado:

1. **Copia la URL** de tu proyecto (ej: `https://lightcode-frontend.vercel.app`)

2. **Ve a Render** y actualiza estas variables en tu **Web Service**:
   ```env
   FRONTEND_URL=https://lightcode-frontend.vercel.app
   CORS_ALLOWED_ORIGINS=https://lightcode-frontend.vercel.app
   ALLOWED_HOSTS=lightcode-backend.onrender.com,lightcode-frontend.vercel.app
   ```

3. **Prueba la conexión:**
   - Abre tu frontend
   - Ve a `/dashboard`
   - Intenta iniciar sesión
   - Si funciona, ¡todo está conectado correctamente! 🎉

---

*¿Necesitas más ayuda? Consulta `GUIA_DESPLIEGUE_VERCEL_RENDER.md` para la guía completa.*
