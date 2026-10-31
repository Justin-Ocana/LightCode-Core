import { useEffect, useState, useMemo } from 'react';
import { useStoreSlug } from '../../hooks/useStoreSlug';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Gamepad2, 
  Tag, 
  FileText, 
  ShoppingCart, 
  ShieldCheck, 
  Trash2, 
  Plus, 
  Minus,
  CheckCircle2,
  XCircle,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { RCONWarningModal } from '../../components/store/RCONWarningModal';
import { useCart } from '../../context/CartContext';
import { useBuyer } from '../../context/BuyerContext';
import { discountsAPI, getMediaUrl } from '../../services/api';
import { formatStoreSlugLabel } from '../../utils/storeSlugLabel';
import { usePublicStore } from '../../hooks/usePublicStore';
import toast from 'react-hot-toast';
import '../../styles/store/buttons.css';

/**
 * StoreCheckout - Página de finalización de compra optimizada (Checkout Ideal)
 * Diseñada para reducir fricción y maximizar la confianza del usuario.
 * Compatible con sistema de personalización.
 */
export function StoreCheckout() {
  const storeSlug = useStoreSlug();
  const { store, categories, loading: storeLoading } = usePublicStore(storeSlug);

  if (storeLoading && !store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={formatStoreSlugLabel(storeSlug)}
        message="Preparando checkout..."
      />
    );
  }

  if (!store) return null;

  return <StoreCheckoutContent store={store} categories={categories} />;
}

