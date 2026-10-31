/**
 * Hook para countdown en tiempo real
 * Muestra tiempo restante hasta una fecha específica
 */
import { useState, useEffect } from 'react';

export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(targetDate));

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      return;
    }

    // Actualizar cada segundo
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function calculateTimeLeft(targetDate) {
  if (!targetDate) return null;

  const now = new Date();
  const target = new Date(targetDate);
  const difference = target - now;

  if (difference <= 0) {
    return { expired: true, text: 'ahora mismo' };
  }

  const minutes = Math.floor(difference / 1000 / 60);
  const seconds = Math.floor((difference / 1000) % 60);

  if (minutes > 0) {
    return {
      expired: false,
      minutes,
      seconds,
      text: `${minutes} min ${seconds} seg`
    };
  }

  return {
    expired: false,
    minutes: 0,
    seconds,
    text: `${seconds} seg`
  };
}
