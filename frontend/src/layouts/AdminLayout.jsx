import { useState } from 'react';
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import '../styles/admin-layout.css';

export default function AdminLayout() {
  const { admin, loading, logout } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/kv-admin/login" replace />;
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <div className="admin-logo-icon">K</div>
            {sidebarOpen && <span className="admin-logo-text">lightcode Admin</span>}
          </div>
        </div>

        <nav className="admin-nav">
          <NavLink to="/kv-admin" end className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {sidebarOpen && <span>Dashboard</span>}
          </NavLink>

          <NavLink to="/kv-admin/users" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Usuarios</span>}
          </NavLink>

          <NavLink to="/kv-admin/stores" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Tiendas</span>}
          </NavLink>

          <NavLink to="/kv-admin/orders" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Pedidos</span>}
          </NavLink>

          <NavLink to="/kv-admin/payments" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Pagos</span>}
          </NavLink>

          <NavLink to="/kv-admin/finances" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Finanzas</span>}
          </NavLink>

          <NavLink to="/kv-admin/rcon-queue" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Cola RCON</span>}
          </NavLink>

          <NavLink to="/kv-admin/rcon-lab" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>RCON Lab</span>}
          </NavLink>

          <NavLink to="/kv-admin/analytics" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarOpen && <span>Analytics</span>}
          </NavLink>

          <NavLink to="/kv-admin/settings" className="admin-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 1v6m0 6v6M1 12h6m6 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {sidebarOpen && <span>Configuración</span>}
          </NavLink>
        </nav>

        <button 
          className="admin-sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d={sidebarOpen ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </aside>

      {/* Main Content */}
      <div className="admin-main">
        {/* Top Navbar */}
        <header className="admin-header">
          <div className="admin-header-left">
            <h1 className="admin-page-title">Panel de Administración</h1>
          </div>

          <div className="admin-header-right">
            <div className="admin-user-menu">
              <div className="admin-user-avatar">
                {admin.username.charAt(0).toUpperCase()}
              </div>
              <div className="admin-user-info">
                <div className="admin-user-name">{admin.username}</div>
                <div className="admin-user-role">{admin.role}</div>
              </div>
              <button className="admin-logout-btn" onClick={logout}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
