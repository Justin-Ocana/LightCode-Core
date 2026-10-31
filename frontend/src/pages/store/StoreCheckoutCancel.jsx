import { Link } from 'react-router-dom';
import { XCircle, ArrowLeft, ShoppingCart, Home } from 'lucide-react';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { usePublicStore } from '../../hooks/usePublicStore';
import { useStoreSlug } from '../../hooks/useStoreSlug';
import { getMediaUrl } from '../../services/api';
import '../../styles/store/buttons.css';
import '../../styles/store/checkout-result.css';

/**
 * StoreCheckoutCancel - Página cuando el usuario cancela el pago en PayPal
 * Compatible con sistema de personalización de tienda
 */
export function StoreCheckoutCancel() {
  const storeSlug = useStoreSlug();
  const { store, categories, loading } = usePublicStore(storeSlug);

  if (loading && !store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={storeSlug}
        message="Cargando..."
      />
    );
  }

  if (!store) return null;

  return (
    <div className="store-page">
      <div className="store-container">
        <div className="store-checkout-result store-checkout-result--cancel">
            {/* Icono de cancelación */}
            <div className="store-checkout-result__icon store-checkout-result__icon--warning">
              <XCircle size={64} />
            </div>

            {/* Título */}
            <h1 className="store-checkout-result__title">
              Pago cancelado
            </h1>
            <p className="store-checkout-result__subtitle">
              Has cancelado el proceso de pago
            </p>

            {/* Mensaje */}
            <div className="store-checkout-result__message">
              <p>
                No te preocupes, tu carrito sigue intacto. Puedes volver al checkout 
                cuando estés listo para completar tu compra.
              </p>
            </div>

            {/* Razones comunes */}
            <div className="store-checkout-result__reasons">
              <h3>¿Por qué cancelaste?</h3>
              <ul>
                <li>¿Necesitas más tiempo para decidir?</li>
                <li>¿Quieres revisar los productos nuevamente?</li>
                <li>¿Tienes dudas sobre el pago?</li>
              </ul>
              <p>
                Si tienes alguna pregunta, no dudes en contactar con el soporte de la tienda.
              </p>
            </div>

            {/* Acciones */}
            <div className="store-checkout-result__actions">
              <Link 
                to={`/checkout`} 
                className="store-btn store-btn--primary"
              >
                <ArrowLeft size={20} />
                Volver al checkout
              </Link>
              
              <Link 
                to={`/cart`} 
                className="store-btn store-btn--secondary"
              >
                <ShoppingCart size={20} />
                Ver carrito
              </Link>

              <Link 
                to={`/shop`} 
                className="store-btn store-btn--secondary"
              >
                Seguir comprando
              </Link>
            </div>

            {/* Soporte */}
            <div className="store-checkout-result__info">
              <p>
                <strong>¿Necesitas ayuda?</strong> Nuestro equipo está aquí para ayudarte.
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
              {store.email && (
                <a 
                  href={`mailto:${store.email}`}
                  className="store-checkout-result__email"
                >
                  Enviar email: {store.email}
                </a>
              )}
            </div>

            {/* Link al inicio */}
            <Link 
              to={``} 
              className="store-checkout-result__home-link"
            >
              <Home size={16} />
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
  );
}

