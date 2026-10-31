const LABELS = {
  ONE_TIME: 'Compra única',
  SUBSCRIPTION: 'Suscripción',
};

/** Etiqueta legible para el tipo de compra del producto (API: ONE_TIME, SUBSCRIPTION). */
export function formatPurchaseType(purchaseType) {
  if (!purchaseType) return '';
  return LABELS[purchaseType] || String(purchaseType).replace(/_/g, ' ');
}

const INTERVAL_LABELS = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
};

/** Etiqueta legible para el intervalo de suscripción (API: MONTHLY, QUARTERLY, YEARLY). */
export function formatSubscriptionInterval(interval) {
  if (!interval) return '';
  return INTERVAL_LABELS[interval] || String(interval).replace(/_/g, ' ');
}

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  MXN: '$',
  ARS: '$',
  COP: '$',
  CLP: '$',
  BRL: 'R$',
};

/** Formatea dinero con símbolo y código (ej: $10.00 USD). */
export function formatMoney(amount, currency) {
  const val = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(val) ? val.toFixed(2) : (amount ?? '');
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  const cur = currency ? String(currency) : '';
  return `${sym}${safe}${cur ? ` ${cur}` : ''}`.trim();
}
