import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import api from '../../services/api';
import OrdersTable from '../../components/orders/OrdersTable';
import OrderFilters from '../../components/orders/OrderFilters';
import OrderStats from '../../components/orders/OrderStats';
import AutoDeliveryQuota from '../../components/orders/AutoDeliveryQuota';
import '../../styles/orders-v2.css';
import '../../styles/orders-stats-v3.css';

// Helper function to transform order data
const transformOrder = (order) => {
  // Asegurar que los montos sean números válidos (arregla $NaN)
  const parseAmount = (value) => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    deliveryMethod: order.delivery_method || order.deliveryMethod,
    minecraftUsername: order.minecraft_username,
    productSnapshot: order.product_snapshot, // Mantener el snapshot original para verificaciones
    productName: order.product_snapshot?.name || 'Producto eliminado',
    productImage: order.product_snapshot?.image,
    amountPaid: parseAmount(order.amount_after_discount),
    originalAmount: parseAmount(order.original_amount),
    sellerReceives: parseAmount(order.seller_credited),
    sellerGross: parseAmount(order.seller_credited),
    currency: order.currency,
    createdAt: order.created_at,
    deliveredAt: order.delivered_at,
    buyerName: order.buyer_paypal_name,
    buyerEmail: order.buyer_paypal_email,
    buyerPayerId: order.buyer_payer_id,
    transactionId: order.paypal_transaction_id,
    paypalOrderId: order.paypal_order_id,
    paymentIp: order.payment_ip,
    serverAddress: order.server_address,
    commandSent: order.command_sent,
    
    // Descuento
    discountCode: order.discount_code,
    discountType: order.discount_type,
    discountValue: parseAmount(order.discount_value),
    discountSaved: parseAmount(order.discount_amount_saved),
    
    // Direct payment fields (new system)
    payment_method: order.payment_method,
    gross_amount: parseAmount(order.gross_amount || order.amount_after_discount),
    grossAmount: parseAmount(order.gross_amount || order.amount_after_discount), // Alias para compatibilidad
    paypal_fee: parseAmount(order.paypal_fee),
    net_amount: parseAmount(order.net_amount),
    
    // Fees (legacy system)
    paypalReceiveFee: parseAmount(order.paypal_receive_fee),
    paypalReceiveFeePercent: parseAmount(order.paypal_receive_fee_percent),
    paypalWithdrawFee: 0,
    paypalWithdrawFeePercent: 0,
    lightcodeFee: parseAmount(order.lightcode_fee),
    lightcodeFeePercent: parseAmount(order.lightcode_fee_percent),
    lightcodePlan: order.lightcode_plan || 'starter',
    
    // RCON
    rconJob: order.rcon_job,
    rconAttempts: order.rcon_job?.attempts || 0,
    rconMaxAttempts: order.rcon_job?.max_attempts || 5,
    rconStatus: order.rcon_job?.status,
    rconLastAttempt: order.rcon_job?.last_attempt_at,
    rconNextRetry: order.rcon_job?.next_retry_at,
    rconErrorLog: order.rcon_job?.rcon_raw_log,
    rconError: order.rcon_job?.rcon_error,
    rconFailureReason: order.rcon_job?.failure_reason,
    
    // Balance
    balanceCredited: order.balance_credited,
    balanceReleased: order.balance_released,
    
    // Notas
    sellerNotes: order.seller_notes,
    manualReason: order.manual_reason || order.manualReason || '',
  };
};

