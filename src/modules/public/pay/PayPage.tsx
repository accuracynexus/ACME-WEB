import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './PayPage.css';

/**
 * Página que hospeda el checkout de Culqi para la app móvil.
 *
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

export function PayPage() {
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
