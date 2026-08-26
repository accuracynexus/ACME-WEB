import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { publicCustomerService, type CustomerOrderHistoryRecord } from '../../../core/services/publicCustomerService';
import { usePublicStore } from '../store/PublicStoreContext';
import { isOrderActive, orderStatusLabel, orderStatusTone, paymentStatusLabel } from './orderStatus';
import './Orders.css';

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

function formatDateTime(value: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function OrderCard({ order }: { order: CustomerOrderHistoryRecord }) {
  const tone = orderStatusTone(order.status);
  return (
    <Link to={`/pedido/${order.id}`} className="orders-card">
      <div className="orders-card__top">
        <strong className="orders-card__code">#{order.order_code}</strong>
        <span className="orders-card__badge" style={{ background: `${tone}18`, color: tone }}>
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <div className="orders-card__merchant">{order.merchant_label}</div>
      <div className="orders-card__meta">
        <span>{formatDateTime(order.placed_at)}</span>
        <strong>{formatMoney(order.total, order.currency)}</strong>
      </div>
      {order.payment_status !== 'paid' && (
        <div className="orders-card__pay">{paymentStatusLabel(order.payment_status)}</div>
      )}
    </Link>
  );
}

export function MyOrdersPage() {
  const publicStore = usePublicStore();
  const [orders, setOrders] = useState<CustomerOrderHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicStore.sessionUser) { setLoading(false); return; }
    try {
      const result = await publicCustomerService.fetchAccountSnapshot(publicStore.sessionUser.id);
      setOrders(result.data?.orders ?? []);
      setError(result.error ? 'No pudimos cargar tus pedidos.' : null);
    } catch {
      setError('No pudimos cargar tus pedidos.');
    } finally {
      setLoading(false);
    }
  }, [publicStore.sessionUser]);

  useEffect(() => { void load(); }, [load]);

  // Los pedidos en curso se refrescan solos para que el cliente vea avanzar
  // el estado sin recargar la pagina.
  const { activos, terminados } = useMemo(() => ({
    activos: orders.filter((o) => isOrderActive(o.status)),
    terminados: orders.filter((o) => !isOrderActive(o.status)),
  }), [orders]);

  useEffect(() => {
    if (activos.length === 0) return;
    const timer = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(timer);
  }, [activos.length, load]);

  if (!publicStore.sessionUser) {
    return (
      <section className="orders-page">
        <div className="orders-container orders-empty">
          <h1>Mis pedidos</h1>
          <p>Inicia sesión para ver tus pedidos.</p>
          <Link to={`${AppRoutes.public.account}?tab=login`} className="btn-primary">Iniciar sesión</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="orders-page">
      <div className="orders-container">
        <header className="orders-header">
          <h1>Mis pedidos</h1>
          <p>Sigue tus pedidos en curso y revisa los que ya recibiste.</p>
        </header>

        {loading && <p className="orders-muted">Cargando tus pedidos…</p>}
        {error && <div className="account-alert account-alert--error">{error}</div>}

        {!loading && !error && orders.length === 0 && (
          <div className="orders-empty">
            <p>Todavía no has hecho ningún pedido.</p>
            <Link to={AppRoutes.public.marketplace} className="btn-primary">Ver locales</Link>
          </div>
        )}

        {!loading && activos.length > 0 && (
          <>
            <h2 className="orders-section-title">
              En curso <span className="orders-count">{activos.length}</span>
            </h2>
            <div className="orders-grid">
              {activos.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          </>
        )}

        {!loading && terminados.length > 0 && (
          <>
            <h2 className="orders-section-title orders-section-title--muted">
              Historial <span className="orders-count">{terminados.length}</span>
            </h2>
            <div className="orders-grid">
              {terminados.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
