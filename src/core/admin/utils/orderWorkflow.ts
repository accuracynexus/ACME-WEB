export type AdminOrderStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// Valores del enum order_status de la base, en el orden del flujo:
//   pending_payment, placed, confirmed, preparing, ready_for_pickup,
//   assigned, driver_accepted, picked_up, on_the_way, delivered,
//   cancelled, failed
//
// Antes este mapa usaba "ready", que no existe en el enum: al marcar un
// pedido como listo Postgres rechazaba el UPDATE y el pedido se quedaba en
// preparing. Y ready_for_pickup, assigned, driver_accepted, picked_up,
// pending_payment y failed no tenian entrada, asi que un pedido en esos
// estados se mostraba con el codigo crudo y sin acciones.
//
// El backend despacha al repartidor solo, cuando el pedido llega a
// ready_for_pickup con fulfillment_type = delivery. A partir de ahi los
// estados los mueve el repartidor desde su app; desde el panel quedan
// como forzado (delivered) o cancelacion.
const ORDER_STATUS_META: Record<
  string,
  {
    label: string;
    tone: AdminOrderStatusTone;
    next: string[];
  }
> = {
  pending_payment: {
    label: 'Pago pendiente',
    tone: 'warning',
    next: ['cancelled'],
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
  preparing: {
    label: 'En preparacion',
    tone: 'warning',
    next: ['ready_for_pickup', 'cancelled'],
  },
  ready_for_pickup: {
    label: 'Listo para recoger',
    tone: 'success',
    next: ['delivered', 'cancelled'],
  },
  assigned: {
    label: 'Repartidor asignado',
    tone: 'info',
    next: ['delivered', 'cancelled'],
  },
  driver_accepted: {
    label: 'Repartidor en camino al local',
    tone: 'info',
    next: ['delivered', 'cancelled'],
  },
  picked_up: {
    label: 'Recogido',
    tone: 'warning',
    next: ['delivered', 'cancelled'],
  },
  on_the_way: {
    label: 'En camino',
    tone: 'warning',
    next: ['delivered', 'cancelled'],
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
  failed: {
    label: 'Fallido',
    tone: 'danger',
    next: [],
  },
};

export function normalizeAdminOrderStatus(status: string) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'new' || normalized === 'created') return 'placed';
  if (normalized === 'accepted') return 'confirmed';
  if (normalized === 'ready') return 'ready_for_pickup';
  if (normalized === 'completed') return 'delivered';
  if (normalized === 'canceled') return 'cancelled';
  if (normalized === 'rejected') return 'cancelled';
  return normalized || 'placed';
}

export function getAdminOrderStatusLabel(status: string) {
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.label || normalized || 'Sin estado';
}

export function getAdminOrderStatusTone(status: string): AdminOrderStatusTone {
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.tone || 'neutral';
}

export function getAdminOrderNextStatuses(status: string) {
  const normalized = normalizeAdminOrderStatus(status);
  return ORDER_STATUS_META[normalized]?.next ?? [];
}
