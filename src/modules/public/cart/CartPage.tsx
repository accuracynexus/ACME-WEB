import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';
import { AppRoutes } from '../../../core/constants/routes';
import {
  CourierCulqiOrderResponse,
  CourierGeocodeSearchResult,
  CourierQuoteResponse,
  courierPaymentService,
} from '../../../core/services/courierPaymentService';
import { CustomerAddressForm, CustomerAddressRecord, publicCustomerService } from '../../../core/services/publicCustomerService';
import { supabase } from '../../../integrations/supabase/client';
import { usePublicStore } from '../store/PublicStoreContext';

type DeliveryAddressMode = 'saved' | 'new';
type TipOption = 0 | 1 | 2 | 'custom';
type GeoPoint = { lat: number; lng: number };
type CoverageStatus = { status: 'inside' | 'outside' | 'unknown'; label: string; detail: string };
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
// Se piden TODOS los metodos de pago: asi el cliente ve todo lo que la cuenta
// de Culqi tenga contratado, sin que este codigo le recorte opciones.
//
// Culqi escribe "Feature is disabled" en consola por cada metodo que la cuenta
// no tiene activado. Es solo informativo: los metodos si contratados se
// muestran igual. Quien quiera silenciar ese aviso puede recortar la lista
// desde Vercel con VITE_CULQI_PAYMENT_METHODS, pero no hace falta.
const CULQI_ALL_METHODS = ['tarjeta', 'yape', 'bancaMovil', 'agente', 'billetera', 'cuotealo'];

const CULQI_METHODS = String(
  import.meta.env.VITE_CULQI_PAYMENT_METHODS || CULQI_ALL_METHODS.join(','),
)
  .split(',')
  .map((method) => method.trim())
  .filter(Boolean);

const CULQI_SANDBOX_YAPE_PHONE = '900000001';
const CULQI_SANDBOX_YAPE_LABEL = '900 000 001';
const TIP_PRESETS = [0, 1, 2] as const; // S/0, S/1, S/2
const QUOTE_TTL_MS = 4.5 * 60 * 1000; // 4.5 min (expires_at es 5 min)
const DEFAULT_ROUTING_API_URL = 'https://router.project-osrm.org';
const ROUTING_API_URL = String(import.meta.env.VITE_ROUTING_API_URL || DEFAULT_ROUTING_API_URL).replace(/\/+$/, '');
const HUANCAVELICA_CITY_BOUNDS = {
  minLat: -13.05,
  maxLat: -12.55,
  minLng: -75.25,
  maxLng: -74.65,
};
const HUANCAVELICA_COVERAGE_POINTS = [
  { code: 'PUNTO_5', label: 'Punto 5', lat: -12.7800974, lng: -75.0372666 },
  { code: 'PUNTO_6', label: 'Punto 6', lat: -12.7730799, lng: -75.0300459 },
  { code: 'PUNTO_7', label: 'Punto 7', lat: -12.76676, lng: -75.0227074 },
  { code: 'PUNTO_8', label: 'Punto 8', lat: -12.7636211, lng: -75.0114636 },
  { code: 'PUNTO_9', label: 'Punto 9', lat: -12.7629497, lng: -74.992224 },
  { code: 'PUNTO_10', label: 'Punto 10', lat: -12.7748462, lng: -74.986897 },
  { code: 'PUNTO_11', label: 'Punto 11', lat: -12.778864, lng: -74.9765115 },
  { code: 'PUNTO_12', label: 'Punto 12', lat: -12.774361, lng: -74.9657448 },
  { code: 'PUNTO_13', label: 'Punto 13', lat: -12.764023, lng: -74.9623545 },
  { code: 'PUNTO_14', label: 'Punto 14', lat: -12.7699248, lng: -74.9588354 },
  { code: 'PUNTO_15', label: 'Punto 15', lat: -12.7742357, lng: -74.9578484 },
  { code: 'PUNTO_16', label: 'Punto 16', lat: -12.7788814, lng: -74.9484499 },
  { code: 'PUNTO_17', label: 'Punto 17', lat: -12.7780443, lng: -74.9401673 },
  { code: 'PUNTO_18', label: 'Punto 18', lat: -12.771306, lng: -74.9319704 },
  { code: 'PUNTO_19', label: 'Punto 19', lat: -12.7733568, lng: -74.9295243 },
  { code: 'PUNTO_20', label: 'Punto 20', lat: -12.7877748, lng: -74.9404677 },
  { code: 'PUNTO_21', label: 'Punto 21', lat: -12.7978141, lng: -74.9413395 },
  { code: 'PUNTO_22', label: 'Punto 22', lat: -12.7985229, lng: -74.9449901 },
  { code: 'PUNTO_23', label: 'Punto 23', lat: -12.7871119, lng: -74.9553437 },
  { code: 'PUNTO_24', label: 'Punto 24', lat: -12.7916459, lng: -74.9641773 },
  { code: 'PUNTO_25', label: 'Punto 25', lat: -12.7920597, lng: -74.971565 },
  { code: 'PUNTO_26', label: 'Punto 26', lat: -12.7934826, lng: -74.9789679 },
  { code: 'PUNTO_27', label: 'Punto 27', lat: -12.7960145, lng: -74.984504 },
  { code: 'PUNTO_28', label: 'Punto 28', lat: -12.7922419, lng: -74.9855645 },
  { code: 'PUNTO_29', label: 'Punto 29', lat: -12.7905888, lng: -74.9805648 },
  { code: 'PUNTO_30', label: 'Punto 30', lat: -12.7877011, lng: -74.9885471 },
  { code: 'PUNTO_31', label: 'Punto 31', lat: -12.7910493, lng: -74.9889333 },
  { code: 'PUNTO_32', label: 'Punto 32', lat: -12.7896473, lng: -74.9970873 },
  { code: 'PUNTO_33', label: 'Punto 33', lat: -12.788626, lng: -75.0077407 },
  { code: 'PUNTO_34', label: 'Punto 34', lat: -12.7805905, lng: -75.0069682 },
  { code: 'PUNTO_35', label: 'Punto 35', lat: -12.7795023, lng: -75.0187271 },
  { code: 'PUNTO_36', label: 'Punto 36', lat: -12.7828087, lng: -75.0266664 },
  { code: 'PUNTO_37', label: 'Punto 37', lat: -12.7885423, lng: -75.0318162 },
  { code: 'PUNTO_38', label: 'Punto 38', lat: -12.7917648, lng: -75.0347345 },
  { code: 'PUNTO_39', label: 'Punto 39', lat: -12.7942339, lng: -75.0357215 },
  { code: 'PUNTO_40', label: 'Punto 40', lat: -12.7920577, lng: -75.0412147 },
  { code: 'PUNTO_41', label: 'Punto 41', lat: -12.7855709, lng: -75.0389402 },
] as const;
const HUANCAVELICA_COVERAGE_POLYGON: GeoPoint[] = HUANCAVELICA_COVERAGE_POINTS.map((point) => ({
  lat: point.lat,
  lng: point.lng,
}));
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
  // Number(null) es 0 y Number('') tambien, y ambos pasan Number.isFinite.
  // Una sucursal sin coordenadas quedaba entonces en (0, 0), la isla nula
  // del Golfo de Guinea, y el pedido se cotizaba a 8000 km del cliente.
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoordinate(point: GeoPoint) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function isOperationalPoint(point: GeoPoint) {
  return (
    Math.abs(point.lat) > 0.01 &&
    Math.abs(point.lng) > 0.01 &&
    point.lat >= HUANCAVELICA_CITY_BOUNDS.minLat &&
    point.lat <= HUANCAVELICA_CITY_BOUNDS.maxLat &&
    point.lng >= HUANCAVELICA_CITY_BOUNDS.minLng &&
    point.lng <= HUANCAVELICA_CITY_BOUNDS.maxLng
  );
}

