import { supabase } from '../../integrations/supabase/client';
import { isOrderAwaitingPayment } from '../admin/utils/orderWorkflow';
import { OrderDetail, OrderStatus, OrderSummary } from '../types';

export const ordersService = {
  fetchOrders: async (branchId: string, statuses: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready']) => {
    const query = supabase
      .from('orders')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    let result = await query;
    if (result.error && /column\s+orders\.status\s+does not exist/i.test(result.error.message || '')) {
      result = await supabase.from('orders').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
    }

    if (result.error) {
      return result;
    }

    // Un pedido sin pago confirmado no aparece en la cola: se paga antes de despachar.
    const normalized = (result.data ?? [])
      .filter((row: any) => !('payment_status' in row) || !isOrderAwaitingPayment(String(row.status ?? row.order_status ?? ''), row.payment_status))
      .map(mapOrderSummary);
    const filtered = statuses.length > 0 ? normalized.filter((order) => statuses.includes(order.status)) : normalized;
    return { data: filtered, error: null };
  },

  fetchOrderDetail: async (orderId: string, branchId: string) => {
    const orderResult = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (orderResult.error) {
      return orderResult;
    }

    if (!orderResult.data) {
      return { data: null, error: null };
    }

    const [itemsResult, historyResult] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', orderId),
      supabase.from('order_status_history').select('*').eq('order_id', orderId),
    ]);

    const items = (itemsResult.data ?? []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id ?? item.product ?? '',
      name: item.name ?? item.product_name ?? 'Producto',
      quantity: Number(item.quantity ?? item.qty ?? 1),
      unit_price: Number(item.unit_price ?? item.price ?? 0),
    }));

    const status_history = (historyResult.data ?? []).map((history: any) => ({
      status: (history.status ?? history.order_status ?? 'new') as OrderStatus,
      changed_at: history.changed_at ?? history.created_at ?? new Date().toISOString(),
      note: history.note ?? undefined,
    }));

    const detail: OrderDetail = {
      ...mapOrderSummary(orderResult.data),
      delivery_address: orderResult.data.delivery_address ?? orderResult.data.address ?? undefined,
      phone: orderResult.data.phone ?? orderResult.data.customer_phone ?? undefined,
      items,
      status_history,
    };

    return { data: detail, error: null };
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus) => {
    if (!['new', 'cancelled', 'rejected'].includes(status)) {
      const current = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      const row = current.data as any;
      if (row && 'payment_status' in row && isOrderAwaitingPayment(String(row.status ?? ''), row.payment_status)) {
        return { data: null, error: new Error('El pedido aun no tiene el pago confirmado. No se puede avanzar hasta que se pague.') };
      }
    }

    let result: any = null;
    const candidates = appStatusToDbCandidates(status);

    for (const candidate of candidates) {
      result = await supabase.from('orders').update({ status: candidate }).eq('id', orderId).select();
      if (!result.error) {
        break;
      }
      if (!/invalid input value for enum/i.test(result.error.message || '')) {
        break;
      }
    }

    if (result.error) {
      return result;
    }

    const now = new Date().toISOString();
    const historyInsert = await supabase.from('order_status_history').insert({ order_id: orderId, status, changed_at: now });
    if (historyInsert.error && /column\s+changed_at\s+does not exist/i.test(historyInsert.error.message || '')) {
      await supabase.from('order_status_history').insert({ order_id: orderId, status, created_at: now });
    }

    return result;
  },
};

function mapOrderSummary(row: any): OrderSummary {
  const normalizedStatus = normalizeOrderStatus(row.status ?? row.order_status);
  return {
    id: row.id,
    branch_id: row.branch_id,
    status: normalizedStatus,
    total: Number(row.total ?? row.amount_total ?? row.amount ?? 0),
    customer_name: row.customer_name ?? row.customer_full_name ?? row.customer ?? undefined,
    payment_method: row.payment_method ?? row.payment_type ?? undefined,
    created_at: row.created_at ?? row.updated_at ?? new Date().toISOString(),
  };
}

function normalizeOrderStatus(rawStatus: unknown): OrderStatus {
  const value = String(rawStatus ?? '').toLowerCase();

  if (['new', 'pending', 'placed', 'created'].includes(value)) return 'new';
  if (['accepted', 'confirmed'].includes(value)) return 'accepted';
  if (['preparing', 'in_progress', 'cooking'].includes(value)) return 'preparing';
  if (['ready', 'completed', 'prepared', 'on_the_way'].includes(value)) return 'ready';
  if (['rejected', 'declined'].includes(value)) return 'rejected';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  if (['delivered', 'fulfilled'].includes(value)) return 'delivered';

  return 'new';
}

function appStatusToDbCandidates(status: OrderStatus): string[] {
  const map: Record<OrderStatus, string[]> = {
    new: ['new', 'pending', 'placed'],
    accepted: ['accepted', 'confirmed'],
    preparing: ['preparing', 'in_progress', 'cooking'],
    ready: ['ready', 'completed', 'prepared', 'on_the_way'],
    rejected: ['rejected', 'declined'],
    cancelled: ['cancelled', 'canceled'],
    delivered: ['delivered', 'fulfilled'],
  };

  return map[status] ?? [status];
}
