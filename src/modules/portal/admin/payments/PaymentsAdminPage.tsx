import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminSearchBar } from '../../../../components/admin/AdminSearchBar';
import { AdminStatCard } from '../../../../components/admin/AdminStatCard';
import { ModuleIcon } from '../../../../components/admin/ModuleIcon';
import { CheckboxField, FieldGroup } from '../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { formatDateTime, formatMoney, getFinanceStatus, getTransactionTypeLabel } from '../../../../core/admin/utils/financeLabels';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminPaymentsService,
  PaymentMethodAdminForm,
  PlatformCashCollectionRecord,
  PlatformPaymentMethodRecord,
  PlatformPaymentsOverview,
} from '../../../../core/services/adminPaymentsService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { toast } from '../../../../core/utils/toast';
import { IconPlus } from '../../../../components/admin/AdminIcons';

type PaymentsTab = 'summary' | 'payments' | 'transactions' | 'refunds' | 'cash' | 'methods';

function FinanceStatus({ status }: { status: string }) {
  const meta = getFinanceStatus(status);
  return <StatusPill label={meta.label} tone={meta.tone} />;
}

/** Celda con un dato principal y uno secundario debajo. */
function TwoLine({ main, sub, icon }: { main: ReactNode; sub?: ReactNode; icon?: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      {icon ? (
        <div
          style={{
            width: '36px',
            height: '36px',
            flexShrink: 0,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--acme-purple-light)',
            color: 'var(--acme-purple)',
          }}
        >
          <ModuleIcon icon={icon} size={17} />
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: '2px' }}>
        <strong style={{ fontSize: '14px' }}>{main}</strong>
        {sub ? <span style={{ color: 'var(--acme-text-muted)', fontSize: '12.5px' }}>{sub}</span> : null}
      </div>
    </div>
  );
}

function Money({ value, currency }: { value: number; currency?: string }) {
  return <strong style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMoney(value, currency)}</strong>;
}

