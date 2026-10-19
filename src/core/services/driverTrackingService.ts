import { supabase } from '../../integrations/supabase/client';

/**
 * Rastreo de repartidores para el administrador general: donde esta cada uno
 * y si se esta moviendo.
 *
 * La posicion actual sale de driver_current_state (la actualiza la app del
 * repartidor con cada latido) y el movimiento de driver_locations, el
 * historial de puntos. Las dos tablas tienen policy de lectura para el admin
 * (supabase/migrations/202608260001_driver_admin_rls_policies.sql).
 */

/** Sin latido en este tiempo, el repartidor se da por desconectado. */
export const SIGNAL_TIMEOUT_MIN = 5;
/** Radio dentro del cual los puntos cuentan como "mismo lugar" (ruido del GPS). */
const STILL_RADIUS_M = 60;
/** Quieto mas de esto con un pedido en curso es sospechoso. */
export const IDLE_WITH_ORDER_MIN = 10;
/** Quieto mas de esto sin pedido: conectado pero sin moverse. */
export const IDLE_AVAILABLE_MIN = 30;
/** Ventana de historial que se mira para calcular movimiento. */
const HISTORY_WINDOW_MIN = 60;

export type DriverTrackingState = 'moving' | 'idle_with_order' | 'idle' | 'available' | 'offline';

export interface DriverTrackingRecord {
  driver_id: string;
  name: string;
  phone: string;
  is_verified: boolean;
  is_online: boolean;
  status: string;
  lat: number | null;
  lng: number | null;
  last_seen_at: string;
  /** Minutos desde el ultimo latido; null si nunca envio uno. */
  signal_age_min: number | null;
  /** Minutos que lleva en el mismo lugar; null si no hay historial suficiente. */
  still_for_min: number | null;
  /** Metros recorridos en los ultimos 30 minutos. */
  distance_30_min_m: number;
  order_id: string;
  order_code: string;
  order_status: string;
  state: DriverTrackingState;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function minutesSince(value: string | null | undefined, now: number) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, (now - time) / 60000);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type LocationPoint = { lat: number; lng: number; at: number };

/** Minutos que lleva dentro de STILL_RADIUS_M del punto mas reciente. */
function stillForMinutes(points: LocationPoint[], now: number) {
  if (points.length === 0) return null;
  const latest = points[0];
  let since = latest.at;
  for (const point of points.slice(1)) {
    if (distanceMeters(latest, point) > STILL_RADIUS_M) break;
    since = point.at;
  }
  // Si todo el historial esta en el mismo lugar, lleva al menos toda la ventana.
  return (now - since) / 60000;
}

function distanceSince(points: LocationPoint[], fromTime: number) {
  const recent = points.filter((point) => point.at >= fromTime);
  let total = 0;
  for (let i = 1; i < recent.length; i += 1) {
    const step = distanceMeters(recent[i - 1], recent[i]);
    // Saltos menores al ruido del GPS no cuentan como recorrido.
    if (step > 15) total += step;
  }
  return total;
}

