/**
 * API Service - Comunicación con el backend
 */
import axios from 'axios';

// URL base de la API: 
const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const LOCAL_BACKEND_URL = 'http://localhost:8000';

// Función para determinar la URL base dinámicamente
const getBaseUrl = () => {
  // ¿Estamos ejecutando en entorno local?
  const isLocalHost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.endsWith('.local');

  // 1) Variables de entorno (prioridad), limpiando el sufijo /api si existe
  let envUrl = import.meta.env.VITE_BACKEND_URL || 
    (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : null);

  // 2) Si la envUrl apunta a localhost pero NO estamos en local, ignorarla y usar producción
  if (envUrl && !isLocalHost) {
    const looksLocal = /localhost|127\.0\.0\.1|^https?:\/\/(10\.|192\.168\.|.*\.local)/i.test(envUrl);
    if (looksLocal) {
      envUrl = null;
    }
  }

  // 3) Decidir URL final
  if (envUrl) return envUrl;
  return isLocalHost ? LOCAL_BACKEND_URL : DEFAULT_BACKEND_URL;
};

export const BACKEND_URL = getBaseUrl();
const API_URL = `${BACKEND_URL}/api/`;

// Helper para obtener CSRF token de las cookies
const getCsrfToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

// Crear instancia de axios
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Permitir envío de cookies
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