function isPointInsidePolygon(point: GeoPoint, polygon: GeoPoint[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  let previous = polygon[polygon.length - 1] as GeoPoint;

  for (const current of polygon) {
    const px = point.lng;
    const py = point.lat;
    const ax = current.lng;
    const ay = current.lat;
    const bx = previous.lng;
    const by = previous.lat;
    const cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay);
    const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
    const squaredLen = (bx - ax) ** 2 + (by - ay) ** 2;
    if (Math.abs(cross) <= 1e-10 && dot >= 0 && dot <= squaredLen + 1e-10) {
      return true;
    }

    const intersects = (ay > py) !== (by > py);
    if (intersects) {
      const xIntersection = ((bx - ax) * (py - ay)) / (by - ay) + ax;
      if (px < xIntersection) inside = !inside;
    }
    previous = current;
  }

  return inside;
}

function getCoverageStatus(point: GeoPoint | null): CoverageStatus | null {
  if (!point) return null;
  const inside = isPointInsidePolygon(point, HUANCAVELICA_COVERAGE_POLYGON);
  return inside
    ? {
        status: 'inside',
        label: 'Dentro de cobertura urbana',
        detail: 'Aplica tarifa urbana por zona A/B/C segun distancia, subida y servicio.',
      }
    : {
        status: 'outside',
        label: 'Fuera de cobertura urbana',
        detail: 'No se bloquea la compra; se cotiza como Zona D por kilometraje.',
      };
}

