import { Suspense, lazy, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton, StatGridSkeleton } from '../../../../components/shared/Skeleton';
import { canAccessAdminModule, getPortalActorLabel, getScopeDescription, getScopeLabel } from '../../../../core/auth/portalAccess';
import { getEnabledAdminModules, getEntityRootsByModule } from '../../../../core/admin/registry/moduleRegistry';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminOverviewService, AdminMetricCard, OrdersTrendPoint } from '../../../../core/services/adminOverviewService';
import { PortalContext } from '../../../auth/session/PortalContext';

const OrdersTrendChart = lazy(() => import('../../../../components/admin/OrdersTrendChart'));

export function AdminDashboardPage() {
  const portal = useContext(PortalContext);
  const [metrics, setMetrics] = useState<AdminMetricCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<OrdersTrendPoint[] | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const visibleModules = useMemo(
    () =>
      getEnabledAdminModules({
        scopeType: portal.currentScopeType,
        hasMerchant: !!portal.currentMerchant,
        hasBranch: !!portal.currentBranch,
      }).filter((module) => canAccessAdminModule(module.id, portal.permissions)),
    [portal.currentScopeType, portal.currentMerchant, portal.currentBranch, portal.permissions]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await adminOverviewService.fetchMetricCards({
        scopeType: portal.currentScopeType,
        merchantId: portal.currentMerchant?.id,
        branchId: portal.currentBranch?.id,
      });
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setMetrics(result.data ?? []);
    };

    load();
  }, [portal.currentBranch?.id, portal.currentMerchant?.id, portal.currentScopeType]);

  useEffect(() => {
    let cancelled = false;
    const loadTrend = async () => {
      setTrendLoading(true);
      const result = await adminOverviewService.fetchOrdersTrend({
        scopeType: portal.currentScopeType,
        merchantId: portal.currentMerchant?.id,
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
  }, [portal.currentBranch?.id, portal.currentMerchant?.id, portal.currentScopeType]);

  const actorLabel = getPortalActorLabel({
    roleAssignments: portal.roleAssignments,
    profile: portal.profile,
    staffAssignment: portal.staffAssignment,
  });
  const isPlatformScope = portal.currentScopeType === 'platform';
  const needsMerchantSelection = (portal.currentScopeType === 'business' || portal.currentScopeType === 'branch') && !portal.currentMerchant && portal.businessAssignments.length > 0;
  const businessLabel = isPlatformScope ? 'Todos los negocios' : portal.currentMerchant?.name || 'No aplica';
  const branchLabel = isPlatformScope
    ? 'No aplica'
    : portal.currentScopeType === 'branch'
      ? portal.currentBranch?.name || 'No aplica'
      : `${portal.branches.length} sucursales visibles`;

  const getMetricIcon = (id: string) => {
    const props = { width: 20, height: 20, stroke: 'currentColor', strokeWidth: 2.5, fill: 'none' };
    switch (id) {
      case 'merchants': return (
        <svg {...props} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
      );
      case 'branches': return (
        <svg {...props} viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="2" /><line x1="15" y1="22" x2="15" y2="2" /><line x1="4" y1="14" x2="20" y2="14" /></svg>
      );
      case 'drivers': return (
        <svg {...props} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
      );
      case 'staff': case 'assignments': case 'access': return (
        <svg {...props} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      );
      case 'customers': return (
        <svg {...props} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      );
      case 'orders': return (
        <svg {...props} viewBox="0 0 24 24"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
      );
      case 'products': return (
        <svg {...props} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
      );
      case 'categories': return (
        <svg {...props} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
      );
      case 'modifiers': return (
        <svg {...props} viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
      );
      case 'settings': case 'merchant_settings': return (
        <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      );
      case 'hours': case 'schedules': return (
        <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      );
      case 'coverage': return (
        <svg {...props} viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
      );
      default: return (
        <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
      );
    }
  };

  const getModuleIcon = (id: string) => {
    const props = { width: 18, height: 18, stroke: 'currentColor', strokeWidth: 2, fill: 'none' };
    switch (id) {
      case 'orders': return <svg {...props} viewBox="0 0 24 24"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>;
      case 'catalog': return <svg {...props} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
      case 'commerce': case 'branches': return <svg {...props} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
      case 'staff': return <svg {...props} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>;
      case 'customers': return <svg {...props} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
      case 'promotions': return <svg {...props} viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
      case 'messages': return <svg {...props} viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>;
      case 'settlements': return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="2" y1="15" x2="22" y2="15" /></svg>;
      case 'system': case 'security': return <svg {...props} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
      default: return <svg {...props} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>;
    }
  };

  return (
    <AdminPageFrame
      title={`Resumen ${getScopeLabel(portal.currentScopeType).toLowerCase()}`}
      description={getScopeDescription(portal.currentScopeType)}
      breadcrumbs={[
        { label: 'Admin' },
        { label: 'Resumen' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Perfil', value: actorLabel, tone: 'info' },
        { label: isPlatformScope ? 'Cobertura' : 'Comercio', value: isPlatformScope ? 'Plataforma completa' : businessLabel, tone: 'neutral' },
        { label: isPlatformScope ? 'Negocios visibles' : 'Sucursal', value: isPlatformScope ? String(portal.businessAssignments.length || 0) : branchLabel, tone: 'neutral' },
        { label: 'Modulos', value: String(visibleModules.length), tone: 'success' },
      ]}
    >
      <SectionCard title="Métricas de alcance" description="Visualización de datos clave procesados según tu capa operativa actual.">
        {needsMerchantSelection ? (
          <div className="portal-emptyState" style={{ minHeight: '120px' }}>
            <strong>Selección requerida</strong>
            <span>Elegir un comercio desde la cabecera para ver métricas.</span>
          </div>
        ) : null}
        {loading ? (
          <StatGridSkeleton />
        ) : error ? (
          <div className="portal-errorState">{error}</div>
        ) : (
          <div className="stat-grid">
            {metrics.map((metric) => (
              <div key={metric.id} className="stat-card">
                <div className="stat-card__badge" />
                <div className="stat-card__header">
                  <span className="stat-card__label">{metric.label}</span>
                  <div className="stat-card__icon-box">
                    {getMetricIcon(metric.id)}
                  </div>
                </div>
                <strong className="stat-card__value">{metric.value}</strong>
                <p className="stat-card__help">{metric.help}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Pedidos de los últimos 7 días" description="Evolución diaria de pedidos registrados según tu capa operativa actual.">
        {trendLoading ? (
          <SectionSkeleton lines={4} />
        ) : trend && trend.some((point) => point.count > 0) ? (
          <Suspense fallback={<SectionSkeleton lines={4} />}>
            <OrdersTrendChart points={trend} />
          </Suspense>
        ) : (
          <div className="empty-state" style={{ padding: '28px 20px' }}>
            <p className="empty-state__desc">Sin pedidos registrados en los últimos 7 días para este alcance.</p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Módulos bajo este alcance" description="Acceso directo a las herramientas disponibles según los permisos de tu perfil.">
        <AdminDataTable
          rows={visibleModules}
          getRowId={(module) => module.id}
          columns={[
            {
              id: 'module',
              header: 'Capacidad',
              render: (module) => (
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div className="module-icon-box">
                    {getModuleIcon(module.id)}
                  </div>
                  <div className="module-info">
                    <strong style={{ fontWeight: 800 }}>{module.label}</strong>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{module.description}</span>
                  </div>
                </div>
              ),
            },
            {
              id: 'scope',
              header: 'Visibilidad',
              render: (module) => (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {module.scopeVisibility.map((scope) => (
                    <StatusPill key={scope} label={getScopeLabel(scope)} tone={portal.currentScopeType === scope ? 'info' : 'neutral'} />
                  ))}
                </div>
              ),
            },
            {
              id: 'roots',
              header: 'Datos maestros',
              render: (module) => (
                <span style={{ color: 'var(--acme-text-muted)', fontSize: '13px', fontWeight: 500 }}>
                  {getEntityRootsByModule(module.id)
                    .map((entity) => entity.singularLabel)
                    .join(', ') || 'Global'}
                </span>
              ),
            },
            {
              id: 'action',
              header: '',
              align: 'right',
              width: '140px',
              render: (module) => (
                <Link to={module.route} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                  Gestionar
                </Link>
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard title="Capas administrativas" description="Alterna entre tus diferentes niveles de responsabilidad técnica y de negocio.">
        <div className="scope-grid">
          {portal.availableScopeTypes.map((scope) => (
            <div
              key={scope}
              onClick={() => portal.setCurrentScopeType(scope)}
              className={`scope-card ${portal.currentScopeType === scope ? 'scope-card--active' : ''}`}
            >
              <div className="scope-card__icon">
                {scope === 'platform' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
                {scope === 'business' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
                {scope === 'branch' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="2" /><line x1="15" y1="22" x2="15" y2="2" /><line x1="4" y1="14" x2="20" y2="14" /></svg>}
              </div>
              <div className="scope-card__info">
                <div className="scope-card__title">{getScopeLabel(scope)}</div>
                <div className="scope-card__desc">{getScopeDescription(scope)}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AdminPageFrame>
  );
}
