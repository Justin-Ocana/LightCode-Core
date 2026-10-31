/**
 * StatCard - Card de estadística con icono y cambio porcentual
 */
export default function StatCard({ title, value, change, icon, trend = 'positive' }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <div className="stat-card-icon">
          {icon}
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
      {change && (
        <div className={`stat-card-change ${trend}`}>
          {trend === 'positive' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
