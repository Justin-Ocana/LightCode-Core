import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSlowLoading } from '../hooks/useSlowLoading';
import Input from '../components/Input';
import LoadingScreen from '../components/LoadingScreen';
import Alert from '../components/Alert';
import toast from 'react-hot-toast';
import '../styles/auth.css';

export default function Auth() {
    const navigate = useNavigate();
    const { loginSeller } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [alertMessage, setAlertMessage] = useState(null);
    const isSlowLoading = useSlowLoading(loading);
    
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});
        setAlertMessage(null);

        try {
            const result = await loginSeller({
                email: formData.email,
                password: formData.password
            });
            
            if (result.success) {
                navigate('/dashboard');
            } else {
                // Marcar el campo con error
                if (result.field) {
                    setErrors({ [result.field]: true });
                }
                // Mostrar alerta con el error
                setAlertMessage({
                    type: 'error',
                    message: result.error || 'Credenciales incorrectas'
                });
                toast.error(result.error || 'Credenciales incorrectas');
            }
        } catch (error) {
            console.error('Auth error:', error);
            setAlertMessage({
                type: 'error',
                message: 'Error inesperado. Por favor intenta de nuevo.'
            });
            toast.error('Error inesperado. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // Mostrar loading screen durante autenticación
    if (loading) {
        return (
            <LoadingScreen 
                message="Iniciando sesión" 
                isSlowLoading={isSlowLoading}
            />
        );
    }

    return (
        <div className="auth-page">
            {/* Píxeles de cristal flotantes - estilo Minecraft glass */}
            <div className="crystal-pixel" style={{ top: '10%', left: '5%', animationDelay: '0s' }}></div>
            <div className="crystal-pixel" style={{ top: '15%', right: '8%', animationDelay: '1s' }}></div>
            <div className="crystal-pixel" style={{ top: '25%', left: '15%', animationDelay: '2s' }}></div>
            <div className="crystal-pixel" style={{ top: '35%', right: '12%', animationDelay: '3s' }}></div>
            <div className="crystal-pixel" style={{ top: '45%', left: '10%', animationDelay: '4s' }}></div>
            <div className="crystal-pixel" style={{ top: '55%', right: '15%', animationDelay: '5s' }}></div>
            <div className="crystal-pixel" style={{ top: '65%', left: '8%', animationDelay: '1.5s' }}></div>
            <div className="crystal-pixel" style={{ top: '75%', right: '10%', animationDelay: '2.5s' }}></div>
            
            {/* Píxeles más pequeños */}
            <div className="crystal-pixel-small" style={{ top: '12%', left: '30%', animationDelay: '0s' }}></div>
            <div className="crystal-pixel-small" style={{ top: '28%', right: '28%', animationDelay: '2s' }}></div>
            <div className="crystal-pixel-small" style={{ top: '48%', left: '35%', animationDelay: '4s' }}></div>
            <div className="crystal-pixel-small" style={{ top: '68%', right: '32%', animationDelay: '3s' }}></div>
            
            <div className="auth-card">
                <div className="auth-logo">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                    </svg>
                </div>

                <div className="auth-header">
                    <h1 className="auth-title">Panel de Administración</h1>
                    <p className="auth-subtitle">Gestiona tu tienda desde aquí</p>
                </div>

                {alertMessage && (
                    <div style={{ marginBottom: '20px' }}>
                        <Alert 
                            type={alertMessage.type}
                            message={alertMessage.message}
                            onClose={() => setAlertMessage(null)}
                        />
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email</label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@example.com"
                            value={formData.email}
                            onChange={(e) => {
                                setFormData({ ...formData, email: e.target.value });
                                setErrors({ ...errors, email: false });
                                setAlertMessage(null);
                            }}
                            hasError={errors.email}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Contraseña</label>
                        <div className="input-with-icon">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => {
                                    setFormData({ ...formData, password: e.target.value });
                                    setErrors({ ...errors, password: false });
                                    setAlertMessage(null);
                                }}
                                hasError={errors.password}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary btn-full" 
                        disabled={loading || !formData.email || !formData.password}
                    >
                        {loading ? (
                            <>
                                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                                </svg>
                                Iniciando sesión...
                            </>
                        ) : 'Iniciar Sesión'}
                    </button>
                </form>

                <div className="auth-footer" style={{ 
                    marginTop: '24px', 
                    textAlign: 'center', 
                    fontSize: '13px', 
                    color: 'rgba(255,255,255,0.5)' 
                }}>
                    <p>Panel interno de administración</p>
                    <p style={{ marginTop: '8px' }}>
                        <a href="/" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}>
                            ← Volver a la tienda
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
