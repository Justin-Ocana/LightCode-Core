import { motion } from 'framer-motion';

/**
 * Muestra las barras de cuota de entregas automáticas (plan free lightcode).
 * quota = { plugin_used, rcon_used, limit, reset_date, is_free_plan }
 * serverType = 'java' | 'bedrock' — si se pasa, muestra solo la barra relevante
 */
export default function AutoDeliveryQuota({ quota, serverType }) {
    if (!quota || !quota.is_free_plan) return null;

    const { plugin_used = 0, rcon_used = 0, limit = 15, reset_date } = quota;

    const resetLabel = reset_date
        ? new Date(reset_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
        : null;

    const allBars = [
        {
            key: 'plugin',
            label: 'Entregas automáticas — Plugin (Bedrock)',
            used: plugin_used,
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
            ),
        },
        {
            key: 'rcon',
            label: 'Entregas automáticas — RCON (Java)',
            used: rcon_used,
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
            ),
        },
    ];

    // Mostrar siempre ambas barras
    const bars = allBars;

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-5)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                    </svg>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        Cuota de entregas automáticas
                    </span>
                    <span style={{ background: 'rgba(0,212,170,0.1)', color: 'var(--primary)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: '100px', padding: '1px 8px', fontSize: '10px', fontWeight: 700 }}>
                        Plan Gratuito
                    </span>
                </div>
                {resetLabel && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        Se reinicia el {resetLabel}
                    </span>
                )}
            </div>

            {/* Barras */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
                {bars.map(({ label, used, icon }) => {
                    const pct = Math.min((used / limit) * 100, 100);
                    const remaining = Math.max(limit - used, 0);
                    const isExhausted = used >= limit;
                    const isWarning = !isExhausted && pct >= 80;

                    const barColor = isExhausted
                        ? '#EF4444'
                        : isWarning
                            ? '#F59E0B'
                            : 'var(--primary)';

                    return (
                        <div key={label}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                                    {icon}
                                    <span>{label}</span>
                                </div>
                                <span style={{
                                    fontSize: 'var(--text-xs)', fontWeight: 700,
                                    color: isExhausted ? '#EF4444' : isWarning ? '#F59E0B' : 'var(--text-primary)'
                                }}>
                                    {used}/{limit}
                                </span>
                            </div>

                            {/* Barra de progreso */}
                            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '100px', overflow: 'hidden' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                    style={{ height: '100%', background: barColor, borderRadius: '100px' }}
                                />
                            </div>

                            {/* Mensaje de estado */}
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', margin: '4px 0 0' }}>
                                {isExhausted
                                    ? '⚠ Límite alcanzado — los nuevos pedidos pasarán a entrega manual'
                                    : isWarning
                                        ? `Solo quedan ${remaining} entregas automáticas`
                                        : `${remaining} entregas disponibles`
                                }
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* CTA upgrade si alguna está agotada */}
            {bars.some(b => b.used >= limit) && (
                <div style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3) var(--space-4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap'
                }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                        Actualiza tu plan de lightcode para entregas automáticas ilimitadas.
                    </p>
                    <a href="/home/plans" style={{
                        background: 'var(--primary)', color: '#000', fontWeight: 700,
                        fontSize: 'var(--text-xs)', padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                        Ver planes
                    </a>
                </div>
            )}
        </div>
    );
}
