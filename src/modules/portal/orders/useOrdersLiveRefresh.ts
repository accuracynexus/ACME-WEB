import { useEffect, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';

/** Respaldo por si Realtime no entrega el evento. */
const INTERVALO_MS = 10000;

/**
 * Vuelve a llamar a `refresh` cuando cambia algun pedido, para que la lista y
 * la ficha se pongan al dia solas (pago confirmado, repartidor que acepta,
 * pedido entregado) sin tener que recargar la pagina.
 *
 * Escucha Realtime sobre `orders` y, ademas, sondea cada pocos segundos y al
 * volver a la pestana: igual que useIncomingOrders, no se confia solo en
 * Realtime.
 */
export function useOrdersLiveRefresh(refresh: () => void, enabled: boolean, channelName: string) {
  // Se guarda en un ref para no reabrir el canal en cada render.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const run = () => refreshRef.current();
    const timer = window.setInterval(run, INTERVALO_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', alVolver);

    const canal = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, run)
      .subscribe();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
      supabase.removeChannel(canal);
    };
  }, [enabled, channelName]);
}
