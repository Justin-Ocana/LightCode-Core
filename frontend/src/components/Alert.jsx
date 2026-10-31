/**
 * Alert Component - Siguiendo el Design System de lightcode
 */

const Alert = ({ type = 'info', title, message, onClose }) => {
  const icons = {
    info: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 9v5M10 7v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    success: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    warning: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 3L18 17H2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M10 9v3M10 14v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    error: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    danger: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  };

  // Mapear 'error' a 'danger' para compatibilidad con el Design System
  const alertType = type === 'error' ? 'danger' : type;

  return (
    <div className={`alert alert-${alertType}`}>
      {icons[type] && (
        <div className="alert-icon">
          {icons[type]}
        </div>
      )}
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div className="alert-body">{message}</div>
      </div>
      {onClose && (
        <button 
          className="alert-close" 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'currentColor',
            cursor: 'pointer',
            padding: '4px',
            opacity: 0.6,
            transition: 'opacity 0.2s',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;
