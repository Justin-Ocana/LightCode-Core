import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PayPalLogo from '../../assets/paypal-svgrepo-com.svg';
import '../../styles/settings.css';
import '../../styles/settings-mobile.css';
import '../../styles/orders-v2.css';

export default function Settings() {
  const { updateUser } = useAuth();
  const { activeStore } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  
  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Integrations states
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [hasPayPal, setHasPayPal] = useState(false);
  const [hasRCON, setHasRCON] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (activeStore?.id && activeTab === 'integrations') {
      loadIntegrationsStatus();
    }
  }, [activeStore, activeTab]);

  const loadIntegrationsStatus = async () => {
    if (!activeStore?.id) return;
    
    try {
      setIntegrationsLoading(true);
      
      const paypalResponse = await api.get(`/stores/${activeStore.id}/paypal/`);
      setHasPayPal(!!paypalResponse.data.paypal_email);
      
      const rconResponse = await api.get(`/stores/${activeStore.id}/rcon/`);
      setHasRCON(rconResponse.data.rcon_enabled || false);
    } catch (error) {
      console.error('Error loading integrations status:', error);
    } finally {
      setIntegrationsLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/profile/');
      const userData = response.data;
      
      setUsername(userData.username || '');
      setEmail(userData.email || '');
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Error al cargar los datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const response = await api.patch('/users/profile/', {
        username,
        email,
      });

      if (updateUser) {
        updateUser(response.data);
      }

      toast.success('Perfil actualizado');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      setSaving(true);
      await api.post('/users/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success('Contraseña actualizada');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };



  const handleConfigurePayPal = () => {
    if (!activeStore) {
      toast.error('Espera un momento... primero');
      return;
    }
    navigate(`/dashboard/${activeStore.slug}/paypal`);
  };

  const handleConfigureRCON = () => {
    if (!activeStore) {
      toast.error('Espera un momento... primero');
      return;
    }
    navigate(`/dashboard/${activeStore.slug}/rcon`);
  };

  if (loading) {
    return <LoadingScreen message="Cargando configuración..." />;
  }

  return (
    <div className="settings-modern">
      {/* Header */}
      <div className="orders-header">
        <div className="orders-header-content">
          <div className="orders-header-left">
            <h1>Configuración</h1>
            <p className="orders-subtitle">
              Gestiona tu cuenta y preferencias
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="settings-nav">
        <button
          className={`nav-pill ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Perfil
        </button>
        
        <button
          className={`nav-pill ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Seguridad
        </button>
      </div>

      {/* Content Area */}
      <div className="settings-body">
        {/* PERFIL */}
        {activeTab === 'profile' && (
          <div className="settings-panel">
            <div className="panel-header">
              <h2>Tu Perfil</h2>
              <p>Información personal de tu cuenta</p>
            </div>

            <div className="profile-card">
              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-row">
                  <div className="form-field">
                    <label>Nombre de usuario</label>
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Tu nombre de usuario"
                    />
                  </div>

                  <div className="form-field">
                    <label>Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SEGURIDAD */}
        {activeTab === 'security' && (
          <div className="settings-panel">
            <div className="panel-header">
              <h2>Seguridad</h2>
              <p>Protege tu cuenta con una contraseña segura</p>
            </div>

            <div className="security-card">
              <form onSubmit={handlePasswordChange} className="security-form">
                <div className="form-field">
                  <label>Contraseña actual</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-divider"></div>

                <div className="form-field">
                  <label>Nueva contraseña</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <small>Mínimo 8 caracteres</small>
                </div>

                <div className="form-field">
                  <label>Confirmar nueva contraseña</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-actions">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Actualizando...' : 'Actualizar contraseña'}
                  </Button>
                </div>
              </form>

              <div className="security-tips">
                <h4>Consejos de seguridad</h4>
                <ul>
                  <li>Usa una combinación de letras, números y símbolos</li>
                  <li>No compartas tu contraseña con nadie</li>
                  <li>Cambia tu contraseña regularmente</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* PLAN */}
        {activeTab === 'plan' && (
          <div className="settings-panel">
            <div className="panel-header">
              <h2>Tu Plan</h2>
              <p>Administra tu suscripción y maximiza tus ganancias</p>
            </div>

            <div className="plans-comparison">
              {/* Plan Actual - Starter */}
              <div className="plan-card-modern current">
                <div className="plan-badge-current">Plan Actual</div>
                <div className="plan-header">
                  <div className="plan-icon-modern">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <h3>Starter</h3>
                  <p className="plan-subtitle">Perfecto para empezar</p>
                </div>

                <div className="plan-pricing">
                  <div className="price-main">
                    <span className="price-amount">$0</span>
                    <span className="price-period">/mes</span>
                  </div>
                  <div className="price-commission">
                    Recibes ~87-90% por venta
                  </div>
                  <div className="price-detail">
                    lightcode cobra 4.3% + tarifas de pago
                  </div>
                </div>

                <div className="plan-features-compact">
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Productos ilimitados</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Entrega automática RCON</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>1 tienda</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>8 categorías</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Editor visual completo</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Temas básicos</span>
                  </div>
                </div>

                <div className="plan-status-info">
                  <div className="status-row">
                    <span>Estado</span>
                    <span className="status-active">Activo</span>
                  </div>
                  <div className="status-row">
                    <span>Renovación</span>
                    <span>—</span>
                  </div>
                </div>
              </div>

              {/* Plan Pro */}
              <div className="plan-card-modern recommended">
                <div className="plan-badge-recommended">Recomendado</div>
                <div className="plan-header">
                  <div className="plan-icon-modern pro">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <h3>Pro</h3>
                  <p className="plan-subtitle">Escala tu tienda</p>
                </div>

                <div className="plan-pricing">
                  <div className="price-main">
                    <span className="price-amount">$19</span>
                    <span className="price-period">/mes</span>
                  </div>
                  <div className="price-commission highlight">
                    Recibes más (~89-92%)
                  </div>
                  <div className="price-detail">
                    lightcode cobra 2.7% + tarifas de pago
                  </div>
                  <div className="price-breakeven">
                    Se paga solo desde ~$475/mes en ventas
                  </div>
                </div>

                <div className="plan-features-compact">
                  <p className="features-header">Todo lo del Starter, más:</p>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>3 tiendas</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Categorías ilimitadas</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Dominio personalizado</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Códigos de descuento</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Analytics avanzados</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Temas Premium</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Sin marca de lightcode</span>
                  </div>
                  <div className="feature-item-compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Soporte prioritario 24/7</span>
                  </div>
                </div>

                <Button variant="primary" className="upgrade-button-modern">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Upgrade a Pro
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* INTEGRACIONES */}
        {activeTab === 'integrations' && (
          <div className="settings-panel">
            <div className="panel-header">
              <h2>Integraciones</h2>
              <p>Conecta servicios externos para potenciar tu tienda</p>
            </div>

            {!activeStore ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Espera un momento...</h3>
                <p>Necesitas seleccionar una tienda para configurar integraciones</p>
              </div>
            ) : integrationsLoading ? (
              <div className="loading-state">
                <div className="spinner-large"></div>
                <p>Cargando integraciones...</p>
              </div>
            ) : (
              <div className="integrations-grid-modern">
                {/* PayPal */}
                <div className={`integration-modern ${hasPayPal ? 'active' : 'inactive'}`}>
                  <div className="integration-header-modern">
                    <div className="integration-logo-modern">
                      <img src={PayPalLogo} alt="PayPal" />
                    </div>
                    <div className="integration-status-text">
                      {hasPayPal ? (
                        <span className="status-text connected">Conectado</span>
                      ) : (
                        <span className="status-text disconnected">No conectado</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="integration-body-modern">
                    <h3>PayPal</h3>
                    <p>Recibe pagos de forma segura</p>
                    
                    <div className="integration-features-modern">
                      <span className="feature-tag">Pagos instantáneos</span>
                      <span className="feature-tag">Protección al vendedor</span>
                      <span className="feature-tag">Retiros rápidos</span>
                    </div>

                    {!hasPayPal && (
                      <div className="integration-alert">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Sin PayPal no podrás recibir pagos
                      </div>
                    )}
                  </div>

                  <div className="integration-footer-modern">
                    <Button variant="primary" onClick={handleConfigurePayPal}>
                      {hasPayPal ? 'Editar' : 'Conectar'}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </Button>
                  </div>
                </div>

                {/* RCON */}
                <div className={`integration-modern ${hasRCON ? 'active' : 'inactive'}`}>
                  <div className="integration-header-modern">
                    <div className="integration-logo-modern rcon">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <path d="M8 21h8"/>
                        <path d="M12 17v4"/>
                        <path d="M7 7h.01"/>
                        <path d="M11 7h6"/>
                      </svg>
                    </div>
                    <div className="integration-status-text">
                      {hasRCON ? (
                        <span className="status-text connected">Activo</span>
                      ) : (
                        <span className="status-text disconnected">No configurado</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="integration-body-modern">
                    <h3>RCON</h3>
                    <p>Entrega automática en tu servidor</p>
                    
                    <div className="integration-features-modern">
                      <span className="feature-tag">Entrega instantánea</span>
                      <span className="feature-tag">Comandos automáticos</span>
                      <span className="feature-tag">Sin intervención</span>
                    </div>

                    {!hasRCON && (
                      <div className="integration-alert">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Deberás entregar manualmente
                      </div>
                    )}
                  </div>

                  <div className="integration-footer-modern">
                    <Button variant="primary" onClick={handleConfigureRCON}>
                      {hasRCON ? 'Editar' : 'Conectar'}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </Button>
                  </div>
                </div>

                {/* Stripe - Coming Soon */}
                <div className="integration-modern coming-soon">
                  <div className="integration-header-modern">
                    <div className="integration-logo-modern stripe">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                    </div>
                    <div className="integration-badge-soon">Pronto</div>
                  </div>
                  
                  <div className="integration-body-modern">
                    <h3>Stripe</h3>
                    <p>Pagos con tarjeta de crédito</p>
                    
                    <div className="integration-features-modern">
                      <span className="feature-tag">Tarjetas</span>
                      <span className="feature-tag">Internacional</span>
                      <span className="feature-tag">Comisiones bajas</span>
                    </div>
                  </div>

                  <div className="integration-footer-modern">
                    <Button variant="secondary" disabled>
                      Disponible pronto
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
