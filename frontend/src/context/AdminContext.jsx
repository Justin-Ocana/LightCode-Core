import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';

const AdminContext = createContext();

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Verificar que el token sea válido y el usuario sea admin
      const response = await api.get('/users/auth/me/');
      const userData = response.data;
      
      // El endpoint devuelve {user: {...}, seller_profile: {...}}
      const user = userData.user || userData;
      
      // Solo permitir superusers
      if (user.is_superuser || user.is_staff) {
        setAdmin({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.is_superuser ? 'superadmin' : 'admin'
        });
      } else {
        // No es admin, limpiar
        localStorage.removeItem('admin_token');
        setAdmin(null);
      }
    } catch (error) {
      console.error('Error checking admin auth:', error);
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_data');
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Autenticar con el endpoint de token JWT
      const response = await api.post('/auth/token/', {
        username,
        password
      });
      
      const { access, refresh } = response.data;
      
      // Guardar tokens INMEDIATAMENTE
      localStorage.setItem('admin_token', access);
      localStorage.setItem('admin_refresh', refresh);
      localStorage.setItem('token', access); // Para que api.js lo use
      localStorage.setItem('refresh_token', refresh);
      
      // Configurar el header de autorización MANUALMENTE para la siguiente petición
      const authApi = axios.create({
        baseURL: api.defaults.baseURL,
        headers: {
          'Authorization': `Bearer ${access}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Obtener datos del usuario CON EL TOKEN
      const userResponse = await authApi.get('/users/auth/me/');
      const userData = userResponse.data;
      
      // El endpoint devuelve {user: {...}, seller_profile: {...}}
      const user = userData.user || userData;
      
      // Verificar que sea superuser o staff
      if (!user.is_superuser && !user.is_staff) {
        // Limpiar tokens
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_refresh');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        
        return { 
          success: false, 
          error: 'No tienes permisos de administrador' 
        };
      }
      
      const adminData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.is_superuser ? 'superadmin' : 'admin'
      };
      
      localStorage.setItem('admin_data', JSON.stringify(adminData));
      setAdmin(adminData);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error response:', JSON.stringify(error.response?.data, null, 2));
      
      // Extract error message properly - handle nested error objects
      let errorMessage = 'Credenciales inválidas';
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.error && typeof data.error === 'object') {
          // Nested error object
          errorMessage = data.error.message || data.error.code || 'Error de autenticación';
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.error && typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh');
    localStorage.removeItem('admin_data');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setAdmin(null);
    navigate('/kv-admin/login');
  };

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
