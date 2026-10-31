import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ShoppingBag, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';
import './StoreHome.css';

export function StoreHome() {
  const { store } = useOutletContext();

  if (!store) {
    return (
      <div className="premium-loading">
        <div className="premium-spinner"></div>
        <p>Cargando experiencia premium...</p>
      </div>
    );
  }

  return (
    <div className="premium-home">
      {/* Animated Stars Background */}
      <div className="stars-background">
        <div className="stars-layer stars-layer-1"></div>
        <div className="stars-layer stars-layer-2"></div>
        <div className="stars-layer stars-layer-3"></div>
      </div>

      {/* Hero Section */}
      <section className="premium-hero">
        <div className="premium-hero-content">
          <div className="premium-hero-badge">
            <Sparkles size={16} />
            <span>Experiencia Premium</span>
          </div>
          
          <h1 className="premium-hero-title">
            Domina el servidor.
            <br />
            <span className="gradient-text">Mejora tu experiencia.</span>
          </h1>
          
          <p className="premium-hero-subtitle">
            Accede a rangos exclusivos, items únicos y beneficios VIP.
            <br />
            Únete a la élite de jugadores.
          </p>

          <div className="premium-hero-actions">
            <Link to="/store/shop" className="premium-cta-primary">
              <ShoppingBag size={20} />
              <span>Explorar Tienda</span>
              <ArrowRight size={18} />
            </Link>
            
            {store.server_ip && (
              <button 
                className="premium-cta-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(store.server_ip);
                  // TODO: Add toast notification
                }}
              >
                <span className="server-ip-text">{store.server_ip}</span>
                <span className="copy-hint">Copiar IP</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating Elements */}
        <div className="floating-elements">
          <div className="floating-cube floating-cube-1"></div>
          <div className="floating-cube floating-cube-2"></div>
          <div className="floating-cube floating-cube-3"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="premium-features">
        <div className="premium-container">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon feature-icon-primary">
                <Zap size={24} />
              </div>
              <h3 className="feature-title">Entrega Instantánea</h3>
              <p className="feature-description">
                Recibe tus items y rangos al instante. Sin esperas, sin complicaciones.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon-secondary">
                <Shield size={24} />
              </div>
              <h3 className="feature-title">Pago Seguro</h3>
              <p className="feature-description">
                Transacciones protegidas con los más altos estándares de seguridad.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon-accent">
                <Sparkles size={24} />
              </div>
              <h3 className="feature-title">Soporte 24/7</h3>
              <p className="feature-description">
                Nuestro equipo está siempre disponible para ayudarte cuando lo necesites.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="premium-cta-section">
        <div className="premium-container">
          <div className="cta-card">
            <div className="cta-content">
              <h2 className="cta-title">
                ¿Listo para la experiencia premium?
              </h2>
              <p className="cta-subtitle">
                Únete a miles de jugadores que ya disfrutan de beneficios exclusivos.
              </p>
            </div>
            <Link to="/store/shop" className="cta-button">
              Ver Rangos
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
