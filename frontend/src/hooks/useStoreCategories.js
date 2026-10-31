import { useState, useEffect } from 'react';
import { categoriesAPI } from '../services/api';

/**
 * Categorías públicas de la tienda (globales + tienda).
 * @param {string|null} storeId
 * @param {{ enabled?: boolean }} options
 */
export function useStoreCategories(storeId, { enabled = true } = {}) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!enabled || !storeId) {
      setCategories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await categoriesAPI.list(storeId);
        if (!cancelled && Array.isArray(response.data)) setCategories(response.data);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, enabled]);

  return categories;
}
