import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { IzipayPaymentData } from '../../../core/payments/izipay';
import { courierPaymentService } from '../../../core/services/courierPaymentService';
import { IzipayForm } from './IzipayForm';
import { IzipaySdkForm } from './IzipaySdkForm';
import { decodeIzipaySdkCheckout, isIzipaySdkUnknown, type IzipaySdkResponse } from '../../../core/payments/izipaySdk';
import './PayPage.css';

/**
 * Página que hospeda la pasarela de pago para la app móvil.
 *
 * Con el SDK de Izipay (pasarela=izipay_sdk: tarjeta, Yape, Plin, QR) la app
 * manda en el fragmento (#c=...) la configuracion del checkout que le dio el
 * backend, en JSON y base64url. Vuelve a la app igual que con el formulario.
 *
 * Con Izipay (pasarela=izipay) la app manda por el fragmento de la URL
 * (#token=...&pk=...) el formToken y la clave pública que le dio el backend;
 * el fragmento no viaja al servidor. Al pagar, esta página manda la respuesta
 * firmada al backend y vuelve a la app con `acme://culqi?pagado=1`; la app
 * consulta el estado del pedido con su propia sesión.
 *
 * Con Culqi (respaldo):
 * Culqi Checkout es JavaScript y no hay plugin de Flutter, así que la app la
 * abre dentro de una vista web. Aquí solo llegan datos públicos por la URL —la
 * orden de Culqi, el monto y el nombre—; la sesión del cliente nunca sale de la
 * app. Cuando Culqi devuelve el token, se redirige a `acme://culqi?token=...`,
 * que la app intercepta para hacer el cobro con su propia sesión.
 *
 * No se enlaza desde ningún menú: sin los parámetros no hace nada.
 */

const CULQI_SCRIPT_ID = 'culqi-checkout-v4-pay';
const SENTINELA = 'acme://culqi';

// window.Culqi y window.culqi ya estan declarados en CartPage.tsx; declararlos
// otra vez con una forma distinta rompe la compilacion.

function cargarCulqi(): Promise<void> {
  if (window.Culqi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existente = document.getElementById(CULQI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existente) {
      existente.addEventListener('load', () => resolve(), { once: true });
      existente.addEventListener('error', () => reject(new Error('carga')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = CULQI_SCRIPT_ID;
    s.src = 'https://checkout.culqi.com/js/v4';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('carga'));
    document.body.appendChild(s);
  });
}

function volverALaApp(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  window.location.href = `${SENTINELA}?${q}`;
}

function IzipayPay() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const formToken = fragment.get('token') ?? '';
  const publicKey = fragment.get('pk') ?? '';
  const pedidoId = params.get('pedido_id') ?? '';
  const monto = Number(params.get('monto') ?? 0);
  const nombre = params.get('nombre') ?? 'Cliente';
  const pedido = params.get('pedido');
  const modo = params.get('modo');
  const [estado, setEstado] = useState<'form' | 'confirmando'>('form');
  const [error, setError] = useState<string | null>(
    formToken && publicKey && pedidoId ? null : 'Faltan datos del pago. Vuelve a intentarlo desde la app.'
  );

  const alPagar = async (data: IzipayPaymentData) => {
    setEstado('confirmando');
    try {
      const r = await courierPaymentService.confirmIzipay({
        order_id: pedidoId,
        kr_answer: data.rawClientAnswer,
        kr_hash: data.hash,
        kr_hash_key: data.hashKey,
      });
      if (r.payment_status === 'failed') {
        volverALaApp({ error: r.mensaje || 'El pago no se completó.' });
      } else {
        volverALaApp(r.payment_status === 'paid' ? { pagado: '1' } : { pendiente: '1' });
      }
    } catch {
      // Izipay ya cobró y avisará al backend por la IPN; la app lo consulta.
      volverALaApp({ pendiente: '1' });
    }
  };

  return (
    <main className="pay">
      <div className="pay__card">
        <h1 className="pay__title">{pedido ? `Pedido #${pedido}` : 'Pagar pedido'}</h1>
        <p className="pay__amount">S/ {(monto / 100).toFixed(2)}</p>
        <p className="pay__name">{nombre}</p>
        {modo === 'TEST' && <p className="pay__test">Modo de prueba: no se cobra dinero real.</p>}

        {error ? (
          <>
            <p className="pay__error">{error}</p>
            <button type="button" className="pay__btn" onClick={() => volverALaApp({ error })}>
              Volver a la app
            </button>
          </>
        ) : estado === 'confirmando' ? (
          <p className="pay__hint">Confirmando tu pago…</p>
        ) : (
          <IzipayForm formToken={formToken} publicKey={publicKey} onPaid={(d) => void alPagar(d)} />
        )}
      </div>
    </main>
  );
}

