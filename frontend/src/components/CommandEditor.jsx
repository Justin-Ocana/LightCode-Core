/**
 * CommandEditor - Editor de comandos con exec_type, delay y validación
 * Cada comando es un objeto: { cmd, exec_type, delay_seconds }
 */
import React, { useState, useCallback } from 'react';

const EVENT_LABELS = {
  ON_PURCHASE: 'Al comprar',
};

const EVENT_DESCRIPTIONS = {
  ON_PURCHASE: 'Comandos que se ejecutan cuando el jugador compra el producto',
};

const EXEC_OPTIONS = [
  { value: 'player', label: 'Jugador que compró',      hint: 'Usa {player} o {username}' },
  { value: 'world',  label: 'Overworld (global)',       hint: 'Comandos globales del servidor' },
  { value: 'any',    label: 'Cualquier jugador online', hint: 'Fallback si el comprador no está' },
];

const EMPTY_NEW = { cmd: '', exec_type: 'player', delay_seconds: 0 };

export default function CommandEditor({
  commands,
  setCommands,
  commandErrors,
  setCommandErrors,
  allowedVariables,
  deliveryMode = 'MANUAL',
}) {
  const [expandedEvents, setExpandedEvents] = useState(['ON_PURCHASE']);
  const [newCommand, setNewCommand] = useState({});

  const isPlugin = deliveryMode === 'PLUGIN';

  const validateCommand = useCallback((cmd) => {
    if (!cmd || !cmd.trim()) return null;
    const variableRegex = /\{([^}]+)\}/g;
    const matches = [...cmd.matchAll(variableRegex)];
    const invalid = matches
      .map(m => m[0])
      .filter(v => !allowedVariables.includes(v) && v !== '{player}');
    if (invalid.length > 0) return `Variables no permitidas: ${invalid.join(', ')}`;
    return null;
  }, [allowedVariables]);

  const getNew = (event) => newCommand[event] ?? { ...EMPTY_NEW };

  const setNew = (event, patch) =>
    setNewCommand(prev => ({ ...prev, [event]: { ...getNew(event), ...patch } }));

  const handleAdd = (event) => {
    const entry = getNew(event);
    if (!entry.cmd.trim()) return;
    const error = validateCommand(entry.cmd);
    if (error) {
      setCommandErrors(prev => ({ ...prev, [event]: error }));
      return;
    }
    setCommands(prev => ({
      ...prev,
      [event]: [...(prev[event] || []), {
        cmd:           entry.cmd.trim(),
        exec_type:     entry.exec_type,
        delay_seconds: parseInt(entry.delay_seconds) || 0,
      }]
    }));
    setNewCommand(prev => ({ ...prev, [event]: { ...EMPTY_NEW } }));
    setCommandErrors(prev => ({ ...prev, [event]: null }));
  };

  const handleRemove = (event, index) =>
    setCommands(prev => ({ ...prev, [event]: prev[event].filter((_, i) => i !== index) }));

  const handleMove = (event, index, dir) => {
    const list = [...commands[event]];
    const to = dir === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    setCommands(prev => ({ ...prev, [event]: list }));
  };

  const toggleEvent = (event) =>
    setExpandedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );

  return (
    <div className="command-editor">
      <h2 className="section-title">Comandos</h2>
      <p className="section-description">
        Configura los comandos que se ejecutarán en diferentes eventos del ciclo de vida del producto.
        {isPlugin && <strong> Modo Bedrock: puedes configurar desde dónde se ejecuta cada comando y el delay.</strong>}
      </p>

      {/* Variables disponibles */}
      <div className="variables-panel">
        <div className="variables-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          <span>Variables disponibles:</span>
        </div>
        <div className="variables-list">
          {[...allowedVariables, '{player}'].map(v => (
            <button key={v} type="button" className="variable-tag"
              onClick={() => navigator.clipboard.writeText(v)} title="Click para copiar">
              <code>{v}</code>
            </button>
          ))}
        </div>
      </div>

      {/* Eventos */}
      <div className="events-list">
        {Object.keys(EVENT_LABELS).map(event => {
          const isExpanded = expandedEvents.includes(event);
          const list = commands[event] || [];

          return (
            <div key={event} className={`event-section ${isExpanded ? 'event-section-expanded' : ''}`}>
              <button type="button" className="event-header" onClick={() => toggleEvent(event)}>
                <div className="event-header-left">
                  <svg className="event-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="event-title">{EVENT_LABELS[event]}</span>
                  {event === 'ON_PURCHASE' && <span className="badge badge-required">Requerido</span>}
                  {list.length > 0 && <span className="badge badge-info">{list.length}</span>}
                </div>
              </button>

              {isExpanded && (
                <div className="event-content">
                  <p className="event-description">{EVENT_DESCRIPTIONS[event]}</p>

                  {/* Lista de comandos */}
                  {list.length > 0 && (
                    <div className="commands-list">
                      {list.map((entry, index) => {
                        const cmd = typeof entry === 'string' ? entry : entry.cmd;
                        const execType = typeof entry === 'object' ? entry.exec_type : 'player';
                        const delay = typeof entry === 'object' ? entry.delay_seconds : 0;
                        return (
                          <div key={index} className="command-item" style={{ flexWrap: 'wrap', gap: '6px' }}>
                            <div className="command-order">{index + 1}</div>
                            <code className="command-text" style={{ flex: 1 }}>{cmd}</code>
                            {isPlugin && (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px' }}>
                                  {EXEC_OPTIONS.find(o => o.value === execType)?.label ?? execType}
                                </span>
                                {delay > 0 && (
                                  <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px' }}>
                                    ⏱ {delay}s
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="command-actions">
                              <button type="button" className="btn-icon-sm"
                                onClick={() => handleMove(event, index, 'up')} disabled={index === 0} title="Mover arriba">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </button>
                              <button type="button" className="btn-icon-sm"
                                onClick={() => handleMove(event, index, 'down')} disabled={index === list.length - 1} title="Mover abajo">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </button>
                              <button type="button" className="btn-icon-sm btn-icon-danger"
                                onClick={() => handleRemove(event, index)} title="Eliminar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Input nuevo comando */}
                  <div className="add-command-form">
                    <div className="command-input-wrapper" style={{ flexWrap: 'wrap', gap: '8px' }}>
                      <input
                        type="text"
                        value={getNew(event).cmd}
                        onChange={e => setNew(event, { cmd: e.target.value })}
                        onKeyPress={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(event); } }}
                        placeholder="Ej: give {player} diamond 1"
                        className={`command-input ${commandErrors[event] ? 'command-input-error' : ''}`}
                        style={{ flex: 1, minWidth: '200px' }}
                      />

                      {/* Exec type — solo si es PLUGIN */}
                      {isPlugin && (
                        <select
                          value={getNew(event).exec_type}
                          onChange={e => setNew(event, { exec_type: e.target.value })}
                          className="input"
                          style={{ width: 'auto', minWidth: '160px', fontSize: '0.85rem' }}
                          title="Desde dónde ejecutar"
                        >
                          {EXEC_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Delay — solo si es PLUGIN */}
                      {isPlugin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            value={getNew(event).delay_seconds}
                            onChange={e => setNew(event, { delay_seconds: e.target.value })}
                            min="0" max="3600"
                            className="input"
                            style={{ width: '70px', fontSize: '0.85rem' }}
                            title="Delay en segundos antes de ejecutar"
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>s delay</span>
                        </div>
                      )}

                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handleAdd(event)}>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Agregar
                      </button>
                    </div>

                    {isPlugin && getNew(event).exec_type && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {EXEC_OPTIONS.find(o => o.value === getNew(event).exec_type)?.hint}
                      </p>
                    )}

                    {commandErrors[event] && (
                      <div className="command-error">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        {commandErrors[event]}
                      </div>
                    )}
                  </div>

                  {list.length === 0 && (
                    <div className="empty-commands">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                        <path d="M9 9h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <p>No hay comandos configurados para este evento</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
