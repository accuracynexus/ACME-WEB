// Estados de pagos, devoluciones, caja y liquidaciones tal como los guarda la
// base, en ingles. Las paginas de finanzas los mostraban crudos ("PENDING",
// "captured"); aca se traducen en un solo lugar.

export type FinanceTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const STATUS_META: Record<string, { label: string; tone: FinanceTone }> = {
  paid: { label: 'Pagado', tone: 'success' },
  captured: { label: 'Cobrado', tone: 'success' },
  authorized: { label: 'Autorizado', tone: 'info' },
  success: { label: 'Exitosa', tone: 'success' },
  settled: { label: 'Liquidado', tone: 'success' },
  processed: { label: 'Procesado', tone: 'success' },
  active: { label: 'Activa', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'warning' },
  requested: { label: 'Solicitado', tone: 'warning' },
  draft: { label: 'Borrador', tone: 'warning' },
  collected: { label: 'Cobrado', tone: 'info' },
  failed: { label: 'Fallido', tone: 'danger' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  cancelled: { label: 'Anulado', tone: 'danger' },
  overdue: { label: 'Vencido', tone: 'danger' },
  refunded: { label: 'Devuelto', tone: 'neutral' },
};

export function getFinanceStatus(status: string | null | undefined) {
  const key = String(status ?? '').trim().toLowerCase();
  return STATUS_META[key] ?? { label: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sin estado', tone: 'info' as FinanceTone };
}

const TRANSACTION_TYPES: Record<string, string> = {
  authorize: 'Autorizacion',
  capture: 'Cobro',
  void: 'Anulacion',
  refund: 'Devolucion',
};

export function getTransactionTypeLabel(type: string) {
  return TRANSACTION_TYPES[String(type ?? '').toLowerCase()] || type || 'Sin tipo';
}

export function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

export function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

/** "1 – 7 oct 2026": un periodo de liquidacion se lee por dias, no por hora. */
export function formatPeriod(start: string, end: string) {
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [start, end].filter(Boolean).join(' – ') || 'Sin periodo';
  const day = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
  const full = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day.format(from)} – ${full.format(to)}`;
}
