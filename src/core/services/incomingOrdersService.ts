import { supabase } from '../../integrations/supabase/client';

/**
 * Pedidos que entraron y todavía no atendió nadie.
 *
 * El aviso al local se construye sobre este estado, no sobre un evento: así no
 * se puede perder. Si el navegador se cierra, si se recarga la página o si el
 * turno lo toma otra persona, el pedido sigue en `placed` y el aviso vuelve a
 * aparecer solo.
 */

/** Un pedido entra aquí desde que se crea hasta que el local lo confirma. */
const ESTADO_SIN_ATENDER = 'placed';

export interface IncomingOrder {
  id: string;
  order_code: number | null;
  total: number;
  payment_status: string;
  created_at: string;
  recipient_name: string | null;
  items_count: number;
  items_preview: string;
}

interface OrderRow {
  id: string;
  order_code: number | null;
  total: number | string | null;
  payment_status: string | null;
  created_at: string;
  delivery: { recipient_name: string | null } | null;
  items: { product_name_snapshot: string | null; quantity: number | null }[] | null;
}

function mapOrder(row: OrderRow): IncomingOrder {
  const items = row.items ?? [];
  return {
    id: row.id,
    order_code: row.order_code,
    total: Number(row.total ?? 0),
    payment_status: row.payment_status ?? 'pending',
    created_at: row.created_at,
    recipient_name: row.delivery?.recipient_name ?? null,
    items_count: items.reduce((n, i) => n + (Number(i.quantity) || 0), 0),
    items_preview: items
      .map((i) => `${i.quantity ?? 1}× ${i.product_name_snapshot ?? 'Producto'}`)
      .join(', '),
  };
}

export const incomingOrdersService = {
  /**
   * Pedidos sin atender de una sucursal, o de todas las del comercio cuando se
   * entra con alcance de negocio.
   */
  list: async (params: { branchId?: string | null; merchantId?: string | null }) => {
    const { branchId, merchantId } = params;
    if (!branchId && !merchantId) return { data: [] as IncomingOrder[], error: null };

    let query = supabase
      .from('orders')
      .select(
        `id, order_code, total, payment_status, created_at,
         delivery:order_delivery_details ( recipient_name ),
         items:order_items ( product_name_snapshot, quantity )`
      )
      .eq('status', ESTADO_SIN_ATENDER)
      .order('created_at', { ascending: true });

    query = branchId ? query.eq('branch_id', branchId) : query.eq('merchant_id', merchantId!);

    const { data, error } = await query;
    if (error) return { data: [] as IncomingOrder[], error };
    return { data: (data as unknown as OrderRow[]).map(mapOrder), error: null };
  },

  /** El local acepta el pedido y empieza a prepararlo. */
  accept: async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'confirmed', accepted_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) return { error };

    // El historial es informativo: si falla no se deshace la aceptación, que es
    // lo que de verdad le importa al local.
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      from_status: ESTADO_SIN_ATENDER,
      to_status: 'confirmed',
      actor_type: 'merchant',
      note: 'Aceptado desde el aviso de pedido nuevo',
    });

    return { error: null };
  },
};
