// Configuración del cliente - Generado automáticamente
// NO editar manualmente, usa client-config.json y ejecuta setup_client.py

const CLIENT_CONFIG = {
  // Información del servidor
  serverName: "Mi Servidor MC",
  serverIP: "play.miservidor.com",
  serverPort: 25565,
  description: "El mejor servidor de Minecraft en español",
  tagline: "¡Únete a la aventura!",
  
  // Template (classic, modern, gaming, minimal)
  template: "classic",
  
  // Branding
  branding: {
    primaryColor: "#FFFFFF",
    secondaryColor: "#7A7A7A",
    accentColor: "#EDEDED",
    logo: "./assets/logo.png",
    banner: "./assets/banner.png",
    favicon: "./assets/favicon.ico",
  },
  
  // Social
  social: {
    discord: "https://discord.gg/tuservidor",
    twitter: "",
    instagram: "",
    website: "",
  },
  
  // Settings
  currency: "USD",
  language: "es",
  
  // Store slug (para las rutas del frontend)
  storeSlug: "mi-servidor-mc",
};

// API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default CLIENT_CONFIG;
