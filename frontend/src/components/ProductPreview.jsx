/**
 * ProductPreview - Preview en tiempo real del producto
 * Se actualiza mientras el usuario escribe en el formulario
 */
import React from 'react';

const SUBSCRIPTION_INTERVALS = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual'
};

const STATUS_CONFIG = {
  DRAFT: { label: 'Borrador', class: 'badge-free' },
  ACTIVE: { label: 'Activo', class: 'badge-success' },
  INACTIVE: { label: 'Inactivo', class: 'badge-secondary' }
};

export default function ProductPreview({ 
  name, 
  description, 
  price, 
  image, 
  category, 
  purchaseType, 
  subscriptionInterval,
  status 
}) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const displayPrice = price ? parseFloat(price).toFixed(2) : '0.00';

  return (
    <div className="product-preview-sticky">
      <div className="preview-header">
        <h3 className="preview-title">Preview</h3>
        <span className={`badge ${statusConfig.class}`}>{statusConfig.label}</span>
      </div>

      <div className="product-preview-card">
        {/* Imagen */}
        <div className="preview-image">
          {image ? (
            <img src={image} alt={name || 'Producto'} />
          ) : (
            <div className="preview-image-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" 
                  stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span>Sin imagen</span>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="preview-content">
          {category && (
            <div className="preview-category">
              <span className="category-dot"></span>
              {category.name}
            </div>
          )}

          <h4 className="preview-product-name">
            {name || 'Nombre del producto'}
          </h4>

          <p className="preview-description">
            {description || 'Agrega una descripción para tu producto...'}
          </p>

          <div className="preview-price-section">
            <div className="preview-price">
              <span className="price-currency">$</span>
              <span className="price-amount">{displayPrice}</span>
              <span className="price-currency">USD</span>
            </div>
            {purchaseType === 'SUBSCRIPTION' && subscriptionInterval && (
              <span className="preview-interval">
                / {SUBSCRIPTION_INTERVALS[subscriptionInterval]}
              </span>
            )}
          </div>

          <button className="preview-buy-button" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="21" r="1" fill="currentColor"/>
              <circle cx="20" cy="21" r="1" fill="currentColor"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Comprar ahora
          </button>
        </div>
      </div>

      <div className="preview-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span>Así verán tu producto los jugadores</span>
      </div>
    </div>
  );
}
