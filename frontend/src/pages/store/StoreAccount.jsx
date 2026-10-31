import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import { User, Settings, LogOut, Save, Eye, EyeOff, Mail, Shield, Bell } from 'lucide-react';
import { useBuyer } from '../../context/BuyerContext';
import { buyersAPI } from '../../services/api';
import '../../styles/store/index.css';

export function StoreAccount() {
  const navigate = useNavigate();
  const { buyer, loading: buyerLoading, logout, refreshBuyer } = useBuyer();
  const { store } = useOutletContext();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Configuration state (editable data)
  const [configData, setConfigData] = useState({
    email: '',
    minecraft_username: '',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configMessage, setConfigMessage] = useState({ type: '', text: '' });

  // Password state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  // Statistics state
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    pendingOrders: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!buyerLoading && !buyer) {
      navigate(`/login`);
    }
  }, [buyer, buyerLoading, navigate]);

  useEffect(() => {
    if (buyer) {
      setConfigData({
        email: buyer.user.email || '',
        minecraft_username: buyer.buyer_profile.minecraft_username || '',
      });
      loadStatistics();
    }
  }, [buyer]);

  const loadStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await buyersAPI.getOrders();
      
      const orders = response.data.results || response.data || [];
      
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => {
        // Intentar diferentes campos de monto
        const amount = parseFloat(
          order.amount_after_discount || 
          order.total_amount || 
          order.gross_amount || 
          order.total || 
          0
        );
        return sum + amount;
      }, 0);
      const pendingOrders = orders.filter(order => 
        order.status === 'pending' || order.status === 'processing'
      ).length;

      setStats({ totalOrders, totalSpent, pendingOrders });
    } catch (error) {
      console.error('Error loading statistics:', error);
      console.error('Error details:', error.response?.data);
      // Mantener valores en 0 si hay error
      setStats({ totalOrders: 0, totalSpent: 0, pendingOrders: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate(`/login`);
  };

  const handleConfigUpdate = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    setConfigMessage({ type: '', text: '' });

    try {
      await buyersAPI.updateProfile({
        email: configData.email,
        minecraft_username: configData.minecraft_username,
      });
      
      await refreshBuyer();
      setConfigMessage({ type: 'success', text: 'Configuración actualizada correctamente' });
    } catch (error) {
      setConfigMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al actualizar la configuración' 
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      setPasswordLoading(false);
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordMessage({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres' });
      setPasswordLoading(false);
      return;
    }

    try {
      await buyersAPI.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      
      setPasswordMessage({ type: 'success', text: 'Contraseña cambiada correctamente' });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      setPasswordMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al cambiar la contraseña' 
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!store || buyerLoading) {
    return null;
  }

  return (
    <div className="store-page">
      <div className="store-container">
        <div className="store-account">
          <div className="store-account__header">
            <h1>Mi Cuenta</h1>
            <p className="store-account__subtitle">
              Gestiona tu información personal y preferencias
            </p>
          </div>

          <div className="store-account__content">
            <aside className="store-account__sidebar">
              <button 
                className={`store-account__tab ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <User size={20} />
                <span>Perfil</span>
              </button>
              <button 
                className={`store-account__tab ${activeTab === 'configuration' ? 'active' : ''}`}
                onClick={() => setActiveTab('configuration')}
              >
                <Settings size={20} />
                <span>Configuración</span>
              </button>
              <Link to="/orders" className="store-account__tab">
                <Mail size={20} />
                <span>Ver mis pedidos</span>
              </Link>
              <button className="store-account__logout" onClick={handleLogout}>
                <LogOut size={20} />
                <span>Cerrar sesión</span>
              </button>
            </aside>

            <main className="store-account__main">
              {/* PERFIL - Solo lectura con estadísticas */}
              {activeTab === 'profile' && buyer && (
                <div className="store-account__section">
                  <h2>Mi Perfil</h2>
                  <p className="store-account__description">
                    Información general y estadísticas de tu cuenta
                  </p>

                  {/* User Info Card */}
                  <div className="store-account__info-card">
                    <div className="store-account__info-header">
                      <div className="store-account__avatar">
                        {buyer.user.first_name?.charAt(0) || buyer.user.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="store-account__info-details">
                        <h3>{buyer.user.first_name && buyer.user.last_name 
                          ? `${buyer.user.first_name} ${buyer.user.last_name}` 
                          : buyer.user.email}
                        </h3>
                        <p>{buyer.user.email}</p>
                        {buyer.buyer_profile.minecraft_username && (
                          <p className="store-account__minecraft">
                            <User size={14} />
                            {buyer.buyer_profile.minecraft_username}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="store-account__info-meta">
                      <div className="store-account__meta-item">
                        <span className="label">Miembro desde</span>
                        <span className="value">
                          {new Date(buyer.buyer_profile.created_at).toLocaleDateString('es-ES', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="store-account__divider" />
                  <h3>Estadísticas</h3>
                  <p className="store-account__description">
                    Resumen de tu actividad en la tienda
                  </p>

                  {statsLoading ? (
                    <div className="store-account__loading">
                      <div className="spinner"></div>
                      <p>Cargando estadísticas...</p>
                    </div>
                  ) : stats.totalOrders === 0 ? (
                    <div className="store-account__empty-stats">
                      <p>Aún no has realizado ningún pedido en esta tienda.</p>
                      <Link to="/shop" className="store-account__btn store-account__btn--primary">
                        Ir a la tienda
                      </Link>
                    </div>
                  ) : (
                    <div className="store-account__stats-grid">
                      <div className="store-account__stat-card">
                        <div className="store-account__stat-icon">
                          <Mail size={24} />
                        </div>
                        <div className="store-account__stat-content">
                          <span className="store-account__stat-value">{stats.totalOrders}</span>
                          <span className="store-account__stat-label">Pedidos totales</span>
                        </div>
                      </div>

                      <div className="store-account__stat-card">
                        <div className="store-account__stat-icon">
                          <Shield size={24} />
                        </div>
                        <div className="store-account__stat-content">
                          <span className="store-account__stat-value">${stats.totalSpent.toFixed(2)}</span>
                          <span className="store-account__stat-label">Total gastado</span>
                        </div>
                      </div>

                      <div className="store-account__stat-card">
                        <div className="store-account__stat-icon">
                          <Bell size={24} />
                        </div>
                        <div className="store-account__stat-content">
                          <span className="store-account__stat-value">{stats.pendingOrders}</span>
                          <span className="store-account__stat-label">Pedidos pendientes</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CONFIGURACIÓN - Edición de datos */}
              {activeTab === 'configuration' && buyer && (
                <div className="store-account__section">
                  <h2>Configuración</h2>
                  <p className="store-account__description">
                    Actualiza tu información personal y contraseña
                  </p>

                  {/* Personal Information Form */}
                  <form onSubmit={handleConfigUpdate} className="store-account__form">
                    <h3>Información personal</h3>
                    <div className="store-account__form-grid">
                      <div className="store-account__field">
                        <label>
                          <Mail size={16} />
                          <span>Email</span>
                        </label>
                        <input 
                          type="email" 
                          value={configData.email}
                          onChange={(e) => setConfigData({ ...configData, email: e.target.value })}
                          required
                        />
                      </div>

                      <div className="store-account__field">
                        <label>
                          <User size={16} />
                          <span>Usuario de Minecraft</span>
                        </label>
                        <input 
                          type="text" 
                          value={configData.minecraft_username}
                          onChange={(e) => setConfigData({ ...configData, minecraft_username: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {configMessage.text && (
                      <div className={`store-account__message store-account__message--${configMessage.type}`}>
                        {configMessage.text}
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="store-account__btn store-account__btn--primary"
                      disabled={configLoading}
                    >
                      <Save size={18} />
                      <span>{configLoading ? 'Guardando...' : 'Guardar cambios'}</span>
                    </button>
                  </form>

                  {/* Password Change */}
                  <div className="store-account__divider" />
                  
                  <h3>Cambiar contraseña</h3>
                  <p className="store-account__description">
                    Asegúrate de usar una contraseña segura de al menos 8 caracteres
                  </p>

                  <form onSubmit={handlePasswordChange} className="store-account__form">
                    <div className="store-account__field">
                      <label>
                        <Shield size={16} />
                        <span>Contraseña actual</span>
                      </label>
                      <div className="store-account__password-input">
                        <input 
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="store-account__password-toggle"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        >
                          {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="store-account__field">
                      <label>
                        <Shield size={16} />
                        <span>Nueva contraseña</span>
                      </label>
                      <div className="store-account__password-input">
                        <input 
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          className="store-account__password-toggle"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        >
                          {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="store-account__field">
                      <label>
                        <Shield size={16} />
                        <span>Confirmar nueva contraseña</span>
                      </label>
                      <div className="store-account__password-input">
                        <input 
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          className="store-account__password-toggle"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        >
                          {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {passwordMessage.text && (
                      <div className={`store-account__message store-account__message--${passwordMessage.type}`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="store-account__btn store-account__btn--secondary"
                      disabled={passwordLoading}
                    >
                      <Shield size={18} />
                      <span>{passwordLoading ? 'Cambiando...' : 'Cambiar contraseña'}</span>
                    </button>
                  </form>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

