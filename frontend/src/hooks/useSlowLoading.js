/**
 * Hook para detectar si la carga está siendo lenta (servidor dormido)
 */
import { useState, useEffect } from 'react';

export function useSlowLoading(isLoading, threshold = 3000) {
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsSlowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      if (isLoading) {
        setIsSlowLoading(true);
      }
    }, threshold);

    return () => clearTimeout(timer);
  }, [isLoading, threshold]);

  return isSlowLoading;
}
