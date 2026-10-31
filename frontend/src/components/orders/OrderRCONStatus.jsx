import { Server, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ordersAPI } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * OrderRCONStatus - Estado de entrega RCON
 */
export function OrderRCONStatus({ order, countdown, onRetry }) {
  const [isRetrying, setIsRetrying] = useState(false);
  
  if (!order.rconJob) return null;

  const handleRetry = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      const response = await ordersAPI.retryRcon(order.id);
      
      // Mostrar mensaje específico según el resultado
      if (response.data?.message) {
        toast.success(response.data.message);
      } else {
        toast.success('Reintento iniciado. El pedido se procesará en unos segundos.');
      }
      
      // Llamar callback si existe
      if (onRetry) {
        setTimeout(() => onRetry(), 2000);
      }
    } catch (error) {
      console.error('Error al reintentar:', error);
      
      // Mostrar mensaje de error específico
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Error al solicitar reintento';
      toast.error(errorMessage);
    } finally {
      setIsRetrying(false);
    }
  };

  const formatDistanceToNow = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  const getRCONStatusBadge = () => {
    if (order.status === 'delivered' || order.rconJob?.status === 'delivered') {
      return <span className="order-rcon-status-badge success">Completado</span>;
    }
    if (order.rconJob?.status === 'failed' || order.status === 'failed') {
      return <span className="order-rcon-status-badge failed">Fallido</span>;
    }
    if (order.rconJob?.status === 'processing') {
      return <span className="order-rcon-status-badge processing">Procesando</span>;
    }
    return <span className="order-rcon-status-badge pending">En cola</span>;
  };

  return (
    <div className="order-rcon-card">
      <div className="order-rcon-header">
        <div className="order-card-icon order-card-icon-info">
          <Server size={20} />
        </div>
        <div>
          <h3 className="order-card-title">Estado de entrega RCON</h3>
        </div>
      </div>

      <div className="order-rcon-status-grid">
        <div className="order-rcon-status-item">
          <span className="order-field-label">Estado RCON</span>
          {getRCONStatusBadge()}
        </div>

        <div className="order-rcon-status-item">
          <span className="order-field-label">Intentos automáticos</span>
          <span className="order-field-value">
            {order.rconAutoAttempts || 0} / {order.rconMaxAttempts || 5}
          </span>
        </div>

        <div className="order-rcon-status-item">
          <span className="order-field-label">Reintentos manuales</span>
          <span className="order-field-value">
            {order.rconManualAttempts || 0}
          </span>
        </div>

        {order.rconLastAttempt && (
          <div className="order-rcon-status-item">
            <span className="order-field-label">Último intento</span>
            <span className="order-field-value">
              {formatDistanceToNow(order.rconLastAttempt)}
            </span>
          </div>
        )}

        {order.rconNextRetry && order.status !== 'delivered' && (
          <div className="order-rcon-status-item">
            <span className="order-field-label">Próximo reintento automático</span>
            <span className="order-field-value" style={{ 
              color: countdown?.expired ? '#FB923C' : '#4F7CFF',
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

      {/* Entrega parcial */}
      {order.rconJob?.is_partial_delivery && (
        <div className="order-rcon-partial">
          <div className="order-rcon-partial-header">
            <AlertTriangle size={20} />
            <h4>Entrega Parcial Detectada</h4>
          </div>
          
          <p className="order-rcon-partial-description">
            Algunos comandos se ejecutaron exitosamente, pero otros fallaron. Solo los comandos fallidos se reintentarán automáticamente.
          </p>
          
          <div className="order-rcon-commands">
            {order.rconJob.delivered_commands && order.rconJob.delivered_commands.length > 0 && (
              <div className="order-rcon-command-group success">
                <div className="order-rcon-command-header success">
                  <CheckCircle2 size={16} />
                  <span>Comandos Entregados ({order.rconJob.delivered_commands.length})</span>
                </div>
                <ul className="order-rcon-command-list">
                  {order.rconJob.delivered_commands.map((cmd, idx) => (
                    <li key={idx}>{cmd}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {order.rconJob.pending_commands && order.rconJob.pending_commands.length > 0 && (
              <div className="order-rcon-command-group pending">
                <div className="order-rcon-command-header pending">
                  <Clock size={16} />
                  <span>Comandos Pendientes ({order.rconJob.pending_commands.length})</span>
                </div>
                <ul className="order-rcon-command-list">
                  {order.rconJob.pending_commands.map((cmd, idx) => (
                    <li key={idx}>{cmd}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de error */}
      {order.rconJob?.failure_reason && order.rconJob?.status === 'failed' && !order.rconJob?.is_partial_delivery && (
        <div className="order-rcon-error">
          <AlertTriangle size={18} />
          <p>{order.rconJob.failure_reason}</p>
        </div>
      )}
      
      {/* Botón de reintento manual */}
      {(order.rconJob?.status === 'failed' || order.rconJob?.status === 'pending') && order.status !== 'delivered' && (
        <div className="order-rcon-actions">
          <button
            className="order-rcon-retry-btn"
            onClick={handleRetry}
            disabled={isRetrying}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #4F7CFF 0%, #00D4AA 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              opacity: isRetrying ? 0.6 : 1,
              transition: 'all 0.2s',
              width: '100%',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={16} className={isRetrying ? 'spinning' : ''} />
            {isRetrying ? 'Reintentando...' : 'Reintentar Entrega Manualmente'}
          </button>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            marginTop: '8px',
            marginBottom: 0
          }}>
            Este reintento no cuenta para el límite de intentos automáticos
          </p>
        </div>
      )}
    </div>
  );
}
