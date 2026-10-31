import '../styles/config-warning-modal.css';

/**
 * Modal de confirmación personalizado de lightcode
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback al cerrar/cancelar
 * @param {Function} props.onConfirm - Callback al confirmar
 * @param {string} props.title - Título del modal
 * @param {string} props.message - Mensaje del modal
 * @param {string} props.confirmText - Texto del botón de confirmación
 * @param {string} props.cancelText - Texto del botón de cancelar
 * @param {string} props.variant - Variante del modal: 'danger' | 'warning' | 'info'
 */
const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      case 'info':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
        );
      default: // warning
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
    }
  };

  return (
    <div className="config-warning-overlay" onClick={onClose}>
      <div className={`config-warning-modal confirm-modal-${variant}`} onClick={(e) => e.stopPropagation()}>
        <div className={`config-warning-icon icon-${variant}`}>
          {getIcon()}
        </div>
        
        <h2 className="config-warning-title">{title}</h2>
        
        <p className="config-warning-message">{message}</p>
        
        <div className="config-warning-actions">
          <button
            className={`btn-config-primary ${variant === 'danger' ? 'btn-danger' : ''}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
          
          <button
            className="btn-config-secondary"
            onClick={onClose}
          >
            {cancelText}
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

export default ConfirmModal;