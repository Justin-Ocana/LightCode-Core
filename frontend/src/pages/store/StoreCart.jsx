import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, UserPlus } from 'lucide-react';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { StoreInlineSpinner } from '../../components/store/StoreInlineSpinner';
import { useStoreSlug } from '../../hooks/useStoreSlug';
import { formatStoreSlugLabel } from '../../utils/storeSlugLabel';
import { storesAPI, getMediaUrl } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useBuyer } from '../../context/BuyerContext';
import '../../styles/store/buttons.css';
import '../../styles/store/index.css';

export function StoreCart() {
  const storeSlug = useStoreSlug();
  const [store, setStore] = useState(null);
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    setStore(null);
    setStoreReady(false);
    loadStore();
  }, [storeSlug]);

  async function loadStore() {
    try {
      const response = await storesAPI.getBySlug(storeSlug);
      setStore(response.data);
      setTimeout(() => setStoreReady(true), 100);
    } catch (error) {
      console.error('Error loading store:', error);
    }
  }

  if (!store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={formatStoreSlugLabel(storeSlug)}
        message="Buscando tu tienda"
      />
    );
  }

  if (!storeReady) {
    return (
      <StoreBrandLoader
        overlay
        storeName={store.name}
        logoUrl={getMediaUrl(store.logo_url)}
        message="Abriendo tienda"
      />
    );
  }

  return (
    <StoreCartContent store={store} />
  );
}

function StoreCartContent({ store }) {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { cart, loading: cartLoading, updateItem, removeItem } = useCart();
  const { buyer } = useBuyer();

  function handleCheckout() {
    navigate(`/checkout`);
  }

  if (!store) return null;

  const subtotal = Number(cart?.total_price) || 0;

  return (
    <div className="store-page">
      <StoreNavbar storeName={store.name} logo={getMediaUrl(store.logo_url)} storeId={store.id} />

      <div className="store-container">
          <div className="store-cart">
            <h1 className="store-cart__title">Carrito de compras</h1>

            {cartLoading && !cart ? (
              <StoreInlineSpinner label="Cargando carrito…" />
            ) : !cart?.items?.length ? (
              <div className="store-cart__empty">
                <ShoppingBag size={64} />
                <h2>Tu carrito está vacío</h2>
                <p>Agrega productos para comenzar tu compra</p>
                <Link to={`/shop`} className="store-btn store-btn--primary">
                  Ir a la tienda
                </Link>
              </div>
            ) : (
              <div className="store-cart__content">
                <div className="store-cart__items">
                  {cart.items.map(item => (
                    <div key={item.id} className="store-cart__item">
                      <img 
                        src={getMediaUrl(item.product.image_url) || '/placeholder-product.png'}
                        alt={item.product.name}
                        className="store-cart__item-image"
                      />

                      <div className="store-cart__item-info">
                        <Link 
                          to={`/shop/${item.product.id}`}
                          className="store-cart__item-name"
                        >
                          {item.product.name}
                        </Link>
                        {item.product.short_description && (
                          <p className="store-cart__item-description">
                            {item.product.short_description}
                          </p>
                        )}
                      </div>

                      <div className="store-cart__item-quantity">
                        <button 
                          onClick={() => updateItem(item.product.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={16} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateItem(item.product.id, item.quantity + 1)}>
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="store-cart__item-price">
                        ${(Number(item.product.price) * item.quantity).toFixed(2)}
                      </div>

                      <button 
                        className="store-cart__item-remove"
                        onClick={() => removeItem(item.product.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="store-cart__summary">
                  <h2>Resumen del pedido</h2>

                  <div className="store-cart__summary-row">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>

                  <div className="store-cart__summary-row store-cart__summary-total">
                    <span>Total</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>

                  <button 
                    className="store-btn store-btn--primary store-cart__checkout"
                    onClick={handleCheckout}
                    disabled={!buyer}
                  >
                    Proceder al pago
                  </button>

                  {!buyer && (
                    <div className="store-alert store-alert--info" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                      <UserPlus size={18} />
                      <div>
                        <strong>Inicia sesión para continuar</strong>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.9 }}>
                          Necesitas una cuenta para completar tu compra.
                        </p>
                        <Link 
                          to={`/register?redirect=checkout`}
                          className="store-btn store-btn--primary"
                          style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'inline-block' }}
                        >
                          Crear cuenta / Iniciar sesión
                        </Link>
                      </div>
                    </div>
                  )}

                  <Link 
                    to={`/shop`}
                    className="store-cart__continue"
                  >
                    Continuar comprando
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
