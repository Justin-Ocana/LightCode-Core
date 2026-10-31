import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useNotifications } from '../../context/NotificationContext';
import { useCountdown } from '../../hooks/useCountdown';
import api from '../../services/api';
import OrderTimeline from '../../components/orders/OrderTimeline';
import '../../styles/order-detail.css';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const { showToast } = useNotifications();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sellerNotes, setSellerNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRetryWarning, setShowRetryWarning] = useState(false);
  
  // Countdown para próximo reintento RCON
  const countdown = useCountdown(order?.rconNextRetry);

  // Cargar pedido desde el backend
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get(`/orders/${orderId}/`);
        const orderData = response.data;
        
        // Transformar datos del backend
        const transformedOrder = {
          id: orderData.id,
          orderNumber: orderData.order_number,
          status: orderData.status,
          statusDisplay: orderData.status_display,
          deliveryMethod: orderData.delivery_method,
          deliveryMethodDisplay: orderData.delivery_method_display,
          
          // Producto
          productName: orderData.product_snapshot?.name || 'Producto eliminado',
          productDescription: orderData.product_snapshot?.description,
          productImage: orderData.product_snapshot?.image,
          productPrice: orderData.product_snapshot?.price,
          
          // Usuario Minecraft
          minecraftUsername: orderData.minecraft_username,
          serverAddress: orderData.server_address,
          commandSent: orderData.command_sent,
          
          // Comprador
          buyerName: orderData.buyer_paypal_name,
          buyerContactEmail: orderData.buyer_contact_email,
          buyerPaypalEmail: orderData.buyer_paypal_email,
          buyerPayerId: orderData.buyer_payer_id,
          buyerUsername: orderData.buyer_username,
          
          // PayPal
          transactionId: orderData.paypal_transaction_id,
          paypalOrderId: orderData.paypal_order_id,
          paymentIp: orderData.payment_ip,
          paymentCapturedAt: orderData.payment_captured_at,
          
          // Montos (solo pagos directos)
          originalAmount: parseFloat(orderData.original_amount),
          discountCode: orderData.discount_code,
          discountType: orderData.discount_type,
          discountValue: parseFloat(orderData.discount_value || 0),
          discountSaved: parseFloat(orderData.discount_amount_saved || 0),
          amountPaid: parseFloat(orderData.amount_after_discount),
          
          // Pagos directos PayPal
          paymentMethod: orderData.payment_method,
          grossAmount: parseFloat(orderData.gross_amount || orderData.amount_after_discount),
          paypalFee: parseFloat(orderData.paypal_fee || 0),
          netAmount: parseFloat(orderData.net_amount || 0),
          
          currency: orderData.currency,
          
          // RCON
          rconJob: orderData.rcon_job,
          rconAutoAttempts: orderData.rcon_job?.auto_retry_count || 0,
          rconManualAttempts: orderData.rcon_job?.manual_retry_count || 0,
          rconMaxAttempts: orderData.rcon_job?.max_attempts || 5,
          rconStatus: orderData.rcon_job?.status,
          rconLastAttempt: orderData.rcon_job?.last_attempt_at,
          rconNextRetry: orderData.rcon_job?.next_retry_at,
          rconErrorLog: orderData.rcon_job?.rcon_raw_log,
          rconError: orderData.rcon_job?.rcon_error,
          rconErrorMessage: orderData.rcon_job?.failure_reason,
          rconDeliveredAt: orderData.rcon_job?.delivered_at,
          
          // Timestamps
          createdAt: orderData.created_at,
          updatedAt: orderData.updated_at,
          deliveredAt: orderData.delivered_at,
          
          // Notas y timeline
          sellerNotes: orderData.seller_notes || '',
          timeline: (orderData.status_history || []).map(history => ({
            status: history.to_status,
            message: history.reason || `Estado cambiado a ${history.to_status}`,
            timestamp: history.created_at,
            changedBy: history.changed_by_name || 'Sistema'
          })),
          notes: orderData.notes || [],
          
          // Store
          storeName: orderData.store_name
        };
        
        setOrder(transformedOrder);
        setSellerNotes(transformedOrder.sellerNotes);
      } catch (err) {
        console.error('Error cargando pedido:', err);
        setError(err.response?.data?.detail || 'Error al cargar el pedido');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const handleStatusChange = async (newStatus) => {
    if (!order) return;
    
    // Validar que el cambio de estado sea válido
    if (order.deliveryMethod !== 'manual' && newStatus === 'delivered') {
      alert('Solo los pedidos con entrega manual pueden marcarse como entregados manualmente');
      return;
    }
    
    try {
      setIsUpdating(true);
      await api.post(`/orders/${orderId}/update_status/`, {
        status: newStatus,
        reason: `Actualizado manualmente a ${getStatusLabel(newStatus)}`
      });
      
      // Recargar pedido
      const response = await api.get(`/orders/${orderId}/`);
      const orderData = response.data;
      setOrder({ 
        ...order, 
        status: orderData.status, 
        deliveredAt: orderData.delivered_at 
      });
      
      // Mostrar mensaje de éxito
      alert(`Estado actualizado a: ${getStatusLabel(newStatus)}`);
    } catch (err) {
      console.error('Error actualizando estado:', err);
      alert(err.response?.data?.error || 'Error al actualizar el estado');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const getStatusLabel = (status) => {
    const labels = {
      requested: 'Solicitado',
      processing: 'Procesando',
      delivered: 'Entregado',
      failed: 'Fallido',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado'
    };
    return labels[status] || status;
  };

  const handleRetryRcon = async () => {
    if (!order || !order.rconJob) return;
    
    // Si el pedido está en failed y tiene log de error que indica entrega parcial, mostrar advertencia
    const hasPartialDelivery = order.rconErrorLog && (
      order.rconErrorLog.includes('Entrega parcial') || 
      order.rconErrorLog.includes('algunos comandos fallaron') ||
      order.rconErrorMessage?.includes('Algunos comandos fallaron')
    );
    
    if (order.status === 'failed' && hasPartialDelivery) {
      setShowRetryWarning(true);
      return;
    }
    
    await executeRetry();
  };

  const executeRetry = async () => {
    try {
      setIsUpdating(true);
      setShowRetryWarning(false);
      
      await api.post(`/orders/${orderId}/retry_rcon/`);
      
      // Esperar un momento para que la tarea se ejecute
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Recargar pedido
      const response = await api.get(`/orders/${orderId}/`);
      const orderData = response.data;
      
      // Actualizar el estado completo con los nuevos datos
      setOrder({
        ...order,
        status: orderData.status,
        rconJob: orderData.rcon_job,
        rconAutoAttempts: orderData.rcon_job?.auto_retry_count || 0,
        rconManualAttempts: orderData.rcon_job?.manual_retry_count || 0,
        rconMaxAttempts: orderData.rcon_job?.max_attempts || 5,
        rconStatus: orderData.rcon_job?.status,
        rconLastAttempt: orderData.rcon_job?.last_attempt_at,
        rconNextRetry: orderData.rcon_job?.next_retry_at,
        rconErrorLog: orderData.rcon_job?.rcon_raw_log,
        rconError: orderData.rcon_job?.rcon_error,
        rconErrorMessage: orderData.rcon_job?.failure_reason
      });
      
      // Mostrar resultado con toast
      if (orderData.rcon_job?.status === 'delivered') {
        showToast({
          type: 'success',
          title: 'Entrega exitosa',
          message: 'El pedido fue entregado correctamente',
          duration: 5000
        });
      } else if (orderData.rcon_job?.failure_reason) {
        showToast({
          type: 'warning',
          title: 'Reintento completado',
          message: `${orderData.rcon_job.failure_reason}\n\nLog técnico: ${orderData.rcon_job.rcon_raw_log || 'No disponible'}`,
          duration: 8000
        });
      }
    } catch (err) {
      console.error('Error reintentando RCON:', err);
      showToast({
        type: 'error',
        title: 'Error al reintentar',
        message: err.response?.data?.error || err.message,
        duration: 5000
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkDelivered = async () => {
    await handleStatusChange('delivered');
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    
    try {
      setIsUpdating(true);
      await api.post(`/orders/${orderId}/add_note/`, {
        content: sellerNotes,
        is_internal: true
      });
      
      setOrder({ ...order, sellerNotes });
      alert('Nota guardada exitosamente');
    } catch (err) {
      console.error('Error guardando nota:', err);
      alert(err.response?.data?.error || 'Error al guardar la nota');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="order-detail-loading">
        <div className="spinner"></div>
        <p>Cargando pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-detail-not-found">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
          <path d="M12 8v4M12 16v.5" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h2>{error ? 'Error al cargar' : 'Pedido no encontrado'}</h2>
        <p>{error || 'El pedido que buscas no existe o fue eliminado'}</p>
        <Link to={`/dashboard/${activeStore?.slug}/orders`} className="btn btn-md btn-primary">
          Volver a pedidos
        </Link>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      requested: '#FCD34D',
      processing: '#93C5FD',
      delivered: '#34D399',
      failed: '#F87171',
      cancelled: '#6B7280',
      refunded: '#A78BFA'
    };
    return colors[status] || colors.requested;
  };

  return (
    <div className="order-detail-page">
      {/* Breadcrumb */}
      <div className="order-detail-breadcrumb">
        <Link to={`/dashboard/${activeStore?.slug}/orders`} className="breadcrumb-link">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M12 5L7 10L12 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Pedidos
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{order.orderNumber}</span>
      </div>

      {/* Header con gradiente */}
      <div className="order-detail-header">
        <div className="order-detail-header-content">
          <div className="order-detail-header-left">
            <div className="order-detail-header-badges">
              <span className={`badge ${order.deliveryMethod === 'rcon' ? 'badge-info' : 'badge-free'}`}>
                {order.deliveryMethod === 'rcon' ? 'RCON' : 'Manual'}
              </span>
              <span className="order-detail-header-date">
                {new Date(order.createdAt).toLocaleString('es-ES', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              </span>
            </div>
            <h1 className="order-detail-title">Pedido {order.orderNumber}</h1>
            <p className="order-detail-subtitle">
              {order.productName} · {order.minecraftUsername}
            </p>
          </div>

          {/* Estado actual - grande y llamativo */}
          <div className="order-detail-status-card" style={{ borderColor: getStatusColor(order.status) }}>
            <div className="order-detail-status-label">Estado actual</div>
            <div className="order-detail-status-value" style={{ color: getStatusColor(order.status) }}>
              {getStatusLabel(order.status)}
            </div>
            
            {/* Botones de acción contextuales */}
            <div className="order-detail-header-actions">
              {order.status === 'failed' && order.deliveryMethod === 'rcon' && (
                <button 
                  className="btn btn-sm btn-danger-outline"
                  onClick={handleRetryRcon}
                  disabled={isUpdating}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M21 10c-1.5-4.5-5.5-7-10-7-5.5 0-10 4.5-10 10s4.5 10 10 10c4 0 7.5-2.5 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {isUpdating ? 'Reintentando...' : 'Reintentar'}
                </button>
              )}
              
              {order.status === 'requested' && order.deliveryMethod === 'manual' && (
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={handleMarkDelivered}
                  disabled={isUpdating}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {isUpdating ? 'Marcando...' : 'Marcar entregado'}
                </button>
              )}
            </div>
            
            {order.status !== 'delivered' && order.status !== 'cancelled' && order.deliveryMethod === 'manual' && (
              <select 
                className="order-detail-status-select"
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isUpdating}
              >
                <option value="requested">Solicitado</option>
                <option value="processing">Procesando</option>
                <option value="delivered">Entregado</option>
                <option value="failed">Fallido</option>
                <option value="cancelled">Cancelado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="order-detail-tabs">
        <button 
          className={`order-detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 7h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Vista general
        </button>
        <button 
          className={`order-detail-tab ${activeTab === 'payment' ? 'active' : ''}`}
          onClick={() => setActiveTab('payment')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Desglose de pago
        </button>
        {order.deliveryMethod === 'rcon' && (
          <button 
            className={`order-detail-tab ${activeTab === 'rcon' ? 'active' : ''}`}
            onClick={() => setActiveTab('rcon')}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="3" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 7h8M6 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Estado RCON
          </button>
        )}
        <button 
          className={`order-detail-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Timeline
        </button>
      </div>

      {/* Content */}
      <div className="order-detail-content">
        {activeTab === 'overview' && (
          <div className="order-detail-grid">
            {/* Columna izquierda */}
            <div className="order-detail-column">
              {/* Usuario Minecraft - destacado */}
              <div className="order-detail-card order-detail-player-card">
                <img 
                  src={`https://mc-heads.net/avatar/${order.minecraftUsername}/80`}
                  alt={order.minecraftUsername}
                  className="order-detail-player-avatar"
                  onError={(e) => e.target.src = 'https://mc-heads.net/avatar/Steve/80'}
                />
                <div className="order-detail-player-info">
                  <div className="order-detail-player-label">Usuario Minecraft</div>
                  <div className="order-detail-player-name">{order.minecraftUsername}</div>
                  <div className="order-detail-player-product">{order.productName}</div>
                </div>
              </div>

              {/* Datos del comprador */}
              <div className="order-detail-card">
                <h3 className="order-detail-card-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  Datos del comprador
                </h3>
                <div className="order-detail-fields">
                  <div className="order-detail-field">
                    <span className="field-label">Email de contacto</span>
                    <span className="field-value">{order.buyerContactEmail || 'No proporcionado'}</span>
                  </div>
                  <div className="order-detail-field">
                    <span className="field-label">Nombre PayPal</span>
                    <span className="field-value">{order.buyerName}</span>
                  </div>
                  <div className="order-detail-field">
                    <span className="field-label">Email PayPal</span>
                    <span className="field-value">{order.buyerPaypalEmail}</span>
                  </div>
                  <div className="order-detail-field">
                    <span className="field-label">Payer ID</span>
                    <span className="field-value field-value-mono">{order.buyerPayerId}</span>
                  </div>
                  <div className="order-detail-field">
                    <span className="field-label">Transaction ID</span>
                    <span className="field-value field-value-mono">{order.transactionId}</span>
                  </div>
                  {order.paymentIp && (
                    <div className="order-detail-field">
                      <span className="field-label">IP del pago</span>
                      <span className="field-value field-value-mono">{order.paymentIp}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="order-detail-column">
              {/* Monto total - simplificado */}
              <div className="order-detail-card order-detail-amount-simple">
                <div className="order-detail-amount-label">Monto total del pedido</div>
                <div className="order-detail-amount-value-large">
                  ${(order.grossAmount || order.amountPaid).toFixed(2)}
                </div>
              </div>

              {/* Datos del producto */}
              <div className="order-detail-card">
                <h3 className="order-detail-card-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Datos del producto
                </h3>
                <div className="order-detail-fields">
                  <div className="order-detail-field">
                    <span className="field-label">Producto</span>
                    <span className="field-value">{order.productName}</span>
                  </div>
                  <div className="order-detail-field">
                    <span className="field-label">Servidor</span>
                    <span className="field-value field-value-mono">{order.serverAddress}</span>
                  </div>
                  {order.commandSent && (
                    <div className="order-detail-field">
                      <span className="field-label">Comando enviado</span>
                      <code className="field-value-code">{order.commandSent}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="order-detail-payment">
            <div className="payment-breakdown-card-v2">
              <h3 className="order-detail-card-title">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Desglose de pago
              </h3>
              <p className="payment-breakdown-subtitle">
                Pago directo a tu cuenta
              </p>

              <div className="payment-breakdown-rows">
                <div className="payment-row payment-row-main">
                  <span>Monto total del pedido</span>
                  <span className="payment-amount">${(order.grossAmount || order.amountPaid).toFixed(2)}</span>
                </div>

                <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(79, 124, 255, 0.08)', border: '1px solid rgba(79, 124, 255, 0.3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7" stroke="#4F7CFF" strokeWidth="1.5"/>
                      <path d="M7 10l2 2 4-4" stroke="#4F7CFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#4F7CFF', fontWeight: '600', marginBottom: '2px' }}>
                        Modo White-Label
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        El pago va directo a la cuenta PayPal Business de la plataforma
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rcon' && order.deliveryMethod === 'rcon' && (
          <div className="order-detail-rcon">
            <div className="order-detail-card">
              <h3 className="order-detail-card-title">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="3" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 7h8M6 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Estado de entrega RCON
              </h3>

              <div className="rcon-status-grid">
                <div className="rcon-status-item">
                  <span className="field-label">Estado RCON</span>
                  <span className={`rcon-status-badge ${
                    order.status === 'delivered' || order.rconJob?.status === 'delivered' ? 'success' :
                    order.rconJob?.status === 'failed' || order.status === 'failed' ? 'failed' :
                    order.rconJob?.status === 'processing' ? 'processing' :
                    'pending'
                  }`}>
                    {order.status === 'delivered' || order.rconJob?.status === 'delivered' ? 'Completado' :
                     order.rconJob?.status === 'failed' || order.status === 'failed' ? 'Fallido' :
                     order.rconJob?.status === 'processing' ? 'Procesando' :
                     'En cola'}
                  </span>
                </div>

                <div className="rcon-status-item">
                  <span className="field-label">Intentos automáticos</span>
                  <span className="field-value">
                    {order.rconAutoAttempts || 0} / {order.rconMaxAttempts || 5}
                  </span>
                </div>

                <div className="rcon-status-item">
                  <span className="field-label">Reintentos manuales</span>
                  <span className="field-value">
                    {order.rconManualAttempts || 0}
                  </span>
                </div>

                {order.rconLastAttempt && (
                  <div className="rcon-status-item">
                    <span className="field-label">Último intento</span>
                    <span className="field-value">
                      {formatDistanceToNow(new Date(order.rconLastAttempt))}
                    </span>
                  </div>
                )}

                {order.rconNextRetry && order.status !== 'delivered' && (
                  <div className="rcon-status-item">
                    <span className="field-label">Próximo reintento automático</span>
                    <span className="field-value" style={{ 
                      color: countdown?.expired ? 'var(--warning)' : 'var(--primary)',
                      fontWeight: '600'
                    }}>
                      {countdown?.expired ? (
                        <>⏳ Procesando...</>
                      ) : countdown ? (
                        <>🕐 en {countdown.text}</>
                      ) : (
                        'Calculando...'
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Entrega parcial - Mostrar qué se entregó y qué falta */}
              {order.rconJob?.is_partial_delivery && (
                <div className="rcon-partial-delivery">
                  <div className="rcon-partial-header">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 3L3 8v7a2 2 0 002 2h10a2 2 0 002-2V8l-7-5z" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 12v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M10 7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <h4>Entrega Parcial Detectada</h4>
                  </div>
                  
                  <p className="rcon-partial-description">
                    Algunos comandos se ejecutaron exitosamente, pero otros fallaron. Solo los comandos fallidos se reintentarán automáticamente.
                  </p>
                  
                  {order.rconJob.delivered_commands && order.rconJob.delivered_commands.length > 0 && (
                    <div className="rcon-command-list rcon-command-list--success">
                      <div className="rcon-command-list-header">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>Comandos Entregados ({order.rconJob.delivered_commands.length})</span>
                      </div>
                      <ul>
                        {order.rconJob.delivered_commands.map((cmd, idx) => (
                          <li key={idx}><code>{cmd}</code></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {order.rconJob.pending_commands && order.rconJob.pending_commands.length > 0 && (
                    <div className="rcon-command-list rcon-command-list--pending">
                      <div className="rcon-command-list-header">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span>Comandos Pendientes ({order.rconJob.pending_commands.length})</span>
                      </div>
                      <ul>
                        {order.rconJob.pending_commands.map((cmd, idx) => (
                          <li key={idx}><code>{cmd}</code></li>
                        ))}
                      </ul>
                      <p className="rcon-pending-note">
                        Estos comandos se reintentarán automáticamente en el próximo ciclo.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {order.rconErrorLog && !order.rconJob?.is_partial_delivery && (
                <>
                  <div className="rcon-error-section">
                    <h4 className="rcon-error-title">Log técnico</h4>
                    <pre className="rcon-error-log">{order.rconErrorLog}</pre>
                  </div>

                  <div className="rcon-error-section">
                    <h4 className="rcon-error-title">Error legible</h4>
                    <p className="rcon-error-message">{order.rconErrorMessage}</p>
                  </div>
                </>
              )}

              {order.rconStatus !== 'delivered' && (
                <div className="rcon-actions">
                  <button 
                    className="btn btn-md btn-primary"
                    onClick={handleRetryRcon}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Reintentando...' : 'Forzar reintento'}
                  </button>
                  <button className="btn btn-md btn-ghost">
                    Ver log completo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <OrderTimeline timeline={order.timeline} />
        )}
      </div>

      {/* Footer con acciones */}
      <div className="order-detail-footer">
        {order.deliveryMethod === 'manual' && order.status !== 'delivered' && (
          <div className="order-detail-footer-content">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Notas del vendedor</label>
              <textarea
                className="textarea"
                placeholder="Anotar detalles sobre la entrega manual..."
                value={sellerNotes}
                onChange={(e) => setSellerNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="order-detail-footer-actions">
              <button 
                className="btn btn-md btn-secondary"
                onClick={handleSaveNotes}
                disabled={isUpdating}
              >
                Guardar notas
              </button>
              <button 
                className="btn btn-md btn-primary"
                onClick={handleMarkDelivered}
                disabled={isUpdating}
              >
                {isUpdating ? 'Marcando...' : 'Marcar como entregado'}
              </button>
            </div>
          </div>
        )}

        <button className="btn btn-md btn-outline">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M3 8l7-5 7 5v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 17v-6h4v6" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Hablar con el comprador
        </button>
      </div>

      {/* Modal de advertencia para reintentos con entrega parcial */}
      {showRetryWarning && (
        <div className="modal-overlay" onClick={() => setShowRetryWarning(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Advertencia: Entrega Parcial</h3>
            </div>
            <div className="modal-body">
              <p>
                Este pedido tuvo una <strong>entrega parcial</strong> — algunos comandos se ejecutaron exitosamente pero otros fallaron.
              </p>
              <p>
                Si reintentas ahora, <strong>todos los comandos se ejecutarán de nuevo</strong>, lo que puede resultar en items duplicados para el comprador.
              </p>
              <p style={{ color: '#FCD34D', fontWeight: 500 }}>
                ¿Estás seguro de que quieres continuar?
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-md btn-ghost" 
                onClick={() => setShowRetryWarning(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-md btn-destructive" 
                onClick={executeRetry}
                disabled={isUpdating}
              >
                {isUpdating ? 'Reintentando...' : 'Sí, reintentar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
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

function formatDistanceToNow(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'ahora mismo';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}


