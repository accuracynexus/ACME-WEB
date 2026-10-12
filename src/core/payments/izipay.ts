/**
 * Formulario incrustado de Izipay (krypton-client V4).
 *
 * Sigue el ejemplo oficial github.com/izipay-pe/Embedded-PaymentForm-React,
 * sin la libreria embedded-form-glue: se carga el script en modo SPA con la
 * clave publica, se le pasa el formToken que crea el backend y se monta en un
 * contenedor. Las claves privadas viven solo en el backend; aqui solo llegan
 * el formToken y la clave publica, que el backend devuelve junto al pedido.
 */

const IZIPAY_STATIC = 'https://static.micuentaweb.pe';
const SCRIPT_ID = 'izipay-krypton-client';
const THEME_CSS_ID = 'izipay-krypton-theme-css';
const THEME_JS_ID = 'izipay-krypton-theme-js';

export interface IzipayPaymentData {
  /** kr-answer: el JSON firmado, tal cual lo envio Izipay. */
  rawClientAnswer: string;
  /** kr-hash: la firma HMAC-SHA-256 de rawClientAnswer. */
  hash: string;
  /** kr-hash-key: con que clave se firmo ("sha256_hmac" en el navegador). */
  hashKey?: string;
  clientAnswer?: { orderStatus?: string; orderDetails?: { orderId?: string } };
}

interface KryptonError {
  errorCode?: string;
  errorMessage?: string;
  detailedErrorMessage?: string;
}

interface Krypton {
  setFormConfig(config: Record<string, unknown>): Promise<unknown>;
  renderElements(selector: string): Promise<unknown>;
  removeForms(): Promise<unknown>;
  onSubmit(callback: (data: IzipayPaymentData) => boolean | void): Promise<unknown>;
  onError(callback: (error: KryptonError) => void): Promise<unknown>;
}

declare global {
  interface Window {
    KR?: Krypton;
  }
}

let loadedPublicKey: string | null = null;
let loadPromise: Promise<Krypton> | null = null;

function addOnce(id: string, create: () => HTMLElement) {
  if (document.getElementById(id)) return;
  const el = create();
  el.id = id;
  document.head.appendChild(el);
}

/** Carga el cliente de Izipay una sola vez por pagina. */
export function loadIzipay(publicKey: string): Promise<Krypton> {
  if (loadPromise && loadedPublicKey === publicKey) return loadPromise;

  addOnce(THEME_CSS_ID, () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${IZIPAY_STATIC}/static/js/krypton-client/V4.0/ext/classic-reset.css`;
    return link;
  });

  loadedPublicKey = publicKey;
  loadPromise = new Promise<Krypton>((resolve, reject) => {
    const fail = () => {
      loadPromise = null;
      reject(new Error('No se pudo cargar la pasarela de Izipay.'));
    };
    const waitForKR = () => {
      const started = Date.now();
      const tick = () => {
        if (window.KR) return resolve(window.KR);
        if (Date.now() - started > 15000) return fail();
        window.setTimeout(tick, 50);
      };
      tick();
    };

    if (document.getElementById(SCRIPT_ID)) {
      waitForKR();
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `${IZIPAY_STATIC}/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js`;
    script.setAttribute('kr-public-key', publicKey);
    script.setAttribute('kr-language', 'es-ES');
    script.setAttribute('kr-spa-mode', 'true');
    script.onload = () => {
      // El tema "classic" se carga despues del cliente, como en el ejemplo.
      addOnce(THEME_JS_ID, () => {
        const theme = document.createElement('script');
        theme.src = `${IZIPAY_STATIC}/static/js/krypton-client/V4.0/ext/classic.js`;
        return theme;
      });
      waitForKR();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loadPromise;
}

export interface MountIzipayOptions {
  publicKey: string;
  formToken: string;
  /** Selector del contenedor (debe existir y contener un div.kr-embedded). */
  selector: string;
  onPaid: (data: IzipayPaymentData) => void;
  onError?: (message: string) => void;
}

/**
 * Monta el formulario en el contenedor. Devuelve una funcion para
 * desmontarlo. El resultado del pago no se da por bueno aqui: se manda al
 * backend, que verifica la firma antes de marcar el pedido.
 */
export async function mountIzipayForm(options: MountIzipayOptions): Promise<() => void> {
  const KR = await loadIzipay(options.publicKey);
  await KR.removeForms().catch(() => undefined);
  await KR.setFormConfig({ formToken: options.formToken, 'kr-language': 'es-ES' });
  await KR.renderElements(options.selector);

  await KR.onSubmit((data) => {
    options.onPaid(data);
    // false: no navegar a kr-post-success-url; la pagina decide que hacer.
    return false;
  });
  await KR.onError((error) => {
    const message = error?.detailedErrorMessage || error?.errorMessage;
    // Los avisos de validacion de campos ya se ven en el formulario.
    if (message && options.onError) options.onError(message);
  });

  return () => {
    void KR.removeForms().catch(() => undefined);
  };
}
