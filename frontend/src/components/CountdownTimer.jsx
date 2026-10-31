import { useState, useEffect } from 'react';

/**
 * Componente de countdown en tiempo real
 * Muestra el tiempo restante hasta una fecha objetivo
 * 
 * Estados:
 * - null → no renderiza nada
 * - pasado → "En cola" con tiempo transcurrido
 * - futuro → countdown en tiempo real
 */
export default function CountdownTimer({ targetDate, className = '' }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const target = new Date(targetDate);
      const now = new Date();
      const difference = target - now;

      if (difference <= 0) {
        // Calcular cuánto tiempo ha pasado desde la fecha objetivo
        const elapsed = Math.abs(difference);
        const minutes = Math.floor(elapsed / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        return { 
          isPast: true, 
          elapsed: { days, hours: hours % 24, minutes: minutes % 60 }
        };
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return { isPast: false, hours, minutes, seconds };
    };

    // Calcular inmediatamente
    setTimeLeft(calculateTimeLeft());

    // Actualizar cada segundo
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  // No renderizar si no hay fecha objetivo
  if (!targetDate || timeLeft === null) {
    return null;
  }

  // Si la fecha ya pasó
  if (timeLeft.isPast) {
    const { days, hours, minutes } = timeLeft.elapsed || {};
    
    // Validar que tenemos los valores
    if (days === undefined || hours === undefined || minutes === undefined) {
      return (
        <span className={`countdown-timer past ${className}`}>
          ⏱️ En cola
        </span>
      );
    }
    
    let elapsedText = '';
    if (days > 0) {
      elapsedText = `hace ${days}d ${hours}h`;
    } else if (hours > 0) {
      elapsedText = `hace ${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      elapsedText = `hace ${minutes}m`;
    } else {
      elapsedText = 'ahora mismo';
    }
    
    return (
      <span className={`countdown-timer past ${className}`}>
        ⏱️ En cola ({elapsedText})
      </span>
    );
  }

  // Formatear el tiempo restante
  const formatTime = () => {
    if (!timeLeft || timeLeft.isPast) {
      return 'Calculando...';
    }
    
    const { hours, minutes, seconds } = timeLeft;
    
    // Validar que tenemos los valores
    if (hours === undefined || minutes === undefined || seconds === undefined) {
      return 'Calculando...';
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <span className={`countdown-timer active ${className}`}>
      {formatTime()}
    </span>
  );
}
