import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { cargarGoogleMaps } from '../../../core/utils/googleMaps';

type GeoPoint = { lat: number; lng: number };

// Zoom de apertura: en celular muestra la ciudad y en computadora casi toda el area.
const OPEN_ZOOM = 14;
// Tope al encuadrar local y entrega muy cercanos.
const MAX_FIT_ZOOM = 16;

/**
 * El mapa de ruta del carrito sobre Google Maps: mismo dibujo que la version
 * Leaflet (area de cobertura, pin del local, pin de entrega arrastrable y la
 * ruta), con calles y puntos mas exactos.
 *
 * Solo se usa cuando hay VITE_GOOGLE_MAPS_API_KEY; sin clave el carrito sigue
 * con Leaflet (ver DeliveryRouteMap en CartPage).
 */
export function useGoogleRouteMap(params: {
  enabled: boolean;
  mapElementRef: MutableRefObject<HTMLDivElement | null>;
  coverage: GeoPoint[];
  origin: GeoPoint | null;
  originLabel: string;
  destination: GeoPoint | null;
  route: GeoPoint[];
  routeSource: string;
  interactive: boolean;
  onDestinationChange: (point: GeoPoint) => void;
  originIconUrl: string;
  destinationIconUrl: string;
  /** Donde mira el mapa si el local no tiene punto (la plaza). */
  fallbackCenter: GeoPoint;
}) {
  const { enabled, mapElementRef } = params;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const coverageRef = useRef<google.maps.Polygon | null>(null);
  const originRef = useRef<google.maps.Marker | null>(null);
  const destinationRef = useRef<google.maps.Marker | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const fittedKeyRef = useRef('');
  // Los listeners del SDK se registran una vez: leen siempre lo ultimo.
  const latest = useRef(params);
  latest.current = params;

  // Crear el mapa una vez.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    cargarGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || mapRef.current) return;
        const first = latest.current.origin ?? latest.current.fallbackCenter;
        const map = new google.maps.Map(mapElementRef.current, {
          center: first,
          zoom: OPEN_ZOOM,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          // Abajo a la derecha va el distintivo de cobertura y arriba a la
          // izquierda "Mi ubicacion": el zoom queda arriba a la derecha.
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
          // Las versiones nuevas del SDK reemplazan el zoom por este control,
          // que por defecto cae abajo a la derecha, encima del distintivo.
          cameraControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
        });
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!latest.current.interactive || !event.latLng) return;
          latest.current.onDestinationChange({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, mapElementRef]);

  // Limpieza al desmontar.
  useEffect(() => {
    return () => {
      [coverageRef, originRef, destinationRef, routeRef].forEach((ref) => ref.current?.setMap(null));
      mapRef.current = null;
    };
  }, []);

  // Sincronizar el dibujo con los datos.
  const { coverage, origin, originLabel, destination, route, routeSource, interactive, originIconUrl, destinationIconUrl } = params;
  useEffect(() => {
    const map = mapRef.current;
    if (!enabled || !ready || !map) return;

    if (!coverageRef.current) {
      coverageRef.current = new google.maps.Polygon({
        map,
        paths: coverage,
        // Borde fino y continuo, igual que en Leaflet.
        strokeColor: '#4d148c',
        strokeOpacity: 0.45,
        strokeWeight: 1,
        fillColor: '#4d148c',
        fillOpacity: 0.07,
        clickable: false,
      });
    } else {
      coverageRef.current.setPaths(coverage);
    }

    const pinIcon = (url: string): google.maps.Icon => ({
      url,
      scaledSize: new google.maps.Size(34, 44),
      anchor: new google.maps.Point(17, 44),
    });

    if (!origin) {
      originRef.current?.setMap(null);
      originRef.current = null;
    } else if (!originRef.current) {
      originRef.current = new google.maps.Marker({ map, position: origin, icon: pinIcon(originIconUrl), title: originLabel || 'Tienda', clickable: false });
    } else {
      originRef.current.setPosition(origin);
      originRef.current.setTitle(originLabel || 'Tienda');
    }

    if (!destination) {
      destinationRef.current?.setMap(null);
      destinationRef.current = null;
      routeRef.current?.setMap(null);
      routeRef.current = null;
    } else {
      if (!destinationRef.current) {
        const marker = new google.maps.Marker({
          map,
          position: destination,
          icon: pinIcon(destinationIconUrl),
          title: 'Destino',
          draggable: interactive,
          zIndex: 1000,
        });
        marker.addListener('dragend', () => {
          const next = marker.getPosition();
          if (next) latest.current.onDestinationChange({ lat: next.lat(), lng: next.lng() });
        });
        destinationRef.current = marker;
      } else {
        destinationRef.current.setPosition(destination);
        destinationRef.current.setDraggable(interactive);
      }

      const path = route.length > 1 ? route : origin ? [origin, destination] : [];
      const isRoad = routeSource === 'road';
      // La linea directa (sin ruta por calles) va punteada, como en Leaflet.
      const style: google.maps.PolylineOptions = isRoad
        ? { strokeColor: '#4d148c', strokeOpacity: 0.9, strokeWeight: 6, icons: [] }
        : {
            strokeColor: '#f59e0b',
            strokeOpacity: 0,
            strokeWeight: 4,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeWeight: 4, scale: 3 }, offset: '0', repeat: '14px' }],
          };
      if (!routeRef.current) {
        routeRef.current = new google.maps.Polyline({ map, path, clickable: false, ...style });
      } else {
        routeRef.current.setPath(path);
        routeRef.current.setOptions(style);
      }
    }

    // Encuadre automatico una vez por local, como en Leaflet; despues la
    // vista es del cliente.
    const fitKey = origin ? `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}` : 'sin-origen';
    if (fittedKeyRef.current !== fitKey) {
      fittedKeyRef.current = fitKey;
      if (!destination) {
        // El area es larga de este a oeste: verla entera la deja muy lejos en
        // el celular. Se abre centrada en el local (o la plaza) a zoom 14.
        map.setCenter(origin ?? latest.current.fallbackCenter);
        map.setZoom(OPEN_ZOOM);
      } else {
        // Con entrega se encuadra el local, la entrega y la ruta, sin toda el
        // area: incluirla alejaba la vista igual que antes.
        const bounds = new google.maps.LatLngBounds();
        if (origin) bounds.extend(origin);
        bounds.extend(destination);
        route.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 48);
        google.maps.event.addListenerOnce(map, 'idle', () => {
          const zoom = map.getZoom() ?? OPEN_ZOOM;
          if (zoom > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
        });
      }
    }
  }, [enabled, ready, coverage, origin, originLabel, destination, route, routeSource, interactive, originIconUrl, destinationIconUrl]);

  return { error };
}
