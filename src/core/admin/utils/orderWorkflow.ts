export type AdminOrderStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const ORDER_STATUS_META: Record<
  string,
  {
    label: string;
    tone: AdminOrderStatusTone;
    next: string[];
  }
> = {
  pending_payment: {
    label: 'Esperando pago',
    tone: 'warning',
    next: ['confirmed', 'cancelled'],
  },
  placed: {
    label: 'Recibido',
    tone: 'info',
    next: ['confirmed', 'cancelled'],
  },
  confirmed: {
    label: 'Confirmado',
    tone: 'info',
    next: ['preparing', 'cancelled'],
  },
  accepted: {
    label: 'Aceptado',
    tone: 'info',
    next: ['preparing', 'cancelled'],
  },
  preparing: {
    label: 'En preparacion',
    tone: 'warning',
    next: ['ready', 'cancelled'],
  },
  ready: {
    label: 'Listo',
    tone: 'success',
    next: ['on_the_way', 'delivered'],
  },
  on_the_way: {
    label: 'En camino',
    tone: 'warning',
    next: ['delivered'],
  },
  delivered: {
    label: 'Entregado',
    tone: 'success',
    next: [],
  },
  cancelled: {
    label: 'Cancelado',
    tone: 'danger',
    next: [],
  },
  rejected: {
    label: 'Rechazado',
    tone: 'danger',
    next: [],
  },
  pending: {
    label: 'Pendiente',
    tone: 'warning',
    next: ['confirmed', 'cancelled'],
  },
};

export function normalizeAdminOrderStatus(status: string) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'new' || normalized === 'created') return 'placed';
  if (normalized === 'accepted') return 'confirmed';
  if (normalized === 'completed') return 'delivered';
  if (normalized === 'canceled') return 'cancelled';
  return normalized || 'placed';
}

// El pedido se paga antes de despacharse: mientras siga recien creado y su
// pago no este confirmado, no entra a la cola operativa y solo se puede cancelar.
const AWAITING_PAYMENT_STATUSES = new Set(['pending_payment', 'placed', 'pending']);

export function isOrderAwaitingPayment(status: string, paymentStatus: string | null | undefined) {
  if (!AWAITING_PAYMENT_STATUSES.has(normalizeAdminOrderStatus(status))) return false;
  return String(paymentStatus ?? '').trim().toLowerCase() !== 'paid';
}

export function getAdminOrderStatusLabel(status: string, paymentStatus?: string | null) {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return 'Esperando pago';
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.label || normalized || 'Sin estado';
}

export function getAdminOrderStatusTone(status: string, paymentStatus?: string | null): AdminOrderStatusTone {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return 'warning';
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.tone || 'neutral';
}

export function getAdminOrderNextStatuses(status: string, paymentStatus?: string | null) {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return ['cancelled'];
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.next ?? [];
}
