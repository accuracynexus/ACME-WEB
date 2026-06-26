import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import {
  CourierCulqiOrderResponse,
  CourierGeocodeSearchResult,
  CourierQuoteResponse,
  courierPaymentService,
} from '../../../core/services/courierPaymentService';
import { CustomerAddressForm, publicCustomerService } from '../../../core/services/publicCustomerService';
import { supabase } from '../../../integrations/supabase/client';
import { usePublicStore } from '../store/PublicStoreContext';

type FulfillmentType = 'delivery' | 'pickup';
type CourierZoneSelection = 'auto' | 'A' | 'B' | 'C' | 'D';
type CourierServiceType = 'normal' | 'express' | 'scheduled';
type TipOption = 0 | 1 | 2 | 'custom';
type GeoPoint = { lat: number; lng: number };
type LeafletApi = any;
type RouteTrace = {
  coordinates: GeoPoint[];
  distanceKm: number | null;
  durationMin: number | null;
  source: 'none' | 'road' | 'direct';
  error?: string | null;
};

declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      token?: { id: string };
      order?: { id?: string; payment_code?: string; state?: string };
      error?: { user_message?: string; merchant_message?: string };
      settings: (config: Record<string, unknown>) => void;
      options: (config: Record<string, unknown>) => void;
      open: () => void;
      close?: () => void;
    };
    culqi?: () => void;
    L?: LeafletApi;
  }
}

const CULQI_SCRIPT_ID = 'culqi-checkout-v4';
const LEAFLET_SCRIPT_ID = 'leaflet-map';
const LEAFLET_CSS_ID = 'leaflet-map-css';
const CULQI_SANDBOX_YAPE_PHONE = '900000001';
const CULQI_SANDBOX_YAPE_LABEL = '900 000 001';
const TIP_PRESETS = [0, 1, 2] as const; // S/0, S/1, S/2
const QUOTE_TTL_MS = 4.5 * 60 * 1000; // 4.5 min (expires_at es 5 min)
const DEFAULT_ROUTING_API_URL = 'https://router.project-osrm.org';
const ROUTING_API_URL = String(import.meta.env.VITE_ROUTING_API_URL || DEFAULT_ROUTING_API_URL).replace(/\/+$/, '');
let culqiScriptPromise: Promise<void> | null = null;
let leafletScriptPromise: Promise<void> | null = null;

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function loadCulqiScript() {
  if (window.Culqi) return Promise.resolve();
  if (culqiScriptPromise) return culqiScriptPromise;

  culqiScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(CULQI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Culqi Checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = CULQI_SCRIPT_ID;
    script.src = 'https://checkout.culqi.com/js/v4';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      culqiScriptPromise = null;
      reject(new Error('No se pudo cargar Culqi Checkout.'));
    };
    document.body.appendChild(script);
  });

  return culqiScriptPromise;
}

function loadLeafletScript() {
  if (window.L) return Promise.resolve();
  if (leafletScriptPromise) return leafletScriptPromise;

  leafletScriptPromise = new Promise<void>((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar el mapa.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      leafletScriptPromise = null;
      reject(new Error('No se pudo cargar el mapa.'));
    };
    document.body.appendChild(script);
  });

  return leafletScriptPromise;
}

function calculateDistanceKm(origin: GeoPoint, destination: GeoPoint) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeCoordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoordinate(point: GeoPoint) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

async function fetchRoadRoute(origin: GeoPoint, destination: GeoPoint, signal?: AbortSignal): Promise<RouteTrace> {
  const url = new URL(
    `${ROUTING_API_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  );
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Router devolvio HTTP ${response.status}`);
  }

  const data = await response.json();
  const route = data?.routes?.[0];
  const rawCoordinates = route?.geometry?.coordinates;
  if (data?.code !== 'Ok' || !route || !Array.isArray(rawCoordinates) || rawCoordinates.length === 0) {
    throw new Error('El router no encontro una ruta vial.');
  }

  return {
    coordinates: rawCoordinates.map((item: [number, number]) => ({ lng: Number(item[0]), lat: Number(item[1]) })),
    distanceKm: Number.isFinite(Number(route.distance)) ? roundTo(Number(route.distance) / 1000, 2) : null,
    durationMin: Number.isFinite(Number(route.duration)) ? Math.max(1, Math.round(Number(route.duration) / 60)) : null,
    source: 'road',
    error: null,
  };
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function createRouteIcon(color: string, label: string) {
  const L = window.L;
  if (!L) return undefined;

  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:999px;background:${color};color:white;display:grid;place-items:center;font-size:12px;font-weight:900;border:3px solid white;box-shadow:0 10px 24px rgba(17,24,39,.24);">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

function createEmptyAddress(): CustomerAddressForm {
  return {
    label: 'Casa',
    is_default: true,
    line1: '',
    line2: '',
    reference: '',
    district: '',
    city: 'Huancavelica',
    region: 'Huancavelica',
    country: 'Peru',
  };
}

// ─── Línea del resumen ─────────────────────────────────────────────────────────
function SummaryRow({ label, value, highlight, muted, small }: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: muted ? 'var(--acme-text-muted)' : undefined, fontSize: small ? '13px' : undefined }}>{label}</span>
      <strong style={{ color: highlight ? 'var(--acme-purple)' : undefined, fontSize: highlight ? '1.1rem' : small ? '13px' : undefined }}>
        {value}
      </strong>
    </div>
  );
}

