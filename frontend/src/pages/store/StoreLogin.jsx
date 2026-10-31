import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useBuyer } from '../../context/BuyerContext';
import { authAPI } from '../../services/api';
import { devLog } from '../../utils/errorHandler';
import StoreAlert from '../../components/store/StoreAlert';
import toast from 'react-hot-toast';
import '../../styles/store/index.css';

export function StoreLogin() {
  const navigate = useNavigate();
  const { login } = useBuyer();
  const { store } = useOutletContext(); // Get store from StoreLayout context
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const AUTH_TOAST_ID = 'auth-login-error';

  useEffect(() => {
    // Sincronización: cerrar alerta inline si el toast se cierra
    const handleToastClosed = (e) => {
      if (e.detail.id === AUTH_TOAST_ID) {
        setAlert(null);
      }
    };
    window.addEventListener('toast-closed', handleToastClosed);
    return () => window.removeEventListener('toast-closed', handleToastClosed);
  }, []);

  const handleCloseAlert = () => {
    setAlert(null);
    toast.dismiss(AUTH_TOAST_ID);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Validación manual en español
    if (!formData.email || !formData.email.trim()) {
      const message = 'Por favor ingresa tu email';
      toast.error(message, { id: AUTH_TOAST_ID });
      setErrors({ email: true });
      return;
    }
    
    if (!formData.password || !formData.password.trim()) {
      const message = 'Por favor ingresa tu contraseña';
      toast.error(message, { id: AUTH_TOAST_ID });
      setErrors({ password: true });
      return;
    }
    
    setLoading(true);
    setAlert(null);
    toast.dismiss(AUTH_TOAST_ID);
    setErrors({});

    try {
      // Clear any old buyer tokens for this store before attempting login
      localStorage.removeItem(`buyer_token_${store.slug}`);
      localStorage.removeItem(`buyer_refresh_${store.slug}`);
      
      // Obtener CSRF token primero
      try {
        await authAPI.getCsrfToken();
      } catch (csrfError) {
        console.warn('Failed to get CSRF token, continuing anyway:', csrfError);
      }
      
      const response = await authAPI.loginBuyer({
        email: formData.email.trim(),
        password: formData.password,
        store_slug: store.slug
      });
      
      toast.success('¡Bienvenido de nuevo!');
      login(response.data);
      navigate(`/account`);
    } catch (err) {
      devLog('Error logging in:', err);
      
      const errorData = err.response?.data;
      const fieldErrors = {};
      let message = 'Error al iniciar sesión. Verifica tus credenciales.';
      
      if (errorData?.error) {
        message = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
        if (message.toLowerCase().includes('password') || message.toLowerCase().includes('contraseña')) {
          fieldErrors.password = true;
        } else if (message.toLowerCase().includes('email')) {
          fieldErrors.email = true;
        }
      } else if (errorData?.errors) {
        const fields = Object.keys(errorData.errors);
        fields.forEach(f => fieldErrors[f] = true);
        const firstError = Object.values(errorData.errors)[0];
        message = typeof firstError === 'string' ? firstError : (Array.isArray(firstError) ? firstError[0] : JSON.stringify(firstError));
      }
      
      setErrors(fieldErrors);
      toast.error(message, { id: AUTH_TOAST_ID });
    } finally {
      setLoading(false);
    }
  }

  if (!store) {
    return null; // StoreLayout handles loading state
  }

  return (
    <div className="store-page">
        <div className="store-container">
          <div className="store-auth">
            <div className="store-auth__card">
              <h1>Iniciar sesión</h1>
              <p>Accede a tu cuenta de {store.name}</p>

              <form className="store-auth__form" onSubmit={handleSubmit} noValidate>
                <div className="store-auth__field">
                  <label htmlFor="email">Email</label>
                  <input 
                    id="email"
                    name="email"
                    type="email"
                    className={errors.email ? 'input-error' : ''}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({...formData, email: e.target.value});
                      if (errors.email) setErrors({...errors, email: false});
                    }}
                    placeholder="tu@email.com"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="store-auth__field">
                  <label htmlFor="password">Contraseña</label>
                  <div className="store-auth__input-wrap">
                    <input 
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className={errors.password ? 'input-error' : ''}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({...formData, password: e.target.value});
                        if (errors.password) setErrors({...errors, password: false});
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button 
                      type="button" 
                      className="store-auth__visibility-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="store-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={20} />
                      <span>Iniciar sesión</span>
                    </>
                  )}
                </button>
              </form>

              <div className="store-auth__footer">
                <p>
                  ¿No tienes cuenta?{' '}
                  <Link to={`/register`}>Regístrate</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