export default function Orders() {
  const { currentStore, activeStore } = useStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('ordersViewMode') || 'table';
  });
  const [filters, setFilters] = useState({
    search: '',
    status: [],
    deliveryMethod: [],
    dateRange: { start: null, end: null },
    amountRange: { min: null, max: null },
    hasRconErrors: false,
    limitReached: false,
  });
  const [retryingOrder, setRetryingOrder] = useState(null);

  useEffect(() => {
    localStorage.setItem('ordersViewMode', viewMode);
  }, [viewMode]);

  // Cargar pedidos desde el backend
  const fetchOrders = useCallback(async () => {
    if (!currentStore && !activeStore) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const storeSlug = activeStore?.slug || currentStore?.slug;
      const response = await api.get(`/orders/dashboard-stats/?store=${storeSlug}`);
      
      let ordersData = response.data?.orders || response.data;
      if (!Array.isArray(ordersData)) ordersData = ordersData?.results || [];

      // Guardar quota si viene en la respuesta
      if (response.data?.auto_delivery_quota) {
        setQuota(response.data.auto_delivery_quota);
      }
      
      const transformedOrders = ordersData.map(transformOrder);
      setOrders(transformedOrders);
      setFilteredOrders(transformedOrders);
    } catch (err) {
      // Fallback a /orders/ si dashboard-stats falla
      try {
        const fallback = await api.get('/orders/');
        let ordersData = fallback.data;
        if (ordersData && typeof ordersData === 'object' && !Array.isArray(ordersData)) {
          ordersData = ordersData.results || [];
        }
        const transformedOrders = ordersData.map(transformOrder);
        setOrders(transformedOrders);
        setFilteredOrders(transformedOrders);
      } catch (fallbackErr) {
        console.error('Error cargando pedidos:', fallbackErr);
        setError(fallbackErr.response?.data?.detail || 'Error al cargar los pedidos');
      }
    } finally {
      setLoading(false);
    }
  }, [currentStore, activeStore]);

  useEffect(() => {
    fetchOrders();
  }, [currentStore, activeStore]);

  // Listen for real-time order updates and new orders
  useEffect(() => {
    const handleOrderUpdate = (event) => {
      // Refresh orders when update is received
      fetchOrders();
    };

    const handleNewOrder = (event) => {
      // Refresh orders to show the new order
      fetchOrders();
    };

    window.addEventListener('orderUpdate', handleOrderUpdate);
    window.addEventListener('newOrder', handleNewOrder);

    return () => {
      window.removeEventListener('orderUpdate', handleOrderUpdate);
      window.removeEventListener('newOrder', handleNewOrder);
    };
  }, [fetchOrders]);

  // Update relative times every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update relative times
      setOrders(prevOrders => [...prevOrders]);
    }, 60000); // Every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Aplicar filtros
  useEffect(() => {
    let result = [...orders];

    // Búsqueda global
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(order =>
        order.orderNumber.toLowerCase().includes(search) ||
        order.minecraftUsername.toLowerCase().includes(search) ||
        order.buyerEmail.toLowerCase().includes(search) ||
        order.transactionId.toLowerCase().includes(search)
      );
    }

    // Filtro por estado
    if (filters.status.length > 0) {
      result = result.filter(order => filters.status.includes(order.status));
    }

    // Filtro por método de entrega
    if (filters.deliveryMethod.length > 0) {
      result = result.filter(order => filters.deliveryMethod.includes(order.deliveryMethod));
    }

    // Filtro por rango de fecha
    if (filters.dateRange.start) {
      result = result.filter(order => new Date(order.createdAt) >= new Date(filters.dateRange.start));
    }
    if (filters.dateRange.end) {
      result = result.filter(order => new Date(order.createdAt) <= new Date(filters.dateRange.end));
    }

    // Filtro por monto
    if (filters.amountRange.min) {
      result = result.filter(order => order.amountPaid >= parseFloat(filters.amountRange.min));
    }
    if (filters.amountRange.max) {
      result = result.filter(order => order.amountPaid <= parseFloat(filters.amountRange.max));
    }

    // Filtro por errores RCON
    if (filters.hasRconErrors) {
      result = result.filter(order => 
        order.deliveryMethod === 'rcon' && 
        order.status === 'failed' && 
        order.rconErrorLog
      );
    }

    // Filtro por límite de entregas automáticas alcanzado
    if (filters.limitReached) {
      result = result.filter(order => order.manualReason === 'limit_reached');
    }

    setFilteredOrders(result);
  }, [filters, orders]);

  const handleExport = () => {
    // Exportar pedidos
  };

  const handleOrderClick = (order) => {
    const storeSlug = activeStore?.slug || currentStore?.slug;
    navigate(`/dashboard/${storeSlug}/orders/${order.id}`);
  };

  const handleRetryOrder = async (orderId) => {
    try {
      setRetryingOrder(orderId);
      await api.post(`/orders/${orderId}/retry-delivery/`);
      await fetchOrders();
    } catch (err) {
      console.error('Error al reintentar entrega:', err);
    } finally {
      setRetryingOrder(null);
    }
  };

  const failedOrders = orders.filter(o => o.status === 'failed');
  const hasFailedOrders = failedOrders.length > 0;

  if (loading) {
    return (
      <div className="orders-loading">
        <div className="spinner"></div>
        <p>Cargando pedidos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-error">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--danger)" strokeWidth="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h3>Error al cargar pedidos</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="orders-page-v2">
      {hasFailedOrders && (
        <div className="orders-alert-banner">
          <div className="orders-alert-content">
            <div className="orders-alert-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="orders-alert-text">
              <div className="orders-alert-title">
                {failedOrders.length} {failedOrders.length === 1 ? 'pedido fallido requiere' : 'pedidos fallidos requieren'} atención
              </div>
              <div className="orders-alert-description">
                Clientes pagaron pero no recibieron sus productos. Revisa los errores de RCON.
              </div>
            </div>
            <button 
              className="btn btn-sm btn-danger-outline"
              onClick={() => setFilters(prev => ({ ...prev, status: ['failed'] }))}
            >
              Ver fallidos
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="orders-header">
        <div className="orders-header-content">
          <div className="orders-header-left">
            <h1>Pedidos</h1>
            <p className="orders-subtitle">
              Gestiona todas las órdenes de tu tienda en tiempo real
            </p>
          </div>
          <div className="orders-header-actions">
            <div className="view-mode-toggle">
              <button 
                className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Vista de tabla"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Vista de tarjetas"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AutoDeliveryQuota quota={quota} />

      <OrderStats orders={orders} />

      <OrderFilters filters={filters} setFilters={setFilters} />

      {viewMode === 'table' ? (
        <OrdersTable 
          orders={filteredOrders} 
          onSelectOrder={handleOrderClick}
          onRetryOrder={handleRetryOrder}
          retryingOrder={retryingOrder}
        />
      ) : (
        filteredOrders.length === 0 ? (
          <div className="orders-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
              <path d="M9 9h6M9 13h4" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h3>No hay pedidos</h3>
            <p>Los pedidos aparecerán aquí cuando los clientes compren en tu tienda</p>
          </div>
        ) : (
          <div className="orders-cards-grid">
            {filteredOrders.map(order => {
              return (
                <div 
                  key={order.id} 
                  className={`order-card-v2 ${order.status === 'processing' ? 'order-card-processing' : ''} ${order.status === 'failed' ? 'order-card-failed' : ''}`}
                  onClick={() => handleOrderClick(order)}
                >
                  {/* Header: Order number + badges */}
                  <div className="order-card-header">
                    <div className="order-card-number">{order.orderNumber}</div>
                    <div className="order-card-badges">
                      <span className={`badge badge-${getStatusClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <span className={`badge ${order.deliveryMethod === 'rcon' ? 'badge-info' : order.deliveryMethod === 'plugin' ? 'badge-success' : 'badge-free'}`}>
                        {order.deliveryMethod === 'rcon' ? 'RCON' : order.deliveryMethod === 'plugin' ? 'Plugin' : 'Manual'}
                      </span>
                    </div>
                  </div>

                  {/* Player + Product */}
                  <div className="order-card-player">
                    <img 
                      src={`https://mc-heads.net/avatar/${order.minecraftUsername}/48`}
                      alt={order.minecraftUsername}
                      className="order-card-avatar"
                      onError={(e) => e.target.src = 'https://mc-heads.net/avatar/Steve/48'}
                    />
                    <div className="order-card-player-info">
                      <div className="order-card-player-name">{order.minecraftUsername}</div>
                      <div className={`order-card-product ${!order.productSnapshot?.name ? 'product-deleted' : ''}`}>
                        {order.productSnapshot?.name || order.productName || 'Producto eliminado'}
                      </div>
                    </div>
                  </div>

                  {/* Amount Paid - Simple display */}
                  <div className="order-card-amount">
                    <span className="order-card-amount-label">Monto total</span>
                    <span className="order-card-amount-value">
                      ${(order.amountPaid || order.grossAmount || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Actions */}
                  {(order.status === 'failed' || (order.status === 'requested' && order.deliveryMethod === 'manual')) && (
                    <div className="order-card-actions">
                      {order.status === 'failed' && (
                        <button 
                          className="order-card-action-btn order-card-action-retry"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetryOrder(order.id);
                          }}
                          disabled={retryingOrder === order.id}
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
                          className="order-card-action-btn order-card-action-deliver"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Marcar entregado
                        </button>
                      )}
                    </div>
                  )}

                  {/* Footer: Timestamp */}
                  <div className="order-card-footer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// Helper functions
function getStatusClass(status) {
  const classes = {
    requested: 'warning',
    processing: 'info',
    delivered: 'success',
    failed: 'danger',
    cancelled: 'free',
    refunded: 'premium'
  };
  return classes[status] || 'warning';
}

function getStatusLabel(status) {
  const labels = {
    requested: 'Solicitado',
    processing: 'Procesando',
    delivered: 'Entregado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado'
  };
  return labels[status] || status;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
