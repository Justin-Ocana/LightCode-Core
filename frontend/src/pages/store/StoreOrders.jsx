import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  Search,
  Calendar,
  Gamepad2,
  ShoppingBag
} from 'lucide-react';
import { useBuyer } from '../../context/BuyerContext';
import { getMediaUrl } from '../../services/api';
import toast from 'react-hot-toast';
import '../../styles/store/buttons.css';
import '../../styles/store/orders.css';

/**
 * StoreOrders - Página de "Mis Pedidos" para compradores
 * Requiere autenticación como buyer
 */
export function StoreOrders() {
  const navigate = useNavigate();
  const { store } = useOutletContext();
  const { buyer, loading: buyerLoading } = useBuyer();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Redirigir a login si no está autenticado
  useEffect(() => {
    if (!buyerLoading && !buyer) {
      navigate('/login?redirect=orders');
    }
  }, [buyer, buyerLoading, navigate]);

  // Cargar pedidos del buyer autenticado
  useEffect(() => {
    if (buyer && store) {
      loadOrders();
    }
  }, [buyer, store]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Endpoint público que solo requiere email (sin autenticación)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stores/${store.slug}/orders/my-orders/?email=${encodeURIComponent(buyer.user.email)}`
      );

      if (!response.ok) {
        throw new Error('Error al cargar pedidos');
      }

      const data = await response.json();
      setOrders(data.orders || []);
      
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('No se pudieron cargar tus pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar pedidos
  const filteredOrders = orders.filter(order => {
    // Filtro por estado
    if (filter !== 'all' && order.status !== filter) {
      return false;
    }
    
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        order.order_number.toLowerCase().includes(search) ||
        order.product_snapshot?.name?.toLowerCase().includes(search) ||
        order.minecraft_username.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  // Obtener icono y color por estado
  const getStatusInfo = (status) => {
    switch (status) {
      case 'requested':
        return { icon: Clock, label: 'Solicitado', color: 'warning' };
      case 'processing':
        return { icon: AlertCircle, label: 'Procesando', color: 'info' };
      case 'delivered':
        return { icon: CheckCircle2, label: 'Entregado', color: 'success' };
      case 'failed':
        return { icon: XCircle, label: 'Fallido', color: 'error' };
      case 'cancelled':
        return { icon: XCircle, label: 'Cancelado', color: 'muted' };
      case 'refunded':
        return { icon: AlertCircle, label: 'Reembolsado', color: 'warning' };
      default:
        return { icon: Package, label: status, color: 'muted' };
    }
  };

  if (!store || buyerLoading) {
    return null; // StoreLayout handles loading
  }

  return (
    <div className="store-page">
      <div className="store-container">
        <div className="store-orders">
          {/* Header */}
          <div className="store-orders__header">
            <div>
              <h1 className="store-orders__title">
                <Package size={32} />
                Mis Pedidos
              </h1>
              <p className="store-orders__subtitle">
                Historial de compras en {store.name}
              </p>
            </div>
          </div>

          {/* Filtros y búsqueda */}
          <div className="store-orders__filters">
            <div className="store-orders__search">
              <Search size={20} />
              <input 
                type="text"
                placeholder="Buscar por orden, producto o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="store-orders__search-input"
              />
            </div>

            <div className="store-orders__filter-buttons">
              <button 
                className={`store-btn ${filter === 'all' ? 'store-btn--primary' : 'store-btn--secondary'} store-orders__filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Todos
              </button>
              <button 
                className={`store-btn ${filter === 'delivered' ? 'store-btn--primary' : 'store-btn--secondary'} store-orders__filter-btn ${filter === 'delivered' ? 'active' : ''}`}
                onClick={() => setFilter('delivered')}
              >
                Entregados
              </button>
              <button 
                className={`store-btn ${filter === 'processing' ? 'store-btn--primary' : 'store-btn--secondary'} store-orders__filter-btn ${filter === 'processing' ? 'active' : ''}`}
                onClick={() => setFilter('processing')}
              >
                En proceso
              </button>
              <button 
                className={`store-btn ${filter === 'failed' ? 'store-btn--primary' : 'store-btn--secondary'} store-orders__filter-btn ${filter === 'failed' ? 'active' : ''}`}
                onClick={() => setFilter('failed')}
              >
                Fallidos
              </button>
            </div>
          </div>

          {/* Lista de pedidos */}
          {loading ? (
            <div className="store-orders__loading">
              <div className="spinner" />
              <p>Cargando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="store-orders__empty">
              <ShoppingBag size={64} />
              <h3>No hay pedidos</h3>
              <p>
                {searchTerm || filter !== 'all' 
                  ? 'No se encontraron pedidos con los filtros aplicados'
                  : 'Aún no has realizado ninguna compra en esta tienda. Tus pedidos aparecerán aquí después de tu primera compra.'
                }
              </p>
              <Link to={`/shop`} className="store-btn store-btn--primary">
                Ir a la tienda
              </Link>
            </div>
          ) : (
            <div className="store-orders__list">
              {filteredOrders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <Link 
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="store-order-card"
                  >
                    {/* Header compacto con número y estado */}
                    <div className="store-order-card__header">
                      <div className="store-order-card__number">
                        <Package size={18} />
                        <span>{order.order_number}</span>
                      </div>
                      <div className={`store-order-card__status store-order-card__status--${statusInfo.color}`}>
                        <StatusIcon size={14} />
                        <span>{statusInfo.label}</span>
                      </div>
                    </div>

                    {/* Contenido principal */}
                    <div className="store-order-card__body">
                      {/* Imagen del producto */}
                      {order.product_snapshot?.image_url && (
                        <img 
                          src={getMediaUrl(order.product_snapshot.image_url)}
                          alt={order.product_snapshot.name}
                          className="store-order-card__image"
                        />
                      )}

                      {/* Información del pedido */}
                      <div className="store-order-card__info">
                        {/* Nombre del producto - PROTAGONISTA */}
                        <h3 className="store-order-card__product-name">
                          {order.product_snapshot?.name || 'Producto sin nombre'}
                        </h3>
                        
                        {/* Metadatos en una línea */}
                        <div className="store-order-card__metadata">
                          <span className="store-order-card__meta-item">
                            <Gamepad2 size={14} />
                            {order.minecraft_username}
                          </span>
                          <span className="store-order-card__meta-separator">•</span>
                          <span className="store-order-card__meta-item">
                            <Calendar size={14} />
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span className="store-order-card__meta-separator">•</span>
                          <span className="store-order-card__meta-item store-order-card__meta-item--price">
                            ${Number(order.amount_after_discount).toFixed(2)}
                          </span>
                          {order.delivery_method === 'rcon' && (
                            <>
                              <span className="store-order-card__meta-separator">•</span>
                              <span className="store-order-card__meta-item store-order-card__meta-item--delivery">
                                Automático
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Icono de navegación */}
                      <div className="store-order-card__arrow">
                        <ChevronRight size={24} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Información adicional */}
          <div className="store-orders__help">
            <h3>¿Necesitas ayuda con un pedido?</h3>
            <p>
              Si tienes algún problema con tu compra, contacta con el soporte de la tienda.
            </p>
            {store.discord_invite && (
              <a 
                href={store.discord_invite} 
                target="_blank" 
                rel="noopener noreferrer"
                className="store-btn store-btn--secondary"
              >
                Soporte en Discord
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
