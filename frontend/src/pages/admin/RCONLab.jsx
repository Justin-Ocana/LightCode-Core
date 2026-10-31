import { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Zap, 
  Play, 
  Trash2, 
  Activity,
  CheckCircle2,
  Server,
  Package,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import '../../styles/rcon-lab.css';

/**
 * lightcode ADMIN - RCON Lab
 * Herramienta de testing y debug para RCON
 * Solo accesible para admins de lightcode
 */
export function RCONLab() {
  // Connection config
  const [config, setConfig] = useState({
    host: '',
    port: 25575,
    password: ''
  });
  
  // Debug mode
  const [debugMode, setDebugMode] = useState(false);
  
  // Show password
  const [showPassword, setShowPassword] = useState(false);
  
  // Connection state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(null);
  
  // Console state
  const [command, setCommand] = useState('');
  const [simulateMode, setSimulateMode] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Test states
  const [stressTestRunning, setStressTestRunning] = useState(false);
  const [stressTestResult, setStressTestResult] = useState(null);
  
  // Product delivery test
  const [testUsername, setTestUsername] = useState('TestPlayer');
  const [testCommands, setTestCommands] = useState('give {username} diamond 10');
  
  const logsEndRef = useRef(null);
  
  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  const addLog = (type, message, data = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, message, timestamp, ...data }]);
  };
  
  const handleConnect = async () => {
    if (!config.host || !config.port || !config.password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    
    // Validar que el host no contenga puerto
    if (config.host.includes(':')) {
      toast.error('El host no debe incluir el puerto. Separa la IP y el puerto en campos diferentes.');
      addLog('error', '✗ Error: El host contiene ":" - separa IP y puerto');
      return;
    }
    
    // Validar que el puerto sea un número válido
    const portNum = parseInt(config.port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error('El puerto debe ser un número entre 1 y 65535');
      return;
    }
    
    setConnecting(true);
    addLog('info', `Conectando a ${config.host}:${config.port}...`);
    
    try {
      const response = await adminAPI.rcon.testConnection({
        ...config,
        debug: debugMode
      });
      
      if (response.data.status === 'connected') {
        setConnected(true);
        setConnectionInfo(response.data);
        addLog('success', `✓ Conectado exitosamente (${response.data.latency}ms)`, {
          latency: response.data.latency
        });
        toast.success('Conexión establecida');
      } else {
        addLog('error', `✗ Error: ${response.data.message}`, {
          error: response.data.error
        });
        toast.error(response.data.message);
      }
    } catch (error) {
      addLog('error', `✗ Error de conexión: ${error.message}`);
      toast.error('Error al conectar');
    } finally {
      setConnecting(false);
    }
  };
  
  const handleExecuteCommand = async (e) => {
    e?.preventDefault();
    
    if (!command.trim()) {
      toast.error('Ingresa un comando');
      return;
    }
    
    setExecuting(true);
    addLog('command', `> ${command}`, { simulated: simulateMode });
    
    try {
      const response = await adminAPI.rcon.executeCommand({
        command: command.trim(),
        simulate: simulateMode
      });
      
      if (response.data.success) {
        addLog('success', response.data.response, {
          latency: response.data.latency,
          simulated: simulateMode
        });
      } else {
        addLog('error', `Error: ${response.data.error}`);
      }
    } catch (error) {
      addLog('error', `Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setExecuting(false);
      setCommand('');
    }
  };
  
  const handleStressTest = async () => {
    setStressTestRunning(true);
    addLog('info', 'Iniciando stress test (10 iteraciones)...');
    
    try {
      const response = await adminAPI.rcon.stressTest({ iterations: 10 });
      setStressTestResult(response.data);
      
      addLog('success', `Stress test completado: ${response.data.success_rate}% éxito`, {
        ...response.data
      });
      
      if (response.data.success_rate >= 90) {
        toast.success('Servidor estable ✓');
      } else {
        toast.warning('Servidor inestable');
      }
    } catch (error) {
      addLog('error', `Error en stress test: ${error.message}`);
      toast.error('Error en stress test');
    } finally {
      setStressTestRunning(false);
    }
  };
  
  const handleTestDelivery = async () => {
    if (!testUsername.trim()) {
      toast.error('Ingresa un username');
      return;
    }
    
    const commands = testCommands.split('\n').filter(c => c.trim());
    
    if (commands.length === 0) {
      toast.error('Ingresa al menos un comando');
      return;
    }
    
    addLog('info', `Probando entrega para ${testUsername}...`);
    
    try {
      const response = await adminAPI.rcon.testDelivery({
        username: testUsername,
        commands,
        validate_online: true  // Siempre validar
      });
      
      if (response.data.validation_failed) {
        if (response.data.error === 'PLAYER_OFFLINE') {
          addLog('error', `✗ Jugador ${testUsername} no está online`);
          if (response.data.players_online && response.data.players_online.length > 0) {
            addLog('info', `Jugadores online: ${response.data.players_online.join(', ')}`);
          } else {
            addLog('info', 'No hay jugadores online');
          }
          toast.error(`${testUsername} no está conectado`);
        } else {
          addLog('error', `✗ Error de validación: ${response.data.message}`);
          toast.error('Error al validar jugador');
        }
        return;
      }
      
      if (response.data.success) {
        addLog('success', `✓ Entrega exitosa para ${testUsername}`, {
          commands_executed: response.data.commands_executed
        });
        addLog('info', '✓ Jugador validado como online');
        toast.success('Entrega simulada exitosa');
      } else {
        addLog('error', `✗ Falló la entrega: ${response.data.message}`);
        toast.error('Error en la entrega');
      }
    } catch (error) {
      addLog('error', `Error: ${error.response?.data?.error || error.message}`);
      toast.error('Error al probar entrega');
    }
  };
  
  const clearLogs = () => {
    setLogs([]);
    toast.success('Logs limpiados');
  };
  
  return (
    <div className="rcon-lab">
      <div className="rcon-lab__header">
        <div className="rcon-lab__title">
          <Terminal size={32} />
          <div>
            <h1>RCON Lab</h1>
            <p>Herramienta de testing y debug para RCON</p>
          </div>
        </div>
        
        {connected && connectionInfo && (
          <div className="rcon-lab__status rcon-lab__status--connected">
            <CheckCircle2 size={16} />
            <span>Conectado ({connectionInfo.latency}ms)</span>
          </div>
        )}
      </div>

      <div className="rcon-lab__grid">
        {/* PANEL 1: CONFIGURACIÓN */}
        <div className="rcon-lab__panel">
          <div className="rcon-lab__panel-header">
            <Server size={20} />
            <h2>Configuración</h2>
          </div>
          
          <div className="rcon-lab__form">
            <div className="rcon-lab__field">
              <label>Host / IP</label>
              <input
                type="text"
                placeholder="191.96.231.34 o play.miservidor.com"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value.trim() })}
                disabled={connected}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                Solo la IP o dominio, sin puerto (ej: 191.96.231.34)
              </small>
            </div>
            
            <div className="rcon-lab__field">
              <label>Puerto RCON</label>
              <input
                type="number"
                placeholder="25575"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                disabled={connected}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                Puerto RCON (25575 por defecto), NO el puerto del juego
              </small>
            </div>
            
            <div className="rcon-lab__field">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  disabled={connected}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={connected}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: connected ? 'not-allowed' : 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    opacity: connected ? 0.5 : 1,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => !connected && (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                Contraseña configurada en server.properties
              </small>
            </div>
            
            <div className="rcon-lab__field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="debug-mode"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
                disabled={connected}
                style={{ width: 'auto', margin: 0 }}
              />
              <label htmlFor="debug-mode" style={{ margin: 0, cursor: 'pointer' }}>
                Modo Debug (muestra logs detallados en consola del servidor)
              </label>
            </div>
            
            <button
              className="rcon-lab__btn rcon-lab__btn--primary"
              onClick={handleConnect}
              disabled={connecting || connected}
            >
              {connecting ? 'Conectando...' : connected ? 'Conectado ✓' : 'Conectar'}
            </button>
          </div>
        </div>

        {/* PANEL 2: CONSOLA */}
        <div className="rcon-lab__panel rcon-lab__panel--console">
          <div className="rcon-lab__panel-header">
            <Terminal size={20} />
            <h2>Consola RCON</h2>
            <div className="rcon-lab__toggle">
              <input
                type="checkbox"
                id="simulate-mode"
                checked={simulateMode}
                onChange={(e) => setSimulateMode(e.target.checked)}
              />
              <label htmlFor="simulate-mode">Modo Simulación</label>
            </div>
          </div>
          
          <div className="rcon-lab__console">
            <div className="rcon-lab__logs">
              {logs.map((log, index) => (
                <div key={index} className={`rcon-lab__log rcon-lab__log--${log.type}`}>
                  <span className="rcon-lab__log-time">[{log.timestamp}]</span>
                  <span className="rcon-lab__log-message">{log.message}</span>
                  {log.latency && (
                    <span className="rcon-lab__log-latency">({log.latency}ms)</span>
                  )}
                  {log.simulated && (
                    <span className="rcon-lab__log-badge">SIMULADO</span>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
            
            <form className="rcon-lab__input" onSubmit={handleExecuteCommand}>
              <span className="rcon-lab__prompt">&gt;</span>
              <input
                type="text"
                placeholder="Ingresa un comando RCON..."
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={!connected || executing}
              />
              <button
                type="submit"
                disabled={!connected || executing || !command.trim()}
              >
                <Play size={16} />
              </button>
            </form>
            
            <div className="rcon-lab__console-actions">
              <button
                className="rcon-lab__btn rcon-lab__btn--small"
                onClick={clearLogs}
              >
                <Trash2 size={14} />
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* PANEL 3: STRESS TEST */}
        <div className="rcon-lab__panel">
          <div className="rcon-lab__panel-header">
            <Activity size={20} />
            <h2>Stress Test</h2>
          </div>
          
          <div className="rcon-lab__stress">
            <p>Ejecuta 10 conexiones consecutivas para medir estabilidad</p>
            
            <button
              className="rcon-lab__btn rcon-lab__btn--secondary"
              onClick={handleStressTest}
              disabled={!connected || stressTestRunning}
            >
              <Zap size={16} />
              {stressTestRunning ? 'Ejecutando...' : 'Iniciar Stress Test'}
            </button>
            
            {stressTestResult && (
              <div className="rcon-lab__stress-result">
                <div className="rcon-lab__stat">
                  <span>Tasa de éxito</span>
                  <strong className={stressTestResult.success_rate >= 90 ? 'success' : 'warning'}>
                    {stressTestResult.success_rate}%
                  </strong>
                </div>
                <div className="rcon-lab__stat">
                  <span>Latencia promedio</span>
                  <strong>{stressTestResult.avg_latency}ms</strong>
                </div>
                <div className="rcon-lab__stat">
                  <span>Recomendación</span>
                  <strong className={stressTestResult.recommendation === 'stable' ? 'success' : 'warning'}>
                    {stressTestResult.recommendation === 'stable' ? 'Estable ✓' : 'Inestable ⚠'}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 4: TEST DE ENTREGA */}
        <div className="rcon-lab__panel">
          <div className="rcon-lab__panel-header">
            <Package size={20} />
            <h2>Test de Entrega</h2>
          </div>
          
          <div className="rcon-lab__delivery">
            <p>Simula la entrega de un producto a un jugador</p>
            
            <div className="rcon-lab__field">
              <label>Username</label>
              <input
                type="text"
                placeholder="TestPlayer"
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
              />
            </div>
            
            <div className="rcon-lab__field">
              <label>Comandos (uno por línea, usa {'{username}'})</label>
              <textarea
                rows="4"
                placeholder="give {username} diamond 10&#10;say Entrega completada para {username}"
                value={testCommands}
                onChange={(e) => setTestCommands(e.target.value)}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                ⚠️ Solo se entregará si el jugador está online
              </small>
            </div>
            
            <button
              className="rcon-lab__btn rcon-lab__btn--secondary"
              onClick={handleTestDelivery}
              disabled={!connected}
            >
              <Play size={16} />
              Probar Entrega
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
