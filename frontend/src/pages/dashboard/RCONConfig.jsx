/**
 * RCON Configuration Wizard
 * Página educativa de 7 pasos para configurar RCON
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { storesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Server, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
  HelpCircle,
  Loader
} from 'lucide-react';
import '../../styles/rcon-config.css';

const STEPS = {
  INTRO: 1,
  SERVER_SETUP: 2,
  FORM: 3,
  TEST: 4,
  TROUBLESHOOT: 5,
  SAVE: 6,
  SUCCESS: 7
};

export default function RCONConfig() {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const [searchParams] = useSearchParams();
  const isEditing = searchParams.get('edit') === 'true';
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(STEPS.INTRO);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [hostingType, setHostingType] = useState(''); // 'aternos', 'apex', 'minehut', 'vps', 'local'
  
  // Form state
  const [config, setConfig] = useState({
    host: '',
    port: 25575,
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [hostValidation, setHostValidation] = useState(null); // 'ip', 'domain', 'localhost', 'invalid'
  
  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);
  
  // Save state
  const [saving, setSaving] = useState(false);
  
  // Copy state
  const [copied, setCopied] = useState(false);
  
  // Validate host input
  useEffect(() => {
    if (!config.host) {
      setHostValidation(null);
      return;
    }
    
    const host = config.host.trim();
    
    // Check if it's localhost
    if (host === 'localhost' || host === '127.0.0.1') {
      setHostValidation('localhost');
      return;
    }
    
    // Check if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(host)) {
      setHostValidation('ip');
      return;
    }
    
    // Check if it's a domain
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (domainRegex.test(host)) {
      setHostValidation('domain');
      return;
    }
    
    setHostValidation('invalid');
  }, [config.host]);
  
  // Load existing config
  useEffect(() => {
    if (activeStore?.id) {
      loadConfig();
    }
  }, [activeStore]);
  
  const loadConfig = async () => {
    try {
      const response = await storesAPI.rcon.getConfig(activeStore.id);
      if (response.data.rcon_enabled && !isEditing) {
        // Si ya está configurado y NO estamos editando, redirigir al panel
        navigate(`/dashboard/${activeStore.slug}/rcon/panel`);
        return;
      }
      
      // Si estamos editando, cargar los datos existentes
      if (response.data.rcon_enabled && isEditing) {
        setConfig({
          host: response.data.rcon_host || '',
          port: response.data.rcon_port || 25575,
          password: '' // No mostramos la contraseña guardada
        });
        setServerConfigured(true);
        setCurrentStep(STEPS.FORM); // Ir directo al formulario
      }
    } catch (error) {
      console.error('Error loading RCON config:', error);
    }
  };
  
  const handleTestConnection = async () => {
    // Validaciones
    if (!config.host.trim()) {
      toast.error('Ingresa el host del servidor');
      return;
    }
    
    if (!config.password.trim()) {
      toast.error('Ingresa la contraseña RCON');
      return;
    }
    
    if (config.host.includes(':')) {
      toast.error('El host no debe incluir el puerto');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    
    try {
      const response = await storesAPI.rcon.testConnection(activeStore.id, config);
      
      if (response.data.status === 'connected') {
        setTestResult(response.data);
        setCurrentStep(STEPS.SAVE);
        toast.success('¡Conexión exitosa!');
      } else {
        setTestError(response.data);
        setCurrentStep(STEPS.TROUBLESHOOT);
      }
    } catch (error) {
      const errorData = error.response?.data || {};
      setTestError({
        status: 'error',
        error: errorData.error || 'UNKNOWN_ERROR',
        message: errorData.message || 'Error al conectar'
      });
      setCurrentStep(STEPS.TROUBLESHOOT);
    } finally {
      setTesting(false);
    }
  };
  
  const handleSaveConfig = async () => {
    setSaving(true);
    
    try {
      await storesAPI.rcon.saveConfig(activeStore.id, {
        ...config,
        latency: testResult?.latency || 0
      });
      
      setCurrentStep(STEPS.SUCCESS);
      toast.success('Configuración guardada');
      
      // Redirigir al panel después de 2 segundos
      setTimeout(() => {
        navigate(`/dashboard/${activeStore.slug}/rcon/panel`);
      }, 2000);
    } catch (error) {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const renderProgressBar = () => {
    const progress = (currentStep / 7) * 100;
    
    const stepIcons = [
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ];
    
    return (
      <div className="rcon-progress">
        <div className="rcon-progress-bar">
          <div 
            className="rcon-progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="rcon-progress-steps">
          {[1, 2, 3, 4, 5, 6, 7].map((step) => (
            <div 
              key={step}
              className={`rcon-progress-step ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
              title={['Introducción', 'Configuración', 'Datos', 'Prueba', 'Solución', 'Guardar', 'Éxito'][step - 1]}
            >
              {currentStep > step ? (
                <CheckCircle2 size={16} />
              ) : (
                stepIcons[step - 1]
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderStep = () => {
    switch (currentStep) {
      case STEPS.INTRO:
        return renderIntro();
      case STEPS.SERVER_SETUP:
        return renderServerSetup();
      case STEPS.FORM:
        return renderForm();
      case STEPS.TEST:
        return renderTest();
      case STEPS.TROUBLESHOOT:
        return renderTroubleshoot();
      case STEPS.SAVE:
        return renderSave();
      case STEPS.SUCCESS:
        return renderSuccess();
      default:
        return null;
    }
  };
  
  const renderIntro = () => (
    <div className="rcon-step rcon-step-intro">
      <div className="rcon-icon-hero">
        <Server size={64} />
      </div>
      
      <h1>Conecta tu servidor con RCON</h1>
      
      <p className="rcon-description">
        RCON permite que la plataforma ejecute comandos automáticamente en tu servidor. 
        Por ejemplo: entregar rangos, kits o recompensas sin que estés online.
      </p>
      
      <div className="rcon-flow-diagram">
        <div className="rcon-flow-item">
          <div className="rcon-flow-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M6 20c0-3.5 2.5-6 6-6s6 2.5 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span>Jugador compra</span>
        </div>
        <ArrowRight className="rcon-flow-arrow" />
        <div className="rcon-flow-item">
          <div className="rcon-flow-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span>Plataforma</span>
        </div>
        <ArrowRight className="rcon-flow-arrow" />
        <div className="rcon-flow-item">
          <div className="rcon-flow-icon">
            <Server size={24} />
          </div>
          <span>RCON</span>
        </div>
        <ArrowRight className="rcon-flow-arrow" />
        <div className="rcon-flow-item">
          <div className="rcon-flow-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 12v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span>Entrega automática</span>
        </div>
      </div>
      
      <div className="rcon-warning">
        <AlertCircle size={20} />
        <div>
          <strong>Importante:</strong>
          <ul>
            <li>No es el puerto del servidor (25565)</li>
            <li>Es otro puerto (ej: 25575)</li>
            <li>Debe estar activado en server.properties</li>
          </ul>
        </div>
      </div>
      
      <button 
        className="rcon-btn rcon-btn-primary"
        onClick={() => setCurrentStep(STEPS.SERVER_SETUP)}
      >
        Empezar configuración
        <ArrowRight size={20} />
      </button>
    </div>
  );
  
  const renderServerSetup = () => {
    const hostingInstructions = {
      aternos: {
        title: 'Aternos',
        steps: [
          'Ve a la configuración de tu servidor en Aternos',
          'Busca la sección "Configuración del servidor"',
          'Activa "RCON" con el toggle',
          'Copia la contraseña RCON que te genera automáticamente',
          'El puerto siempre es 25575 en Aternos'
        ],
        note: 'En Aternos, RCON se activa desde el panel web, no desde server.properties'
      },
      apex: {
        title: 'Apex Hosting',
        steps: [
          'Accede al panel de Apex Hosting',
          'Ve a "Files" → "Config Files"',
          'Abre "Server Settings"',
          'Busca las opciones de RCON y actívalas',
          'Guarda y reinicia el servidor'
        ],
        note: 'Apex tiene una interfaz visual para configurar RCON'
      },
      minehut: {
        title: 'Minehut',
        steps: [
          'Minehut no soporta RCON directamente',
          'Necesitarás usar un plugin alternativo como "RemoteConsole"',
          'O considera migrar a otro hosting que soporte RCON nativo'
        ],
        note: 'Minehut tiene limitaciones con RCON'
      },
      bisecthosting: {
        title: 'BisectHosting',
        steps: [
          'Accede al panel de BisectHosting',
          'Ve a "Files" → "Config Files" → "Server Settings"',
          'Busca la sección RCON',
          'Activa "Enable RCON" y establece una contraseña',
          'Guarda y reinicia el servidor'
        ],
        note: 'BisectHosting es popular en Latinoamérica y tiene soporte completo para RCON'
      },
      pebblehost: {
        title: 'PebbleHost',
        steps: [
          'Entra al panel de PebbleHost',
          'Ve a "Configuration" → "Server Properties"',
          'Busca las opciones de RCON',
          'Activa RCON y configura el puerto y contraseña',
          'Guarda y reinicia'
        ],
        note: 'PebbleHost ofrece precios accesibles para Latinoamérica'
      },
      shockbyte: {
        title: 'Shockbyte',
        steps: [
          'Accede al panel de Shockbyte',
          'Ve a "Files" → "Config Files"',
          'Abre "Server Settings"',
          'Activa RCON y configura la contraseña',
          'Guarda y reinicia el servidor'
        ],
        note: 'Shockbyte tiene servidores en Brasil, ideal para Latinoamérica'
      },
      scalacube: {
        title: 'ScalaCube',
        steps: [
          'Entra al panel de ScalaCube',
          'Ve a "Server" → "Settings"',
          'Busca la sección RCON',
          'Activa RCON y establece una contraseña segura',
          'Aplica cambios y reinicia'
        ],
        note: 'ScalaCube tiene buena presencia en Latinoamérica'
      },
      vps: {
        title: 'VPS / Hosting Propio',
        steps: [
          'Conéctate a tu servidor por SSH o FTP',
          'Navega a la carpeta del servidor de Minecraft',
          'Abre el archivo server.properties con un editor de texto',
          'Agrega o modifica estas líneas',
          'Guarda el archivo y reinicia el servidor'
        ],
        note: 'Asegúrate de abrir el puerto RCON en tu firewall'
      },
      local: {
        title: 'Servidor Local (PC)',
        steps: [
          'Abre la carpeta de tu servidor de Minecraft',
          'Busca el archivo server.properties',
          'Ábrelo con Notepad o cualquier editor de texto',
          'Agrega o modifica estas líneas',
          'Guarda y reinicia el servidor'
        ],
        note: 'Para servidor local, usa 127.0.0.1 como host'
      },
      otro: {
        title: 'Otro Hosting',
        steps: [
          'Busca en el panel de tu hosting la sección de configuración del servidor',
          'Busca opciones relacionadas con "RCON", "Remote Console" o "Server Properties"',
          'Si tu hosting tiene interfaz visual, activa RCON desde ahí',
          'Si no, accede a los archivos del servidor y edita server.properties',
          'Agrega las líneas de configuración que se muestran abajo',
          'Guarda los cambios y reinicia el servidor'
        ],
        note: 'La mayoría de hostings modernos tienen soporte para RCON. Si no lo encuentras, contacta a su soporte técnico.',
        showConfig: true
      }
    };
    
    const currentInstructions = hostingType ? hostingInstructions[hostingType] : null;
    
    return (
      <div className="rcon-step rcon-step-setup">
        <h2>Configuración en el servidor</h2>
        <p>Primero, debes activar RCON en tu servidor Minecraft</p>
        
        {/* Selector de hosting */}
        <div className="rcon-hosting-selector">
          <label>¿Dónde está alojado tu servidor?</label>
          <div className="rcon-hosting-grid">
            <button
              className={`rcon-hosting-option ${hostingType === 'aternos' ? 'active' : ''}`}
              onClick={() => setHostingType('aternos')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Aternos
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'bisecthosting' ? 'active' : ''}`}
              onClick={() => setHostingType('bisecthosting')}
            >
              <Server size={20} />
              BisectHosting
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'shockbyte' ? 'active' : ''}`}
              onClick={() => setHostingType('shockbyte')}
            >
              <Zap size={20} />
              Shockbyte
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'apex' ? 'active' : ''}`}
              onClick={() => setHostingType('apex')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Apex
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'pebblehost' ? 'active' : ''}`}
              onClick={() => setHostingType('pebblehost')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
              PebbleHost
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'scalacube' ? 'active' : ''}`}
              onClick={() => setHostingType('scalacube')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="2"/>
                <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              ScalaCube
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'minehut' ? 'active' : ''}`}
              onClick={() => setHostingType('minehut')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Minehut
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'vps' ? 'active' : ''}`}
              onClick={() => setHostingType('vps')}
            >
              <Server size={20} />
              VPS/Hosting
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'local' ? 'active' : ''}`}
              onClick={() => setHostingType('local')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="8" y="21" width="8" height="1" rx=".5" fill="currentColor"/>
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Mi PC
            </button>
            <button
              className={`rcon-hosting-option ${hostingType === 'otro' ? 'active' : ''}`}
              onClick={() => setHostingType('otro')}
            >
              <HelpCircle size={20} />
              Otro
            </button>
          </div>
        </div>
        
        {currentInstructions && (
          <>
            <div className="rcon-hosting-instructions">
              <h3>Instrucciones para {currentInstructions.title}</h3>
              <ol>
                {currentInstructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              {currentInstructions.note && (
                <div className="rcon-hosting-note">
                  <AlertCircle size={16} />
                  <span>{currentInstructions.note}</span>
                </div>
              )}
            </div>
            
            {(hostingType === 'vps' || hostingType === 'local' || hostingType === 'otro') && (
              <>
                <div className="rcon-file-location">
                  <div className="rcon-file-location-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Ubicación del archivo</span>
                  </div>
                  <div className="rcon-file-path">
                    <code>/tu-servidor/server.properties</code>
                  </div>
                  <small>Busca este archivo en la carpeta raíz de tu servidor</small>
                </div>
                
                <div className="rcon-code-block">
                  <div className="rcon-code-header">
                    <span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      server.properties
                    </span>
                    <button 
                      className="rcon-copy-btn"
                      onClick={() => copyToClipboard('enable-rcon=true\nrcon.port=25575\nrcon.password=tu_password_segura')}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <pre>
                    <code>
{`enable-rcon=true
rcon.port=25575
rcon.password=tu_password_segura`}
                    </code>
                  </pre>
                </div>
                
                <div className="rcon-explanation">
                  <h3>Explicación:</h3>
                  <ul>
                    <li><code>enable-rcon</code> → activa RCON</li>
                    <li><code>rcon.port</code> → puerto (NO el del server)</li>
                    <li><code>rcon.password</code> → clave segura</li>
                  </ul>
                </div>
              </>
            )}
          </>
        )}
        
        <div className="rcon-tips">
          <HelpCircle size={20} />
          <div>
            <strong>Tips:</strong>
            <ul>
              <li>Reinicia el servidor después de cambiar esto</li>
              <li>No compartas tu contraseña RCON</li>
              <li>Asegúrate de abrir el puerto en firewall</li>
            </ul>
          </div>
        </div>
        
        <div className="rcon-checkbox">
          <input
            type="checkbox"
            id="server-configured"
            checked={serverConfigured}
            onChange={(e) => setServerConfigured(e.target.checked)}
          />
          <label htmlFor="server-configured">
            Ya configuré esto en mi servidor
          </label>
        </div>
        
        <div className="rcon-actions">
          <button 
            className="rcon-btn rcon-btn-secondary"
            onClick={() => setCurrentStep(STEPS.INTRO)}
          >
            <ArrowLeft size={20} />
            Atrás
          </button>
          <button 
            className="rcon-btn rcon-btn-primary"
            onClick={() => setCurrentStep(STEPS.FORM)}
            disabled={!serverConfigured}
          >
            Continuar
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  };
  
  const renderForm = () => {
    const getHostValidationMessage = () => {
      if (!hostValidation) return null;
      
      const messages = {
        ip: {
          icon: <CheckCircle2 size={16} />,
          text: 'Parece una dirección IP válida',
          color: 'var(--primary)'
        },
        domain: {
          icon: <CheckCircle2 size={16} />,
          text: 'Parece un dominio válido',
          color: 'var(--primary)'
        },
        localhost: {
          icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
          text: 'Servidor local detectado',
          color: 'var(--accent)'
        },
        invalid: {
          icon: <AlertCircle size={16} />,
          text: 'Formato no reconocido - verifica que sea correcto',
          color: '#F87171'
        }
      };
      
      const validation = messages[hostValidation];
      if (!validation) return null;
      
      return (
        <div className="rcon-host-validation" style={{ color: validation.color }}>
          {validation.icon}
          <span>{validation.text}</span>
        </div>
      );
    };
    
    return (
      <div className="rcon-step rcon-step-form">
        <h2>Datos de conexión</h2>
        <p>Ingresa los datos de tu servidor RCON</p>
        
        <div className="rcon-form">
          <div className="rcon-field">
            <label>
              <Server size={16} />
              Host (IP o dominio)
            </label>
            <input
              type="text"
              placeholder="play.servidor.com o 191.96.231.34"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value.trim() })}
            />
            {getHostValidationMessage()}
            <small>
              {hostingType === 'local' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Para servidor local, usa <strong>127.0.0.1</strong> o <strong>localhost</strong>
                </>
              ) : (
                'Solo la IP o dominio, sin puerto (ej: 191.96.231.34)'
              )}
            </small>
          </div>
          
          <div className="rcon-field">
            <label>
              <Zap size={16} />
              Puerto RCON
            </label>
            <input
              type="number"
              placeholder="25575"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 25575 })}
            />
            <small>
              {hostingType === 'aternos' ? (
                'En Aternos siempre es 25575'
              ) : (
                'Puerto RCON (25575 por defecto), NO el puerto del juego'
              )}
            </small>
          </div>
          
          <div className="rcon-field">
            <label>
              <Eye size={16} />
              Contraseña RCON
            </label>
            <div className="rcon-password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
              />
              <button
                type="button"
                className="rcon-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <small>
              {hostingType === 'aternos' ? (
                'Copia la contraseña que Aternos te generó automáticamente'
              ) : (
                'Contraseña configurada en server.properties'
              )}
            </small>
          </div>
        </div>
        
        <div className="rcon-actions">
          <button 
            className="rcon-btn rcon-btn-secondary"
            onClick={() => setCurrentStep(STEPS.SERVER_SETUP)}
          >
            <ArrowLeft size={20} />
            Atrás
          </button>
          <button 
            className="rcon-btn rcon-btn-primary"
            onClick={handleTestConnection}
            disabled={testing || !config.host || !config.password}
          >
            {testing ? (
              <>
                <Loader className="rcon-spinner" size={20} />
                Probando conexión...
              </>
            ) : (
              <>
                Probar conexión
                <Zap size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };
  
  const renderTest = () => (
    <div className="rcon-step rcon-step-test">
      <div className="rcon-loader">
        <Loader className="rcon-spinner-large" size={48} />
        <h2>Probando conexión...</h2>
        <p>Conectando a {config.host}:{config.port}</p>
      </div>
    </div>
  );
  
  const renderTroubleshoot = () => {
    const errorMessages = {
      'ECONNREFUSED': {
        title: 'Servidor apagado o puerto incorrecto',
        solutions: [
          '¿El servidor está encendido?',
          '¿El puerto RCON es correcto?',
          '¿Abriste el puerto en el firewall?'
        ]
      },
      'AUTH_FAILED': {
        title: 'Contraseña incorrecta',
        solutions: [
          'Verifica la contraseña en server.properties',
          'Reinicia el servidor después de cambiarla',
          'Asegúrate de no tener espacios extra'
        ]
      },
      'TIMEOUT': {
        title: 'Tiempo de espera agotado',
        solutions: [
          'Verifica la IP/dominio',
          'Revisa el firewall del servidor',
          'Asegúrate de que el puerto esté abierto'
        ]
      },
      'INVALID_HOST_FORMAT': {
        title: 'Formato de host incorrecto',
        solutions: [
          'No incluyas el puerto en el host',
          'Usa solo la IP o dominio',
          'Ejemplo correcto: play.servidor.com'
        ]
      },
      'POSSIBLE_WRONG_PORT': {
        title: 'Puerto posiblemente incorrecto',
        solutions: [
          'El puerto 25565 es del juego, no de RCON',
          'El puerto RCON suele ser 25575',
          'Verifica rcon.port en server.properties'
        ]
      }
    };
    
    const errorInfo = errorMessages[testError?.error] || {
      title: testError?.message || 'Error desconocido',
      solutions: ['Verifica todos los datos', 'Revisa los logs del servidor']
    };
    
    return (
      <div className="rcon-step rcon-step-troubleshoot">
        <div className="rcon-error-icon">
          <AlertCircle size={48} />
        </div>
        
        <h2>No se pudo conectar</h2>
        <p className="rcon-error-title">{errorInfo.title}</p>
        
        <div className="rcon-solutions">
          <h3>Posibles soluciones:</h3>
          <ul>
            {errorInfo.solutions.map((solution, index) => (
              <li key={index}>{solution}</li>
            ))}
          </ul>
        </div>
        
        <div className="rcon-error-details">
          <details>
            <summary>Detalles técnicos</summary>
            <pre>{JSON.stringify(testError, null, 2)}</pre>
          </details>
        </div>
        
        <div className="rcon-actions">
          <button 
            className="rcon-btn rcon-btn-secondary"
            onClick={() => setCurrentStep(STEPS.FORM)}
          >
            <ArrowLeft size={20} />
            Volver a intentar
          </button>
        </div>
      </div>
    );
  };
  
  const renderSave = () => (
    <div className="rcon-step rcon-step-save">
      <div className="rcon-success-icon">
        <CheckCircle2 size={64} />
      </div>
      
      <h2>¡Conexión exitosa!</h2>
      <p>Latencia: {testResult?.latency}ms</p>
      
      <div className="rcon-save-info">
        <h3>Configuración a guardar:</h3>
        <div className="rcon-config-summary">
          <div className="rcon-config-item">
            <span>Host:</span>
            <strong>{config.host}</strong>
          </div>
          <div className="rcon-config-item">
            <span>Puerto:</span>
            <strong>{config.port}</strong>
          </div>
          <div className="rcon-config-item">
            <span>Estado:</span>
            <strong className="rcon-status-connected">Conectado</strong>
          </div>
        </div>
      </div>
      
      <div className="rcon-security-note">
        <AlertCircle size={16} />
        <small>La contraseña se guardará encriptada de forma segura</small>
      </div>
      
      <div className="rcon-actions">
        <button 
          className="rcon-btn rcon-btn-secondary"
          onClick={() => setCurrentStep(STEPS.FORM)}
        >
          <ArrowLeft size={20} />
          Cambiar datos
        </button>
        <button 
          className="rcon-btn rcon-btn-primary"
          onClick={handleSaveConfig}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader className="rcon-spinner" size={20} />
              Guardando...
            </>
          ) : (
            <>
              Guardar configuración
              <CheckCircle2 size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
  
  const renderSuccess = () => (
    <div className="rcon-step rcon-step-success">
      <div className="rcon-success-animation">
        <CheckCircle2 size={80} />
      </div>
      
      <h1>¡Servidor conectado!</h1>
      <p>La plataforma ya puede entregar productos automáticamente</p>
      
      <div className="rcon-next-steps">
        <h3>Próximos pasos:</h3>
        <ul>
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Configura comandos en tus productos
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Prueba una compra de prueba
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Revisa los logs de entregas
          </li>
        </ul>
      </div>
      
      <div className="rcon-actions">
        <button 
          className="rcon-btn rcon-btn-secondary"
          onClick={() => navigate(`/dashboard/${activeStore.slug}/products`)}
        >
          Ir a productos
        </button>
        <button 
          className="rcon-btn rcon-btn-primary"
          onClick={() => navigate(`/dashboard/${activeStore.slug}/rcon/panel`)}
        >
          Ir al panel RCON
        </button>
      </div>
    </div>
  );
  
  if (!activeStore) {
    return (
      <div className="rcon-config">
        <div className="rcon-container">
          <div className="rcon-error">
            <AlertCircle size={48} />
            <h2>No hay tienda activa</h2>
            <p>Espera un momento... para configurar RCON</p>
            <button 
              className="rcon-btn rcon-btn-primary"
              onClick={() => navigate('/dashboard/stores')}
            >
              Ver mis tiendas
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="rcon-config">
      <div className="rcon-container">
        {renderProgressBar()}
        {renderStep()}
      </div>
    </div>
  );
}
