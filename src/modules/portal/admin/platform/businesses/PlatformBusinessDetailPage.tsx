import { useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminDataTable } from '../../../../../components/admin/AdminDataTable';
import { AdminPageFrame, FormStatusBar, SaveActions, SectionCard, StatusPill } from '../../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../../components/admin/AdminTabs';
import { AdminTimeline } from '../../../../../components/admin/AdminTimeline';
import { CheckboxField, FieldGroup, SelectField } from '../../../../../components/admin/AdminFields';
import { LoadingScreen } from '../../../../../components/shared/LoadingScreen';
import { LogoUploadField } from '../../../../../components/shared/LogoUploadField';
import { TextField } from '../../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../../core/auth/portalAccess';
import { hasDirtyState, serializeDirtyState } from '../../../../../core/admin/utils/dirtyState';
import { AppRoutes } from '../../../../../core/constants/routes';
import { MerchantAdminForm } from '../../../../../core/services/adminService';
import { adminPlatformService, PlatformMerchantDetail } from '../../../../../core/services/adminPlatformService';
import { MerchantAccessSnapshot, merchantAccessService } from '../../../../../core/services/merchantAccessService';
import { PortalContext } from '../../../../auth/session/PortalContext';

type DetailTab = 'summary' | 'access' | 'branches' | 'staff' | 'activity' | 'audit';

interface MerchantAccessFormState {
  email: string;
  fullName: string;
  password: string;
  isActive: boolean;
  mustChangePassword: boolean;
  onboardingStatus: 'pending_review' | 'invited' | 'active' | 'suspended';
  accessOrigin: 'platform_created' | 'public_signup' | 'migration';
}

const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'paused', label: 'Pausado' },
];

const accessStatusOptions = [
  { value: 'pending_review', label: 'Pendiente de revision' },
  { value: 'invited', label: 'Invitado' },
  { value: 'active', label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
];

const accessOriginOptions = [
  { value: 'platform_created', label: 'Creado por plataforma' },
  { value: 'public_signup', label: 'Alta publica' },
  { value: 'migration', label: 'Migrado' },
];

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(value);
}

function getBranchTone(isOpen: boolean, acceptsOrders: boolean) {
  if (isOpen && acceptsOrders) return 'success' as const;
  if (isOpen && !acceptsOrders) return 'warning' as const;
  return 'danger' as const;
}

function getAccessStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active') return 'success' as const;
  if (normalized === 'pending_review' || normalized === 'invited') return 'warning' as const;
  if (normalized === 'suspended') return 'danger' as const;
  return 'neutral' as const;
}

function createAccessForm(snapshot: MerchantAccessSnapshot | null): MerchantAccessFormState {
  return {
    email: snapshot?.email ?? '',
    fullName: snapshot?.full_name ?? '',
    password: '',
    isActive: Boolean(snapshot?.is_active ?? true),
    mustChangePassword: Boolean(snapshot?.must_change_password ?? false),
    onboardingStatus: ((snapshot?.onboarding_status as MerchantAccessFormState['onboardingStatus']) ?? 'active'),
    accessOrigin: ((snapshot?.access_origin as MerchantAccessFormState['accessOrigin']) ?? 'platform_created'),
  };
}