function StoreCheckoutContent({ store, categories }) {
  const storeSlug = useStoreSlug();
  const navigate = useNavigate();
  const { cart, loading: cartLoading, updateItem, removeItem } = useCart();
  const { buyer, logout } = useBuyer();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRCONModal, setShowRCONModal] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [discountStatus, setDiscountStatus] = useState(null); // { type: 'success' | 'error', message: string, value: number, id: string }
  const [notes, setNotes] = useState('');
  const [minecraftUser, setMinecraftUser] = useState(buyer?.buyer_profile?.minecraft_username || '');
  const [email, setEmail] = useState(buyer?.user?.email || '');

  // VALIDACIÓN: Redirigir si no hay buyer autenticado
  useEffect(() => {
    if (!buyer) {
      toast.error('Debes iniciar sesión para continuar con la compra');
      navigate(`/register?redirect=checkout`);
    }
  }, [buyer, navigate]);

  // Validar que haya items en el carrito
  useEffect(() => {
    if (!cartLoading && (!cart?.items || cart.items.length === 0)) {
      toast.error('Tu carrito está vacío');
      navigate(`/shop`);
    }
  }, [cart, cartLoading, navigate]);

  // Sincronizar datos si el comprador ya está logueado
  useEffect(() => {
    if (buyer) {
      setEmail(buyer.user.email);
      setMinecraftUser(buyer.buyer_profile?.minecraft_username || '');
    }
  }, [buyer]);

  // Detectar si hay productos RCON en el carrito
  const hasRCONProducts = useMemo(() => {
    return cart?.items?.some(item => item.product.delivery_mode === 'rcon') || false;
  }, [cart]);

  // Cálculos de totales
  const totals = useMemo(() => {
    if (!cart) return { subtotal: 0, discount: 0, total: 0 };
    
    const subtotal = Number(cart.total_price) || 0;
    let discount = 0;
    
    if (discountStatus?.type === 'success') {
      if (discountStatus.discount_type === 'PERCENTAGE') {
        discount = subtotal * (discountStatus.value / 100);
      } else {
        discount = Number(discountStatus.value);
      }
    }
    
    return {
      subtotal,
      discount: Math.min(discount, subtotal), // El descuento no puede ser mayor al subtotal
      total: Math.max(0, subtotal - discount)
    };
  }, [cart, discountStatus]);

  // Manejo de aplicación de cupón con validación completa
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      setDiscountStatus({
        type: 'error',
        message: 'Por favor ingresa un código de cupón',
        details: null
      });
      return;
    }
    
    setIsValidatingDiscount(true);
    setDiscountStatus(null); // Limpiar estado anterior
    
    try {
      const itemsCount = cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
      const productIds = cart?.items?.map(item => item.product.id) || [];
      
      const response = await discountsAPI.validate(
        discountCode, 
        totals.subtotal, 
        itemsCount,
        productIds,
        storeSlug // Pass the store slug directly
      );
      
      // Check if the response was successful (200) or error (400)
      if (response.status === 200) {
        const data = response.data;
        setDiscountStatus({
          type: 'success',
          message: data.message || '¡Cupón aplicado!',
          value: data.value,
          discount_type: data.discount_type,
          discount_amount: data.discount_amount,
          id: data.id,
          details: data.details
        });
        toast.success('¡Cupón aplicado correctamente!');
      } else if (response.status === 404) {
        // Feature not available - show friendly message
        setDiscountStatus({
          type: 'error',
          message: 'Los cupones no están disponibles en esta tienda',
          value: 0,
          details: null
        });
      } else {
        // Handle 400 error response
        const errorData = response.data;
        const errorMsg = errorData?.error || 'El cupón no es válido';
        const details = errorData?.details || null;
        
        setDiscountStatus({
          type: 'error',
          message: errorMsg,
          value: 0,
          details: details
        });
      }
    } catch (error) {
      // Handle network errors or other unexpected errors
      const errorData = error.response?.data;
      const errorMsg = errorData?.error || 'Error al validar el cupón';
      const details = errorData?.details || null;
      
      setDiscountStatus({
        type: 'error',
        message: errorMsg,
        value: 0,
        details: details
      });
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  // Proceso final de compra con PayPal (DIRECT PAYMENT - NO PLATFORM COMMISSION)
  const handleCompletePurchase = async (e) => {
    e.preventDefault();
    
    if (!minecraftUser.trim()) {
      toast.error('Por favor, ingresa tu usuario de Minecraft');
      return;
    }

    if (!email.trim()) {
      toast.error('El correo electrónico es obligatorio');
      return;
    }

    // Si hay productos RCON, mostrar modal de advertencia primero
    if (hasRCONProducts) {
      setShowRCONModal(true);
      return;
    }

    // Si no hay productos RCON, proceder directamente
    await proceedToPayPal();
  };

  // Función para proceder al pago (después del modal o directamente)
  const proceedToPayPal = async () => {
    setShowRCONModal(false);
    setIsProcessing(true);
    
    try {
      // Crear orden en el backend usando DIRECT PAYMENT (cuenta del vendedor)
      const buyerToken = localStorage.getItem(`buyer_token_${storeSlug}`);
      
      const orderData = {
        minecraft_username: minecraftUser,
        buyer_email: email,
        notes: notes,
        discount_code: discountStatus?.type === 'success' ? discountCode : null,
        items: cart.items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      };

      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stores/${storeSlug}/checkout/create-direct-paypal-order/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(buyerToken && { 'Authorization': `Bearer ${buyerToken}` }),
          },
          body: JSON.stringify(orderData)
        }
      );



      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error al crear la orden');
      }

      const data = await response.json();

      
      
      // Redirigir a PayPal
      if (data.approval_url) {
       
        window.location.href = data.approval_url;
      } else {
        throw new Error('No se recibió URL de aprobación de PayPal');
      }
      
    } catch (error) {
      toast.error(error.message || 'Ocurrió un error al procesar tu pedido');
      setIsProcessing(false);
    }
  };

  if (!store) return null;

  return (
    <div className="store-page">
        <div className="store-container">
          <div className="store-checkout">
            <h1 className="store-checkout__title">Finalizar compra</h1>

            <div className="store-checkout__content">
              {/* COLUMNA IZQUIERDA: DATOS */}
              <div className="store-checkout__form">
                
                {/* SECCIÓN 1: CUENTA */}
                <section className="store-checkout__section">
                  <div className="store-checkout__section-header">
                    <div className="store-checkout__section-icon">
                      <User size={20} />
                    </div>
                    <h2>Tu Cuenta</h2>
                  </div>

                  {buyer ? (
                    <div className="store-checkout__logged-in">
                      <div className="store-checkout__user-info">
                        <span className="store-checkout__user-email">{email}</span>
                        <span className="store-checkout__helper">Sesión activa</span>
                      </div>
                      <button 
                        type="button" 
                        className="store-checkout__change-account"
                        onClick={logout}
                      >
                        <LogOut size={16} style={{ marginRight: '6px', display: 'inline' }} />
                        Cambiar cuenta
                      </button>
                    </div>
                  ) : (
                    <div className="store-checkout__field">
                      <label htmlFor="checkout-email">Correo Electrónico</label>
                      <div className="store-checkout__input-wrapper">
                        <input 
                          id="checkout-email"
                          type="email" 
                          className="store-checkout__input"
                          placeholder="tu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <span className="store-checkout__helper">
                        Se creará una cuenta automáticamente para gestionar tus pedidos.
                      </span>
                    </div>
                  )}
                </section>

                {/* SECCIÓN 2: MINECRAFT */}
                <section className="store-checkout__section">
                  <div className="store-checkout__section-header">
                    <div className="store-checkout__section-icon">
                      <Gamepad2 size={20} />
                    </div>
                    <h2>Usuario de Minecraft</h2>
                  </div>

                  <div className="store-checkout__field">
                    <label htmlFor="minecraft-user">Nombre en el juego (Username)</label>
                    <div className="store-checkout__input-wrapper">
                      <input 
                        id="minecraft-user"
                        type="text" 
                        className="store-checkout__input"
                        placeholder="Steve_123"
                        value={minecraftUser}
                        onChange={(e) => setMinecraftUser(e.target.value)}
                        required
                        disabled={!!buyer}
                      />
                    </div>
                    <span className="store-checkout__helper">
                      ¡Asegúrate de escribirlo exactamente como aparece en el juego!
                    </span>
                  </div>

                  {minecraftUser && (
                    <div className="store-checkout__minecraft-preview">
                      <img 
                        src={`https://mc-heads.net/avatar/${minecraftUser}/32`} 
                        alt="MC Avatar"
                        className="store-checkout__skin-head"
                        onError={(e) => e.target.src = 'https://mc-heads.net/avatar/steve/32'}
                      />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{minecraftUser}</span>
                    </div>
                  )}
                </section>

                {/* SECCIÓN 3: DESCUENTOS */}
                <section className="store-checkout__section">
                  <div className="store-checkout__section-header">
                    <div className="store-checkout__section-icon">
                      <Tag size={20} />
                    </div>
                    <h2>Cupones de Descuento</h2>
                  </div>

                  <div className="store-checkout__discount-group">
                    <input 
                      type="text" 
                      className="store-checkout__input"
                      placeholder="Código de cupón (ej: DESCUENTO20)"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="store-btn store-btn--secondary"
                      onClick={handleApplyDiscount}
                      disabled={!discountCode.trim() || isValidatingDiscount}
                    >
                      {isValidatingDiscount ? '...' : 'Aplicar'}
                    </button>
                  </div>

                  {discountStatus && (
                    <div className={`store-alert store-alert--${discountStatus.type === 'success' ? 'success' : 'error'}`} style={{ marginTop: '1rem' }}>
                      <div className="store-alert__icon">
                        {discountStatus.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      </div>
                      <div className="store-alert__content">
                        <div className="store-alert__title">
                          {discountStatus.type === 'success' ? '¡Cupón aplicado!' : 'Cupón no válido'}
                        </div>
                        <div className="store-alert__message">
                          {discountStatus.message}
                        </div>
                        {discountStatus.details && discountStatus.details.code !== 'VALID' && (
                          <div className="store-alert__details">
                            {discountStatus.details.reason}
                            {discountStatus.details.current !== undefined && discountStatus.details.required !== undefined && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.9 }}>
                                <strong>Actual:</strong> {discountStatus.details.code === 'MIN_AMOUNT_NOT_REACHED' ? `$${discountStatus.details.current.toFixed(2)}` : discountStatus.details.current} 
                                {' • '}
                                <strong>Requerido:</strong> {discountStatus.details.code === 'MIN_AMOUNT_NOT_REACHED' ? `$${discountStatus.details.required}` : discountStatus.details.required}
                              </div>
                            )}
                          </div>
                        )}
                        {discountStatus.type === 'success' && discountStatus.discount_amount && (
                          <div className="store-alert__details" style={{ color: 'inherit', marginTop: '0.5rem' }}>
                            <strong>Ahorro:</strong> ${discountStatus.discount_amount.toFixed(2)}
                          </div>
                        )}
                      </div>
                      {discountStatus.type === 'success' && (
                        <button 
                          type="button"
                          className="store-alert__close"
                          onClick={() => {
                            setDiscountStatus(null);
                            setDiscountCode('');
                          }}
                          title="Quitar cupón"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </section>

                {/* SECCIÓN 4: NOTAS */}
                <section className="store-checkout__section">
                  <div className="store-checkout__section-header">
                    <div className="store-checkout__section-icon">
                      <FileText size={20} />
                    </div>
                    <h2>Notas Adicionales</h2>
                  </div>

                  <div className="store-checkout__field">
                    <label htmlFor="checkout-notes">Mensaje para el servidor (opcional)</label>
                    <textarea 
                      id="checkout-notes"
                      className="store-checkout__input"
                      rows="3"
                      placeholder="Ej: Es para un regalo, mi Discord es..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </section>
              </div>

              {/* COLUMNA DERECHA: RESUMEN */}
              <aside className="store-checkout__summary">
                <h2>
                  <ShoppingCart size={24} />
                  Resumen del Pedido
                </h2>

                <div className="store-checkout__items">
                  {cart?.items?.length > 0 ? (
                    cart.items.map((item) => (
                      <div key={item.id} className="store-checkout__item">
                        <img 
                          src={getMediaUrl(item.product.image_url) || '/placeholder-product.png'} 
                          alt={item.product.name}
                          className="store-checkout__item-img"
                        />
                        <div className="store-checkout__item-details">
                          <span className="store-checkout__item-name">{item.product.name}</span>
                          <div className="store-checkout__item-qty-control">
                            <button 
                              className="store-checkout__qty-btn"
                              onClick={() => updateItem(item.product.id, Math.max(1, item.quantity - 1))}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.quantity}</span>
                            <button 
                              className="store-checkout__qty-btn"
                              onClick={() => updateItem(item.product.id, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="store-checkout__item-price-wrap">
                          <div className="store-checkout__item-price">
                            ${(Number(item.product.price) * item.quantity).toFixed(2)}
                          </div>
                          <button 
                            className="store-checkout__item-remove"
                            onClick={() => removeItem(item.product.id)}
                            title="Quitar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.5 }}>
                      <ShoppingCart size={48} style={{ margin: '0 auto 1rem', display: 'block' }} />
                      <p>Tu carrito está vacío</p>
                      <Link to={`/shop`} className="store-btn" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                        Volver a la tienda
                      </Link>
                    </div>
                  )}
                </div>

                <div className="store-checkout__totals">
                  <div className="store-checkout__total-row">
                    <span>Subtotal</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {totals.discount > 0 && (
                    <div className="store-checkout__total-row store-checkout__total-row--discount">
                      <span>Descuento</span>
                      <span>-${totals.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="store-checkout__total-row store-checkout__total-row--final">
                    <span>Total</span>
                    <span>${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  className="store-btn store-btn--primary store-checkout__submit"
                  onClick={handleCompletePurchase}
                  disabled={isProcessing || !cart?.items?.length}
                >
                  {isProcessing ? (
                    'Redirigiendo a PayPal...'
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                        <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.15a.805.805 0 01-.794.68H7.72a.483.483 0 01-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502z"/>
                        <path d="M2.379 0C1.94 0 1.6.33 1.568.768L.01 14.755a.598.598 0 00.59.688h4.34l1.09-6.9 1.385.002c4.678 0 7.75-2.203 8.796-6.502.492-.88.556-2.014.3-3.327C15.955.856 14.279 0 11.934 0H2.379z"/>
                      </svg>
                      <span>Pagar con PayPal</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>

                {/* Trust badge — pago directo al vendedor */}
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(0,212,170,0.06)',
                    border: '1px solid rgba(0,212,170,0.2)',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>El pago va directo a la cuenta del vendedor</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Sin comisiones de plataforma — 100% para el vendedor</span>
                    </div>
                </div>

                <div className="store-checkout__trust">
                  <ShieldCheck size={16} />
                  <span>Compra segura – Entrega automática en tu servidor</span>
                </div>
              </aside>
            </div>
          </div>

        {/* Modal de advertencia RCON */}
        <RCONWarningModal 
          isOpen={showRCONModal}
          onClose={() => setShowRCONModal(false)}
          onContinue={proceedToPayPal}
          storeName={store.name}
        />
      </div>
    </div>
  );
}

