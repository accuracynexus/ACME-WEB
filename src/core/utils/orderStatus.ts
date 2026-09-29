import { OrderStatus } from '../types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nuevo',
  accepted: 'Aceptado',
  preparing: 'En preparación',
  ready: 'Listo',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  delivered: 'Entregado',
};

// El negocio solo marca el pedido como listo o lo cancela; el resto lo pone el repartidor.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['ready', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: [],
  rejected: [],
  cancelled: [],
  delivered: [],
};