export function PlatformBusinessDetailPage() {
  const { merchantId = '' } = useParams();
  const portal = useContext(PortalContext);
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [detail, setDetail] = useState<PlatformMerchantDetail | null>(null);
  const [form, setForm] = useState<MerchantAdminForm | null>(null);
  const [initialState, setInitialState] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessSnapshot, setAccessSnapshot] = useState<MerchantAccessSnapshot | null>(null);
  const [accessForm, setAccessForm] = useState<MerchantAccessFormState>(createAccessForm(null));
  const [accessInitialState, setAccessInitialState] = useState(serializeDirtyState(createAccessForm(null)));
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSuccess, setAccessSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!merchantId) return;
    setLoading(true);
    setAccessLoading(true);
    setError(null);
    setAccessError(null);
    const [result, accessResult] = await Promise.all([
      adminPlatformService.fetchMerchantDetail(merchantId),
      merchantAccessService.fetchMerchantAccess(merchantId),
    ]);
    setLoading(false);
    setAccessLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const nextDetail = result.data ?? null;
    setDetail(nextDetail);
    setForm(nextDetail?.merchant ?? null);
    setInitialState(serializeDirtyState(nextDetail?.merchant ?? null));

    if (accessResult.error) {
      setAccessSnapshot(null);
      setAccessForm(createAccessForm(null));
      setAccessInitialState(serializeDirtyState(createAccessForm(null)));
      setAccessError(accessResult.error.message);
      return;
    }

    const nextAccessSnapshot = accessResult.data ?? null;
    const nextAccessForm = createAccessForm(nextAccessSnapshot);
    setAccessSnapshot(nextAccessSnapshot);
    setAccessForm(nextAccessForm);
    setAccessInitialState(serializeDirtyState(nextAccessForm));
  };

  useEffect(() => {
    loadData();
  }, [merchantId]);

  const dirty = useMemo(() => (form ? hasDirtyState(form, initialState) : false), [form, initialState]);
  const accessDirty = useMemo(() => hasDirtyState(accessForm, accessInitialState), [accessForm, accessInitialState]);

  const updateField = <K extends keyof MerchantAdminForm>(key: K, value: MerchantAdminForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!merchantId || !form) return;
    setSaving(true);
    setError(null);
    const result = await adminPlatformService.saveMerchant(merchantId, form);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setInitialState(serializeDirtyState(form));
    setSuccessMessage('Comercio actualizado');
    await loadData();
  };

  const handleSaveAccess = async () => {
    if (!merchantId) return;
    setAccessSaving(true);
    setAccessError(null);
    setAccessSuccess(null);
    const result = await merchantAccessService.upsertMerchantAccess({
      merchantId,
      email: accessForm.email,
      fullName: accessForm.fullName,
      password: accessForm.password.trim() ? accessForm.password : undefined,
      isActive: accessForm.isActive,
      mustChangePassword: accessForm.mustChangePassword,
      onboardingStatus: accessForm.onboardingStatus,
      accessOrigin: accessForm.accessOrigin,
    });
    setAccessSaving(false);

    if (result.error) {
      setAccessError(result.error.message);
      return;
    }

    setAccessSuccess('Acceso del negocio actualizado');
    await loadData();
  };

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista pertenece a la capa plataforma.</div>;
  }

  if (loading) {
    return <LoadingScreen message="Cargando comercio..." />;
  }

  if (error) {
    return (
      <AdminPageFrame
        title="Detalle de comercio"
        description="No se pudo cargar la ficha del negocio desde plataforma."
        breadcrumbs={[
          { label: 'Admin', to: AppRoutes.portal.admin.root },
          { label: 'Comercios', to: AppRoutes.portal.admin.platformBusinesses },
          { label: 'Error de carga' },
        ]}
        contextItems={[
          { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
          { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
          { label: 'Entidad', value: 'Merchant', tone: 'warning' },
          { label: 'Estado', value: 'Con error', tone: 'danger' },
        ]}
      >
        <SectionCard title="Carga fallida" description="La vista ya no se queda bloqueada en loading cuando el backend devuelve un error.">
          <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            {error}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                void loadData();
              }}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                fontWeight: 800,
              }}
            >
              Reintentar
            </button>
          </div>
        </SectionCard>
      </AdminPageFrame>
    );
  }

  if (!detail || !form) {
    return (
      <AdminPageFrame
        title="Detalle de comercio"
        description="No se encontro informacion suficiente para mostrar esta ficha."
        breadcrumbs={[
          { label: 'Admin', to: AppRoutes.portal.admin.root },
          { label: 'Comercios', to: AppRoutes.portal.admin.platformBusinesses },
          { label: 'Sin datos' },
        ]}
        contextItems={[
          { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
          { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
          { label: 'Entidad', value: 'Merchant', tone: 'warning' },
          { label: 'Estado', value: 'Sin datos', tone: 'warning' },
        ]}
      >
        <SectionCard title="Sin datos" description="Puede ocurrir si el negocio fue creado de forma parcial o si hubo un error previo en el backend.">
          <div style={{ color: '#6b7280' }}>Revisa el registro del negocio o vuelve a cargar la pagina.</div>
        </SectionCard>
      </AdminPageFrame>
    );
  }

  return (
    <AdminPageFrame
      title={form.trade_name || 'Comercio'}
      description="Ficha de supervision de plataforma sobre identidad, sucursales, equipo y actividad del negocio."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Comercios', to: AppRoutes.portal.admin.platformBusinesses },
        { label: form.trade_name || 'Detalle' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'Merchant', tone: 'warning' },
        { label: 'Estado', value: dirty ? 'Cambios pendientes' : 'Sin cambios', tone: dirty ? 'warning' : 'success' },
      ]}
      actions={<SaveActions onSave={handleSave} isSaving={saving} disabled={!dirty} />}
    >
      <SectionCard title="Resumen ejecutivo" description="Esta ficha deja al admin general ver el negocio como unidad, no solo como comercio actual del owner.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Sucursales', value: String(detail.counters.branches) },
            { label: 'Sucursales abiertas', value: String(detail.counters.active_branches) },
            { label: 'Equipo', value: String(detail.counters.staff) },
            { label: 'Pedidos recientes', value: String(detail.counters.orders) },
            { label: 'Pedidos activos', value: String(detail.counters.active_orders) },
            { label: 'Promociones', value: String(detail.counters.promotions) },
            { label: 'Clientes', value: String(detail.counters.customers) },
            { label: 'Trazas negocio', value: String(detail.counters.audit_logs) },
          ].map((item) => (
            <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Vista del negocio" description="La plataforma ve la empresa completa desde tabs de supervision.">
        <AdminTabs
          tabs={[
            { id: 'summary', label: 'Identidad' },
            { id: 'access', label: 'Acceso', badge: accessSnapshot?.email ? '1' : '0' },
            { id: 'branches', label: 'Sucursales', badge: String(detail.branches.length) },
            { id: 'staff', label: 'Equipo', badge: String(detail.staff.length) },
            { id: 'activity', label: 'Actividad', badge: String(detail.recent_orders.length) },
            { id: 'audit', label: 'Auditoria', badge: String(detail.audit_logs.length) },
          ]}
          activeTabId={activeTab}
          onChange={(tabId) => setActiveTab(tabId as DetailTab)}
        />

        {activeTab === 'summary' ? (
          <AdminTabPanel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <FieldGroup label="Nombre comercial">
                <TextField value={form.trade_name} onChange={(event) => updateField('trade_name', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Razon social">
                <TextField value={form.legal_name} onChange={(event) => updateField('legal_name', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="RUC o tax id">
                <TextField value={form.tax_id} onChange={(event) => updateField('tax_id', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Telefono">
                <TextField value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Email">
                <TextField value={form.email} onChange={(event) => updateField('email', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Logo del negocio" style={{ gridColumn: '1 / -1' }}>
                <LogoUploadField
                  merchantId={merchantId}
                  currentUrl={form.logo_url}
                  onChange={(newUrl) => updateField('logo_url', newUrl)}
                  disabled={saving}
                />
              </FieldGroup>
              <FieldGroup label="Estado">
                <SelectField value={form.status} onChange={(event) => updateField('status', event.target.value)} options={statusOptions} />
              </FieldGroup>
            </div>
          </AdminTabPanel>
        ) : null}

        {activeTab === 'access' ? (
          <AdminTabPanel>
            <SectionCard
              title="Acceso del negocio"
              description="Aqui plataforma crea, aprueba, reactiva o suspende el correo de acceso del negocio. Si el alta vino desde la web publica, esta misma ficha sirve para revisarla."
            >
              {accessLoading ? <LoadingScreen message="Cargando acceso del negocio..." /> : null}

              {!accessLoading ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <StatusPill label={accessSnapshot?.source ?? 'empty'} tone="info" />
                    <StatusPill label={accessSnapshot?.onboarding_status ?? accessForm.onboardingStatus} tone={getAccessStatusTone(accessSnapshot?.onboarding_status ?? accessForm.onboardingStatus)} />
                    <StatusPill label={accessSnapshot?.is_active ? 'Cuenta activa' : 'Cuenta inactiva'} tone={accessSnapshot?.is_active ? 'success' : 'danger'} />
                    <StatusPill label={accessSnapshot?.must_change_password ? 'Cambio pendiente' : 'Sin cambio forzado'} tone={accessSnapshot?.must_change_password ? 'warning' : 'neutral'} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <FieldGroup label="Correo de acceso" hint="Este es el correo con el que el negocio entra al portal.">
                      <TextField value={accessForm.email} onChange={(event) => setAccessForm((current) => ({ ...current, email: event.target.value }))} placeholder="owner@negocio.com" />
                    </FieldGroup>
                    <FieldGroup label="Responsable principal" hint="Nombre que quedara asociado al owner del negocio.">
                      <TextField value={accessForm.fullName} onChange={(event) => setAccessForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nombre del responsable" />
                    </FieldGroup>
                    <FieldGroup label="Contrasena temporal" hint="Si dejas este campo vacio, no se cambiara la contrasena actual.">
                      <TextField type="password" value={accessForm.password} onChange={(event) => setAccessForm((current) => ({ ...current, password: event.target.value }))} placeholder={accessSnapshot?.has_auth_user ? 'Solo si deseas resetearla' : 'Obligatoria para crear el acceso'} />
                    </FieldGroup>
                    <FieldGroup label="Estado de onboarding" hint="Controla si el negocio esta pendiente de revision, invitado, activo o suspendido.">
                      <SelectField value={accessForm.onboardingStatus} onChange={(event) => setAccessForm((current) => ({ ...current, onboardingStatus: event.target.value as MerchantAccessFormState['onboardingStatus'] }))} options={accessStatusOptions} />
                    </FieldGroup>
                    <FieldGroup label="Origen del acceso" hint="Diferencia altas creadas por plataforma frente a altas publicas.">
                      <SelectField value={accessForm.accessOrigin} onChange={(event) => setAccessForm((current) => ({ ...current, accessOrigin: event.target.value as MerchantAccessFormState['accessOrigin'] }))} options={accessOriginOptions} />
                    </FieldGroup>
                    <FieldGroup label="Lectura operativa">
                      <div style={{ display: 'grid', gap: '8px', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                        <span>Usuario auth: {accessSnapshot?.has_auth_user ? 'Si' : 'No'}</span>
                        <span>Owner asignado: {accessSnapshot?.has_staff_assignment ? 'Si' : 'No'}</span>
                        <span>Ultimo cambio de contrasena: {accessSnapshot?.password_changed_at ? formatDateTime(accessSnapshot.password_changed_at) : 'Sin registro'}</span>
                        <span>Ultima invitacion: {accessSnapshot?.last_invited_at ? formatDateTime(accessSnapshot.last_invited_at) : 'Sin registro'}</span>
                      </div>
                    </FieldGroup>
                  </div>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    <CheckboxField
                      label="Acceso activo"
                      checked={accessForm.isActive}
                      onChange={(event) => setAccessForm((current) => ({ ...current, isActive: event.target.checked }))}
                    />
                    <CheckboxField
                      label="Forzar cambio de contrasena en el siguiente ingreso"
                      checked={accessForm.mustChangePassword}
                      onChange={(event) => setAccessForm((current) => ({ ...current, mustChangePassword: event.target.checked }))}
                    />
                  </div>

                  {accessForm.onboardingStatus === 'pending_review' ? (
                    <div style={{ padding: '12px 14px', borderRadius: '12px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
                      Mientras este en revision, el negocio queda visible para plataforma pero no puede operar el admin ni aceptar pedidos.
                    </div>
                  ) : null}

                  {accessError ? (
                    <div style={{ padding: '12px 14px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                      {accessError}
                    </div>
                  ) : null}

                  {accessSuccess ? (
                    <div style={{ padding: '12px 14px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                      {accessSuccess}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const nextForm = createAccessForm(accessSnapshot);
                        setAccessForm(nextForm);
                        setAccessInitialState(serializeDirtyState(nextForm));
                        setAccessError(null);
                        setAccessSuccess(null);
                      }}
                      style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#ffffff', fontWeight: 800 }}
                    >
                      Revertir
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAccess}
                      disabled={!accessDirty || accessSaving}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#111827',
                        color: '#ffffff',
                        fontWeight: 800,
                        opacity: !accessDirty || accessSaving ? 0.65 : 1,
                      }}
                    >
                      {accessSaving ? 'Guardando acceso...' : 'Guardar acceso'}
                    </button>
                  </div>
                </>
              ) : null}
            </SectionCard>
          </AdminTabPanel>
        ) : null}

        {activeTab === 'branches' ? (
          <AdminTabPanel>
            <AdminDataTable
              rows={detail.branches}
              getRowId={(record) => record.id}
              emptyMessage="No hay sucursales asociadas."
              columns={[
                {
                  id: 'branch',
                  header: 'Sucursal',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.name}</strong>
                      <span style={{ color: '#6b7280' }}>{record.address_text}</span>
                    </div>
                  ),
                },
                { id: 'phone', header: 'Telefono', render: (record) => record.phone || 'Sin telefono' },
                { id: 'prep', header: 'Prep', render: (record) => `${record.prep_time_avg_min} min` },
                {
                  id: 'state',
                  header: 'Operacion',
                  render: (record) => (
                    <StatusPill
                      label={record.is_open ? (record.accepts_orders ? 'Abierta y recibiendo' : 'Abierta sin pedidos') : 'Cerrada'}
                      tone={getBranchTone(record.is_open, record.accepts_orders)}
                    />
                  ),
                },
                {
                  id: 'coverage',
                  header: 'Operacion',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <span>{record.hours_count} bloques horarios</span>
                      <span style={{ color: '#6b7280' }}>{record.closures_count} cierres especiales</span>
                      <span style={{ color: '#6b7280' }}>{record.pause_reason || record.status_code || 'Sin observacion'}</span>
                    </div>
                  ),
                },
                {
                  id: 'next_closure',
                  header: 'Proximo cierre',
                  render: (record) => (record.next_closure_starts_at ? formatDateTime(record.next_closure_starts_at) : 'Sin cierre programado'),
                },
              ]}
            />
          </AdminTabPanel>
        ) : null}

        {activeTab === 'staff' ? (
          <AdminTabPanel>
            <AdminDataTable
              rows={detail.staff}
              getRowId={(record) => record.id}
              emptyMessage="No hay equipo asignado."
              columns={[
                {
                  id: 'person',
                  header: 'Persona',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.full_name || 'Sin nombre'}</strong>
                      <span style={{ color: '#6b7280' }}>{record.email || 'Sin email'}</span>
                    </div>
                  ),
                },
                { id: 'role', header: 'Rol staff', render: (record) => record.role || 'staff' },
                { id: 'branches', header: 'Sucursales', render: (record) => record.branch_labels.join(', ') || 'Sin sucursal' },
                { id: 'roles', header: 'Accesos', render: (record) => record.user_role_labels.join(', ') || record.default_role || 'Sin rol' },
              ]}
            />
          </AdminTabPanel>
        ) : null}

        {activeTab === 'activity' ? (
          <AdminTabPanel>
            <AdminDataTable
              rows={detail.recent_orders}
              getRowId={(record) => record.id}
              emptyMessage="No hay pedidos recientes."
              columns={[
                { id: 'code', header: 'Pedido', render: (record) => `#${record.order_code}` },
                { id: 'branch', header: 'Sucursal', render: (record) => record.branch_label },
                { id: 'status', header: 'Estado', render: (record) => record.status || 'sin estado' },
                { id: 'total', header: 'Total', align: 'right', render: (record) => formatMoney(record.total) },
                { id: 'placed', header: 'Fecha', render: (record) => formatDateTime(record.placed_at) },
              ]}
            />
          </AdminTabPanel>
        ) : null}

        {activeTab === 'audit' ? (
          <AdminTabPanel>
            <AdminTimeline
              items={detail.audit_logs.map((item) => ({
                id: item.id,
                title: `${item.action || 'accion'} sobre ${item.entity_type || 'entidad'}`,
                subtitle: `${item.user_label || 'Sin usuario'} - ${item.branch_label || 'Sin sucursal'} - ${formatDateTime(item.created_at)}`,
                tone: 'info',
                body: <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>{JSON.stringify(item.metadata_json ?? {}, null, 2)}</pre>,
              }))}
            />
          </AdminTabPanel>
        ) : null}
      </SectionCard>

      <FormStatusBar dirty={dirty} saving={saving} error={error} successMessage={successMessage} />
    </AdminPageFrame>
  );
}
