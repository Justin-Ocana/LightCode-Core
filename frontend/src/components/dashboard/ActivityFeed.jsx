/**
 * ActivityFeed - Feed de últimas ventas
 */
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';

export default function ActivityFeed({ orders = [] }) {
  const navigate = useNavigate();
  const { activeStore } = useStore();

  // Convertir órdenes a actividades - solo ventas completadas
  const activities = orders
    .filter(order => order.status === 'delivered')
    .slice(0, 8)
    .map(order => {
      // Priorizar minecraft_username si existe, sino usar buyer_paypal_name o email
      const minecraftUsername = order.minecraft_username;
      const buyerName = minecraftUsername || order.buyer_paypal_name || order.buyer_contact_email?.split('@')[0] || 'Cliente';
      const productName = order.product_snapshot?.name || 'producto';
      const amount = parseFloat(order.seller_credited || order.amount_after_discount || 0);

      return {
        id: order.id,
        type: 'sale',
        buyerName,
        minecraftUsername,
        productName,
        amount,
        time: new Date(order.created_at),
        orderNumber: order.order_number,
        // Si tiene minecraft username, usar avatar de Minecraft, sino inicial
        avatarUrl: minecraftUsername ? `https://mc-heads.net/avatar/${minecraftUsername}/40` : null,
        avatar: buyerName.charAt(0).toUpperCase()
      };
    });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const handleActivityClick = (activity) => {
    if (activity.orderNumber && activeStore) {
      navigate(`/dashboard/${activeStore.slug}/orders/${activity.id}`);
    }
  };

  const handleViewAll = () => {
    if (activeStore) {
      navigate(`/dashboard/${activeStore.slug}/orders`);
    }
  };

  return (
    <div className="activity-card">
      <div className="activity-card-header">
        <h3 className="activity-card-title">Últimas ventas</h3>
        {activities.length > 0 && (
          <button 
            onClick={handleViewAll}
            className="activity-view-all-btn"
          >
            Ver todo
          </button>
        )}
      </div>
      <div className="activity-list">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div 
              key={activity.id} 
              className="activity-item sale-item"
              onClick={() => handleActivityClick(activity)}
            >
              <div className="sale-avatar">
                {activity.avatarUrl ? (
                  <img 
                    src={activity.avatarUrl} 
                    alt={activity.buyerName}
                    onError={(e) => {
                      // Si falla la carga de la imagen, mostrar inicial
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span className="sale-avatar-fallback" style={{ display: activity.avatarUrl ? 'none' : 'flex' }}>
                  {activity.avatar}
                </span>
              </div>
              <div className="sale-content">
                <div className="sale-buyer">{activity.buyerName}</div>
                <div className="sale-product">{activity.productName}</div>
              </div>
              <div className="sale-details">
                <div className="sale-amount">{formatCurrency(activity.amount)}</div>
                <div className="sale-time">
                  {formatDistanceToNow(activity.time, { addSuffix: true, locale: es })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="activity-empty">
            <div className="activity-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="activity-empty-title">Sin ventas aún</div>
            <div className="activity-empty-description">
              Tus ventas completadas aparecerán aquí
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
