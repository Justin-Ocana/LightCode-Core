/**
 * Buyer Context - Manejo de sesión de comprador en la tienda pública
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { devLog } from '../utils/errorHandler';

export const BuyerContext = createContext(null);

export const useBuyer = () => {
  const context = useContext(BuyerContext);
  if (!context) {
    throw new Error('useBuyer must be used within BuyerProvider');
  }
  return context;
};

export const BuyerProvider = ({ children, storeSlug }) => {
  const navigate = useNavigate();
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SIEMPRE intentar cargar el buyer al montar, ya que las cookies HttpOnly
    // persisten automáticamente y el backend las validará
    loadBuyer();
  }, [storeSlug]);

  // Listener para detectar cambios en localStorage (logout en otra pestaña)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === `buyer_token_${storeSlug}` && !e.newValue) {
        // El token fue eliminado (logout)
        setBuyer(null);
        // Redirigir a la home
        navigate('/');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storeSlug, navigate]);

  const loadBuyer = async () => {
    try {
      setLoading(true);
      
      // Intentar obtener el perfil del comprador.
      // Las cookies HttpOnly se envían automáticamente con cada request
      const response = await authAPI.getBuyerMe();
      setBuyer(response.data);
      
      // Guardar en localStorage para compatibilidad (opcional)
      if (storeSlug && response.data) {
        localStorage.setItem(`buyer_user_${storeSlug}`, JSON.stringify(response.data.user));
      }
    } catch (error) {
      // Si hay token y datos en localStorage, intentar usarlos como fallback
      if (storeSlug) {
        const token = localStorage.getItem(`buyer_token_${storeSlug}`);
        const userData = localStorage.getItem(`buyer_user_${storeSlug}`);
        
        if (token && userData) {
          try {
            const user = JSON.parse(userData);
            setBuyer({ user, buyer_profile: null });
            return; // Salir temprano si el fallback funciona
          } catch (parseError) {
            console.error('Failed to parse localStorage user data:', parseError);
          }
        }
      }
      
      // Si falla, el comprador no está logueado
      // Esto es esperado y no debe generar logs de error
      if (error.response?.status !== 401) {
        devLog('Error loading buyer profile:', error);
      }
      setBuyer(null);
      // Limpiar localStorage si la sesión expiró
      if (storeSlug) {
        localStorage.removeItem(`buyer_token_${storeSlug}`);
        localStorage.removeItem(`buyer_refresh_${storeSlug}`);
        localStorage.removeItem(`buyer_user_${storeSlug}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = (data) => {
    const { user, tokens, buyer_profile } = data;
    
    // Las cookies HttpOnly ya están configuradas por el backend
    // Solo guardamos en localStorage para compatibilidad y sincronización entre pestañas
    if (storeSlug) {
      localStorage.setItem(`buyer_token_${storeSlug}`, tokens.access);
      localStorage.setItem(`buyer_refresh_${storeSlug}`, tokens.refresh);
      localStorage.setItem(`buyer_user_${storeSlug}`, JSON.stringify(user));
    }
    
    setBuyer({ user, buyer_profile });
  };

  const logout = async () => {
    try {
      await authAPI.logout({ store_slug: storeSlug });
    } catch (error) {
      devLog('Error logging out:', error);
    } finally {
      // Limpiar localStorage
      if (storeSlug) {
        localStorage.removeItem(`buyer_token_${storeSlug}`);
        localStorage.removeItem(`buyer_refresh_${storeSlug}`);
        localStorage.removeItem(`buyer_user_${storeSlug}`);
      }
      setBuyer(null);
      
      // Redirigir a la home después del logout
      navigate('/');
    }
  };

  const value = {
    buyer,
    loading,
    login,
    logout,
    refreshBuyer: loadBuyer,
  };

  return (
    <BuyerContext.Provider value={value}>
      {children}
    </BuyerContext.Provider>
  );
};
