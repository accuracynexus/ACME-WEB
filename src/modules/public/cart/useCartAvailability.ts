import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import type { PublicCartItem } from '../store/PublicStoreContext';

/** Cada cuanto se vuelve a mirar mientras el carrito esta abierto. */
const RECHECK_MS = 60_000;

/**
 * Productos del carrito que el local ya desactivo.
 *
 * El local activa o desactiva cada producto (products.is_active) y la base le
 * oculta al publico los desactivados; asi que un id que no vuelve en la
 * consulta ya no esta disponible. Se revisa al abrir el carrito, al volver a
 * la pestana y cada minuto: un cliente puede dejar el carrito abierto un rato
 * mientras al local se le acaba un plato.
 *
 * Si la consulta falla (sin conexion) no se bloquea nada: no es culpa del
 * cliente y el servidor igual valida al crear el pedido.
 */
export function useCartAvailability(items: PublicCartItem[]) {
  const [state, setState] = useState<{ checked: Set<string>; available: Set<string> }>({ checked: new Set(), available: new Set() });

  const productIds = useMemo(() => Array.from(new Set(items.map((item) => item.product_id).filter(Boolean))).sort(), [items]);
  const key = productIds.join(',');

  const recheck = useCallback(async () => {
    if (productIds.length === 0) {
      setState({ checked: new Set(), available: new Set() });
      return;
    }
    const { data, error } = await supabase.from('products').select('id').in('id', productIds).eq('is_active', true);
    if (error) return;
    setState({ checked: new Set(productIds), available: new Set((data ?? []).map((row: { id: string }) => String(row.id))) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    recheck();
    const timer = window.setInterval(recheck, RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [recheck]);

  // Solo se marca lo que ya se reviso: un producto recien agregado no aparece
  // como "no disponible" mientras llega la respuesta.
  const unavailableItems = useMemo(
    () => items.filter((item) => state.checked.has(item.product_id) && !state.available.has(item.product_id)),
    [items, state]
  );

  return { unavailableItems, recheck };
}

/** Convierte el error del servidor en algo que el cliente entienda. */
export function friendlyCheckoutError(message: string) {
  const match = /PRODUCTO_NO_DISPONIBLE:\s*(.+)$/i.exec(message);
  if (!match) return message;
  return `${match[1].trim()} ya no está disponible. Quítalo del carrito para continuar.`;
}
