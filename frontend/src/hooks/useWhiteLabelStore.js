/**
 * useWhiteLabelStore - Hook for loading the single white-label store
 * Drop-in replacement for useStore from StoreContext in white-label mode
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

export const useWhiteLabelStore = () => {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      const response = await api.get('/stores/public/');
      const data = response.data;
      
      // Manejar tanto el formato nuevo {stores: [...]} como el formato legacy [...]
      const stores = data.stores || data;
      
      if (stores && stores.length > 0) {
        const storeData = stores[0];
        setStore(storeData);
        // Guardar slug en localStorage para que useStoreSlug pueda accederlo
        if (storeData.slug) {
          localStorage.setItem('whitelabel_store_slug', storeData.slug);
        }
      } else {
        console.error('❌ No store found - stores array is empty or null');
        console.error('Raw data:', data);
        toast.error('No se encontró ninguna tienda configurada');
      }
    } catch (error) {
      console.error('💥 Error loading store:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Error al cargar la tienda');
    } finally {
      setLoading(false);
    }
  };

  const refreshStore = () => {
    return loadStore();
  };

  const refreshStores = () => {
    return loadStore();
  };

  // White-label: These operations are not supported in single-store mode
  const selectStore = (newStore) => {
    console.warn('selectStore is not supported in white-label mode');
  };

  const createStore = async () => {
    console.warn('createStore is not supported in white-label mode');
    return { success: false, error: 'Not supported in white-label mode' };
  };

  const updateStore = async (id, data) => {
    try {
      const response = await api.put(`/stores/${id}/`, data);
      const updatedStore = response.data;
      setStore(updatedStore);
      toast.success('Tienda actualizada');
      return { success: true, store: updatedStore };
    } catch (error) {
      const errorData = error.response?.data;
      const message = errorData?.error || 'Error al actualizar tienda';
      toast.error(message);
      return { 
        success: false, 
        error: message,
        errors: errorData?.errors || {}
      };
    }
  };

  const deleteStore = async () => {
    console.warn('deleteStore is not supported in white-label mode');
    return { success: false, error: 'Not supported in white-label mode' };
  };

  return {
    // Primary store reference
    store,
    activeStore: store,
    currentStore: store,
    
    // Store list (always single store in white-label)
    stores: store ? [store] : [],
    
    // Loading state
    loading,
    
    // Store operations
    selectStore,
    createStore,
    updateStore,
    deleteStore,
    refreshStore,
    refreshStores,
  };
};
