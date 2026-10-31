# Diseño del Header de Pedidos

## 📋 Descripción General

El header de la página de Pedidos utiliza un diseño premium ultra-dark con gradientes sutiles, efectos de brillo (glow) y una jerarquía visual clara. Está diseñado para integrarse perfectamente con el sistema de diseño global de LightCode.

---

## 🎨 Estructura Visual

```
┌─────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════╗   │
│ ║ [Línea superior brillante - 2px gradient]            ║   │
│ ╚═══════════════════════════════════════════════════════╝   │
│                                                             │
│  Pedidos                                    [🔲] [🔳]      │
│  Gestiona todas las órdenes de tu tienda                   │
│  en tiempo real                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Componentes del Header

### 1. **Contenedor Principal** (`.orders-header`)

#### Fondo con Gradiente Oscuro
```css
background: linear-gradient(135deg, 
  rgba(17, 17, 17, 0.95) 0%,    /* Negro mate suave */
  rgba(10, 10, 10, 0.98) 50%,   /* Negro profundo */
  rgba(5, 5, 5, 1) 100%          /* Negro absoluto */
);
```

**Propósito:** Crear profundidad y elegancia con una transición suave de tonos oscuros.

#### Borde con Brillo Sutil
```css
border: 1px solid rgba(255, 255, 255, 0.08);
```

**Color:** Blanco con 8% de opacidad  
**Efecto:** Contorno delicado que define el header sin ser intrusivo

#### Sombras Múltiples
```css
box-shadow: 
  0 4px 16px rgba(0, 0, 0, 0.6),              /* Sombra principal */
  0 2px 8px rgba(0, 0, 0, 0.4),               /* Sombra secundaria */
  inset 0 1px 0 rgba(255, 255, 255, 0.03);    /* Brillo interno superior */
```

**Capas:**
1. Sombra profunda para elevación
2. Sombra media para definición
3. Luz interna sutil en el borde superior

---

### 2. **Línea Superior Brillante** (`::before`)

```css
background: linear-gradient(90deg, 
  transparent 0%,
  rgba(255, 255, 255, 0.1) 20%,
  rgba(255, 255, 255, 0.15) 50%,   /* Punto más brillante */
  rgba(255, 255, 255, 0.1) 80%,
  transparent 100%
);
```

**Altura:** 2px  
**Posición:** Borde superior del header  
**Efecto:** Línea de luz que se desvanece en los extremos, creando un efecto premium

---

### 3. **Título Principal** (`h1`)

#### Gradiente de Texto
```css
background: linear-gradient(135deg, 
  #FFFFFF 0%,      /* Blanco puro */
  #EDEDED 50%,     /* Blanco suave */
  #D4D4D4 100%     /* Gris claro */
);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

**Técnica:** El texto se "rellena" con el gradiente usando `background-clip`

#### Sombra de Texto
```css
text-shadow: 0 2px 20px rgba(255, 255, 255, 0.1);
```

**Efecto:** Halo sutil que hace que el texto "brille"

#### Tipografía
- **Fuente:** Space Grotesk (moderna y geométrica)
- **Tamaño:** `var(--text-5xl)` (3rem / 48px)
- **Peso:** 700 (Bold)
- **Letter-spacing:** -0.02em (más compacto)

---

### 4. **Subtítulo** (`.orders-subtitle`)

```css
color: var(--text-secondary);  /* #7A7A7A - Gris medio */
font-size: var(--text-lg);     /* 1.125rem / 18px */
font-weight: 500;              /* Medium */
```

**Propósito:** Texto descriptivo secundario con menor jerarquía visual

---

### 5. **Botones de Vista** (`.view-mode-toggle`)

#### Contenedor
```css
background: rgba(17, 17, 17, 0.6);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
```

**Efecto:** Fondo oscuro semi-transparente con sombra interna (hundido)

#### Botón Normal
```css
color: var(--text-tertiary);  /* Gris apagado */
background: none;
```

#### Botón Hover
```css
color: var(--text-primary);
background: rgba(255, 255, 255, 0.05);
transform: translateY(-1px);
```

**Efecto:** Se ilumina y eleva ligeramente

#### Botón Activo
```css
color: #FFFFFF;
background: linear-gradient(135deg, 
  rgba(255, 255, 255, 0.12) 0%, 
  rgba(255, 255, 255, 0.08) 100%
);
box-shadow: 
  0 2px 8px rgba(255, 255, 255, 0.1),
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
```

**Efecto:** Gradiente blanco con glow y luz interna superior

#### Icono Activo
```css
filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
```

**Efecto:** Halo luminoso alrededor del icono

---

## 🎭 Estados Interactivos

### Header Hover
```css
border-color: rgba(255, 255, 255, 0.12);  /* Borde más brillante */
box-shadow: 
  0 8px 24px rgba(0, 0, 0, 0.7),
  0 4px 12px rgba(0, 0, 0, 0.5),
  inset 0 1px 0 rgba(255, 255, 255, 0.05),
  0 0 40px rgba(255, 255, 255, 0.02);      /* Glow ambiental */
```

**Efecto:** El header "respira" con más luz y elevación

---

## 🎨 Paleta de Colores Utilizada

