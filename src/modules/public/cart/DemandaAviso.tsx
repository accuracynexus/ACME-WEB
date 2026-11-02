import { useEffect, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';

/**
 * Aviso de alta demanda y tiempo aproximado de entrega.
 *
 * Lo calcula la base (demanda_actual) con los pedidos abiertos y los
 * repartidores en turno en este momento. Se refresca cada minuto. Si la base
 * aun no tiene la funcion o falla, no muestra nada.
 */
export interface DemandaActual {
  nivel: 'normal' | 'alta' | 'muy_alta';
  alta_demanda: boolean;
  repartidores: number;
  espera_repartidor_min: number | null;
  eta_min: number | null;
  eta_max: number | null;
  mensaje: string;
}

const REFRESCO_MS = 60_000;

export function useDemandaActual(branchId?: string | null, lat?: number | null, lng?: number | null) {
  const [demanda, setDemanda] = useState<DemandaActual | null>(null);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      const { data, error } = await supabase.rpc('demanda_actual', {
        p_branch_id: branchId || null,
        p_lat: lat ?? null,
        p_lng: lng ?? null,
      });
      if (!activo) return;
      setDemanda(error || !data ? null : (data as DemandaActual));
    };
    void cargar();
    const timer = window.setInterval(() => void cargar(), REFRESCO_MS);
    return () => {
      activo = false;
      window.clearInterval(timer);
    };
  }, [branchId, lat, lng]);

  return demanda;
}

export function DemandaAviso({ branchId, lat, lng, compacto = false }: {
  branchId?: string | null;
  lat?: number | null;
  lng?: number | null;
  compacto?: boolean;
}) {
  const demanda = useDemandaActual(branchId, lat, lng);
  if (!demanda) return null;

  const alta = demanda.alta_demanda;
  const muyAlta = demanda.nivel === 'muy_alta';
  const colores = muyAlta
    ? { fondo: '#fef2f2', borde: '#fecaca', texto: '#991b1b' }
    : alta
      ? { fondo: '#fffbeb', borde: '#fde68a', texto: '#92400e' }
      : { fondo: '#f0fdf4', borde: '#bbf7d0', texto: '#166534' };
  const titulo = alta ? 'Alta demanda' : 'Tiempo de entrega';
  const tiempo = demanda.eta_min != null && demanda.eta_max != null
    ? `${demanda.eta_min} a ${demanda.eta_max} min`
    : null;

  return (
    <section
      role={alta ? 'alert' : 'status'}
      aria-live="polite"
      style={{
        background: colores.fondo,
        border: `1px solid ${colores.borde}`,
        color: colores.texto,
        borderRadius: 16,
        padding: compacto ? '10px 14px' : '14px 18px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        marginBottom: compacto ? 12 : 16,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: compacto ? 18 : 22, lineHeight: 1 }}>{alta ? '⏳' : '🛵'}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: compacto ? 13 : 14 }}>
          {titulo}{tiempo ? ` · ${tiempo}` : ''}
        </div>
        {(alta || !compacto) && (
          <div style={{ fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>{demanda.mensaje}</div>
        )}
      </div>
    </section>
  );
}
