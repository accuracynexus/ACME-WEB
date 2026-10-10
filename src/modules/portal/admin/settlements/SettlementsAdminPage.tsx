import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckboxField, FieldGroup, NumberField, SelectField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminSearchBar } from '../../../../components/admin/AdminSearchBar';
import { AdminStatCard } from '../../../../components/admin/AdminStatCard';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { formatMoney, formatPeriod, getFinanceStatus } from '../../../../core/admin/utils/financeLabels';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminSettlementsService,
  CommissionRuleForm,
  CommissionRuleRecord,
  SettlementsOverview,
} from '../../../../core/services/adminSettlementsService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { IconPlus } from '../../../../components/admin/AdminIcons';

const SCOPE_LABELS: Record<string, string> = { merchant: 'Comercio', branch: 'Sucursal', driver: 'Repartidor' };
const PAYER_LABELS: Record<string, string> = { merchant: 'Comercio', driver: 'Repartidor', platform: 'ACME', customer: 'Cliente' };

function getRuleValueLabel(record: Pick<CommissionRuleRecord | CommissionRuleForm, 'rule_type' | 'value'>) {
  if (record.rule_type === 'percent') return `${record.value}%`;
  return formatMoney(Number(record.value ?? 0));
}

function formatDate(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function FinanceStatus({ status }: { status: string }) {
  const meta = getFinanceStatus(status);
  return <StatusPill label={meta.label} tone={meta.tone} />;
}

function Money({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: strong ? 800 : 500 }}>
      {formatMoney(value)}
    </span>
  );
}

function TwoLine({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '2px' }}>
      <strong style={{ fontSize: '14px' }}>{main}</strong>
      {sub ? <span style={{ color: 'var(--acme-text-muted)', fontSize: '12.5px' }}>{sub}</span> : null}
    </div>
  );
}

