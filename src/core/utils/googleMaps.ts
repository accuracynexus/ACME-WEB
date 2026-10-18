/// Carga del SDK de Google Maps para la web.
///
/// El script se inyecta una sola vez y se comparte entre todas las pantallas:
/// cargarlo dos veces hace que Google imprima un aviso en consola y vuelva a
/// descargar ~300 KB sin necesidad.
///
/// La clave viaja en la URL del script, o sea que es pública: cualquiera que
/// abra el inspector la ve. Eso es inevitable en una web, y por eso la clave
/// del sitio **no puede ser la misma que la de las apps Android**: la del
/// sitio tiene que estar restringida por referente HTTP a nuestros dominios,
/// y Google solo admite un tipo de restricción por clave.

const CLAVE = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

const ID_SCRIPT = 'google-maps-js';

let promesa: Promise<void> | null = null;

/** ¿Hay clave configurada? Sin ella no tiene sentido intentar cargar nada. */
export const hayClaveDeMapas = CLAVE.length > 0;

/**
 * Carga el SDK y resuelve cuando `window.google.maps` está disponible.
 * Las llamadas siguientes reutilizan la misma promesa.
 */
export function cargarGoogleMaps(): Promise<void> {
  if (promesa) return promesa;

  if (!hayClaveDeMapas) {
    return Promise.reject(
      new Error(
        'Falta VITE_GOOGLE_MAPS_API_KEY en el .env. Ojo: en Vite solo las ' +
          'variables con prefijo VITE_ llegan al navegador.',
      ),
    );
  }

  promesa = new Promise<void>((resolver, rechazar) => {
    if (typeof window !== 'undefined' && window.google?.maps) {
      resolver();
      return;
    }

    const existente = document.getElementById(ID_SCRIPT) as HTMLScriptElement | null;
    if (existente) {
      existente.addEventListener('load', () => resolver());
      existente.addEventListener('error', () => rechazar(new Error('No se pudo cargar Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.id = ID_SCRIPT;
    script.async = true;
    script.defer = true;
    // `language` y `region` dejan los rótulos y el formato en español de Perú.
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(CLAVE)}&v=weekly&language=es&region=PE`;
    script.onload = () => resolver();
    script.onerror = () => {
      // Se limpia para que un fallo de red puntual no deje la promesa
      // rechazada para siempre.
      promesa = null;
      script.remove();
      rechazar(new Error('No se pudo cargar Google Maps'));
    };
    document.head.appendChild(script);
  });

  return promesa;
}
