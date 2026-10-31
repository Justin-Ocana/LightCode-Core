import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { useBuyer } from '../../context/BuyerContext';
import { authAPI } from '../../services/api';
import StoreAlert from '../../components/store/StoreAlert';
import toast from 'react-hot-toast';
import '../../styles/store/index.css';

export function StoreRegister() {
  const navigate = useNavigate();
  const { login } = useBuyer();
  const { store } = useOutletContext(); // Get store from StoreLayout context
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    minecraft_username: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const AUTH_ERROR_TOAST_ID = 'auth-register-error';
  
  // Obtener parámetro de redirección de la URL
  const searchParams = new URLSearchParams(window.location.search);
  const redirectTo = searchParams.get('redirect');

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^a-zA-Z0-9]/.test(password)
    };
    
    if (checks.length) strength++;
    if (checks.uppercase) strength++;
    if (checks.lowercase) strength++;
    if (checks.number) strength++;
    if (checks.special) strength++;
    
    if (strength <= 2) return { strength: 25, label: 'Débil', color: '#EF4444' };
    if (strength === 3) return { strength: 50, label: 'Media', color: '#F59E0B' };
    if (strength === 4) return { strength: 75, label: 'Buena', color: '#10B981' };
    return { strength: 100, label: 'Fuerte', color: '#10B981' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  useEffect(() => {
    // Sincronización: cerrar alerta inline si el toast se cierra
    const handleToastClosed = (e) => {
      if (e.detail.id === AUTH_ERROR_TOAST_ID) {
        setAlert(null);
      }
    };
    window.addEventListener('toast-closed', handleToastClosed);
    return () => window.removeEventListener('toast-closed', handleToastClosed);
  }, []);

  const handleCloseAlert = () => {
    setAlert(null);
    toast.dismiss(AUTH_ERROR_TOAST_ID);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);
    toast.dismiss(AUTH_ERROR_TOAST_ID);
    setErrors({});
    
    if (formData.password !== formData.password_confirm) {
      const message = 'Las contraseñas no coinciden';
      toast.error(message, { id: AUTH_ERROR_TOAST_ID });
      setErrors({ password_confirm: true });
      return;
    }

    if (passwordStrength.strength < 50) {
      const message = 'La contraseña es demasiado débil. Usa mínimo 8 caracteres, letras y números';
      toast.error(message, { id: AUTH_ERROR_TOAST_ID });
      setErrors({ password: true });
      return;
    }

    setLoading(true);

    try {
      // Clear any old buyer tokens for this store before attempting registration
      localStorage.removeItem(`buyer_token_${store.slug}`);
      localStorage.removeItem(`buyer_refresh_${store.slug}`);
      
      // Obtener CSRF token primero
      try {
        await authAPI.getCsrfToken();
      } catch (csrfError) {
        console.warn('Failed to get CSRF token, continuing anyway:', csrfError);
      }
      
      const registrationData = {
        email: formData.email,
        password: formData.password,
        password_confirm: formData.password_confirm,
        minecraft_username: formData.minecraft_username || '',
        store_slug: store.slug
      };

      const response = await authAPI.registerBuyer(registrationData);
      
      toast.success('¡Cuenta creada con éxito!');
      login(response.data);
      
      // Redirigir según el parámetro redirect
      if (redirectTo === 'checkout') {
        navigate(`/checkout`);
      } else {
        navigate(`/account`);
      }
    } catch (err) {
      console.error('Error registering:', err);
      const errorData = err.response?.data;
      const fieldErrors = {};
      let message = 'Error al crear la cuenta. Inténtalo de nuevo.';
      
      if (errorData?.errors) {
        const fields = Object.keys(errorData.errors);
        fields.forEach(f => fieldErrors[f] = true);
        const firstError = Object.values(errorData.errors)[0];
        message = typeof firstError === 'string' ? firstError : (Array.isArray(firstError) ? firstError[0] : JSON.stringify(firstError));
      } else if (errorData?.error) {
        message = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
      }
      
      setErrors(fieldErrors);
      toast.error(message, { id: AUTH_ERROR_TOAST_ID });
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
              <h1>Crear cuenta</h1>
              <p>Regístrate en {store.name}</p>

              <form className="store-auth__form" onSubmit={handleSubmit}>
                <div className="store-auth__field">
                  <label>Email</label>
                  <input 
                    type="email"
                    className={errors.email ? 'input-error' : ''}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    placeholder="tu@email.com"
                  />
                </div>

                <div className="store-auth__field">
                  <label>Usuario de Minecraft (opcional)</label>
                  <input 
                    type="text"
                    className={errors.minecraft_username ? 'input-error' : ''}
                    value={formData.minecraft_username}
                    onChange={(e) => setFormData({...formData, minecraft_username: e.target.value})}
                    placeholder="TuNombre"
                    maxLength={16}
                  />
                  <small style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    Si no lo ingresas, usaremos tu email como nombre
                  </small>
                </div>

                <div className="store-auth__field">
                  <label>Contraseña</label>
                  <div className="store-auth__input-wrap">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className={errors.password ? 'input-error' : ''}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      placeholder="••••••••"
                      minLength={8}
                    />
                    <button 
                      type="button" 
                      className="store-auth__visibility-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="password-strength">
                      <div className="password-strength__bar">
                        <div 
                          className="password-strength__progress" 
                          style={{ 
                            width: `${passwordStrength.strength}%`,
                            backgroundColor: passwordStrength.color 
                          }}
                        />
                      </div>
                      <span className="password-strength__label" style={{ color: passwordStrength.color }}>
                        Contraseña {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="store-auth__field">
                  <label>Confirmar contraseña</label>
                  <div className="store-auth__input-wrap">
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      className={errors.password_confirm ? 'input-error' : ''}
                      value={formData.password_confirm}
                      onChange={(e) => setFormData({...formData, password_confirm: e.target.value})}
                      required
                      placeholder="••••••••"
                    />
                    <button 
                      type="button" 
                      className="store-auth__visibility-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="store-btn" disabled={loading}>
                  {loading ? 'Creando cuenta...' : (
                    <>
                      <UserPlus size={20} />
                      <span>Crear cuenta</span>
                    </>
                  )}
                </button>
              </form>

              <div className="store-auth__footer">
                <p>
                  ¿Ya tienes cuenta?{' '}
                  <Link to={`/login`}>Inicia sesión</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

