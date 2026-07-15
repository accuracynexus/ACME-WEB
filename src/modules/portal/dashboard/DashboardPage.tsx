import { Suspense, lazy, useContext, useEffect, useMemo, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { ordersService } from '../../../core/services';
import { OrderSummary } from '../../../core/types';
import { SectionSkeleton, StatGridSkeleton } from '../../../components/shared/Skeleton';
import { adminOverviewService, OrdersTrendPoint } from '../../../core/services/adminOverviewService';
import { toast } from '../../../core/utils/toast';

const OrdersTrendChart = lazy(() => import('../../../components/admin/OrdersTrendChart'));

const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo',
  accepted: 'Aceptado',
  preparing: 'En preparación',
  ready: 'Listo',
};

export function DashboardPage() {
  const portal = useContext(PortalContext);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState<OrdersTrendPoint[] | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const load = async () => {
    if (!portal.currentBranch) return;
    setLoading(true);
    const result = await ordersService.fetchOrders(portal.currentBranch.id, ['new', 'accepted', 'preparing', 'ready']);
    setLoading(false);
    if (result.error) {
      toast.error('Error al cargar pedidos', result.error.message);
      return;
    }
    setOrders(result.data ?? []);
  };

  useEffect(() => { load(); }, [portal.currentBranch]);

  useEffect(() => {
    if (!portal.currentBranch) return;
    let cancelled = false;
    const loadTrend = async () => {
      setTrendLoading(true);
      const result = await adminOverviewService.fetchOrdersTrend({
        scopeType: 'branch',
        branchId: portal.currentBranch?.id,
      });
      if (cancelled) return;
      setTrendLoading(false);
      setTrend(result.error ? null : result.data);
    };
    loadTrend();
    return () => {
      cancelled = true;
    };
  }, [portal.currentBranch?.id]);

  const summary = useMemo(() => {
    const counts = { new: 0, accepted: 0, preparing: 0, ready: 0 } as Record<string, number>;
    orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
    return counts;
  }, [orders]);

  if (!portal.currentBranch) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><BranchIcon /></div>
        <p className="empty-state__title">Sin sucursal seleccionada</p>
        <p className="empty-state__desc">Selecciona una sucursal desde la barra superior para ver el dashboard operativo.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <DotIcon /> Operaciones en vivo
          </span>
          <h1 className="page-header__title">Dashboard</h1>
          <p className="page-header__desc">
            Vista general de <strong style={{ color: 'var(--acme-purple)', fontWeight: 800 }}>{portal.currentBranch.name}</strong> en tiempo real.
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            <RefreshIcon /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard
          label="Pedidos nuevos"
          value={summary.new}
          foot="Pendientes de aceptar"
          iconColor="purple"
          icon={<ShoppingBagIcon />}
        />
        <StatCard
          label="Aceptados"
          value={summary.accepted}
          foot="Confirmados por el local"
          iconColor="blue"
          icon={<CheckCircleIcon />}
          staggerIndex={1}
        />
        <StatCard
          label="En preparación"
          value={summary.preparing}
          foot="En cocina ahora mismo"
          iconColor="orange"
          icon={<CookingIcon />}
          staggerIndex={2}
        />
        <StatCard
          label="Listos"
          value={summary.ready}
          foot="Esperando al repartidor"
          iconColor="green"
          icon={<PackageCheckIcon />}
          staggerIndex={3}
        />
      </div>

      {/* Tendencia semanal */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Pedidos de los últimos 7 días</h2>
            <p className="section-card__subtitle">Evolución diaria de la sucursal</p>
          </div>
        </div>
        {trendLoading ? (
          <SectionSkeleton lines={4} />
        ) : trend && trend.some((point) => point.count > 0) ? (
          <Suspense fallback={<SectionSkeleton lines={4} />}>
            <OrdersTrendChart points={trend} />
          </Suspense>
        ) : (
          <div className="empty-state" style={{ padding: '28px 20px' }}>
            <p className="empty-state__desc">Sin pedidos registrados en los últimos 7 días.</p>
          </div>
        )}
      </div>

      {/* Recent orders */}
      <div className="section-card">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Pedidos en curso</h2>
            <p className="section-card__subtitle">Actividad activa de la sucursal</p>
          </div>
          {orders.length > 0 && (
            <span className="status-badge status-badge--new">
              <span className="status-badge__dot" />
              {orders.length} activos
            </span>
          )}
        </div>

        {loading ? (
          <StatGridSkeleton />
        ) : orders.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state__icon"><PackageCheckIcon /></div>
            <p className="empty-state__title">Sin pedidos activos</p>
            <p className="empty-state__desc">No hay pedidos en curso para esta sucursal en este momento.</p>
          </div>
        ) : (
          <div className="data-list">
            {orders.slice(0, 8).map((order, i) => (
              <div key={order.id} className="data-item" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="data-item__icon" style={{ background: 'var(--acme-purple-light)', color: 'var(--acme-purple)' }}>
                  <UserIcon />
                </div>
                <div className="data-item__body">
                  <div className="data-item__title">{order.customer_name || 'Cliente'}</div>
                  <div className="data-item__sub">#{order.id.slice(-8).toUpperCase()}</div>
                </div>
                <div className="data-item__end">
                  <span className={`status-badge status-badge--${order.status}`}>
                    <span className="status-badge__dot" />
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--acme-purple)', minWidth: '72px', textAlign: 'right', letterSpacing: '-0.02em' }}>
                    S/ {order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ——— Sub-component ——— */
function StatCard({ label, value, foot, iconColor, icon, staggerIndex }: {
  label: string;
  value: number;
  foot: string;
  iconColor: 'purple' | 'blue' | 'orange' | 'green';
  icon: React.ReactNode;
  staggerIndex?: number;
}) {
  return (
    <div className={`stat-card${staggerIndex ? ` anim-stagger-${staggerIndex}` : ''}`}>
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div className={`stat-card__icon stat-card__icon--${iconColor}`}>{icon}</div>
      </div>
      <div className={`stat-card__value stat-card__value--${iconColor}`}>{value}</div>
      <div className="stat-card__foot">{foot}</div>
    </div>
  );
}

/* ——— Icons ——— */
function DotIcon() {
  return <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--acme-green)', display: 'inline-block', boxShadow: '0 0 0 2px rgba(16,185,129,0.25)' }} />;
}
function ShoppingBagIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}
function CheckCircleIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function CookingIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/><path d="M2 12a10 10 0 0 0 10 10"/></svg>;
}
function PackageCheckIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}
function UserIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function BranchIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
