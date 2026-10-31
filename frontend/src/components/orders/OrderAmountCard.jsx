import { DollarSign } from 'lucide-react';

/**
 * OrderAmountCard - Tarjeta destacada con el monto total
 */
export function OrderAmountCard({ order }) {
  // Calcular el monto correcto (arregla el problema de $NaN)
  const amount = order.grossAmount || order.amountPaid || 0;
  const formattedAmount = !isNaN(amount) ? amount.toFixed(2) : '0.00';

  return (
    <div className="order-amount-card">
      <div className="order-amount-label">
        <DollarSign size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
        Monto total del pedido
      </div>
      <div className="order-amount-value">
        ${formattedAmount}
      </div>
    </div>
  );
}
