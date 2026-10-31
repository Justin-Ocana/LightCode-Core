import { Link } from 'react-router-dom';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { getMediaUrl } from '../../services/api';
import { formatPurchaseType } from '../../utils/purchaseType';
import { useCart } from '../../context/CartContext';
import { useState, useRef } from 'react';
import './ProductCard.css';

/**
 * Premium Product Card - SaaS + Gaming Style with 3D Hover Effect
 */
export function ProductCard({ product }) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const cardRef = useRef(null);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isAdding || !product.is_available) return;
    
    setIsAdding(true);
    try {
      await addItem(product.id, 1, product);
    } finally {
      setIsAdding(false);
    }
  };

  // Subtle 3D Tilt Effect on Mouse Move
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Subtle tilt - max 4deg
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    
    // Holographic shine position
    const shineX = (x / rect.width) * 100;
    const shineY = (y / rect.height) * 100;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.01)`;
    card.style.setProperty('--shine-x', `${shineX}%`);
    card.style.setProperty('--shine-y', `${shineY}%`);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)';
  };

  const productIdentifier = product.slug || product.id;
  const productUrl = `/shop/${productIdentifier}`;
  const imageUrl = getMediaUrl(product.image_url);
  const purchaseTypeLabel = formatPurchaseType(product.purchase_type);

  return (
    <Link 
      to={productUrl} 
      className="pro-card"
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Image with Overlay */}
      <div className="pro-card-image-wrapper">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="pro-card-image"
          />
        ) : (
          <div className="pro-card-image pro-card-placeholder">
            <span>{product.name.charAt(0)}</span>
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="pro-card-overlay"></div>

        {/* Badges */}
        {(product.is_featured || product.discount_percentage > 0) && (
          <div className="pro-card-badges">
            {product.is_featured && (
              <span className="pro-badge pro-badge-featured">
                <Sparkles size={12} />
                Destacado
              </span>
            )}
            {product.discount_percentage > 0 && (
              <span className="pro-badge pro-badge-sale">
                -{product.discount_percentage}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pro-card-content">
        {/* Type Badge */}
        {purchaseTypeLabel && (
          <div className="pro-type-badge">
            {purchaseTypeLabel}
          </div>
        )}

        {/* Title */}
        <h3 className="pro-card-title">{product.name}</h3>

        {/* Description */}
        {product.short_description && (
          <p className="pro-card-description">
            {product.short_description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="pro-card-footer">
        <div className="pro-price-wrapper">
          {product.discount_percentage > 0 ? (
            <>
              <div className="pro-price">
                ${parseFloat(product.discounted_price || product.price).toFixed(2)}
              </div>
              <div className="pro-price-old">
                ${parseFloat(product.price).toFixed(2)}
              </div>
            </>
          ) : (
            <div className="pro-price">
              ${parseFloat(product.price).toFixed(2)}
            </div>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          className="pro-buy-btn"
          disabled={!product.is_available || isAdding}
        >
          <ShoppingCart size={16} strokeWidth={2.5} />
          <span>{isAdding ? 'Agregando...' : product.is_available ? 'Comprar' : 'No disponible'}</span>
        </button>
      </div>
    </Link>
  );
}
