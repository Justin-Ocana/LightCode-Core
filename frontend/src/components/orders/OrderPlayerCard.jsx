/**
 * OrderPlayerCard - Tarjeta destacada con información del jugador
 */
export function OrderPlayerCard({ order }) {
  return (
    <div className="order-player-card">
      <img 
        src={`https://mc-heads.net/avatar/${order.minecraftUsername}/80`}
        alt={order.minecraftUsername}
        className="order-player-avatar"
        onError={(e) => e.target.src = 'https://mc-heads.net/avatar/Steve/80'}
      />
      <div className="order-player-info">
        <div className="order-player-label">Usuario Minecraft</div>
        <div className="order-player-name">{order.minecraftUsername}</div>
        <div className="order-player-product">{order.productName}</div>
      </div>
    </div>
  );
}
