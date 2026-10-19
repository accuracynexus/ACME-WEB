import { useEffect, useState } from 'react';
import { publicCustomerService, type MyOrderRatingRecord } from '../../../core/services/publicCustomerService';

function StarPicker({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="orders-rating__stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
          className={`orders-rating__star ${star <= value ? 'orders-rating__star--on' : ''}`}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Cuando el pedido llega, el cliente califica al negocio y al repartidor.
 * Se puede corregir despues: la base guarda una sola calificacion por pedido.
 */
export function OrderRatingPanel({ orderId, merchantLabel, withDriver }: { orderId: string; merchantLabel: string; withDriver: boolean }) {
  const [existing, setExisting] = useState<MyOrderRatingRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [merchantScore, setMerchantScore] = useState(0);
  const [driverScore, setDriverScore] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicCustomerService.fetchMyOrderRatings()
      .then((result) => {
        if (cancelled) return;
        const found = result.data?.find((row) => row.order_id === orderId) ?? null;
        setExisting(found);
        if (found) {
          setMerchantScore(found.merchant_score);
          setDriverScore(found.driver_score ?? 0);
          setComment(found.comment);
        }
      })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [orderId]);

  if (!loaded) return null;

  const submit = async () => {
    if (merchantScore < 1) {
      setError('Elige de 1 a 5 estrellas para el local.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await publicCustomerService.submitOrderRating(orderId, merchantScore, driverScore || null, comment);
    setSaving(false);
    if (result.error) {
      setError(result.error.message || 'No pudimos guardar tu calificación. Intenta de nuevo.');
      return;
    }
    const refreshed = await publicCustomerService.fetchMyOrderRatings().catch(() => null);
    const saved = refreshed?.data?.find((row) => row.order_id === orderId) ?? {
      order_id: orderId,
      merchant_score: merchantScore,
      driver_score: driverScore || null,
      comment,
      rated_at: new Date().toISOString(),
      has_driver: driverScore > 0,
    };
    setExisting(saved);
    setEditing(false);
  };

  if (existing && !editing) {
    return (
      <div className="orders-panel orders-rating">
        <h2>Tu calificación</h2>
        <p className="orders-rating__summary">
          {merchantLabel}: <strong>{'★'.repeat(existing.merchant_score)}</strong>
          {existing.driver_score ? <> · Repartidor: <strong>{'★'.repeat(existing.driver_score)}</strong></> : null}
        </p>
        {existing.comment && <p className="orders-rating__comment">“{existing.comment}”</p>}
        <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Cambiar calificación</button>
      </div>
    );
  }

  return (
    <div className="orders-panel orders-rating">
      <h2>¿Qué tal tu pedido?</h2>
      <div className="orders-rating__row">
        <span>El local ({merchantLabel})</span>
        <StarPicker value={merchantScore} onChange={setMerchantScore} label="Calificación del local" />
      </div>
      {withDriver && (
        <div className="orders-rating__row">
          <span>El repartidor</span>
          <StarPicker value={driverScore} onChange={setDriverScore} label="Calificación del repartidor" />
        </div>
      )}
      <textarea
        className="orders-rating__textarea"
        placeholder="Cuéntanos algo más (opcional)"
        maxLength={500}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      {error && <div className="account-alert account-alert--error">{error}</div>}
      <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit()}>
        {saving ? 'Enviando…' : existing ? 'Guardar cambios' : 'Enviar calificación'}
      </button>
    </div>
  );
}
