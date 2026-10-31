import { useState, useEffect } from 'react';
import { storesAPI, categoriesAPI } from '../services/api';

/**
 * Hook para cargar datos públicos de una tienda (info de la tienda y sus categorías).
 * Evita la duplicación de lógica en StoreHome, StoreShop, StoreProduct, etc.
 * 
 * @param {string} storeSlug - El slug de la tienda desde la URL
 * @returns {Object} { store, categories, loading, error }
 */
export function usePublicStore(storeSlug) {
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!storeSlug) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Cargar info de la tienda
        const storeResponse = await storesAPI.getBySlug(storeSlug);
        const storeData = storeResponse.data;
        setStore(storeData);

        // 2. Cargar categorías de esa tienda
        const categoriesResponse = await categoriesAPI.list(storeData.id);
        setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
        
      } catch (err) {
        console.error('Error loading public store data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [storeSlug]);

  return { store, categories, loading, error };
}