function IzipaySdkPay() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const [checkout] = useState(() => decodeIzipaySdkCheckout(new URLSearchParams(hash.replace(/^#/, '')).get('c') ?? ''));
  const pedidoId = params.get('pedido_id') ?? '';
  const monto = Number(params.get('monto') ?? 0);
  const nombre = params.get('nombre') ?? 'Cliente';
  const pedido = params.get('pedido');
  const modo = params.get('modo');
  const [estado, setEstado] = useState<'form' | 'confirmando'>('form');
  const error = checkout && pedidoId ? null : 'Faltan datos del pago. Vuelve a intentarlo desde la app.';

  const alResponder = async (response: IzipaySdkResponse) => {
    setEstado('confirmando');
    if (isIzipaySdkUnknown(response)) {
      volverALaApp({ pendiente: '1' });
      return;
    }
    try {
      const r = await courierPaymentService.confirmIzipaySdk({
        order_id: pedidoId,
        payload_http: response.payloadHttp as string,
        signature: response.signature as string,
      });
      if (r.payment_status === 'failed') {
        volverALaApp({ error: r.mensaje || 'El pago no se completó.' });
      } else {
        volverALaApp(r.payment_status === 'paid' ? { pagado: '1' } : { pendiente: '1' });
      }
    } catch {
      // Si Izipay cobró, avisará al backend por la IPN; la app lo consulta.
      volverALaApp({ pendiente: '1' });
    }
  };

  return (
    <main className="pay">
      <div className="pay__card">
        <h1 className="pay__title">{pedido ? `Pedido #${pedido}` : 'Pagar pedido'}</h1>
        <p className="pay__amount">S/ {(monto / 100).toFixed(2)}</p>
        <p className="pay__name">{nombre}</p>
        {modo === 'TEST' && <p className="pay__test">Modo de prueba: no se cobra dinero real.</p>}

        {error || !checkout ? (
          <>
            <p className="pay__error">{error}</p>
            <button type="button" className="pay__btn" onClick={() => volverALaApp({ error: error || 'Faltan datos del pago.' })}>
              Volver a la app
            </button>
          </>
        ) : estado === 'confirmando' ? (
          <p className="pay__hint">Confirmando tu pago…</p>
        ) : (
          <IzipaySdkForm checkout={checkout} onResponse={(r) => void alResponder(r)} />
        )}
      </div>
    </main>
  );
}

export function PayPage() {
  const [params] = useSearchParams();
  if (params.get('pasarela') === 'izipay_sdk') return <IzipaySdkPay />;
  if (params.get('pasarela') === 'izipay') return <IzipayPay />;
  return <CulqiPay />;
}

function CulqiPay() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const yaAbrio = useRef(false);

  const orden = params.get('orden') ?? '';
  const monto = Number(params.get('monto') ?? 0);
  const nombre = params.get('nombre') ?? 'Cliente';
  const pedido = params.get('pedido');

  useEffect(() => {
    if (yaAbrio.current) return;

    const publicKey = String(import.meta.env.VITE_CULQI_PUBLIC_KEY || '').trim();
    if (!publicKey) {
      setError('Falta configurar la llave de Culqi.');
      return;
    }
    if (!orden || !monto) {
      setError('Faltan datos del pago. Vuelve a intentarlo desde la app.');
      return;
    }

    yaAbrio.current = true;
    const rsaId = String(import.meta.env.VITE_CULQI_RSA_ID || '').trim();
    const rsaKey = String(import.meta.env.VITE_CULQI_RSA_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
    const puedeTarjeta = Boolean(rsaId && rsaKey);

    cargarCulqi()
      .then(() => {
        const culqi = window.Culqi;
        if (!culqi) throw new Error('sin culqi');

        // Culqi llama a esta función global al terminar.
        window.culqi = () => {
          const c = window.Culqi;
          if (c?.token?.id) {
            c.close?.();
            volverALaApp({ token: c.token.id });
          } else if (c?.order) {
            // PagoEfectivo, banca movil, agentes o billeteras: Culqi genero el
            // codigo y el cliente paga despues. La app deja el pedido esperando
            // pago y lo confirma sola cuando Culqi registra el pago.
            const orden = c.order as { payment_code?: string; cip?: string };
            const codigo = orden.payment_code || orden.cip || '';
            c.close?.();
            volverALaApp(codigo ? { pendiente: '1', cip: String(codigo) } : { pendiente: '1' });
          } else if (c?.error) {
            setError(c.error.user_message || 'No se pudo procesar el pago.');
          }
        };

        culqi.publicKey = publicKey;
        const settings: Record<string, unknown> = {
          title: 'ACME Pedidos',
          currency: 'PEN',
          amount: monto,
          order: orden,
        };
        if (puedeTarjeta) {
          settings.xculqirsaid = rsaId;
          settings.rsapublickey = rsaKey;
        }
        culqi.settings(settings);
        culqi.options({
          lang: 'es',
          installments: false,
          paymentMethods: {
            tarjeta: puedeTarjeta,
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
        setAbierto(true);
      })
      .catch(() => setError('No se pudo abrir la pasarela de pago.'));
  }, [orden, monto]);

  return (
    <main className="pay">
      <div className="pay__card">
        <h1 className="pay__title">
          {pedido ? `Pedido #${pedido}` : 'Pagar pedido'}
        </h1>
        <p className="pay__amount">S/ {(monto / 100).toFixed(2)}</p>
        <p className="pay__name">{nombre}</p>

        {error ? (
          <>
            <p className="pay__error">{error}</p>
            <button
              type="button"
              className="pay__btn"
              onClick={() => volverALaApp({ error })}
            >
              Volver a la app
            </button>
          </>
        ) : (
          <p className="pay__hint">
            {abierto
              ? 'Completa el pago en la ventana de Culqi.'
              : 'Abriendo la pasarela segura…'}
          </p>
        )}
      </div>
    </main>
  );
}
