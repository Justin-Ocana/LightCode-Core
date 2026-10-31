import { CreditCard, CheckCircle2 } from 'lucide-react';

/**
 * OrderPaymentBreakdown - Desglose de pago (White-Label simplificado)
 */
export function OrderPaymentBreakdown({ order }) {
  // Calcular el monto correcto
  const amount = order.grossAmount || order.amountPaid || 0;
  const formattedAmount = !isNaN(amount) ? amount.toFixed(2) : '0.00';

  return (
    <div className="order-payment-card">
      <div className="order-card-header">
        <div className="order-card-icon order-card-icon-primary">
          <CreditCard size={20} />
        </div>
        <div>
          <h3 className="order-card-title">Desglose de pago</h3>
          <p className="order-card-subtitle">Pago directo a tu cuenta</p>
        </div>
      </div>

      <div className="order-payment-row order-payment-row-main">
        <span className="order-payment-label">Monto total del pedido</span>
        <span className="order-payment-value">${formattedAmount}</span>
      </div>

      <div className="order-payment-info">
        <div className="order-payment-info-icon">
          <CheckCircle2 size={20} />
        </div>
        <div className="order-payment-info-text">
          <div className="order-payment-info-title">Modo White-Label</div>
          <div className="order-payment-info-description">
            El pago va directo a la cuenta PayPal Business de la plataforma
          </div>
        </div>
      </div>
    </div>
  );
}
