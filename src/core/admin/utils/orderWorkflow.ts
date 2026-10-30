export type AdminOrderStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// El negocio lleva el pedido paso a paso -lo acepta, lo prepara, lo empaqueta y
// lo marca listo- y puede asignar repartidor o cancelar. Los estados del reparto
// los pone el repartidor desde su app, asi que aqui no tienen siguiente paso.
const READY_STATUS = 'ready_for_pickup';
const BEFORE_READY_STATUSES = new Set(['pending_payment', 'placed', 'pending', 'confirmed', 'preparing']);
const ASSIGNABLE_STATUSES = new Set([...BEFORE_READY_STATUSES, READY_STATUS, 'assigned']);
const CANCELLABLE_STATUSES = new Set([...ASSIGNABLE_STATUSES, 'driver_accepted']);

const ORDER_STATUS_META: Record<string, { label: string; tone: AdminOrderStatusTone }> = {
  pending_payment: { label: 'Esperando pago', tone: 'warning' },
  placed: { label: 'Nuevo', tone: 'warning' },
  pending: { label: 'Pendiente', tone: 'warning' },
  confirmed: { label: 'Recibido', tone: 'info' },
  preparing: { label: 'En preparacion', tone: 'warning' },
  ready_for_pickup: { label: 'Listo para recojo', tone: 'success' },
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

/**
 * Etiqueta del estado tal como la ve el local.
 *
 * [packedAt] hace falta porque "Empaquetado" no es un estado del enum sino un
 * paso dentro de `preparing`: el pedido sigue en preparacion -y el repartidor
 * no lo ve disponible- hasta que el local lo marca listo. Guardarlo como una
 * marca de tiempo evita tocar el enum, que comparten la app del cliente, la
 * del repartidor y el backend.
 */
export function getAdminOrderStatusLabel(status: string, paymentStatus?: string | null, packedAt?: string | null) {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return 'Esperando pago';
  const normalized = normalizeAdminOrderStatus(status);
  if (normalized === 'preparing' && packedAt) return 'Empaquetado';
  return ORDER_STATUS_META[normalized]?.label || normalized || 'Sin estado';
}

export function getAdminOrderStatusTone(status: string, paymentStatus?: string | null): AdminOrderStatusTone {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return 'warning';
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.tone || 'neutral';
}

/** Un pedido que entro y el local todavia no acepto. */
const SIN_ACEPTAR_STATUSES = new Set(['pending_payment', 'placed', 'pending']);

/**
 * Los pasos del pedido, en orden. Los cinco primeros los marca el local; "En
 * camino" y "Entregado" los pone el repartidor, pero el local los sigue viendo
 * para saber que su pedido llego.
 */
export const MERCHANT_FLOW_STEPS: Array<{ key: string; label: string }> = [
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'recibido', label: 'Recibido' },
  { key: 'preparacion', label: 'En preparacion' },
  { key: 'empaquetado', label: 'Empaquetado' },
  { key: 'listo', label: 'Listo para recojo' },
  { key: 'en_camino', label: 'En camino' },
  { key: 'entregado', label: 'Entregado' },
];

export type MerchantStepKind = 'accept' | 'preparing' | 'packed' | 'ready';

/** -1 si se cancelo o no se completo; si no, el indice en MERCHANT_FLOW_STEPS. */
export function getMerchantFlowIndex(status: string, packedAt?: string | null) {
  const normalized = normalizeAdminOrderStatus(status);
  if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'failed') return -1;
  if (SIN_ACEPTAR_STATUSES.has(normalized)) return 0;
  if (normalized === 'confirmed') return 1;
  if (normalized === 'preparing') return packedAt ? 3 : 2;
  if (normalized === 'picked_up' || normalized === 'on_the_way') return 5;
  if (normalized === 'delivered') return 6;
  // ready_for_pickup, assigned, driver_accepted: listo, esperando al repartidor.
  return 4;
}

/**
 * El unico boton que el local tiene que ver ahora mismo, o null si no le toca
 * mover nada.
 *
 * Es uno y no una lista a proposito: en cocina se avanza de a un paso, y poder
 * saltar de "nuevo" a "listo" era justo lo que dejaba pedidos marcados listos
 * sin haberlos preparado.
 */
export function getMerchantNextStep(
  status: string,
  paymentStatus?: string | null,
  packedAt?: string | null,
  /** false si la base todavia no tiene orders.packed_at: ese paso se salta,
   *  igual que lo hace advanceMerchantStep, para que boton y servidor coincidan. */
  packingSupported = true
): { kind: MerchantStepKind; label: string } | null {
  if (paymentStatus !== undefined && isOrderAwaitingPayment(status, paymentStatus)) return null;
  const normalized = normalizeAdminOrderStatus(status);
  if (SIN_ACEPTAR_STATUSES.has(normalized)) return { kind: 'accept', label: 'Aceptar pedido' };
  if (normalized === 'confirmed') return { kind: 'preparing', label: 'En preparacion' };
  if (normalized === 'preparing') {
    return packedAt || !packingSupported ? { kind: 'ready', label: 'Listo para recojo' } : { kind: 'packed', label: 'Empaquetado' };
  }
  return null;
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
