/**
 * EntregasConfig - Configuración de entregas automáticas
 * Estilo idéntico a RCONConfig para consistencia visual
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Server, Zap, Copy, Eye, EyeOff, RefreshCw, CheckCircle2, AlertCircle, 
  ArrowRight, ArrowLeft, Download, Smartphone, Globe, Upload, Settings, Key, Link as LinkIcon
} from 'lucide-react';
import javaLogo from '../../assets/java_edition.png';
import bedrockLogo from '../../assets/bedrock_edition.png';
import '../../styles/rcon-config.css';

// Configuración del comando del plugin (parametrizable)
const PLUGIN_COMMAND = import.meta.env.VITE_PLUGIN_COMMAND || 'shop';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

const STEPS_BEDROCK = [
  { icon: Download, label: 'Descarga' },
  { icon: Smartphone, label: 'Instala' },
  { icon: Globe, label: 'Configura mundo' },
  { icon: Upload, label: 'Sube al servidor' },
  { icon: Settings, label: 'Permisos' },
  { icon: Key, label: 'API Key' },
  { icon: LinkIcon, label: 'Conecta' },
  { icon: Zap, label: 'Prueba' },
];

export default function EntregasConfig() {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const [tab, setTab] = useState(''); // '' | 'java' | 'bedrock'
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [modStatus, setModStatus] = useState(null);
  const [loadingKey, setLoadingKey] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testMessage, setTestMessage] = useState('¡Plataforma conectada correctamente!');
  const [testingDelivery, setTestingDelivery] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!activeStore) return;
    // Cargar estado del mod y la API key actual
    const fetchStatus = () => {
      Promise.all([
        api.get(`/mc/status/${activeStore.id}/`).catch(() => null),
        api.get(`/mc/key/${activeStore.id}/`).catch(() => null),
      ]).then(([statusRes, keyRes]) => {
        if (statusRes) setModStatus(statusRes.data);
        if (keyRes?.data?.api_key) {
          setApiKey(keyRes.data.api_key);
          setConfigured(true);
        }
      });
    };

    fetchStatus();

    // Polling cada 5s para actualizar estado del mod en tiempo real
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [activeStore?.id]);

  const handleGenerateKey = async () => {
    // Si ya hay una key, pedir confirmación
    if (apiKey && apiKey !== '***') {
      const confirmed = window.confirm(
        '⚠️ ¿Estás seguro? Esto invalidará la API Key actual.\n\nTendrás que ejecutar !' + PLUGIN_COMMAND + ' setkey <nueva-key> en tu servidor.'
      );
      if (!confirmed) return;
    }
    setLoadingKey(true);
    try {
      const r = await api.post(`/mc/generate-key/${activeStore.id}/`);
      setApiKey(r.data.api_key);
      setShowKey(true);
      toast.success('Nueva API Key generada. Actualiza tu servidor.');
    } catch {
      toast.error('Error al generar la key');
    } finally {
      setLoadingKey(false);
    }
  };

  const handleTestDelivery = async () => {
    setTestingDelivery(true);
    setTestResult(null);
    try {
      const r = await api.post(`/mc/test-delivery/${activeStore.id}/`, { message: testMessage });
      setTestResult({ success: true, message: r.data.message });
      toast.success('Comando enviado. Revisa tu servidor en 10s.');
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Error al enviar' });
      toast.error('Error al enviar el comando');
    } finally {
      setTestingDelivery(false);
    }
  };

  const handleMarkConfigured = async () => {
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      await api.patch(`/stores/${activeStore.id}/`, { server_type: 'bedrock' });
      setConfigured(true);
      toast.success('¡Configuración completada!');
      setTimeout(() => navigate(`/dashboard/${activeStore.slug}`), 1500);
    } catch {
      toast.error('Error al guardar');
      setSavingConfig(false);
    }
  };

  if (!activeStore) return null;

  // Selector inicial
  if (!tab) {
    return (
      <div className="rcon-config">
        <div className="rcon-container">
          {/* Banner con gradiente */}
          <div style={{
            position: 'relative',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-12) var(--space-8)',
            marginBottom: 'var(--space-8)',
            overflow: 'hidden',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)'
          }}>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'var(--text-5xl)',
              fontWeight: 700,
              marginBottom: 'var(--space-3)',
              background: 'linear-gradient(135deg, var(--accent), var(--primary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
              margin: '0 0 var(--space-3) 0'
            }}>
              Entregas Automáticas
            </h1>
            <p style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.6
            }}>
              Configura cómo se entregarán los productos automáticamente cuando alguien compre en tu tienda
            </p>
          </div>

          {/* Selector de plataforma */}
          <div className="rcon-step rcon-step-intro">
            <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
              Selecciona tu plataforma
            </h2>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '1.5rem', 
              maxWidth: '700px', 
              margin: '0 auto',
              alignItems: 'stretch'
            }}>
              <button
                onClick={() => setTab('java')} 
                className="rcon-btn rcon-btn-secondary" 
                style={{ 
                  flexDirection: 'column', 
                  padding: '2.5rem 2rem', 
                  height: 'auto', 
                  gap: '1.25rem',
                  transition: 'all 0.3s ease',
                  border: '2px solid var(--border)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img src={javaLogo} alt="Java" style={{ width: '90px', height: '90px', objectFit: 'contain' }} />
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Java / Crossplay</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Usa RCON</div>
              </button>
              <button 
                onClick={() => setTab('bedrock')} 
                className="rcon-btn rcon-btn-secondary" 
                style={{ 
                  flexDirection: 'column', 
                  padding: '2.5rem 2rem', 
                  height: 'auto', 
                  gap: '1.25rem',
                  transition: 'all 0.3s ease',
                  border: '2px solid var(--border)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img src={bedrockLogo} alt="Bedrock" style={{ width: '90px', height: '90px', objectFit: 'contain' }} />
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Bedrock (BDS / Aternos)</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Usa PlugsEssentials</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Java → redirige a RCON
  if (tab === 'java') {
    return (
      <div className="rcon-config">
        <div className="rcon-container">
          <div className="rcon-step rcon-step-intro">
            <button onClick={() => setTab('')} className="rcon-btn rcon-btn-secondary" style={{ position: 'absolute', top: '2rem', left: '2rem' }}>
              <ArrowLeft size={20} /> Volver
            </button>
            <div className="rcon-icon-hero">
              <Server size={64} />
            </div>
            <h1>Java / Crossplay — RCON</h1>
            <p className="rcon-description">
              Para entregas automáticas en servidores Java o Crossplay necesitas configurar RCON.
            </p>
            <button className="rcon-btn rcon-btn-primary" onClick={() => navigate(`/dashboard/${activeStore.slug}/rcon`)}>
              Configurar RCON <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bedrock → wizard completo
  const renderProgressBar = () => {
    const progress = (currentStep / STEPS_BEDROCK.length) * 100;
    return (
      <div className="rcon-progress">
        <div className="rcon-progress-bar">
          <div className="rcon-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="rcon-progress-steps">
          {STEPS_BEDROCK.map((step, i) => {
            const StepIcon = step.icon;
            const stepNum = i + 1;
            return (
              <div
                key={i}
                className={`rcon-progress-step ${currentStep >= stepNum ? 'active' : ''} ${currentStep === stepNum ? 'current' : ''}`}
                title={step.label}
              >
                {currentStep > stepNum ? <CheckCircle2 size={16} /> : <StepIcon size={16} />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      default: return null;
    }
  };

  const renderStep1 = () => (
    <div className="rcon-step rcon-step-intro">
      <div className="rcon-icon-hero">
        <Download size={64} />
      </div>
      <h1>Descarga PlugsEssentials</h1>
      <p className="rcon-description">
        Descarga el mod desde la página oficial. Obtendrás dos archivos: el BP (Behavior Pack) y el RP (Resource Pack).
      </p>
      <a href="/plugsessentials" target="_blank" rel="noreferrer" className="rcon-btn rcon-btn-primary" style={{ textDecoration: 'none', margin: '2rem auto' }}>
        <Download size={20} /> Descargar PlugsEssentials
      </a>
      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setTab('')}>
          <ArrowLeft size={20} /> Volver
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(2)}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="rcon-step rcon-step-setup">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-accent)'
        }}>
          <Upload size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Instala el plugin en Minecraft</h2>
      </div>
      <p>Abre los archivos BP y RP con Minecraft para instalarlos automáticamente.</p>

      <div className="rcon-hosting-instructions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h3 style={{ margin: 0 }}>En PC</h3>
        </div>
        <ol>
          <li>Haz click derecho sobre el archivo BP → "Abrir con" → Minecraft Bedrock</li>
          <li>Repite con el archivo RP</li>
          <li>Minecraft se abrirá y los packs quedarán instalados automáticamente</li>
        </ol>
      </div>

      <div className="rcon-hosting-instructions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Smartphone size={24} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0 }}>En Celular</h3>
        </div>
        <ol>
          <li>Descarga un gestor de archivos (ej: Files by Google)</li>
          <li>Selecciona el archivo BP, toca los 3 puntitos → "Abrir con" → Minecraft Bedrock</li>
          <li>Repite con el archivo RP</li>
        </ol>
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(1)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(3)}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="rcon-step rcon-step-setup">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-accent)'
        }}>
          <Globe size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Configura tu mundo de Minecraft</h2>
      </div>
      <p>Agrega el plugin al mundo de tu servidor y activa los experimentos necesarios.</p>

      <div className="rcon-hosting-instructions">
        <h3>Pasos:</h3>
        <ol>
          <li><strong>Obtén el mundo de tu servidor:</strong> Descarga el mundo desde el panel de tu servidor y ábrelo en Minecraft. Si ya lo tienes, mejor.</li>
          <li><strong>Activa Beta APIs:</strong> Edita el mundo → Experimentos → activa "API Beta". Esto es obligatorio.</li>
          <li><strong>Agrega los packs:</strong> En la misma pantalla, ve a "Behavior Packs" y agrega el BP de PlugsEssentials. Luego ve a "Resource Packs" y agrega el RP.</li>
        </ol>
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(2)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(4)}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="rcon-step rcon-step-setup">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-accent)'
        }}>
          <Server size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Exporta el mundo y súbelo al servidor</h2>
      </div>
      <p>Una vez configurado el mundo, necesitas exportarlo y subirlo a tu servidor.</p>

      <div className="rcon-warning">
        <AlertCircle size={20} />
        <div>
          <strong>Importante:</strong>
          <ul>
            <li>El plugin con entregas automáticas solo funciona en servidores (BDS/Aternos)</li>
            <li>NO funciona en mundos locales ni Realms</li>
            <li>Para uso local existe una versión separada sin entregas automáticas</li>
          </ul>
        </div>
      </div>

      <div className="rcon-hosting-instructions">
        <h3>Pasos:</h3>
        <ol>
          <li><strong>Exporta el mundo:</strong> Edita el mundo → General → baja hasta el fondo → "Exportar Mundo". Desactiva "Borrar datos del jugador" si no quieres perderlos. Elige una carpeta y exporta.</li>
          <li><strong>Cambia la extensión (solo servidores de paga):</strong> Renombra el archivo de .mcworld a .zip. En Aternos puedes subir el .mcworld directamente.</li>
          <li><strong>Sube el mundo al servidor:</strong> En tu servidor ve a worlds/Bedrock Level/ y descomprime el .zip ahí. En Aternos usa el gestor de mundos.</li>
        </ol>
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(3)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(5)}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="rcon-step rcon-step-setup">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-accent)'
        }}>
          <Settings size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Habilita los módulos del servidor</h2>
      </div>
      <p>En tu servidor, configura los permisos para que el plugin pueda usar HTTP.</p>

      <div style={{
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex', alignItems: 'flex-start', gap: '10px'
      }}>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>✅</span>
        <div>
          <p style={{ fontWeight: 700, color: '#10B981', margin: '0 0 4px' }}>Si usas Aternos, omite este paso</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            En Aternos el <code>permissions.json</code> ya viene preconfigurado con todos los módulos necesarios. 
            Solo necesitas tener el BP de PlugsEssentials con Delivery activo en tu mundo y listo.
          </p>
        </div>
      </div>

      <div className="rcon-file-location">
        <div className="rcon-file-location-header">
          <Settings size={20} />
          <span>Ubicación del archivo — solo para BDS propio</span>
        </div>
        <div className="rcon-file-path">
          <code>config/default/permissions.json</code>
        </div>
        <small>Crea este archivo si no existe en tu servidor BDS</small>
      </div>

      <div className="rcon-code-block">
        <div className="rcon-code-header">
          <span>permissions.json</span>
          <button className="rcon-copy-btn" onClick={() => {
            navigator.clipboard.writeText(JSON.stringify({
              allowed_modules: ["@minecraft/server-gametest","@minecraft/server","@minecraft/server-ui","@minecraft/server-admin","@minecraft/server-editor","@minecraft/debug-utilities","@minecraft/server-net"]
            }, null, 2));
            toast.success('Copiado');
          }}>
            <Copy size={16} /> Copiar
          </button>
        </div>
        <pre><code>{JSON.stringify({
          allowed_modules: [
            "@minecraft/server-gametest",
            "@minecraft/server",
            "@minecraft/server-ui",
            "@minecraft/server-admin",
            "@minecraft/server-editor",
            "@minecraft/debug-utilities",
            "@minecraft/server-net"
          ]
        }, null, 2)}</code></pre>
      </div>

      <div className="rcon-tips">
        <AlertCircle size={20} />
        <div>
          <strong>Solo para servidores BDS propios:</strong>
          <ul>
            <li>Guarda el archivo y reinicia el servidor</li>
            <li>Sin esto el plugin no podrá conectarse a la plataforma</li>
            <li>En Aternos esto no es necesario, ya viene listo</li>
          </ul>
        </div>
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(4)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(6)}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="rcon-step rcon-step-form">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-accent)'
        }}>
          <Key size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Genera tu API Key</h2>
      </div>
      <p style={{ textAlign: 'center' }}>La API Key conecta tu servidor con la plataforma. Genera una aquí y cópiala — la necesitarás en el siguiente paso.</p>

      <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
        {apiKey ? (
          <div className="rcon-field">
            <label><Key size={16} /> Tu API Key</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                readOnly
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              <button className="rcon-btn rcon-btn-secondary" onClick={() => setShowKey(v => !v)} style={{ padding: '0.5rem' }} title={showKey ? 'Ocultar' : 'Mostrar'}>
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button className="rcon-btn rcon-btn-secondary" onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('Copiado'); }} style={{ padding: '0.5rem' }} title="Copiar">
                <Copy size={18} />
              </button>
            </div>
            <small style={{ marginTop: '0.5rem', display: 'block', color: 'var(--text-tertiary)' }}>
              Esta key no cambia a menos que la regeneres manualmente.
            </small>
            <button
              className="rcon-btn rcon-btn-secondary"
              onClick={handleGenerateKey}
              disabled={loadingKey}
              style={{ marginTop: '1rem', fontSize: '0.85rem' }}
            >
              {loadingKey ? <><RefreshCw size={16} className="rcon-spinner" /> Regenerando...</> : <><RefreshCw size={16} /> Regenerar API Key</>}
            </button>
          </div>
        ) : (
          <button className="rcon-btn rcon-btn-primary" onClick={handleGenerateKey} disabled={loadingKey} style={{ width: '100%', justifyContent: 'center' }}>
            {loadingKey ? <><RefreshCw size={18} className="rcon-spinner" /> Generando...</> : <><Zap size={18} /> Generar API Key</>}
          </button>
        )}
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(5)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(7)} disabled={!apiKey}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="rcon-step rcon-step-setup">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, var(--accent), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-accent)'
        }}>
          <LinkIcon size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Conecta tu servidor</h2>
      </div>
      <p>Inicia tu servidor, entra al mundo y ejecuta estos comandos en el chat.</p>

      <div className="rcon-tips">
        <AlertCircle size={20} />
        <div>
          <strong>Requisitos:</strong>
          <ul>
            <li>Necesitas ser OP en el servidor</li>
            <li>Necesitas tener el tag "admin": <code>/tag @s add admin</code></li>
          </ul>
        </div>
      </div>

      <div className="rcon-code-block">
        <div className="rcon-code-header">
          <span>Comandos a ejecutar</span>
          <button className="rcon-copy-btn" onClick={() => {
            navigator.clipboard.writeText(`!${PLUGIN_COMMAND} setkey ${apiKey || '<tu-api-key>'}\n!${PLUGIN_COMMAND} seturl ${BACKEND_URL}\n!${PLUGIN_COMMAND} status`);
            toast.success('Copiado');
          }}>
            <Copy size={16} /> Copiar todo
          </button>
        </div>
        <pre><code>{`!${PLUGIN_COMMAND} setkey ${apiKey || '<tu-api-key>'}\n!${PLUGIN_COMMAND} seturl ${BACKEND_URL}\n!${PLUGIN_COMMAND} status`}</code></pre>
      </div>

      <div className="rcon-explanation">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <h3 style={{ margin: 0 }}>Nota:</h3>
        </div>
        <ul>
          <li>El prefijo por defecto de PlugsEssentials es <code>!</code></li>
          <li>Si lo cambiaste, usa tu prefijo personalizado</li>
          <li>Al ejecutar <code>!{PLUGIN_COMMAND} status</code> deberías ver tu API Key y URL confirmadas</li>
        </ul>
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(6)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={() => setCurrentStep(8)}>
          Siguiente <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="rcon-step rcon-step-form">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
        <div style={{ 
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
          background: 'linear-gradient(135deg, #10B981, var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
        }}>
          <CheckCircle2 size={24} style={{ color: 'white' }} />
        </div>
        <h2 style={{ margin: 0 }}>Prueba la conexión</h2>
      </div>
      <p style={{ textAlign: 'center' }}>Envía un mensaje de prueba al servidor para verificar que todo funciona correctamente.</p>

      {/* Estado del mod */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        background: modStatus?.connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${modStatus?.connected ? '#10B981' : '#EF4444'}`,
        borderRadius: 'var(--radius-md)', padding: '1rem 1.5rem', marginBottom: '2rem',
      }}>
        <div style={{
          width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
          background: modStatus?.connected ? '#10B981' : '#EF4444',
          boxShadow: modStatus?.connected ? '0 0 8px #10B981' : 'none',
        }} />
        <span style={{ fontWeight: 600, color: modStatus?.connected ? '#10B981' : '#EF4444', flex: 1 }}>
          {modStatus?.connected
            ? `Mod conectado — último poll hace ${modStatus.last_poll_ago}s`
            : 'Mod desconectado — asegúrate de que el servidor esté encendido'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          ↻ en vivo
        </span>
      </div>

      <div className="rcon-form" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="rcon-field">
          <label><Zap size={16} /> Mensaje de prueba</label>
          <input
            type="text"
            value={testMessage}
            onChange={e => setTestMessage(e.target.value)}
            placeholder="¡Plataforma conectada correctamente!"
          />
          <small>Se ejecutará <code>say {testMessage || '...'}</code> en tu servidor. Deberías verlo en el chat en ~10 segundos.</small>
        </div>

        <button
          className="rcon-btn rcon-btn-primary"
          onClick={handleTestDelivery}
          disabled={testingDelivery || !modStatus?.connected}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {testingDelivery ? <><RefreshCw size={18} className="rcon-spinner" /> Enviando...</> : <><Zap size={18} /> Enviar al servidor</>}
        </button>

        {testResult && (
          <div style={{
            background: testResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${testResult.success ? '#10B981' : '#EF4444'}`,
            borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            {testResult.success ? <CheckCircle2 size={20} style={{ color: '#10B981' }} /> : <AlertCircle size={20} style={{ color: '#EF4444' }} />}
            <span style={{ fontSize: '0.9rem', color: testResult.success ? '#10B981' : '#EF4444' }}>
              {testResult.message}
            </span>
          </div>
        )}
      </div>

      <div className="rcon-actions">
        <button className="rcon-btn rcon-btn-secondary" onClick={() => setCurrentStep(7)}>
          <ArrowLeft size={20} /> Anterior
        </button>
        <button className="rcon-btn rcon-btn-primary" onClick={handleMarkConfigured}
          disabled={savingConfig}
          style={{ background: '#10B981', borderColor: '#10B981', opacity: savingConfig ? 0.7 : 1 }}>
          {savingConfig
            ? <><RefreshCw size={18} className="rcon-spinner" /> Guardando...</>
            : <><CheckCircle2 size={18} /> ¡Listo! Marcar como configurado</>
          }
        </button>
      </div>
    </div>
  );

  return (
    <div className="rcon-config">
      <div className="rcon-container">
        {renderProgressBar()}
        {renderStep()}
      </div>
    </div>
  );
}
