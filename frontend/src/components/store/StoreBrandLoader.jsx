import { useState, useEffect } from 'react';
import loaderSvg from '../../assets/loader.svg';

/**
 * Pantalla de carga minimalista: logo SVG con animación arriba/abajo + loader grueso blanco.
 */
export function StoreBrandLoader({
  storeName,
  logoUrl = null,
  message = 'Cargando tienda',
  overlay = true,
  embedded = false,
  isSlowLoading = false,
}) {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowSlowHint(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const rootClass = [
    'store-brand-loader',
    embedded ? 'store-brand-loader--embedded' : '',
    !embedded && overlay ? 'store-brand-loader--overlay' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} role="status" aria-live="polite" aria-busy="true">
      <div className="store-brand-loader__main">
        {/* Logo SVG con animación arriba/abajo */}
        <div className="store-brand-loader__logo" aria-hidden>
          <img 
            src={loaderSvg} 
            alt="" 
            className="store-brand-loader__logo-img"
          />
        </div>

        {/* Loader grueso blanco debajo */}
        <div className="store-brand-loader__progress" aria-hidden>
          <div className="store-brand-loader__progress-bar" />
        </div>

        {/* Mensaje sutil solo si tarda mucho */}
        {(showSlowHint || isSlowLoading) && (
          <div className="store-brand-loader__slow">
            <p className="store-brand-loader__slow-hint">
              Sigue cargando…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
