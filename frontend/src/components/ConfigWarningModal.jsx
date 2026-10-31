import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/config-warning-modal.css';

/**
 * Modal de advertencia cuando falta configuración
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback al cerrar
 * @param {Function} props.onContinue - Callback al continuar sin configurar
 * @param {string} props.type - Tipo de configuración: 'rcon' | 'paypal'
 * @param {string} props.storeSlug - Slug de la tienda
 */
const ConfigWarningModal = ({ isOpen, onClose, onContinue, type, storeSlug }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const config = {
    rcon: {
      title: 'RCON no configurado',
      message: 'Para que los productos con entrega RCON funcionen correctamente, necesitas configurar la conexión RCON de tu servidor.',
      configUrl: `/dashboard/${storeSlug}/rcon`,
      configLabel: 'Configurar RCON',
    },
    paypal: {
      title: 'PayPal no configurado',
      message: 'Para recibir pagos, necesitas configurar tu email de PayPal en la configuración de la tienda.',
      configUrl: `/dashboard/${storeSlug}/paypal`,
      configLabel: 'Configurar PayPal',
    },
    bedrock: {
      title: 'PlugsEssentials no configurado',
      message: 'Para entregas automáticas en Bedrock necesitas descargar e instalar el mod PlugsEssentials en tu servidor, y configurar la API Key.',
      configUrl: `/dashboard/${storeSlug}/entregas`,
      configLabel: 'Configurar PlugsEssentials →',
    },
  };

  const currentConfig = config[type] || config.rcon;

  const handleConfigure = () => {
    navigate(currentConfig.configUrl);
    onClose();
  };

  const handleContinue = () => {
    onContinue();
    onClose();
  };

  return (
    <div className="config-warning-overlay" onClick={onClose}>
      <div className="config-warning-modal" onClick={(e) => e.stopPropagation()}>
        <div className="config-warning-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h2 className="config-warning-title">{currentConfig.title}</h2>
        
        <p className="config-warning-message">{currentConfig.message}</p>
        
        <div className="config-warning-actions">
          <button
            className="btn-config-primary"
            onClick={handleConfigure}
          >
            {currentConfig.configLabel}
          </button>
          
          <button
            className="btn-config-secondary"
            onClick={handleContinue}
          >
            Continuar de todas formas
          </button>
        </div>
        
        <button
          className="config-warning-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default ConfigWarningModal;
