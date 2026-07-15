import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckboxField, FieldGroup, NumberField, SelectField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { TableSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminPromotionsService, PromotionAdminRecord, PromotionForm } from '../../../../core/services/adminPromotionsService';
import { PortalContext } from '../../../auth/session/PortalContext';

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

function getPromotionTone(record: PromotionAdminRecord) {
  if (!record.is_active) return 'warning' as const;
  if (record.ends_at) {
    const endDate = new Date(record.ends_at);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      return 'danger' as const;
    }
  }
  return 'success' as const;
}

function getPromotionStatusLabel(record: PromotionAdminRecord) {
  if (!record.is_active) return 'Inactiva';
  if (record.ends_at) {
    const endDate = new Date(record.ends_at);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      return 'Vencida';
    }
  }
  return 'Activa';
}

function getDiscountLabel(record: Pick<PromotionAdminRecord | PromotionForm, 'discount_type' | 'discount_value'>) {
  if (record.discount_type === 'percent') return `${record.discount_value}%`;
  if (record.discount_type === 'free_delivery') return 'Envio gratis';
  return formatMoney(Number(record.discount_value ?? 0));
}

export function PromotionsAdminPage() {
  const navigate = useNavigate();
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<PromotionAdminRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PromotionForm>(adminPromotionsService.createEmptyPromotionForm());

  const loadData = async () => {
    if (!merchantId) return;
    setLoading(true);
    setError(null);
    const result = await adminPromotionsService.fetchPromotions(merchantId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRecords(result.data ?? []);
  };

  useEffect(() => {
    loadData();
  }, [merchantId]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.name, record.promo_type, record.discount_type, record.scope_summary].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [query, records]);

  const summary = useMemo(
    () => ({
      promotions: records.length,
      activePromotions: records.filter((record) => record.is_active).length,
      expiredPromotions: records.filter((record) => getPromotionStatusLabel(record) === 'Vencida').length,
      coupons: records.reduce((sum, record) => sum + record.coupon_count, 0),
      targets: records.reduce((sum, record) => sum + record.target_count, 0),
      redemptions: records.reduce((sum, record) => sum + record.redemption_count, 0),
    }),
    [records]
  );

  const resetCreateForm = () => {
    setCreateForm(adminPromotionsService.createEmptyPromotionForm());
    setCreateOpen(false);
  };

  const handleCreate = async () => {
    if (!merchantId) return;
    setSaving(true);
    setError(null);
    const result = await adminPromotionsService.savePromotion(merchantId, createForm);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    const promotionId = String((result.data as { id?: string } | null)?.id ?? '');
    setSuccessMessage('Promocion creada');
    resetCreateForm();
    await loadData();
    navigate(AppRoutes.portal.admin.promotionDetail.replace(':promotionId', promotionId));
  };

  if (!merchantId) {
    return <div>No hay comercio activo para administrar promociones.</div>;
  }

  return (
    <AdminPageFrame
      title="Promociones"
      description="Campanas, segmentacion y cupones del comercio actual en una sola experiencia comercial."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Promociones' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Promocion', tone: 'info' },
        { label: 'Modo', value: 'Comercial', tone: 'warning' },
      ]}
      actions={
        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null);
            setCreateOpen(true);
          }}
          className="btn btn--primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva promoción
        </button>
      }
    >
      <SectionCard title="Campaña Comercial" description="Resumen consolidado del alcance y efectividad de tus promociones vigentes.">
        <div className="stat-grid">
          {[
            { label: 'Total Campañas', value: String(summary.promotions), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> },
            { label: 'Promos Activas', value: String(summary.activePromotions), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
            { label: 'Vencidas', value: String(summary.expiredPromotions), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
            { label: 'Cupones Emis.', value: String(summary.coupons), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 5v2"/><path d="M15 11v2"/><path d="M15 17v2"/><path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/></svg> },
            { label: 'Targets', value: String(summary.targets), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
            { label: 'Uso Real', value: String(summary.redemptions), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> },
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

      <SectionCard title="Filtrado rápido" description="Busca por nombre, tipo de descuento o alcance para gestionar tus campañas.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <TextField 
            value={query} 
            onChange={(event) => setQuery(event.target.value)} 
            placeholder="Escribe el nombre de la promoción o tipo de descuento..." 
            style={{ paddingLeft: '48px' }}
          />
        </div>
      </SectionCard>

      <SectionCard title="Promociones del comercio" description="Se muestran las promociones segmentadas para el comercio actual.">
        {loading ? (
          <TableSkeleton />
        ) : (
          <AdminDataTable
            rows={filteredRecords}
            getRowId={(record) => record.id}
            emptyMessage="No se encontraron promociones con el filtro aplicado."
            columns={[
              {
                id: 'promotion',
                header: 'Campaña / Tipo',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div className="module-icon-box" style={{ width: '44px', height: '44px', background: 'var(--acme-bg-soft)', color: 'var(--acme-purple)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5v2"/><path d="M15 11v2"/><path d="M15 17v2"/><path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/></svg>
                    </div>
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{record.name || 'Campaña sin nombre'}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {record.promo_type === 'automatic' ? 'Automática' : record.promo_type === 'coupon' ? 'Cupón Requerido' : 'Campaña Especial'}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'discount',
                header: 'Oferta',
                render: (record) => (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <strong style={{ color: 'var(--acme-purple)', fontSize: '16px' }}>{getDiscountLabel(record)}</strong>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>
                      {record.min_order_amount ? `Min. ${formatMoney(record.min_order_amount)}` : 'Sin mínimo'}
                    </span>
                  </div>
                ),
              },
              {
                id: 'scope',
                header: 'Alcance',
                render: (record) => (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{record.scope_summary || 'Global'}</span>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>
                      {record.target_count} locales · {record.coupon_count} cupones
                    </span>
                  </div>
                ),
              },
              {
                id: 'activity',
                header: 'Vigencia y Uso',
                render: (record) => (
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--acme-blue)' }}>{record.redemption_count}</span>
                      <span style={{ fontSize: '11px', color: 'var(--acme-text-faint)' }}>canjes</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--acme-text-faint)', whiteSpace: 'nowrap' }}>
                      {record.ends_at ? `Expira: ${new Date(record.ends_at).toLocaleDateString()}` : 'Sin límite'}
                    </span>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Estado',
                render: (record) => (
                  <StatusPill 
                    label={getPromotionStatusLabel(record).toUpperCase()} 
                    tone={getPromotionTone(record)} 
                  />
                ),
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '140px',
                render: (record) => (
                  <Link 
                    to={AppRoutes.portal.admin.promotionDetail.replace(':promotionId', record.id)} 
                    className="btn btn--sm btn--ghost" 
                    style={{ color: 'var(--acme-purple)', fontWeight: 700 }}
                  >
                    Detalles
                  </Link>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      <FormStatusBar dirty={false} saving={saving} error={error} successMessage={successMessage} />

      <AdminModalForm
        open={createOpen}
        title="Nueva promocion"
        description="Se crea la promocion y se enlaza automaticamente al comercio actual como target raiz."
        onClose={resetCreateForm}
        actions={
          <>
            <button type="button" onClick={resetCreateForm} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !createForm.name}
              className="btn btn--primary"
            >
              {saving ? 'Guardando...' : 'Crear promocion'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="form-grid">
            <FieldGroup label="Nombre de la campaña" hint="Ej: Black Friday 20%, Promo Navidad">
              <TextField value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Escribe el nombre..." />
            </FieldGroup>
            <FieldGroup label="Tipo de promoción">
              <SelectField
                value={createForm.promo_type}
                onChange={(event) => setCreateForm((current) => ({ ...current, promo_type: event.target.value }))}
                options={[
                  { value: 'automatic', label: 'Aplicación Automática' },
                  { value: 'coupon', label: 'Uso de Cupón' },
                  { value: 'campaign', label: 'Campaña Segmentada' },
                ]}
              />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Tipo de beneficio">
              <SelectField
                value={createForm.discount_type}
                onChange={(event) => setCreateForm((current) => ({ ...current, discount_type: event.target.value }))}
                options={[
                  { value: 'percent', label: 'Porcentaje (%)' },
                  { value: 'fixed', label: 'Monto Fijo (S/.)' },
                  { value: 'free_delivery', label: 'Envío Gratis' },
                ]}
              />
            </FieldGroup>
            <FieldGroup label="Valor del beneficio">
              <NumberField value={createForm.discount_value} onChange={(event) => setCreateForm((current) => ({ ...current, discount_value: event.target.value }))} placeholder="0" />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Monto mínimo compra" hint="0 para sin mínimo.">
              <NumberField value={createForm.min_order_amount} onChange={(event) => setCreateForm((current) => ({ ...current, min_order_amount: event.target.value }))} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label="Tope de descuento" hint="Solo para porcentajes.">
              <NumberField value={createForm.max_discount} onChange={(event) => setCreateForm((current) => ({ ...current, max_discount: event.target.value }))} placeholder="Opcional" />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Fecha/Hora Inicio">
              <TextField type="datetime-local" value={createForm.starts_at} onChange={(event) => setCreateForm((current) => ({ ...current, starts_at: event.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Fecha/Hora Fin">
              <TextField type="datetime-local" value={createForm.ends_at} onChange={(event) => setCreateForm((current) => ({ ...current, ends_at: event.target.value }))} />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Límite total usos">
              <NumberField value={createForm.usage_limit_total} onChange={(event) => setCreateForm((current) => ({ ...current, usage_limit_total: event.target.value }))} placeholder="Sin límite" />
            </FieldGroup>
            <FieldGroup label="Límite por cliente">
              <NumberField value={createForm.usage_limit_per_user} onChange={(event) => setCreateForm((current) => ({ ...current, usage_limit_per_user: event.target.value }))} placeholder="1" />
            </FieldGroup>
          </div>

          <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setCreateForm(c => ({...c, is_active: !c.is_active}))}>
            <CheckboxField
              label="Habilitar promoción inmediatamente al crear"
              checked={createForm.is_active}
              onChange={() => {}}
            />
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
