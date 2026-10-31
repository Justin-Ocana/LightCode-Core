import { useEffect, useState, useRef } from 'react';
import { useStoreSlug } from '../../hooks/useStoreSlug';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Package, User, Gamepad2, Calendar, CreditCard, ArrowRight, Home } from 'lucide-react';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { usePublicStore } from '../../hooks/usePublicStore';
import { useCart } from '../../context/CartContext';
import { getMediaUrl } from '../../services/api';
import toast from 'react-hot-toast';
import '../../styles/store/buttons.css';
import '../../styles/store/checkout-result.css';

/**
 * StoreCheckoutSuccess - Página de confirmación después de pago exitoso
 * Compatible con sistema de personalización de tienda
 */
export function StoreCheckoutSuccess() {
  const storeSlug = useStoreSlug();
  const { store, categories, loading: storeLoading } = usePublicStore(storeSlug);


  if (storeLoading && !store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={storeSlug || 'Cargando...'}
        message="Procesando tu pago..."
      />
    );
  }

  if (!store) {
    return null;
  }

  return <StoreCheckoutSuccessContent store={store} categories={categories} />;
}

function StoreCheckoutSuccessContent({ store, categories }) {
  const storeSlug = useStoreSlug();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const captureAttemptedRef = useRef(false); // Prevent duplicate calls in React strict mode

  const token = searchParams.get('token'); // PayPal order ID

  useEffect(() => {
    if (!token) {
      toast.error('No se encontró información de la orden');
      navigate(`/checkout`);
      return;
    }

    // Prevent duplicate calls in React strict mode
    if (captureAttemptedRef.current) {
      return;
    }

    captureAttemptedRef.current = true;
    capturePayment();
  }, [token, storeSlug]);

  const capturePayment = async () => {
    try {
      setLoading(true);
      
  
      
      // 🔴 NUEVO FLUJO: Capturar el pago y crear la orden en la DB
      const captureResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/stores/${storeSlug}/checkout/capture-direct-paypal-order/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: token
          })
        }
      );

      if (!captureResponse.ok) {
        const errorData = await captureResponse.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error al procesar el pago');
      }

      const data = await captureResponse.json();
      
      
      if (data.success && data.order) {
        setOrder(data.order);
        
        // Guardar el email del comprador en localStorage para futuras consultas
        if (data.order.buyer_paypal_email) {
          localStorage.setItem(`buyer_email_${storeSlug}`, data.order.buyer_paypal_email);
        }
        
        // Vaciar el carrito después de la compra exitosa (silenciosamente)
        await clearCart(true);
        
        toast.success('¡Pago procesado exitosamente!');
      } else {
        throw new Error('No se recibió información de la orden');
      }
      
    } catch (err) {
      setError(err.message);
      toast.error('Hubo un problema al procesar tu pago');
    } finally {
      setLoading(false);
    }
  };

  if (!store) return null;

  if (loading) {
    return (
      <StoreBrandLoader
        overlay
        storeName={store.name}
        logoUrl={getMediaUrl(store.logo_url)}
        message="Procesando tu pago..."
      />
    );
  }

  if (error || !order) {
    return (
      <div className="store-page">
        <div className="store-container">
          <div className="store-checkout-result store-checkout-result--error">
            <div className="store-checkout-result__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1>Error al procesar el pago</h1>
            <p>{error || 'No se pudo completar tu compra'}</p>
            <Link to={`/checkout`} className="store-btn store-btn--primary">
              Volver al checkout
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="store-page">
        <div className="store-container">
          <div className="store-checkout-result store-checkout-result--success">
            {/* Icono de éxito */}
            <div className="store-checkout-result__icon">
              <CheckCircle2 size={64} />
            </div>

            {/* Título */}
            <h1 className="store-checkout-result__title">
              ¡Compra completada!
            </h1>
            <p className="store-checkout-result__subtitle">
              Tu pedido ha sido procesado exitosamente
            </p>

            {/* Número de orden */}
            <div className="store-checkout-result__order-number">
              <span>Orden</span>
              <strong>{order.order_number}</strong>
            </div>

            {/* Detalles de la orden */}
            <div className="store-checkout-result__details">
              <div className="store-checkout-result__detail">
                <div className="store-checkout-result__detail-icon">
                  <User size={20} />
                </div>
                <div className="store-checkout-result__detail-content">
                  <span className="store-checkout-result__detail-label">Comprador</span>
                  <span className="store-checkout-result__detail-value">{order.buyer_paypal_email}</span>
                </div>
              </div>

              <div className="store-checkout-result__detail">
                <div className="store-checkout-result__detail-icon">
                  <Gamepad2 size={20} />
                </div>
                <div className="store-checkout-result__detail-content">
                  <span className="store-checkout-result__detail-label">Usuario Minecraft</span>
                  <span className="store-checkout-result__detail-value">{order.minecraft_username}</span>
                </div>
              </div>

              <div className="store-checkout-result__detail">
                <div className="store-checkout-result__detail-icon">
                  <CreditCard size={20} />
                </div>
                <div className="store-checkout-result__detail-content">
                  <span className="store-checkout-result__detail-label">Monto pagado</span>
                  <span className="store-checkout-result__detail-value">
                    ${Number(order.gross_amount || order.amount_after_discount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="store-checkout-result__detail">
                <div className="store-checkout-result__detail-icon">
                  <Calendar size={20} />
                </div>
                <div className="store-checkout-result__detail-content">
                  <span className="store-checkout-result__detail-label">Fecha</span>
                  <span className="store-checkout-result__detail-value">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="store-checkout-result__detail">
                <div className="store-checkout-result__detail-icon">
                  <Package size={20} />
                </div>
                <div className="store-checkout-result__detail-content">
                  <span className="store-checkout-result__detail-label">Producto</span>
                  <span className="store-checkout-result__detail-value">
                    {order.product_snapshot?.name || 'Producto'}
                  </span>
                </div>
              </div>
            </div>

            {/* Estado de entrega */}
            <div className="store-checkout-result__delivery-status">
              {order.delivery_method === 'rcon' ? (
                <>
                  <div className="store-checkout-result__delivery-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <strong>Entrega automática en proceso</strong>
                    <p>Tu compra se entregará automáticamente en el servidor en unos momentos.</p>
                  </div>
                </>
              ) : order.delivery_method === 'plugin' ? (
                <>
                  <div className="store-checkout-result__delivery-icon" style={{ color: '#10B981' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Entrega automática — Bedrock
                    </strong>
                    <p>Tu compra está lista para ser reclamada en el servidor.</p>
                    <div style={{ marginTop: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '0.875rem 1.25rem' }}>
                      <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>¿Cómo recibir tus items?</p>
                      <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.8, margin: 0 }}>
                        <li>Entra al servidor de Minecraft</li>
                        <li>Asegúrate de tener espacio libre en tu inventario</li>
                        <li>Escribe en el chat: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#6ee7b7' }}>!{import.meta.env.VITE_PLUGIN_COMMAND || 'shop'} claim</code></li>
                        <li>Si tienes varias compras, repite el comando por cada una</li>
                      </ol>
                      <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Si no estás conectado, recibirás el aviso automáticamente cuando entres al servidor.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="store-checkout-result__delivery-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <div>
                    {order.manual_reason === 'limit_reached' ? (
                      <>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          Entrega en proceso manual
                        </strong>
                        <p>
                          Tu pago fue recibido correctamente. La tienda ha alcanzado su límite de entregas automáticas
                          por este mes, por lo que tu pedido será procesado manualmente por el vendedor.
                          No te preocupes — recibirás tu compra en breve.
                        </p>
                        <div style={{ marginTop: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                          </svg>
                          Puedes revisar el estado de tu pedido en <strong>Mis pedidos</strong> en cualquier momento.
                        </div>
                      </>
                    ) : (
                      <>
                        <strong>Entrega manual</strong>
                        <p>Un administrador procesará tu pedido pronto. Recibirás una notificación cuando esté listo.</p>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Acciones */}
            <div className="store-checkout-result__actions">
              <Link 
                to={`/orders`} 
                className="store-btn store-btn--primary"
              >
                <Package size={20} />
                Ver mis pedidos
                <ArrowRight size={20} />
              </Link>
              
              <Link 
                to={``} 
                className="store-btn store-btn--secondary"
              >
                <Home size={20} />
                Volver al inicio
              </Link>
            </div>

            {/* Información adicional */}
            <div className="store-checkout-result__info">
              <p>
                <strong>¿Necesitas ayuda?</strong> Contacta con el soporte de la tienda si tienes algún problema.
              </p>
              {store.discord_invite && (
                <a 
                  href={store.discord_invite} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="store-checkout-result__discord"
                >
                  Únete a Discord
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }


