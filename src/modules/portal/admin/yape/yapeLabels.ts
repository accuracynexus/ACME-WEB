import type { AdminTone } from '../../../../components/admin/AdminScaffold';
import type { CobroVeredicto, YapeCobro, YapeRecibido, YapeVeredicto } from '../../../../core/services/adminYapeService';

// ─── Dinero y fechas ─────────────────────────────────────────────────────────

export function soles(centimos: number | null | undefined) {
  const value = Number(centimos ?? 0) / 100;
  return `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function hora(value: string | null | undefined, conSegundos = false) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    ...(conSegundos ? { second: '2-digit' } : {}),
    hour12: false,
  });
}

export function fechaHora(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function haceCuanto(value: string | null | undefined, ahora = Date.now()) {
  if (!value) return 'nunca';
  const segundos = Math.max(0, Math.round((ahora - new Date(value).getTime()) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} dias`;
}

// ─── Veredictos ──────────────────────────────────────────────────────────────

/** Grupos que se ven en el grafico, las cifras y los filtros. */
export type Grupo = 'conciliado' | 'diferencia' | 'aire' | 'ignorado';

export const GRUPOS: Record<Grupo, { label: string; color: string; tone: AdminTone }> = {
  conciliado: { label: 'Conciliados', color: '#10b981', tone: 'success' },
  diferencia: { label: 'Monto distinto', color: '#f59e0b', tone: 'warning' },
  aire: { label: 'Sin dueño', color: '#ef4444', tone: 'danger' },
  ignorado: { label: 'Descartados', color: '#94a3b8', tone: 'neutral' },
};

export const YAPE_VEREDICTO: Record<YapeVeredicto, { label: string; tone: AdminTone; grupo: Grupo }> = {
  conciliado: { label: 'Conciliado', tone: 'success', grupo: 'conciliado' },
  de_mas: { label: 'Pagó de más', tone: 'warning', grupo: 'diferencia' },
  parcial: { label: 'Abono parcial', tone: 'warning', grupo: 'diferencia' },
  anulado: { label: 'Compra anulada', tone: 'warning', grupo: 'diferencia' },
  por_verificar: { label: 'Por verificar', tone: 'danger', grupo: 'aire' },
  huerfano: { label: 'Sin dueño', tone: 'danger', grupo: 'aire' },
  ignorado: { label: 'Descartado', tone: 'neutral', grupo: 'ignorado' },
};

export const COBRO_VEREDICTO: Record<CobroVeredicto, { label: string; tone: AdminTone }> = {
  en_curso: { label: 'En curso', tone: 'info' },
  conciliado: { label: 'Pagado exacto', tone: 'success' },
  de_mas: { label: 'Pagó de más', tone: 'warning' },
  incompleto: { label: 'Pago incompleto', tone: 'warning' },
  anulado: { label: 'Anulado', tone: 'warning' },
  reclamado: { label: 'Dice que pagó', tone: 'danger' },
  sin_pago: { label: 'Sin pago', tone: 'neutral' },
  reemplazado: { label: 'Reemplazado', tone: 'neutral' },
};

export const METODO: Record<string, string> = {
  notificacion: 'Monto exacto dentro de la ventana',
  nombre: 'Nombre del titular',
  codigo: 'Código de seguridad de la constancia',
  reclamo: 'Reclamo del cliente (código y monto)',
  pagador_conocido: 'Pagador conocido del cliente',
  saldo: 'Saldo a favor',
  sin_centimos: 'Cliente frecuente, sin céntimos',
  tardio_nombre: 'Yape tardío por nombre',
  declarado: 'Declarado por el cliente',
  captura: 'Captura cruzada con un yape recibido',
  manual: 'Asignado a mano por un admin',
};

export function grupoDe(yape: YapeRecibido): Grupo {
  return YAPE_VEREDICTO[yape.veredicto]?.grupo ?? 'aire';
}

/** Cobro que deberia tener un yape y no lo tiene: el riesgo de estafa. */
export function cobroEnRiesgo(cobro: YapeCobro) {
  return cobro.veredicto === 'reclamado';
}

// ─── Periodos ────────────────────────────────────────────────────────────────

export type Vista = 'hora' | 'dia' | 'semana' | 'mes';

export const VISTAS: { id: Vista; label: string }[] = [
  { id: 'hora', label: 'Hora' },
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

export interface Periodo {
  desde: Date;
  hasta: Date;
  /** Inicio de cada barra del grafico. */
  cortes: Date[];
  titulo: string;
  etiqueta: (corte: Date) => string;
}

function inicioDe(vista: Vista, ancla: Date) {
  const d = new Date(ancla);
  d.setSeconds(0, 0);
  if (vista === 'hora') {
    d.setMinutes(0);
    return d;
  }
  d.setHours(0, 0);
  if (vista === 'semana') {
    // La semana empieza el lunes.
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  } else if (vista === 'mes') {
    d.setDate(1);
  }
  return d;
}

function sumar(vista: Vista, fecha: Date, veces: number) {
  const d = new Date(fecha);
  if (vista === 'hora') d.setHours(d.getHours() + veces);
  else if (vista === 'dia') d.setDate(d.getDate() + veces);
  else if (vista === 'semana') d.setDate(d.getDate() + 7 * veces);
  else d.setMonth(d.getMonth() + veces);
  return d;
}

export function moverAncla(vista: Vista, ancla: Date, direccion: -1 | 1) {
  return sumar(vista, inicioDe(vista, ancla), direccion);
}

const fmtDia = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtCorto = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
const fmtMes = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' });
const fmtSemana = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric' });

function hhmm(d: Date) {
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function periodoDe(vista: Vista, ancla: Date): Periodo {
  const desde = inicioDe(vista, ancla);
  const hasta = sumar(vista, desde, 1);
  const cortes: Date[] = [];
  const paso = (d: Date) => {
    const n = new Date(d);
    if (vista === 'hora') n.setMinutes(n.getMinutes() + 5);
    else if (vista === 'dia') n.setHours(n.getHours() + 1);
    else n.setDate(n.getDate() + 1);
    return n;
  };
  for (let c = new Date(desde); c < hasta; c = paso(c)) cortes.push(c);

  const titulos: Record<Vista, string> = {
    hora: `${fmtCorto.format(desde)} · ${hhmm(desde)} – ${hhmm(hasta)}`,
    dia: fmtDia.format(desde),
    semana: `${fmtCorto.format(desde)} – ${fmtCorto.format(new Date(hasta.getTime() - 1))}`,
    mes: fmtMes.format(desde),
  };
  const etiqueta = (corte: Date) => {
    if (vista === 'hora' || vista === 'dia') return hhmm(corte);
    if (vista === 'semana') return fmtSemana.format(corte);
    return String(corte.getDate());
  };
  return { desde, hasta, cortes, titulo: titulos[vista], etiqueta };
}

/** Indice de la barra donde cae un momento, o -1 si esta fuera del periodo. */
export function corteDe(periodo: Periodo, momento: string) {
  const t = new Date(momento).getTime();
  if (t < periodo.desde.getTime() || t >= periodo.hasta.getTime()) return -1;
  let i = periodo.cortes.length - 1;
  while (i > 0 && periodo.cortes[i].getTime() > t) i -= 1;
  return i;
}
