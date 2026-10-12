import { useEffect, useId, useRef, useState } from 'react';
import { IzipaySdkCheckout, IzipaySdkResponse, mountIzipaySdk } from '../../../core/payments/izipaySdk';
import './IzipaySdkForm.css';

interface IzipaySdkFormProps {
  checkout: IzipaySdkCheckout;
  onResponse: (response: IzipaySdkResponse) => void;
}

/** Checkout del SDK de Izipay (tarjeta, Yape, Plin, QR) para un token ya creado por el backend. */
export function IzipaySdkForm({ checkout, onResponse }: IzipaySdkFormProps) {
  const id = `izipay-sdk-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // El callback cambia en cada render; el checkout se monta una sola vez por token.
  const handler = useRef(onResponse);
  handler.current = onResponse;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    mountIzipaySdk(checkout, id, (response) => {
      if (!cancelled) handler.current(response);
    })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'No se pudo abrir la pasarela de pago.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      const container = document.getElementById(id);
      if (container) container.innerHTML = '';
    };
  }, [checkout, id]);

  return (
    <div className="izipay-form">
      {loading && <p className="izipay-form__hint">Abriendo la pasarela segura de Izipay…</p>}
      {loadError && <p className="izipay-form__error">{loadError}</p>}
      <div id={id} className="izipay-sdk-container" />
    </div>
  );
}
