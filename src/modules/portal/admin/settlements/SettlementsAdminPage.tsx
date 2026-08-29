import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckboxField, FieldGroup, NumberField, SelectField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminSettlementsService,
  CommissionRuleForm,
  CommissionRuleRecord,
  SettlementsOverview,
} from '../../../../core/services/adminSettlementsService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { IconPlus } from '../../../../components/admin/AdminIcons';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value);
}

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
  if (normalized === 'paid' || normalized === 'active') return 'success' as const;
  if (normalized === 'pending' || normalized === 'draft') return 'warning' as const;
  if (normalized === 'overdue' || normalized === 'failed') return 'danger' as const;
  return 'info' as const;
}

function getRuleValueLabel(record: Pick<CommissionRuleRecord | CommissionRuleForm, 'rule_type' | 'value'>) {
  if (record.rule_type === 'percent') return `${record.value}%`;
  return formatMoney(Number(record.value ?? 0));
}

export function SettlementsAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const [query, setQuery] = useState('');
  const [overview, setOverview] = useState<SettlementsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<CommissionRuleForm>(adminSettlementsService.createEmptyCommissionRuleForm());

  const loadData = async () => {
    if (!merchantId) return;
    setLoading(true);
    setError(null);
    const result = await adminSettlementsService.fetchSettlementsOverview(merchantId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setOverview(result.data ?? null);
  };

  useEffect(() => {
    loadData();
  }, [merchantId]);

  const filteredRules = useMemo(() => {
    const records = overview?.commission_rules ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.scope_type, record.scope_label, record.who_pays, record.rule_type].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.commission_rules, query]);

  const filteredMerchantSettlements = useMemo(() => {
    const records = overview?.merchant_settlements ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.status, record.period_start, record.period_end].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.merchant_settlements, query]);

  const filteredDriverSettlements = useMemo(() => {
    const records = overview?.driver_settlements ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.driver_label, record.status, record.period_start, record.period_end].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.driver_settlements, query]);

  const scopeOptions = useMemo(() => {
    return [
      { value: 'merchant', label: 'Comercio' },
      { value: 'branch', label: 'Sucursal' },
      { value: 'driver', label: 'Repartidor' },
    ];
  }, []);

  const currentScopeOptions = useMemo(() => {
    if (!overview || !merchantId) return [{ value: '', label: 'Selecciona un alcance' }];
    if (ruleForm.scope_type === 'merchant') {
      return [{ value: merchantId, label: portal.currentMerchant?.name || portal.merchant?.name || 'Comercio actual' }];
    }
    if (ruleForm.scope_type === 'branch') {
      return [{ value: '', label: 'Selecciona una sucursal' }, ...overview.branch_options.map((item) => ({ value: item.id, label: item.label }))];
    }
    if (ruleForm.scope_type === 'driver') {
      return [{ value: '', label: 'Selecciona un repartidor' }, ...overview.driver_options.map((item) => ({ value: item.id, label: item.label }))];
    }
    return [{ value: '', label: 'Selecciona un alcance' }];
  }, [merchantId, overview, portal.currentMerchant?.name, portal.merchant?.name, ruleForm.scope_type]);

  const openRuleModal = (record?: CommissionRuleRecord) => {
    setRuleForm(record ? adminSettlementsService.createCommissionRuleForm(record) : adminSettlementsService.createEmptyCommissionRuleForm());
    setRuleOpen(true);
  };

  const handleRuleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    setError(null);
    const result = await adminSettlementsService.saveCommissionRule(merchantId, ruleForm);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRuleOpen(false);
    setSuccessMessage(ruleForm.id ? 'Regla actualizada' : 'Regla creada');
    await loadData();
  };

  if (!merchantId) {
    return <div>No hay comercio activo para administrar liquidaciones.</div>;
  }

  return (
    <AdminPageFrame
      title="Liquidaciones"
      description="Reglas de comision y cierres economicos de comercio y reparto desde un solo modulo financiero."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Liquidaciones' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Liquidacion', tone: 'info' },
        { label: 'Modo', value: 'Finanzas', tone: 'warning' },
      ]}
      actions={
        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null);
            openRuleModal();
          }}
          className="btn btn--primary"
        >
          <IconPlus />
            Nueva regla
        </button>
      }
    >
      <SectionCard title="Terminal de Conciliación" description="Monitoreo global de cierres comerciales, comisiones de reparto y balances financieros.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por estado, periodo, comercio o repartidor..."
            className="input-field"
            style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
          />
        </div>
      </SectionCard>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Neto Comercio', value: formatMoney((overview?.merchant_settlements ?? []).reduce((sum, record) => sum + record.net_payable, 0)), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
              { label: 'Neto Reparto', value: formatMoney((overview?.driver_settlements ?? []).reduce((sum, record) => sum + record.net_payable, 0)), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { label: 'Reglas Activas', value: String((overview?.commission_rules ?? []).filter((rule) => rule.is_active).length), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
              { label: 'Liquidaciones', value: String((overview?.merchant_settlements.length ?? 0) + (overview?.driver_settlements.length ?? 0)), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
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

          <SectionCard title="Reglas de Comisión Vigentes" description="Matriz institucional de cargos por servicio aplicados a comercios y reparto.">
            <AdminDataTable
              rows={filteredRules}
              getRowId={(record) => record.id}
              emptyMessage="No se encontraron reglas de comisión activas."
              columns={[
                {
                  id: 'scope',
                  header: 'Alcance Operativo',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-bg-soft)', color: 'var(--acme-purple)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{record.scope_label || 'Global'}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.scope_type.toUpperCase()}</span>
                      </div>
                    </div>
                  ),
                },
                { 
                  id: 'payer', 
                  header: 'Contribuyente', 
                  render: (record) => (
                    <StatusPill label={(record.who_pays || 'SISTEMA').toUpperCase()} tone="info" />
                  ) 
                },
                {
                  id: 'value',
                  header: 'Tasa / Valor',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--acme-purple)' }}>{getRuleValueLabel(record)}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.rule_type === 'percent' ? 'Variable' : 'Costo Fijo'}</span>
                    </div>
                  ),
                },
                {
                  id: 'window',
                  header: 'Vigencia de Aplicación',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Desde: {record.starts_at ? new Date(record.starts_at).toLocaleDateString() : 'Inmediata'}</span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>Hasta: {record.ends_at ? new Date(record.ends_at).toLocaleDateString() : 'Indefinida'}</span>
                    </div>
                  )
                },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => <StatusPill label={record.is_active ? 'ACTIVA' : 'INACTIVA'} tone={record.is_active ? 'success' : 'warning'} />,
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openRuleModal(record)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)', fontWeight: 700 }}>
                      Configurar
                    </button>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Liquidaciones de comercio" description="merchant_settlements y merchant_settlement_items se exponen como lectura financiera del comercio actual.">
            <AdminDataTable
              rows={filteredMerchantSettlements}
              getRowId={(record) => record.id}
              emptyMessage="No hay liquidaciones de comercio registradas."
              columns={[
                {
                  id: 'period',
                  header: 'Periodo',
                  render: (record) => `${formatDateTime(record.period_start)} - ${formatDateTime(record.period_end)}`,
                },
                { id: 'gross', header: 'Bruto', render: (record) => formatMoney(record.gross_sales) },
                { id: 'commission', header: 'Comision', render: (record) => formatMoney(record.commission_amount) },
                { id: 'net', header: 'Neto', render: (record) => formatMoney(record.net_payable) },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => <StatusPill label={record.status || 'sin estado'} tone={getStatusTone(record.status)} />,
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '160px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.merchantSettlementDetail.replace(':settlementId', record.id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                      Ver detalle
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Liquidaciones de reparto" description="driver_settlements y driver_settlement_items se exponen con contexto del repartidor.">
            <AdminDataTable
              rows={filteredDriverSettlements}
              getRowId={(record) => record.id}
              emptyMessage="No hay liquidaciones de reparto registradas."
              columns={[
                {
                  id: 'driver',
                  header: 'Repartidor',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.driver_label || 'Sin repartidor'}</strong>
                      <span style={{ color: '#6b7280' }}>{record.deliveries_count} entregas</span>
                    </div>
                  ),
                },
                {
                  id: 'period',
                  header: 'Periodo',
                  render: (record) => `${formatDateTime(record.period_start)} - ${formatDateTime(record.period_end)}`,
                },
                { id: 'gross', header: 'Bruto', render: (record) => formatMoney(record.gross_earnings) },
                { id: 'net', header: 'Neto', render: (record) => formatMoney(record.net_payable) },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => <StatusPill label={record.status || 'sin estado'} tone={getStatusTone(record.status)} />,
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '160px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.driverSettlementDetail.replace(':settlementId', record.id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                      Ver detalle
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>
        </>
      )}

      <FormStatusBar dirty={false} saving={saving} error={error} successMessage={successMessage} />

      <AdminModalForm
        open={ruleOpen}
        title={ruleForm.id ? 'Configurar Regla de Comisión' : 'Nueva Definición Financiera'}
        description="Define los parámetros de cobro que el motor de liquidación aplicará a los cierres de caja y reparto."
        onClose={() => setRuleOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setRuleOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRuleSave}
              disabled={saving || !ruleForm.rule_type || !ruleForm.who_pays || !(ruleForm.scope_type === 'merchant' || ruleForm.scope_id)}
              className="btn btn--primary"
            >
              {saving ? 'Guardando...' : 'Aplicar Regla'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="form-grid">
            <FieldGroup label="Nivel de Alcance" hint="Define a qué entidad se aplica esta regla.">
              <SelectField
                value={ruleForm.scope_type}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    scope_type: event.target.value,
                    scope_id: event.target.value === 'merchant' ? merchantId : '',
                  }))
                }
                options={scopeOptions}
              />
            </FieldGroup>
            <FieldGroup label="Entidad Específica" hint="El sujeto pasivo de la comisión.">
              <SelectField value={ruleForm.scope_type === 'merchant' ? merchantId : ruleForm.scope_id} onChange={(event) => setRuleForm((current) => ({ ...current, scope_id: event.target.value }))} options={currentScopeOptions} />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Quién Contribuye" hint="Actor que asume el costo del servicio.">
              <SelectField
                value={ruleForm.who_pays}
                onChange={(event) => setRuleForm((current) => ({ ...current, who_pays: event.target.value }))}
                options={[
                  { value: 'merchant', label: 'Comercio (Ventas)' },
                  { value: 'driver', label: 'Repartidor (Comisiones)' },
                  { value: 'platform', label: 'Plataforma (Subsidio)' },
                  { value: 'customer', label: 'Cliente (Fee de Servicio)' },
                ]}
              />
            </FieldGroup>
            <FieldGroup label="Modelo de Cobro">
              <SelectField
                value={ruleForm.rule_type}
                onChange={(event) => setRuleForm((current) => ({ ...current, rule_type: event.target.value }))}
                options={[
                  { value: 'percent', label: 'Porcentaje (%)' },
                  { value: 'fixed', label: 'Monto Fijo (S/.)' },
                ]}
              />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Valor de la Regla">
              <NumberField value={ruleForm.value} onChange={(event) => setRuleForm((current) => ({ ...current, value: event.target.value }))} placeholder="0.00" />
            </FieldGroup>
            <div className="scope-card" style={{ padding: '16px', background: ruleForm.is_active ? 'rgba(34, 197, 94, 0.05)' : undefined, cursor: 'pointer', alignSelf: 'center' }} onClick={() => setRuleForm(c => ({...c, is_active: !c.is_active}))}>
              <CheckboxField label="Regla Habilitada" checked={ruleForm.is_active} onChange={() => {}} />
            </div>
          </div>

          <div className="form-grid">
            <FieldGroup label="Vencimiento / Refresh" hint="Deja vacío para vigencia permanente.">
              <TextField type="datetime-local" value={ruleForm.ends_at} onChange={(event) => setRuleForm((current) => ({ ...current, ends_at: event.target.value }))} />
            </FieldGroup>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--acme-text-faint)', fontSize: '12px', padding: '12px' }}>
              Las liquidaciones en curso no se verán afectadas hasta el próximo periodo de cierre.
            </div>
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
