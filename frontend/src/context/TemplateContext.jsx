import React, { createContext, useContext, useEffect, useState } from 'react';
import clientConfig from '../config/client';

const TemplateContext = createContext();

export const useTemplate = () => {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplate must be used within a TemplateProvider');
  }
  return context;
};

export const TemplateProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [branding, setBranding] = useState(clientConfig.branding || {});

  useEffect(() => {
    // Apply branding colors to CSS variables
    if (branding.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
    }
    if (branding.secondaryColor) {
      document.documentElement.style.setProperty('--color-secondary', branding.secondaryColor);
    }
    if (branding.accentColor) {
      document.documentElement.style.setProperty('--color-accent', branding.accentColor);
    }
  }, [branding]);

  const value = {
    template: 'universal', // Ya no usamos templates, todo es universal
    branding,
    isLoading,
    serverName: clientConfig.serverName,
    serverIP: clientConfig.serverIP,
    social: clientConfig.social || {},
  };

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  );
};

export default TemplateContext;
