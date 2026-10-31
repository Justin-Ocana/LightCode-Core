import { X, ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { getMediaUrl } from '../../services/api';
import '../../styles/store/cart.css';

/**
 * CartSidebar - El componente de carrito lateral.
 * Se abre desde cualquier parte de la tienda.
 * Compatible con sistema de personalización.
 */
export function CartSidebar() {
  const navigate = useNavigate();
  const { 
    cart, 
    isCartOpen, 
    closeCart, 
    updateItem, 
    removeItem, 
    loading 
  } = useCart();

  if (!isCartOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('cart-overlay')) {
      closeCart();
    }
  };

  const handleQuantityChange = (productId, currentQty, delta) => {
    const newQty = currentQty + delta;
    if (newQty < 1) return;
    updateItem(productId, newQty);
  };

  const handleGoToCheckout = () => {
    closeCart();
    navigate(`/checkout`);
  };

  return (
    <div 
      className={`cart-overlay ${isCartOpen ? 'cart-overlay--open' : ''}`} 
      onClick={handleOverlayClick}
    >
      <aside className={`cart-sidebar ${isCartOpen ? 'cart-sidebar--open' : ''}`}>
        <div className="cart-header">
          <h2>
            <ShoppingCart size={24} />
            Tu Carrito
            {cart?.total_items > 0 && (
              <span className="cart-count-badge">{cart.total_items}</span>
            )}
          </h2>
          <button className="cart-close" onClick={closeCart}>
            <X size={24} />
          </button>
        </div>

        <div className="cart-content">
          {loading && !cart ? (
            <div className="cart-loading">Cargando carrito...</div>
          ) : !cart?.items?.length ? (
            <div className="cart-empty">
              <ShoppingBag size={64} />
              <p>Tu carrito está vacío</p>
              <button className="store-btn" onClick={closeCart}>
                Explorar productos
              </button>
            </div>
          ) : (
            <div className="cart-items">
              {cart.items.map((item) => (
                <div key={item.id} className="cart-item">
                  <img 
                    src={getMediaUrl(item.product.image_url) || '/placeholder-product.png'} 
                    alt={item.product.name} 
                    className="cart-item__image"
                  />
                  <div className="cart-item__info">
                    <h4 className="cart-item__name">{item.product.name}</h4>
                    <span className="cart-item__category">{item.product.category_name}</span>
                    <span className="cart-item__price">${item.product.price}</span>
                    
                    <div className="cart-item__actions">
                      <div className="cart-item__quantity">
                        <button 
                          className="cart-item__btn"
                          onClick={() => handleQuantityChange(item.product.id, item.quantity, -1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="cart-item__count">{item.quantity}</span>
                        <button 
                          className="cart-item__btn"
                          onClick={() => handleQuantityChange(item.product.id, item.quantity, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <button 
                        className="cart-item__remove"
                        onClick={() => removeItem(item.product.id)}
                        title="Eliminar producto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart?.items?.length > 0 && (
          <div className="cart-footer">
            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>Subtotal</span>
                <span>${cart.total_price}</span>
              </div>
              <div className="cart-summary__row">
                <span>Impuestos</span>
                <span>$0.00</span>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>Total</span>
                <span>${cart.total_price}</span>
              </div>
            </div>

            <div className="cart-buttons">
              <button className="store-btn store-btn--primary cart-btn-checkout" onClick={handleGoToCheckout}>
                <span>Ir a pagar</span>
                <ArrowRight size={20} />
              </button>
              <button className="store-btn store-btn--secondary cart-btn-continue" onClick={closeCart}>
                Seguir comprando
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
