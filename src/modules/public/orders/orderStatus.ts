// Traduce los estados crudos de la base (enum order_status) a algo que el
// cliente entienda, y decide si un pedido sigue en curso o ya termino.

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Esperando pago',
  placed: 'Pedido recibido',
  confirmed: 'Confirmado por el local',
  preparing: 'En preparación',
  ready_for_pickup: 'Listo, esperando repartidor',
  assigned: 'Repartidor asignado',
  driver_accepted: 'Repartidor en camino al local',
  picked_up: 'Pedido recogido',
  on_the_way: 'En camino a tu dirección',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  failed: 'No completado',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pago pendiente',
  authorized: 'Pago autorizado',
  paid: 'Pagado',
  failed: 'Pago rechazado',
  cancelled: 'Pago cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado parcialmente',
};

/** Estados en los que el pedido ya no se mueve. */
const ESTADOS_FINALES = new Set(['delivered', 'cancelled', 'failed']);

export function isOrderActive(status: string): boolean {
  return !ESTADOS_FINALES.has(status);
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export function orderStatusTone(status: string): string {
  if (status === 'delivered') return '#15803d';
  if (status === 'cancelled' || status === 'failed') return '#b91c1c';
  if (status === 'on_the_way' || status === 'picked_up') return '#c2410c';
  return '#4d148c';
}

/** Pasos que ve el cliente mientras su pedido avanza. */
export const ORDER_STEPS: Array<{ key: string; label: string; matches: string[] }> = [
  { key: 'recibido', label: 'Recibido', matches: ['placed', 'pending_payment'] },
  { key: 'preparando', label: 'En preparación', matches: ['confirmed', 'preparing'] },
  { key: 'repartidor', label: 'Con el repartidor', matches: ['ready_for_pickup', 'assigned', 'driver_accepted', 'picked_up'] },
  { key: 'camino', label: 'En camino', matches: ['on_the_way'] },
  { key: 'entregado', label: 'Entregado', matches: ['delivered'] },
];

/** Indice del paso actual; -1 si el pedido se cancelo o fallo. */
export function currentStepIndex(status: string): number {
  if (status === 'cancelled' || status === 'failed') return -1;
  const idx = ORDER_STEPS.findIndex((step) => step.matches.includes(status));
  return idx === -1 ? 0 : idx;
}
