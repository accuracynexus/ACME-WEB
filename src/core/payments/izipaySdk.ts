/**
 * Checkout del SDK de Izipay (tarjeta, Yape, Plin, QR).
 *
 * Sigue developers.izipay.pe/web-core, modo embebido: el backend pide el token
 * de sesion y arma la configuracion (pedido, monto, comprador); aqui solo se
 * carga el script, se le indica el contenedor y se recibe la respuesta. La
 * respuesta no se da por buena en el navegador: se manda al backend, que
 * verifica la firma de payloadHttp antes de marcar el pedido.
 */

const SCRIPT_ID = 'izipay-sdk-checkout';

export interface IzipaySdkCheckout {
  /** Token de sesion (un solo uso, 15 minutos). */
  authorization: string;
  /** Llave publica RSA del comercio. */
  key_rsa: string;
  /** Script del SDK (sandbox o produccion, lo decide el backend). */
  script_url: string;
  config: Record<string, unknown>;
}

export interface IzipaySdkResponse {
  code?: string;
  message?: string;
  messageUser?: string;
  /** Respuesta original firmada; es lo unico que el backend toma en cuenta. */
  payloadHttp?: string;
  signature?: string;
  transactionId?: string;
}

interface IzipayCheckoutInstance {
  LoadForm(options: {
    authorization: string;
    keyRSA: string;
    callbackResponse: (response: IzipaySdkResponse) => void;
  }): void;
}

declare global {
  interface Window {
    Izipay?: new (options: { config: Record<string, unknown> }) => IzipayCheckoutInstance;
  }
}

let loadedUrl: string | null = null;
let loadPromise: Promise<void> | null = null;

/** Carga el script del SDK una sola vez por pagina. */
export function loadIzipaySdk(scriptUrl: string): Promise<void> {
  if (loadPromise && loadedUrl === scriptUrl) return loadPromise;
  loadedUrl = scriptUrl;
  loadPromise = new Promise<void>((resolve, reject) => {
    const fail = () => {
      loadPromise = null;
      reject(new Error('No se pudo cargar la pasarela de Izipay.'));
    };
    const waitForIzipay = () => {
      const started = Date.now();
      const tick = () => {
        if (window.Izipay) return resolve();
        if (Date.now() - started > 15000) return fail();
        window.setTimeout(tick, 50);
      };
      tick();
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing && existing.src === scriptUrl) {
      waitForIzipay();
      return;
    }
    existing?.remove();
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = scriptUrl;
    script.onload = waitForIzipay;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Muestra el checkout dentro del contenedor indicado (por id). Cada token
 * sirve una sola vez: para reintentar hay que pedir otro al backend.
 */
export async function mountIzipaySdk(
  checkout: IzipaySdkCheckout,
  containerId: string,
  onResponse: (response: IzipaySdkResponse) => void,
): Promise<void> {
  await loadIzipaySdk(checkout.script_url);
  const Izipay = window.Izipay;
  if (!Izipay) throw new Error('No se pudo cargar la pasarela de Izipay.');
  const config = {
    ...checkout.config,
    render: { typeForm: 'embedded', container: `#${containerId}`, showButtonProcessForm: true },
  };
  const instance = new Izipay({ config });
  instance.LoadForm({
    authorization: checkout.authorization,
    keyRSA: checkout.key_rsa,
    callbackResponse: onResponse,
  });
}

/** Codigos con los que Izipay no sabe si se cobro: la respuesta no viene firmada. */
export function isIzipaySdkUnknown(response: IzipaySdkResponse): boolean {
  return !response.payloadHttp || !response.signature || response.code === '021' || response.code === 'COMMUNICATION_ERROR';
}

/** Para pasar el checkout a /pagar en la app movil, dentro del fragmento de la URL. */
export function encodeIzipaySdkCheckout(checkout: IzipaySdkCheckout): string {
  const bytes = new TextEncoder().encode(JSON.stringify(checkout));
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeIzipaySdkCheckout(value: string): IzipaySdkCheckout | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data && typeof data.authorization === 'string' && typeof data.script_url === 'string' && data.config) {
      return data as IzipaySdkCheckout;
    }
  } catch {
    // Fragmento roto: la pagina muestra el error.
  }
  return null;
}
