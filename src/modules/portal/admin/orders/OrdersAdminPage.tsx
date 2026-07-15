import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { getAdminOrderStatusLabel, getAdminOrderStatusTone, normalizeAdminOrderStatus } from '../../../../core/admin/utils/orderWorkflow';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminOrdersService, OrderAdminRecord } from '../../../../core/services/adminOrdersService';
import { PortalContext } from '../../../auth/session/PortalContext';

type OrderFilter = 'all' | 'active' | 'issues' | 'finished';

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
  const [orders, setOrders] = useState<OrderAdminRecord[]>([]);
  const [filter, setFilter] = useState<OrderFilter>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      if (!branchId) return;
      setLoading(true);
      setError(null);
      const result = await adminOrdersService.fetchOrders(branchId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setOrders(result.data ?? []);
    };

    loadOrders();
  }, [branchId]);

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
                    <span style={{ color: '#6b7280' }}>{order.customer_label}</span>
                  </div>
                ),
              },
              {
                id: 'delivery',
                header: 'Entrega',
                render: (order) => (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <span>{order.fulfillment_type || 'Sin tipo'}</span>
                    <span style={{ color: '#6b7280' }}>{order.address_label}</span>
                  </div>
                ),
              },
              {
                id: 'payment',
                header: 'Pago',
                render: (order) => (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <span>{order.payment_label}</span>
                    <span style={{ color: '#6b7280' }}>{order.payment_status || 'sin estado'}</span>
                  </div>
                ),
              },
              {
                id: 'driver',
                header: 'Reparto',
                render: (order) => order.driver_label || 'Sin asignar',
              },
              {
                id: 'status',
                header: 'Estado',
                render: (order) => (
                  <StatusPill label={getAdminOrderStatusLabel(order.status)} tone={getAdminOrderStatusTone(order.status)} />
                ),
              },
              {
                id: 'total',
                header: 'Total',
                align: 'right',
                render: (order) => formatMoney(order.total),
              },
              {
                id: 'action',
                header: 'Accion',
                align: 'right',
                width: '160px',
                render: (order) => (
                  <Link
                    to={AppRoutes.portal.admin.orderDetail.replace(':orderId', order.id)}
                    style={{ color: '#2563eb', fontWeight: 700 }}
                  >
                    Abrir ficha
                  </Link>
                ),
              },
            ]}
          />
        )}
      </SectionCard>
    </AdminPageFrame>
  );
}
