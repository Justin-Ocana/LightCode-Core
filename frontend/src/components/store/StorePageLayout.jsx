/**
 * Layout base para todas las páginas de la tienda
 * Solo incluye el contenido (la navbar y footer están en StoreLayout)
 */
export function StorePageLayout({ store, storeSlug, children }) {
  return (
    <div className="store-page" style={{ background: 'var(--color-background)' }}>
      <main className="store-content" style={{ background: 'var(--color-background)' }}>
        {children}
      </main>
    </div>
  );
}
