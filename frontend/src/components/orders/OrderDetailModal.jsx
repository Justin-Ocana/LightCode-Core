import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import OrderTimeline from './OrderTimeline';

export default function OrderDetailModal({ order, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sellerNotes, setSellerNotes] = useState(order.sellerNotes || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true);
    // Simular API call
    setTimeout(() => {
      onUpdate({ ...order, status: newStatus });
      setIsUpdating(false);
    }, 500);
  };

  const handleRetryRcon = async () => {
    setIsUpdating(true);
    try {
      const response = await api.post(`/api/orders/${order.id}/retry_rcon/`);
      
      if (response.data.success) {
        // Refrescar los datos de la orden después del retry
        const updatedOrder = await api.get(`/api/orders/${order.id}/`);
        onUpdate(updatedOrder.data);
      }
    } catch (error) {
      console.error('Error retrying RCON:', error);
      alert('Error al reintentar la entrega RCON');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkDelivered = async () => {
    setIsUpdating(true);
    setTimeout(() => {
      onUpdate({ 
        ...order, 
        status: 'delivered',
        deliveredAt: new Date().toISOString()
      });
      setIsUpdating(false);
    }, 500);
  };

  const handleSaveNotes = async () => {
    setIsUpdating(true);
    setTimeout(() => {
      onUpdate({ ...order, sellerNotes });
      setIsUpdating(false);
    }, 500);
  };

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <h2 className="modal-title">Pedido {order.orderNumber}</h2>
              <span className={`badge ${order.deliveryMethod === 'rcon' ? 'badge-info' : 'badge-free'}`}>
                {order.deliveryMethod === 'rcon' ? 'RCON' : 'MANUAL'}
              </span>
            </div>
            <p className="modal-subtitle">
              {new Date(order.createdAt).toLocaleString('es-ES', {
                dateStyle: 'long',
                timeStyle: 'short'
              })}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Estado actual */}
        <div className="order-status-banner" style={{ borderColor: getStatusColor(order.status) }}>
          <div>
            <div className="order-status-label">Estado actual</div>
            <div className="order-status-value" style={{ color: getStatusColor(order.status) }}>
              {order.status === 'requested' && '🟡 Solicitado'}
              {order.status === 'processing' && '🔵 Procesando'}
              {order.status === 'delivered' && '🟢 Entregado'}
              {order.status === 'failed' && '🔴 Fallido'}
              {order.status === 'cancelled' && '⚫ Cancelado'}
              {order.status === 'refunded' && '🟣 Reembolsado'}
            </div>
          </div>
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <select 
              className="select"
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isUpdating}
              style={{ maxWidth: '200px' }}
            >
              <option value="requested">🟡 Solicitado</option>
              <option value="processing">🔵 Procesando</option>
              <option value="delivered">🟢 Entregado</option>
              <option value="failed">🔴 Fallido</option>
              <option value="cancelled">⚫ Cancelado</option>
              <option value="refunded">🟣 Reembolsado</option>
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="order-tabs">
          <button 
            className={`order-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Vista general
          </button>
          <button 
            className={`order-tab ${activeTab === 'payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('payment')}
          >
            Desglose de pago
          </button>
          {order.deliveryMethod === 'rcon' && (
            <button 
              className={`order-tab ${activeTab === 'rcon' ? 'active' : ''}`}
              onClick={() => setActiveTab('rcon')}
            >
              Estado RCON
            </button>
          )}
          <button 
            className={`order-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {activeTab === 'overview' && (
            <div className="order-detail-grid">
              {/* Datos del comprador */}
              <div className="order-detail-section">
                <h3 className="order-detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  Datos del comprador
                </h3>
                <div className="order-detail-fields">
                  <div className="order-detail-field">
                    <span className="field-label">Nombre PayPal</span>
                    <span className="field-value">{order.buyerName}</span>
                  </div>
                  <div className="order-detail-field">
                    <span className="field-label">Email PayPal</span>
                    <span className="field-value">{order.buyerEmail}</span>
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

              {/* Datos del producto */}
              <div className="order-detail-section">
                <h3 className="order-detail-section-title">
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
                  <div className="order-detail-field order-detail-field-highlight">
                    <span className="field-label">Usuario Minecraft</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <img 
                        src={`https://mc-heads.net/avatar/${order.minecraftUsername}/24`}
                        alt={order.minecraftUsername}
                        style={{ borderRadius: '4px' }}
                        onError={(e) => e.target.src = 'https://mc-heads.net/avatar/Steve/24'}
                      />
                      <span className="field-value">{order.minecraftUsername}</span>
                    </div>
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
          )}

          {activeTab === 'payment' && (
            <div className="order-payment-breakdown">
              <div className="payment-breakdown-card">
                <h3 className="order-detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Desglose de pago
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                  Todos los porcentajes guardados en el momento exacto de la transacción
                </p>

                <div className="payment-breakdown-rows">
                  <div className="payment-row payment-row-main">
                    <span>El comprador pagó</span>
                    <span className="payment-amount">${(order.gross_amount || order.amountPaid || 0).toFixed(2)}</span>
                  </div>

                  {/* Check if this is a direct payment (no lightcode commission) */}
                  {order.payment_method === 'paypal' && order.net_amount ? (
                    <>
                      <div className="payment-row payment-row-fee">
                        <span>
                          PayPal al recibir
                          <span className="payment-percent">(6.90%)</span>
                        </span>
                        <span className="payment-amount">− ${(order.paypal_fee || 0).toFixed(2)}</span>
                      </div>

                      <div className="payment-row-divider"></div>

                      <div className="payment-row payment-row-total">
                        <span>Recibiste en tu PayPal</span>
                        <span className="payment-amount" style={{ color: 'var(--primary)' }}>
                          ${(order.net_amount || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="payment-plan-badge" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="7" stroke="var(--success)" strokeWidth="1.5"/>
                            <path d="M7 10l2 2 4-4" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span style={{ color: 'var(--success)', fontWeight: '500' }}>
                            Pago directo activo
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="payment-row payment-row-fee">
                        <span>
                          PayPal al recibir
                          <span className="payment-percent">({order.paypalReceiveFeePercent}%)</span>
                        </span>
                        <span className="payment-amount">− ${(order.paypalReceiveFee || 0).toFixed(2)}</span>
                      </div>

                      <div className="payment-row payment-row-fee">
                        <span>
                          lightcode
                          <span className="payment-percent">({order.lightcodeFeePercent}%)</span>
                        </span>
                        <span className="payment-amount">− ${(order.lightcodeFee || 0).toFixed(2)}</span>
                      </div>

                      <div className="payment-row-divider"></div>

                      <div className="payment-row payment-row-total">
                        <span>Acreditado a tu balance</span>
                        <span className="payment-amount" style={{ color: 'var(--primary)' }}>
                          ${(order.sellerCredited || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="payment-plan-badge">
                        <span className="badge badge-free">Plan: {order.lightcodePlan === 'pro' ? 'Pro' : 'Starter'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rcon' && order.deliveryMethod === 'rcon' && (
            <div className="order-rcon-status">
              <div className="order-detail-section">
                <h3 className="order-detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Estado de entrega RCON
                </h3>

                <div className="rcon-status-grid">
                  <div className="rcon-status-item">
                    <span className="field-label">Estado RCON</span>
                    <span className={`rcon-status-badge ${
                      order.rcon_job?.status === 'delivered' ? 'success' :
                      order.rcon_job?.status === 'failed' ? 'failed' :
                      order.rcon_job?.status === 'processing' ? 'processing' :
                      'pending'
                    }`}>
                      {order.rcon_job?.status === 'delivered' ? '✅ Exitoso' :
                       order.rcon_job?.status === 'failed' ? '❌ Fallido' :
                       order.rcon_job?.status === 'processing' ? 'Procesando...' :
                       '⏳ En cola'}
                    </span>
                  </div>

                  <div className="rcon-status-item">
                    <span className="field-label">Intentos</span>
                    <span className="field-value">
                      {(order.rcon_job?.auto_retry_count || 0) + (order.rcon_job?.manual_retry_count || 0)} / {order.rcon_job?.max_attempts || 5}
                    </span>
                  </div>

                  {order.rconLastAttempt && (
                    <div className="rcon-status-item">
                      <span className="field-label">Último intento</span>
                      <span className="field-value">
                        {formatDistanceToNow(new Date(order.rconLastAttempt), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                  )}

                  {order.rconNextRetry && order.status !== 'delivered' && (
                    <div className="rcon-status-item">
                      <span className="field-label">Próximo reintento</span>
                      <span className="field-value" style={{ color: 'var(--primary)' }}>
                        {formatDistanceToNow(new Date(order.rconNextRetry), { 
                          addSuffix: true, 
                          locale: es 
                        })} (automático)
                      </span>
                    </div>
                  )}
                </div>

                {order.rconErrorLog && (
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

                {order.status !== 'delivered' && order.rconAttempts < order.rconMaxAttempts && (
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
        <div className="modal-footer">
          {order.deliveryMethod === 'manual' && order.status !== 'delivered' && (
            <>
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
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
            </>
          )}

          <button className="btn btn-md btn-outline">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M3 8l7-5 7 5v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 17v-6h4v6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Hablar con el comprador
          </button>
        </div>
      </div>
    </div>
  );
}