### Colores Principales
| Color | Código | Uso |
|-------|--------|-----|
| **Negro Absoluto** | `#050505` | Fondo base |
| **Negro Mate** | `#111111` | Superficies |
| **Negro Profundo** | `#0A0A0A` | Variante alternativa |
| **Blanco Puro** | `#FFFFFF` | Texto principal, acentos |
| **Blanco Suave** | `#EDEDED` | Texto secundario |
| **Gris Claro** | `#D4D4D4` | Degradados de texto |
| **Gris Medio** | `#7A7A7A` | Texto terciario |

### Opacidades de Blanco
| Opacidad | Código | Uso |
|----------|--------|-----|
| **15%** | `rgba(255, 255, 255, 0.15)` | Línea superior (centro) |
| **12%** | `rgba(255, 255, 255, 0.12)` | Botón activo, borde hover |
| **10%** | `rgba(255, 255, 255, 0.1)` | Línea superior, sombras |
| **8%** | `rgba(255, 255, 255, 0.08)` | Bordes principales |
| **5%** | `rgba(255, 255, 255, 0.05)` | Hover sutil |
| **3%** | `rgba(255, 255, 255, 0.03)` | Luz interna |

### Opacidades de Negro
| Opacidad | Código | Uso |
|----------|--------|-----|
| **70%** | `rgba(0, 0, 0, 0.7)` | Sombra principal hover |
| **60%** | `rgba(0, 0, 0, 0.6)` | Sombra principal |
| **50%** | `rgba(0, 0, 0, 0.5)` | Sombra secundaria hover |
| **40%** | `rgba(0, 0, 0, 0.4)` | Sombra secundaria |
| **30%** | `rgba(0, 0, 0, 0.3)` | Sombra interna |

---

## 📐 Espaciado y Dimensiones

```css
padding: var(--space-8);           /* 2rem / 32px */
margin: 0 auto var(--space-6);     /* 0 auto 1.5rem */
max-width: 1600px;                 /* Ancho máximo */
border-radius: var(--radius-xl);   /* 1rem / 16px */
```

---

## ✨ Efectos Especiales

### 1. **Gradiente Diagonal**
- **Ángulo:** 135° (diagonal de esquina superior izquierda a inferior derecha)
- **Transición:** Suave entre 3 tonos de negro

### 2. **Glow Sutil**
- **Técnica:** Múltiples `box-shadow` con blur
- **Color:** Blanco con opacidad muy baja (2-10%)
- **Propósito:** Crear sensación de luz ambiental

### 3. **Inset Highlight**
- **Posición:** Borde superior interno
- **Efecto:** Simula luz reflejada desde arriba
- **Intensidad:** Muy sutil (3-5% opacidad)

### 4. **Text Gradient**
- **Técnica:** `background-clip: text`
- **Soporte:** Webkit (Chrome, Safari, Edge)
- **Fallback:** Color sólido blanco

---

## 🔧 Variables CSS Utilizadas

```css
/* Espaciado */
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-6: 1.5rem;
--space-8: 2rem;

/* Bordes */
--radius-xl: 1rem;
--radius-lg: 0.75rem;
--radius-md: 0.5rem;

/* Tipografía */
--text-5xl: 3rem;
--text-lg: 1.125rem;
--text-sm: 0.875rem;

/* Colores */
--text-primary: #EDEDED;
--text-secondary: #7A7A7A;
--text-tertiary: rgba(122, 122, 122, 0.6);
```

---

## 🎯 Principios de Diseño Aplicados

### 1. **Jerarquía Visual**
- Título grande con gradiente → Máxima atención
- Subtítulo gris medio → Información secundaria
- Botones pequeños → Acciones terciarias

### 2. **Profundidad**
- Múltiples capas de sombras
- Gradientes sutiles
- Efectos de luz interna

### 3. **Minimalismo Premium**
- Sin colores saturados
- Solo blanco, negro y grises
- Efectos sutiles pero perceptibles

### 4. **Consistencia**
- Usa variables CSS del sistema global
- Sigue la paleta ultra-dark establecida
- Mantiene el estilo de otros componentes

### 5. **Interactividad**
- Feedback visual en hover
- Transiciones suaves (0.2-0.3s)
- Estados claramente diferenciados

---

## 📱 Responsive (Futuro)

```css
@media (max-width: 1024px) {
  .orders-header {
    padding: var(--space-6);
  }
  
  .orders-header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .orders-header {
    padding: var(--space-4);
  }
  
  .orders-header-content h1 {
    font-size: var(--text-3xl);
  }
}
```

---

## 🚀 Mejoras Futuras Sugeridas

1. **Animación de entrada:** Fade-in + slide-up al cargar
2. **Micro-interacciones:** Pulso sutil en botones activos
3. **Modo claro:** Variante con fondo blanco y texto oscuro
4. **Accesibilidad:** Asegurar contraste WCAG AAA
5. **Performance:** Optimizar gradientes con `will-change`

---

## 📝 Notas de Implementación

- **Compatibilidad:** Chrome 88+, Firefox 85+, Safari 14+
- **Fallbacks:** Color sólido para navegadores sin soporte de gradientes en texto
- **Performance:** Usar `transform` en lugar de `top/left` para animaciones
- **Accesibilidad:** Mantener contraste mínimo 4.5:1 para texto

---

**Última actualización:** Mayo 2026  
**Diseñador:** Sistema LightCode Core  
**Versión:** 2.0
