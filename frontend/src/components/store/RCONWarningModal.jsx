/**
 * RCONWarningModal - Modal de advertencia para productos con entrega RCON
 * Informa al comprador que debe estar presente en el servidor para recibir el producto
 */
import { AlertTriangle, Server, CheckCircle } from 'lucide-react';
import '../../styles/store/rcon-warning-modal.css';

export function RCONWarningModal({ isOpen, onClose, onContinue, storeName }) {
  if (!isOpen) return null;

  return (
    <div className="rcon-modal-overlay" onClick={onClose}>
      <div className="rcon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rcon-modal__header">
          <div className="rcon-modal__icon rcon-modal__icon--warning">
            <AlertTriangle size={32} />
          </div>
          <h2 className="rcon-modal__title">Entrega Automática RCON</h2>
        </div>

        <div className="rcon-modal__content">
          <p className="rcon-modal__intro">
            Este producto se entrega <strong>automáticamente</strong> mediante RCON cuando completes el pago.
          </p>

          <div className="rcon-modal__requirements">
            <h3 className="rcon-modal__subtitle">
              <Server size={20} />
              Requisitos para recibir tu compra:
            </h3>
            <ul className="rcon-modal__list">
              <li>
                <CheckCircle size={18} className="rcon-modal__check" />
                <span>Debes estar <strong>conectado al servidor</strong> de {storeName}</span>
              </li>
              <li>
                <CheckCircle size={18} className="rcon-modal__check" />
                <span>Tu usuario de Minecraft debe estar <strong>escrito correctamente</strong></span>
              </li>
              <li>
                <CheckCircle size={18} className="rcon-modal__check" />
                <span>La entrega se realiza en <strong>segundos</strong> después del pago</span>
              </li>
            </ul>
          </div>

          <div className="rcon-modal__note">
            <strong>Nota:</strong> Si no estás en el servidor, el sistema reintentará la entrega automáticamente. 
            También podrás solicitar un reintento manual desde tu panel de pedidos.
          </div>
        </div>

        <div className="rcon-modal__actions">
          <button 
            className="rcon-modal__btn rcon-modal__btn--secondary"
            onClick={onClose}
          >
            Volver
          </button>
          <button 
            className="rcon-modal__btn rcon-modal__btn--primary"
            onClick={onContinue}
          >
            Entendido, continuar al pago
          </button>
        </div>
      </div>
    </div>
  );
}
