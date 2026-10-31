/** Etiqueta legible desde el slug de URL (p. ej. mi-server -> Mi Server). */
export function formatStoreSlugLabel(slug) {
  if (!slug || typeof slug !== 'string') return 'Tienda';
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
