import { supabase } from '../../integrations/supabase/client';

/**
 * Disponibilidad de los productos: un interruptor, sin cantidades.
 *
 * La comida no se maneja con stock exacto. El local tiene su menu completo y
 * activa o desactiva cada producto segun lo que tenga ese dia. Ese interruptor
 * es `products.is_active`, porque:
 *  - la base le oculta al publico los productos inactivos (politica
 *    products_public_read_active), asi que web y app dejan de mostrarlos;
 *  - la app de clientes ya lo lee como disponibilidad;
 *  - el personal del local ya puede escribirlo (products_staff_manage).
 *
 * La disponibilidad por sucursal (product_branch_settings.is_available /
 * is_paused) y stock_qty quedaron en desuso: la base le oculta al publico esas
 * filas, asi que la tienda no podia verlas y el producto seguia a la venta.
 */
export const productAvailabilityService = {
  /** Activa o desactiva un producto. Devuelve error legible si no hubo cambio. */
  async setAvailable(productId: string, available: boolean): Promise<{ error: Error | null }> {
    const result = await supabase.from('products').update({ is_active: available }).eq('id', productId).select('id');
    if (result.error) return { error: new Error(result.error.message) };
    // Con RLS, un update sin permiso no falla: afecta cero filas.
    if (!result.data || result.data.length === 0) {
      return { error: new Error('No tienes permiso para cambiar este producto.') };
    }
    return { error: null };
  },
};
