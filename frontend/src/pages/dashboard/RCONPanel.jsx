/**
 * RCON Control Panel
 * Panel de control y testing RCON post-configuración
 * Estilo: Stripe + Server Dashboard
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { storesAPI, ordersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import CountdownTimer from '../../components/CountdownTimer';
import { 
  Server, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Edit3,
  Terminal,
  Package,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Trash2,
  Play,
  AlertTriangle
} from 'lucide-react';
import '../../styles/rcon-panel.css';

export default function RCONPanel() {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const logsEndRef = useRef(null);
  
  // RCON Config state
  const [rconConfig, setRconConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState(null); // 'connected', 'error', 'testing'
  const [lastTest, setLastTest] = useState(null);
  const [retesting, setRetesting] = useState(false);
  
  // Command tester
  const [command, setCommand] = useState('');
  const [commandExecuting, setCommandExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  
  // Product tester
  const [testPlayer, setTestPlayer] = useState('');
  const [testCommands, setTestCommands] = useState('give {username} diamond 1');
  const [productTesting, setProductTesting] = useState(false);
  
  // Logs
  const [logs, setLogs] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // RCON Queue
  const [rconJobs, setRconJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsFilter, setJobsFilter] = useState('all'); // all, pending, processing, delivered, failed
  
  useEffect(() => {
    if (activeStore?.id) {
      loadRconConfig();
      loadRconJobs();
      
      // Auto-refresh RCON jobs every 30 seconds
      const refreshInterval = setInterval(() => {
        loadRconJobs();
      }, 30000);
      
      // Auto-process pending RCON jobs every 2 minutes (120 seconds)
      const processInterval = setInterval(async () => {
        try {
          await ordersAPI.processPendingRconJobs();
          // Refresh jobs after processing
          loadRconJobs();
        } catch (error) {
          console.error('Error processing pending RCON jobs:', error);
        }
      }, 120000); // 2 minutos
      
      // 🔔 WebSocket connection for real-time updates
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        // WebSocket connected
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle RCON job updates
          if (data.type === 'rcon_job_update') {
            // Update the job in the list
            setRconJobs(prevJobs => {
              const updatedJobs = prevJobs.map(order => {
                if (order.id === data.data.order_id) {
                  return {
                    ...order,
                    status: data.data.status,
                    rcon_job: data.data.rcon_job
                  };
                }
                return order;
              });
              return updatedJobs;
            });
            
            // Show toast notification
            const job = data.data.rcon_job;
            if (job) {
              if (job.status === 'delivered') {
                toast.success(`Pedido #${data.data.order_number} entregado a ${data.data.minecraft_username}`);
              } else if (job.status === 'failed') {
                toast.error(`❌ Pedido #${data.data.order_number} falló: ${job.failure_reason || 'Error desconocido'}`);
              } else if (job.status === 'processing') {
                toast.loading(`⏳ Procesando pedido #${data.data.order_number}...`, { duration: 2000 });
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        // WebSocket disconnected
      };
      
      return () => {
        clearInterval(refreshInterval);
        clearInterval(processInterval);
        ws.close();
      };
    }
  }, [activeStore]);
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  const loadRconConfig = async () => {
    try {
      const response = await storesAPI.rcon.getConfig(activeStore.id);
      
      if (!response.data.rcon_enabled) {
        // No está configurado, redirigir al wizard
        navigate(`/dashboard/${activeStore.slug}/rcon`);
        return;
      }
      
      setRconConfig(response.data);
      
      // Determinar estado de conexión basado en última prueba
      if (response.data.rcon_last_test) {
        const lastTestDate = new Date(response.data.rcon_last_test);
        const now = new Date();
        const minutesAgo = Math.floor((now - lastTestDate) / 1000 / 60);
        
        if (minutesAgo < 5) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('unknown');
        }
        
        setLastTest({
          date: lastTestDate,
          minutesAgo,
          latency: response.data.rcon_last_latency
        });
      }
      
      addLog('info', 'Panel RCON cargado');
    } catch (error) {
      console.error('Error loading RCON config:', error);
      toast.error('Error al cargar configuración RCON');
    } finally {
      setLoading(false);
    }
  };
  
  const loadRconJobs = async () => {
    try {
      setLoadingJobs(true);
      // Traer TODOS los pedidos con delivery_method=rcon, sin importar el estado
      // Esto incluye: pending, processing, delivered, failed, cancelled
      const response = await storesAPI.orders.list(activeStore.id, {
        delivery_method: 'rcon',
        page_size: 100,  // Aumentado de 50 a 100 para ver más pedidos
        ordering: '-created_at'  // Más recientes primero
      });
      
      // Filtrar solo órdenes con RCON job (debería ser todas, pero por seguridad)
      const ordersWithRcon = response.data.results.filter(order => order.rcon_job);
      setRconJobs(ordersWithRcon);
    } catch (error) {
      console.error('Error loading RCON jobs:', error);
      toast.error('Error al cargar cola RCON');
    } finally {
      setLoadingJobs(false);
    }
  };
  
  const handleRetryJob = async (orderId) => {
    try {
      await ordersAPI.retryRcon(orderId);
      toast.success('Reintento iniciado');
      // Recargar jobs después de 2 segundos
      setTimeout(() => {
        loadRconJobs();
      }, 2000);
    } catch (error) {
      toast.error('Error al solicitar reintento');
    }
  };
  
  const handleRetestConnection = async () => {
    setRetesting(true);
    setConnectionStatus('testing');
    addLog('info', 'Probando conexión...');
    
    try {
      const response = await storesAPI.rcon.testConnection(activeStore.id, {
        host: rconConfig.rcon_host,
        port: rconConfig.rcon_port,
        password: 'stored' // Backend usa la contraseña guardada
      });
      
      if (response.data.status === 'connected') {
        setConnectionStatus('connected');
        setLastTest({
          date: new Date(),
          minutesAgo: 0,
          latency: response.data.latency
        });
        addLog('success', `Conexión exitosa (${response.data.latency}ms)`);
        toast.success('Conexión verificada');
      } else {
        setConnectionStatus('error');
        addLog('error', `Error: ${response.data.message}`);
        toast.error(response.data.message);
      }
    } catch (error) {
      setConnectionStatus('error');
      addLog('error', 'Error al probar conexión');
      toast.error('Error al probar conexión');
    } finally {
      setRetesting(false);
    }
  };
  
  const handleExecuteCommand = async (e) => {
    e?.preventDefault();
    
    if (!command.trim()) {
      toast.error('Ingresa un comando');
      return;
    }
    
    setCommandExecuting(true);
    addLog('command', `> ${command}`);
    
    try {
      const response = await storesAPI.rcon.executeCommand(activeStore.id, {
        command: command.trim()
      });
      
      if (response.data.success) {
        addLog('success', response.data.response || 'Comando ejecutado');
        setCommandHistory(prev => [command, ...prev].slice(0, 10));
        setCommand('');
        toast.success('Comando ejecutado');
      } else {
        addLog('error', `Error: ${response.data.error}`);
        toast.error('Error al ejecutar comando');
      }
    } catch (error) {
      addLog('error', `Error: ${error.response?.data?.error || error.message}`);
      toast.error('Error al ejecutar comando');
    } finally {
      setCommandExecuting(false);
    }
  };
  
  const handleTestProductDelivery = async () => {
    if (!testPlayer.trim()) {
      toast.error('Ingresa un nombre de jugador');
      return;
    }
    
    const commands = testCommands.split('\n').filter(c => c.trim());
    
    if (commands.length === 0) {
      toast.error('Ingresa al menos un comando');
      return;
    }
    
    setProductTesting(true);
    addLog('info', `Probando entrega para ${testPlayer}...`);
    
    try {
      const response = await storesAPI.rcon.testDelivery(activeStore.id, {
        username: testPlayer,
        commands,
        validate_online: true
      });
      
      if (response.data.validation_failed) {
        if (response.data.error === 'PLAYER_OFFLINE') {
          addLog('error', `Jugador ${testPlayer} no está online`);
          if (response.data.players_online && response.data.players_online.length > 0) {
            addLog('info', `Jugadores online: ${response.data.players_online.join(', ')}`);
          }
          toast.error(`${testPlayer} no está conectado`);
        } else {
          addLog('error', `Error: ${response.data.message}`);
          toast.error('Error al validar jugador');
        }
        return;
      }
      
      if (response.data.success) {
        addLog('success', `Entrega exitosa para ${testPlayer}`);
        response.data.results.forEach((result) => {
          addLog('success', `✓ ${result.command}`);
        });
        toast.success('Producto entregado correctamente');
      } else {
        addLog('error', `Error en la entrega: ${response.data.message || response.data.error}`);
        toast.error('Error en la entrega');
      }
    } catch (error) {
      addLog('error', `Error: ${error.response?.data?.error || error.message}`);
      toast.error('Error al probar entrega');
    } finally {
      setProductTesting(false);
    }
  };
  
  const handleDeleteConfig = async () => {
    if (!confirm('¿Estás seguro de eliminar la configuración RCON? Tendrás que configurarla nuevamente.')) {
      return;
    }
    
    try {
      await storesAPI.rcon.deleteConfig(activeStore.id);
      toast.success('Configuración eliminada');
      navigate(`/dashboard/${activeStore.slug}/rcon`);
    } catch (error) {
      toast.error('Error al eliminar configuración');
    }
  };
  
  const addLog = (type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, message, timestamp }]);
  };
  
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'var(--primary)';
      case 'error': return '#F87171';
      case 'testing': return 'var(--accent)';
      default: return 'var(--text-tertiary)';
    }
  };
  
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle2 size={24} />;
      case 'error': return <AlertCircle size={24} />;
      case 'testing': return <RefreshCw size={24} className="rcon-spinner" />;
      default: return <Activity size={24} />;
    }
  };
  
  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected':
        return `Conectado a ${rconConfig?.rcon_host}:${rconConfig?.rcon_port}`;
      case 'error':
        return 'No se pudo conectar al servidor';
      case 'testing':
        return 'Probando conexión...';
      default:
        return 'Estado desconocido - prueba la conexión';
    }
  };
  
  const getErrorTypeBadge = (failureReasonType) => {
    const badges = {
      'network_error': { label: 'Error de Red', color: '#F87171', icon: '🌐' },
      'auth_error': { label: 'Error de Auth', color: '#FB923C', icon: '🔐' },
      'command_error': { label: 'Error de Comando', color: '#FBBF24', icon: '⚠️' },
      'player_offline_error': { label: 'Jugador Offline', color: '#60A5FA', icon: '👤' },
      'unknown': { label: 'Error Desconocido', color: '#9CA3AF', icon: '❓' }
    };
    
    const badge = badges[failureReasonType] || badges['unknown'];
    return (
      <span 
        className="rcon-error-type-badge"
        style={{ 
          backgroundColor: `${badge.color}20`,
          color: badge.color,
          border: `1px solid ${badge.color}40`,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>{badge.icon}</span>
        <span>{badge.label}</span>
      </span>
    );
  };
  
  const getErrorTip = (failureReasonType) => {
    const tips = {
      'network_error': 'El servidor está apagado o no es accesible. Verifica que esté online y que el puerto RCON sea correcto.',
      'auth_error': 'La contraseña RCON es incorrecta. Verifica server.properties y reinicia el servidor.',
      'command_error': 'El comando tiene un error de sintaxis. Verifica que el comando sea válido para tu versión de Minecraft.',
      'player_offline_error': 'El jugador no está conectado al servidor. El sistema reintentará automáticamente cada 2-4 horas.',
      'unknown': 'Error desconocido. Revisa los logs para más detalles.'
    };
    
    return tips[failureReasonType] || tips['unknown'];
  };
  
  if (loading) {
    return (
      <div className="rcon-panel">
        <div className="rcon-panel-loading">
          <RefreshCw className="rcon-spinner-large" size={48} />
          <p>Cargando configuración RCON...</p>
        </div>
      </div>
    );
  }
  
  if (!rconConfig) {
    return (
      <div className="rcon-panel">
        <div className="rcon-panel-empty">
          <Server size={64} />
          <h2>RCON no configurado</h2>
          <p>Configura RCON para habilitar entregas automáticas</p>
          <button 
            className="btn btn-md btn-primary"
            onClick={() => navigate(`/dashboard/${activeStore.slug}/rcon`)}
          >
            Configurar RCON
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="rcon-panel">
      {/* Header */}
      <div className="rcon-panel-header">
        <div>
          <h1>Panel de Control RCON</h1>
          <p>Gestiona y prueba la conexión RCON de tu servidor</p>
        </div>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => navigate(`/dashboard/${activeStore.slug}`)}
        >
          Volver al dashboard
        </button>
      </div>
      
      {/* Status Card */}
      <div className="rcon-status-card" style={{ borderColor: getStatusColor() }}>
        <div className="rcon-status-icon" style={{ color: getStatusColor() }}>
          {getStatusIcon()}
        </div>
        <div className="rcon-status-content">
          <h3 style={{ color: getStatusColor() }}>
            {connectionStatus === 'connected' ? 'Conectado' : 
             connectionStatus === 'error' ? 'Error de conexión' :
             connectionStatus === 'testing' ? 'Probando...' : 'Estado desconocido'}
          </h3>
          <p>{getStatusMessage()}</p>
          {lastTest && connectionStatus === 'connected' && (
            <div className="rcon-status-meta">
              <span>
                <Clock size={14} />
                Última verificación: hace {lastTest.minutesAgo === 0 ? 'menos de 1' : lastTest.minutesAgo} min
              </span>
              <span>
                <Activity size={14} />
                Latencia: {lastTest.latency}ms
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="rcon-actions-bar">
        <button
          className="btn btn-md btn-primary"
          onClick={handleRetestConnection}
          disabled={retesting}
        >
          <RefreshCw size={16} className={retesting ? 'rcon-spinner' : ''} />
          {retesting ? 'Probando...' : 'Re-probar conexión'}
        </button>
        <button
          className="btn btn-md btn-secondary"
          onClick={() => navigate(`/dashboard/${activeStore.slug}/rcon?edit=true`)}
        >
          <Edit3 size={16} />
          Editar configuración
        </button>
        <button
          className="btn btn-md btn-ghost"
          onClick={handleDeleteConfig}
          style={{ color: '#F87171' }}
        >
          <Trash2 size={16} />
          Desconectar
        </button>
      </div>
      
      {/* RCON Queue Section */}
      <div className="rcon-panel-card rcon-queue-section">
        <div className="rcon-panel-card-header">
          <Activity size={20} />
          <h3>Cola de Entregas RCON</h3>
          <button
            className="btn btn-sm btn-ghost"
            onClick={loadRconJobs}
            disabled={loadingJobs}
          >
            <RefreshCw size={14} className={loadingJobs ? 'rcon-spinner' : ''} />
            Actualizar
          </button>
        </div>
        
        {/* Queue Stats */}
        {rconJobs.length > 0 && (
          <div className="rcon-queue-stats">
            <div className="rcon-queue-stat">
              <span className="rcon-queue-stat-label">Total</span>
              <span className="rcon-queue-stat-value">{rconJobs.length}</span>
            </div>
            <div className="rcon-queue-stat">
              <span className="rcon-queue-stat-label">Entregados</span>
              <span className="rcon-queue-stat-value rcon-stat-success">
                {rconJobs.filter(o => o.rcon_job?.status === 'delivered').length}
              </span>
            </div>
            <div className="rcon-queue-stat">
              <span className="rcon-queue-stat-label">Pendientes</span>
              <span className="rcon-queue-stat-value rcon-stat-pending">
                {rconJobs.filter(o => ['pending', 'processing'].includes(o.rcon_job?.status)).length}
              </span>
            </div>
            <div className="rcon-queue-stat">
              <span className="rcon-queue-stat-label">Fallidos</span>
              <span className="rcon-queue-stat-value rcon-stat-failed">
                {rconJobs.filter(o => o.rcon_job?.status === 'failed').length}
              </span>
            </div>
            <div className="rcon-queue-stat">
              <span className="rcon-queue-stat-label">Tasa de éxito</span>
              <span className="rcon-queue-stat-value">
                {rconJobs.length > 0 
                  ? Math.round((rconJobs.filter(o => o.rcon_job?.status === 'delivered').length / rconJobs.length) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        )}
        
        {/* Filter Buttons */}
        <div className="rcon-queue-filters">
          <button
            className={`rcon-filter-btn ${jobsFilter === 'all' ? 'active' : ''}`}
            onClick={() => setJobsFilter('all')}
          >
            Todos ({rconJobs.length})
          </button>
          <button
            className={`rcon-filter-btn ${jobsFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setJobsFilter('pending')}
          >
            Pendientes ({rconJobs.filter(o => o.rcon_job?.status === 'pending').length})
          </button>
          <button
            className={`rcon-filter-btn ${jobsFilter === 'processing' ? 'active' : ''}`}
            onClick={() => setJobsFilter('processing')}
          >
            Procesando ({rconJobs.filter(o => o.rcon_job?.status === 'processing').length})
          </button>
          <button
            className={`rcon-filter-btn ${jobsFilter === 'delivered' ? 'active' : ''}`}
            onClick={() => setJobsFilter('delivered')}
          >
            Entregados ({rconJobs.filter(o => o.rcon_job?.status === 'delivered').length})
          </button>
          <button
            className={`rcon-filter-btn ${jobsFilter === 'failed' ? 'active' : ''}`}
            onClick={() => setJobsFilter('failed')}
          >
            Fallidos ({rconJobs.filter(o => o.rcon_job?.status === 'failed').length})
          </button>
        </div>
        
        {/* Debug Info */}
        {rconJobs.length > 0 && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            marginBottom: '16px'
          }}>
            📊 Mostrando {rconJobs.filter(order => {
              if (jobsFilter === 'all') return true;
              return order.rcon_job?.status === jobsFilter;
            }).length} de {rconJobs.length} pedidos RCON
          </div>
        )}
        
        {/* Queue Table */}
        {loadingJobs ? (
          <div className="rcon-queue-loading">
            <RefreshCw className="rcon-spinner" size={32} />
            <p>Cargando cola RCON...</p>
          </div>
        ) : rconJobs.length === 0 ? (
          <div className="rcon-queue-empty">
            <Package size={48} />
            <p>No hay entregas RCON pendientes</p>
            <small>Las entregas RCON aparecerán aquí cuando los clientes compren productos con entrega automática</small>
          </div>
        ) : (
          <div className="rcon-queue-table-wrapper">
            <table className="rcon-queue-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Jugador</th>
                  <th>Estado</th>
                  <th>Intentos</th>
                  <th>Último intento</th>
                  <th>Próximo reintento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rconJobs
                  .filter(order => {
                    if (jobsFilter === 'all') return true;
                    return order.rcon_job?.status === jobsFilter;
                  })
                  .map(order => {
                    const job = order.rcon_job;
                    const statusClass = `rcon-status-badge rcon-status-${job.status}`;
                    
                    return (
                      <tr key={order.id}>
                        <td>
                          <div className="rcon-queue-order-info">
                            <span className="rcon-queue-order-number">#{order.order_number}</span>
                            <small>{order.product_snapshot?.name || 'Producto'}</small>
                          </div>
                        </td>
                        <td>
                          <code className="rcon-queue-username">{order.minecraft_username}</code>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className={statusClass}>
                              {job.status === 'pending' && 'Pendiente'}
                              {job.status === 'processing' && 'Procesando'}
                              {job.status === 'delivered' && 'Entregado'}
                              {job.status === 'failed' && 'Fallido'}
                            </span>
                            {job.status === 'failed' && job.failure_reason_type && (
                              getErrorTypeBadge(job.failure_reason_type)
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className="rcon-queue-attempts">
                              {job.attempts} / {job.max_attempts}
                            </span>
                            <small style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                              Auto: {job.auto_retry_count || 0} | Manual: {job.manual_retry_count || 0}
                            </small>
                          </div>
                        </td>
                        <td>
                          {job.last_attempt_at ? (
                            <span className="rcon-queue-time">
                              {new Date(job.last_attempt_at).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          ) : (
                            <span className="rcon-queue-time-empty">-</span>
                          )}
                        </td>
                        <td>
                          {job.status === 'pending' && job.next_retry_at ? (
                            <CountdownTimer 
                              targetDate={job.next_retry_at}
                              onExpire={() => {
                                // Refresh jobs when countdown expires
                                setTimeout(() => loadRconJobs(), 2000);
                              }}
                            />
                          ) : (
                            <span className="rcon-queue-time-empty">-</span>
                          )}
                        </td>
                        <td>
                          <div className="rcon-queue-actions">
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => navigate(`/dashboard/${activeStore.slug}/orders/${order.id}`)}
                              title="Ver detalles"
                            >
                              Ver
                            </button>
                            {job.status === 'failed' && (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleRetryJob(order.id)}
                                title="Reintentar entrega"
                              >
                                <RefreshCw size={14} />
                                Reintentar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Error Messages for Failed Jobs */}
        {rconJobs.filter(o => o.rcon_job?.status === 'failed' && o.rcon_job?.failure_reason).length > 0 && (
          <div className="rcon-queue-errors">
            <h4>Errores recientes</h4>
            {rconJobs
              .filter(o => o.rcon_job?.status === 'failed' && o.rcon_job?.failure_reason)
              .slice(0, 3)
              .map(order => (
                <div key={order.id} className="rcon-queue-error-item">
                  <div className="rcon-queue-error-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="rcon-queue-error-order">#{order.order_number}</span>
                      <span className="rcon-queue-error-player">{order.minecraft_username}</span>
                      {order.rcon_job?.failure_reason_type && getErrorTypeBadge(order.rcon_job.failure_reason_type)}
                    </div>
                  </div>
                  <p className="rcon-queue-error-message">{order.rcon_job.failure_reason}</p>
                  {order.rcon_job?.failure_reason_type && (
                    <div className="rcon-queue-error-tip" style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      borderLeft: '3px solid var(--primary)'
                    }}>
                      <strong>💡 Tip:</strong> {getErrorTip(order.rcon_job.failure_reason_type)}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
      
      {/* Main Grid */}
      <div className="rcon-panel-grid">
        {/* Command Tester */}
        <div className="rcon-panel-card">
          <div className="rcon-panel-card-header">
            <Terminal size={20} />
            <h3>Probar Comando RCON</h3>
          </div>
          
          <form onSubmit={handleExecuteCommand} className="rcon-command-form">
            <div className="rcon-command-input-wrapper">
              <input
                type="text"
                className="rcon-command-input"
                placeholder="say Hola mundo"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={commandExecuting || connectionStatus !== 'connected'}
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={commandExecuting || !command.trim() || connectionStatus !== 'connected'}
              >
                <Play size={16} />
                Ejecutar
              </button>
            </div>
          </form>
          
          {commandHistory.length > 0 && (
            <div className="rcon-command-history">
              <small>Historial reciente:</small>
              <div className="rcon-command-history-list">
                {commandHistory.map((cmd, index) => (
                  <button
                    key={index}
                    className="rcon-command-history-item"
                    onClick={() => setCommand(cmd)}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="rcon-warning-box">
            <AlertTriangle size={16} />
            <span>Ejecutar comandos incorrectos puede afectar tu servidor</span>
          </div>
        </div>
        
        {/* Product Tester */}
        <div className="rcon-panel-card">
          <div className="rcon-panel-card-header">
            <Package size={20} />
            <h3>Simular Entrega de Producto</h3>
          </div>
          
          <div className="rcon-product-form">
            <div className="rcon-field">
              <label>Jugador</label>
              <input
                type="text"
                placeholder="Notch"
                value={testPlayer}
                onChange={(e) => setTestPlayer(e.target.value)}
                disabled={productTesting || connectionStatus !== 'connected'}
              />
              <small>El jugador debe estar online en el servidor</small>
            </div>
            
            <div className="rcon-field">
              <label>Comandos (uno por línea)</label>
              <textarea
                rows="4"
                placeholder="give {username} diamond 1&#10;say Entregado a {username}"
                value={testCommands}
                onChange={(e) => setTestCommands(e.target.value)}
                disabled={productTesting || connectionStatus !== 'connected'}
              />
              <small>Usa {'{username}'} para reemplazar con el nombre del jugador</small>
            </div>
            
            <button
              className="btn btn-md btn-primary"
              onClick={handleTestProductDelivery}
              disabled={productTesting || !testPlayer.trim() || connectionStatus !== 'connected'}
              style={{ width: '100%' }}
            >
              {productTesting ? (
                <>
                  <RefreshCw size={16} className="rcon-spinner" />
                  Probando entrega...
                </>
              ) : (
                <>
                  <Package size={16} />
                  Probar entrega
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Logs */}
      <div className="rcon-panel-card">
        <div className="rcon-panel-card-header">
          <Activity size={20} />
          <h3>Historial Reciente</h3>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setLogs([])}
          >
            <Trash2 size={14} />
            Limpiar
          </button>
        </div>
        
        <div className="rcon-logs">
          {logs.length === 0 ? (
            <div className="rcon-logs-empty">
              <Activity size={32} />
              <p>No hay actividad reciente</p>
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div key={index} className={`rcon-log rcon-log-${log.type}`}>
                  <span className="rcon-log-time">[{log.timestamp}]</span>
                  <span className="rcon-log-message">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
      
      {/* Advanced Info */}
      <div className="rcon-panel-card">
        <button
          className="rcon-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span>Información técnica</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {showAdvanced && (
          <div className="rcon-advanced-info">
            <div className="rcon-info-grid">
              <div className="rcon-info-item">
                <span>Host</span>
                <code>{rconConfig.rcon_host}</code>
              </div>
              <div className="rcon-info-item">
                <span>Puerto</span>
                <code>{rconConfig.rcon_port}</code>
              </div>
              <div className="rcon-info-item">
                <span>Tipo</span>
                <code>Minecraft Java</code>
              </div>
              <div className="rcon-info-item">
                <span>Estado</span>
                <code style={{ color: getStatusColor() }}>
                  {connectionStatus === 'connected' ? 'Activo' : 'Inactivo'}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
