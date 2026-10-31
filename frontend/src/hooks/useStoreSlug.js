/**
 * Hook para obtener el slug de la tienda
 * En white-label, lo obtiene del localStorage o del context
 * Fallback a useParams() para compatibilidad
 */
import { useParams, useOutletContext } from 'react-router-dom';
import { useWhiteLabelStore } from './useWhiteLabelStore';

export function useStoreSlug() {
  // ALL hooks must be called unconditionally, in the same order, every render
  const params = useParams();
  const whiteLabelStore = useWhiteLabelStore();

  // useOutletContext must always be called — never inside a try/catch after an early return
  let outletContext = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    outletContext = useOutletContext();
  } catch (e) {
    // No outlet context available — this is fine
  }

  // Now derive the slug from the results (no hooks below this point)

  // 1. White-label store (más confiable)
  if (whiteLabelStore?.store?.slug) {
    return whiteLabelStore.store.slug;
  }

  // 2. Outlet context
  if (outletContext?.store?.slug) {
    return outletContext.store.slug;
  }

  // 3. URL params (compatibilidad con rutas antiguas)
  if (params.storeSlug) {
    return params.storeSlug;
  }

  // 4. Último recurso: localStorage
  const cachedSlug = localStorage.getItem('whitelabel_store_slug');
  if (cachedSlug) {
    return cachedSlug;
  }

  return null;
}