export function SettlementsAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  // Las reglas de comision y lo que se le paga a cada repartidor los define
  // ACME; la tienda ve sus liquidaciones y la comision que se le aplica.
  const isPlatformAdmin = portal.permissions.canAccessPlatform;
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

  const normalizedQuery = query.trim().toLowerCase();

  // La consulta trae todas las reglas; la tienda solo ve las que le aplican.
  const visibleRules = useMemo(() => {
    const records = overview?.commission_rules ?? [];
    if (isPlatformAdmin) return records;
    const branchIds = new Set((overview?.branch_options ?? []).map((item) => item.id));
    return records.filter(
      (record) => (record.scope_type === 'merchant' && record.scope_id === merchantId) || (record.scope_type === 'branch' && branchIds.has(record.scope_id))
    );
  }, [overview, isPlatformAdmin, merchantId]);

  const filteredRules = useMemo(() => {
    if (!normalizedQuery) return visibleRules;
    return visibleRules.filter((record) =>
      [SCOPE_LABELS[record.scope_type], record.scope_label, PAYER_LABELS[record.who_pays], record.rule_type].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [visibleRules, normalizedQuery]);

  const filteredMerchantSettlements = useMemo(() => {
    const records = overview?.merchant_settlements ?? [];
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [getFinanceStatus(record.status).label, formatPeriod(record.period_start, record.period_end)].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.merchant_settlements, normalizedQuery]);

  const filteredDriverSettlements = useMemo(() => {
    const records = overview?.driver_settlements ?? [];
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.driver_label, getFinanceStatus(record.status).label, formatPeriod(record.period_start, record.period_end)].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.driver_settlements, normalizedQuery]);

  const totals = useMemo(() => {
    const merchant = overview?.merchant_settlements ?? [];
    return {
      pending: merchant.filter((record) => String(record.status).toLowerCase() !== 'paid').reduce((sum, record) => sum + record.net_payable, 0),
      paid: merchant.filter((record) => String(record.status).toLowerCase() === 'paid').reduce((sum, record) => sum + record.net_payable, 0),
      commission: merchant.reduce((sum, record) => sum + record.commission_amount, 0),
      drivers: (overview?.driver_settlements ?? []).reduce((sum, record) => sum + record.net_payable, 0),
    };
  }, [overview]);

  const scopeOptions = useMemo(
    () => [
      { value: 'merchant', label: 'Comercio' },
      { value: 'branch', label: 'Sucursal' },
      { value: 'driver', label: 'Repartidor' },
    ],
    []
  );

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
    setSuccessMessage(null);
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
    return <div>No hay comercio activo para ver liquidaciones.</div>;
  }

  return (
    <AdminPageFrame
      title="Liquidaciones"
      description={
        isPlatformAdmin
          ? 'Comisiones y pagos a comercios y repartidores.'
          : 'Lo que ACME te paga por tus ventas, despues de su comision.'
      }
      breadcrumbs={[{ label: 'Admin', to: AppRoutes.portal.admin.root }, { label: 'Liquidaciones' }]}
      contextItems={[]}
      actions={
        isPlatformAdmin ? (
          <button type="button" onClick={() => openRuleModal()} className="btn btn--primary">
            <IconPlus />
            Nueva regla
          </button>
        ) : undefined
      }
    >
      <FormStatusBar dirty={false} saving={saving} error={error} successMessage={successMessage} />

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 0 }}>
            <AdminStatCard
              label={isPlatformAdmin ? 'Por pagar al comercio' : 'Por cobrar'}
              value={formatMoney(totals.pending)}
              icon="wallet"
              tone="orange"
              help="Liquidaciones que aun no se pagan."
            />
            <AdminStatCard label={isPlatformAdmin ? 'Pagado al comercio' : 'Ya cobrado'} value={formatMoney(totals.paid)} icon="check-circle" tone="green" />
            <AdminStatCard label="Comision ACME" value={formatMoney(totals.commission)} icon="percent" tone="purple" />
            {isPlatformAdmin ? <AdminStatCard label="Pagos a repartidores" value={formatMoney(totals.drivers)} icon="truck" tone="neutral" /> : null}
          </div>

          <AdminSearchBar value={query} onChange={setQuery} placeholder="Buscar por periodo, estado o repartidor" label="Buscar liquidaciones" />

          <SectionCard title={isPlatformAdmin ? 'Liquidaciones del comercio' : 'Tus liquidaciones'} description="Ventas de cada periodo, la comision de ACME y lo que queda para el comercio.">
            <AdminDataTable
              rows={filteredMerchantSettlements}
              getRowId={(record) => record.id}
              emptyMessage="Todavia no hay liquidaciones."
              columns={[
                { id: 'period', header: 'Periodo', render: (record) => <strong>{formatPeriod(record.period_start, record.period_end)}</strong> },
                { id: 'gross', header: 'Ventas', align: 'right', render: (record) => <Money value={record.gross_sales} /> },
                { id: 'commission', header: 'Comision', align: 'right', render: (record) => <Money value={-record.commission_amount} /> },
                { id: 'net', header: 'A pagar', align: 'right', render: (record) => <Money value={record.net_payable} strong /> },
                { id: 'status', header: 'Estado', render: (record) => <FinanceStatus status={record.status} /> },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '120px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.merchantSettlementDetail.replace(':settlementId', record.id)} className="btn btn--sm btn--ghost">
                      Ver detalle
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard
            title={isPlatformAdmin ? 'Reglas de comision' : 'Tu comision'}
            description={isPlatformAdmin ? 'Cuanto cobra ACME y a quien.' : 'Lo que ACME descuenta de tus ventas.'}
          >
            <AdminDataTable
              rows={filteredRules}
              getRowId={(record) => record.id}
              emptyMessage={isPlatformAdmin ? 'No hay reglas de comision.' : 'No tienes una comision configurada.'}
              columns={[
                {
                  id: 'scope',
                  header: 'Aplica a',
                  render: (record) => <TwoLine main={record.scope_label || 'Todos'} sub={SCOPE_LABELS[record.scope_type] || record.scope_type} />,
                },
                ...(isPlatformAdmin
                  ? [{ id: 'payer', header: 'Paga', render: (record: CommissionRuleRecord) => PAYER_LABELS[record.who_pays] || record.who_pays || 'Sin definir' }]
                  : []),
                {
                  id: 'value',
                  header: 'Comision',
                  render: (record) => (
                    <TwoLine main={<span style={{ color: 'var(--acme-purple)' }}>{getRuleValueLabel(record)}</span>} sub={record.rule_type === 'percent' ? 'Por venta' : 'Monto fijo'} />
                  ),
                },
                {
                  id: 'window',
                  header: 'Vigencia',
                  render: (record) => (
                    <span style={{ fontSize: '13px' }}>
                      {record.starts_at ? `Desde ${formatDate(record.starts_at)}` : 'Desde siempre'}
                      {record.ends_at ? ` hasta ${formatDate(record.ends_at)}` : ''}
                    </span>
                  ),
                },
                { id: 'status', header: 'Estado', render: (record) => <StatusPill label={record.is_active ? 'Activa' : 'Inactiva'} tone={record.is_active ? 'success' : 'neutral'} /> },
                ...(isPlatformAdmin
                  ? [
                      {
                        id: 'action',
                        header: '',
                        align: 'right' as const,
                        width: '120px',
                        render: (record: CommissionRuleRecord) => (
                          <button type="button" onClick={() => openRuleModal(record)} className="btn btn--sm btn--ghost">
                            Editar
                          </button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </SectionCard>

          {isPlatformAdmin ? (
            <SectionCard title="Liquidaciones de repartidores" description="Lo que se le paga a cada repartidor por sus entregas.">
              <AdminDataTable
                rows={filteredDriverSettlements}
                getRowId={(record) => record.id}
                emptyMessage="Todavia no hay liquidaciones de repartidores."
                columns={[
                  { id: 'driver', header: 'Repartidor', render: (record) => <TwoLine main={record.driver_label || 'Sin repartidor'} sub={`${record.deliveries_count} entregas`} /> },
                  { id: 'period', header: 'Periodo', render: (record) => formatPeriod(record.period_start, record.period_end) },
                  { id: 'gross', header: 'Ganado', align: 'right', render: (record) => <Money value={record.gross_earnings} /> },
                  { id: 'net', header: 'A pagar', align: 'right', render: (record) => <Money value={record.net_payable} strong /> },
                  { id: 'status', header: 'Estado', render: (record) => <FinanceStatus status={record.status} /> },
                  {
                    id: 'action',
                    header: '',
                    align: 'right',
                    width: '120px',
                    render: (record) => (
                      <Link to={AppRoutes.portal.admin.driverSettlementDetail.replace(':settlementId', record.id)} className="btn btn--sm btn--ghost">
                        Ver detalle
                      </Link>
                    ),
                  },
                ]}
              />
            </SectionCard>
          ) : null}
        </>
      )}

      <AdminModalForm
        open={ruleOpen}
        title={ruleForm.id ? 'Editar regla de comision' : 'Nueva regla de comision'}
        description="Se aplica desde el proximo cierre; las liquidaciones en curso no cambian."
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
              {saving ? 'Guardando...' : 'Guardar regla'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="form-grid">
            <FieldGroup label="Aplica a">
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
            <FieldGroup label="Cual">
              <SelectField
                value={ruleForm.scope_type === 'merchant' ? merchantId : ruleForm.scope_id}
                onChange={(event) => setRuleForm((current) => ({ ...current, scope_id: event.target.value }))}
                options={currentScopeOptions}
              />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Quien paga">
              <SelectField
                value={ruleForm.who_pays}
                onChange={(event) => setRuleForm((current) => ({ ...current, who_pays: event.target.value }))}
                options={[
                  { value: 'merchant', label: 'Comercio' },
                  { value: 'driver', label: 'Repartidor' },
                  { value: 'platform', label: 'ACME' },
                  { value: 'customer', label: 'Cliente' },
                ]}
              />
            </FieldGroup>
            <FieldGroup label="Tipo">
              <SelectField
                value={ruleForm.rule_type}
                onChange={(event) => setRuleForm((current) => ({ ...current, rule_type: event.target.value }))}
                options={[
                  { value: 'percent', label: 'Porcentaje (%)' },
                  { value: 'fixed', label: 'Monto fijo (S/)' },
                ]}
              />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label={ruleForm.rule_type === 'percent' ? 'Porcentaje' : 'Monto'}>
              <NumberField value={ruleForm.value} onChange={(event) => setRuleForm((current) => ({ ...current, value: event.target.value }))} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label="Vence" hint="Dejalo vacio si no vence.">
              <TextField type="datetime-local" value={ruleForm.ends_at} onChange={(event) => setRuleForm((current) => ({ ...current, ends_at: event.target.value }))} />
            </FieldGroup>
          </div>

          <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setRuleForm((c) => ({ ...c, is_active: !c.is_active }))}>
            <CheckboxField label="Regla activa" checked={ruleForm.is_active} onChange={() => {}} />
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
