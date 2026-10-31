import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useOutletContext, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, X as CloseIcon, 
  LogIn, Check, ChevronDown, ChevronUp, Package, Truck
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useBuyer } from '../../context/BuyerContext';
import {
  formatPurchaseType,
  formatSubscriptionInterval,
} from '../../utils/purchaseType';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { StoreInlineSpinner } from '../../components/store/StoreInlineSpinner';
import { useStoreSlug } from '../../hooks/useStoreSlug';
import { formatStoreSlugLabel } from '../../utils/storeSlugLabel';
import { productsAPI, getMediaUrl } from '../../services/api';
import './StoreProduct.css';

export function StoreProduct() {
  const { productSlug } = useParams();
  const storeSlug = useStoreSlug();
  const { store } = useOutletContext();
  const { addItem } = useCart();
  const { buyer } = useBuyer();
  const navigate = useNavigate();
  
  const [storeUiReady, setStoreUiReady] = useState(false);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  // Imágenes
  const galleryUrls = (product?.gallery_images || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((g) => getMediaUrl(g.image_url))
    .filter(Boolean);
  
  const images = [];
  if (product?.image_url) images.push(getMediaUrl(product.image_url));
  for (const url of galleryUrls) {
    if (url && !images.includes(url)) images.push(url);
  }
  if (images.length === 0) images.push('/placeholder-product.png');

  const nextImage = useCallback((e) => {
    e?.stopPropagation();
    if (images.length <= 1) return;
    setSelectedImage((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback((e) => {
    e?.stopPropagation();
    if (images.length <= 1) return;
    setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isLightboxOpen) return;
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, nextImage, prevImage]);

  useEffect(() => {
    setProduct(null);
    if (storeSlug && productSlug) {
      loadProduct();
    }
    // Scroll to top when product changes
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [storeSlug, productSlug]);

  useEffect(() => {
    if (store) {
      setTimeout(() => setStoreUiReady(true), 100);
    }
  }, [store]);

  async function loadProduct() {
    try {
      setLoading(true);
      const response = await productsAPI.getBySlug(productSlug, storeSlug);
      setProduct(response.data);
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    await addItem(product.id, quantity, product);
  }

  async function handleBuyNow() {
    const success = await addItem(product.id, quantity, product);
    if (success) {
      navigate(`/checkout`);
    }
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={formatStoreSlugLabel(storeSlug)}
        message="Buscando tu tienda"
      />
    );
  }

  if (!storeUiReady) {
    return (
      <StoreBrandLoader
        overlay
        storeName={store.name}
        logoUrl={getMediaUrl(store.logo_url)}
        message="Abriendo tienda"
      />
    );
  }

  if (loading || !product) {
    return (
      <div className="store-page">
        <div className="store-container">
          <StoreInlineSpinner label="Cargando producto…" />
        </div>
      </div>
    );
  }

  const purchaseTypeLabel = formatPurchaseType(product.purchase_type);
  const intervalLabel =
    product.purchase_type === 'SUBSCRIPTION'
      ? formatSubscriptionInterval(product.subscription_interval)
      : '';

  return (
    <div className="product-page">
      {/* Breadcrumb */}
      <nav className="product-breadcrumb">
        <Link to="/shop">Tienda</Link>
        <span className="product-breadcrumb__separator">›</span>
        {product.category_data && (
          <>
            <span>{product.category_data.name}</span>
            <span className="product-breadcrumb__separator">›</span>
          </>
        )}
        <span className="product-breadcrumb__current">{product.name}</span>
      </nav>

      <div className="product-container">
        {/* Header: Solo Nombre */}
        <div className="product-header">
          <h1 className="product-title">{product.name}</h1>
        </div>

        {/* Layout: Imagen Izquierda + Panel Derecho */}
        <div className="product-layout">
          {/* Imagen Izquierda */}
          <div className="product-gallery">
            <div 
              className="product-gallery__main"
              onClick={() => setIsLightboxOpen(true)}
            >
              <img 
                src={images[selectedImage]} 
                alt={product.name}
              />
              
              {images.length > 1 && (
                <>
                  <button 
                    className="product-gallery__nav product-gallery__nav--prev" 
                    onClick={(e) => { e.stopPropagation(); prevImage(e); }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    className="product-gallery__nav product-gallery__nav--next" 
                    onClick={(e) => { e.stopPropagation(); nextImage(e); }}
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="product-gallery__thumbnails">
                {images.map((img, index) => (
                  <button
                    key={index}
                    className={`product-thumbnail ${selectedImage === index ? 'product-thumbnail--active' : ''}`}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={img} alt={`Vista ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Panel Derecho (Sticky) */}
          <aside className="product-purchase">
            <div className="product-purchase__card">
              {/* Price */}
              <div className="product-purchase__price">
                <span className="product-purchase__amount">${Number(product.price).toFixed(2)}</span>
                <span className="product-purchase__currency">{product.currency || 'USD'}</span>
              </div>

              {/* Purchase Type */}
              {purchaseTypeLabel && (
                <div className="product-purchase__type">
                  {purchaseTypeLabel}
                  {intervalLabel && ` · ${intervalLabel}`}
                </div>
              )}

              {buyer ? (
                <>
                  {/* Quantity Selector */}
                  <div className="product-purchase__quantity">
                    <label>Cantidad</label>
                    <div className="quantity-selector">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        −
                      </button>
                      <input 
                        type="number" 
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                      />
                      <button onClick={() => setQuantity(quantity + 1)}>
                        +
                      </button>
                    </div>
                  </div>

                  {/* Buy Buttons */}
                  <button 
                    className="product-btn product-btn--primary"
                    onClick={handleBuyNow}
                  >
                    Comprar ahora
                  </button>

                  <button 
                    className="product-btn product-btn--secondary"
                    onClick={handleAddToCart}
                  >
                    Agregar al carrito
                  </button>
                </>
              ) : (
                <div className="product-purchase__auth">
                  <p>Inicia sesión para comprar</p>
                  <Link to="/login" className="product-btn product-btn--primary">
                    <LogIn size={18} />
                    <span>Iniciar sesión</span>
                  </Link>
                  <Link to="/register" className="product-btn product-btn--secondary">
                    Crear cuenta
                  </Link>
                </div>
              )}

              {/* Additional Info */}
              <div className="product-purchase__info">
                {product.is_available && (
                  <div className="product-purchase__info-item">
                    <Check size={14} />
                    <span>Disponible</span>
                  </div>
                )}
                {product.global_limit && (
                  <div className="product-purchase__info-item">
                    <span>Límite global: {product.global_limit}</span>
                  </div>
                )}
                {product.per_player_limit && (
                  <div className="product-purchase__info-item">
                    <span>Límite por jugador: {product.per_player_limit}</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Descripción */}
        {product.description && (
          <section className="product-description-section">
            <h2 className="product-section-title">Descripción</h2>
            <div className="product-description-content">
              {product.description}
            </div>
          </section>
        )}

        {/* Features Grid */}
        {product.content && product.content.length > 0 && (
          <section className="product-features">
            <h2 className="product-section-title">Características</h2>
            <div className="product-features__grid">
              {product.content.map((item, index) => (
                <div key={index} className="product-feature-card">
                  <div className="product-feature-card__icon">{item.icon}</div>
                  <div className="product-feature-card__text">{item.text}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Technical Details */}
        <section className="product-specs">
          <h2 className="product-section-title">Detalles Técnicos</h2>
          
          {/* General Info */}
          <div className="product-spec-section">
            <button 
              className="product-spec-section__header"
              onClick={() => toggleSection('general')}
            >
              <div className="product-spec-section__title">
                <Package size={18} />
                <span>Información General</span>
              </div>
              {expandedSection === 'general' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'general' && (
              <div className="product-spec-section__content">
                <div className="product-spec-row">
                  <span className="product-spec-row__label">Nombre</span>
                  <span className="product-spec-row__value">{product.name}</span>
                </div>
                {product.category_data && (
                  <div className="product-spec-row">
                    <span className="product-spec-row__label">Categoría</span>
                    <span className="product-spec-row__value">{product.category_data.name}</span>
                  </div>
                )}
                <div className="product-spec-row">
                  <span className="product-spec-row__label">Precio</span>
                  <span className="product-spec-row__value">${Number(product.price).toFixed(2)} {product.currency || 'USD'}</span>
                </div>
                <div className="product-spec-row">
                  <span className="product-spec-row__label">Tipo de compra</span>
                  <span className="product-spec-row__value">{purchaseTypeLabel}</span>
                </div>
              </div>
            )}
          </div>

          {/* Limits */}
          {(product.global_limit || product.per_player_limit) && (
            <div className="product-spec-section">
              <button 
                className="product-spec-section__header"
                onClick={() => toggleSection('limits')}
              >
                <div className="product-spec-section__title">
                  <Package size={18} />
                  <span>Límites</span>
                </div>
                {expandedSection === 'limits' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSection === 'limits' && (
                <div className="product-spec-section__content">
                  {product.global_limit && (
                    <div className="product-spec-row">
                      <span className="product-spec-row__label">Límite global</span>
                      <span className="product-spec-row__value">{product.global_limit}</span>
                    </div>
                  )}
                  {product.per_player_limit && (
                    <div className="product-spec-row">
                      <span className="product-spec-row__label">Límite por jugador</span>
                      <span className="product-spec-row__value">{product.per_player_limit}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delivery */}
          <div className="product-spec-section">
            <button 
              className="product-spec-section__header"
              onClick={() => toggleSection('delivery')}
            >
              <div className="product-spec-section__title">
                <Truck size={18} />
                <span>Entrega</span>
              </div>
              {expandedSection === 'delivery' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expandedSection === 'delivery' && (
              <div className="product-spec-section__content">
                {product.delivery_mode && (
                  <div className="product-spec-row">
                    <span className="product-spec-row__label">Modo</span>
                    <span className="product-spec-row__value">{product.delivery_mode}</span>
                  </div>
                )}
                {product.require_online !== undefined && (
                  <div className="product-spec-row">
                    <span className="product-spec-row__label">Requiere jugador online</span>
                    <span className="product-spec-row__value">{product.require_online ? 'Sí' : 'No'}</span>
                  </div>
                )}
                {product.command_delay > 0 && (
                  <div className="product-spec-row">
                    <span className="product-spec-row__label">Retraso entre comandos</span>
                    <span className="product-spec-row__value">{product.command_delay}s</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && (
        <div className="product-lightbox" onClick={() => setIsLightboxOpen(false)}>
          <button className="product-lightbox__close">
            <CloseIcon size={32} />
          </button>
          
          <div className="product-lightbox__content" onClick={(e) => e.stopPropagation()}>
            {images.length > 1 && (
              <button className="product-lightbox__nav product-lightbox__nav--prev" onClick={prevImage}>
                <ChevronLeft size={48} />
              </button>
            )}
            
            <img 
              src={images[selectedImage]} 
              alt={product.name}
            />
            
            {images.length > 1 && (
              <button className="product-lightbox__nav product-lightbox__nav--next" onClick={nextImage}>
                <ChevronRight size={48} />
              </button>
            )}
          </div>

          <div className="product-lightbox__counter">
            {selectedImage + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
