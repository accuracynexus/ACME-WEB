import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminStatCard } from '../../../../components/admin/AdminStatCard';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  driverTrackingService,
  DriverTrackingRecord,
  DriverTrackingState,
  IDLE_AVAILABLE_MIN,
  IDLE_WITH_ORDER_MIN,
} from '../../../../core/services/driverTrackingService';
import { cargarGoogleMaps, hayClaveDeMapas } from '../../../../core/utils/googleMaps';
import { supabase } from '../../../../integrations/supabase/client';
import { PortalContext } from '../../../auth/session/PortalContext';
import driverPinImage from '../../../../images/driver-ubi.png';

/** Cada cuanto se vuelve a leer la posicion (ademas de Realtime). */
const REFRESH_MS = 15000;
const DEFAULT_CENTER = { lat: -12.7869, lng: -74.9731 };

const STATE_META: Record<DriverTrackingState, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; color: string }> = {
  idle_with_order: { label: 'Detenido con pedido', tone: 'danger', color: '#ef4444' },
  idle: { label: 'Quieto', tone: 'warning', color: '#ff6200' },
  moving: { label: 'En pedido', tone: 'success', color: '#10b981' },
  available: { label: 'Disponible', tone: 'info', color: '#4d148c' },
  offline: { label: 'Sin señal', tone: 'neutral', color: '#94a3b8' },
};

function formatMinutes(value: number | null) {
  if (value === null) return 'Sin datos';
  if (value < 1) return 'menos de 1 min';
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  if (hours < 24) return `${hours} h ${Math.round(value % 60)} min`;
  return `${Math.floor(hours / 24)} d`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'Repartidor';
}

interface DriverPin {
  setData(position: google.maps.LatLngLiteral, name: string, color: string, title: string): void;
  getPosition(): google.maps.LatLngLiteral;
  setMap(map: google.maps.Map | null): void;
}

/**
 * Marcador del repartidor: la moto de ACME con una burbuja encima que dice su
 * primer nombre. Un Marker comun solo admite una imagen y una etiqueta encima
 * de ella, asi que se dibuja como OverlayView con HTML propio. La clase se
 * arma despues de cargar el SDK porque extiende google.maps.OverlayView.
 */
function createDriverPin(map: google.maps.Map, onClick: () => void): DriverPin {
  class DriverPinOverlay extends google.maps.OverlayView {
    private root = document.createElement('div');
    private bubble = document.createElement('div');
    private position: google.maps.LatLngLiteral = DEFAULT_CENTER;

    constructor() {
      super();
      this.root.style.cssText = 'position:absolute;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;';
      this.bubble.style.cssText =
        'position:relative;margin-bottom:4px;padding:3px 10px;border-radius:999px;background:#fff;border:2px solid;font-weight:700;font-size:12px;line-height:1.3;color:#0f172a;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.18);';
      // Colita de la burbuja, del mismo color que el borde.
      const tail = document.createElement('span');
      tail.style.cssText =
        'position:absolute;left:50%;bottom:-6px;width:8px;height:8px;background:#fff;border-right:2px solid;border-bottom:2px solid;border-color:inherit;transform:translateX(-50%) rotate(45deg);';
      this.bubble.appendChild(document.createTextNode(''));
      this.bubble.appendChild(tail);
      const img = document.createElement('img');
      img.src = driverPinImage;
      img.alt = '';
      img.style.cssText = 'width:44px;height:auto;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));';
      this.root.append(this.bubble, img);
      this.root.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
    }

    setData(position: google.maps.LatLngLiteral, name: string, color: string, title: string) {
      this.position = position;
      this.bubble.firstChild!.textContent = firstName(name);
      this.bubble.style.borderColor = color;
      this.root.title = title;
      this.draw();
    }

    getPosition() {
      return this.position;
    }

    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.root);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(this.position));
      if (!point) return;
      this.root.style.left = `${point.x}px`;
      this.root.style.top = `${point.y}px`;
    }

    onRemove() {
      this.root.remove();
    }
  }

  const pin = new DriverPinOverlay();
  pin.setMap(map);
  return pin;
}

