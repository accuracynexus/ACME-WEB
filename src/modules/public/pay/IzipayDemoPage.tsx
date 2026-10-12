import { useEffect, useState } from 'react';
import { IzipayForm } from './IzipayForm';
import { IzipayPaymentData } from '../../../core/payments/izipay';
import { courierPaymentService, IzipayDemoResponse } from '../../../core/services/courierPaymentService';
import './PayPage.css';

/**
 * Boton de pago de Izipay por un monto fijo, sin pedido. Existe para que
 * Izipay valide el sitio; el carrito sigue con la pasarela que diga el backend.
 * Solo funciona si el backend tiene IZIPAY_DEMO_ENABLED.
 */
export function IzipayDemoPage() {
  const [demo, setDemo] = useState<IzipayDemoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = () => {
    setDemo(null);
    setError(null);
    setResult(null);
    courierPaymentService
      .createIzipayDemo()
      .then(setDemo)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo abrir la pasarela de pago.'));
  };

  useEffect(load, []);

  const handlePaid = (data: IzipayPaymentData) => {
    setConfirming(true);
    courierPaymentService
      .confirmIzipayDemo({ kr_answer: data.rawClientAnswer, kr_hash: data.hash, kr_hash_key: data.hashKey })
      .then((res) => setResult(res.exito ? 'Pago aprobado. ¡Gracias!' : res.mensaje))
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago.'))
      .finally(() => setConfirming(false));
  };

  return (
    <main className="pay">
      <section className="pay__card">
        <h1 className="pay__title">ACME Pedidos · Pago con Izipay</h1>
        {demo && <p className="pay__amount">S/ {(demo.monto_centimos / 100).toFixed(2)}</p>}
        <p className="pay__name">Pago de demostración de la pasarela</p>
        {demo?.mode === 'TEST' && <p className="pay__test">Modo de prueba: no se cobra dinero real.</p>}
        {error && <p className="pay__error">{error}</p>}
        {confirming && <p className="pay__hint">Confirmando tu pago…</p>}
        {result ? (
          <>
            <p className="pay__hint">{result}</p>
            <button type="button" className="pay__btn" onClick={load}>Hacer otro pago</button>
          </>
        ) : (
          demo && !confirming && (
            <IzipayForm formToken={demo.form_token} publicKey={demo.public_key} onPaid={handlePaid} onError={setError} />
          )
        )}
        {!demo && !error && <p className="pay__hint">Abriendo la pasarela segura de Izipay…</p>}
      </section>
    </main>
  );
}
