/**
 * Dashboard Layout Simplificado - White-label (con slug dinámico)
 */
import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useNotifications } from '../context/NotificationContext';
import Toast from '../components/Toast';
import '../styles/dashboard.css';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { store, loading: storeLoading } = useStore();
  const { notifications, unreadCount, toasts, markAsRead, markAllAsRead, dismissToast } = useNotifications();

  // Ocultar layout en páginas de editor fullscreen
  const isFullscreenEditor = location.pathname.includes('/theme-editor') || location.pathname.includes('/home-editor');

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Build navigation items with dynamic slug (use placeholder if store not loaded yet)
  const storeSlug = store?.slug || 'loading';

  const navItems = [
    {
      section: 'GENERAL',
      items: [
        { path: `/dashboard/${storeSlug}`, icon: 'dashboard', label: 'Dashboard' },
        { path: `/dashboard/${storeSlug}/orders`, icon: 'orders', label: 'Pedidos' },
      ]
    },
    {
      section: 'TIENDA',
      items: [
        { path: `/dashboard/${storeSlug}/products`, icon: 'products', label: 'Productos' },
        { path: `/dashboard/${storeSlug}/categories`, icon: 'categories', label: 'Categorías' },
      ]
    },
    {
      section: 'MARKETING',
      items: [
        { path: `/dashboard/${storeSlug}/discounts`, icon: 'discounts', label: 'Descuentos' },
        { path: `/dashboard/${storeSlug}/analytics`, icon: 'analytics', label: 'Analíticas' },
        { path: `/dashboard/${storeSlug}/customers`, icon: 'customers', label: 'Compradores' },
      ]
    },
    {
      section: 'CONFIGURACIÓN',
      items: [
        { path: `/dashboard/${storeSlug}/settings`, icon: 'settings', label: 'Configuración' },
        { path: `/dashboard/${storeSlug}/rcon-config`, icon: 'rcon', label: 'RCON Config' },
        { path: `/dashboard/${storeSlug}/rcon-lab`, icon: 'entregas', label: 'RCON Lab' },
      ]
    }
  ];

  const getIcon = (name) => {
    const icons = {
      dashboard: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      orders: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      products: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      categories: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      discounts: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      customers: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      analytics: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      customization: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      rcon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      entregas: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      ),
      payment: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      settings: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    };
    return icons[name] || null;
  };

  return (
    <div className="dashboard-layout">
      {/* Navbar */}
      {!isFullscreenEditor && (
        <header className="dashboard-navbar">
          <div className="navbar-left">
            <button
              className="navbar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <div className="navbar-brand">
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="sailGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F9FAFB"/>
                    <stop offset="100%" stopColor="#D1D5DB"/>
                  </linearGradient>
                  <linearGradient id="sailGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E5E7EB"/>
                    <stop offset="100%" stopColor="#9CA3AF"/>
                  </linearGradient>
                </defs>
                {/* Barco de papel */}
                <g transform="translate(20, 5)">
                  {/* Vela principal (izquierda) */}
                  <path d="M0 5 L0 25 L-12 25 Z" fill="url(#sailGrad1)" stroke="#9CA3AF" strokeWidth="0.5"/>
                  {/* Vela secundaria (derecha) */}
                  <path d="M0 5 L0 25 L12 25 Z" fill="url(#sailGrad2)" stroke="#9CA3AF" strokeWidth="0.5"/>
                  {/* Casco del barco */}
                  <path d="M-15 25 L0 30 L15 25 L12 25 L0 28 L-12 25 Z" fill="#9CA3AF" stroke="#6B7280" strokeWidth="0.5"/>
                  {/* Mástil central */}
                  <line x1="0" y1="5" x2="0" y2="30" stroke="#6B7280" strokeWidth="1"/>
                  {/* Bandera en la punta */}
                  <path d="M0 5 L3 7 L0 9 Z" fill="#F3F4F6"/>
                </g>
              </svg>
              <span className="navbar-brand-text">LightCode Core</span>
            </div>
          </div>

          <div className="navbar-right">
            {/* Notificaciones */}
            <div className="navbar-notifications">
              <button
                className="navbar-notification-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="notifications-overlay"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="notifications-dropdown">
                    <div className="notifications-dropdown-header">
                      <h3>Notificaciones</h3>
                      {unreadCount > 0 && (
                        <button
                          className="notifications-mark-all-read"
                          onClick={markAllAsRead}
                        >
                          Marcar todas como leídas
                        </button>
                      )}
                    </div>

                    <div className="notifications-dropdown-list">
                      {notifications.length === 0 ? (
                        <div className="notifications-empty">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <p>No hay notificaciones</p>
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification.id}
                            className={`notification-item ${!notification.read ? 'unread' : ''}`}
                            data-type={notification.type}
                            onClick={() => {
                              markAsRead(notification.id);
                              if (notification.data?.order_id) {
                                navigate(`/dashboard/${store?.slug}/orders/${notification.data.order_id}`);
                                setNotificationsOpen(false);
                              }
                            }}
                          >
                            <div className="notification-item-icon">
                              {notification.type === 'new_order' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              {notification.type === 'order_delivered' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              {notification.type === 'order_failed' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                  <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              )}
                              {notification.type === 'payment_received' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              {notification.type === 'low_stock' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              {notification.type === 'server_offline' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              {notification.type === 'system' && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div className="notification-item-content">
                              <div className="notification-item-title">{notification.title}</div>
                              <div className="notification-item-message">{notification.message}</div>
                              <div className="notification-item-time">
                                {new Date(notification.created_at).toLocaleString('es-ES', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                            {!notification.read && <div className="notification-item-dot"></div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Perfil */}
            <div className="navbar-profile">
              <button
                className="navbar-profile-btn"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="navbar-profile-avatar">
                  {user?.username?.charAt(0).toUpperCase() || 'A'}
                </div>
                <span className="navbar-profile-name">{user?.username || 'Admin'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {profileOpen && (
                <>
                  <div
                    className="profile-overlay"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-header">
                      <div className="profile-dropdown-avatar">
                        {user?.username?.charAt(0).toUpperCase() || 'A'}
                      </div>
                      <div className="profile-dropdown-info">
                        <div className="profile-dropdown-name">{user?.username || 'Admin'}</div>
                        <div className="profile-dropdown-email">{user?.email || ''}</div>
                      </div>
                    </div>
                    <div className="profile-dropdown-divider"></div>
                    <Link
                      to={store ? `/dashboard/${store.slug}/settings` : '#'}
                      className="profile-dropdown-item"
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      Configuración
                    </Link>
                    <Link to="/" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      Ver tienda
                    </Link>
                    <div className="profile-dropdown-divider"></div>
                    <button className="profile-dropdown-item" onClick={handleLogout}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Sidebar */}
      {!isFullscreenEditor && (
        <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {navItems.map((section, idx) => (
              <div key={idx} className="sidebar-section">
                <div className="sidebar-section-title">{section.section}</div>
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="sidebar-link-icon">{getIcon(item.icon)}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className={`dashboard-main ${sidebarOpen ? 'expanded' : ''} ${isFullscreenEditor ? 'fullscreen' : ''}`}>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={dismissToast}
          />
        ))}
      </div>
    </div>
  );
}