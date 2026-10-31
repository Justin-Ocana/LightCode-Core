/**
 * Store Selector - Dropdown para cambiar tienda activa
 */
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import '../../styles/store-selector.css';

export default function StoreSelector() {
  const { activeStore, stores, selectStore, loading } = useStore();
  const { sellerProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Calcular posición del dropdown
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Mobile: dropdown abajo
        setDropdownStyle({
          top: `${rect.bottom + 8}px`,
          left: '16px',
          right: '16px',
          width: 'auto',
        });
      } else {
        // Desktop: dropdown a la derecha, centrado
        setDropdownStyle({
          top: `${rect.top + (rect.height / 2)}px`,
          left: `${rect.right + 16}px`,
          transform: 'translateY(-50%)',
        });
      }
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="store-selector-loading">
        <div className="store-selector-skeleton"></div>
      </div>
    );
  }

  if (!activeStore && stores.length === 0) {
    return null; // No mostrar nada si no hay tiendas
  }

  const getStatusBadge = (status) => {
    const badges = {
      active: { label: 'Activa', class: 'status-active' },
      inactive: { label: 'Inactiva', class: 'status-inactive' },
      suspended: { label: 'Suspendida', class: 'status-suspended' },
      maintenance: { label: 'Mantenimiento', class: 'status-maintenance' },
    };
    return badges[status] || badges.active;
  };

  const shouldShowUpgrade = () => {
    // Si ya tiene 1 o más tiendas, mostrar "Mejorar Plan"
    return stores.length >= 1;
  };

  return (
    <div className="store-selector" ref={dropdownRef}>
      <button 
        ref={triggerRef}
        className="store-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="store-selector-current">
          {activeStore?.logo_url ? (
            <img 
              src={activeStore.logo_url} 
              alt={activeStore.name}
              className="store-selector-logo"
            />
          ) : (
            <div className="store-selector-logo-placeholder">
              {activeStore?.name?.charAt(0).toUpperCase() || 'T'}
            </div>
          )}
          <div className="store-selector-info">
            <div className="store-selector-name">{activeStore?.name || 'Sin tienda'}</div>
            <div className="store-selector-meta">
              {activeStore?.total_products || 0} productos
            </div>
          </div>
        </div>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none"
          className={`store-selector-arrow ${isOpen ? 'open' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="store-selector-dropdown" style={dropdownStyle}>
          <div className="store-selector-header">
            <span>Mis Tiendas</span>
            <span className="store-selector-count">{stores.length}</span>
          </div>

          <div className="store-selector-list">
            {stores.map((store) => (
              <button
                key={store.id}
                className={`store-selector-item ${activeStore?.id === store.id ? 'active' : ''}`}
                onClick={() => {
                  selectStore(store);
                  setIsOpen(false);
                }}
              >
                <div className="store-selector-item-content">
                  {store.logo_url ? (
                    <img 
                      src={store.logo_url} 
                      alt={store.name}
                      className="store-selector-item-logo"
                    />
                  ) : (
                    <div className="store-selector-item-logo-placeholder">
                      {store.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="store-selector-item-info">
                    <div className="store-selector-item-name">{store.name}</div>
                    <div className="store-selector-item-meta">
                      {store.total_products || 0} productos · {store.total_orders || 0} pedidos
                    </div>
                  </div>
                </div>
                {activeStore?.id === store.id && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="store-selector-footer">
            <Link 
              to="/dashboard/stores" 
              className="store-selector-footer-link"
              onClick={() => setIsOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Gestionar tiendas
            </Link>
            {shouldShowUpgrade() ? (
              <Link 
                to="/dashboard/settings" 
                className="store-selector-footer-link primary"
                onClick={() => setIsOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Mejorar plan
              </Link>
            ) : (
              <Link 
                to="/dashboard/stores/create" 
                className="store-selector-footer-link primary"
                onClick={() => setIsOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Nueva tienda
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
