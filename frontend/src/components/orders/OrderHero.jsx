import { Clock, Package } from 'lucide-react';

/**
 * OrderHero - Header hero del pedido con información principal y estado
 */
export function OrderHero({ order, onStatusChange, isUpdating, getStatusLabel, getStatusColor }) {
  return (
    <div className="order-hero">
      <div className="order-hero-top">
        <div className="order-hero-info">
          <div className="order-hero-badges">
            <span className={`badge ${order.deliveryMethod === 'rcon' ? 'badge-info' : 'badge-free'}`}>
              {order.deliveryMethod === 'rcon' ? 'RCON' : 'Manual'}
            </span>
            <span className="order-hero-date">
              <Clock size={14} />
              {new Date(order.createdAt).toLocaleString('es-ES', {
                dateStyle: 'long',
                timeStyle: 'short'
              })}
            </span>
          </div>
          <h1 className="order-hero-title">
            <Package size={32} style={{ display: 'inline-block', marginRight: '12px' }} />
            Pedido {order.orderNumber}
          </h1>
          <p className="order-hero-subtitle">
            {order.productName} · {order.minecraftUsername}
          </p>
        </div>

        {/* Status Card */}
        <div 
          className="order-status-card" 
          style={{ borderColor: getStatusColor(order.status) }}
        >
          <div className="order-status-label">Estado actual</div>
          <div 
            className="order-status-value" 
            style={{ color: getStatusColor(order.status) }}
          >
            {getStatusLabel(order.status)}
          </div>
          
          <div className="order-status-actions">
            {/* Botón Reintentar RCON */}
            {order.status === 'failed' && order.deliveryMethod === 'rcon' && (
              <button 
                className="btn btn-sm btn-danger-outline"
                onClick={() => onStatusChange('retry')}
                disabled={isUpdating}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 10c-1.5-4.5-5.5-7-10-7-5.5 0-10 4.5-10 10s4.5 10 10 10c4 0 7.5-2.5 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isUpdating ? 'Reintentando...' : 'Reintentar'}
              </button>
            )}
            
            {/* Botón Marcar Entregado */}
            {order.status === 'requested' && order.deliveryMethod === 'manual' && (
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => onStatusChange('delivered')}
                disabled={isUpdating}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isUpdating ? 'Marcando...' : 'Marcar entregado'}
              </button>
            )}

            {/* Selector de estado para entrega manual */}
            {order.status !== 'delivered' && order.status !== 'cancelled' && order.deliveryMethod === 'manual' && (
              <select 
                className="input input-sm"
                value={order.status}
                onChange={(e) => onStatusChange(e.target.value)}
                disabled={isUpdating}
                style={{ marginTop: 'var(--space-2)' }}
              >
                <option value="requested">Solicitado</option>
                <option value="delivered">Entregado</option>
                <option value="failed">Fallido</option>
                <option value="cancelled">Cancelado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
