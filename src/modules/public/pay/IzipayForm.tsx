import { useEffect, useId, useRef, useState } from 'react';
import { IzipayPaymentData, mountIzipayForm } from '../../../core/payments/izipay';

interface IzipayFormProps {
  formToken: string;
  publicKey: string;
  onPaid: (data: IzipayPaymentData) => void;
  onError?: (message: string) => void;
}

/** Formulario incrustado de Izipay para un formToken ya creado por el backend. */
export function IzipayForm({ formToken, publicKey, onPaid, onError }: IzipayFormProps) {
  const id = `izipay-form-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Los callbacks cambian en cada render; el formulario se monta una sola vez
  // por formToken, asi que se leen desde una referencia.
  const handlers = useRef({ onPaid, onError });
  handlers.current = { onPaid, onError };

  useEffect(() => {
    let unmount: (() => void) | null = null;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    mountIzipayForm({
      publicKey,
      formToken,
      selector: `#${id}`,
      onPaid: (data) => handlers.current.onPaid(data),
      onError: (message) => handlers.current.onError?.(message),
    })
      .then((fn) => {
        if (cancelled) fn();
        else unmount = fn;
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'No se pudo abrir la pasarela de pago.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [formToken, publicKey, id]);

  return (
    <div className="izipay-form">
      {loading && <p className="izipay-form__hint">Abriendo la pasarela segura de Izipay…</p>}
      {loadError && <p className="izipay-form__error">{loadError}</p>}
      <div id={id}>
        <div className="kr-embedded" />
      </div>
    </div>
  );
}
