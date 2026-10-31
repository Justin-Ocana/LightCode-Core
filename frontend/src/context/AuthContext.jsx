/**
 * Auth Context - Manejo global de autenticación
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sellerProfile, setSellerProfile] = useState(null);

  // Verificar si hay sesión al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Solo intentar cargar si hay un token de acceso guardado
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    // Intentar obtener el usuario actual. 
    try {
      const response = await authAPI.getCurrentUser();
      const userData = response.data.user;
      
      // Solo consideramos autenticado aquí si es un vendedor (contexto del panel)
      // Los compradores se manejan en BuyerContext
      if (userData.user_type === 'seller' || userData.user_type === 'admin') {
        setUser(userData);
        setIsAuthenticated(true);
        
        if (response.data.seller_profile) {
          localStorage.setItem('seller_profile', JSON.stringify(response.data.seller_profile));
          setSellerProfile(response.data.seller_profile);
        }
        
        // Limpiar el email pendiente de verificación si existe
        localStorage.removeItem('pending_verification_email');
      } else {
        // Es un buyer, no lo marcamos como autenticado en el contexto de vendedor
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    } catch (error) {
      // Solo limpiar si no es un error de "no autenticado" (para evitar logs ruidosos)
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        console.error('Auth check failed:', error);
      }
      
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('seller_profile');
      localStorage.removeItem('pending_verification_email');
      
      // Si estamos en una ruta de dashboard y falla el auth, forzar recarga/login
      // NO redirigir si ya estamos en login o register
      if (window.location.pathname.startsWith('/dashboard')) {
        window.location.href = '/admin/login?reason=session_expired';
      }
      
      setLoading(false);
    }
  };

  const loginSeller = async (credentials) => {
    try {
      // Primero obtener el CSRF token
      try {
        await authAPI.getCsrfToken();
      } catch (csrfError) {
        console.warn('Failed to get CSRF token, continuing anyway:', csrfError);
      }
      
      const response = await authAPI.loginSeller(credentials);
      const { user, tokens, seller_profile } = response.data;
      
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      
      // Guardar seller_profile si existe
      if (seller_profile) {
        localStorage.setItem('seller_profile', JSON.stringify(seller_profile));
        setSellerProfile(seller_profile);
      }
      
      setUser(user);
      setIsAuthenticated(true);
      
      toast.success(`¡Bienvenido, ${user.username}!`);
      return { success: true };
    } catch (error) {
      const errorData = error.response?.data;
      let message = 'Error al iniciar sesión';
      let field = 'general';
      let code = null;
      let email = null;

      if (errorData?.error) {
        if (typeof errorData.error === 'object') {
          message = errorData.error.message || message;
        } else {
          message = errorData.error;
        }
      }

      if (errorData?.field) field = errorData.field;
      if (errorData?.code) code = errorData.code;
      if (errorData?.email) email = errorData.email;
      
      // Si el error es por email no verificado, guardar los tokens de todas formas
      if (code === 'email_not_verified' && error.response?.status === 403) {
        // El usuario existe y la contraseña es correcta, solo falta verificar email
        // No guardamos tokens porque el backend no los devuelve en este caso
        return { success: false, error: message, field, code, email, needsVerification: true };
      }
      
      return { success: false, error: message, field, code, email };
    }
  };

  const registerSeller = async (data) => {
    try {
      // Primero obtener el CSRF token
      try {
        await authAPI.getCsrfToken();
      } catch (csrfError) {
        console.warn('Failed to get CSRF token, continuing anyway:', csrfError);
      }
      
      const response = await authAPI.registerSeller(data);
      const { user, tokens } = response.data;
      
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      
      setUser(user);
      setIsAuthenticated(true);
      
      toast.success('¡Cuenta creada exitosamente!');
      return {
        success: true,
        emailVerificationRequired: response.data.email_verification_required || false,
        email: user.email,
      };
    } catch (error) {
      const errorData = error.response?.data;
      let message = 'Error al registrarse';
      
      if (errorData?.error) {
        if (typeof errorData.error === 'object') {
          message = errorData.error.message || message;
        } else {
          message = errorData.error;
        }
      }

      return { 
        success: false, 
        error: message,
        errors: errorData?.errors
      };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Limpiar TODOS los datos de autenticación y stores
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('seller_profile');
      localStorage.removeItem('active_store_slug'); // CRÍTICO: Limpiar tienda activa
      localStorage.removeItem('stores'); // Limpiar cache de tiendas si existe
      
      // Limpiar sessionStorage (incluye el modal de Early Access)
      sessionStorage.clear();
      
      setUser(null);
      setIsAuthenticated(false);
      setSellerProfile(null);
      
      // Redirigir a login inmediatamente
      window.location.href = '/login';
      
      toast.success('Sesión cerrada');
    }
  };

  const getSellerProfile = () => {
    const profile = localStorage.getItem('seller_profile');
    return profile ? JSON.parse(profile) : null;
  };

  const hasSubscription = () => {
    // Primero intentar desde el estado
    if (sellerProfile) {
      return sellerProfile.subscription_type && sellerProfile.subscription_type !== 'none';
    }
    
    // Fallback a localStorage
    const profile = getSellerProfile();
    return profile && profile.subscription_type && profile.subscription_type !== 'none';
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const updateSellerProfile = (profile) => {
    setSellerProfile(profile);
    localStorage.setItem('seller_profile', JSON.stringify(profile));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    sellerProfile,
    loginSeller,
    registerSeller,
    logout,
    getSellerProfile,
    hasSubscription,
    updateUser,
    updateSellerProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
