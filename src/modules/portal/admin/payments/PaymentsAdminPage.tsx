import { useContext, useEffect, useMemo, useState } from 'react';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { CheckboxField, FieldGroup } from '../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminPaymentsService,
  PaymentMethodAdminForm,
  PlatformCashCollectionRecord,
  PlatformPaymentMethodRecord,
  PlatformPaymentsOverview,
} from '../../../../core/services/adminPaymentsService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { IconPlus } from '../../../../components/admin/AdminIcons';

type PaymentsTab = 'summary' | 'payments' | 'transactions' | 'refunds' | 'cash' | 'methods';

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

function getPaymentTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (['captured', 'paid', 'settled', 'authorized'].includes(normalized)) return 'success' as const;
  if (['failed', 'rejected', 'cancelled'].includes(normalized)) return 'danger' as const;
  if (['pending', 'requested'].includes(normalized)) return 'warning' as const;
  return 'info' as const;
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

  useEffect(() => {
    if (!isPlatformScope && activeTab === 'methods') {
      setActiveTab('summary');
    }
  }, [activeTab, isPlatformScope]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPayments = useMemo(() => {
    const rows = overview?.payments ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [
        row.order_code,
        row.merchant_label,
        row.branch_label,
        row.customer_label,
        row.payment_method_label,
        row.status,
        row.provider,
        row.external_reference,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [overview?.payments, normalizedQuery]);

  const filteredTransactions = useMemo(() => {
    const rows = overview?.transactions ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.payment_label, row.merchant_label, row.transaction_type, row.status, row.provider_transaction_id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [overview?.transactions, normalizedQuery]);

  const filteredRefunds = useMemo(() => {
    const rows = overview?.refunds ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.payment_label, row.merchant_label, row.reason, row.status].join(' ').toLowerCase().includes(normalizedQuery)
    );
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
    return <div>No hay comercio activo para administrar pagos y caja.</div>;
  }

  return (
    <AdminPageFrame
      title={isPlatformScope ? 'Pagos' : 'Pagos y caja'}
      description={
        isPlatformScope
          ? 'Consola global de cobros, transacciones, refunds, metodos y caja para toda la plataforma.'
          : 'Centro financiero del negocio con cobros, refunds y caja operativa ligada a los pedidos del comercio actual.'
      }
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: isPlatformScope ? 'Pagos' : 'Pagos y caja' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        ...(isBusinessScope ? [{ label: 'Comercio', value: portal.currentMerchant?.name || 'sin comercio', tone: 'neutral' as const }] : []),
        { label: 'Entidad', value: isPlatformScope ? 'Cobros globales' : 'Finanzas del negocio', tone: 'warning' },
        { label: 'Modo', value: isPlatformScope ? 'Supervision financiera' : 'Control financiero', tone: 'warning' },
      ]}
      actions={
        isPlatformScope ? (
          <button type="button" onClick={() => openMethodModal()} className="btn btn--primary">
            <IconPlus />
            Nuevo metodo
          </button>
        ) : undefined
      }
    >
      <SectionCard title="Monitor Financiero" description="Búsqueda global de transacciones por pedido, referencia externa, comercio o estado de liquidación.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por # Orden, ID transacción, comercio o cliente..."
            className="input-field"
            style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
          />
        </div>
      </SectionCard>

      <FormStatusBar dirty={false} saving={saving} error={error} successMessage={successMessage} />

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : (
        <SectionCard
          title="Centro financiero"
          description={
            isPlatformScope
              ? 'Desde plataforma se ve el movimiento de cobros completo, refunds, caja y el catalogo de payment_methods que alimenta a los negocios.'
              : 'Desde negocio se ve el movimiento de cobros propio, los refunds y la caja cobrada por reparto.'
          }
        >
          <AdminTabs
            tabs={[
              { id: 'summary', label: 'Dashboard' },
              { id: 'payments', label: 'Cobros', badge: String(overview?.summary.payments ?? 0) },
              { id: 'transactions', label: 'Pasarela', badge: String(overview?.summary.transactions ?? 0) },
              { id: 'refunds', label: 'Refunds', badge: String(overview?.summary.refunds ?? 0) },
              { id: 'cash', label: 'Caja Reg.', badge: String(overview?.summary.cash_collections ?? 0) },
              ...(isPlatformScope ? [{ id: 'methods', label: 'Config Metodos', badge: String(overview?.payment_methods.length ?? 0) }] : []),
            ]}
            activeTabId={activeTab}
            onChange={(tabId) => setActiveTab(tabId as PaymentsTab)}
          />

          {activeTab === 'summary' ? (
            <AdminTabPanel>
              <div className="stat-grid">
                {[
                  { label: 'Volumen Bruto', value: formatMoney(overview?.summary.gross_amount ?? 0), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                  { label: 'Monto Refunds', value: formatMoney(overview?.summary.refunded_amount ?? 0), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 10h10a5 5 0 0 1 5 5v2"/><polyline points="10 3 3 10 10 17"/></svg> },
                  { label: 'Caja Pendiente', value: formatMoney(overview?.summary.pending_cash_amount ?? 0), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg> },
                  { label: 'Cobros Totales', value: String(overview?.summary.payments ?? 0), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.56-6.17H5.91"/></svg> },
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

              <div className="stat-grid" style={{ marginTop: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                 {[
                  { label: 'Transacciones', value: String(overview?.summary.transactions ?? 0) },
                  { label: 'Refunds Solicitados', value: String(overview?.summary.refunds ?? 0) },
                  { label: 'Caja Liquidada', value: formatMoney(overview?.summary.settled_cash_amount ?? 0) },
                  { label: 'Metodos Activos', value: String(overview?.summary.active_methods ?? 0) },
                ].map(sub => (
                  <div key={sub.label} className="stat-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--acme-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sub.label}</div>
                    <div style={{ marginTop: '4px', fontWeight: 800, fontSize: '16px' }}>{sub.value}</div>
                  </div>
                ))}
              </div>
            </AdminTabPanel>
          ) : null}

          {activeTab === 'payments' ? (
            <AdminTabPanel>
              <AdminDataTable
                rows={filteredPayments}
                getRowId={(record) => record.id}
                emptyMessage="No hay cobros registrados."
                columns={[
                  {
                    id: 'payment',
                    header: 'Referencia / Método',
                    render: (record) => (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-bg-soft)', color: 'var(--acme-blue)' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        </div>
                        <div className="module-info">
                          <strong style={{ fontWeight: 800 }}>{record.payment_method_label}</strong>
                          <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.order_code ? `Pedido #${record.order_code}` : 'Recarga/Otros'}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'scope',
                    header: 'Origen',
                    render: (record) => (
                      <div style={{ display: 'grid', gap: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{record.merchant_label}</span>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.branch_label}</span>
                      </div>
                    ),
                  },
                  { 
                    id: 'customer', 
                    header: 'Cliente', 
                    render: (record) => (
                      <span style={{ fontSize: '13px' }}>{record.customer_label || 'Invitado'}</span>
                    ) 
                  },
                  { 
                    id: 'amount', 
                    header: 'Monto', 
                    align: 'right', 
                    render: (record) => (
                      <strong style={{ fontSize: '15px' }}>{formatMoney(record.amount, record.currency)}</strong>
                    ) 
                  },
                  { 
                    id: 'status', 
                    header: 'Estado', 
                    render: (record) => (
                      <StatusPill label={(record.status || 'PENDING').toUpperCase()} tone={getPaymentTone(record.status)} />
                    ) 
                  },
                  { 
                    id: 'date', 
                    header: 'Fecha', 
                    render: (record) => (
                      <span style={{ fontSize: '11px', color: 'var(--acme-text-faint)' }}>{formatDateTime(record.requested_at)}</span>
                    ) 
                  },
                ]}
              />
            </AdminTabPanel>
          ) : null}

          {activeTab === 'transactions' ? (
            <AdminTabPanel>
              <AdminDataTable
                rows={filteredTransactions}
                getRowId={(record) => record.id}
                emptyMessage="No hay transacciones registradas."
                columns={[
                  {
                    id: 'payment',
                    header: 'Pago',
                    render: (record) => (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <strong>{record.payment_label}</strong>
                        <span style={{ color: '#6b7280' }}>{record.merchant_label}</span>
                      </div>
                    ),
                  },
                  { id: 'type', header: 'Tipo', render: (record) => record.transaction_type || 'sin tipo' },
                  { id: 'amount', header: 'Monto', align: 'right', render: (record) => formatMoney(record.amount) },
                  { id: 'status', header: 'Estado', render: (record) => <StatusPill label={record.status || 'pending'} tone={getPaymentTone(record.status)} /> },
                  { id: 'provider', header: 'Provider ref', render: (record) => record.provider_transaction_id || 'Sin referencia' },
                  { id: 'created', header: 'Fecha', render: (record) => formatDateTime(record.created_at) },
                ]}
              />
            </AdminTabPanel>
          ) : null}

          {activeTab === 'refunds' ? (
            <AdminTabPanel>
              <AdminDataTable
                rows={filteredRefunds}
                getRowId={(record) => record.id}
                emptyMessage="No hay refunds registrados."
                columns={[
                  {
                    id: 'payment',
                    header: 'Pago',
                    render: (record) => (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <strong>{record.payment_label}</strong>
                        <span style={{ color: '#6b7280' }}>{record.merchant_label}</span>
                      </div>
                    ),
                  },
                  { id: 'amount', header: 'Monto', align: 'right', render: (record) => formatMoney(record.amount) },
                  { id: 'reason', header: 'Motivo', render: (record) => record.reason || 'Sin motivo' },
                  { id: 'status', header: 'Estado', render: (record) => <StatusPill label={record.status || 'requested'} tone={getPaymentTone(record.status)} /> },
                  { id: 'date', header: 'Solicitado', render: (record) => formatDateTime(record.requested_at) },
                ]}
              />
            </AdminTabPanel>
          ) : null}

          {activeTab === 'cash' ? (
            <AdminTabPanel>
              <AdminDataTable
                rows={filteredCashCollections}
                getRowId={(record) => record.id}
                emptyMessage="No hay movimientos de caja registrados."
                columns={[
                  {
                    id: 'order',
                    header: 'Pedido',
                    render: (record: PlatformCashCollectionRecord) => (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <strong>{record.order_code ? `#${record.order_code}` : 'Sin pedido'}</strong>
                        <span style={{ color: '#6b7280' }}>{record.driver_label || 'Sin repartidor'}</span>
                      </div>
                    ),
                  },
                  {
                    id: 'scope',
                    header: 'Alcance',
                    render: (record: PlatformCashCollectionRecord) => (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <span>{record.merchant_label}</span>
                        <span style={{ color: '#6b7280' }}>{record.branch_label}</span>
                      </div>
                    ),
                  },
                  { id: 'amount', header: 'Monto', align: 'right', render: (record: PlatformCashCollectionRecord) => formatMoney(record.amount_collected) },
                  { id: 'status', header: 'Estado', render: (record: PlatformCashCollectionRecord) => <StatusPill label={record.status || 'pending'} tone={getPaymentTone(record.status)} /> },
                  { id: 'collected', header: 'Cobrado', render: (record: PlatformCashCollectionRecord) => formatDateTime(record.collected_at) },
                  { id: 'settled', header: 'Liquidado', render: (record: PlatformCashCollectionRecord) => (record.settled_at ? formatDateTime(record.settled_at) : 'Pendiente') },
                ]}
              />
            </AdminTabPanel>
          ) : null}

          {activeTab === 'methods' && isPlatformScope ? (
            <AdminTabPanel>
              <AdminDataTable
                rows={filteredMethods}
                getRowId={(record) => record.id}
                emptyMessage="No se encontraron métodos de pago."
                columns={[
                  {
                    id: 'method',
                    header: 'Método / Canal',
                    render: (record) => (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-purple-soft)', color: 'var(--acme-purple)' }}>
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        </div>
                        <div className="module-info">
                          <strong style={{ fontWeight: 800 }}>{record.name}</strong>
                          <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.code}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'flags',
                    header: 'Disponibilidad',
                    render: (record) => (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <StatusPill label={record.is_online ? 'DIGITAL' : 'FÍSICO'} tone={record.is_online ? 'info' : 'neutral'} />
                        <StatusPill label={record.is_active ? 'ACTIVO' : 'INACTIVO'} tone={record.is_active ? 'success' : 'warning'} />
                      </div>
                    ),
                  },
                  {
                    id: 'usage',
                    header: 'Volumen Histórico',
                    render: (record) => (
                      <div style={{ display: 'grid', gap: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{record.payments_count} Cobros</span>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.refunds_count} Devoluciones</span>
                      </div>
                    ),
                  },
                  {
                    id: 'action',
                    header: '',
                    align: 'right',
                    width: '140px',
                    render: (record) => (
                      <button type="button" onClick={() => openMethodModal(record)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                        Configurar
                      </button>
                    ),
                  },
                ]}
              />
            </AdminTabPanel>
          ) : null}
        </SectionCard>
      )}

      <AdminModalForm
        open={methodOpen}
        title={methodForm.id ? 'Configurar Método de Pago' : 'Nuevo Método de Pago'}
        description="Define las reglas de cobro que el sistema presentará a los clientes finales y repartidores."
        onClose={() => setMethodOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setMethodOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleMethodSave} disabled={saving || !methodForm.code.trim() || !methodForm.name.trim()} className="btn btn--primary">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="form-grid">
            <FieldGroup label="Código Identificador" hint="Ej: wallet_plin, cash_delivery">
              <TextField value={methodForm.code} onChange={(event) => setMethodForm((current) => ({ ...current, code: event.target.value }))} placeholder="codigo_metodo" />
            </FieldGroup>
            <FieldGroup label="Nombre Comercial" hint="Nombre visible para el cliente">
              <TextField value={methodForm.name} onChange={(event) => setMethodForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Plin / Yape" />
            </FieldGroup>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setMethodForm(c => ({...c, is_online: !c.is_online}))}>
              <CheckboxField label="Disponible para Pago Online" checked={methodForm.is_online} onChange={() => {}} />
            </div>
            <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setMethodForm(c => ({...c, is_active: !c.is_active}))}>
              <CheckboxField label="Método Habilitado" checked={methodForm.is_active} onChange={() => {}} />
            </div>
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
