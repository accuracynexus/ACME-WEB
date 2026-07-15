import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminService, BranchAdminSummary } from '../../../../core/services/adminService';
import { PortalContext } from '../../../auth/session/PortalContext';

export function BranchesPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.merchant?.id;
  const [branches, setBranches] = useState<BranchAdminSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!merchantId) return;
      setLoading(true);
      const result = await adminService.fetchBranches(merchantId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setBranches(result.data ?? []);
    };

    load();
  }, [merchantId]);

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar sucursales.</div>;
  }

  if (portal.currentScopeType !== 'business') {
    return <div>Esta vista pertenece a la capa negocio.</div>;
  }

  return (
    <AdminPageFrame
      title="Sucursales"
      description="Listado relacional de sucursales con direccion y estado operativo ya resueltos."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Sucursales' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Sucursal', tone: 'info' },
        { label: 'Modo', value: 'Consulta', tone: 'success' },
        { label: 'Estado', value: 'Sin cambios', tone: 'success' },
      ]}
      actions={
        <Link
          to={AppRoutes.portal.admin.branchNew}
          className="btn btn--primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva sucursal
        </Link>
      }
    >
      <SectionCard title="Sucursales registradas" description="Cada fila abre el editor compuesto de sucursal con horarios, cierres y cobertura.">
        {loading ? (
          <SectionSkeleton lines={5} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : (
          <AdminDataTable
            rows={branches}
            getRowId={(branch) => branch.id}
            emptyMessage="No hay sucursales registradas para este comercio."
            columns={[
              {
                id: 'name',
                header: 'Punto de venta',
                render: (branch) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div className="module-icon-box" style={{ width: '40px', height: '40px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="2" /><line x1="15" y1="22" x2="15" y2="2" /><line x1="4" y1="14" x2="20" y2="14" /></svg>
                    </div>
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{branch.name}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{branch.address_text}</span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'contact',
                header: 'Contacto',
                render: (branch) => (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <span style={{ fontWeight: 600 }}>{branch.phone || 'Sin teléfono'}</span>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>Promedio prep: {branch.prep_time_avg_min} min</span>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Estado operativo',
                render: (branch) => (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <StatusPill label={branch.is_open ? 'Abierta' : 'Cerrada'} tone={branch.is_open ? 'success' : 'danger'} />
                    <StatusPill label={branch.accepting_orders ? 'Acepta pedidos' : 'Cerrado temporal'} tone={branch.accepting_orders ? 'info' : 'warning'} />
                    <StatusPill label={branch.status_code || branch.status} tone="neutral" />
                  </div>
                ),
              },
              {
                id: 'relations',
                header: 'Capacidad operativa',
                render: (branch) => (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{branch.hours_count} horarios / {branch.coverage_count} zonas</span>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{branch.closures_count} cierres programados</span>
                  </div>
                ),
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '120px',
                render: (branch) => (
                  <Link to={`${AppRoutes.portal.admin.branches}/${branch.id}`} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                    Gestionar
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