export function DriverTrackingPage() {
  const portal = useContext(PortalContext);
  const isPlatformAdmin = portal.permissions.canAccessPlatform;

  const [drivers, setDrivers] = useState<DriverTrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [mapError, setMapError] = useState<string | null>(hayClaveDeMapas ? null : 'Falta la clave de Google Maps: se muestra solo la tabla.');
  const [showOffline, setShowOffline] = useState(false);
  // Los datos pueden llegar antes que el SDK: los marcadores se pintan cuando hay mapa.
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, DriverPin>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const fittedRef = useRef(false);
  const titlesRef = useRef<Map<string, string>>(new Map());

  // Ficha emergente con nombre completo y estado, encima de la moto.
  const openInfo = (driverId: string) => {
    const map = mapRef.current;
    const marker = markersRef.current.get(driverId);
    if (!map || !marker || !infoRef.current) return;
    infoRef.current.setContent(titlesRef.current.get(driverId) ?? '');
    infoRef.current.setPosition(marker.getPosition());
    infoRef.current.setOptions({ pixelOffset: new google.maps.Size(0, -70) });
    infoRef.current.open({ map });
  };

  const load = useCallback(async () => {
    const result = await driverTrackingService.fetch();
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setDrivers(result.data ?? []);
    setUpdatedAt(new Date());
  }, []);

  // Lectura inicial, refresco periodico y Realtime sobre la posicion.
  useEffect(() => {
    if (!isPlatformAdmin) return;
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    const channel = supabase
      .channel('admin-driver-tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_current_state' }, () => load())
      .subscribe();
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [isPlatformAdmin, load]);

  // El mapa se crea una vez.
  useEffect(() => {
    if (!isPlatformAdmin || !hayClaveDeMapas) return;
    let cancelled = false;
    cargarGoogleMaps()
      .then(() => {
        if (cancelled || !mapContainerRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 14,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        });
        infoRef.current = new google.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMapError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.');
      });
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      mapRef.current = null;
    };
  }, [isPlatformAdmin]);

  const visibleDrivers = useMemo(() => (showOffline ? drivers : drivers.filter((driver) => driver.state !== 'offline')), [drivers, showOffline]);

  // Sincronizar marcadores con los datos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const bounds = new google.maps.LatLngBounds();

    for (const driver of visibleDrivers) {
      if (driver.lat === null || driver.lng === null) continue;
      seen.add(driver.driver_id);
      const position = { lat: driver.lat, lng: driver.lng };
      bounds.extend(position);
      const meta = STATE_META[driver.state];
      const title = `${driver.name} · ${meta.label}`;
      let marker = markersRef.current.get(driver.driver_id);
      if (!marker) {
        const id = driver.driver_id;
        marker = createDriverPin(map, () => openInfo(id));
        markersRef.current.set(id, marker);
      }
      marker.setData(position, driver.name, meta.color, title);
      titlesRef.current.set(driver.driver_id, title);
    }

    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Se encuadra una sola vez; despues la vista es del usuario.
    if (!fittedRef.current && seen.size > 0) {
      fittedRef.current = true;
      if (seen.size === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, 60);
      }
    }
  }, [visibleDrivers, mapReady]);

  const focusDriver = (driver: DriverTrackingRecord) => {
    const map = mapRef.current;
    if (!map || driver.lat === null || driver.lng === null) return;
    map.panTo({ lat: driver.lat, lng: driver.lng });
    map.setZoom(16);
    openInfo(driver.driver_id);
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const counts = useMemo(() => {
    const result: Record<DriverTrackingState, number> = { idle_with_order: 0, idle: 0, moving: 0, available: 0, offline: 0 };
    for (const driver of drivers) result[driver.state] += 1;
    return result;
  }, [drivers]);

  if (!isPlatformAdmin) {
    return <div>El rastreo de repartidores es solo para el administrador general.</div>;
  }

  return (
    <AdminPageFrame
      title="Rastreo de repartidores"
      description={`Donde esta cada repartidor y si se esta moviendo. Se actualiza solo${updatedAt ? `; ultima lectura ${updatedAt.toLocaleTimeString('es-PE')}` : ''}.`}
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Reparto', to: AppRoutes.portal.admin.drivers },
        { label: 'Rastreo' },
      ]}
      contextItems={[]}
      actions={
        <button type="button" onClick={() => load()} className="btn btn--secondary btn--sm">
          Actualizar
        </button>
      }
    >
      {error ? <ErrorBanner message={error} /> : null}

      <div className="stat-grid" style={{ marginBottom: 0 }}>
        <AdminStatCard label="Detenidos con pedido" value={String(counts.idle_with_order)} icon="clock" tone="red" help={`Mas de ${IDLE_WITH_ORDER_MIN} min sin moverse.`} />
        <AdminStatCard label="Quietos sin pedido" value={String(counts.idle)} icon="clock" tone="orange" help={`Conectados, mas de ${IDLE_AVAILABLE_MIN} min en el mismo lugar.`} />
        <AdminStatCard label="En pedido" value={String(counts.moving)} icon="truck" tone="green" />
        <AdminStatCard label="Disponibles" value={String(counts.available)} icon="map-pin" tone="purple" />
        <AdminStatCard label="Sin señal" value={String(counts.offline)} icon="toggle-right" tone="neutral" />
      </div>

      <SectionCard
        title="Mapa"
        description="Rojo: detenido con pedido · Naranja: quieto · Verde: en pedido · Morado: disponible."
        actions={
          <label style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showOffline} onChange={(event) => setShowOffline(event.target.checked)} />
            Mostrar sin señal
          </label>
        }
      >
        {mapError ? (
          <div style={{ color: 'var(--acme-text-muted)', fontSize: '14px' }}>{mapError}</div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: 'min(60vh, 520px)', minHeight: '320px', borderRadius: '14px', overflow: 'hidden', background: 'var(--acme-surface-muted)' }} />
        )}
      </SectionCard>

      <SectionCard title="Repartidores" description="Primero los que necesitan atencion.">
        {loading ? (
          <SectionSkeleton lines={4} />
        ) : (
          <AdminDataTable
            rows={visibleDrivers}
            getRowId={(driver) => driver.driver_id}
            emptyMessage={showOffline ? 'No hay repartidores registrados.' : 'Ningun repartidor conectado ahora.'}
            columns={[
              {
                id: 'driver',
                header: 'Repartidor',
                render: (driver) => (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <Link to={AppRoutes.portal.admin.driverDetail.replace(':driverId', driver.driver_id)} style={{ fontWeight: 700, color: 'var(--acme-text)' }}>
                      {driver.name}
                    </Link>
                    {driver.phone ? (
                      <a href={`tel:${driver.phone}`} style={{ fontSize: '12.5px', color: 'var(--acme-purple)' }}>
                        {driver.phone}
                      </a>
                    ) : null}
                  </div>
                ),
              },
              {
                id: 'state',
                header: 'Estado',
                render: (driver) => <StatusPill label={STATE_META[driver.state].label} tone={STATE_META[driver.state].tone} />,
              },
              {
                id: 'order',
                header: 'Pedido',
                render: (driver) =>
                  driver.order_id ? (
                    <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', driver.order_id)} style={{ color: 'var(--acme-purple)', fontWeight: 700 }}>
                      #{driver.order_code}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--acme-text-faint)' }}>Sin pedido</span>
                  ),
              },
              { id: 'still', header: 'En el mismo lugar', render: (driver) => (driver.state === 'offline' ? '—' : formatMinutes(driver.still_for_min)) },
              { id: 'distance', header: 'Recorrido 30 min', align: 'right', render: (driver) => formatDistance(driver.distance_30_min_m) },
              { id: 'signal', header: 'Ultima señal', render: (driver) => (driver.signal_age_min === null ? 'Nunca' : `hace ${formatMinutes(driver.signal_age_min)}`) },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '120px',
                render: (driver) =>
                  driver.lat !== null && driver.lng !== null && !mapError ? (
                    <button type="button" onClick={() => focusDriver(driver)} className="btn btn--ghost btn--sm">
                      Ver en mapa
                    </button>
                  ) : null,
              },
            ]}
          />
        )}
      </SectionCard>
    </AdminPageFrame>
  );
}
