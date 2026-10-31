import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook para verificar configuraciones de la tienda
 * @param {string} storeId - ID de la tienda
 * @returns {Object} Estado de las configuraciones
 */
export const useStoreConfig = (storeId) => {
  const [config, setConfig] = useState({
    rcon: { configured: false, enabled: false, last_test: null },
    paypal: { configured: false, email: null },
    bedrock: { configured: false, server_type: 'java' },
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!storeId) {
      setConfig(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchConfig = async () => {
      try {
        const response = await api.get(`/stores/${storeId}/check-config/`);
        setConfig({
          rcon:    response.data.rcon,
          paypal:  response.data.paypal,
          bedrock: response.data.bedrock,
          loading: false,
          error:   null,
        });
      } catch (error) {
        console.error('❌ Error fetching store config:', error);
        setConfig(prev => ({
          ...prev,
          loading: false,
          error: error.response?.data?.error || 'Error al cargar configuración',
        }));
      }
    };

    fetchConfig();
  }, [storeId]);

  return config;
};