function DeliveryRouteMap({
  origin,
  originLabel,
  destination,
  routeTrace,
  routeLoading,
  reverseLoading,
  locationLoading,
  onUseCurrentLocation,
  onDestinationChange,
}: {
  origin: GeoPoint;
  originLabel: string;
  destination: GeoPoint | null;
  routeTrace: RouteTrace;
  routeLoading: boolean;
  reverseLoading: boolean;
  locationLoading: boolean;
  onUseCurrentLocation: () => void;
  onDestinationChange: (point: GeoPoint) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletApi | null>(null);
  const originMarkerRef = useRef<LeafletApi | null>(null);
  const destinationMarkerRef = useRef<LeafletApi | null>(null);
  const routeLineRef = useRef<LeafletApi | null>(null);
  const onDestinationChangeRef = useRef(onDestinationChange);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onDestinationChangeRef.current = onDestinationChange;
  }, [onDestinationChange]);

  const syncMap = useCallback(() => {
    const L = window.L;
    const map = leafletMapRef.current;
    if (!L || !map) return;

    const originLatLng: [number, number] = [origin.lat, origin.lng];
    const routeLatLngs: [number, number][] =
      routeTrace.coordinates.length > 1
        ? routeTrace.coordinates.map((point) => [point.lat, point.lng])
        : destination
          ? [originLatLng, [destination.lat, destination.lng]]
          : [];

    if (!originMarkerRef.current) {
      originMarkerRef.current = L.marker(originLatLng, {
        icon: createRouteIcon('#ff6200', 'O'),
        interactive: false,
      }).addTo(map);
    } else {
      originMarkerRef.current.setLatLng(originLatLng);
    }
    originMarkerRef.current.bindTooltip(originLabel || 'Tienda', {
      direction: 'top',
      offset: [0, -12],
      opacity: 0.95,
    });

    if (!destination) {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      map.setView(originLatLng, 15);
      return;
    }

    const destinationLatLng: [number, number] = [destination.lat, destination.lng];
    if (!destinationMarkerRef.current) {
      const marker = L.marker(destinationLatLng, {
        draggable: true,
        autoPan: true,
        riseOnHover: true,
        zIndexOffset: 1000,
        icon: createRouteIcon('#4d148c', 'D'),
      }).addTo(map);
      marker.on('dragend', () => {
        const next = marker.getLatLng();
        onDestinationChangeRef.current({ lat: next.lat, lng: next.lng });
      });
      destinationMarkerRef.current = marker;
    } else {
      destinationMarkerRef.current.setLatLng(destinationLatLng);
    }
    destinationMarkerRef.current.bindTooltip('Destino', {
      direction: 'top',
      offset: [0, -12],
      opacity: 0.95,
    });

    if (!routeLineRef.current) {
      routeLineRef.current = L.polyline(routeLatLngs, {
        color: routeTrace.source === 'road' ? '#4d148c' : '#f59e0b',
        weight: routeTrace.source === 'road' ? 6 : 4,
        opacity: routeTrace.source === 'road' ? 0.9 : 0.72,
        dashArray: routeTrace.source === 'road' ? undefined : '10 8',
      }).addTo(map);
    } else {
      routeLineRef.current.setLatLngs(routeLatLngs);
      routeLineRef.current.setStyle({
        color: routeTrace.source === 'road' ? '#4d148c' : '#f59e0b',
        weight: routeTrace.source === 'road' ? 6 : 4,
        opacity: routeTrace.source === 'road' ? 0.9 : 0.72,
        dashArray: routeTrace.source === 'road' ? undefined : '10 8',
      });
    }

    const bounds = L.latLngBounds(routeLatLngs.length > 0 ? routeLatLngs : [originLatLng, destinationLatLng]).pad(0.28);
    map.fitBounds(bounds, { maxZoom: 16, animate: false });
  }, [destination, origin.lat, origin.lng, originLabel, routeTrace.coordinates, routeTrace.source]);

  useEffect(() => {
    let cancelled = false;

    void loadLeafletScript()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.L) return;

        const L = window.L;
        if (!leafletMapRef.current) {
          const map = L.map(mapElementRef.current, {
            zoomControl: false,
            scrollWheelZoom: true,
          }).setView([origin.lat, origin.lng], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap',
          }).addTo(map);
          L.control.zoom({ position: 'bottomright' }).addTo(map);
          map.on('click', (event: LeafletApi) => {
            onDestinationChangeRef.current({
              lat: event.latlng.lat,
              lng: event.latlng.lng,
            });
          });
          leafletMapRef.current = map;
        }

        leafletMapRef.current.invalidateSize();
        syncMap();
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [origin.lat, origin.lng, syncMap]);

  useEffect(() => {
    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div style={{ position: 'relative' }}>
        <div
          ref={mapElementRef}
          style={{
            width: '100%',
            minHeight: '360px',
            border: '1px solid #dbe4ef',
            borderRadius: '18px',
            overflow: 'hidden',
            background: '#eef2f7',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.65)',
          }}
        />
        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', zIndex: 500 }}>
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={locationLoading}
            style={{
              border: '1px solid #dbe4ef',
              background: '#fff',
              color: '#111827',
              borderRadius: '12px',
              padding: '9px 12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: locationLoading ? 'wait' : 'pointer',
              boxShadow: '0 10px 22px rgba(17,24,39,.12)',
            }}
          >
            {locationLoading ? 'Ubicando...' : 'Mi ubicacion'}
          </button>
        </div>
      </div>
      <div className="account-alert account-alert--warning">
        Se cobra el tramo real desde el local hasta tu punto de entrega. La tarifa combina ruta por calles, zona urbana, subida/acceso, peso y tipo de servicio.
      </div>
      <div style={{ color: '#6b7280', fontSize: '12px', lineHeight: 1.5 }}>
        Usa <strong>Mi ubicacion</strong>, haz click en el mapa o arrastra el marcador morado hasta la puerta o referencia mas cercana.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px 12px', display: 'grid', gap: '3px', minWidth: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Origen</span>
          <strong style={{ fontSize: '12px', color: '#111827', overflowWrap: 'anywhere' }}>{originLabel || 'Tienda'}</strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px 12px', display: 'grid', gap: '3px', minWidth: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Destino</span>
          <strong style={{ fontSize: '12px', color: destination ? '#111827' : '#b45309', overflowWrap: 'anywhere' }}>
            {destination ? formatCoordinate(destination) : 'Pendiente'}
          </strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px 12px', display: 'grid', gap: '3px', minWidth: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Distancia</span>
          <strong style={{ fontSize: '12px', color: '#111827' }}>
            {routeTrace.distanceKm !== null ? `${routeTrace.distanceKm.toFixed(2)} km` : 'Sin punto'}
          </strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px 12px', display: 'grid', gap: '3px', minWidth: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Ruta</span>
          <strong style={{ fontSize: '12px', color: '#111827' }}>
            {routeLoading
              ? 'Trazando...'
              : routeTrace.source === 'road'
                ? `Por calles${routeTrace.durationMin ? ` · ${routeTrace.durationMin} min` : ''}`
                : routeTrace.source === 'direct'
                  ? 'Directa'
                  : 'Pendiente'}
          </strong>
        </div>
      </div>
      {reverseLoading && <div className="account-alert account-alert--warning">Buscando direccion del punto...</div>}
      {routeTrace.error && <div className="account-alert account-alert--warning">{routeTrace.error}</div>}
      {mapError && <div className="account-alert account-alert--warning">{mapError}</div>}
    </div>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const publicStore = usePublicStore();

  // Entrega
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('delivery');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressForm, setAddressForm] = useState<CustomerAddressForm>(createEmptyAddress());
  const [courierZone, setCourierZone] = useState<CourierZoneSelection>('auto');
  const [packageWeight, setPackageWeight] = useState('1');
  const [courierServiceType, setCourierServiceType] = useState<CourierServiceType>('normal');
  const [isDifficultZone, setIsDifficultZone] = useState(false);
  const [isOutOfCity, setIsOutOfCity] = useState(false);
  const [waitOrSecondVisit, setWaitOrSecondVisit] = useState(false);
  const [branchPoint, setBranchPoint] = useState<GeoPoint | null>(null);
  const [branchLabel, setBranchLabel] = useState('');
  const [branchLocationLoading, setBranchLocationLoading] = useState(false);
  const [branchLocationError, setBranchLocationError] = useState<string | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<GeoPoint | null>(null);
  const [routeTrace, setRouteTrace] = useState<RouteTrace>({
    coordinates: [],
    distanceKm: null,
    durationMin: null,
    source: 'none',
    error: null,
  });
  const [routeLoading, setRouteLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSearchResults, setAddressSearchResults] = useState<CourierGeocodeSearchResult[]>([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const selectedAddressLabelRef = useRef('');

  // Propina
  const [tipOption, setTipOption] = useState<TipOption>(0);
  const [customTip, setCustomTip] = useState('');
  const tipAmount = tipOption === 'custom' ? Math.max(0, parseFloat(customTip) || 0) : tipOption;

  // Cotización
  const [quote, setQuote] = useState<CourierQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteExpiredAt, setQuoteExpiredAt] = useState<number | null>(null);

  // Pago
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const isAccountValidated = Boolean(publicStore.sessionUser?.email_confirmed_at);
  const customerEmail = (publicStore.sessionUser?.email || publicStore.profile?.email || '').trim() || undefined;
  const culqiPublicKey = String(import.meta.env.VITE_CULQI_PUBLIC_KEY || '').trim();
  const isCulqiSandbox = culqiPublicKey.startsWith('pk_test');
  const firstItem = publicStore.cartItems[0];

  // Pre-fill recipient from profile
  useEffect(() => {
    if (publicStore.profile) {
      setRecipientName((c) => c || publicStore.profile?.full_name || '');
      setRecipientPhone((c) => c || publicStore.profile?.phone || '');
    }
  }, [publicStore.profile]);

  // Cleanup Culqi on unmount
  useEffect(() => {
    return () => { window.culqi = undefined; };
  }, []);

  // Cargar script de Culqi en background
  useEffect(() => {
    if (!culqiPublicKey || publicStore.cartItems.length === 0) return;
    void loadCulqiScript().catch(() => undefined);
  }, [culqiPublicKey, publicStore.cartItems.length]);

  // Auto-expirar cotización
  useEffect(() => {
    if (!quoteExpiredAt) return;
    const remaining = quoteExpiredAt - Date.now();
    if (remaining <= 0) { invalidateQuote(); return; }
    const timer = setTimeout(() => {
      invalidateQuote();
      setQuoteError('La cotización expiró. Solicita una nueva para continuar.');
    }, remaining);
    return () => clearTimeout(timer);
  }, [quoteExpiredAt]);

  const invalidateQuote = useCallback(() => {
    setQuote(null);
    setQuoteExpiredAt(null);
    setPendingOrderId(null);
    setPaymentMessage(null);
    setCheckoutError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setBranchPoint(null);
    setDestinationPoint(null);
    setRouteTrace({ coordinates: [], distanceKm: null, durationMin: null, source: 'none', error: null });
    setBranchLocationError(null);
    setBranchLabel(firstItem?.branch_name || '');

    if (!firstItem?.branch_id) {
      setBranchLocationLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBranchLocationLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('merchant_branches')
          .select('id, name, lat, lng')
          .eq('id', firstItem.branch_id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          setBranchLocationError('No se pudo leer la ubicacion del local.');
          return;
        }

        const lat = normalizeCoordinate((data as { lat?: unknown } | null)?.lat);
        const lng = normalizeCoordinate((data as { lng?: unknown } | null)?.lng);
        const name = String((data as { name?: unknown } | null)?.name || firstItem.branch_name || 'Sucursal');
        setBranchLabel(name);

        if (lat === null || lng === null) {
          setBranchLocationError('Este local todavia no tiene coordenadas.');
          return;
        }

        setBranchPoint({ lat, lng });
      } catch {
        if (!cancelled) setBranchLocationError('No se pudo leer la ubicacion del local.');
      } finally {
        if (!cancelled) setBranchLocationLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firstItem?.branch_id, firstItem?.branch_name]);

  const handleDestinationChange = useCallback((point: GeoPoint) => {
    invalidateQuote();
    setGeolocationError(null);
    setDestinationPoint(point);
  }, [invalidateQuote]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeolocationError('Tu navegador no permite obtener ubicacion.');
      return;
    }

    setGeolocationLoading(true);
    setGeolocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleDestinationChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeolocationLoading(false);
      },
      () => {
        setGeolocationError('No se pudo obtener tu ubicacion. Revisa permisos del navegador.');
        setGeolocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [handleDestinationChange]);

  const applyAddressCandidate = useCallback((candidate: CourierGeocodeSearchResult) => {
    invalidateQuote();
    selectedAddressLabelRef.current = candidate.label;
    setAddressSearch(candidate.label);
    setAddressSearchResults([]);
    setAddressSearchError(null);
    setDestinationPoint({ lat: candidate.lat, lng: candidate.lng });
    setAddressForm((current) => ({
      ...current,
      line1: candidate.line1 || current.line1,
      district: candidate.district || current.district,
      city: candidate.city || current.city || 'Huancavelica',
      region: candidate.region || current.region || 'Huancavelica',
      country: candidate.country || current.country || 'Peru',
    }));
  }, [invalidateQuote]);

  useEffect(() => {
    const query = addressSearch.trim();
    if (fulfillmentType !== 'delivery' || query.length < 3 || query === selectedAddressLabelRef.current) {
      setAddressSearchResults([]);
      setAddressSearchLoading(false);
      setAddressSearchError(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setAddressSearchLoading(true);
      setAddressSearchError(null);
      void courierPaymentService.searchAddresses(query)
        .then((results) => {
          if (!active) return;
          setAddressSearchResults(results);
          setAddressSearchError(results.length === 0 ? 'No encontramos coincidencias en Huancavelica.' : null);
        })
        .catch((err) => {
          if (!active) return;
          setAddressSearchResults([]);
          setAddressSearchError(err instanceof Error ? err.message : 'No se pudo buscar la direccion.');
        })
        .finally(() => {
          if (active) setAddressSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [addressSearch, fulfillmentType]);

  useEffect(() => {
    if (!branchPoint || !destinationPoint) {
      setRouteTrace({ coordinates: [], distanceKm: null, durationMin: null, source: 'none', error: null });
      setRouteLoading(false);
      return;
    }

    const directDistanceKm = roundTo(calculateDistanceKm(branchPoint, destinationPoint), 2);
    const fallbackRoute: RouteTrace = {
      coordinates: [branchPoint, destinationPoint],
      distanceKm: directDistanceKm,
      durationMin: null,
      source: 'direct',
      error: 'No se pudo trazar ruta por calles; se muestra distancia directa de respaldo.',
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);

    setRouteLoading(true);
    setRouteTrace({ ...fallbackRoute, error: null });

    void fetchRoadRoute(branchPoint, destinationPoint, controller.signal)
      .then((trace) => {
        setRouteTrace(trace);
      })
      .catch(() => {
        setRouteTrace(fallbackRoute);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setRouteLoading(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [branchPoint, destinationPoint]);

  useEffect(() => {
    if (!destinationPoint) {
      setReverseLoading(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setReverseLoading(true);
      void courierPaymentService.reverseGeocode(destinationPoint.lat, destinationPoint.lng)
        .then((result) => {
          if (!active) return;
          if (!result) return;
          setAddressForm((current) => ({
            ...current,
            line1: result.line1 || current.line1,
            district: result.district || current.district,
            city: result.city || current.city || 'Huancavelica',
            region: result.region || current.region || 'Huancavelica',
            country: result.country || current.country || 'Peru',
          }));
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setReverseLoading(false);
        });
    }, 650);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [destinationPoint]);

  const hasDeliveryAddress = fulfillmentType === 'pickup' || (addressForm.line1.trim() && addressForm.city.trim());
  const hasRoutePoint =
    fulfillmentType !== 'delivery' ||
    (!branchLocationLoading && (!branchPoint || Boolean(destinationPoint)));

  const canRequestQuote =
    publicStore.cartItems.length > 0 &&
    publicStore.sessionUser &&
    isAccountValidated &&
    recipientName.trim() &&
    recipientPhone.trim() &&
    hasDeliveryAddress &&
    hasRoutePoint;

  const canCheckout = canRequestQuote && quote !== null;

  // ─── Solicitar cotización al backend ────────────────────────────────────────
  const handleRequestQuote = async () => {
    if (!publicStore.sessionUser || publicStore.cartItems.length === 0) return;
    if (fulfillmentType === 'delivery' && branchPoint && !destinationPoint) {
      setQuoteError('Marca el punto de entrega en el mapa para calcular la ruta.');
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);
    setPendingOrderId(null);
    setPaymentMessage(null);
    setCheckoutError(null);

    try {
      const result = await courierPaymentService.createQuote({
        branch_id: firstItem.branch_id,
        payment_method: 'card',
        tip_amount: tipAmount,
        latitude: destinationPoint?.lat ?? null,
        longitude: destinationPoint?.lng ?? null,
        fulfillment_type: fulfillmentType,
        zone: courierZone === 'auto' ? undefined : courierZone,
        weight_kg: Math.max(0, Number(packageWeight) || 1),
        service_type: courierServiceType,
        is_difficult_zone: isDifficultZone,
        is_out_of_city: isOutOfCity || courierZone === 'D',
        wait_or_second_visit: waitOrSecondVisit,
        items: publicStore.cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          modifier_ids: item.modifiers.map((m) => m.option_id),
        })),
      });

      setQuote(result);
      setQuoteExpiredAt(Date.now() + QUOTE_TTL_MS);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'No se pudo obtener la cotización.');
    } finally {
      setQuoteLoading(false);
    }
  };

  // ─── Callback de Culqi ──────────────────────────────────────────────────────
  const handleCulqiCallback = async (orderId: string, culqiOrder: CourierCulqiOrderResponse) => {
    const currentCulqi = window.Culqi;

    if (currentCulqi?.token?.id) {
      const token = currentCulqi.token.id;
      currentCulqi.close?.();
      setSubmitting(true);
      setCheckoutError(null);
      setPaymentMessage('Validando pago con Culqi...');

      try {
        const result = await courierPaymentService.charge({
          order_id: orderId,
          payment_id: culqiOrder.payment_id,
          token,
          email_cliente: customerEmail,
          nombre_cliente: recipientName,
        });

        if (!result.exito) {
          setCheckoutError(result.mensaje || 'Culqi no confirmó el pago.');
          setPaymentMessage(`Pedido #${orderId.slice(-6)} creado con pago pendiente.`);
          setPaymentStatus('failed');
          return;
        }

        // Pago exitoso — limpiar carrito y redirigir
        setPaymentStatus('paid');
        finishCheckout(orderId);
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'No se pudo confirmar el pago con Culqi.');
        setPaymentMessage(`Pedido creado con pago pendiente.`);
        setPaymentStatus('pending');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (currentCulqi?.order) {
      currentCulqi.close?.();
      setPaymentMessage('Pago iniciado en Culqi. El pedido queda pendiente hasta la confirmación del proveedor.');
      setPaymentStatus('pending');
      return;
    }

    const message =
      currentCulqi?.error?.user_message ||
      currentCulqi?.error?.merchant_message ||
      'Culqi no generó una respuesta de pago.';
    currentCulqi?.close?.();
    setCheckoutError(message);
    setPaymentMessage(`Pedido creado con pago pendiente.`);
    setPaymentStatus('pending');
    setSubmitting(false);
  };

  const finishCheckout = (orderId: string) => {
    window.Culqi?.close?.();
    window.culqi = undefined;
    publicStore.clearCart();
    navigate(`${AppRoutes.public.account}?tab=orders&orderId=${orderId}`);
  };

  // ─── Abrir Culqi para un pedido ya creado ────────────────────────────────────
  const openCulqiForOrder = async (orderId: string) => {
    const culqiRsaId = String(import.meta.env.VITE_CULQI_RSA_ID || '').trim();
    const culqiRsaPublicKey = String(import.meta.env.VITE_CULQI_RSA_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
    const canUseCardPayment = Boolean(culqiRsaId && culqiRsaPublicKey);

    if (!culqiPublicKey) {
      setCheckoutError('Falta VITE_CULQI_PUBLIC_KEY en el frontend.');
      return;
    }
    if (!customerEmail) {
      setCheckoutError('Tu cuenta no tiene un email válido para Culqi.');
      return;
    }
    if (!quote) {
      setCheckoutError('No hay cotización vigente. Solicita una nueva.');
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setPaymentMessage('Creando orden segura Culqi...');

    try {
      await loadCulqiScript();
      const culqi = window.Culqi;
      if (!culqi) throw new Error('Culqi Checkout no está disponible.');

      // Crear orden Culqi usando el order_id del backend
      const culqiOrder = await courierPaymentService.createCheckoutOrder({
        order_id: orderId,
        email_cliente: customerEmail,
        nombre_cliente: recipientName,
        telefono_cliente: isCulqiSandbox ? CULQI_SANDBOX_YAPE_PHONE : recipientPhone,
        descripcion: `Pedido ACME #${orderId.slice(-6)}`,
      });

      window.culqi = () => {
        void handleCulqiCallback(orderId, culqiOrder);
      };

      culqi.publicKey = culqiPublicKey;
      const culqiSettings: Record<string, unknown> = {
        title: 'ACME Pedidos',
        currency: 'PEN',
        amount: culqiOrder.monto_centimos, // Viene del backend — orders.total * 100
        order: culqiOrder.order_id,
      };
      if (canUseCardPayment) {
        culqiSettings.xculqirsaid = culqiRsaId;
        culqiSettings.rsapublickey = culqiRsaPublicKey;
      }

      culqi.settings(culqiSettings);
      culqi.options({
        lang: 'es',
        installments: false,
        paymentMethods: {
          tarjeta: canUseCardPayment,
          yape: true,
          bancaMovil: true,
          agente: true,
          billetera: true,
          cuotealo: true,
        },
        style: {
          buttonBackground: '#ff6200',
          buttonText: 'Pagar',
          buttonTextColor: '#ffffff',
          priceColor: '#111827',
        },
      });
      culqi.open();
      setPaymentMessage(
        [
          canUseCardPayment
            ? 'Checkout Culqi abierto. Completa el pago en la ventana segura.'
            : 'Checkout abierto. Usa Yape, PagoEfectivo o billeteras.',
          isCulqiSandbox ? `Modo sandbox: Yape → ${CULQI_SANDBOX_YAPE_LABEL} + cualquier código de 6 dígitos.` : '',
        ].filter(Boolean).join(' ')
      );
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo abrir Culqi.');
      setPaymentMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Flujo principal de checkout ────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!publicStore.sessionUser || !quote) return;

    // Si ya hay un pedido pendiente, reintentar el pago
    if (pendingOrderId) {
      await openCulqiForOrder(pendingOrderId);
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setPaymentMessage('Creando tu pedido...');

    try {
      // FASE 2: Crear pedido en el backend a partir del quote_id
      const orderResult = await courierPaymentService.createOrder({
        quote_id: quote.quote_id,
        fulfillment_type: fulfillmentType,
        special_instructions: specialInstructions || undefined,
        recipient_name: recipientName || undefined,
        recipient_phone: recipientPhone || undefined,
        address:
          fulfillmentType === 'delivery'
            ? {
                line1: addressForm.line1,
                line2: addressForm.line2 || undefined,
                reference: addressForm.reference || undefined,
                district: addressForm.district || undefined,
                city: addressForm.city || undefined,
                region: addressForm.region || undefined,
                country: addressForm.country || 'Peru',
                lat: destinationPoint?.lat ?? undefined,
                lng: destinationPoint?.lng ?? undefined,
              }
            : undefined,
      });

      const orderId = orderResult.order_id;
      setPendingOrderId(orderId);
      setSubmitting(false);

      // FASE 3: Abrir Culqi con el total que viene del backend
      await openCulqiForOrder(orderId);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
      setPaymentMessage(null);
      setSubmitting(false);
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────

  // Resumen de la cotización activa (o subtotal referencial del carrito)
  const cartSubtotal = publicStore.cartSubtotal;
  const activeQuote = quote;
  const addressSearchQuery = addressSearch.trim();
  const addressSearchStatus = addressSearchLoading
    ? 'Buscando...'
    : addressSearchQuery.length >= 3 && addressSearchQuery !== selectedAddressLabelRef.current
      ? addressSearchResults.length > 0
        ? `${addressSearchResults.length} resultados`
        : 'Activo'
      : 'Activo';

  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '108px 24px 56px',
        background:
          'radial-gradient(900px 320px at -10% 0%, rgba(77,20,140,.10), transparent 55%), radial-gradient(820px 360px at 105% 10%, rgba(255,98,0,.10), transparent 55%), #f7f7fb',
      }}
    >
      <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'grid', gap: '24px' }}>
        <section style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#ff6200' }}>Confirmación de Pedido</div>
            <h1 style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#1d1630' }}>Tu carrito</h1>
            <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.7, maxWidth: '760px' }}>
              Revisa tus productos, elige la propina y confirma los datos de entrega. El precio final lo calcula nuestro sistema.
            </p>
          </div>
          <Link to={AppRoutes.public.marketplace} className="btn-secondary" style={{ textDecoration: 'none' }}>
            Seguir comprando
          </Link>
        </section>

        {publicStore.cartItems.length === 0 ? (
          <div style={{ padding: '48px', borderRadius: '30px', background: '#fff', boxShadow: '0 16px 42px rgba(17,24,39,.06)', display: 'grid', gap: '16px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem' }}>Tu carrito está vacío.</strong>
            <span style={{ color: '#6b7280' }}>Explora locales y elige tus productos favoritos.</span>
            <div>
              <Link to={AppRoutes.public.marketplace} className="btn-primary" style={{ textDecoration: 'none' }}>
                Ver negocios
              </Link>
            </div>
          </div>
        ) : (
          <div className="cart-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: '24px', alignItems: 'start' }}>
            {/* ─── Columna izquierda ─── */}
            <div style={{ display: 'grid', gap: '24px' }}>

              {/* Productos */}
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Productos en el carrito</h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {publicStore.cartItems.map((item) => (
                    <div key={item.id} style={{ borderRadius: '22px', border: '1px solid #ecebf5', padding: '18px', display: 'grid', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
                        <div style={{ display: 'grid', gap: '4px' }}>
                          <strong style={{ fontSize: '15px' }}>{item.product_name}</strong>
                          <span style={{ color: '#6b7280', fontSize: '13px' }}>{item.merchant_name} · {item.branch_name}</span>
                          {item.modifiers.length > 0 && (
                            <span style={{ color: '#6b7280', fontSize: '13px' }}>
                              {item.modifiers.map((m) => m.name).join(', ')}
                            </span>
                          )}
                        </div>
                        <strong style={{ color: 'var(--acme-purple)', whiteSpace: 'nowrap' }}>
                          {formatMoney((item.unit_price + item.modifiers.reduce((s, m) => s + m.price_delta * m.quantity, 0)) * item.quantity)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
                          <button type="button" onClick={() => { invalidateQuote(); publicStore.updateItemQuantity(item.id, Math.max(1, item.quantity - 1)); }} style={{ border: 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer' }}>−</button>
                          <strong style={{ minWidth: '40px', textAlign: 'center' }}>{item.quantity}</strong>
                          <button type="button" onClick={() => { invalidateQuote(); publicStore.updateItemQuantity(item.id, item.quantity + 1); }} style={{ border: 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer' }}>+</button>
                        </div>
                        <input
                          className="account-input"
                          value={item.notes}
                          onChange={(e) => publicStore.updateItemNotes(item.id, e.target.value)}
                          placeholder="Notas especiales"
                          style={{ flex: 1, minWidth: '180px', paddingLeft: '16px' }}
                        />
                        <button type="button" className="btn-secondary" onClick={() => { invalidateQuote(); publicStore.removeItem(item.id); }} style={{ padding: '10px 16px', fontSize: '13px', color: '#ef4444', borderColor: '#fee2e2' }}>
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Datos de entrega */}
              {publicStore.sessionUser ? (
                <section className="account-card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Entrega y contacto</h2>
                  {!isAccountValidated && (
                    <div className="account-alert account-alert--warning" style={{ marginBottom: '20px' }}>
                      Debes validar tu correo electrónico antes de poder confirmar tu primer pedido.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button type="button" id="btn-fulfillment-delivery" className={`account-tab-btn ${fulfillmentType === 'delivery' ? 'account-tab-btn--active' : ''}`} onClick={() => { invalidateQuote(); setFulfillmentType('delivery'); }}>
                      Delivery
                    </button>
                    <button type="button" id="btn-fulfillment-pickup" className={`account-tab-btn ${fulfillmentType === 'pickup' ? 'account-tab-btn--active' : ''}`} onClick={() => { invalidateQuote(); setFulfillmentType('pickup'); }}>
                      Recojo en tienda
                    </button>
                  </div>

                  <div className="account-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="account-field">
                        <label className="account-label">Nombre de quien recibe</label>
                        <input id="input-recipient-name" className="account-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Juan Pérez" style={{ paddingLeft: '16px' }} />
                      </div>
                      <div className="account-field">
                        <label className="account-label">Teléfono</label>
                        <input id="input-recipient-phone" className="account-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="987 654 321" style={{ paddingLeft: '16px' }} />
                      </div>
                    </div>

                    {fulfillmentType === 'delivery' && (
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="account-field" style={{ position: 'relative' }}>
                          <label className="account-label">Busca tu dirección</label>
                          <input
                            id="input-address-search"
                            className="account-input"
                            value={addressSearch}
                            onChange={(event) => {
                              selectedAddressLabelRef.current = '';
                              setAddressSearch(event.target.value);
                            }}
                            placeholder="Escribe calle, avenida, barrio o lugar cercano"
                            autoComplete="off"
                            style={{ paddingLeft: '16px', paddingRight: '112px' }}
                          />
                          <span
                            aria-live="polite"
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '34px',
                              color: addressSearchLoading ? 'var(--acme-purple)' : '#047857',
                              background: addressSearchLoading ? 'rgba(77,20,140,.08)' : '#ecfdf5',
                              border: `1px solid ${addressSearchLoading ? 'rgba(77,20,140,.18)' : '#bbf7d0'}`,
                              borderRadius: '999px',
                              padding: '4px 9px',
                              fontSize: '11px',
                              fontWeight: 900,
                              pointerEvents: 'none',
                            }}
                          >
                            {addressSearchStatus}
                          </span>
                          {addressSearchResults.length > 0 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '72px',
                                left: 0,
                                right: 0,
                                zIndex: 700,
                                background: '#fff',
                                border: '1px solid #dbe4ef',
                                borderRadius: '14px',
                                boxShadow: '0 18px 38px rgba(17,24,39,.14)',
                                overflow: 'hidden',
                              }}
                            >
                              {addressSearchResults.map((candidate) => (
                                <button
                                  key={`${candidate.lat}-${candidate.lng}-${candidate.label}`}
                                  type="button"
                                  onClick={() => applyAddressCandidate(candidate)}
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    borderBottom: '1px solid #eef2f7',
                                    background: '#fff',
                                    padding: '12px 14px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    display: 'grid',
                                    gap: '3px',
                                  }}
                                >
                                  <strong style={{ color: '#111827', fontSize: '13px' }}>{candidate.label}</strong>
                                  <span style={{ color: '#6b7280', fontSize: '12px', lineHeight: 1.4 }}>
                                    {candidate.display_name || formatCoordinate({ lat: candidate.lat, lng: candidate.lng })}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          {addressSearchError && <div className="account-alert account-alert--warning">{addressSearchError}</div>}
                        </div>
                        <div className="account-field">
                          <label className="account-label">Dirección de entrega</label>
                          <input
                            id="input-address-line1"
                            className="account-input"
                            value={addressForm.line1}
                            onChange={(e) => { invalidateQuote(); setAddressForm({ ...addressForm, line1: e.target.value }); }}
                            placeholder="Calle y número, manzana/lote o nombre del lugar"
                            style={{ paddingLeft: '16px' }}
                          />
                        </div>
                        <div className="account-field">
                          <label className="account-label">Referencia para el repartidor</label>
                          <input
                            id="input-address-reference"
                            className="account-input"
                            value={addressForm.reference}
                            onChange={(e) => setAddressForm({ ...addressForm, reference: e.target.value })}
                            placeholder="Ej. puerta negra, segundo piso, frente a una botica"
                            style={{ paddingLeft: '16px' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                          <div className="account-field">
                            <label className="account-label">Distrito</label>
                            <input id="input-address-district" className="account-input" value={addressForm.district} onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Ciudad</label>
                            <input id="input-address-city" className="account-input" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Región</label>
                            <input id="input-address-region" className="account-input" value={addressForm.region} onChange={(e) => setAddressForm({ ...addressForm, region: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                        </div>
                        <div className="account-field">
                          <label className="account-label">Ruta desde el local</label>
                          {branchLocationLoading ? (
                            <div className="account-alert account-alert--warning">Cargando ubicacion del local...</div>
                          ) : branchPoint ? (
                            <DeliveryRouteMap
                              origin={branchPoint}
                              originLabel={branchLabel || firstItem.branch_name}
                              destination={destinationPoint}
                              routeTrace={routeTrace}
                              routeLoading={routeLoading}
                              reverseLoading={reverseLoading}
                              locationLoading={geolocationLoading}
                              onUseCurrentLocation={handleUseCurrentLocation}
                              onDestinationChange={handleDestinationChange}
                            />
                          ) : (
                            <div className="account-alert account-alert--warning">
                              {branchLocationError || 'Este local no tiene ubicacion georreferenciada.'}
                            </div>
                          )}
                          {geolocationError && <div className="account-alert account-alert--warning">{geolocationError}</div>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                          <div className="account-field">
                            <label className="account-label">Zona tarifaria</label>
                            <select
                              id="select-courier-zone"
                              className="account-input"
                              value={courierZone}
                              onChange={(e) => { invalidateQuote(); setCourierZone(e.target.value as CourierZoneSelection); setIsOutOfCity(e.target.value === 'D'); }}
                              style={{ paddingLeft: '16px' }}
                            >
                              <option value="auto">Auto</option>
                              <option value="A">Zona A - Centro</option>
                              <option value="B">Zona B - Urbana</option>
                              <option value="C">Zona C - Alta</option>
                              <option value="D">Zona D - Fuera</option>
                            </select>
                          </div>
                          <div className="account-field">
                            <label className="account-label">Peso aprox. kg</label>
                            <input
                              id="input-package-weight"
                              type="number"
                              min="0"
                              step="0.10"
                              className="account-input"
                              value={packageWeight}
                              onChange={(e) => { invalidateQuote(); setPackageWeight(e.target.value); }}
                              style={{ paddingLeft: '16px' }}
                            />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Servicio</label>
                            <select
                              id="select-courier-service"
                              className="account-input"
                              value={courierServiceType}
                              onChange={(e) => { invalidateQuote(); setCourierServiceType(e.target.value as CourierServiceType); }}
                              style={{ paddingLeft: '16px' }}
                            >
                              <option value="normal">Normal</option>
                              <option value="express">Express</option>
                              <option value="scheduled">Programado</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {[
                            {
                              id: 'input-difficult-zone',
                              label: 'Zona alta',
                              checked: isDifficultZone,
                              onChange: (checked: boolean) => setIsDifficultZone(checked),
                            },
                            {
                              id: 'input-out-city',
                              label: 'Fuera de ciudad',
                              checked: isOutOfCity,
                              onChange: (checked: boolean) => setIsOutOfCity(checked),
                            },
                            {
                              id: 'input-second-visit',
                              label: 'Espera/segunda visita',
                              checked: waitOrSecondVisit,
                              onChange: (checked: boolean) => setWaitOrSecondVisit(checked),
                            },
                          ].map((item) => (
                            <label key={item.id} htmlFor={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                              <input
                                id={item.id}
                                type="checkbox"
                                checked={item.checked}
                                onChange={(e) => { invalidateQuote(); item.onChange(e.target.checked); }}
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="account-field">
                      <label className="account-label">Instrucciones especiales</label>
                      <textarea
                        id="input-special-instructions"
                        className="account-input"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Nota para el repartidor o restaurante..."
                        style={{ minHeight: '80px', paddingTop: '12px', paddingLeft: '16px' }}
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <section className="account-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', border: '2px dashed var(--acme-border)', borderRadius: '32px' }}>
                  <div style={{ width: '72px', height: '72px', background: 'rgba(77,20,140,0.08)', color: 'var(--acme-purple)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <UserIcon />
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Acceso Requerido</h2>
                  <p style={{ color: 'var(--acme-text-muted)', maxWidth: '440px', margin: '0 auto 2rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
                    Para completar tu pedido, inicia sesión o crea una cuenta nueva.
                  </p>
                  <Link to={`${AppRoutes.public.account}?redirect=${encodeURIComponent(AppRoutes.public.cart)}`} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', padding: '16px 32px' }}>
                    Ingresar para completar pedido
                  </Link>
                </section>
              )}
            </div>

            {/* ─── Columna derecha: resumen y cotización ─── */}
            <aside style={{ position: 'sticky', top: '108px', display: 'grid', gap: '16px' }}>

              {/* Propina */}
              {publicStore.sessionUser && isAccountValidated && (
                <section className="account-card" style={{ padding: '20px' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Propina para el repartidor</h2>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: tipOption === 'custom' ? '12px' : 0 }}>
                    {TIP_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        id={`btn-tip-${t}`}
                        onClick={() => { setTipOption(t); invalidateQuote(); }}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: '12px',
                          border: `2px solid ${tipOption === t ? 'var(--acme-purple)' : '#e5e7eb'}`,
                          background: tipOption === t ? 'rgba(77,20,140,0.07)' : '#fff',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          color: tipOption === t ? 'var(--acme-purple)' : '#374151',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t === 0 ? 'Sin propina' : `S/ ${t}.00`}
                      </button>
                    ))}
                    <button
                      type="button"
                      id="btn-tip-custom"
                      onClick={() => { setTipOption('custom'); invalidateQuote(); }}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: '12px',
                        border: `2px solid ${tipOption === 'custom' ? 'var(--acme-purple)' : '#e5e7eb'}`,
                        background: tipOption === 'custom' ? 'rgba(77,20,140,0.07)' : '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        color: tipOption === 'custom' ? 'var(--acme-purple)' : '#374151',
                        transition: 'all 0.15s',
                      }}
                    >
                      Otro monto
                    </button>
                  </div>
                  {tipOption === 'custom' && (
                    <input
                      id="input-custom-tip"
                      type="number"
                      min="0"
                      step="0.50"
                      className="account-input"
                      value={customTip}
                      onChange={(e) => { setCustomTip(e.target.value); invalidateQuote(); }}
                      placeholder="S/ 0.00"
                      style={{ paddingLeft: '16px', width: '100%' }}
                    />
                  )}
                </section>
              )}

              {/* Resumen de precio */}
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Resumen</h2>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activeQuote ? (
                    /* Desglose completo de la cotización */
                    <>
                      <SummaryRow label="Subtotal productos" value={formatMoney(activeQuote.subtotal)} muted />
                      {activeQuote.discount > 0 && (
                        <SummaryRow label="Descuento" value={`-${formatMoney(activeQuote.discount)}`} muted small />
                      )}
                      <SummaryRow
                        label={`Tarifa de servicio (${(activeQuote.service_fee_rate * 100).toFixed(1)}%)`}
                        value={formatMoney(activeQuote.service_fee)}
                        muted
                        small
                      />
                      <SummaryRow
                        label={fulfillmentType === 'pickup' ? 'Recojo en tienda' : 'Envío'}
                        value={fulfillmentType === 'pickup' ? 'S/ 0.00' : formatMoney(activeQuote.delivery_fee)}
                        muted
                        small
                      />
                      {fulfillmentType === 'delivery' && activeQuote.distance_km !== null && activeQuote.distance_km !== undefined && (
                        <SummaryRow label="Tramo local-destino" value={`${Number(activeQuote.distance_km).toFixed(2)} km`} muted small />
                      )}
                      {fulfillmentType === 'delivery' && activeQuote.delivery_zone_label && (
                        <SummaryRow label={activeQuote.delivery_zone_label} value={activeQuote.delivery_detail || 'Tarifa courier'} muted small />
                      )}
                      {fulfillmentType === 'delivery' && (activeQuote.delivery_surcharges_total ?? 0) > 0 && (
                        <SummaryRow label="Recargos courier" value={formatMoney(activeQuote.delivery_surcharges_total ?? 0)} muted small />
                      )}
                      {activeQuote.tip_amount > 0 && (
                        <SummaryRow label="Propina repartidor" value={formatMoney(activeQuote.tip_amount)} muted small />
                      )}
                      <SummaryRow label="Base imponible" value={formatMoney(activeQuote.taxable_base ?? 0)} muted small />
                      <SummaryRow
                        label={`IGV/IPM incluido (${((activeQuote.igv_rate ?? 0.18) * 100).toFixed(1)}%)`}
                        value={formatMoney(activeQuote.igv_amount ?? 0)}
                        muted
                        small
                      />
                      <SummaryRow
                        label={`Comision Culqi (${((activeQuote.payment_processing_rate ?? 0) * 100).toFixed(2)}%)`}
                        value={formatMoney(activeQuote.payment_processing_fee ?? 0)}
                        muted
                        small
                      />
                      <div style={{ borderTop: '1px solid var(--acme-border)', paddingTop: '12px', marginTop: '4px' }}>
                        <SummaryRow label="Total a pagar" value={formatMoney(activeQuote.total)} highlight />
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', lineHeight: 1.5 }}>
                        Precio calculado por el servidor. CulqiOnline nacional: 3.44% + fijo referencial; comision inafecta a IGV.
                        {activeQuote.payment_processing_note ? ` ${activeQuote.payment_processing_note}` : ''}
                      </div>
                    </>
                  ) : (
                    /* Sin cotización: mostrar subtotal referencial */
                    <>
                      <SummaryRow label="Subtotal" value={formatMoney(cartSubtotal)} muted />
                      <SummaryRow label="Tarifa de servicio (3.6%)" value="—" muted small />
                      <SummaryRow label={fulfillmentType === 'pickup' ? 'Recojo en tienda' : 'Envío'} value="—" muted small />
                      <SummaryRow label="IGV/IPM incluido" value="—" muted small />
                      <SummaryRow label="Comision Culqi" value="—" muted small />
                      {tipAmount > 0 && <SummaryRow label="Propina" value={formatMoney(tipAmount)} muted small />}
                      <div style={{ borderTop: '1px solid var(--acme-border)', paddingTop: '12px', marginTop: '4px' }}>
                        <SummaryRow label="Total estimado" value="Solicita cotización" highlight={false} />
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        El precio final lo calcula el servidor
                      </div>
                    </>
                  )}
                </div>

                {/* Alertas */}
                {isCulqiSandbox && (
                  <div className="account-alert account-alert--warning" style={{ marginTop: '16px' }}>
                    Modo sandbox Culqi: para probar Yape usa {CULQI_SANDBOX_YAPE_LABEL} y cualquier código de 6 dígitos.
                  </div>
                )}
                {quoteError && <div className="account-alert account-alert--error" style={{ marginTop: '16px' }}>{quoteError}</div>}
                {checkoutError && <div className="account-alert account-alert--error" style={{ marginTop: '16px' }}>{checkoutError}</div>}
                {paymentMessage && (
                  <div className={`account-alert ${paymentStatus === 'paid' ? 'account-alert--success' : 'account-alert--warning'}`} style={{ marginTop: '16px' }}>
                    {paymentMessage}
                  </div>
                )}

                {/* Botones de acción */}
                {publicStore.sessionUser && (
                  <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
                    {/* Botón: Solicitar cotización */}
                    {!pendingOrderId && (
                      <button
                        id="btn-request-quote"
                        type="button"
                        className="btn-secondary"
                        style={{
                          width: '100%',
                          background: canRequestQuote && !quoteLoading ? 'rgba(77,20,140,0.08)' : '#f1f5f9',
                          borderColor: canRequestQuote ? 'var(--acme-purple)' : '#cbd5e1',
                          color: canRequestQuote ? 'var(--acme-purple)' : '#94a3b8',
                        }}
                        disabled={!canRequestQuote || quoteLoading}
                        onClick={handleRequestQuote}
                      >
                        {quoteLoading ? <><SpinnerIcon />Calculando...</> : activeQuote ? '↺ Recalcular precio' : 'Calcular precio final'}
                      </button>
                    )}

                    {/* Botón: Confirmar y pagar */}
                    <button
                      id="btn-checkout"
                      type="button"
                      className="btn-primary"
                      style={{
                        width: '100%',
                        background: canCheckout && !submitting ? 'var(--acme-orange)' : '#cbd5e1',
                      }}
                      disabled={!canCheckout || submitting}
                      onClick={handleCheckout}
                    >
                      {submitting
                        ? <><SpinnerIcon />Procesando...</>
                        : pendingOrderId
                        ? 'Reintentar pago Culqi'
                        : 'Confirmar y pagar'}
                    </button>
                  </div>
                )}
              </section>

              {!publicStore.sessionUser && (
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--acme-text-muted)', lineHeight: 1.6 }}>
                    ¿Aún no tienes cuenta? <br />
                    <Link to={`${AppRoutes.public.account}?tab=register&redirect=${encodeURIComponent(AppRoutes.public.cart)}`} style={{ color: 'var(--acme-purple)', fontWeight: 700, textDecoration: 'none' }}>Regístrate ahora</Link>
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