function DateCell({ value }: { value: string }) {
  return <span style={{ fontSize: '13px', color: 'var(--acme-text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(value)}</span>;
}

export function PaymentsAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id ?? null;
  const isPlatformScope = portal.currentScopeType === 'platform';
  const isBusinessScope = portal.currentScopeType === 'business';
  const [activeTab, setActiveTab] = useState<PaymentsTab>('summary');
  const [overview, setOverview] = useState<PlatformPaymentsOverview | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pagina de consulta: errores y confirmaciones van como aviso, sin barra fija.
  useEffect(() => {
    if (error) toast.error('Error', error);
  }, [error]);
  useEffect(() => {
    if (successMessage) toast.success(successMessage);
  }, [successMessage]);
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodForm, setMethodForm] = useState<PaymentMethodAdminForm>(adminPaymentsService.createEmptyPaymentMethodForm());

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const result = await adminPaymentsService.fetchOverview({ scopeType: portal.currentScopeType, merchantId });
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setOverview(result.data ?? null);
  };

  useEffect(() => {
    if (isPlatformScope || (isBusinessScope && merchantId)) {
      loadData();
    }
  }, [isBusinessScope, isPlatformScope, merchantId, portal.currentScopeType]);

  // La pasarela, la caja del repartidor y los metodos son de ACME; la tienda
  // solo ve sus cobros y devoluciones.
  useEffect(() => {
    if (!isPlatformScope && ['transactions', 'cash', 'methods'].includes(activeTab)) {
      setActiveTab('summary');
    }
  }, [activeTab, isPlatformScope]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPayments = useMemo(() => {
    const rows = overview?.payments ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.order_code, row.merchant_label, row.branch_label, row.customer_label, row.payment_method_label, row.status, row.provider, row.external_reference]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [overview?.payments, normalizedQuery]);

  const filteredTransactions = useMemo(() => {
    const rows = overview?.transactions ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.payment_label, row.merchant_label, row.transaction_type, row.status, row.provider_transaction_id].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.transactions, normalizedQuery]);

  const filteredRefunds = useMemo(() => {
    const rows = overview?.refunds ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) => [row.payment_label, row.merchant_label, row.reason, row.status].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.refunds, normalizedQuery]);

  const filteredMethods = useMemo(() => {
    const rows = overview?.payment_methods ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) => [row.code, row.name].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.payment_methods, normalizedQuery]);

  const filteredCashCollections = useMemo(() => {
    const rows = overview?.cash_collections ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.order_code, row.merchant_label, row.branch_label, row.driver_label, row.status].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.cash_collections, normalizedQuery]);

  const openMethodModal = (record?: PlatformPaymentMethodRecord) => {
    setSuccessMessage(null);
    setMethodForm(record ? adminPaymentsService.createPaymentMethodForm(record) : adminPaymentsService.createEmptyPaymentMethodForm());
    setMethodOpen(true);
  };

  const handleMethodSave = async () => {
    if (!methodForm.code.trim() || !methodForm.name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await adminPaymentsService.savePaymentMethod(methodForm);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMethodOpen(false);
    setSuccessMessage(methodForm.id ? 'Metodo actualizado' : 'Metodo creado');
    await loadData();
  };

  if (!isPlatformScope && !isBusinessScope) {
    return <div>Esta vista pertenece a plataforma o negocio.</div>;
  }

  if (isBusinessScope && !merchantId) {
    return <div>No hay comercio activo para ver pagos.</div>;
  }

  const summary = overview?.summary;
  const countBadge = (count?: number) => (count ? String(count) : undefined);

  return (
    <AdminPageFrame
      title="Pagos"
      description={
        isPlatformScope
          ? 'Cobros, devoluciones, pasarela, efectivo de repartidores y metodos de pago de toda la plataforma.'
          : 'Lo que se cobro por tus productos y las devoluciones a clientes.'
      }
      breadcrumbs={[{ label: 'Admin', to: AppRoutes.portal.admin.root }, { label: 'Pagos' }]}
      contextItems={[]}
      actions={
        isPlatformScope ? (
          <button type="button" onClick={() => openMethodModal()} className="btn btn--primary">
            <IconPlus />
            Nuevo metodo
          </button>
        ) : undefined
      }
    >

      <AdminTabs
        tabs={[
          { id: 'summary', label: 'Resumen' },
          { id: 'payments', label: 'Cobros', badge: countBadge(summary?.payments) },
          ...(isPlatformScope ? [{ id: 'transactions', label: 'Pasarela', badge: countBadge(summary?.transactions) }] : []),
          { id: 'refunds', label: 'Devoluciones', badge: countBadge(summary?.refunds) },
          ...(isPlatformScope
            ? [
                { id: 'cash', label: 'Efectivo', badge: countBadge(summary?.cash_collections) },
                { id: 'methods', label: 'Metodos', badge: countBadge(overview?.payment_methods.length) },
              ]
            : []),
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as PaymentsTab)}
      />

      {activeTab !== 'summary' ? (
        <AdminSearchBar
          value={query}
          onChange={setQuery}
          placeholder={isPlatformScope ? 'Buscar por pedido, comercio, cliente o referencia' : 'Buscar por pedido, cliente o metodo'}
          label="Buscar pagos"
        />
      ) : null}

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : (
        <>
          {activeTab === 'summary' ? (
            <AdminTabPanel>
              {isPlatformScope ? (
                <div className="stat-grid" style={{ marginBottom: 0 }}>
                  <AdminStatCard label="Cobrado a clientes" value={formatMoney(summary?.gross_amount ?? 0)} icon="soles" tone="green" help="Incluye productos, delivery y cargos." />
                  <AdminStatCard label="Ventas de comercios" value={formatMoney(summary?.products_amount ?? 0)} icon="shop" tone="purple" help="Productos de pedidos pagados." />
                  <AdminStatCard label="Devuelto" value={formatMoney(summary?.refunded_amount ?? 0)} icon="rotate-ccw" tone="red" />
                  <AdminStatCard label="Efectivo por liquidar" value={formatMoney(summary?.pending_cash_amount ?? 0)} icon="wallet" tone="orange" help="En manos de repartidores." />
                  <AdminStatCard label="Efectivo liquidado" value={formatMoney(summary?.settled_cash_amount ?? 0)} icon="check-circle" tone="green" />
                  <AdminStatCard label="Metodos activos" value={String(summary?.active_methods ?? 0)} icon="credit-card" tone="neutral" />
                </div>
              ) : (
                <div className="stat-grid" style={{ marginBottom: 0 }}>
                  <AdminStatCard label="Tus productos pagados" value={formatMoney(summary?.products_amount ?? 0)} icon="soles" tone="green" help="Solo pedidos pagados." />
                  <AdminStatCard label="Pedidos pagados" value={String(summary?.paid_orders ?? 0)} icon="receipt" tone="purple" />
                  <AdminStatCard label="Devuelto a clientes" value={formatMoney(summary?.refunded_amount ?? 0)} icon="rotate-ccw" tone="red" />
                </div>
              )}
            </AdminTabPanel>
          ) : null}

          {activeTab === 'payments' ? (
            <SectionCard title="Cobros" description={isPlatformScope ? 'Cada cobro hecho a un cliente.' : 'Lo que se cobro por tus productos en cada pedido.'}>
              <AdminDataTable
                rows={filteredPayments}
                getRowId={(record) => record.id}
                emptyMessage="No hay cobros registrados."
                columns={[
                  {
                    id: 'payment',
                    header: 'Pedido',
                    render: (record) => (
                      <TwoLine icon="credit-card" main={record.order_code ? `Pedido #${record.order_code}` : 'Sin pedido'} sub={record.payment_method_label} />
                    ),
                  },
                  ...(isPlatformScope
                    ? [{ id: 'scope', header: 'Comercio', render: (record: (typeof filteredPayments)[number]) => <TwoLine main={record.merchant_label} sub={record.branch_label} /> }]
                    : []),
                  { id: 'customer', header: 'Cliente', render: (record) => record.customer_label || 'Invitado' },
                  {
                    id: 'amount',
                    header: isPlatformScope ? 'Cobrado' : 'Tus productos',
                    align: 'right',
                    render: (record) => <Money value={isPlatformScope ? record.amount : record.products_amount} currency={record.currency} />,
                  },
                  { id: 'status', header: 'Estado', render: (record) => <FinanceStatus status={record.status} /> },
                  { id: 'date', header: 'Fecha', render: (record) => <DateCell value={record.requested_at} /> },
                ]}
              />
            </SectionCard>
          ) : null}

          {activeTab === 'transactions' && isPlatformScope ? (
            <SectionCard title="Pasarela" description="Respuestas de la pasarela de pago para cada cobro.">
              <AdminDataTable
                rows={filteredTransactions}
                getRowId={(record) => record.id}
                emptyMessage="No hay transacciones registradas."
                columns={[
                  { id: 'payment', header: 'Cobro', render: (record) => <TwoLine main={record.payment_label} sub={record.merchant_label} /> },
                  { id: 'type', header: 'Tipo', render: (record) => getTransactionTypeLabel(record.transaction_type) },
                  { id: 'amount', header: 'Monto', align: 'right', render: (record) => <Money value={record.amount} /> },
                  { id: 'status', header: 'Estado', render: (record) => <FinanceStatus status={record.status} /> },
                  { id: 'provider', header: 'Referencia', render: (record) => record.provider_transaction_id || 'Sin referencia' },
                  { id: 'created', header: 'Fecha', render: (record) => <DateCell value={record.created_at} /> },
                ]}
              />
            </SectionCard>
          ) : null}

          {activeTab === 'refunds' ? (
            <SectionCard title="Devoluciones" description="Dinero devuelto a clientes, total o parcial.">
              <AdminDataTable
                rows={filteredRefunds}
                getRowId={(record) => record.id}
                emptyMessage="No hay devoluciones registradas."
                columns={[
                  { id: 'payment', header: 'Cobro', render: (record) => <TwoLine icon="rotate-ccw" main={record.payment_label} sub={isPlatformScope ? record.merchant_label : undefined} /> },
                  { id: 'reason', header: 'Motivo', render: (record) => record.reason || 'Sin motivo' },
                  { id: 'amount', header: 'Monto', align: 'right', render: (record) => <Money value={record.amount} /> },
                  { id: 'status', header: 'Estado', render: (record) => <FinanceStatus status={record.status} /> },
                  { id: 'date', header: 'Solicitado', render: (record) => <DateCell value={record.requested_at} /> },
                ]}
              />
            </SectionCard>
          ) : null}

          {activeTab === 'cash' && isPlatformScope ? (
            <SectionCard title="Efectivo" description="Efectivo cobrado por los repartidores y si ya se liquido.">
              <AdminDataTable
                rows={filteredCashCollections}
                getRowId={(record) => record.id}
                emptyMessage="No hay cobros en efectivo registrados."
                columns={[
                  {
                    id: 'order',
                    header: 'Pedido',
                    render: (record: PlatformCashCollectionRecord) => (
                      <TwoLine icon="wallet" main={record.order_code ? `Pedido #${record.order_code}` : 'Sin pedido'} sub={record.driver_label || 'Sin repartidor'} />
                    ),
                  },
                  { id: 'scope', header: 'Comercio', render: (record: PlatformCashCollectionRecord) => <TwoLine main={record.merchant_label} sub={record.branch_label} /> },
                  { id: 'amount', header: 'Monto', align: 'right', render: (record: PlatformCashCollectionRecord) => <Money value={record.amount_collected} /> },
                  { id: 'status', header: 'Estado', render: (record: PlatformCashCollectionRecord) => <FinanceStatus status={record.status} /> },
                  { id: 'collected', header: 'Cobrado', render: (record: PlatformCashCollectionRecord) => <DateCell value={record.collected_at} /> },
                  {
                    id: 'settled',
                    header: 'Liquidado',
                    render: (record: PlatformCashCollectionRecord) => (record.settled_at ? <DateCell value={record.settled_at} /> : <FinanceStatus status="pending" />),
                  },
                ]}
              />
            </SectionCard>
          ) : null}

          {activeTab === 'methods' && isPlatformScope ? (
            <SectionCard title="Metodos de pago" description="Formas de pago que ven los clientes al comprar.">
              <AdminDataTable
                rows={filteredMethods}
                getRowId={(record) => record.id}
                emptyMessage="No se encontraron metodos de pago."
                columns={[
                  { id: 'method', header: 'Metodo', render: (record) => <TwoLine icon="credit-card" main={record.name} sub={record.code} /> },
                  {
                    id: 'flags',
                    header: 'Disponibilidad',
                    render: (record) => (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <StatusPill label={record.is_online ? 'En linea' : 'Contra entrega'} tone={record.is_online ? 'info' : 'neutral'} />
                        <StatusPill label={record.is_active ? 'Activo' : 'Inactivo'} tone={record.is_active ? 'success' : 'warning'} />
                      </div>
                    ),
                  },
                  {
                    id: 'usage',
                    header: 'Uso',
                    render: (record) => <TwoLine main={`${record.payments_count} cobros`} sub={`${record.refunds_count} devoluciones`} />,
                  },
                  {
                    id: 'action',
                    header: '',
                    align: 'right',
                    width: '120px',
                    render: (record) => (
                      <button type="button" onClick={() => openMethodModal(record)} className="btn btn--sm btn--ghost">
                        Editar
                      </button>
                    ),
                  },
                ]}
              />
            </SectionCard>
          ) : null}
        </>
      )}

      <AdminModalForm
        open={methodOpen}
        title={methodForm.id ? 'Editar metodo de pago' : 'Nuevo metodo de pago'}
        description="Forma de pago que los clientes veran al comprar."
        onClose={() => setMethodOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setMethodOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleMethodSave} disabled={saving || !methodForm.code.trim() || !methodForm.name.trim()} className="btn btn--primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="form-grid">
            <FieldGroup label="Codigo" hint="Ej: wallet_plin, cash_delivery">
              <TextField value={methodForm.code} onChange={(event) => setMethodForm((current) => ({ ...current, code: event.target.value }))} placeholder="codigo_metodo" />
            </FieldGroup>
            <FieldGroup label="Nombre" hint="Lo que ve el cliente">
              <TextField value={methodForm.name} onChange={(event) => setMethodForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Plin / Yape" />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setMethodForm((c) => ({ ...c, is_online: !c.is_online }))}>
              <CheckboxField label="Se paga en linea" checked={methodForm.is_online} onChange={() => {}} />
            </div>
            <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setMethodForm((c) => ({ ...c, is_active: !c.is_active }))}>
              <CheckboxField label="Metodo habilitado" checked={methodForm.is_active} onChange={() => {}} />
            </div>
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
