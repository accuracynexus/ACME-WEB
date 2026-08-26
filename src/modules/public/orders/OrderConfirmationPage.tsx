import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { publicCustomerService, type CustomerOrderHistoryRecord } from '../../../core/services/publicCustomerService';
import { usePublicStore } from '../store/PublicStoreContext';
import {
  ORDER_STEPS,
  currentStepIndex,
  isOrderActive,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
} from './orderStatus';
import './Orders.css';

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const publicStore = usePublicStore();
  const [order, setOrder] = useState<CustomerOrderHistoryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!publicStore.sessionUser || !orderId) { setLoading(false); return; }
    try {
      const result = await publicCustomerService.fetchAccountSnapshot(publicStore.sessionUser.id);
      setOrder(result.data?.orders.find((o) => o.id === orderId) ?? null);
    } finally {
      setLoading(false);
    }
  }, [publicStore.sessionUser, orderId]);

  useEffect(() => { void load(); }, [load]);

  // Mientras el pedido siga en curso se refresca solo.
  useEffect(() => {
    if (!order || !isOrderActive(order.status)) return;
    const timer = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(timer);
  }, [order, load]);

  if (loading) {
    return <section className="orders-page"><div className="orders-container"><p className="orders-muted">Cargando tu pedido…</p></div></section>;
  }

  if (!order) {
    return (
      <section className="orders-page">
        <div className="orders-container orders-empty">
          <h1>No encontramos ese pedido</h1>
          <Link to={AppRoutes.public.myOrders} className="btn-primary">Ver mis pedidos</Link>
        </div>
      </section>
    );
  }

  const pagado = order.payment_status === 'paid';
  const cancelado = order.status === 'cancelled' || order.status === 'failed';
  const paso = currentStepIndex(order.status);
  const tone = orderStatusTone(order.status);

  return (
    <section className="orders-page">
      <div className="orders-container orders-confirm">
        <div className="orders-confirm__hero" style={{ borderColor: `${tone}40` }}>
          <div className="orders-confirm__icon" style={{ background: `${tone}18`, color: tone }} aria-hidden="true">
            {cancelado ? '!' : '✓'}
          </div>
          <h1 className="orders-confirm__title">
            {cancelado ? 'Pedido cancelado' : pagado ? '¡Pedido confirmado!' : 'Pedido registrado'}
          </h1>
          <p className="orders-confirm__sub">
            {cancelado
              ? 'Este pedido no continuará. Si te cobraron, el reembolso se procesa automáticamente.'
              : pagado
                ? `Tu pago se registró correctamente y ${order.merchant_label} ya lo está viendo.`
                : 'Estamos confirmando tu pago. En cuanto se acredite, el local empezará a prepararlo.'}
          </p>
          <div className="orders-confirm__code">Pedido #{order.order_code}</div>
        </div>

        {!cancelado && (
          <div className="orders-steps">
            {ORDER_STEPS.map((step, i) => (
              <div key={step.key} className={`orders-step ${i <= paso ? 'orders-step--done' : ''}`}>
                <span className="orders-step__dot" />
                <span className="orders-step__label">{step.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="orders-confirm__grid">
          <div className="orders-panel">
            <h2>Resumen</h2>
            <dl className="orders-dl">
              <div><dt>Estado</dt><dd style={{ color: tone, fontWeight: 700 }}>{orderStatusLabel(order.status)}</dd></div>
              <div><dt>Pago</dt><dd>{paymentStatusLabel(order.payment_status)}</dd></div>
              <div><dt>Local</dt><dd>{order.merchant_label}</dd></div>
              {order.estimated_time_min && (
                <div><dt>Tiempo estimado</dt><dd>{order.estimated_time_min} min aprox.</dd></div>
              )}
              <div><dt>Entrega</dt><dd>{order.address_snapshot || 'Recojo en local'}</dd></div>
              {order.recipient_name && (
                <div><dt>Recibe</dt><dd>{order.recipient_name} · {order.recipient_phone}</dd></div>
              )}
            </dl>
          </div>

          <div className="orders-panel">
            <h2>Tu pedido</h2>
            <ul className="orders-items">
              {order.items.map((item, i) => (
                <li key={i}>
                  <span className="orders-items__qty">{item.quantity}x</span>
                  <span className="orders-items__name">{item.product_name_snapshot}</span>
                  <span className="orders-items__price">{formatMoney(item.line_total, order.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="orders-total">
              <span>Total pagado</span>
              <strong>{formatMoney(order.total, order.currency)}</strong>
            </div>
          </div>
        </div>

        <div className="orders-confirm__actions">
          <Link to={AppRoutes.public.myOrders} className="btn-primary">Ver mis pedidos</Link>
          <Link to={AppRoutes.public.marketplace} className="btn-secondary">Seguir comprando</Link>
        </div>

        <p className="orders-legal-note">
          Puedes cancelar o pedir una devolución según nuestra{' '}
          <Link to={AppRoutes.public.refunds}>política de devoluciones y cancelaciones</Link>. ¿Algún problema?{' '}
          <Link to={AppRoutes.public.contact}>Escríbenos</Link> o usa el{' '}
          <Link to={AppRoutes.public.complaints}>Libro de Reclamaciones</Link>.
        </p>
      </div>
    </section>
  );
}
