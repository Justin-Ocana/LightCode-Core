import { Link } from 'react-router-dom';
import './StoreFooter.css';

/**
 * Premium Footer - Ultra Compact for Mobile
 */
export function StoreFooter({ storeName }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="store-footer">
      <div className="footer-container">
        {/* Compact Brand */}
        <div className="footer-brand">
          <div className="footer-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
              <rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor"/>
            </svg>
          </div>
          <span className="footer-store-name">{storeName || 'Mi Servidor'}</span>
        </div>

        {/* Compact Navigation */}
        <nav className="footer-nav">
          <Link to="/" className="footer-link">Inicio</Link>
          <Link to="/shop" className="footer-link">Productos</Link>
          <Link to="/orders" className="footer-link">Órdenes</Link>
          <Link to="/account" className="footer-link">Cuenta</Link>
          <Link to="/terms" className="footer-link">Términos</Link>
          <Link to="/privacy" className="footer-link">Privacidad</Link>
        </nav>

        {/* Compact Bottom */}
        <div className="footer-bottom">
          <span className="footer-copyright">© {currentYear} {storeName || 'Mi Servidor'}</span>
          <span className="footer-separator">•</span>
          <span className="footer-powered">Powered by <span className="footer-lightcode">LightCode</span></span>
        </div>
      </div>
    </footer>
  );
}
