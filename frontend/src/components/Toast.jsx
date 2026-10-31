/**
 * Toast Component - Ephemeral notifications
 * Based on lightcode Design System v2
 */
import '../styles/toast.css';

export default function Toast({ id, type = 'info', title, message, onClose }) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="toast-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#34D399" strokeWidth="1.5"/>
            <path d="M7 10l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'error':
        return (
          <svg className="toast-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#F87171" strokeWidth="1.5"/>
            <path d="M7 7l6 6M13 7l-6 6" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg className="toast-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 3L18 17H2L10 3z" stroke="#FCD34D" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M10 9v3M10 14v.5" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="toast-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#93C5FD" strokeWidth="1.5"/>
            <path d="M10 9v5M10 7v.5" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      {getIcon()}
      <div className="toast-content">
        <div className="toast-title">{title}</div>
        {message && <div className="toast-body">{message}</div>}
      </div>
      <svg 
        className="toast-close" 
        width="16" 
        height="16" 
        viewBox="0 0 20 20" 
        fill="none"
        onClick={() => onClose(id)}
      >
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
