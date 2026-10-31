import { Link } from 'react-router-dom';

export default function Cookies() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-dark)',
            padding: 'var(--space-20) var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                maxWidth: '800px',
                textAlign: 'center'
            }}>
                <h1 style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                    fontWeight: 700,
                    marginBottom: 'var(--space-6)',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    Política de Cookies
                </h1>
                
                <div style={{
                    padding: 'var(--space-16)',
                    background: 'rgba(17, 17, 27, 0.6)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    marginBottom: 'var(--space-8)'
                }}>
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ margin: '0 auto var(--space-6)' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    
                    <h2 style={{
                        fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                        fontWeight: 600,
                        marginBottom: 'var(--space-4)',
                        color: 'var(--text-primary)'
                    }}>
                        Próximamente
                    </h2>
                    
                    <p style={{
                        fontSize: '1.125rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                        marginBottom: 'var(--space-8)'
                    }}>
                        Estamos trabajando en nuestra política de cookies. 
                        Pronto estará disponible aquí.
                    </p>
                    
                    <Link 
                        to="/" 
                        className="btn btn-primary"
                        style={{ textDecoration: 'none' }}
                    >
                        Volver al inicio
                    </Link>
                </div>
                
                <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-tertiary)'
                }}>
                    ¿Tienes preguntas? Contáctanos en nuestro <a href="" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Discord</a>
                </p>
            </div>
        </div>
    );
}
