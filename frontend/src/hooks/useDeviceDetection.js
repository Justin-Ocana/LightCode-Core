import { useState, useEffect } from 'react';

/**
 * Hook para detectar el tipo de dispositivo y orientación
 * @returns {Object} { isMobile, isTablet, isDesktop, orientation }
 */
export function useDeviceDetection() {
  const [deviceInfo, setDeviceInfo] = useState(() => getDeviceInfo());

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    const handleOrientationChange = () => {
      // Pequeño delay para que el navegador actualice las dimensiones
      setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
}

function getDeviceInfo() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const userAgent = navigator.userAgent;

  // Detectar tipo de dispositivo por user agent
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTabletUA = /iPad|Android(?!.*Mobile)/i.test(userAgent);

  // Detectar por tamaño de pantalla
  const isMobileSize = width <= 768;
  const isTabletSize = width > 768 && width <= 1024;
  const isDesktopSize = width > 1024;

  // Orientación
  const orientation = width > height ? 'landscape' : 'portrait';

  // Combinar detección
  const isMobile = isMobileUA || isMobileSize;
  const isTablet = isTabletUA || (isTabletSize && !isMobileUA);
  const isDesktop = !isMobile && !isTablet && isDesktopSize;

  const info = {
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    width,
    height,
    userAgent
  };

  return info;
}

/**
 * Hook simple para detectar solo si es móvil
 * @returns {boolean}
 */
export function useIsMobile() {
  const { isMobile } = useDeviceDetection();
  return isMobile;
}
