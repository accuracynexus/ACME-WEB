import { Link } from 'react-router-dom';
import { StatusPill } from '../../../../components/admin/AdminScaffold';
import {
  getAdminOrderStatusLabel,
  getAdminOrderStatusTone,
  getMerchantFlowIndex,
  isOrderAwaitingPayment,
  MERCHANT_FLOW_STEPS,
  MerchantStepKind,
  normalizeAdminOrderStatus,
} from '../../../../core/admin/utils/orderWorkflow';
import './OrderFlowUi.css';

/**
 * Piezas del flujo del pedido en el local, compartidas por la bandeja y la
 * ficha para que el semaforo, los iconos y el boton sean los mismos en las dos.
 */

// Semaforo: de rojo (recien llegado, hay que atenderlo) a verde (listo).
const STEP_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#059669'];

/** Icono de cada paso del semaforo, por la key de MERCHANT_FLOW_STEPS. */
function StepIcon({ stepKey, size = 14 }: { stepKey: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, style: { flexShrink: 0 } };
  switch (stepKey) {
    case 'nuevo': // campana
      return <svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
    case 'recibido': // check
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
    case 'preparacion': // olla
      return <svg {...p}><path d="M4 11h16v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M2 11h20" /><path d="M9 4c0 1.5 1 1.5 1 3M14 4c0 1.5 1 1.5 1 3" /></svg>;
    case 'empaquetado': // caja
      return <svg {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></svg>;
    case 'listo': // bolsa lista
      return <svg {...p}><path d="M6 7h12l1 13H5z" /><path d="M9 7a3 3 0 0 1 6 0" /><path d="m9.5 13.5 2 2 3.5-3.5" /></svg>;
    case 'en_camino': // moto
      return <svg {...p}><circle cx="5.5" cy="17.5" r="3" /><circle cx="18.5" cy="17.5" r="3" /><path d="M8.5 17.5h6l3-7h-4" /><path d="M14 6h2.5l2 4.5" /><path d="M5.5 14.5 9 10h5" /></svg>;
    default: // entregado: casa con check
      return <svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="m9 14.5 2 2 4-4" /></svg>;
  }
}

export function OrderTrafficLight({
  status,
  paymentStatus,
  packedAt,
  size = 'sm',
}: {
  status: string;
  paymentStatus: string;
  packedAt?: string | null;
  size?: 'sm' | 'lg';
}) {
  const awaiting = isOrderAwaitingPayment(status, paymentStatus);
  const index = awaiting ? -1 : getMerchantFlowIndex(status, packedAt);
  const label = getAdminOrderStatusLabel(status, paymentStatus, packedAt);

  // Cancelado, sin pagar o ya con el repartidor: no hay paso que marcar.
  if (index < 0) {
    return <StatusPill label={label} tone={getAdminOrderStatusTone(status, paymentStatus)} />;
  }

  const large = size === 'lg';
  return (
    <div className={`order-light ${large ? 'order-light--lg' : ''}`} aria-label={`Estado: ${label}`}>
      <div className="order-light__track">
        {MERCHANT_FLOW_STEPS.map((step, i) => (
          <span
            key={step.key}
            title={step.label}
            className={`order-light__seg ${i === index ? 'is-current' : ''}`}
            style={{ background: i <= index ? STEP_COLORS[i] : undefined }}
          />
        ))}
      </div>
      {large ? (
        <div className="order-light__labels">
          {MERCHANT_FLOW_STEPS.map((step, i) => (
            <span key={step.key} style={{ color: i <= index ? STEP_COLORS[i] : undefined }} className={i === index ? 'is-current' : ''}>
              <StepIcon stepKey={step.key} size={15} />
              {step.label}
            </span>
          ))}
        </div>
      ) : (
        <span className="order-light__label" style={{ color: STEP_COLORS[index] }}>
          <StepIcon stepKey={MERCHANT_FLOW_STEPS[index].key} />
          <b>{label}</b>
        </span>
      )}
    </div>
  );
}

/** Icono del boton que pasa al siguiente paso. */
export function NextStepIcon({ kind }: { kind: MerchantStepKind }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (kind === 'accept') return <svg {...p}><path d="M20 6 9 17l-5-5" /></svg>;
  if (kind === 'preparing') {
    // Olla al fuego.
    return <svg {...p}><path d="M4 11h16v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M2 11h20" /><path d="M9 4c0 1.5 1 1.5 1 3M14 4c0 1.5 1 1.5 1 3" /></svg>;
  }
  if (kind === 'packed') {
    // Caja cerrada.
    return <svg {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></svg>;
  }
  // Listo: bolsa con check.
  return <svg {...p}><path d="M6 7h12l1 13H5z" /><path d="M9 7a3 3 0 0 1 6 0" /><path d="m9.5 13.5 2 2 3.5-3.5" /></svg>;
}

/**
 * Boton "Abrir ficha". Mientras el pedido siga en curso (ni entregado ni
 * cancelado) vibra cada tanto, para que no se quede olvidado en la bandeja.
 */
export function OpenOrderButton({ to, status }: { to: string; status: string }) {
  const normalized = normalizeAdminOrderStatus(status);
  const inProgress = !['delivered', 'cancelled', 'rejected', 'failed'].includes(normalized);
  return (
    <Link to={to} className={`order-open-btn ${inProgress ? 'is-pending' : ''}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
      Abrir ficha
    </Link>
  );
}
