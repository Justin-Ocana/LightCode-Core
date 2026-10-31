import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useNotifications } from '../../context/NotificationContext';
import { useCountdown } from '../../hooks/useCountdown';
import { ArrowLeft, FileText } from 'lucide-react';
import api from '../../services/api';
import OrderTimeline from '../../components/orders/OrderTimeline';
import { OrderHero } from '../../components/orders/OrderHero';
import { OrderPlayerCard } from '../../components/orders/OrderPlayerCard';
import { OrderBuyerInfo } from '../../components/orders/OrderBuyerInfo';
import { OrderProductInfo } from '../../components/orders/OrderProductInfo';
import { OrderAmountCard } from '../../components/orders/OrderAmountCard';
import { OrderPaymentBreakdown } from '../../components/orders/OrderPaymentBreakdown';
import { OrderRCONStatus } from '../../components/orders/OrderRCONStatus';
import '../../styles/order-detail-v2.css';

/**
 * OrderDetailV2 - Vista de detalle de pedido completamente reescrita
 * - Diseño moderno y responsive
 * - Componentes modulares JSX
 * - Arregla problema de $NaN
 * - Elimina sección "Recibes" (white-label)
 * - Mejora botón "Marcar entregado"
 * - Implementa cambio de estado funcional
 */
export default function OrderDetailV2() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const { showToast } = useNotifications();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Countdown para próximo reintento RCON
  const countdown = useCountdown(order?.rconNextRetry);

  // Cargar pedido
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
          
          // Montos - ARREGLADO: Asegurar que sean números válidos
          originalAmount: parseFloat(orderData.original_amount) || 0,
          discountCode: orderData.discount_code,
          discountType: orderData.discount_type,
          discountValue: parseFloat(orderData.discount_value) || 0,
          discountSaved: parseFloat(orderData.discount_amount_saved) || 0,
          amountPaid: parseFloat(orderData.amount_after_discount) || 0,
          
          // Pagos directos PayPal
          paymentMethod: orderData.payment_method,
          grossAmount: parseFloat(orderData.gross_amount || orderData.amount_after_discount) || 0,
          paypalFee: parseFloat(orderData.paypal_fee) || 0,
          netAmount: parseFloat(orderData.net_amount) || 0,
          
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

  // Manejar cambio de estado
  const handleStatusChange = async (newStatus) => {
    if (!order) return;
    
    // Caso especial: reintentar RCON
    if (newStatus === 'retry') {
      return handleRetryRcon();
    }
    
    // Validar que el cambio de estado sea válido
    if (order.deliveryMethod !== 'manual' && newStatus === 'delivered') {
      showToast({
        type: 'error',
        title: 'Acción no permitida',
        message: 'Solo los pedidos con entrega manual pueden marcarse como entregados manualmente',
        duration: 5000
      });
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
      
      showToast({
        type: 'success',
        title: 'Estado actualizado',
        message: `El pedido ahora está en estado: ${getStatusLabel(newStatus)}`,
        duration: 5000
      });
    } catch (err) {
      console.error('Error actualizando estado:', err);
      
      // Extraer mensaje de error del backend
      let errorMessage = 'No se pudo actualizar el estado';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        }
      }
      
      showToast({
        type: 'error',
        title: 'Error al actualizar',
        message: errorMessage,
        duration: 5000
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Reintentar RCON
  const handleRetryRcon = async () => {
    if (!order || !order.rconJob) return;
    
    try {
      setIsUpdating(true);
      
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
          message: orderData.rcon_job.failure_reason,
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

  // Utilidades
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

  // Loading state
  if (loading) {
    return (
      <div className="order-loading">
        <div className="spinner"></div>
        <p>Cargando pedido...</p>
      </div>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <div className="order-error">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 8v4M12 16v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h2>{error ? 'Error al cargar' : 'Pedido no encontrado'}</h2>
        <p>{error || 'El pedido que buscas no existe o fue eliminado'}</p>
        <Link to={`/dashboard/${activeStore?.slug}/orders`} className="btn btn-md btn-primary">
          Volver a pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="order-detail-v2">
      {/* Breadcrumb */}
      <div className="order-breadcrumb">
        <Link 
          to={`/dashboard/${activeStore?.slug}/orders`} 
          className="order-breadcrumb-link"
        >
          <ArrowLeft size={16} />
          Pedidos
        </Link>
        <span className="order-breadcrumb-separator">/</span>
        <span className="order-breadcrumb-current">{order.orderNumber}</span>
      </div>

      {/* Hero */}
      <OrderHero 
        order={order}
        onStatusChange={handleStatusChange}
        isUpdating={isUpdating}
        getStatusLabel={getStatusLabel}
        getStatusColor={getStatusColor}
      />

      {/* Tabs */}
      <div className="order-tabs">
        <button 
          className={`order-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FileText size={18} />
          Vista general
        </button>
        <button 
          className={`order-tab ${activeTab === 'payment' ? 'active' : ''}`}
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
            className={`order-tab ${activeTab === 'rcon' ? 'active' : ''}`}
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
          className={`order-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Timeline
        </button>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <>
          <OrderPlayerCard order={order} />
          
          <div className="order-content">
            <div>
              <OrderBuyerInfo order={order} />
            </div>
            
            <div>
              <OrderAmountCard order={order} />
              <OrderProductInfo order={order} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'payment' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <OrderPaymentBreakdown order={order} />
        </div>
      )}

      {activeTab === 'rcon' && order.deliveryMethod === 'rcon' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <OrderRCONStatus 
            order={order} 
            countdown={countdown}
            onRetry={() => fetchOrder()}
          />
        </div>
      )}

      {activeTab === 'timeline' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <OrderTimeline timeline={order.timeline} />
        </div>
      )}
    </div>
  );
}