// Lógica Híbrida: Interceptor para manejar fallbacks dinámicos
// Si una petición a producción falla con 404 o Network Error y estamos en un entorno que podría ser local,
// intentamos redirigir la lógica si es necesario (o viceversa).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si la petición falló y es una tienda (slug) que dio 404 en producción,
    // pero el usuario está en localhost, podría ser que la tienda solo exista localmente.
    if (
      error.response?.status === 404 && 
      originalRequest.url.includes('/stores/slug/') &&
      BACKEND_URL === DEFAULT_BACKEND_URL &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      if (import.meta.env.DEV) {
        console.warn('Store not found in production, but you are on localhost. Attempting local fallback...');
      }
      const localUrl = `${LOCAL_BACKEND_URL}/api/${originalRequest.url.split('/api/')[1] || originalRequest.url}`;
      
      try {
        // Intentar la misma petición pero al local
        const localResponse = await axios({
          ...originalRequest,
          url: localUrl,
          baseURL: '', // Resetear para usar la URL completa
        });
        return localResponse;
      } catch (localErr) {
        // Si también falla en local, devolver el error original
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Helper para obtener la URL completa de una imagen/recurso media.
 * Si la URL ya es absoluta (Cloudinary, etc.), la devuelve tal cual.
 * Si es relativa, le antepone la URL del backend.
 */
export const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Asegurar que el path no empiece con / si el BACKEND_URL ya termina en /
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${BACKEND_URL}/${cleanPath}`;
};

// Interceptor para agregar token a todas las requests
api.interceptors.request.use(
  (config) => {
    // Agregar CSRF token si no está presente
    if (!config.headers['X-CSRFToken']) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    // CRITICAL: Don't send tokens to auth endpoints (login/register)
    const authEndpoints = [
      '/auth/buyer/login/',
      '/auth/buyer/register/',
      '/auth/seller/login/',
      '/auth/seller/register/',
      '/auth/admin/login/',
      '/auth/token/',
      '/auth/token/refresh/',
      '/auth/csrf/'
    ];
    const isAuthEndpoint = authEndpoints.some(endpoint => config.url.includes(endpoint));
    if (isAuthEndpoint) {
      // Don't send any authorization tokens to auth endpoints
      return config;
    }

    // 1. Determinar si es una request de comprador (tienda pública)
    // Buscamos patrones como /public/ o si el contexto indica que estamos en una tienda
    const isPublicRequest = config.url.includes('/public/') || 
                           config.url.includes('/stores/slug/') ||
                           config.url.includes('/cart/') ||
                           config.url.includes('/discounts/validate/');
    
    // Si la URL contiene /buyer/ o /cart/, es definitivamente para el comprador
    const isBuyerRequest = config.url.includes('/buyer/') || 
                          config.url.includes('/cart/') ||
                          config.url.includes('/discounts/validate/');

    if (isBuyerRequest || isPublicRequest) {
      // Intentar obtener el slug de la tienda desde la URL o el estado
      // Primero buscar /store/slug, si no existe buscar /slug
      let storeSlug = null;
      const storePrefixMatch = window.location.pathname.match(/\/store\/([^/]+)/);
      
      if (storePrefixMatch) {
        storeSlug = storePrefixMatch[1];
      } else {
        // Ignorar rutas conocidas del dashboard y sistema
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const dashboardPaths = ['dashboard', 'login', 'register', 'admin', 'profile', 'settings', 'plan'];
        if (pathParts.length > 0 && !dashboardPaths.includes(pathParts[0].toLowerCase())) {
          storeSlug = pathParts[0];
        }
      }

      // Si no encontramos slug en la URL, intentar obtenerlo de localStorage (white-label)
      if (!storeSlug) {
        storeSlug = localStorage.getItem('whitelabel_store_slug');
      }

      if (storeSlug) {
        const normalizedSlug = storeSlug.toLowerCase();
        // ALWAYS set the X-Store-Slug header for buyer/public requests
        config.headers['X-Store-Slug'] = normalizedSlug;
        
        // Try both normalized and original case for buyer token
        const buyerToken = localStorage.getItem(`buyer_token_${normalizedSlug}`) || 
                          localStorage.getItem(`buyer_token_${storeSlug}`);
        if (buyerToken) {
          config.headers['X-Buyer-Token'] = buyerToken;
          config.headers.Authorization = `Bearer ${buyerToken}`;
        }
        // For public requests, don't add seller token - return early
        return config;
      } else if (isBuyerRequest) {
        // Si es una request de buyer/cart pero no encontramos el slug, loguear advertencia en desarrollo
        if (import.meta.env.DEV) {
          console.warn('[API] Buyer/cart request without store slug detected. URL:', window.location.pathname);
        }
      }
      
      // For truly public requests (like /api/stores/public/), don't add any token
      if (isPublicRequest && !isBuyerRequest) {
        return config;
      }
    }

    // 2. Default: Token del vendedor o admin
    const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Si estamos enviando FormData, dejar que el navegador establezca el boundary
    if (config.data instanceof FormData) {
      if (config.headers && config.headers['Content-Type']) {
        delete config.headers['Content-Type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores y refresh token
api.interceptors.response.use(
  (response) => {
    // Si el backend nos dice que refrescó el token en la cookie,
    // podemos reintentar o simplemente dejar que siga.
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Suppress 404 errors for discount validation endpoint (feature not implemented)
    if (error.response?.status === 404 && originalRequest.url?.includes('discounts/validate')) {
      // Return a formatted response instead of throwing
      return Promise.resolve({
        status: 404,
        data: {
          error: 'Sistema de cupones no disponible',
          details: {
            code: 'FEATURE_NOT_AVAILABLE',
            reason: 'El sistema de cupones aún no está implementado'
          }
        }
      });
    }

    // Si el token expiró (401) o no está autorizado (403)
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      // NO redirigir si estamos en una tienda pública - las tiendas deben funcionar sin autenticación
      const isStoreRoute = window.location.pathname.startsWith('/store/');
      
      // Suppress 401 errors for buyer/me endpoint when not logged in (expected behavior)
      if (error.response?.status === 401 && originalRequest.url?.includes('/buyer/me')) {
        // Silently fail - this is expected when buyer is not logged in
        return Promise.reject(error);
      }
      
      // Suppress 401 errors for cart endpoint when not logged in (expected behavior for anonymous users)
      if (error.response?.status === 401 && originalRequest.url?.includes('/cart/')) {
        // Check if we have a buyer token that might be expired
        const storeSlug = localStorage.getItem('whitelabel_store_slug');
        const buyerToken = storeSlug ? localStorage.getItem(`buyer_token_${storeSlug}`) : null;
        const buyerRefresh = storeSlug ? localStorage.getItem(`buyer_refresh_${storeSlug}`) : null;
        
        // If we have tokens, try to refresh
        if (buyerToken && buyerRefresh && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const response = await axios.post(`${API_URL}auth/token/refresh/`, {
              refresh: buyerRefresh,
            });

            const { access } = response.data;
            localStorage.setItem(`buyer_token_${storeSlug}`, access);

            // Update headers and retry
            originalRequest.headers['X-Buyer-Token'] = access;
            originalRequest.headers.Authorization = `Bearer ${access}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Refresh failed, clear tokens and use anonymous cart
            localStorage.removeItem(`buyer_token_${storeSlug}`);
            localStorage.removeItem(`buyer_refresh_${storeSlug}`);
            return Promise.reject(error);
          }
        }
        
        // Silently fail - this is expected when user is not logged in
        // The CartContext will handle this by using localStorage
        return Promise.reject(error);
      }
      
      // Si el header X-Token-Refreshed está presente, significa que el middleware
      // ya intentó un refresh y falló o que acaba de refrescar la cookie.
      if (error.response.headers['x-token-refreshed'] === 'true') {
        originalRequest._retry = true;
        // Reintentar la petición original, ahora debería tener la nueva cookie
        return api(originalRequest);
      }

      // Si es un 403 y no es por token expirado, probablemente sea falta de permisos real
      if (error.response?.status === 403) {
        // Endpoints públicos de auth — no redirigir
        const publicAuthRoutes = ['resend-verification', 'verify-email', 'seller/login', 'seller/register', 'buyer/login', 'buyer/register'];
        const isPublicAuth = publicAuthRoutes.some(r => originalRequest.url?.includes(r));
        if (isPublicAuth) return Promise.reject(error);

        // Endpoints del mod — no cerrar sesión
        if (originalRequest.url?.includes('/mc/')) return Promise.reject(error);

        // NO redirigir si estamos en una tienda pública
        if (isStoreRoute) {
          return Promise.reject(error);
        }

        // Solo redirigir a login si estamos en el dashboard
        if (window.location.pathname.startsWith('/dashboard')) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('seller_profile');
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const authRoutes = [
        'auth/seller/login/', 'auth/seller/register/', 'auth/buyer/login/', 'auth/buyer/register/',
        'users/auth/seller/login/', 'users/auth/seller/register/', 'users/auth/buyer/login/', 'users/auth/buyer/register/',
      ];
      const isAuthRoute = authRoutes.some(route => originalRequest.url?.includes(route));
      if (isAuthRoute) return Promise.reject(error);

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        // Rutas que son públicas y NO deberían redirigir a login ni fallar por token inválido
        const publicRoutes = ['stores/slug/', 'categories/', 'products/', 'cart/', 'buyer/'];
        const isPublicRoute = publicRoutes.some(route => originalRequest.url?.includes(route));

        if (!refreshToken) {
          // No hay refresh token
          if (isPublicRoute || isStoreRoute) {
            // Si es ruta pública o estamos en una tienda, reintentar SIN token
            delete originalRequest.headers.Authorization;
            if (originalRequest.headers['X-Buyer-Token']) {
              delete originalRequest.headers['X-Buyer-Token'];
            }
            return api(originalRequest);
          }
          // No es pública, limpiar y redirigir SOLO si estamos en dashboard
          localStorage.removeItem('access_token');
          if (window.location.pathname.startsWith('/dashboard')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_URL}auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        if (isPublicRoute || isStoreRoute) {
          // Si es ruta pública o estamos en una tienda, reintentar SIN token una última vez
          delete originalRequest.headers.Authorization;
          if (originalRequest.headers['X-Buyer-Token']) {
            delete originalRequest.headers['X-Buyer-Token'];
          }
          return api(originalRequest);
        }
        
        // Solo redirigir a login si estamos en dashboard
        if (window.location.pathname.startsWith('/dashboard')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ============= AUTH =============

export const authAPI = {
  // Get CSRF token
  getCsrfToken: () => api.get('users/auth/csrf/'),
  
  // Seller
  registerSeller: (data) => api.post('users/auth/seller/register/', data),
  loginSeller: (data) => api.post('users/auth/seller/login/', data),
  
  // Buyer (Store context)
  registerBuyer: (data) => api.post('users/auth/buyer/register/', data),
  loginBuyer: (data) => api.post('users/auth/buyer/login/', data),
  getBuyerMe: () => api.get('users/auth/buyer/me/'),
  
  // Common
  getCurrentUser: () => api.get('users/auth/me/'),
  logout: () => api.post('users/auth/logout/'),
  selectSubscription: (subscriptionType) => api.post('users/auth/select-subscription/', { subscription_type: subscriptionType }),
  verifyEmail: (email, code) => api.post('users/auth/verify-email/', { email, code }),
  resendVerification: (email) => api.post('users/auth/resend-verification/', { email }),
};

// ============= BUYERS =============

export const buyersAPI = {
  updateProfile: (data) => api.patch('users/auth/buyer/profile/', data),
  changePassword: (data) => api.post('users/auth/buyer/change-password/', data),
  updateSettings: (data) => api.patch('users/auth/buyer/settings/', data),
  getOrders: (params) => api.get('users/auth/buyer/orders/', { params }),
};

// ============= STORES =============

export const storesAPI = {
  // CRUD básico
  list: () => api.get('stores/django/'),  // Usando endpoint Django temporal
  myStores: () => api.get('stores/my-stores/'),
  get: (id) => api.get(`stores/${id}/`),
  getById: (id) => api.get(`stores/${id}/`), // Para edición
  getBySlug: (slug) => api.get(`stores/slug/${slug.toLowerCase()}/`),
  create: (data) => {
    // Si hay archivos, usar FormData
    if (data.logo_file || data.banner_file) {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (value !== null && value !== undefined && value !== '') {
          if (key === 'logo_file' || key === 'banner_file') {
            if (value instanceof File || value instanceof Blob) {
              formData.append(key, value);
            }
          } else {
            formData.append(key, value);
          }
        }
      });
      return api.post('stores/django/create/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('stores/django/create/', data);
  },
  update: (id, data) => {
    if (data.logo_file || data.banner_file || data.remove_logo || data.remove_banner) {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (key === 'remove_logo' || key === 'remove_banner') {
          if (value === true) {
            formData.append(key, 'true');
          }
        } else if (value !== null && value !== undefined && value !== '') {
          if (key === 'logo_file' || key === 'banner_file') {
            if (value instanceof File || value instanceof Blob) {
              formData.append(key, value);
            }
          } else {
            formData.append(key, value);
          }
        }
      });
      return api.patch(`stores/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.patch(`stores/${id}/`, data);
  },
  delete: (id) => api.delete(`stores/${id}/`),
  restore: (id) => api.post(`stores/${id}/restore/`),
  
  getStats: (id) => api.get(`stores/${id}/stats/`),
  getSettings: (id) => api.get(`stores/${id}/settings/`),
  updateSettings: (id, data) => api.patch(`stores/${id}/settings/`, data),
  
  verify: (id) => api.post(`stores/${id}/verify/`),
  suspend: (id) => api.post(`stores/${id}/suspend/`),
  
  // RCON Configuration
  rcon: {
    getConfig: (storeId) => api.get(`stores/${storeId}/rcon/`),
    testConnection: (storeId, data) => api.post(`stores/${storeId}/rcon/test/`, data),
    saveConfig: (storeId, data) => api.post(`stores/${storeId}/rcon/save/`, data),
    deleteConfig: (storeId) => api.delete(`stores/${storeId}/rcon/delete/`),
    executeCommand: (storeId, data) => api.post(`stores/${storeId}/rcon/execute/`, data),
    testDelivery: (storeId, data) => api.post(`stores/${storeId}/rcon/test-delivery/`, data),
  },
  
  // PayPal Configuration
  paypal: {
    getConfig: (storeId) => api.get(`stores/${storeId}/paypal/`),
    saveConfig: (storeId, data) => api.post(`stores/${storeId}/paypal/`, data),
  },
};

// ============= PRODUCTS =============

export const productsAPI = {
  list: (params) => api.get(`products/`, { params }),
  listByStore: (storeId, params) => api.get(`stores/${storeId}/products/`, { params }),
  get: (storeId, id) => api.get(`stores/${storeId}/products/${id}/`),
  getBySlug: (productSlug, storeSlug) => api.get(`products/${productSlug.toLowerCase()}/`, { params: { store_slug: storeSlug.toLowerCase() } }),
  create: (storeId, data) => api.post(`stores/${storeId}/products/`, data),
  update: (storeId, id, data) => api.patch(`stores/${storeId}/products/${id}/`, data),
  delete: (storeId, id) => api.delete(`stores/${storeId}/products/${id}/`),
};

// ============= ORDERS =============

export const ordersAPI = {
  list: (storeId, params) => api.get(`stores/${storeId}/orders/`, { params }),
  get: (storeId, id) => api.get(`stores/${storeId}/orders/${id}/`),
  updateStatus: (storeId, id, status) => 
    api.patch(`stores/${storeId}/orders/${id}/`, { status }),
  retryRcon: (orderId) => api.post(`orders/${orderId}/retry_rcon/`),
  processPendingRconJobs: () => api.post('orders/process-pending-rcon-jobs/'),
};

// ============= CART =============

export const cartAPI = {
  get: (storeSlug = null) => {
    const config = storeSlug ? { headers: { 'X-Store-Slug': storeSlug } } : {};
    return api.get('cart/', config);
  },
  addItem: (productId, quantity = 1, storeSlug = null) => {
    const config = storeSlug ? { headers: { 'X-Store-Slug': storeSlug } } : {};
    return api.post('cart/add/', { product_id: productId, quantity }, config);
  },
  updateItem: (productId, quantity, storeSlug = null) => {
    const config = storeSlug ? { headers: { 'X-Store-Slug': storeSlug } } : {};
    return api.patch('cart/update-item/', { product_id: productId, quantity }, config);
  },
  removeItem: (productId, storeSlug = null) => {
    const config = storeSlug ? { 
      params: { product_id: productId },
      headers: { 'X-Store-Slug': storeSlug }
    } : { params: { product_id: productId } };
    return api.delete('cart/remove-item/', config);
  },
  clear: (storeSlug = null) => {
    const config = storeSlug ? { headers: { 'X-Store-Slug': storeSlug } } : {};
    return api.delete('cart/clear/', config);
  },
};

// ============= DISCOUNTS =============

export const discountsAPI = {
  list: (storeId, params) => api.get(`discounts/`, { params: { store: storeId, ...params } }),
  get: (id) => api.get(`discounts/${id}/`),
  create: (data) => api.post(`discounts/`, data),
  update: (id, data) => api.patch(`discounts/${id}/`, data),
  delete: (id) => api.delete(`discounts/${id}/`),
  validate: (code, cartTotal, cartItemsCount, cartProducts = [], storeSlug = null) => {
    const config = {};
    // If storeSlug is provided, add it as a header
    if (storeSlug) {
      config.headers = { 'X-Store-Slug': storeSlug.toLowerCase() };
    }
    // The interceptor will handle 404 errors gracefully
    return api.post(`discounts/validate/`, { 
      code, 
      cart_total: cartTotal, 
      cart_items_count: cartItemsCount,
      cart_products: cartProducts
    }, config);
  },
  bulkGenerate: (data) => api.post(`discounts/bulk-generate/`, data),
};

// ============= CATEGORIES =============

export const categoriesAPI = {
  list: (storeId) => api.get(`categories/`, { params: { store: storeId } }),
};

// ============= IMAGES =============

export const imagesAPI = {
  uploadProduct: (formData) => {
    return api.post('images/product/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadAvatar: (formData) => {
    return api.post('images/avatar/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadStoreLogo: (formData) => {
    return api.post('images/store-logo/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadStoreBanner: (formData) => {
    return api.post('images/store-banner/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (publicId) => api.delete(`images/${publicId}/`),
};

// ============= ADMIN TOOLS =============

export const adminAPI = {
  rcon: {
    testConnection: (config) => api.post('admin/rcon/test-connection/', config, {
      validateStatus: (status) => status >= 200 && status < 600, // Accept all responses
    }),
    executeCommand: (data) => api.post('admin/rcon/execute/', data, {
      validateStatus: (status) => status >= 200 && status < 600,
    }),
    stressTest: (data) => api.post('admin/rcon/stress-test/', data, {
      validateStatus: (status) => status >= 200 && status < 600,
    }),
    batchExecute: (data) => api.post('admin/rcon/batch/', data, {
      validateStatus: (status) => status >= 200 && status < 600,
    }),
    checkPlayer: (data) => api.post('admin/rcon/check-player/', data, {
      validateStatus: (status) => status >= 200 && status < 600,
    }),
    testDelivery: (data) => api.post('admin/rcon/test-delivery/', data, {
      validateStatus: (status) => status >= 200 && status < 600,
    }),
    getSession: () => api.get('admin/rcon/session/'),
    clearSession: () => api.delete('admin/rcon/session/'),
  },
};

export default api;
