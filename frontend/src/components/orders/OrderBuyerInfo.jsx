import { User } from 'lucide-react';

/**
 * OrderBuyerInfo - Información del comprador
 */
export function OrderBuyerInfo({ order }) {
  return (
    <div className="order-card">
      <div className="order-card-header">
        <div className="order-card-icon order-card-icon-info">
          <User size={20} />
        </div>
        <div>
          <h3 className="order-card-title">Datos del comprador</h3>
        </div>
      </div>

      <div className="order-fields">
        <div className="order-field">
          <span className="order-field-label">Email de contacto</span>
          <span className="order-field-value">
            {order.buyerContactEmail || 'No proporcionado'}
          </span>
        </div>

        <div className="order-field">
          <span className="order-field-label">Nombre PayPal</span>
          <span className="order-field-value">{order.buyerName}</span>
        </div>

        <div className="order-field">
          <span className="order-field-label">Email PayPal</span>
          <span className="order-field-value">{order.buyerPaypalEmail}</span>
        </div>

        <div className="order-field">
          <span className="order-field-label">Payer ID</span>
          <span className="order-field-value-mono">{order.buyerPayerId}</span>
        </div>

        <div className="order-field">
          <span className="order-field-label">Transaction ID</span>
          <span className="order-field-value-mono">{order.transactionId}</span>
        </div>

        {order.paymentIp && (
          <div className="order-field">
            <span className="order-field-label">IP del pago</span>
            <span className="order-field-value-mono">{order.paymentIp}</span>
          </div>
        )}
      </div>
    </div>
  );
}
