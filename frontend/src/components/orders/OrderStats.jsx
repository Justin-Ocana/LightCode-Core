export default function OrderStats({ orders, onFilterPending }) {
  // Filtrar pedidos de los últimos 7 días
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0); // Inicio del día hace 7 días
  
  const ordersLast7Days = orders.filter(order => {
    if (!order.createdAt) return false;
    const orderDate = new Date(order.createdAt);
    return orderDate >= sevenDaysAgo;
  });

  // Calcular estadísticas de los últimos 7 días
  const totalOrders = ordersLast7Days.length;
  const deliveredOrders = ordersLast7Days.filter(o => o.status === 'delivered');
  const failedOrders = ordersLast7Days.filter(o => o.status === 'failed');
  const pendingOrders = ordersLast7Days.filter(o => o.status === 'requested');

  // Calcular ingresos de los últimos 7 días (solo pedidos entregados)
  const totalRevenue = deliveredOrders.reduce((sum, order) => {
    // PRIORIDAD: Queremos el monto BRUTO que pagó el cliente, no el neto después de comisiones
    // 1. gross_amount (monto bruto directo)
    // 2. amountPaid (amount_after_discount)
    // 3. originalAmount (precio original del producto)
    
    const amount = parseFloat(order.gross_amount) || parseFloat(order.amountPaid) || parseFloat(order.originalAmount) || 0;
    return sum + amount;
  }, 0);

  // Calcular PENDIENTES (dinero en proceso) - de los últimos 7 días
  const pendingRevenue = pendingOrders.reduce((sum, order) => {
    return sum + (parseFloat(order.gross_amount) || parseFloat(order.amountPaid) || 0);
  }, 0);

  // Calcular tasa de entrega
  const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders.length / totalOrders) * 100) : 0;
  
  // Última venta (de todos los pedidos, no solo 7 días)
  const lastOrder = orders.length > 0 ? orders[0] : null;
  
  // Calcular tiempo desde última venta
  let lastSaleText = null;
  if (lastOrder && lastOrder.created_at) {
    try {
      const lastSaleTime = new Date(lastOrder.created_at);
      if (!isNaN(lastSaleTime.getTime())) {
        const hoursAgo = Math.floor((Date.now() - lastSaleTime.getTime()) / (1000 * 60 * 60));
        if (!isNaN(hoursAgo) && hoursAgo >= 0) {
          lastSaleText = hoursAgo < 1 ? 'hace menos de 1h' : `hace ${hoursAgo}h`;
        }
      }
    } catch (e) {
      lastSaleText = null;
    }
  }

  return (
    <div className="order-stats-hybrid">
      {/* COLUMNA IZQUIERDA - INGRESOS */}
      <div className="stats-card stats-income">
        <div className="stats-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="stats-card-title">Ingresos (7 días)</span>
        </div>

        {/* DINERO TOTAL - GIGANTE */}
        <div className="stats-income-hero">
          <div className="stats-income-amount">${totalRevenue.toFixed(2)}</div>
          <div className="stats-income-label">Ventas completadas (últimos 7 días)</div>
        </div>

        {/* PENDIENTES - MÁS VISIBLE */}
        {pendingRevenue > 0 && (
          <div className="stats-income-pending">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="stats-pending-amount">${pendingRevenue.toFixed(2)}</span>
            <span className="stats-pending-label">en proceso de entrega</span>
          </div>
        )}

        {/* CONTEXTO SECUNDARIO */}
        <div className="stats-income-footer">
          {lastSaleText && (
            <div className="stats-last-sale">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Última venta: {lastSaleText}</span>
            </div>
          )}
        </div>
      </div>

      {/* COLUMNA DERECHA - PEDIDOS */}
      <div className="stats-card stats-orders">
        <div className="stats-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="stats-card-title">Pedidos (últimos 7 días)</span>
        </div>

        {/* NÚMEROS GRANDES */}
        <div className="stats-orders-grid">
          <div className="stats-orders-box stats-box-total">
            <div className="stats-box-number">{totalOrders}</div>
            <div className="stats-box-label">TOTAL</div>
          </div>
          <div className="stats-orders-box stats-box-delivered">
            <div className="stats-box-number">{deliveredOrders.length}</div>
            <div className="stats-box-label">ENTREGADOS</div>
          </div>
          <div className="stats-orders-box stats-box-pending">
            <div className="stats-box-number">{pendingOrders.length}</div>
            <div className="stats-box-label">PENDIENTES</div>
          </div>
          <div className="stats-orders-box stats-box-failed">
            <div className="stats-box-number">{failedOrders.length}</div>
            <div className="stats-box-label">FALLIDOS</div>
          </div>
        </div>

        {/* BARRA VISUAL */}
        {totalOrders > 0 && (
          <div className="stats-orders-bar">
            <div 
              className="stats-bar-fill stats-bar-success" 
              style={{ width: `${(deliveredOrders.length / totalOrders) * 100}%` }}
            ></div>
            {failedOrders.length > 0 && (
              <div 
                className="stats-bar-fill stats-bar-danger" 
                style={{ width: `${(failedOrders.length / totalOrders) * 100}%` }}
              ></div>
            )}
            {pendingOrders.length > 0 && (
              <div 
                className="stats-bar-fill stats-bar-pending" 
                style={{ width: `${(pendingOrders.length / totalOrders) * 100}%` }}
              ></div>
            )}
          </div>
        )}

        {/* TASA DE ENTREGA */}
        {totalOrders > 0 && deliveryRate === 100 && (
          <div className="stats-orders-rate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>TASA DE ENTREGA: {deliveryRate}%</span>
          </div>
        )}

        {/* ALERTA PENDIENTES */}
        {pendingOrders.length > 0 ? (
          <div className="stats-orders-pending" onClick={onFilterPending}>
            <div className="stats-pending-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stats-pending-content">
              <div className="stats-pending-title">Acción requerida</div>
              <div className="stats-pending-count">{pendingOrders.length} {pendingOrders.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de entregar</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="stats-pending-arrow">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        ) : (
          failedOrders.length === 0 && totalOrders > 0 && (
            <div className="stats-orders-status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Sin pedidos pendientes</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
