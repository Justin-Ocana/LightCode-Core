/**
 * Dashboard Home - Página principal del dashboard
 * Layout de 3 zonas: Header + Métricas + Gráfico | Actividad + Acciones + Estado Servidor
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import LoadingScreen from '../../components/LoadingScreen';
import SalesChart from '../../components/dashboard/SalesChart';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import AutoDeliveryQuota from '../../components/orders/AutoDeliveryQuota';
import { useSlowLoading } from '../../hooks/useSlowLoading';
import toast from 'react-hot-toast';
import api from '../../services/api';
import '../../styles/dashboard-home.css';

export default function DashboardHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { store, loading: storeLoading } = useStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [balance, setBalance] = useState(null);
  const [financeStats, setFinanceStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [quota, setQuota] = useState(null);
  const [serverType, setServerType] = useState('java');
  const isSlowLoading = useSlowLoading(loading || storeLoading);

  // Redirect to /dashboard/:slug when store loads
  useEffect(() => {
    if (store && location.pathname === '/dashboard') {
      navigate(`/dashboard/${store.slug}`, { replace: true });
    }
  }, [store, location.pathname, navigate]);

  useEffect(() => {
    if (store) {
      loadStats(store.slug);
      loadBalance();
      loadFinanceStats();
    } else if (!storeLoading) {
      setLoading(false);
    }
  }, [store, storeLoading]);

  const loadStats = async (storeSlug) => {
    try {
      // Fetch ALL orders from new dashboard stats endpoint (no pagination)
      const response = await api.get(`/orders/dashboard-stats/?store=${storeSlug}`);
      const allOrders = response.data.orders || [];
      
      // Guardar quota de entregas automáticas
      if (response.data.auto_delivery_quota) {
        setQuota(response.data.auto_delivery_quota);
      }
      
      // Guardar órdenes para usar en gráfico y actividad
      setOrders(allOrders);
      
      // Filter only delivered orders for earnings calculations
      const deliveredOrders = allOrders.filter(o => o.status === 'delivered');
      
      // Calculate today's earnings (delivered orders from today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDelivered = deliveredOrders.filter(o => {
        const orderDate = new Date(o.created_at);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });
      const todayEarnings = todayDelivered.reduce((sum, o) => sum + parseFloat(o.gross_amount || o.amount_after_discount || 0), 0);
      
      // Calculate yesterday's earnings for comparison
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDelivered = deliveredOrders.filter(o => {
        const orderDate = new Date(o.created_at);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === yesterday.getTime();
      });
      const yesterdayEarnings = yesterdayDelivered.reduce((sum, o) => sum + parseFloat(o.gross_amount || o.amount_after_discount || 0), 0);
      const todayChange = yesterdayEarnings > 0 ? Math.round(((todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100) : (todayEarnings > 0 ? 100 : 0);
      
      // Calculate month's earnings (delivered orders from current month)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthDelivered = deliveredOrders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= monthStart;
      });
      const monthEarnings = monthDelivered.reduce((sum, o) => sum + parseFloat(o.gross_amount || o.amount_after_discount || 0), 0);
      
      // Calculate last month's earnings for comparison
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      const lastMonthDelivered = deliveredOrders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
      });
      const lastMonthEarnings = lastMonthDelivered.reduce((sum, o) => sum + parseFloat(o.gross_amount || o.amount_after_discount || 0), 0);
      const monthChange = lastMonthEarnings > 0 ? Math.round(((monthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100) : (monthEarnings > 0 ? 100 : 0);
      
      // Total orders count (all orders)
      const totalOrders = allOrders.length;
      
      // Calculate orders from last 30 days for comparison
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentOrders = allOrders.filter(o => new Date(o.created_at) >= thirtyDaysAgo).length;
      const ordersChange = recentOrders;
      
      // New customers (unique buyer emails)
      const uniqueBuyers = new Set(allOrders.map(o => o.buyer_contact_email).filter(Boolean));
      const newCustomers = uniqueBuyers.size;
      
      // Calculate new customers from last 30 days
      const recentBuyers = new Set(
        allOrders
          .filter(o => new Date(o.created_at) >= thirtyDaysAgo)
          .map(o => o.buyer_contact_email)
          .filter(Boolean)
      );
      const customersChange = recentBuyers.size;
      
      setStats({
        todayEarnings,
        todayChange,
        monthEarnings,
        monthChange,
        totalOrders,
        ordersChange,
        newCustomers,
        customersChange,
      });
    } catch (error) {
      toast.error('Error al cargar estadísticas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const response = await api.get('/orders/balance/summary/');
      setBalance(response.data);
    } catch (error) {
      console.error('Error loading balance:', error);
      // Don't show error toast, just log it
    }
  };

  const loadFinanceStats = async () => {
    try {
      const response = await api.get('/finances/dashboard-stats/');
      setFinanceStats(response.data);
    } catch (error) {
      console.error('Error loading finance stats:', error);
      // Don't show error toast, just log it
    }
  };

  const getDateString = () => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const now = new Date();
    return `${days[now.getDay()]} ${now.getDate()} de ${months[now.getMonth()]}`;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (loading || !store) {
    return <LoadingScreen message="Cargando dashboard" isSlowLoading={isSlowLoading} />;
  }

  return (
    <div className="dashboard-home">
      {/* Header compacto */}
      <div className="dashboard-home-header">
        <div className="dashboard-home-header-left">
          <h1 className="dashboard-home-title">
            Dashboard · <span className="dashboard-home-date">{getDateString()}</span>
          </h1>
          <p className="dashboard-home-subtitle">{store.name}</p>
        </div>
        {stats?.totalOrders > 0 && (
          <div className="dashboard-home-header-right">
            <Link 
              to={`/dashboard/${store.slug}/orders`}
              className="dashboard-orders-btn"
            >
              Ver pedidos ({stats.totalOrders})
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="12 5 19 12 12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Métricas principales */}
      <div className="dashboard-metrics-grid">
        <div className="dashboard-metric-card metric-earnings-month">
          <div className="dashboard-metric-header">
            <span className="dashboard-metric-label">Ganancias este mes</span>
            <div className="dashboard-metric-icon icon-earnings">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="dashboard-metric-value">
            {formatCurrency(financeStats?.this_month?.revenue || stats?.monthEarnings || 0)}
          </div>
          {stats?.monthChange !== 0 && (
            <div className="dashboard-metric-trend">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <polyline points={stats?.monthChange > 0 ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {stats?.monthChange > 0 ? '+' : ''}{stats?.monthChange}% vs mes anterior
            </div>
          )}
        </div>

        <div className="dashboard-metric-card metric-earnings-today">
          <div className="dashboard-metric-header">
            <span className="dashboard-metric-label">Ganancias hoy</span>
            <div className="dashboard-metric-icon icon-today">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="dashboard-metric-value">
            {formatCurrency(financeStats?.today?.revenue || stats?.todayEarnings || 0)}
          </div>
          {stats?.todayChange !== 0 && (
            <div className="dashboard-metric-trend">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <polyline points={stats?.todayChange > 0 ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {stats?.todayChange > 0 ? '+' : ''}{stats?.todayChange}% vs ayer
            </div>
          )}
        </div>

        <div className="dashboard-metric-card metric-orders">
          <div className="dashboard-metric-header">
            <span className="dashboard-metric-label">Pedidos totales</span>
            <div className="dashboard-metric-icon icon-orders">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="dashboard-metric-value">
            {financeStats?.all_time?.transactions || stats?.totalOrders || 0}
          </div>
          {stats?.ordersChange > 0 && (
            <div className="dashboard-metric-trend">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              +{stats?.ordersChange} últimos 30 días
            </div>
          )}
        </div>

        <div className="dashboard-metric-card metric-customers">
          <div className="dashboard-metric-header">
            <span className="dashboard-metric-label">Compradores nuevos</span>
            <div className="dashboard-metric-icon icon-customers">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="dashboard-metric-value">{stats?.newCustomers || 0}</div>
          {stats?.customersChange > 0 && (
            <div className="dashboard-metric-trend">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              +{stats?.customersChange} últimos 30 días
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de ventas - con datos reales */}
      <SalesChart orders={orders} />

      {/* Grid inferior: Actividad + Acciones + Estado */}
      <AutoDeliveryQuota quota={quota} serverType={serverType} />
      <div className="dashboard-bottom-grid">
        {/* Actividad reciente - con datos reales */}
        <ActivityFeed orders={orders} />

        {/* Acciones rápidas + Estado del servidor */}
        <div className="dashboard-sidebar-widgets">
          {/* Acciones rápidas */}
          <div className="dashboard-quick-actions">
            <h3 className="dashboard-section-title">Acciones rápidas</h3>
            <div className="dashboard-quick-actions-list">
              <Link to={`/dashboard/${store.slug}/products/create`} className="dashboard-quick-action">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Agregar producto
              </Link>
              <Link to={`/dashboard/${store.slug}/orders`} className="dashboard-quick-action">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Ver pedidos
              </Link>
              <a 
                href="/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="dashboard-quick-action"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Ver mi tienda
              </a>
            </div>
          </div>

          {/* Estado del servidor */}
          <div className="dashboard-server-status">
            <h3 className="dashboard-section-title">Estado del servidor</h3>
            <div className="dashboard-server-info">
              <div className="dashboard-server-row">
                <span className="dashboard-server-label">IP</span>
                <span className="dashboard-server-value" style={{ color: 'var(--text-tertiary)' }}>No configurado</span>
              </div>
              <div className="dashboard-server-row">
                <span className="dashboard-server-label">Estado</span>
                <span className="dashboard-server-status-badge" style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}>
                  <span className="dashboard-server-status-dot" style={{ background: 'var(--text-tertiary)' }}></span>
                  Sin conexión
                </span>
              </div>
              <div className="dashboard-server-row">
                <span className="dashboard-server-label">RCON</span>
                <span className="dashboard-server-status-badge" style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}>
                  <span className="dashboard-server-status-dot" style={{ background: 'var(--text-tertiary)' }}></span>
                  No configurado
                </span>
              </div>
            </div>
          </div>

          {/* Balance y retiros */}
          {balance && (
            <div className="dashboard-server-status">
              <h3 className="dashboard-section-title">Balance</h3>
              <div className="dashboard-server-info">
                <div className="dashboard-server-row">
                  <span className="dashboard-server-label">Disponible</span>
                  <span className="dashboard-server-value" style={{ color: 'var(--success)', fontWeight: '600' }}>
                    {formatCurrency(parseFloat(balance.available_balance))}
                  </span>
                </div>
                <div className="dashboard-server-row">
                  <span className="dashboard-server-label">Pendiente</span>
                  <span className="dashboard-server-value" style={{ color: 'var(--warning)' }}>
                    {formatCurrency(parseFloat(balance.pending_balance))}
                  </span>
                </div>
                <div className="dashboard-server-row">
                  <span className="dashboard-server-label">Total ganado</span>
                  <span className="dashboard-server-value">
                    {formatCurrency(parseFloat(balance.total_earned))}
                  </span>
                </div>
                {balance.pending_withdrawals && balance.pending_withdrawals.length > 0 && (
                  <div className="dashboard-server-row">
                    <span className="dashboard-server-label">Retiros pendientes</span>
                    <span className="dashboard-server-status-badge" style={{ color: 'var(--warning)', border: '1px solid var(--warning)' }}>
                      <span className="dashboard-server-status-dot" style={{ background: 'var(--warning)' }}></span>
                      {balance.pending_withdrawals.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
