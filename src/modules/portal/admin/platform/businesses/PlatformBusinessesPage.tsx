import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminDataTable } from '../../../../../components/admin/AdminDataTable';
import { FieldGroup, SelectField } from '../../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../../components/admin/AdminModalForm';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../../components/shared/Skeleton';
import { TextField } from '../../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../../core/constants/routes';
import { MerchantAdminForm } from '../../../../../core/services/adminService';
import { adminPlatformService, PlatformMerchantRecord } from '../../../../../core/services/adminPlatformService';
import { PortalContext } from '../../../../auth/session/PortalContext';

// Valores reales del enum merchant_status.
const merchantStatusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'blocked', label: 'Bloqueado' },
];

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active') return 'success' as const;
  if (normalized === 'pending_review' || normalized === 'invited' || normalized === 'draft') return 'warning' as const;
  if (normalized === 'paused') return 'warning' as const;
  if (normalized === 'inactive' || normalized === 'disabled' || normalized === 'suspended') return 'danger' as const;
  return 'neutral' as const;
}

export function PlatformBusinessesPage() {
  const portal = useContext(PortalContext);
  const navigate = useNavigate();
  const [records, setRecords] = useState<PlatformMerchantRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MerchantAdminForm>(adminPlatformService.createEmptyMerchantForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await adminPlatformService.fetchMerchants();
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRecords(result.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setCreateForm(adminPlatformService.createEmptyMerchantForm());
    setCreateError(null);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!createForm.trade_name.trim()) {
      setCreateError('El nombre comercial es obligatorio.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    const result = await adminPlatformService.createMerchant(createForm);
    setCreating(false);

    if (result.error) {
      setCreateError(result.error.message);
      return;
    }

    setCreateOpen(false);
    // Al detalle del recien creado: ahi se cargan logo, sedes y responsables.
    navigate(AppRoutes.portal.admin.platformBusinessDetail.replace(':merchantId', result.data!.id));
  };

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.trade_name, record.legal_name, record.email, record.phone, record.owner_label, record.status].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [query, records]);

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista pertenece a la capa plataforma.</div>;
  }

  return (
    <AdminPageFrame
      title="Comercios"
      description="Padron de negocios de la plataforma con actividad, responsables y salud operacional."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Comercios' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'Merchants', tone: 'warning' },
        { label: 'Modo', value: 'Plataforma', tone: 'warning' },
      ]}
      actions={
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo negocio
        </button>
      }
    >
      {loading ? (
        <SectionSkeleton lines={5} />
      ) : error ? (
        <div style={{ color: 'var(--acme-red)', padding: '20px' }}>{error}</div>
      ) : (
        <>
          <SectionCard title="Cifras de Plataforma" description="Consolidado global de la red de negocios y su actividad operativa actual.">
            <div className="stat-grid">
              {[
                { label: 'Total Negocios', value: String(records.length), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
                { label: 'Sucursales Activas', value: String(records.reduce((sum, r) => sum + r.active_branches_count, 0)), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="2" width="16" height="20" rx="2" /><line d="M9 22 9 2M15 22 15 2M4 14 20 14" /></svg> },
                { label: 'Pedidos Totales', value: String(records.reduce((sum, r) => sum + r.orders_count, 0)), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg> },
                { label: 'Promociones', value: String(records.reduce((sum, r) => sum + r.promotions_count, 0)), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
              ].map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-card__badge" style={{ background: item.color }} />
                  <div className="stat-card__header">
                    <span className="stat-card__label">{item.label}</span>
                    <div className="stat-card__icon-box">{item.icon}</div>
                  </div>
                  <strong className="stat-card__value">{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Búsqueda Avanzada" description="Localiza rápidamente una entidad por nombre comercial, razón social o responsable.">
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Escribe el nombre del comercio, responsable o correo..."
                className="input-field"
                style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
              />
            </div>
          </SectionCard>

          <SectionCard title="Padrón de Negocios" description="Gestión centralizada de comercios. El estado 'Draft' o 'Pending' indica negocios en proceso de onboarding.">
            <AdminDataTable
              rows={filteredRecords}
              getRowId={(record) => record.id}
              emptyMessage="No hay comercios que coincidan con los criterios de búsqueda."
              columns={[
                {
                  id: 'merchant',
                  header: 'Negocio / Responsable',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '44px', height: '44px', background: 'var(--acme-bg-soft)', color: 'var(--acme-purple)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7l9-4 9 4v14H3V7zm4 14V11h3v10m4 0V11h3v10"/></svg>
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{record.trade_name || record.legal_name || 'Negocio sin Nombre'}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{record.owner_label}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'operations',
                  header: 'Infraestructura',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{record.branches_count} Sedes ({record.active_branches_count} ON)</span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.orders_count} Pedidos registrados</span>
                    </div>
                  ),
                },
                {
                  id: 'growth',
                  header: 'Capital Humano',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{record.staff_count} Colaboradores</span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.promotions_count} Promociones activas</span>
                    </div>
                  ),
                },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => (
                    <StatusPill label={record.status.toUpperCase()} tone={getStatusTone(record.status)} />
                  ),
                },
                {
                  id: 'created',
                  header: 'Registro',
                  width: '120px',
                  render: (record) => (
                    <span style={{ fontSize: '12px', color: 'var(--acme-text-faint)' }}>{formatDateTime(record.created_at)}</span>
                  ),
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '160px',
                  render: (record) => (
                    <Link 
                      to={AppRoutes.portal.admin.platformBusinessDetail.replace(':merchantId', record.id)} 
                      className="btn btn--sm btn--ghost" 
                      style={{ color: 'var(--acme-purple)', fontWeight: 700 }}
                    >
                      Ver Detalles
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>
        </>
      )}

      <AdminModalForm
        open={createOpen}
        title="Nuevo negocio"
        description="Se crea el comercio en el padron. El logo, las sedes y los responsables se cargan despues desde su ficha."
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={submitCreate} disabled={creating}>
              {creating ? 'Creando...' : 'Crear negocio'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Nombre comercial" hint="Unico dato obligatorio. Es el nombre que ve el cliente.">
            <TextField
              value={createForm.trade_name}
              autoFocus
              placeholder="Ej. Artesano Restaurant"
              onChange={(event) => setCreateForm((current) => ({ ...current, trade_name: event.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Razon social">
            <TextField
              value={createForm.legal_name}
              onChange={(event) => setCreateForm((current) => ({ ...current, legal_name: event.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="RUC">
            <TextField
              value={createForm.tax_id}
              onChange={(event) => setCreateForm((current) => ({ ...current, tax_id: event.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Telefono">
            <TextField
              value={createForm.phone}
              onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Email">
            <TextField
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={createForm.status}
              onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}
              options={merchantStatusOptions}
            />
          </FieldGroup>
        </div>

        {createError && (
          <div style={{ color: 'var(--acme-red)', fontSize: '13px', fontWeight: 600 }} role="alert">
            {createError}
          </div>
        )}
      </AdminModalForm>
    </AdminPageFrame>
  );
}
