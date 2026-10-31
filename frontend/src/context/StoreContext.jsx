/**
 * Store Context - Manejo de tienda activa con slug en URL
 * 
 * WHITE-LABEL MODE: This context now delegates to useWhiteLabelStore
 * for single-store white-label deployments.
 */
import { createContext, useContext } from 'react';
import { useWhiteLabelStore } from '../hooks/useWhiteLabelStore';

const StoreContext = createContext(null);

export const useStore = () => {
  // White-label mode: Use the white-label hook directly
  return useWhiteLabelStore();
};

export const StoreProvider = ({ children }) => {
  // White-label mode: Provider is a pass-through, actual logic is in useWhiteLabelStore
  const value = useWhiteLabelStore();
  
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};
