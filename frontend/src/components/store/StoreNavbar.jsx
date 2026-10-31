import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, LogOut, Search, UserCircle, Package } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useBuyer } from '../../context/BuyerContext';
import './StoreNavbar.css';

export function StoreNavbar({ storeName, logo, storeSlug }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const navigate = useNavigate();
  
  const { cart, openCart } = useCart();
  
  // Verificación de seguridad para el contexto del buyer
  let buyer = null;
  let logout = null;
  try {
    const buyerContext = useBuyer();
    buyer = buyerContext.buyer;
    logout = buyerContext.logout;
  } catch (error) {
    // El contexto no está disponible aún, usar valores por defecto
  }
  
  const cartItemsCount = cart?.total_items || 0;

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [mobileMenuOpen]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    await logout();
  };

  const handleCartClick = () => {
    openCart();
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  return (
    <nav className="ultra-navbar">
      <div className="ultra-navbar-container">
        {/* Left: Brand */}
        <Link to="/" className="ultra-brand">
          <div className="ultra-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
              <rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor"/>
            </svg>
          </div>
          <span className="ultra-brand-text">Mi Servidor</span>
        </Link>

        {/* Center: Navigation */}
        <div className="ultra-nav-center">
          <Link to="/" className="ultra-nav-link">
            Inicio
          </Link>
          <Link to="/shop" className="ultra-nav-link">
            Tienda
          </Link>
          <Link to="/shop" className="ultra-nav-link">
            Rangos
          </Link>
          <Link to="/shop" className="ultra-nav-link">
            Kits
          </Link>
          <Link to="/shop" className="ultra-nav-link">
            Items
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="ultra-nav-actions">
          {/* Search */}
          <button className="ultra-icon-btn" aria-label="Buscar">
            <Search size={20} strokeWidth={2} />
          </button>

          {/* Cart */}
          <button className="ultra-icon-btn ultra-cart-btn" aria-label="Carrito" onClick={handleCartClick}>
            <ShoppingCart size={20} strokeWidth={2} />
            {cartItemsCount > 0 && (
              <span className="ultra-cart-badge">{cartItemsCount}</span>
            )}
          </button>

          {/* Account Dropdown */}
          <div className="ultra-user-dropdown" ref={userMenuRef}>
            <button 
              className={`ultra-user-btn ${!buyer ? 'ultra-user-btn--icon-only' : ''}`}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label="Menú de usuario"
            >
              <User size={20} strokeWidth={2} />
              {buyer && (
                <span className="ultra-user-name">
                  {buyer.user?.username || buyer.user?.email || 'Usuario'}
                </span>
              )}
            </button>
            
            {userMenuOpen && (
              <div className="ultra-user-menu">
                {buyer ? (
                  <>
                    <Link to="/account" className="ultra-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                      <User size={18} />
                      <span>Mi Cuenta</span>
                    </Link>
                    <Link to="/orders" className="ultra-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                      <Package size={18} />
                      <span>Mis Pedidos</span>
                    </Link>
                    <div className="ultra-user-menu-divider"></div>
                    <button className="ultra-user-menu-item ultra-user-menu-item--danger" onClick={handleLogout}>
                      <LogOut size={18} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="ultra-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                      <User size={18} />
                      <span>Iniciar Sesión</span>
                    </Link>
                    <Link to="/register" className="ultra-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                      <UserCircle size={18} />
                      <span>Crear Cuenta</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="ultra-mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`ultra-mobile-overlay ${mobileMenuOpen ? 'ultra-mobile-overlay--active' : ''}`} onClick={closeMobileMenu} />
      <div ref={mobileMenuRef} className={`ultra-mobile-menu ${mobileMenuOpen ? 'ultra-mobile-menu--active' : ''}`}>
        <div className="ultra-mobile-links">
          {/* Navigation Links */}
          <div className="ultra-mobile-section">
            <Link to="/" className="ultra-mobile-link" onClick={closeMobileMenu}>
              <span>Inicio</span>
            </Link>
            <Link to="/shop" className="ultra-mobile-link" onClick={closeMobileMenu}>
              <span>Tienda</span>
            </Link>
            <Link to="/shop" className="ultra-mobile-link" onClick={closeMobileMenu}>
              <span>Rangos</span>
            </Link>
            <Link to="/shop" className="ultra-mobile-link" onClick={closeMobileMenu}>
              <span>Kits</span>
            </Link>
            <Link to="/shop" className="ultra-mobile-link" onClick={closeMobileMenu}>
              <span>Items</span>
            </Link>
          </div>

          {/* User Section */}
          {buyer ? (
            <>
              <div className="ultra-mobile-divider"></div>
              <div className="ultra-mobile-section">
                <div className="ultra-mobile-user-info">
                  <User size={20} />
                  <span>{buyer.user?.username || buyer.user?.email || 'Usuario'}</span>
                </div>
                <Link to="/account" className="ultra-mobile-link" onClick={closeMobileMenu}>
                  <User size={18} />
                  <span>Mi Cuenta</span>
                </Link>
                <Link to="/orders" className="ultra-mobile-link" onClick={closeMobileMenu}>
                  <Package size={18} />
                  <span>Mis Pedidos</span>
                </Link>
              </div>
              <div className="ultra-mobile-divider"></div>
              <div className="ultra-mobile-section">
                <button className="ultra-mobile-link ultra-mobile-link--danger" onClick={handleLogout}>
                  <LogOut size={18} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="ultra-mobile-divider"></div>
              <div className="ultra-mobile-section">
                <Link to="/login" className="ultra-mobile-link ultra-mobile-link--primary" onClick={closeMobileMenu}>
                  <User size={18} />
                  <span>Iniciar Sesión</span>
                </Link>
                <Link to="/register" className="ultra-mobile-link" onClick={closeMobileMenu}>
                  <UserCircle size={18} />
                  <span>Crear Cuenta</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
