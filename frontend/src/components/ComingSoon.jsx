import { Rocket } from 'lucide-react';

/**
 * ComingSoon - Componente para páginas en desarrollo
 */
export default function ComingSoon({ title, message }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4F7CFF 0%, #3B82F6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 16px rgba(79, 124, 255, 0.3)'
      }}>
        <Rocket size={40} color="white" />
      </div>
      
      <h2 style={{
        fontSize: '1.75rem',
        fontWeight: '600',
        color: 'var(--text-primary, #E5E7EB)',
        marginBottom: '0.75rem'
      }}>
        {title || 'Próximamente'}
      </h2>
      
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary, #9CA3AF)',
        maxWidth: '500px',
        lineHeight: '1.6'
      }}>
        {message || 'Estamos trabajando en esta funcionalidad. Pronto estará disponible.'}
      </p>
    </div>
  );
}
