import '../../styles/store/store-inline-spinner.css';

/**
 * Spinner compacto para bloques que cargan poco (lista, carrito, etc.).
 * Usa colores del tema (--color-*).
 */
export function StoreInlineSpinner({ label = '' }) {
  return (
    <div className="store-inline-spinner-wrap" role="status" aria-live="polite">
      <span className="store-inline-spinner" aria-hidden>
        <span className="store-inline-spinner__ring" />
      </span>
      {label ? <span className="store-inline-spinner__label">{label}</span> : null}
    </div>
  );
}
