export default function StatCard({ label, value, change, changeType, valueColor }) {
    const changeIcons = {
        up: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
        down: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    };
    
    const changeClassName = changeType === 'up' ? 'stat-change stat-change-up' : 
                           changeType === 'down' ? 'stat-change stat-change-down' : 
                           'stat-change';
    
    return (
        <div className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={valueColor ? { color: valueColor } : {}}>{value}</div>
            <div className={changeClassName}>
                {changeType && changeIcons[changeType]}
                {change}
            </div>
        </div>
    );
}
