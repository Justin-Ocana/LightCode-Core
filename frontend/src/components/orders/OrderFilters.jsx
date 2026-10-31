import { useState } from 'react';

export default function OrderFilters({ filters, setFilters }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const statusOptions = [
    { value: 'requested', label: 'Solicitado', color: '#FCD34D' },
    { value: 'processing', label: 'Procesando', color: '#93C5FD' },
    { value: 'delivered', label: 'Entregado', color: '#00D4AA' },
    { value: 'failed', label: 'Fallido', color: '#F87171' },
    { value: 'cancelled', label: 'Cancelado', color: '#6B7280' },
    { value: 'refunded', label: 'Reembolsado', color: '#A78BFA' }
  ];

  const deliveryMethodOptions = [
    { value: 'rcon', label: 'RCON Automático' },
    { value: 'plugin', label: 'Plugin (Bedrock)' },
    { value: 'manual', label: 'Manual' },
  ];

  const toggleStatus = (status) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const toggleDeliveryMethod = (method) => {
    setFilters(prev => ({
      ...prev,
      deliveryMethod: prev.deliveryMethod.includes(method)
        ? prev.deliveryMethod.filter(m => m !== method)
        : [...prev.deliveryMethod, method]
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: [],
      deliveryMethod: [],
      dateRange: { start: null, end: null },
      amountRange: { min: null, max: null },
      hasRconErrors: false,
      limitReached: false,
    });
  };

  const activeFiltersCount = 
    filters.status.length + 
    filters.deliveryMethod.length + 
    (filters.dateRange.start ? 1 : 0) +
    (filters.amountRange.min ? 1 : 0) +
    (filters.hasRconErrors ? 1 : 0) +
    (filters.limitReached ? 1 : 0);

  return (
    <div className="order-filters">
      <div className="order-filters-search">
        <svg className="input-group-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M15 15L19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          className="input"
          placeholder="Buscar por #pedido, usuario MC, email, transaction ID..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        {filters.search && (
          <button 
            className="input-clear-btn"
            onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      <div className="order-filters-quick">
        <div className="filter-group">
          <label className="filter-label">Estado:</label>
          <div className="filter-chips">
            {statusOptions.map(option => (
              <button
                key={option.value}
                className={`filter-chip ${filters.status.includes(option.value) ? 'active' : ''}`}
                onClick={() => toggleStatus(option.value)}
                style={filters.status.includes(option.value) ? {
                  borderColor: option.color,
                  background: `${option.color}15`,
                  color: option.color
                } : {}}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Método de entrega:</label>
          <div className="filter-chips">
            {deliveryMethodOptions.map(option => (
              <button
                key={option.value}
                className={`filter-chip ${filters.deliveryMethod.includes(option.value) ? 'active' : ''}`}
                onClick={() => toggleDeliveryMethod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button 
          className="btn btn-sm btn-ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M3 6h4M17 6h-6M3 14h10M17 14h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="9" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="15" cy="14" r="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Filtros avanzados
          {activeFiltersCount > 0 && (
            <span className="badge badge-primary" style={{ marginLeft: 'var(--space-2)' }}>
              {activeFiltersCount}
            </span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button 
            className="btn btn-sm btn-ghost"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="order-filters-advanced">
          <div className="filter-advanced-grid">
            <div className="form-group">
              <label className="form-label">Fecha desde</label>
              <input
                type="date"
                className="input"
                value={filters.dateRange.start || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, start: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha hasta</label>
              <input
                type="date"
                className="input"
                value={filters.dateRange.end || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, end: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Monto mínimo</label>
              <div className="input-group">
                <span className="input-group-prefix">$</span>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  value={filters.amountRange.min || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    amountRange: { ...prev.amountRange, min: e.target.value }
                  }))}
                  style={{ paddingLeft: '32px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Monto máximo</label>
              <div className="input-group">
                <span className="input-group-prefix">$</span>
                <input
                  type="number"
                  className="input"
                  placeholder="999.99"
                  value={filters.amountRange.max || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    amountRange: { ...prev.amountRange, max: e.target.value }
                  }))}
                  style={{ paddingLeft: '32px' }}
                />
              </div>
            </div>
          </div>

          <label className="checkbox-group">
            <input
              type="checkbox"
              checked={filters.hasRconErrors}
              onChange={(e) => setFilters(prev => ({ ...prev, hasRconErrors: e.target.checked }))}
            />
            <span>Solo pedidos con errores de RCON</span>
          </label>

          <label className="checkbox-group">
            <input
              type="checkbox"
              checked={filters.limitReached || false}
              onChange={(e) => setFilters(prev => ({ ...prev, limitReached: e.target.checked }))}
            />
            <span>Solo pedidos con límite de entregas automáticas alcanzado</span>
          </label>
        </div>
      )}
    </div>
  );
}