function pointFromAddress(address: CustomerAddressForm | CustomerAddressRecord | null | undefined): GeoPoint | null {
  const lat = Number(address?.lat);
  const lng = Number(address?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const point = { lat, lng };
  return isOperationalPoint(point) ? point : null;
}

function isOperationalSavedAddress(address: CustomerAddressRecord) {
  const text = [address.line1, address.district, address.city, address.region, address.country].join(' ').toLowerCase();
  if (text.includes('huancayo')) return false;
  return text.includes('huancavelica') || Boolean(pointFromAddress(address));
}

function formatAddressLabel(address: CustomerAddressRecord) {
  return [address.line1, address.district, address.city].filter(Boolean).join(', ') || 'Dirección registrada';
}

function formatAddressUsage(address: CustomerAddressRecord) {
  const count = Number(address.delivery_use_count ?? 0);
  if (!Number.isFinite(count) || count <= 0) return 'sin envíos';
  return count === 1 ? '1 envío' : `${count} envíos`;
}

function formatAddressOption(address: CustomerAddressRecord) {
  return `${address.label || 'Dirección'} - ${formatAddressLabel(address)} (${formatAddressUsage(address)})`;
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

// Pin tipo mapa con un glifo adentro: cubiertos para el local, persona para
// el punto de entrega. Antes eran dos circulos con las letras O y D, que no
// decian cual era cual sin leer la leyenda.
function createRouteIcon(color: string, glyph: string) {
  const L = window.L;
  if (!L) return undefined;

  return L.divIcon({
    className: '',
    html: `<svg width="34" height="44" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28s18-14.5 18-28c0-9.94-8.06-18-18-18z" fill="${color}"/>
      <path d="M18 1.6C8.94 1.6 1.6 8.94 1.6 18c0 12.2 16.4 25.6 16.4 25.6S34.4 30.2 34.4 18c0-9.06-7.34-16.4-16.4-16.4z"
            fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.4"/>
      <circle cx="18" cy="18" r="11" fill="#fff"/>
      <g stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none">${glyph}</g>
    </svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
  });
}

// Cubiertos: tenedor de tres puntas y cuchillo.
const GLYPH_RESTAURANT = `
  <path d="M14 12v6.2a1.6 1.6 0 0 0 3.2 0V12"/>
  <path d="M15.6 12v11.8"/>
  <path d="M22.4 12c-1.5 0-2.4 1.5-2.4 3.4s.9 3 2.4 3"/>
  <path d="M22.4 12v11.8"/>`;

// Persona: cabeza y hombros.
const GLYPH_CUSTOMER = `
  <circle cx="18" cy="15" r="3.1"/>
  <path d="M12.4 24.2a5.6 5.6 0 0 1 11.2 0"/>`;

type IconProps = { size?: number };
const svgBase = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

const UserIcon = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BagIcon = ({ size = 20 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const ArrowLeftIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);
const MinusIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const PlusIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const TrashIcon = ({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const TruckIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const StoreIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M3 9 4 3h16l1 6" /><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    <path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" /><path d="M9 21v-6h6v6" />
  </svg>
);
const PhoneIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
);
const MapPinIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
const PencilIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
);
const ReceiptIcon = ({ size = 20 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="13" y2="15" />
  </svg>
);
const ImageIcon = ({ size = 26 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" />
  </svg>
);
const ShieldIcon = ({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const LockIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const ZapIcon = ({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
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
    lat: null,
    lng: null,
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
  const coveragePolygonRef = useRef<LeafletApi | null>(null);
  const hasAutoFittedMapRef = useRef(false);
  const fittedOriginKeyRef = useRef('');
  const onDestinationChangeRef = useRef(onDestinationChange);
  const [mapError, setMapError] = useState<string | null>(null);
  const coverageStatus = getCoverageStatus(destination);

  useEffect(() => {
    onDestinationChangeRef.current = onDestinationChange;
  }, [onDestinationChange]);

  const syncMap = useCallback(() => {
    const L = window.L;
    const map = leafletMapRef.current;
    if (!L || !map) return;

    const originLatLng: [number, number] = [origin.lat, origin.lng];
    const originKey = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
    if (fittedOriginKeyRef.current !== originKey) {
      fittedOriginKeyRef.current = originKey;
      hasAutoFittedMapRef.current = false;
    }

    const coverageLatLngs: [number, number][] = HUANCAVELICA_COVERAGE_POLYGON.map((point) => [point.lat, point.lng]);
    const routeLatLngs: [number, number][] =
      routeTrace.coordinates.length > 1
        ? routeTrace.coordinates.map((point) => [point.lat, point.lng])
        : destination
          ? [originLatLng, [destination.lat, destination.lng]]
          : [];

    if (!coveragePolygonRef.current) {
      coveragePolygonRef.current = L.polygon(coverageLatLngs, {
        color: '#047857',
        fillColor: '#10b981',
        fillOpacity: 0.08,
        weight: 1.5,
        opacity: 0.34,
        interactive: false,
        bubblingMouseEvents: false,
      }).addTo(map);
    } else {
      coveragePolygonRef.current.setLatLngs(coverageLatLngs);
    }

    if (!originMarkerRef.current) {
      originMarkerRef.current = L.marker(originLatLng, {
        icon: createRouteIcon('#ea4335', GLYPH_RESTAURANT),
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
      if (!hasAutoFittedMapRef.current) {
        const bounds = L.latLngBounds([originLatLng, ...coverageLatLngs]).pad(0.16);
        map.fitBounds(bounds, { maxZoom: 15, animate: false });
        hasAutoFittedMapRef.current = true;
      }
      return;
    }

    const destinationLatLng: [number, number] = [destination.lat, destination.lng];
    if (!destinationMarkerRef.current) {
      const marker = L.marker(destinationLatLng, {
        draggable: true,
        autoPan: true,
        riseOnHover: true,
        zIndexOffset: 1000,
        icon: createRouteIcon('#4d148c', GLYPH_CUSTOMER),
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

    if (!hasAutoFittedMapRef.current) {
      const bounds = L.latLngBounds([...coverageLatLngs, ...(routeLatLngs.length > 0 ? routeLatLngs : [originLatLng, destinationLatLng])]).pad(0.22);
      map.fitBounds(bounds, { maxZoom: 16, animate: false });
      hasAutoFittedMapRef.current = true;
    }
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

          // OpenStreetMap: libre y sin API key. CARTO se dejo de usar porque
          // ahora exige clave y estampa "API KEY REQUIRED" sobre los tiles.
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            detectRetina: true,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
          className="cart-map"
          style={{
            width: '100%',
            minHeight: '380px',
            borderRadius: '20px',
            overflow: 'hidden',
            background: '#f5f7fa',
            border: '1px solid #e6ebf2',
            boxShadow: '0 14px 34px rgba(29,22,48,.10)',
          }}
        />
        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', zIndex: 500 }}>
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={locationLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              border: '1px solid #e6ebf2',
              background: '#fff',
              color: '#1d1630',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: locationLoading ? 'wait' : 'pointer',
              boxShadow: '0 8px 20px rgba(29,22,48,.14)',
            }}
          >
            <MapPinIcon size={15} />
            {locationLoading ? 'Ubicando...' : 'Mi ubicación'}
          </button>
        </div>
        <div
          style={{
            position: 'absolute',
            right: '12px',
            bottom: '12px',
            zIndex: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            border: '1px solid #a7f3d0',
            background: 'rgba(255,255,255,.94)',
            color: '#047857',
            borderRadius: '999px',
            padding: '8px 11px',
            fontSize: '12px',
            fontWeight: 900,
            boxShadow: '0 10px 22px rgba(17,24,39,.12)',
          }}
        >
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981', display: 'inline-block' }} />
          Cobertura urbana
        </div>
      </div>
      <div className="account-alert account-alert--warning">
        Se cobra el tramo real desde el local hasta tu punto de entrega. La tarifa combina ruta por calles, zona urbana, subida/acceso, peso y tipo de servicio.
      </div>
      {coverageStatus && (
        <div
          className="account-alert account-alert--warning"
          style={{
            borderColor: coverageStatus.status === 'inside' ? '#bbf7d0' : '#fed7aa',
            background: coverageStatus.status === 'inside' ? '#ecfdf5' : '#fff7ed',
            color: coverageStatus.status === 'inside' ? '#065f46' : '#9a3412',
          }}
        >
          <strong>{coverageStatus.label}.</strong> {coverageStatus.detail}
        </div>
      )}
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
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressForm, setAddressForm] = useState<CustomerAddressForm>(createEmptyAddress());
  const [deliveryAddressMode, setDeliveryAddressMode] = useState<DeliveryAddressMode>('new');
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddressRecord[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
  const [savedAddressesError, setSavedAddressesError] = useState<string | null>(null);
  const [addressDeleteLoading, setAddressDeleteLoading] = useState(false);
  const [currentLocationDistanceKm, setCurrentLocationDistanceKm] = useState<number | null>(null);
  const [locationDistanceWarningDismissed, setLocationDistanceWarningDismissed] = useState(false);
  const [saveNewDeliveryAddress, setSaveNewDeliveryAddress] = useState(true);
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
  const cartMerchantIds = useMemo(
    () => Array.from(new Set(publicStore.cartItems.map((item) => item.merchant_id).filter(Boolean))),
    [publicStore.cartItems]
  );
  const cartBranchIds = useMemo(
    () => Array.from(new Set(publicStore.cartItems.map((item) => item.branch_id).filter(Boolean))),
    [publicStore.cartItems]
  );
  const isSingleLocalCart = cartMerchantIds.length <= 1 && cartBranchIds.length <= 1;
  const selectedSavedAddress = useMemo(
    () => savedAddresses.find((address) => address.address_id === selectedSavedAddressId) ?? savedAddresses.find((address) => address.is_default) ?? savedAddresses[0] ?? null,
    [savedAddresses, selectedSavedAddressId]
  );
  const destinationCoverageStatus = useMemo(
    () => getCoverageStatus(destinationPoint),
    [destinationPoint?.lat, destinationPoint?.lng]
  );
  const autoOutOfCity = destinationCoverageStatus?.status === 'outside';

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
    // Al expirar solo se descarta: el efecto de cotizacion automatica pide una
    // nueva enseguida, sin que el cliente tenga que hacer nada.
    const timer = setTimeout(() => { invalidateQuote(); }, remaining);
    return () => clearTimeout(timer);
  }, [quoteExpiredAt]);

  const invalidateQuote = useCallback(() => {
    setQuote(null);
    setQuoteExpiredAt(null);
    setPendingOrderId(null);
    setPaymentMessage(null);
    setCheckoutError(null);
    // Limpiar tambien el error deja que la cotizacion automatica vuelva a
    // intentarlo cuando el cliente corrige lo que estaba mal.
    setQuoteError(null);
  }, []);

  const applySavedAddress = useCallback((address: CustomerAddressRecord) => {
    invalidateQuote();
    setSelectedSavedAddressId(address.address_id);
    setDeliveryAddressMode('saved');
    setAddressForm({
      ...createEmptyAddress(),
      ...address,
      label: address.label || 'Casa',
      is_default: address.is_default,
    });
    selectedAddressLabelRef.current = address.line1;
    setAddressSearch(address.line1);
    setAddressSearchResults([]);
    setAddressSearchError(null);
    setLocationDistanceWarningDismissed(false);

    const point = pointFromAddress(address);
    setDestinationPoint(point);
  }, [invalidateQuote]);

  const startNewDeliveryAddress = useCallback(() => {
    invalidateQuote();
    setDeliveryAddressMode('new');
    setSelectedSavedAddressId('');
    setAddressForm(createEmptyAddress());
    setDestinationPoint(null);
    setAddressSearch('');
    selectedAddressLabelRef.current = '';
    setAddressSearchResults([]);
    setAddressSearchError(null);
    setCurrentLocationDistanceKm(null);
    setLocationDistanceWarningDismissed(false);
    setSaveNewDeliveryAddress(true);
  }, [invalidateQuote]);

  const handleDeleteSelectedAddress = useCallback(async () => {
    if (!publicStore.sessionUser || !selectedSavedAddress) return;
    const confirmed = window.confirm('¿Eliminar esta ubicación guardada? No se eliminarán tus pedidos anteriores.');
    if (!confirmed) return;

    setAddressDeleteLoading(true);
    setSavedAddressesError(null);
    const relationIds =
      selectedSavedAddress.duplicate_relation_ids && selectedSavedAddress.duplicate_relation_ids.length > 0
        ? selectedSavedAddress.duplicate_relation_ids
        : [selectedSavedAddress.relation_id];
    const result = await publicCustomerService.deleteAddress(publicStore.sessionUser.id, relationIds);
    setAddressDeleteLoading(false);

    if (result.error) {
      setSavedAddressesError(result.error.message);
      return;
    }

    const nextAddresses = savedAddresses.filter((address) => !relationIds.includes(address.relation_id));
    setSavedAddresses(nextAddresses);
    const nextAddress = nextAddresses.find((address) => address.is_default) ?? nextAddresses[0];
    if (nextAddress) {
      applySavedAddress(nextAddress);
    } else {
      startNewDeliveryAddress();
    }
  }, [applySavedAddress, publicStore.sessionUser, savedAddresses, selectedSavedAddress, startNewDeliveryAddress]);

  useEffect(() => {
    if (!publicStore.sessionUser) {
      setSavedAddresses([]);
      setSelectedSavedAddressId('');
      setDeliveryAddressMode('new');
      return;
    }

    let cancelled = false;
    setSavedAddressesLoading(true);
    setSavedAddressesError(null);

    void publicCustomerService.fetchCustomerAddresses(publicStore.sessionUser.id)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setSavedAddressesError(result.error.message);
          setSavedAddresses([]);
          return;
        }

        const addresses = (result.data ?? []).filter(isOperationalSavedAddress);
        setSavedAddresses(addresses);
        const preferred = addresses.find((address) => address.is_default) ?? addresses[0];
        if (preferred && !addressForm.line1.trim()) {
          applySavedAddress(preferred);
        } else if (!preferred) {
          setDeliveryAddressMode('new');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSavedAddressesError(err instanceof Error ? err.message : 'No se pudieron leer tus direcciones.');
          setSavedAddresses([]);
        }
      })
      .finally(() => {
        if (!cancelled) setSavedAddressesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicStore.sessionUser?.id]);

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
    if (deliveryAddressMode === 'saved') {
      setDeliveryAddressMode('new');
      setSelectedSavedAddressId('');
      setLocationDistanceWarningDismissed(true);
    }
    setAddressForm((current) => ({
      ...current,
      lat: point.lat,
      lng: point.lng,
    }));
    setDestinationPoint(point);
  }, [deliveryAddressMode, invalidateQuote]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeolocationError('Tu navegador no permite obtener ubicacion.');
      return;
    }

    setGeolocationLoading(true);
    setGeolocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (deliveryAddressMode === 'saved') {
          setDeliveryAddressMode('new');
          setSelectedSavedAddressId('');
          setLocationDistanceWarningDismissed(true);
        }
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
  }, [deliveryAddressMode, handleDestinationChange]);

  const applyAddressCandidate = useCallback((candidate: CourierGeocodeSearchResult) => {
    invalidateQuote();
    setDeliveryAddressMode('new');
    setSelectedSavedAddressId('');
    setLocationDistanceWarningDismissed(true);
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
      lat: candidate.lat,
      lng: candidate.lng,
    }));
  }, [invalidateQuote]);

  useEffect(() => {
    const query = addressSearch.trim();
    if (query.length < 3 || query === selectedAddressLabelRef.current) {
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
  }, [addressSearch]);

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
            lat: destinationPoint.lat,
            lng: destinationPoint.lng,
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

  useEffect(() => {
    if (
      deliveryAddressMode !== 'saved' ||
      !destinationPoint ||
      locationDistanceWarningDismissed ||
      !navigator.geolocation
    ) {
      setCurrentLocationDistanceKm(null);
      return;
    }

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const currentPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const distanceKm = roundTo(calculateDistanceKm(currentPoint, destinationPoint), 2);
        setCurrentLocationDistanceKm(distanceKm >= 0.35 ? distanceKm : null);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, [
    deliveryAddressMode,
    destinationPoint?.lat,
    destinationPoint?.lng,
    locationDistanceWarningDismissed,
  ]);

  const hasDeliveryAddress = Boolean(addressForm.line1.trim() && addressForm.city.trim());
  const hasRoutePoint = !branchLocationLoading && (!branchPoint || Boolean(destinationPoint));

  const canRequestQuote =
    publicStore.cartItems.length > 0 &&
    publicStore.sessionUser &&
    isAccountValidated &&
    recipientName.trim() &&
    recipientPhone.trim() &&
    hasDeliveryAddress &&
    hasRoutePoint &&
    isSingleLocalCart;

  // Explica en pantalla qué falta para poder cotizar, en vez de dejar el botón
  // deshabilitado sin ninguna pista (motivo de confusión frecuente).
  const missingQuoteRequirements: string[] = [];
  if (publicStore.sessionUser) {
    if (!isAccountValidated) missingQuoteRequirements.push('Confirma tu correo electrónico');
    if (!recipientName.trim()) missingQuoteRequirements.push('Nombre de quien recibe');
    if (!recipientPhone.trim()) missingQuoteRequirements.push('Teléfono de contacto');
    if (!hasDeliveryAddress) missingQuoteRequirements.push('Dirección de entrega (calle y ciudad)');
    if (hasDeliveryAddress && !hasRoutePoint) {
      missingQuoteRequirements.push(
        branchLocationLoading ? 'Ubicando el local (espera un momento)' : 'Marca el punto de entrega en el mapa'
      );
    }
  }

  const canCheckout = canRequestQuote && quote !== null;

  // ─── Solicitar cotización al backend ────────────────────────────────────────
  const handleRequestQuote = useCallback(async () => {
    if (!publicStore.sessionUser || publicStore.cartItems.length === 0) return;
    if (!isSingleLocalCart) {
      setQuoteError('Por ahora cada pedido debe salir de un solo local. Retira productos de otros locales para continuar.');
      return;
    }
    if (branchPoint && !destinationPoint) {
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
        fulfillment_type: 'delivery',
        is_out_of_city: autoOutOfCity,
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
  }, [
    publicStore.sessionUser,
    publicStore.cartItems,
    isSingleLocalCart,
    branchPoint,
    destinationPoint,
    firstItem,
    tipAmount,
    autoOutOfCity,
  ]);

  // El precio se calcula solo en cuanto están los datos mínimos. Antes había
  // que pulsar "Calcular precio final" y casi nadie lo veía, así que el
  // checkout parecía roto. Se reintenta con un respiro para no disparar una
  // petición por cada tecla mientras se escribe la dirección.
  useEffect(() => {
    if (!canRequestQuote) return;
    if (quote || quoteLoading || pendingOrderId) return;
    // Si el ultimo intento fallo, no reintentar en bucle: se espera a que el
    // cliente cambie algo, lo que limpia el error via invalidateQuote().
    if (quoteError) return;
    const timer = setTimeout(() => { void handleRequestQuote(); }, 700);
    return () => clearTimeout(timer);
  }, [canRequestQuote, quote, quoteLoading, pendingOrderId, quoteError, handleRequestQuote]);

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
    // Tras pagar se confirma el pedido, no se lanza al cliente al historial.
    navigate(`/pedido/${orderId}`);
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
          tarjeta: canUseCardPayment && CULQI_METHODS.includes('tarjeta'),
          yape: CULQI_METHODS.includes('yape'),
          bancaMovil: CULQI_METHODS.includes('bancaMovil'),
          agente: CULQI_METHODS.includes('agente'),
          billetera: CULQI_METHODS.includes('billetera'),
          cuotealo: CULQI_METHODS.includes('cuotealo'),
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
      let usedAddressRelationId =
        deliveryAddressMode === 'saved'
          ? selectedSavedAddress?.relation_id || addressForm.relation_id
          : undefined;

      if (
        deliveryAddressMode === 'new' &&
        saveNewDeliveryAddress &&
        addressForm.line1.trim()
      ) {
        const savedAddress = await publicCustomerService.saveAddress(publicStore.sessionUser.id, {
          ...addressForm,
          label: addressForm.label || 'Entrega',
          is_default: savedAddresses.length === 0,
          lat: destinationPoint?.lat ?? addressForm.lat ?? null,
          lng: destinationPoint?.lng ?? addressForm.lng ?? null,
        });
        if (savedAddress.error) {
          throw new Error(`No se pudo guardar la nueva ubicación: ${savedAddress.error.message}`);
        }
        usedAddressRelationId = String((savedAddress.data as { id?: unknown } | null)?.id || '') || undefined;
      }

      // FASE 2: Crear pedido en el backend a partir del quote_id
      const orderResult = await courierPaymentService.createOrder({
        quote_id: quote.quote_id,
        fulfillment_type: 'delivery',
        recipient_name: recipientName || undefined,
        recipient_phone: recipientPhone || undefined,
        address: {
          line1: addressForm.line1,
          line2: addressForm.line2 || undefined,
          reference: addressForm.reference || undefined,
          district: addressForm.district || undefined,
          city: addressForm.city || undefined,
          region: addressForm.region || undefined,
          country: addressForm.country || 'Peru',
          lat: destinationPoint?.lat ?? undefined,
          lng: destinationPoint?.lng ?? undefined,
        },
      });

      const orderId = orderResult.order_id;
      if (usedAddressRelationId) {
        const usageResult = await publicCustomerService.markAddressUsed(publicStore.sessionUser.id, usedAddressRelationId);
        if (!usageResult.error) {
          setSavedAddresses((current) =>
            current.map((address) =>
              address.relation_id === usedAddressRelationId
                ? {
                    ...address,
                    delivery_use_count: Number(address.delivery_use_count ?? 0) + 1,
                    last_used_at: new Date().toISOString(),
                  }
                : address
            )
          );
        }
      }
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
    <section className="cart-page">
      <div className="cart-shell">
        <section className="cart-head">
          <div>
            <div className="cart-head__eyebrow"><BagIcon size={14} /> Confirmación de Pedido</div>
            <h1 className="cart-head__title">Tu carrito</h1>
            <p className="cart-head__sub">
              Revisa tus productos, elige la propina y confirma los datos de entrega. El precio final lo calcula nuestro sistema.
            </p>
          </div>
          <Link to={AppRoutes.public.marketplace} className="cart-back-btn">
            <ArrowLeftIcon /> Seguir comprando
          </Link>
        </section>

        {publicStore.cartItems.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty__icon"><BagIcon size={40} /></div>
            <strong style={{ fontSize: '1.25rem' }}>Tu carrito está vacío</strong>
            <span style={{ color: '#6b7280' }}>Explora locales y elige tus productos favoritos.</span>
            <div style={{ marginTop: '6px' }}>
              <Link to={AppRoutes.public.marketplace} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <StoreIcon size={18} /> Ver negocios
              </Link>
            </div>
          </div>
        ) : (
          <div className="cart-grid-layout">
            {/* ─── Columna izquierda ─── */}
            <div className="cart-col">

              {/* Productos */}
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 className="cart-card-title">
                  <span className="cart-card-title__icon"><BagIcon size={20} /></span>
                  Productos en el carrito
                  <span className="cart-card-title__count">{publicStore.cartItems.length} {publicStore.cartItems.length === 1 ? 'ítem' : 'ítems'}</span>
                </h2>
                {!isSingleLocalCart && (
                  <div className="account-alert account-alert--warning" style={{ marginBottom: '16px' }}>
                    Por ahora cada pedido debe salir de un solo local. Deja productos de un solo local para calcular y pagar.
                  </div>
                )}
                <div style={{ display: 'grid', gap: '16px' }}>
                  {publicStore.cartItems.map((item) => (
                    <div key={item.id} className="cart-item">
                      {item.image_url ? (
                        <img className="cart-item__thumb" src={item.image_url} alt={item.product_name} loading="lazy"
                          onError={(e) => { const el = e.currentTarget; el.style.display = 'none'; const ph = el.nextElementSibling as HTMLElement | null; if (ph) ph.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div className="cart-item__thumb cart-item__thumb--ph" style={{ display: item.image_url ? 'none' : 'flex' }}>
                        <ImageIcon />
                      </div>
                      <div className="cart-item__main">
                        <div className="cart-item__top">
                          <div style={{ minWidth: 0 }}>
                            <div className="cart-item__name">{item.product_name}</div>
                            <div className="cart-item__meta"><StoreIcon size={13} /> {item.merchant_name} · {item.branch_name}</div>
                            {item.modifiers.length > 0 && (
                              <div className="cart-item__mods">{item.modifiers.map((m) => m.name).join(', ')}</div>
                            )}
                          </div>
                          <strong className="cart-item__price">
                            {formatMoney((item.unit_price + item.modifiers.reduce((s, m) => s + m.price_delta * m.quantity, 0)) * item.quantity)}
                          </strong>
                        </div>
                        <div className="cart-item__controls">
                          <div className="cart-stepper">
                            <button type="button" aria-label="Quitar uno" onClick={() => { invalidateQuote(); publicStore.updateItemQuantity(item.id, Math.max(1, item.quantity - 1)); }}><MinusIcon /></button>
                            <span className="cart-stepper__count">{item.quantity}</span>
                            <button type="button" aria-label="Agregar uno" onClick={() => { invalidateQuote(); publicStore.updateItemQuantity(item.id, item.quantity + 1); }}><PlusIcon /></button>
                          </div>
                          <div className="cart-note-wrap">
                            <PencilIcon size={15} />
                            <input
                              className="account-input"
                              value={item.notes}
                              onChange={(e) => publicStore.updateItemNotes(item.id, e.target.value)}
                              placeholder="Notas especiales"
                            />
                          </div>
                          <button type="button" className="cart-remove-btn" onClick={() => { invalidateQuote(); publicStore.removeItem(item.id); }}>
                            <TrashIcon /> Borrar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Datos de entrega */}
              {publicStore.sessionUser ? (
                <section className="account-card" style={{ padding: '24px' }}>
                  <h2 className="cart-card-title">
                    <span className="cart-card-title__icon cart-card-title__icon--orange"><TruckIcon size={20} /></span>
                    Entrega y contacto
                  </h2>
                  {!isAccountValidated && (
                    <div className="account-alert account-alert--warning" style={{ marginBottom: '20px' }}>
                      Debes validar tu correo electrónico antes de poder confirmar tu primer pedido.
                    </div>
                  )}
                  <div className="account-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="account-field">
                        <label className="account-label cart-label"><UserIcon size={15} /> Nombre de quien recibe</label>
                        <input id="input-recipient-name" className="account-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Juan Pérez" style={{ paddingLeft: '16px' }} />
                      </div>
                      <div className="account-field">
                        <label className="account-label cart-label"><PhoneIcon size={15} /> Teléfono</label>
                        <input id="input-recipient-phone" className="account-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="987 654 321" style={{ paddingLeft: '16px' }} />
                      </div>
                    </div>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        {savedAddresses.length > 0 && (
                          <div style={{ display: 'grid', gap: '12px', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '14px' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className={`account-tab-btn ${deliveryAddressMode === 'saved' ? 'account-tab-btn--active' : ''}`}
                                onClick={() => {
                                  const address = selectedSavedAddress ?? savedAddresses.find((item) => item.is_default) ?? savedAddresses[0];
                                  if (address) applySavedAddress(address);
                                }}
                              >
                                Dirección registrada
                              </button>
                              <button
                                type="button"
                                className={`account-tab-btn ${deliveryAddressMode === 'new' ? 'account-tab-btn--active' : ''}`}
                                onClick={startNewDeliveryAddress}
                              >
                                Otra ubicación
                              </button>
                            </div>

                            {deliveryAddressMode === 'saved' && (
                              <div style={{ display: 'grid', gap: '10px' }}>
                                <div className="account-field">
                                  <label className="account-label">Enviar a</label>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                                    <select
                                      className="account-input"
                                      value={selectedSavedAddress?.address_id || ''}
                                      onChange={(event) => {
                                        const address = savedAddresses.find((item) => item.address_id === event.target.value);
                                        if (address) applySavedAddress(address);
                                      }}
                                      style={{ paddingLeft: '16px' }}
                                    >
                                      {savedAddresses.map((address) => (
                                        <option key={address.address_id} value={address.address_id}>
                                          {formatAddressOption(address)}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={handleDeleteSelectedAddress}
                                      disabled={addressDeleteLoading || !selectedSavedAddress}
                                      style={{ padding: '12px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                                    >
                                      {addressDeleteLoading ? 'Eliminando...' : 'Eliminar'}
                                    </button>
                                  </div>
                                </div>
                                {selectedSavedAddress && (
                                  <div style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.5 }}>
                                    {formatAddressLabel(selectedSavedAddress)}
                                    {selectedSavedAddress.reference ? ` · ${selectedSavedAddress.reference}` : ''} · {formatAddressUsage(selectedSavedAddress)}
                                  </div>
                                )}
                                {selectedSavedAddress && !pointFromAddress(selectedSavedAddress) && (
                                  <div className="account-alert account-alert--warning">
                                    Esta dirección registrada no tiene punto en mapa. Elige otra ubicación o marca el punto de entrega abajo.
                                  </div>
                                )}
                                {currentLocationDistanceKm !== null && (
                                  <div className="account-alert account-alert--warning" style={{ display: 'grid', gap: '10px' }}>
                                    <span>
                                      Tu ubicación actual está a {currentLocationDistanceKm.toFixed(2)} km de la dirección registrada.
                                    </span>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setLocationDistanceWarningDismissed(true)}
                                        style={{ padding: '8px 12px', fontSize: '12px' }}
                                      >
                                        Lo recibirá otra persona
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={startNewDeliveryAddress}
                                        style={{ padding: '8px 12px', fontSize: '12px' }}
                                      >
                                        Agregar otra ubicación
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {savedAddressesLoading && <div className="account-alert account-alert--warning">Cargando tus direcciones...</div>}
                        {savedAddressesError && <div className="account-alert account-alert--warning">{savedAddressesError}</div>}

                        {(deliveryAddressMode === 'new' || savedAddresses.length === 0) && (
                          <>
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
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '13px', fontWeight: 800 }}>
                          <input
                            type="checkbox"
                            checked={saveNewDeliveryAddress}
                            onChange={(event) => setSaveNewDeliveryAddress(event.target.checked)}
                          />
                          Guardar esta ubicación en mi perfil
                        </label>
                          </>
                        )}
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
            <aside className="cart-summary-aside">

              {/* Propina */}
              {publicStore.sessionUser && isAccountValidated && (
                <section className="account-card" style={{ padding: '20px' }}>
                  <h2 className="cart-card-title" style={{ fontSize: '1rem', marginBottom: '14px' }}>
                    <span className="cart-card-title__icon cart-card-title__icon--orange"><ZapIcon size={18} /></span>
                    Propina para el repartidor
                  </h2>
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
                <h2 className="cart-card-title">
                  <span className="cart-card-title__icon"><ReceiptIcon size={20} /></span>
                  Resumen
                </h2>
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
                        label="Envío"
                        value={formatMoney(activeQuote.delivery_fee)}
                        muted
                        small
                      />
                      {activeQuote.distance_km !== null && activeQuote.distance_km !== undefined && (
                        <SummaryRow label="Tramo local-destino" value={`${Number(activeQuote.distance_km).toFixed(2)} km`} muted small />
                      )}
                      {activeQuote.coverage_label && (
                        <SummaryRow label="Cobertura" value={activeQuote.coverage_label} muted small />
                      )}
                      {activeQuote.delivery_zone_label && (
                        <SummaryRow label={activeQuote.delivery_zone_label} value={activeQuote.delivery_detail || 'Tarifa courier'} muted small />
                      )}
                      {(activeQuote.delivery_surcharges_total ?? 0) > 0 && (
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
                      {tipAmount > 0 && <SummaryRow label="Propina" value={formatMoney(tipAmount)} muted small />}
                      <div style={{ borderTop: '1px solid var(--acme-border)', paddingTop: '12px', marginTop: '4px' }}>
                        <SummaryRow
                          label="Total"
                          value={quoteLoading ? 'Calculando…' : 'Completa tus datos'}
                          highlight={false}
                        />
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        El envío y el total se calculan solos al completar la entrega.
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
                    {/* Qué falta para poder pagar. El precio se calcula solo. */}
                    {!pendingOrderId && !canRequestQuote && missingQuoteRequirements.length > 0 && (
                      <div className="cart-missing">
                        <strong className="cart-missing__title">Para continuar falta:</strong>
                        <ul className="cart-missing__list">
                          {missingQuoteRequirements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!pendingOrderId && canRequestQuote && quoteLoading && (
                      <div className="cart-calculating">
                        <SpinnerIcon />Calculando el precio final…
                      </div>
                    )}

                    {/* Botón: Confirmar y pagar */}
                    <button
                      id="btn-checkout"
                      type="button"
                      className="cart-pay-btn"
                      disabled={!canCheckout || submitting}
                      onClick={handleCheckout}
                    >
                      {submitting
                        ? <><SpinnerIcon />Procesando...</>
                        : <><LockIcon size={18} />{pendingOrderId ? 'Reintentar pago Culqi' : 'Confirmar y pagar'}</>}
                    </button>

                    <div className="cart-trust">
                      <span className="cart-trust__item"><ShieldIcon /> Pago seguro</span>
                      <span className="cart-trust__item"><LockIcon size={15} /> Datos cifrados</span>
                      <span className="cart-trust__item"><ZapIcon /> Yape y tarjetas</span>
                    </div>
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
