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

// OpenStreetMap: libre y sin API key. CARTO daba una base mas limpia pero
// ahora exige clave y estampa "API KEY REQUIRED" sobre cada tile.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Pin estilo Google Maps con glifo de restaurante.
const pinIcon = L.divIcon({
  className: '',
  html: `
    <svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28s18-14.5 18-28c0-9.94-8.06-18-18-18z"
            fill="#ea4335"/>
      <path d="M18 1.6C8.94 1.6 1.6 8.94 1.6 18c0 12.2 16.4 25.6 16.4 25.6S34.4 30.2 34.4 18c0-9.06-7.34-16.4-16.4-16.4z"
            fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.4"/>
      <circle cx="18" cy="18" r="11" fill="#fff"/>
      <g stroke="#ea4335" stroke-width="1.9" stroke-linecap="round" fill="none">
        <path d="M14 12v6.2a1.6 1.6 0 0 0 3.2 0V12"/>
        <path d="M15.6 12v11.8"/>
        <path d="M22.4 12c-1.5 0-2.4 1.5-2.4 3.4s.9 3 2.4 3"/>
        <path d="M22.4 12v11.8"/>
      </g>
    </svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 46],
  popupAnchor: [0, -44],
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
  // Cuando el punto lo movio el propio mapa, el pin ya esta a la vista y
  // recentrar solo produce un salto. Escribir a mano tampoco debe mover la
  // vista en cada tecla: "-12.7" apuntaria a otro pais antes de terminar.
  const skipRecenterRef = useRef(false);
  const centeredOnceRef = useRef(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const numericLat = parse(lat);
  const numericLng = parse(lng);
  const hasPoint = numericLat !== null && numericLng !== null;

  const emit = (nextLat: number, nextLng: number, fromMap: boolean) => {
    skipRecenterRef.current = fromMap;
    onChangeRef.current({ lat: nextLat.toFixed(6), lng: nextLng.toFixed(6) });
  };

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      // El scroll del mouse mueve la pagina, no el zoom: dentro de un
      // formulario largo, capturarlo desorienta. Quedan los botones y el
      // doble clic.
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      emit(event.latlng.lat, event.latlng.lng, true);
    });

    mapRef.current = map;

    // El contenedor suele montarse dentro de una card que todavia se esta
    // dimensionando; sin esto Leaflet calcula mal el tamano y quedan
    // tiles grises.
    const invalidate = () => map.invalidateSize();
    setTimeout(invalidate, 0);
    const observer = new ResizeObserver(invalidate);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
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
        emit(point.lat, point.lng, true);
      });
    }

    // Solo se centra la primera vez que aparece un punto (al abrir una
    // sucursal ya guardada, por ejemplo). Despues la vista es del usuario.
    if (skipRecenterRef.current) {
      skipRecenterRef.current = false;
      return;
    }
    if (!centeredOnceRef.current) {
      centeredOnceRef.current = true;
      map.setView(position, PLACED_ZOOM);
    }
  }, [numericLat, numericLng, hasPoint]);

  const centerOnPoint = () => {
    if (!hasPoint || !mapRef.current) return;
    mapRef.current.setView([numericLat, numericLng], PLACED_ZOOM);
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Este navegador no permite obtener la ubicacion.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        emit(latitude, longitude, true);
        mapRef.current?.setView([latitude, longitude], PLACED_ZOOM);
      },
      () => setGeoError('No se pudo obtener la ubicacion. Revisa los permisos del navegador.')
    );
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div
        ref={containerRef}
        style={{
          height: '340px',
          width: '100%',
          borderRadius: 'var(--acme-radius-md)',
          border: '1px solid var(--acme-border)',
          overflow: 'hidden',
          // Leaflet usa z-index altos en sus panes; contenerlo evita que
          // los tiles se dibujen por encima de modales y dropdowns.
          zIndex: 0,
          position: 'relative',
          background: 'var(--acme-surface-muted)',
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
            <button type="button" className="btn btn--ghost btn--sm" onClick={centerOnPoint}>
              Centrar en el punto
            </button>
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
              onClick={() => {
                skipRecenterRef.current = true;
                onChangeRef.current({ lat: '', lng: '' });
              }}
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
            onChange={(event) => {
              skipRecenterRef.current = true;
              onChange({ lat: event.target.value, lng });
            }}
          />
        </FieldGroup>
        <FieldGroup label="Longitud" hint="Grados decimales. En Huancavelica es negativa, ej. -74.97125">
          <TextField
            value={lng}
            inputMode="decimal"
            placeholder="-74.97125"
            onChange={(event) => {
              skipRecenterRef.current = true;
              onChange({ lat, lng: event.target.value });
            }}
          />
        </FieldGroup>
      </div>
    </div>
  );
}
