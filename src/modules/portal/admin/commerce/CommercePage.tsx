import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SaveActions, SectionCard } from '../../../../components/admin/AdminScaffold';
import { AdminTimeline } from '../../../../components/admin/AdminTimeline';
import { PortalContext } from '../../../auth/session/PortalContext';
import { AppRoutes } from '../../../../core/constants/routes';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { adminService, MerchantAdminForm } from '../../../../core/services/adminService';
import { adminCustomersService } from '../../../../core/services/adminCustomersService';
import { adminMerchantSettingsService, MerchantSettingForm, MerchantSettingsOverview } from '../../../../core/services/adminMerchantSettingsService';
import { hasDirtyState, serializeDirtyState } from '../../../../core/admin/utils/dirtyState';
import { FieldGroup, SelectField, TextAreaField } from '../../../../components/admin/AdminFields';
import { TextField } from '../../../../components/ui/TextField';
import { LogoUploadField } from '../../../../components/shared/LogoUploadField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';

const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'paused', label: 'Pausado' },
];

export function CommercePage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const [form, setForm] = useState<MerchantAdminForm | null>(null);
  const [settingsOverview, setSettingsOverview] = useState<MerchantSettingsOverview | null>(null);
  const [summary, setSummary] = useState({
    branches: 0,
    branchHours: 0,
    branchClosures: 0,
    branchCoverage: 0,
    staff: 0,
    customers: 0,
    categories: 0,
    products: 0,
    modifierGroups: 0,
    merchantSettings: 0,
  });
  const [initialState, setInitialState] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [settingOpen, setSettingOpen] = useState(false);
  const [settingForm, setSettingForm] = useState<MerchantSettingForm>(adminMerchantSettingsService.createEmptySettingForm());

  const formatDateTime = (value: string) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  };

  const previewJson = (value: unknown) => {
    const text = JSON.stringify(value ?? {}, null, 2);
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  };

  useEffect(() => {
    const load = async () => {
      if (!merchantId) return;
      setLoading(true);
      const [merchantResult, branchesResult, categoriesResult, productsResult, modifiersResult, settingsResult] = await Promise.all([
        adminService.fetchMerchant(merchantId),
        adminService.fetchBranches(merchantId),
        adminService.fetchCategories(merchantId),
        adminService.fetchProducts(merchantId),
        adminService.fetchModifierGroups(merchantId),
        adminMerchantSettingsService.fetchOverview(merchantId),
      ]);
      const [staffResult, customersResult] = await Promise.all([
        adminService.fetchStaff(merchantId),
        adminCustomersService.fetchCustomers(merchantId),
      ]);
      setLoading(false);
      if (merchantResult.error) {
        setError(merchantResult.error.message);
        return;
      }
      if (merchantResult.data) {
        setForm(merchantResult.data);
        setInitialState(serializeDirtyState(merchantResult.data));
      }
      setSettingsOverview(settingsResult.data ?? null);
      setSummary({
        branches: branchesResult.data?.length ?? 0,
        branchHours: (branchesResult.data ?? []).reduce((total, branch) => total + branch.hours_count, 0),
        branchClosures: (branchesResult.data ?? []).reduce((total, branch) => total + branch.closures_count, 0),
        branchCoverage: (branchesResult.data ?? []).reduce((total, branch) => total + branch.coverage_count, 0),
        staff: staffResult.data?.length ?? 0,
        customers: customersResult.data?.length ?? 0,
        categories: categoriesResult.data?.length ?? 0,
        products: productsResult.data?.length ?? 0,
        modifierGroups: modifiersResult.data?.length ?? 0,
        merchantSettings: settingsResult.data?.settings.length ?? 0,
      });
      if (branchesResult.error || categoriesResult.error || productsResult.error || modifiersResult.error || staffResult.error || customersResult.error || settingsResult.error) {
        setError(
          branchesResult.error?.message ||
            categoriesResult.error?.message ||
            productsResult.error?.message ||
            modifiersResult.error?.message ||
            staffResult.error?.message ||
            customersResult.error?.message ||
            settingsResult.error?.message ||
            null
        );
      }
    };

    load();
  }, [merchantId]);

  const dirty = useMemo(() => (form ? hasDirtyState(form, initialState) : false), [form, initialState]);

  const updateField = <K extends keyof MerchantAdminForm>(key: K, value: MerchantAdminForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!merchantId || !form) return;
    setSaving(true);
    setError(null);
    const result = await adminService.saveMerchant(merchantId, form);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setInitialState(serializeDirtyState(form));
    setSuccessMessage('Guardado');
    await portal.reloadPortalContext();
  };

  const openSettingModal = (settingId?: string) => {
    const record = (settingsOverview?.settings ?? []).find((item) => item.id === settingId);
    setSettingForm(record ? adminMerchantSettingsService.createSettingForm(record) : adminMerchantSettingsService.createEmptySettingForm());
    setSettingOpen(true);
    setSuccessMessage(null);
    setError(null);
  };

  const handleSettingSave = async () => {
    if (!merchantId || !portal.sessionUserId) return;
    setSettingsSaving(true);
    setError(null);
    const result = await adminMerchantSettingsService.saveSetting(portal.sessionUserId, merchantId, settingForm);
    setSettingsSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSettingOpen(false);
    setSuccessMessage(settingForm.id ? 'Configuracion del negocio actualizada' : 'Configuracion del negocio creada');
    const settingsResult = await adminMerchantSettingsService.fetchOverview(merchantId);
    if (settingsResult.error) {
      setError(settingsResult.error.message);
      return;
    }
    setSettingsOverview(settingsResult.data ?? null);
    setSummary((current) => ({ ...current, merchantSettings: settingsResult.data?.settings.length ?? current.merchantSettings }));
  };

  if (!merchantId) {
    return <div>No hay comercio disponible para administrar.</div>;
  }

  if (portal.currentScopeType !== 'business') {
    return <div>Esta vista pertenece a la capa negocio.</div>;
  }

  if (loading || !form) {
    return <LoadingScreen message="Cargando comercio..." />;
  }

  return (
    <AdminPageFrame
      title={form.trade_name || 'Comercio'}
      description="Datos generales del negocio actual. Los IDs y relaciones se resuelven automaticamente desde el contexto del portal."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Comercio' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: form.trade_name || 'sin nombre', tone: 'neutral' },
        { label: 'Entidad', value: 'Comercio', tone: 'info' },
        { label: 'Modo', value: 'Edicion', tone: 'warning' },
        { label: 'Estado', value: dirty ? 'Cambios pendientes' : 'Sin cambios', tone: dirty ? 'warning' : 'success' },
      ]}
      actions={<SaveActions onSave={handleSave} disabled={!dirty} isSaving={saving} />}
    >
      <SectionCard title="Datos base" description="Información general gestionada por el comercio.">
        <div className="form-grid">
          <FieldGroup label="Nombre comercial">
            <TextField value={form.trade_name} onChange={(event) => updateField('trade_name', event.target.value)} />
          </FieldGroup>
          <FieldGroup label="Razón social">
            <TextField value={form.legal_name} onChange={(event) => updateField('legal_name', event.target.value)} />
          </FieldGroup>
          <FieldGroup label="RUC o Tax ID">
            <TextField value={form.tax_id} onChange={(event) => updateField('tax_id', event.target.value)} />
          </FieldGroup>
          <FieldGroup label="Teléfono">
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
          <FieldGroup label="Estado operativo">
            <SelectField value={form.status} onChange={(event) => updateField('status', event.target.value)} options={statusOptions} />
          </FieldGroup>
        </div>
      </SectionCard>
      <SectionCard title="Gestión operativa" description="Acceso directo a las diferentes áreas maestras que componen este comercio.">
        <div className="nav-grid">
          {[
            {
              label: 'Sucursales',
              count: summary.branches,
              to: AppRoutes.portal.admin.branches,
              description: 'Horarios, cierres y cobertura.',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            },
            {
              label: 'Categorías',
              count: summary.categories,
              to: AppRoutes.portal.admin.categories,
              description: 'Base del árbol del menú.',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            },
            {
              label: 'Productos',
              count: summary.products,
              to: AppRoutes.portal.admin.products,
              description: 'Menú y disponibilidad operativa.',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            },
            {
              label: 'Modificadores',
              count: summary.modifierGroups,
              to: AppRoutes.portal.admin.modifiers,
              description: 'Extras y personalización.',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            },
            {
              label: 'Personal',
              count: summary.staff,
              to: AppRoutes.portal.admin.staff,
              description: 'Equipo y roles asignados.',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            },
            {
              label: 'Clientes',
              count: summary.customers,
              to: AppRoutes.portal.admin.customers,
              description: 'Historial y preferencias guardadas.',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            },
          ].map((item) => (
            <Link key={item.label} to={item.to} className="nav-card">
              <div className="nav-card__arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
              <div className="nav-card__icon-wrap">
                {item.icon}
              </div>
              <div className="nav-card__label">{item.label}</div>
              <strong className="nav-card__count">{item.count}</strong>
              <p className="nav-card__desc">{item.description}</p>
            </Link>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Configuración avanzada"
        description="Reglas de negocio propias del comercio en el motor de ACME."
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => openSettingModal()}
            className="btn btn--primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo setting
          </button>
        </div>
        <AdminDataTable
          rows={settingsOverview?.settings ?? []}
          getRowId={(record) => record.id}
          emptyMessage="No hay configuraciones registradas para este comercio."
          columns={[
            {
              id: 'key',
              header: 'Clave técnica',
              render: (record) => (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="module-icon-box" style={{ width: '32px', height: '32px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <div className="module-info">
                    <strong style={{ fontWeight: 800 }}>{record.key}</strong>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{record.description || 'Configuración del negocio'}</span>
                  </div>
                </div>
              ),
            },
            {
              id: 'value',
              header: 'Valor (JSON)',
              render: (record) => (
                <div style={{ background: 'var(--acme-surface-muted)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--acme-border)' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px', color: 'var(--acme-purple)', fontWeight: 600 }}>{previewJson(record.value_json)}</pre>
                </div>
              ),
            },
            { id: 'updated', header: 'Última edición', render: (record) => <span style={{ fontSize: '13px', color: 'var(--acme-text-muted)' }}>{formatDateTime(record.updated_at || record.created_at)}</span> },
            {
              id: 'action',
              header: '',
              align: 'right',
              width: '120px',
              render: (record) => (
                <button type="button" onClick={() => openSettingModal(record.id)} className="btn btn--ghost btn--sm" style={{ fontWeight: 700 }}>
                  Editar
                </button>
              ),
            },
          ]}
        />
      </SectionCard>
      <SectionCard title="Auditoria de configuracion" description="Cada cambio de merchant_settings deja traza para el owner y soporte.">
        <AdminTimeline
          items={(settingsOverview?.audit_logs ?? []).map((item) => ({
            id: item.id,
            title: item.action || 'merchant_setting',
            subtitle: `${item.user_label || 'Sin usuario'} - ${formatDateTime(item.created_at)}`,
            tone: 'info',
            body: <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>{previewJson(item.metadata_json)}</pre>,
          }))}
        />
      </SectionCard>
      <FormStatusBar dirty={dirty} saving={saving || settingsSaving} error={error} successMessage={successMessage} />
      <AdminModalForm
        open={settingOpen}
        title={settingForm.id ? 'Editar setting del negocio' : 'Nuevo setting del negocio'}
        description="Define una clave propia del comercio con JSON valido."
        onClose={() => setSettingOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setSettingOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSettingSave}
              className="btn btn--primary"
            >
              {settingsSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <FieldGroup label="Clave">
          <TextField
            value={settingForm.key}
            onChange={(event) => setSettingForm((current) => ({ ...current, key: event.target.value }))}
            placeholder="order_timeouts"
          />
        </FieldGroup>
        <FieldGroup label="Descripcion">
          <TextField
            value={settingForm.description}
            onChange={(event) => setSettingForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Describe el uso de esta configuracion"
          />
        </FieldGroup>
        <FieldGroup label="JSON">
          <TextAreaField value={settingForm.value_json_text} onChange={(event) => setSettingForm((current) => ({ ...current, value_json_text: event.target.value }))} />
        </FieldGroup>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
