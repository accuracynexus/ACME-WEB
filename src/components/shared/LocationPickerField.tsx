import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FieldGroup } from '../admin/AdminFields';
import { TextField } from '../ui/TextField';

// Centro de Huancavelica: a donde mira el mapa cuando la sucursal
// todavia no tiene punto.
const DEFAULT_CENTER: [number, number] = [-12.7869, -74.9731];
const DEFAULT_ZOOM = 14;
const PLACED_ZOOM = 17;

// Leaflet resuelve los iconos por URL relativa al CSS, que con el bundler
// no coincide. Se dibuja el pin con un divIcon y asi no hay que copiar
// assets ni pelear con rutas.
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:26px;height:26px;border-radius:50% 50% 50% 0;
    background:#ff6200;border:2.5px solid #fff;
    transform:rotate(-45deg);
    box-shadow:0 3px 10px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

function parse(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LocationPickerField({
  lat,
  lng,
  onChange,
}: {
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // onChange se guarda en ref: el mapa se crea una sola vez y el handler
  // de click no debe quedar capturando un closure viejo.
  const onChangeRef = useRef(onChange);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const numericLat = parse(lat);
  const numericLng = parse(lng);
  const hasPoint = numericLat !== null && numericLng !== null;

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { attributionControl: true }).setView(
      hasPoint ? [numericLat, numericLng] : DEFAULT_CENTER,
      hasPoint ? PLACED_ZOOM : DEFAULT_ZOOM
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current({
        lat: event.latlng.lat.toFixed(6),
        lng: event.latlng.lng.toFixed(6),
      });
    });

    mapRef.current = map;

    // El contenedor suele montarse dentro de una card que todavia se esta
    // dimensionando; sin esto Leaflet calcula mal el tamano y quedan
    // tiles grises.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sincronizar el pin cada vez que cambian las coordenadas, vengan del
  // click, de los inputs o del GPS.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasPoint) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const position: [number, number] = [numericLat, numericLng];

    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      markerRef.current = L.marker(position, { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const point = markerRef.current!.getLatLng();
        onChangeRef.current({ lat: point.lat.toFixed(6), lng: point.lng.toFixed(6) });
      });
    }

    map.panTo(position);
  }, [numericLat, numericLng, hasPoint]);

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Este navegador no permite obtener la ubicacion.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChangeRef.current({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        });
        mapRef.current?.setZoom(PLACED_ZOOM);
      },
      () => setGeoError('No se pudo obtener la ubicacion. Revisa los permisos del navegador.')
    );
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div
        ref={containerRef}
        style={{
          height: '320px',
          width: '100%',
          borderRadius: 'var(--acme-radius-md)',
          border: '1px solid var(--acme-border)',
          overflow: 'hidden',
          // Leaflet usa z-index altos en sus panes; contenerlo evita que
          // los tiles se dibujen por encima de modales y dropdowns.
          zIndex: 0,
          position: 'relative',
        }}
      />

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={useMyLocation}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
          Usar mi ubicacion
        </button>

        {hasPoint && (
          <>
            <a
              className="btn btn--ghost btn--sm"
              href={`https://www.google.com/maps?q=${numericLat},${numericLng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Verificar en Google Maps
            </a>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onChangeRef.current({ lat: '', lng: '' })}
              style={{ color: 'var(--acme-red)' }}
            >
              Quitar punto
            </button>
          </>
        )}

        <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>
          Haz clic en el mapa o arrastra el pin.
        </span>
      </div>

      {geoError && (
        <span style={{ fontSize: '12.5px', color: 'var(--acme-red)', fontWeight: 600 }} role="alert">
          {geoError}
        </span>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <FieldGroup label="Latitud" hint="Grados decimales. En Huancavelica es negativa, ej. -12.78452">
          <TextField
            value={lat}
            inputMode="decimal"
            placeholder="-12.78452"
            onChange={(event) => onChange({ lat: event.target.value, lng })}
          />
        </FieldGroup>
        <FieldGroup label="Longitud" hint="Grados decimales. En Huancavelica es negativa, ej. -74.97125">
          <TextField
            value={lng}
            inputMode="decimal"
            placeholder="-74.97125"
            onChange={(event) => onChange({ lat, lng: event.target.value })}
          />
        </FieldGroup>
      </div>
    </div>
  );
}
