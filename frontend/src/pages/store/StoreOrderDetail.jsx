import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { useCountdown } from '../../hooks/useCountdown';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ArrowLeft,
  Calendar,
  DollarSign,
  Gamepad2,
  Server,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  Mail,
  User,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { useBuyer } from '../../context/BuyerContext';
import { getMediaUrl } from '../../services/api';
import toast from 'react-hot-toast';
import '../../styles/store/buttons.css';
import '../../styles/store/order-detail.css';

/**
 * StoreOrderDetail - Página de detalle de pedido para compradores
 * Muestra estado RCON y permite solicitar reintentos
 * Requiere autenticación como buyer
 */
export function StoreOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { store } = useOutletContext();
  const { buyer, loading: buyerLoading } = useBuyer();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  
  // Countdown para próximo reintento RCON
  const countdown = useCountdown(order?.rcon_job?.next_retry_at);

  // Redirigir a login si no está autenticado
  useEffect(() => {
    if (!buyerLoading && !buyer) {
      navigate('/login?redirect=orders');
    }
  }, [buyer, buyerLoading, navigate]);

  useEffect(() => {
    if (store && buyer) {
      loadOrderDetail();
    }
  }, [store, buyer, orderId]);
  
  // Auto-refresh cuando el countdown expira (para obtener nuevo next_retry_at)
  useEffect(() => {
    if (countdown?.expired && order?.rcon_job?.status === 'pending' && order?.rcon_job?.attempts < 5) {
      // Esperar 3 segundos después de expirar y recargar
      const timer = setTimeout(() => {
        loadOrderDetail();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [countdown?.expired, order?.rcon_job?.status, order?.rcon_job?.attempts]);

  const loadOrderDetail = async () => {
    try {
      setLoading(true);
      
      // Endpoint público que solo requiere email (sin autenticación)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stores/${store.slug}/orders/${orderId}/?email=${encodeURIComponent(buyer.user.email)}`
      );

      if (!response.ok) {
        throw new Error('Error al cargar el pedido');
      }

      const data = await response.json();
      setOrder(data);
      
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('No se pudo cargar el pedido');
      navigate(`/orders`);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryRCON = async () => {
    if (!order || !order.rcon_job) return;
    
    try {
      setRetrying(true);
      
      // Endpoint público que solo requiere email (sin autenticación)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stores/${store.slug}/orders/${orderId}/retry-rcon/?email=${encodeURIComponent(buyer.user.email)}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al solicitar reintento');
      }

      const data = await response.json();
      toast.success(data.message || 'Reintento iniciado');
      
      // Recargar pedido después de 2 segundos
      setTimeout(() => {
        loadOrderDetail();
      }, 2000);
      
    } catch (error) {
      console.error('Error retrying RCON:', error);
      toast.error(error.message || 'No se pudo solicitar el reintento');
    } finally {
      setRetrying(false);
    }
  };

  // Obtener icono y color por estado
  const getStatusInfo = (status) => {
    switch (status) {
      case 'requested':
        return { icon: Clock, label: 'Solicitado', color: 'warning' };
      case 'processing':
        return { icon: AlertCircle, label: 'Procesando', color: 'info' };
      case 'delivered':
        return { icon: CheckCircle2, label: 'Entregado', color: 'success' };
      case 'failed':
        return { icon: XCircle, label: 'Fallido', color: 'error' };
      case 'cancelled':
        return { icon: XCircle, label: 'Cancelado', color: 'muted' };
      default:
        return { icon: Package, label: status, color: 'muted' };
    }
  };

  // Obtener info del estado RCON
  const getRCONStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, label: 'Pendiente', color: 'warning', description: 'Esperando procesamiento' };
      case 'processing':
        return { icon: RefreshCw, label: 'Procesando', color: 'info', description: 'Ejecutando comando RCON' };
      case 'delivered':
        return { icon: CheckCircle2, label: 'Entregado', color: 'success', description: 'Comando ejecutado exitosamente' };
      case 'failed':
        return { icon: XCircle, label: 'Fallido', color: 'error', description: 'No se pudo entregar' };
      default:
        return { icon: AlertCircle, label: status, color: 'muted', description: '' };
    }
  };

  if (!store || buyerLoading || loading) {
    return null; // StoreLayout handles loading
  }

  if (!order) return null;

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;
  const hasRCON = order.delivery_method === 'rcon' && order.rcon_job;
  const rconInfo = hasRCON ? getRCONStatusInfo(order.rcon_job.status) : null;
  const RCONIcon = rconInfo?.icon;

  return (
    <div className="store-page">
      <div className="store-container">
        <div className="store-order-detail">
          {/* Back button */}
          <Link to={`/orders`} className="store-order-detail__back">
            <ArrowLeft size={20} />
            Volver a mis pedidos
          </Link>

          {/* Hero unificado - Branding + Info del pedido integrados */}
          <div className="store-order-detail__hero">
            {/* Branding de la tienda con propósito claro */}
            <Link to={`/`} className="store-order-detail__store-brand">
              {store.logo_url ? (
                <>
                  <img 
                    src={getMediaUrl(store.logo_url)} 
                    alt={store.name}
                    className="store-order-detail__store-logo"
                  />
                  <div className="store-order-detail__store-info">
                    <span className="store-order-detail__store-name">{store.name}</span>
                    <span className="store-order-detail__store-tagline">Ver tienda →</span>
                  </div>
                </>
              ) : (
                <div className="store-order-detail__store-info store-order-detail__store-info--no-logo">
                  <span className="store-order-detail__store-name">{store.name}</span>
                  <span className="store-order-detail__store-tagline">Ver tienda →</span>
                </div>
              )}
            </Link>

            {/* Información del pedido */}
            <div className="store-order-detail__order-info">
              <h1 className="store-order-detail__title">
                <Package size={28} />
                Pedido {order.order_number}
              </h1>
              <div className="store-order-detail__header-meta">
                <div className={`store-order-detail__status store-order-detail__status--${statusInfo.color}`}>
                  <StatusIcon size={18} />
                  <span>{statusInfo.label}</span>
                </div>
                <span className="store-order-detail__date">
                  {new Date(order.created_at).toLocaleDateString('es-ES', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* RCON Status Card (si aplica) */}
          {hasRCON && (
            <div className={`store-order-detail__rcon-card store-order-detail__rcon-card--${rconInfo.color}`}>
              <div className="store-order-detail__rcon-header">
                <div className="store-order-detail__rcon-icon">
                  <Server size={24} />
                </div>
                <div>
                  <h3>Entrega Automática RCON</h3>
                  <p>Estado de la entrega en el servidor</p>
                </div>
              </div>

              <div className="store-order-detail__rcon-status">
                <div className="store-order-detail__rcon-status-badge">
                  <RCONIcon size={20} />
                  <span>{rconInfo.label}</span>
                </div>
                <p>{rconInfo.description}</p>
              </div>

              {/* Entrega parcial - Mostrar qué se entregó y qué falta */}
              {order.rcon_job.is_partial_delivery && (
                <div className="store-order-detail__partial-delivery">
                  <div className="store-order-detail__partial-header">
                    <AlertTriangle size={20} />
                    <h4>Entrega Parcial</h4>
                  </div>
                  
                  {order.rcon_job.delivered_commands && order.rcon_job.delivered_commands.length > 0 && (
                    <div className="store-order-detail__command-list store-order-detail__command-list--success">
                      <div className="store-order-detail__command-list-header">
                        <CheckCircle2 size={16} />
                        <span>Entregados ({order.rcon_job.delivered_commands.length})</span>
                      </div>
                      <ul>
                        {order.rcon_job.delivered_commands.map((cmd, idx) => (
                          <li key={idx}>{cmd}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {order.rcon_job.pending_commands && order.rcon_job.pending_commands.length > 0 && (
                    <div className="store-order-detail__command-list store-order-detail__command-list--pending">
                      <div className="store-order-detail__command-list-header">
                        <Clock size={16} />
                        <span>Pendientes ({order.rcon_job.pending_commands.length})</span>
                      </div>
                      <ul>
                        {order.rcon_job.pending_commands.map((cmd, idx) => (
                          <li key={idx}>{cmd}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <p className="store-order-detail__partial-note">
                    Los comandos pendientes se reintentarán automáticamente.
                  </p>
                </div>
              )}

              {/* Información de intentos - Solo mostrar si NO está entregado */}
              {order.rcon_job.status !== 'delivered' && (
                <div className="store-order-detail__rcon-attempts">
                  <div className="store-order-detail__rcon-stat">
                    <span className="label">Intentos</span>
                    <span className="value">{order.rcon_job.attempts} / {order.rcon_job.max_attempts}</span>
                  </div>
                  {order.rcon_job.last_attempt_at && (
                    <div className="store-order-detail__rcon-stat">
                      <span className="label">Último intento</span>
                      <span className="value">
                        {new Date(order.rcon_job.last_attempt_at).toLocaleString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  {order.rcon_job.next_retry_at && order.rcon_job.status === 'pending' && order.rcon_job.attempts < 5 && (
                    <div className="store-order-detail__rcon-stat">
                      <span className="label">Próximo reintento</span>
                      <span className="value" style={{ 
                        color: countdown?.expired ? '#f59e0b' : '#3b82f6',
                        fontWeight: '600'
                      }}>
                        {countdown?.expired ? (
                          <>Procesando...</>
                        ) : countdown ? (
                          <>en {countdown.text}</>
                        ) : (
                          'Calculando...'
                        )}
                      </span>
                    </div>
                  )}
                  {order.rcon_job.attempts >= 5 && (
                    <div className="store-order-detail__rcon-stat">
                      <span className="label">Estado</span>
                      <span className="value" style={{ color: '#ef4444' }}>
                        ⚠️ Reintentos agotados
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Mensaje de error si existe (solo si NO hay entrega parcial) */}
              {order.rcon_job.failure_reason && order.rcon_job.status === 'failed' && !order.rcon_job.is_partial_delivery && (
                <div className="store-order-detail__rcon-error">
                  <AlertTriangle size={18} />
                  <p>{order.rcon_job.failure_reason}</p>
                </div>
              )}

              {/* Botón de reintento (solo si no está entregado) */}
              {order.rcon_job.status !== 'delivered' && (
                <button 
                  className="store-btn store-btn--primary store-order-detail__retry-btn"
                  onClick={handleRetryRCON}
                  disabled={retrying}
                >
                  <RefreshCw size={18} className={retrying ? 'spinning' : ''} />
                  {retrying ? 'Solicitando reintento...' : 'Solicitar reintento manual'}
                </button>
              )}

              {/* Mensaje de éxito - Más prominente */}
              {order.rcon_job.status === 'delivered' && order.rcon_job.delivered_at && (
                <div className="store-order-detail__rcon-success">
                  <CheckCircle2 size={24} />
                  <div>
                    <strong>¡Entregado exitosamente!</strong>
                    <p>
                      {new Date(order.rcon_job.delivered_at).toLocaleString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Product Info */}
          <div className="store-order-detail__product">
            {order.product_snapshot?.image_url && (
              <img 
                src={getMediaUrl(order.product_snapshot.image_url)}
                alt={order.product_snapshot.name}
                className="store-order-detail__product-image"
              />
            )}
            <div className="store-order-detail__product-info">
              <h2>{order.product_snapshot?.name || 'Producto'}</h2>
              {order.product_snapshot?.description && (
                <p>{order.product_snapshot.description}</p>
              )}
            </div>
          </div>

          {/* Order Details - Grid 2x2 perfecto */}
          <div className="store-order-detail__details">
            <h3>Detalles del Pedido</h3>
            
            <div className="store-order-detail__detail-cards">
              {/* Fila 1 */}
              <div className="store-order-detail__detail-card">
                <div className="store-order-detail__detail-icon">
                  <Gamepad2 size={20} />
                </div>
                <div className="store-order-detail__detail-content">
                  <span className="label">Usuario de Minecraft</span>
                  <span className="value">{order.minecraft_username}</span>
                </div>
              </div>

              <div className="store-order-detail__detail-card">
                <div className="store-order-detail__detail-icon">
                  <Calendar size={20} />
                </div>
                <div className="store-order-detail__detail-content">
                  <span className="label">Fecha de compra</span>
                  <span className="value">
                    {new Date(order.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Fila 2 */}
              <div className="store-order-detail__detail-card store-order-detail__detail-card--highlight">
                <div className="store-order-detail__detail-icon">
                  <DollarSign size={24} />
                </div>
                <div className="store-order-detail__detail-content">
                  <span className="label">Total pagado</span>
                  <span className="value value--large">${Number(order.amount_after_discount).toFixed(2)}</span>
                </div>
              </div>

              {order.delivered_at ? (
                <div className="store-order-detail__detail-card">
                  <div className="store-order-detail__detail-icon">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="store-order-detail__detail-content">
                    <span className="label">Fecha de entrega</span>
                    <span className="value">
                      {new Date(order.delivered_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="store-order-detail__detail-card store-order-detail__detail-card--empty">
                  <div className="store-order-detail__detail-icon">
                    <Clock size={20} />
                  </div>
                  <div className="store-order-detail__detail-content">
                    <span className="label">Estado</span>
                    <span className="value">Pendiente de entrega</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details - Información de PayPal */}
          <div className="store-order-detail__payment">
            <h3>Información de Pago</h3>
            
            <div className="store-order-detail__payment-cards">
              {order.buyer_paypal_name && (
                <div className="store-order-detail__payment-card">
                  <div className="store-order-detail__payment-icon">
                    <User size={18} />
                  </div>
                  <div className="store-order-detail__payment-content">
                    <span className="label">Nombre en PayPal</span>
                    <span className="value">{order.buyer_paypal_name}</span>
                  </div>
                </div>
              )}

              {order.buyer_paypal_email && (
                <div className="store-order-detail__payment-card">
                  <div className="store-order-detail__payment-icon">
                    <Mail size={18} />
                  </div>
                  <div className="store-order-detail__payment-content">
                    <span className="label">Email de PayPal</span>
                    <span className="value">{order.buyer_paypal_email}</span>
                  </div>
                </div>
              )}

              {order.paypal_transaction_id && (
                <div className="store-order-detail__payment-card">
                  <div className="store-order-detail__payment-icon">
                    <CreditCard size={18} />
                  </div>
                  <div className="store-order-detail__payment-content">
                    <span className="label">ID de Transacción</span>
                    <span className="value">{order.paypal_transaction_id}</span>
                  </div>
                </div>
              )}

              {order.payment_captured_at && (
                <div className="store-order-detail__payment-card">
                  <div className="store-order-detail__payment-icon">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="store-order-detail__payment-content">
                    <span className="label">Pago capturado</span>
                    <span className="value">
                      {new Date(order.payment_captured_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Help Section - Con acción clara */}
          <div className="store-order-detail__help">
            <MessageCircle size={32} />
            <h3>¿Necesitas ayuda con tu pedido?</h3>
            <p>
              Si tienes algún problema con tu compra o necesitas asistencia, nuestro equipo de soporte está disponible para ayudarte.
            </p>
            {store.discord_invite ? (
              <a 
                href={store.discord_invite} 
                target="_blank" 
                rel="noopener noreferrer"
                className="store-btn store-btn--primary"
              >
                <MessageCircle size={20} />
                Contactar en Discord
                <ExternalLink size={16} />
              </a>
            ) : (
              <button 
                className="store-btn store-btn--secondary" 
                disabled
                title="Esta tienda aún no ha configurado un canal de soporte"
              >
                <MessageCircle size={20} />
                Soporte no disponible
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
