import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { ordersService } from '../../../core/services/ordersService';
import { OrderSummary, OrderStatus } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS } from '../../../core/utils/orderStatus';
import { toast } from '../../../core/utils/toast';

const statuses: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready'];

const STATUS_BADGE_CLASS: Record<string, string> = {
  new: 'status-badge--new',
  accepted: 'status-badge--accepted',
  preparing: 'status-badge--preparing',
  ready: 'status-badge--ready',
};

const STATUS_BTN_CLASS: Record<string, string> = {
  new: 'btn--primary',
  accepted: 'btn--primary',
  preparing: 'btn--orange',
  ready: 'btn--success',
};

export function OrdersPage() {
  const portal = useContext(PortalContext);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const currentBranchId = portal.currentBranch?.id;

  const loadOrders = async () => {
    if (!currentBranchId) return;
    setLoading(true);
    const result = await ordersService.fetchOrders(currentBranchId, statuses);
    setLoading(false);
    if (result.error) {
      toast.error('Error al cargar pedidos', result.error.message);
      return;
    }
    setOrders(result.data ?? []);
  };

  useEffect(() => { loadOrders(); }, [currentBranchId]);

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    statuses.forEach((s) => { counts[s] = orders.filter((o) => o.status === s).length; });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() =>
    filter === 'all' ? orders : orders.filter((o) => o.status === filter),
    [filter, orders]
  );

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setActionLoading(orderId);
    const result = await ordersService.updateOrderStatus(orderId, status);
    setActionLoading(null);
    if (result.error) {
      toast.error('Error al actualizar pedido', result.error.message);
      return;
    }
    toast.success('Estado actualizado', `Pedido marcado como "${ORDER_STATUS_LABELS[status]}"`);
    await loadOrders();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <OrdersIcon /> Gestión de pedidos
          </span>
          <h1 className="page-header__title">Pedidos</h1>
          <p className="page-header__desc">Bandeja operativa de pedidos activos con transición de estados.</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={loadOrders} disabled={loading}>
            <RefreshIcon /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="filter-bar">
        <button className={`filter-chip ${filter === 'all' ? 'filter-chip--active' : ''}`} onClick={() => setFilter('all')}>
          Todos <span className="filter-chip__count">{countByStatus.all}</span>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            className={`filter-chip ${filter === status ? 'filter-chip--active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {ORDER_STATUS_LABELS[status]}
            <span className="filter-chip__count">{countByStatus[status]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : filteredOrders.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><OrdersEmptyIcon /></div>
            <p className="empty-state__title">Sin pedidos</p>
            <p className="empty-state__desc">
              {filter === 'all'
                ? 'No hay pedidos activos para esta sucursal.'
                : `No hay pedidos con estado "${ORDER_STATUS_LABELS[filter]}".`}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredOrders.map((order, i) => (
            <div key={order.id} className="order-card" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="order-card__header">
                <span className="order-card__id">#{order.id.slice(-8).toUpperCase()}</span>
                <span className={`status-badge ${STATUS_BADGE_CLASS[order.status] ?? ''}`}>
                  <span className="status-badge__dot" />
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="order-card__customer">
                <div className="order-card__avatar"><UserIcon /></div>
                <div>
                  <div className="order-card__customer-name">{order.customer_name || 'Cliente desconocido'}</div>
                  <div className="order-card__meta">{order.payment_method || 'Método no especificado'}</div>
                </div>
              </div>

              <div className="order-card__footer">
                <span className="order-card__total">S/ {order.total.toFixed(2)}</span>
                <div className="order-card__actions">
                  <Link to={`${AppRoutes.portal.orders}/${order.id}`} className="btn btn--secondary btn--sm">
                    Ver detalle
                  </Link>
                  {ORDER_STATUS_TRANSITIONS[order.status]?.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      className={`btn btn--sm ${STATUS_BTN_CLASS[nextStatus] ?? 'btn--secondary'}`}
                      disabled={actionLoading === order.id}
                      onClick={() => handleStatusChange(order.id, nextStatus)}
                    >
                      {actionLoading === order.id ? '...' : ORDER_STATUS_LABELS[nextStatus]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function OrdersIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
}
function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
function OrdersEmptyIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}
