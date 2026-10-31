import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function OrderTimeline({ timeline }) {
  const getEventIcon = (status, message) => {
    const isError = isErrorEvent(message);
    const isPayment = message.toLowerCase().includes('pago') || message.toLowerCase().includes('paypal');
    const isWarning = message.toLowerCase().includes('advertencia') || message.toLowerCase().includes('reintento');
    
    if (isError || status === 'failed') {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
          <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    }
    
    if (isWarning) {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L2 7v6c0 5 8 9 8 9s8-4 8-9V7l-8-5z" stroke="currentColor" strokeWidth="2"/>
          <path d="M10 8v4M10 15v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    }
    
    if (isPayment) {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
          <path d="M10 7v3l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    }
    
    if (status === 'delivered') {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    
    if (status === 'processing') {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
          <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    }
    
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
        <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  };

  const getEventColor = (status, message) => {
    const isError = isErrorEvent(message);
    const isPayment = message.toLowerCase().includes('pago') || message.toLowerCase().includes('paypal');
    const isWarning = message.toLowerCase().includes('advertencia') || message.toLowerCase().includes('reintento');
    
    if (isError || status === 'failed') return '#F87171';
    if (isWarning) return '#FCD34D';
    if (isPayment) return '#3B82F6';
    if (status === 'delivered') return '#00D4AA';
    if (status === 'processing') return '#93C5FD';
    
    return '#FCD34D';
  };

  const isErrorEvent = (message) => {
    const errorKeywords = ['error', 'fallid', 'fall', 'no se pudo', 'no hay', 'validación fallida'];
    return errorKeywords.some(keyword => message.toLowerCase().includes(keyword));
  };

  return (
    <div className="order-timeline-container">
      <div className="order-timeline-header">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="5" r="2" fill="currentColor"/>
          <circle cx="10" cy="10" r="2" fill="currentColor"/>
          <circle cx="10" cy="15" r="2" fill="currentColor"/>
        </svg>
        <h3>Historial del pedido</h3>
      </div>

      <div className="timeline-list">
        {timeline.map((event, index) => {
          const color = getEventColor(event.status, event.message);
          
          return (
            <div 
              key={index} 
              className="timeline-event"
            >
              <div 
                className="timeline-event-icon"
                style={{ 
                  color: color,
                  borderColor: color,
                  backgroundColor: `${color}15`
                }}
              >
                {getEventIcon(event.status, event.message)}
              </div>
              
              <div className="timeline-event-content">
                <div 
                  className="timeline-event-message"
                  style={{ color: isErrorEvent(event.message) ? '#F87171' : '#E2E8F0' }}
                >
                  {event.message}
                </div>
                <div className="timeline-event-meta">
                  <span className="timeline-event-time">
                    {event.timestamp && !isNaN(new Date(event.timestamp).getTime()) ? (
                      formatDistanceToNow(new Date(event.timestamp), { 
                        addSuffix: true, 
                        locale: es 
                      })
                    ) : (
                      'Fecha no disponible'
                    )}
                  </span>
                  {event.changedBy && event.changedBy !== 'Sistema' && (
                    <>
                      <span className="timeline-event-separator">·</span>
                      <span className="timeline-event-user">por {event.changedBy}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
