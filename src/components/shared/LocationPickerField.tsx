import { useEffect, useRef, useState } from 'react';
import { FieldGroup } from '../admin/AdminFields';
import { TextField } from '../ui/TextField';
import { cargarGoogleMaps } from '../../core/utils/googleMaps';

// Centro de Huancavelica: a donde mira el mapa cuando la sucursal
// todavia no tiene punto.
const DEFAULT_CENTER = { lat: -12.7869, lng: -74.9731 };
const DEFAULT_ZOOM = 14;
const PLACED_ZOOM = 17;

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
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  // onChange se guarda en ref: el mapa se crea una sola vez y el handler
  // de click no debe quedar capturando un closure viejo.
  const onChangeRef = useRef(onChange);
  // Cuando el punto lo movio el propio mapa, el pin ya esta a la vista y
  // recentrar solo produce un salto. Escribir a mano tampoco debe mover la
  // vista en cada tecla: "-12.7" apuntaria a otro pais antes de terminar.
  const skipRecenterRef = useRef(false);
  const centeredOnceRef = useRef(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapaError, setMapaError] = useState<string | null>(null);

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
    let cancelado = false;

    cargarGoogleMaps()
      .then(() => {
        if (cancelado || !containerRef.current || mapRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          // El scroll del mouse mueve la pagina, no el zoom: dentro de un
          // formulario largo, capturarlo desorienta. Quedan los botones y el
          // doble clic.
          gestureHandling: 'cooperative',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          emit(event.latLng.lat(), event.latLng.lng(), true);
        });

        mapRef.current = map;
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        // Sin mapa los campos de latitud y longitud siguen sirviendo, asi que
        // se avisa y se deja seguir en vez de dejar un recuadro gris mudo.
        setMapaError(
          error instanceof Error ? error.message : 'No se pudo cargar el mapa.',
        );
      });

    return () => {
      cancelado = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // Sincronizar el pin cada vez que cambian las coordenadas, vengan del
  // click, de los inputs o del GPS.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasPoint) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    const position = { lat: numericLat, lng: numericLng };

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      const marker = new google.maps.Marker({
        map,
        position,
        draggable: true,
      });
      marker.addListener('dragend', () => {
        const punto = marker.getPosition();
        if (punto) emit(punto.lat(), punto.lng(), true);
      });
      markerRef.current = marker;
    }

    // Solo se centra la primera vez que aparece un punto (al abrir una
    // sucursal ya guardada, por ejemplo). Despues la vista es del usuario.
    if (skipRecenterRef.current) {
      skipRecenterRef.current = false;
      return;
    }
    if (!centeredOnceRef.current) {
      centeredOnceRef.current = true;
      map.setCenter(position);
      map.setZoom(PLACED_ZOOM);
    }
  }, [numericLat, numericLng, hasPoint, mapaError]);

  const centerOnPoint = () => {
    if (!hasPoint || !mapRef.current) return;
    mapRef.current.setCenter({ lat: numericLat, lng: numericLng });
    mapRef.current.setZoom(PLACED_ZOOM);
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
        mapRef.current?.setCenter({ lat: latitude, lng: longitude });
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
          height: '340px',
          width: '100%',
          borderRadius: 'var(--acme-radius-md)',
          border: '1px solid var(--acme-border)',
          overflow: 'hidden',
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

      {mapaError && (
        <span style={{ fontSize: '12.5px', color: 'var(--acme-red)', fontWeight: 600 }} role="alert">
          {mapaError} Puedes escribir la latitud y longitud a mano mas abajo.
        </span>
      )}

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
