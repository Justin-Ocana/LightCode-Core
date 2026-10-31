function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function purchaseTypeKeywords(purchaseType) {
  if (purchaseType === 'SUBSCRIPTION') {
    return ['subscription', 'suscripción', 'suscripcion'];
  }
  if (purchaseType === 'ONE_TIME') {
    return ['one time', 'compra única', 'compra unica', 'única', 'unica'];
  }
  return [];
}

/**
 * Texto para el chip de categoría bajo la imagen, o null si no debe mostrarse
 * (p. ej. cuando solo repite el tipo de compra ya indicado en el badge superior).
 */
export function getProductCategoryChip(product, purchaseType) {
  const name = (product.category_name || '').trim();
  const icon = (product.category_icon || '').trim();
  if (!name && !icon) return null;

  const ni = icon ? norm(icon) : '';
  const nn = name ? norm(name) : '';
  const blob = `${ni} ${nn}`.trim();

  const keywords = purchaseTypeKeywords(purchaseType);
  if (keywords.length && keywords.some((k) => blob.includes(k))) {
    return null;
  }

  if (ni && nn && (ni === nn || ni.replace(/\s/g, '') === nn.replace(/\s/g, ''))) {
    return name || icon;
  }

  if (ni && nn && (nn.startsWith(`${ni} `) || ni.startsWith(`${nn} `))) {
    return name || icon;
  }

  if (!ni) return name;
  if (!nn) return icon;
  return `${icon} ${name}`;
}
