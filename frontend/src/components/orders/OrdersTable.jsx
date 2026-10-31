import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function OrdersTable({ orders, onSelectOrder, onRetryOrder, retryingOrder }) {
  const getStatusBadge = (status) => {
    const badges = {
      requested: { class: 'badge-warning', label: 'Solicitado', dot: '#FCD34D' },
      processing: { class: 'badge-info', label: 'Procesando', dot: '#93C5FD' },
      delivered: { class: 'badge-success', label: 'Entregado', dot: '#00D4AA' },
      failed: { class: 'badge-danger', label: 'Fallido', dot: '#F87171' },
      cancelled: { class: 'badge-free', label: 'Cancelado', dot: '#6B7280' },
      refunded: { class: 'badge-premium', label: 'Reembolsado', dot: '#A78BFA' }
    };
    return badges[status] || badges.requested;
  };

  const getDeliveryMethodBadge = (method) => {
    if (method === 'rcon')   return { class: 'badge-info',    label: 'RCON' };
    if (method === 'plugin') return { class: 'badge-success', label: 'Plugin' };
    return { class: 'badge-free', label: 'Manual' };
  };

  const formatDate = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: es 
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  if (orders.length === 0) {
    return (
      <div className="orders-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
          <path d="M9 9h6M9 13h4" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h3>No hay pedidos</h3>
        <p>Los pedidos aparecerán aquí cuando los clientes compren en tu tienda</p>
      </div>
    );
  }

  return (
    <div className="orders-table-container">
      <div className="table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Usuario MC</th>
              <th>Producto</th>
              <th className="table-amount-secondary">Pagó</th>
              <th className="table-amount-primary">Recibes</th>
              <th>Estado</th>
              <th>Método</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const statusBadge = getStatusBadge(order.status);
              const deliveryBadge = getDeliveryMethodBadge(order.deliveryMethod);
              const isFailed = order.status === 'failed';
              
              return (
                <tr 
                  key={order.id} 
                  onClick={() => onSelectOrder(order)} 
                  className={`orders-table-row ${isFailed ? 'row-failed' : ''}`}
                >
                  <td>
                    <div className="table-cell-stack">
                      <span className="order-number">{order.orderNumber}</span>
                      {order.deliveryMethod === 'rcon' && order.rconAttempts > 0 && (
                        <span className="table-cell-muted">
                          {order.rconAttempts}/{order.rconMaxAttempts} intentos
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-with-icon">
                      <div className="minecraft-avatar">
                        <img 
                          src={`https://mc-heads.net/avatar/${order.minecraftUsername}/32`}
                          alt={order.minecraftUsername}
                          onError={(e) => e.target.src = 'https://mc-heads.net/avatar/Steve/32'}
                        />
                      </div>
                      <div className="table-cell-stack">
                        <span className="minecraft-username">{order.minecraftUsername}</span>
                        {order.buyerEmail && (
                          <span className="table-cell-muted table-cell-small">{order.buyerEmail}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span className={!order.product_snapshot?.items?.[0]?.name && !order.productName ? 'product-deleted' : ''}>
                        {order.product_snapshot?.items?.[0]?.name || order.productName || 'Producto eliminado'}
                      </span>
                      {order.serverAddress && (
                        <span className="table-cell-muted table-cell-small">{order.serverAddress}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="order-amount-secondary">${(order.gross_amount || order.amountPaid || 0).toFixed(2)}</span>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span className="order-amount-primary">
                        ${(() => {
                          // Verificar si es pago directo (tiene payment_method y net_amount)
                          const isDirectPayment = order.payment_method === 'paypal' && order.net_amount != null && order.net_amount > 0;
                          
                          if (isDirectPayment) {
                            return Number(order.net_amount).toFixed(2);
                          }
                          
                          // Sistema legacy o sin datos de pago directo
                          return (order.sellerReceives || 0).toFixed(2);
                        })()}
                      </span>
                      {order.payment_method === 'paypal' && order.net_amount != null && order.net_amount > 0 && (
                        <span className="table-cell-muted table-cell-small" style={{ color: 'var(--success)' }}>
                          En tu cuenta PayPal
                        </span>
                      )}
                      {(order.net_amount == null || order.net_amount === 0) && order.sellerReceives && order.sellerReceives > 0 && (
                        <span className="table-cell-muted table-cell-small" style={{ color: 'var(--info)' }}>
                          En tu balance lightcode
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${deliveryBadge.class}`}>
                      {deliveryBadge.label}
                    </span>
                  </td>
                  <td>
                    <span className="table-cell-muted">{formatDate(order.createdAt)}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {isFailed && (
                        <button 
                          className="btn btn-sm btn-danger-outline table-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetryOrder(order.id);
                          }}
                          disabled={retryingOrder === order.id}
                          title="Reintentar entrega"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M21 10c-1.5-4.5-5.5-7-10-7-5.5 0-10 4.5-10 10s4.5 10 10 10c4 0 7.5-2.5 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M21 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {retryingOrder === order.id ? 'Reintentando...' : 'Reintentar'}
                        </button>
                      )}
                      {order.status === 'requested' && order.deliveryMethod === 'manual' && (
                        <button 
                          className="btn btn-sm btn-primary-outline table-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(order);
                          }}
                          title="Marcar como entregado"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Entregar
                        </button>
                      )}
                      <button 
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(order);
                        }}
                      >
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="orders-pagination">
        <span className="pagination-info">
          Mostrando {orders.length} pedidos
        </span>
        <div className="pagination-controls">
          <button className="btn btn-sm btn-ghost" disabled>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M12 5L7 10L12 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Anterior
          </button>
          <button className="btn btn-sm btn-ghost" disabled>
            Siguiente
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
