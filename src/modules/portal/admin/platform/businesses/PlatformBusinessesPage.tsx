import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminSearchBar } from '../../../../../components/admin/AdminSearchBar';
import { AdminDataTable } from '../../../../../components/admin/AdminDataTable';
import { FieldGroup, SelectField } from '../../../../../components/admin/AdminFields';
import { IconArrowRight, IconPlus, IconSearch } from '../../../../../components/admin/AdminIcons';
import { AdminModalForm } from '../../../../../components/admin/AdminModalForm';
import { ModuleIcon } from '../../../../../components/admin/ModuleIcon';
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
          <IconPlus />
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
          <SectionCard title="Cifras de plataforma" description="Consolidado global de la red de negocios.">
            <div className="stat-grid">
              {[
                // Los iconos salen del registro de modulos, igual que en el
                // Resumen y el sidebar. El de sucursales estaba escrito como
                // <line d="..."/>, que no es valido: line no acepta `d`, asi
                // que ese icono se dibujaba vacio.
                { label: 'Negocios', value: String(records.length), color: 'var(--acme-purple)', icon: 'shop' },
                { label: 'Sucursales activas', value: String(records.reduce((sum, r) => sum + r.active_branches_count, 0)), color: 'var(--acme-green)', icon: 'map-pin' },
                { label: 'Pedidos totales', value: String(records.reduce((sum, r) => sum + r.orders_count, 0)), color: 'var(--acme-blue)', icon: 'shopping-cart' },
                { label: 'Promociones', value: String(records.reduce((sum, r) => sum + r.promotions_count, 0)), color: 'var(--acme-orange)', icon: 'tag' },
              ].map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-card__header">
                    <span className="stat-card__label">{item.label}</span>
                    {/* El color va en el icono. Antes pintaba el badge, que es
                        un degradado decorativo, y quedaba un cuadrado solido. */}
                    <div className="stat-card__icon-box" style={{ color: item.color }}>
                      <ModuleIcon icon={item.icon} size={17} />
                    </div>
                  </div>
                  <strong className="stat-card__value">{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Padrón de negocios"
            description="Gestión centralizada de comercios y su estado de onboarding."
          >
            {/* La busqueda vivia en su propia SectionCard, ocupando una franja
                entera para un solo campo. Va junto a la tabla que filtra. */}
            <AdminSearchBar
              value={query}
              onChange={setQuery}
              placeholder="Buscar por nombre, responsable o correo"
              label="Buscar comercios"
              total={records.length}
              shown={filteredRecords.length}
              noun="comercios"
            />

            <AdminDataTable
              rows={filteredRecords}
              getRowId={(record) => record.id}
              emptyMessage="No hay comercios que coincidan con los criterios de búsqueda."
              columns={[
                {
                  id: 'merchant',
                  header: 'Negocio',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {/* El logo identifica el negocio de un vistazo; el icono
                          generico era el mismo en las 18 filas. */}
                      <div
                        className="module-icon-box"
                        style={{
                          width: '40px',
                          height: '40px',
                          flexShrink: 0,
                          overflow: 'hidden',
                          background: 'var(--acme-surface-muted)',
                          color: 'var(--acme-purple)',
                        }}
                      >
                        {record.logo_url ? (
                          <img
                            src={record.logo_url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <ModuleIcon icon="shop" size={18} />
                        )}
                      </div>
                      <div style={{ display: 'grid', gap: '1px', minWidth: 0 }}>
                        <strong style={{ fontWeight: 700, fontSize: '14px' }}>
                          {record.trade_name || record.legal_name || 'Negocio sin nombre'}
                        </strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{record.owner_label}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'operations',
                  header: 'Sedes y pedidos',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        {record.branches_count} {record.branches_count === 1 ? 'sede' : 'sedes'}
                        {record.branches_count > 0 ? ` · ${record.active_branches_count} abiertas` : ''}
                      </span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.orders_count} Pedidos registrados</span>
                    </div>
                  ),
                },
                {
                  id: 'growth',
                  header: 'Equipo',
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
                  header: 'Alta',
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
                      className="btn btn--sm btn--secondary"
                      aria-label={`Ver ficha de ${record.trade_name || record.legal_name || 'el comercio'}`}
                    >
                      Ver ficha
                      <IconArrowRight size={13} />
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