export const driverTrackingService = {
  fetch: async (): Promise<{ data: DriverTrackingRecord[] | null; error: { message: string } | null }> => {
    const now = Date.now();
    const since = new Date(now - HISTORY_WINDOW_MIN * 60000).toISOString();

    const [driversResult, stateResult, locationsResult, assignmentsResult] = await Promise.all([
      supabase.from('drivers').select('user_id, is_verified'),
      supabase.from('driver_current_state').select('driver_id, status, is_online, last_lat, last_lng, last_seen_at'),
      supabase
        .from('driver_locations')
        .select('driver_id, lat, lng, recorded_at')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
        .limit(5000),
      supabase.from('order_assignments').select('driver_id, order_id, status, assigned_at').in('status', ['assigned', 'accepted']),
    ]);

    const error = driversResult.error || stateResult.error || locationsResult.error || assignmentsResult.error;
    if (error) return { data: null, error };

    const drivers = (driversResult.data ?? []) as Array<{ user_id: string; is_verified: boolean | null }>;
    const driverIds = drivers.map((row) => String(row.user_id));
    const assignments = (assignmentsResult.data ?? []) as Array<{ driver_id: string; order_id: string; status: string; assigned_at: string }>;
    const orderIds = Array.from(new Set(assignments.map((row) => String(row.order_id))));

    const [profilesResult, ordersResult] = await Promise.all([
      driverIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', driverIds)
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0
        ? supabase.from('orders').select('id, order_code, status').in('id', orderIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (profilesResult.error) return { data: null, error: profilesResult.error };
    if (ordersResult.error) return { data: null, error: ordersResult.error };

    const profiles = new Map<string, any>(((profilesResult.data ?? []) as any[]).map((row) => [String(row.user_id), row]));
    const states = new Map<string, any>(((stateResult.data ?? []) as any[]).map((row) => [String(row.driver_id), row]));
    const orders = new Map<string, any>(((ordersResult.data ?? []) as any[]).map((row) => [String(row.id), row]));

    // Un repartidor con pedido aceptado cuenta por ese; si solo tiene una
    // oferta pendiente, por la oferta.
    const assignmentByDriver = new Map<string, { order_id: string; status: string }>();
    for (const row of assignments) {
      const current = assignmentByDriver.get(String(row.driver_id));
      if (!current || (current.status !== 'accepted' && row.status === 'accepted')) {
        assignmentByDriver.set(String(row.driver_id), { order_id: String(row.order_id), status: row.status });
      }
    }

    const pointsByDriver = new Map<string, LocationPoint[]>();
    for (const row of (locationsResult.data ?? []) as any[]) {
      const lat = toNumber(row.lat);
      const lng = toNumber(row.lng);
      const at = new Date(row.recorded_at).getTime();
      if (lat === null || lng === null || Number.isNaN(at)) continue;
      const list = pointsByDriver.get(String(row.driver_id)) ?? [];
      list.push({ lat, lng, at });
      pointsByDriver.set(String(row.driver_id), list);
    }

    const data: DriverTrackingRecord[] = drivers.map((driver) => {
      const id = String(driver.user_id);
      const state = states.get(id);
      const profile = profiles.get(id);
      const assignment = assignmentByDriver.get(id);
      const order = assignment ? orders.get(assignment.order_id) : null;
      const points = pointsByDriver.get(id) ?? [];

      const signalAge = minutesSince(state?.last_seen_at, now);
      const isOnline = Boolean(state?.is_online) && signalAge !== null && signalAge <= SIGNAL_TIMEOUT_MIN;
      const stillFor = stillForMinutes(points, now);
      const hasOrder = Boolean(order);

      let trackingState: DriverTrackingState;
      if (!isOnline) trackingState = 'offline';
      else if (hasOrder && stillFor !== null && stillFor >= IDLE_WITH_ORDER_MIN) trackingState = 'idle_with_order';
      else if (hasOrder) trackingState = 'moving';
      else if (stillFor !== null && stillFor >= IDLE_AVAILABLE_MIN) trackingState = 'idle';
      else trackingState = 'available';

      return {
        driver_id: id,
        name: String(profile?.full_name || profile?.email || 'Repartidor'),
        phone: String(profile?.phone || ''),
        is_verified: Boolean(driver.is_verified),
        is_online: isOnline,
        status: String(state?.status || ''),
        lat: toNumber(state?.last_lat),
        lng: toNumber(state?.last_lng),
        last_seen_at: String(state?.last_seen_at || ''),
        signal_age_min: signalAge,
        still_for_min: stillFor,
        distance_30_min_m: distanceSince(points.slice().reverse(), now - 30 * 60000),
        order_id: order ? String(order.id) : '',
        order_code: order ? String(order.order_code ?? '') : '',
        order_status: order ? String(order.status ?? '') : '',
        state: trackingState,
      };
    });

    // Primero lo que requiere atencion.
    const priority: Record<DriverTrackingState, number> = { idle_with_order: 0, idle: 1, moving: 2, available: 3, offline: 4 };
    data.sort((a, b) => priority[a.state] - priority[b.state] || a.name.localeCompare(b.name));

    return { data, error: null };
  },
};
