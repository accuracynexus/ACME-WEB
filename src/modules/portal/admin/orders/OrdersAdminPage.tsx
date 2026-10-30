import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { isOrderAwaitingPayment, normalizeAdminOrderStatus } from '../../../../core/admin/utils/orderWorkflow';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminOrdersService, OrderAdminRecord } from '../../../../core/services/adminOrdersService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { firstName } from '../../../../core/services/acmeDrinksService';
import { getFinanceStatus } from '../../../../core/admin/utils/financeLabels';
import { useOrdersLiveRefresh } from '../../orders/useOrdersLiveRefresh';
import { OpenOrderButton, OrderTrafficLight } from './OrderFlowUi';

type OrderFilter = 'all' | 'active' | 'awaiting_payment' | 'issues' | 'finished';

function normalizeId(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return null;
  }
  return String(value);
}

function resolveOrderFilter(record: OrderAdminRecord) {
  const normalizedStatus = normalizeAdminOrderStatus(record.status);

  if (normalizedStatus === 'cancelled' || normalizedStatus === 'rejected' || normalizedStatus === 'delivered') {
    return 'finished';
  }
  if (record.payment_status === 'failed') {
    return 'issues';
  }
  if (isOrderAwaitingPayment(record.status, record.payment_status)) {
    return 'awaiting_payment';
  }
  return 'active';
}

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function OrdersAdminPage() {
  const portal = useContext(PortalContext);
  const branchId = normalizeId(portal.currentBranch?.id);
  const isPlatformAdmin = portal.permissions.canAccessPlatform;
  const [orders, setOrders] = useState<OrderAdminRecord[]>([]);
  const [filter, setFilter] = useState<OrderFilter>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // silent: los refrescos automaticos no muestran el skeleton ni borran la lista.
  const loadOrders = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!branchId) return;
      if (!options?.silent) setLoading(true);
      if (!options?.silent) setError(null);
      const result = await adminOrdersService.fetchOrders(branchId);
      if (!options?.silent) setLoading(false);
      if (result.error) {
        if (!options?.silent) setError(result.error.message);
        return;
      }
      setOrders(result.data ?? []);
    },
    [branchId]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useOrdersLiveRefresh(() => loadOrders({ silent: true }), Boolean(branchId), 'admin-orders-list');

  const filteredOrders = useMemo(() => {
    if (filter === 'all') {
      return orders;
    }

    return orders.filter((record) => {
      const resolvedFilter = resolveOrderFilter(record);
      if (filter === 'issues') {
        return resolvedFilter === 'issues' || normalizeAdminOrderStatus(record.status) === 'cancelled';
      }
      return resolvedFilter === filter;
    });
  }, [filter, orders]);

  const counters = useMemo(
    () => ({
      all: orders.length,
      active: orders.filter((record) => resolveOrderFilter(record) === 'active').length,
      awaiting_payment: orders.filter((record) => resolveOrderFilter(record) === 'awaiting_payment').length,
      issues: orders.filter((record) => resolveOrderFilter(record) === 'issues' || normalizeAdminOrderStatus(record.status) === 'cancelled').length,
      finished: orders.filter((record) => resolveOrderFilter(record) === 'finished').length,
    }),
    [orders]
  );

  if (!branchId) {
    return <div>No hay sucursal actual para revisar pedidos.</div>;
  }

  return (
    <AdminPageFrame
      title="Pedidos"
      description="Bandeja operativa que resume estado, cliente, direccion, pago y acceso a la ficha completa del pedido."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Pedidos' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        {
          label: 'Actor',
          value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }),
          tone: 'info',
        },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentBranch?.name || 'sin sucursal', tone: 'neutral' },
        { label: 'Entidad', value: 'Pedido', tone: 'info' },
        { label: 'Modo', value: 'Operacion', tone: 'warning' },
      ]}
    >
      <SectionCard title="Vista por cola" description="Usa los filtros para entrar rapido a la carga operativa real del turno.">
        <div className="filter-bar">
          {[
            { id: 'active',   label: 'Activos',     count: counters.active },
            { id: 'awaiting_payment', label: 'Esperando pago', count: counters.awaiting_payment },
            { id: 'issues',   label: 'Incidencias', count: counters.issues },
            { id: 'finished', label: 'Cerrados',    count: counters.finished },
            { id: 'all',      label: 'Todos',       count: counters.all },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id as OrderFilter)}
              className={`filter-chip ${filter === item.id ? 'filter-chip--active' : ''}`}
            >
              {item.label}
              <span className="filter-chip__count">{item.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <SectionSkeleton lines={5} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : (
          <AdminDataTable
            rows={filteredOrders}
            getRowId={(order) => order.id}
            emptyMessage="No hay pedidos para el filtro actual."
            columns={[
              {
                id: 'code',
                header: 'Pedido',
                render: (order) => (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <strong>Pedido #{order.order_code}</strong>
                    {/* La tienda solo ve el primer nombre del cliente. */}
                    <span style={{ color: 'var(--acme-text-muted)' }}>{isPlatformAdmin ? order.customer_label : firstName(order.customer_label)}</span>
                  </div>
                ),
              },
              {
                id: 'delivery',
                header: 'Entrega',
                render: (order) => (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {/* Un recojo (encargo) tiene dos puntos: de donde se recoge y a donde se lleva. */}
                    {order.pickup_address ? (
                      <>
                        <span>Recojo</span>
                        <span style={{ color: 'var(--acme-text-muted)' }}>
                          De: {order.pickup_address}
                          <br />A: {order.address_label}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{getFulfillmentLabel(order.fulfillment_type)}</span>
                        {order.fulfillment_type !== 'pickup' ? <span style={{ color: 'var(--acme-text-muted)' }}>{order.address_label}</span> : null}
                      </>
                    )}
                  </div>
                ),
              },
              {
                id: 'payment',
                header: 'Pago',
                render: (order) => {
                  const payment = getFinanceStatus(order.payment_status);
                  return (
                    <div style={{ display: 'grid', gap: '6px', justifyItems: 'start' }}>
                      <span>{order.payment_label}</span>
                      <StatusPill label={payment.label} tone={payment.tone} />
                    </div>
                  );
                },
              },
              {
                id: 'driver',
                header: 'Reparto',
                render: (order) => order.driver_label || 'Sin asignar',
              },
              {
                id: 'status',
                header: 'Estado',
                render: (order) => <OrderTrafficLight status={order.status} paymentStatus={order.payment_status} packedAt={order.packed_at} />,
              },
              // La tienda ve solo lo de sus productos; el delivery y los
              // cargos de servicio son de ACME y no le corresponden.
              {
                id: 'total',
                header: isPlatformAdmin ? 'Total' : 'Productos',
                align: 'right',
                // merchant_products: sin las bebidas ACME, que no son del negocio.
                render: (order) => formatMoney(isPlatformAdmin ? order.total : order.merchant_products),
              },
              // Solo "Abrir ficha": los pasos se marcan dentro de la ficha, donde
              // el local ve las instrucciones y el recordatorio de empaque.
              {
                id: 'action',
                header: 'Accion',
                align: 'right',
                width: '150px',
                render: (order) => (
                  <OpenOrderButton to={AppRoutes.portal.admin.orderDetail.replace(':orderId', order.id)} status={order.status} />
                ),
              },
            ]}
          />
        )}
      </SectionCard>
    </AdminPageFrame>
  );
}

const FULFILLMENT_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  pickup: 'Recojo en tienda',
  dine_in: 'Consumo en local',
};

function getFulfillmentLabel(type: string) {
  return FULFILLMENT_LABELS[String(type || '').toLowerCase()] || type || 'Sin tipo';
}
