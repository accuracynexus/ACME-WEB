import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { incomingOrdersService, type IncomingOrder } from '../../../core/services/incomingOrdersService';

/** Cada cuánto se vuelve a preguntar por pedidos nuevos. */
const INTERVALO_MS = 8000;

/**
 * Mantiene al día la lista de pedidos que el local todavía no atendió.
 *
 * Sondea cada pocos segundos porque Realtime no está habilitado en el proyecto:
 * la suscripción conecta pero no llega ningún evento. Aun así se deja abierta,
 * de modo que el día que se publiquen las tablas el aviso pase a ser instantáneo
 * sin tocar este código.
 */
export function useIncomingOrders(params: {
  branchId?: string | null;
  merchantId?: string | null;
  enabled: boolean;
}) {
  const { branchId, merchantId, enabled } = params;
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hayNuevo, setHayNuevo] = useState(false);
  const vistos = useRef<Set<string>>(new Set());
  const yaCargoUnaVez = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await incomingOrdersService.list({ branchId, merchantId });
    if (error) return;

    setOrders(data);
    setLoaded(true);

    // Un pedido cuenta como nuevo la primera vez que se ve. En la primera carga
    // no se marca nada: si no, entrar al portal con pedidos viejos sonaría como
    // si acabaran de llegar todos juntos.
    if (yaCargoUnaVez.current && data.some((o) => !vistos.current.has(o.id))) {
      setHayNuevo(true);
    }
    vistos.current = new Set(data.map((o) => o.id));
    yaCargoUnaVez.current = true;
  }, [branchId, merchantId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoaded(false);
      yaCargoUnaVez.current = false;
      vistos.current = new Set();
      return;
    }

    refresh();
    const timer = window.setInterval(refresh, INTERVALO_MS);

    // Al volver a la pestaña se refresca de inmediato: quien estuvo fuera un
    // rato quiere ver el estado real, no esperar al siguiente ciclo.
    const alVolver = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', alVolver);

    const canal = supabase
      .channel('portal-incoming-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .subscribe();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
      supabase.removeChannel(canal);
    };
  }, [refresh, enabled]);

  const marcarVisto = useCallback(() => setHayNuevo(false), []);

  return { orders, loaded, hayNuevo, marcarVisto, refresh };
}
