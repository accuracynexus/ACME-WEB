import { useEffect, useRef, useState } from 'react';
import { cargarGoogleMaps, hayClaveDeMapas } from '../../../../core/utils/googleMaps';
import type { SectorPoint } from '../../../../core/services/adminPricingService';

const CENTRO = { lat: -12.7869, lng: -74.9731 };

// Mas caro, mas oscuro: se lee el mapa de precios de un vistazo.
export function colorDePrecio(fee: number, min: number, max: number) {
  const t = max > min ? (fee - min) / (max - min) : 0;
  const tonos = ['#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#9f1239'];
  return tonos[Math.min(tonos.length - 1, Math.floor(t * tonos.length))];
}

function iconoPrecio(fee: number, color: string, activo: boolean): google.maps.Icon {
  const texto = Number.isInteger(fee) ? String(fee) : fee.toFixed(1);
  const w = 14 + texto.length * 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22"><rect x="1" y="1" rx="10" width="${w - 2}" height="20" fill="${color}" stroke="${activo ? '#111827' : '#ffffff'}" stroke-width="${activo ? 3 : 1.5}"/><text x="${w / 2}" y="15" font-family="Arial" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">${texto}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    anchor: new google.maps.Point(w / 2, 11),
  };
}

function iconoPin(color: string, letra: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="2"/><text x="15" y="20" font-family="Arial" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${letra}</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new google.maps.Point(15, 39) };
}

export function PricingMap({
  points,
  coverage,
  selected,
  onPointClick,
  onMapClick,
  origin,
  destination,
  height = 460,
}: {
  points: SectorPoint[];
  coverage: { lat: number; lng: number }[];
  selected?: number | null;
  onPointClick?: (index: number) => void;
  onMapClick?: (pos: { lat: number; lng: number }) => void;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  height?: number;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<google.maps.Map | null>(null);
  const marcadores = useRef<google.maps.Marker[]>([]);
  const pines = useRef<google.maps.Marker[]>([]);
  const poligono = useRef<google.maps.Polygon | null>(null);
  const clickMapa = useRef(onMapClick);
  const clickPunto = useRef(onPointClick);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(hayClaveDeMapas ? null : 'Falta la clave de Google Maps (VITE_GOOGLE_MAPS_API_KEY).');

  clickMapa.current = onMapClick;
  clickPunto.current = onPointClick;

  useEffect(() => {
    if (!hayClaveDeMapas || !contenedor.current) return;
    let vivo = true;
    cargarGoogleMaps()
      .then(() => {
        if (!vivo || !contenedor.current) return;
        mapa.current = new google.maps.Map(contenedor.current, {
          center: CENTRO,
          zoom: 14,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });
        mapa.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) clickMapa.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        setListo(true);
      })
      .catch((e: Error) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!listo || !mapa.current) return;
    poligono.current?.setMap(null);
    if (coverage.length >= 3) {
      poligono.current = new google.maps.Polygon({
        paths: coverage,
        map: mapa.current,
        strokeColor: '#4d148c',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: '#4d148c',
        fillOpacity: 0.05,
        clickable: false,
      });
    }
  }, [listo, coverage]);

  useEffect(() => {
    if (!listo || !mapa.current) return;
    marcadores.current.forEach((m) => m.setMap(null));
    const fees = points.map((p) => p.fee);
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    marcadores.current = points.map((p, i) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapa.current!,
        icon: iconoPrecio(p.fee, colorDePrecio(p.fee, min, max), selected === i),
        title: `${p.sector}: S/ ${p.fee.toFixed(2)}`,
        zIndex: selected === i ? 1000 : 10,
      });
      marker.addListener('click', () => clickPunto.current?.(i));
      return marker;
    });
  }, [listo, points, selected]);

  useEffect(() => {
    if (!listo || !mapa.current) return;
    pines.current.forEach((m) => m.setMap(null));
    pines.current = [];
    if (origin) pines.current.push(new google.maps.Marker({ position: origin, map: mapa.current, icon: iconoPin('#4d148c', 'L'), title: 'Local', zIndex: 2000 }));
    if (destination)
      pines.current.push(new google.maps.Marker({ position: destination, map: mapa.current, icon: iconoPin('#ff6200', 'C'), title: 'Cliente', zIndex: 2000 }));
  }, [listo, origin, destination]);

  if (error) {
    return <div className="cobros-mapa cobros-mapa--error" style={{ height }}>{error} Puedes editar los precios en la tabla de abajo.</div>;
  }
  return <div ref={contenedor} className="cobros-mapa" style={{ height }} />;
}
