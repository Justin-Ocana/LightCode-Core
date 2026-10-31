import { Package } from 'lucide-react';

/**
 * OrderProductInfo - Información del producto
 */
export function OrderProductInfo({ order }) {
  return (
    <div className="order-card">
      <div className="order-card-header">
        <div className="order-card-icon order-card-icon-primary">
          <Package size={20} />
        </div>
        <div>
          <h3 className="order-card-title">Datos del producto</h3>
        </div>
      </div>

      <div className="order-fields">
        <div className="order-field">
          <span className="order-field-label">Producto</span>
          <span className="order-field-value">{order.productName}</span>
        </div>

        <div className="order-field">
          <span className="order-field-label">Servidor</span>
          <span className="order-field-value-mono">{order.serverAddress}</span>
        </div>

        {order.commandSent && (
          <div className="order-field">
            <span className="order-field-label">Comando enviado</span>
            <code className="order-field-value-code">{order.commandSent}</code>
          </div>
        )}
      </div>
    </div>
  );
}
