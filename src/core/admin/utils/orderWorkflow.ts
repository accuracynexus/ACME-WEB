export type AdminOrderStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// El negocio solo marca el pedido como listo (preparado), le asigna repartidor
// o lo cancela. Los estados del reparto los pone el repartidor desde su app, asi
// que aqui no tienen siguiente paso para el negocio.
const READY_STATUS = 'ready_for_pickup';
const BEFORE_READY_STATUSES = new Set(['pending_payment', 'placed', 'pending', 'confirmed', 'preparing']);
const ASSIGNABLE_STATUSES = new Set([...BEFORE_READY_STATUSES, READY_STATUS, 'assigned']);
const CANCELLABLE_STATUSES = new Set([...ASSIGNABLE_STATUSES, 'driver_accepted']);

const ORDER_STATUS_META: Record<string, { label: string; tone: AdminOrderStatusTone }> = {
  pending_payment: { label: 'Esperando pago', tone: 'warning' },
  placed: { label: 'Recibido', tone: 'info' },
  pending: { label: 'Pendiente', tone: 'warning' },
  confirmed: { label: 'Confirmado', tone: 'info' },
  preparing: { label: 'En preparacion', tone: 'warning' },
  ready_for_pickup: { label: 'Listo', tone: 'success' },
  assigned: { label: 'Repartidor asignado', tone: 'info' },
  driver_accepted: { label: 'Repartidor en camino al local', tone: 'info' },
  picked_up: { label: 'Recogido', tone: 'warning' },
  on_the_way: { label: 'En camino', tone: 'warning' },
  delivered: { label: 'Entregado', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  failed: { label: 'No completado', tone: 'danger' },
};

export function normalizeAdminOrderStatus(status: string) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'new' || normalized === 'created') return 'placed';
  if (normalized === 'accepted') return 'confirmed';
  if (normalized === 'ready' || normalized === 'prepared') return READY_STATUS;
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

/** Estados a los que el negocio puede mover el pedido: solo "Listo". Cancelar va aparte. */
export function getAdminOrderNextStatuses(status: string, paymentStatus?: string | null) {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return [];
  return BEFORE_READY_STATUSES.has(normalizeAdminOrderStatus(status)) ? [READY_STATUS] : [];
}

/** El negocio puede asignar o cambiar repartidor hasta que el repartidor acepta. */
export function canBusinessAssignDriver(status: string, paymentStatus?: string | null) {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return false;
  return ASSIGNABLE_STATUSES.has(normalizeAdminOrderStatus(status));
}

/** El negocio puede cancelar hasta que el repartidor recoge el pedido. */
export function canBusinessCancelOrder(status: string) {
  return CANCELLABLE_STATUSES.has(normalizeAdminOrderStatus(status));
}
