import { useState } from 'react';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import '../../styles/store/store-brand-loader.css';

/**
 * Página de debug para probar el componente StoreBrandLoader
 * Accesible en /debug/loader
 */
export function LoaderDebug() {
  const [storeName, setStoreName] = useState('Mi Tienda Minecraft');
  const [logoUrl, setLogoUrl] = useState('https://via.placeholder.com/150');
  const [message, setMessage] = useState('Cargando tienda');
  const [overlay, setOverlay] = useState(true);
  const [embedded, setEmbedded] = useState(false);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ marginBottom: '1rem', fontSize: '2rem', fontWeight: 'bold' }}>
          🎨 Debug: StoreBrandLoader
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          Prueba el componente de carga de la página pública con diferentes configuraciones
        </p>

        {/* Controles */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Nombre de la tienda
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              URL del logo
            </label>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Mensaje
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={overlay}
                onChange={(e) => setOverlay(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '500' }}>Overlay (pantalla completa)</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={embedded}
                onChange={(e) => setEmbedded(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '500' }}>Embedded (embebido)</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isSlowLoading}
                onChange={(e) => setIsSlowLoading(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '500' }}>Carga lenta (mostrar hint)</span>
            </label>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setShowLoader(!showLoader)}
            style={{
              padding: '0.75rem 1.5rem',
              background: showLoader ? '#ef4444' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {showLoader ? '❌ Ocultar Loader' : '✅ Mostrar Loader'}
          </button>

          <button
            onClick={() => {
              setStoreName('Mi Tienda Minecraft');
              setLogoUrl('https://via.placeholder.com/150');
              setMessage('Cargando tienda');
              setOverlay(true);
              setEmbedded(false);
              setIsSlowLoading(false);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            🔄 Reset
          </button>

          <a
            href="/"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            🏠 Volver a la tienda
          </a>
        </div>

        {/* Presets rápidos */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
            ⚡ Presets rápidos
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setStoreName('SkyBlock Premium');
                setLogoUrl('https://via.placeholder.com/150/3b82f6/ffffff?text=SB');
                setMessage('Abriendo tienda');
                setOverlay(true);
                setEmbedded(false);
                setIsSlowLoading(false);
                setShowLoader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#eff6ff',
                color: '#3b82f6',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              SkyBlock
            </button>

            <button
              onClick={() => {
                setStoreName('Survival Extremo');
                setLogoUrl('https://via.placeholder.com/150/10b981/ffffff?text=SE');
                setMessage('Conectando con el servidor');
                setOverlay(true);
                setEmbedded(false);
                setIsSlowLoading(false);
                setShowLoader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f0fdf4',
                color: '#10b981',
                border: '1px solid #10b981',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Survival
            </button>

            <button
              onClick={() => {
                setStoreName('PvP Arena');
                setLogoUrl('https://via.placeholder.com/150/ef4444/ffffff?text=PVP');
                setMessage('Preparando arena');
                setOverlay(true);
                setEmbedded(false);
                setIsSlowLoading(false);
                setShowLoader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#fef2f2',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              PvP
            </button>

            <button
              onClick={() => {
                setStoreName('Cargando');
                setLogoUrl('');
                setMessage('Buscando tu tienda');
                setOverlay(true);
                setEmbedded(false);
                setIsSlowLoading(false);
                setShowLoader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f9fafb',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Sin logo
            </button>

            <button
              onClick={() => {
                setStoreName('Tienda Lenta');
                setLogoUrl('https://via.placeholder.com/150/f59e0b/ffffff?text=SLOW');
                setMessage('Esto está tardando más de lo normal');
                setOverlay(true);
                setEmbedded(false);
                setIsSlowLoading(true);
                setShowLoader(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#fffbeb',
                color: '#f59e0b',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Carga lenta
            </button>
          </div>
        </div>

        {/* Info del código */}
        <div style={{
          padding: '1rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          marginBottom: '2rem'
        }}>
          <h4 style={{ marginBottom: '0.5rem', fontWeight: '600' }}>📝 Código actual:</h4>
          <pre style={{
            background: '#1f2937',
            color: '#f3f4f6',
            padding: '1rem',
            borderRadius: '6px',
            overflow: 'auto',
            fontSize: '0.875rem'
          }}>
{`<StoreBrandLoader
  storeName="${storeName}"
  logoUrl="${logoUrl}"
  message="${message}"
  overlay={${overlay}}
  embedded={${embedded}}
  isSlowLoading={${isSlowLoading}}
/>`}
          </pre>
        </div>
      </div>

      {/* Loader en acción */}
      {showLoader && (
        <StoreBrandLoader
          storeName={storeName}
          logoUrl={logoUrl || null}
          message={message}
          overlay={overlay}
          embedded={embedded}
          isSlowLoading={isSlowLoading}
        />
      )}
    </div>
  );
}
