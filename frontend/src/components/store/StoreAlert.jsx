import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import '../../styles/store/alert.css';

/**
 * StoreAlert - Componente de alerta adaptado al sistema de temas de la tienda.
 * Soporta Glassmorphism y colores dinámicos basados en el tema activo.
 */
const StoreAlert = ({ type = 'info', title, message, onClose }) => {
  const icons = {
    info: <Info size={20} />,
    success: <CheckCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    error: <AlertCircle size={20} />,
    danger: <AlertCircle size={20} />,
  };

  const alertType = type === 'error' ? 'danger' : type;

  return (
    <div className={`store-alert store-alert--${alertType}`}>
      <div className="store-alert__icon">
        {icons[type]}
      </div>
      <div className="store-alert__content">
        {title && <div className="store-alert__title">{title}</div>}
        <div className="store-alert__message">{message}</div>
      </div>
      {onClose && (
        <button 
          className="store-alert__close" 
          onClick={onClose}
          aria-label="Cerrar alerta"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export default StoreAlert;
