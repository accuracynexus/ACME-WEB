import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckboxField, FieldGroup, NumberField, SelectField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminEntityHeader } from '../../../../components/admin/AdminEntityHeader';
import { AdminInlineRelationTable } from '../../../../components/admin/AdminInlineRelationTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { TextField } from '../../../../components/ui/TextField';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminPromotionsService,
  PromotionAdminDetail,
  PromotionCouponForm,
  PromotionCouponRecord,
  PromotionForm,
  PromotionTargetForm,
  PromotionTargetRecord,
} from '../../../../core/services/adminPromotionsService';
import { PortalContext } from '../../../auth/session/PortalContext';

type PromotionDetailTab = 'summary' | 'targeting' | 'coupons' | 'usage';

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

function toDateTimeInput(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getPromotionTone(detail: PromotionAdminDetail) {
  if (!detail.is_active) return 'warning' as const;
  if (detail.ends_at) {
    const parsed = new Date(detail.ends_at);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
      return 'danger' as const;
    }
  }
  return 'success' as const;
}

function getPromotionStatusLabel(detail: PromotionAdminDetail) {
  if (!detail.is_active) return 'Inactiva';
  if (detail.ends_at) {
    const parsed = new Date(detail.ends_at);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
      return 'Vencida';
    }
  }
  return 'Activa';
}

function getDiscountLabel(discountType: string, discountValue: number) {
  if (discountType === 'percent') return `${discountValue}%`;
  if (discountType === 'free_delivery') return 'Envio gratis';
  return formatMoney(discountValue);
}

function getTargetTypeLabel(targetType: string) {
  if (targetType === 'merchant') return 'Comercio';
  if (targetType === 'branch') return 'Sucursal';
  if (targetType === 'category') return 'Categoria';
  if (targetType === 'product') return 'Producto';
  return targetType || 'Target';
}

function getCouponStatus(record: PromotionCouponRecord) {
  if (!record.is_active) {
    return { label: 'Inactivo', tone: 'warning' as const };
  }
  if (record.ends_at) {
    const parsed = new Date(record.ends_at);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
      return { label: 'Vencido', tone: 'danger' as const };
    }
  }
  return { label: 'Activo', tone: 'success' as const };
}

export function PromotionDetailAdminPage() {
  const navigate = useNavigate();
  const { promotionId } = useParams();
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;

  const [activeTab, setActiveTab] = useState<PromotionDetailTab>('summary');
  const [detail, setDetail] = useState<PromotionAdminDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionForm, setPromotionForm] = useState<PromotionForm>(adminPromotionsService.createEmptyPromotionForm());

  const [targetOpen, setTargetOpen] = useState(false);
  const [targetForm, setTargetForm] = useState<PromotionTargetForm>(adminPromotionsService.createEmptyTargetForm());

  const [couponOpen, setCouponOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<PromotionTargetRecord | null>(null);
  const [couponForm, setCouponForm] = useState<PromotionCouponForm>(adminPromotionsService.createEmptyCouponForm());

  const loadDetail = async () => {
    if (!merchantId || !promotionId) return;
    setLoading(true);
    setError(null);
    const result = await adminPromotionsService.fetchPromotionDetail(merchantId, promotionId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setDetail(result.data ?? null);
  };

  useEffect(() => {
    loadDetail();
  }, [merchantId, promotionId]);

  const targetOptions = useMemo(() => {
    if (!detail || !merchantId) return [{ value: '', label: 'Selecciona un destino' }];
    if (targetForm.target_type === 'merchant') {
      return [{ value: merchantId, label: portal.currentMerchant?.name || portal.merchant?.name || 'Comercio actual' }];
    }
    if (targetForm.target_type === 'branch') {
      return [{ value: '', label: 'Selecciona una sucursal' }, ...detail.branch_options.map((item) => ({ value: item.id, label: item.label }))];
    }
    if (targetForm.target_type === 'category') {
      return [{ value: '', label: 'Selecciona una categoria' }, ...detail.category_options.map((item) => ({ value: item.id, label: item.label }))];
    }
    if (targetForm.target_type === 'product') {
      return [{ value: '', label: 'Selecciona un producto' }, ...detail.product_options.map((item) => ({ value: item.id, label: item.label }))];
    }
    return [{ value: '', label: 'Selecciona un destino' }];
  }, [detail, merchantId, portal.currentMerchant?.name, portal.merchant?.name, targetForm.target_type]);

  const couponSummary = useMemo(
    () => ({
      total: detail?.coupons.length ?? 0,
      active: (detail?.coupons ?? []).filter((coupon) => getCouponStatus(coupon).label === 'Activo').length,
      expired: (detail?.coupons ?? []).filter((coupon) => getCouponStatus(coupon).label === 'Vencido').length,
      redeemed: (detail?.coupons ?? []).filter((coupon) => coupon.redemption_count > 0).length,
    }),
    [detail]
  );

  const usageSummary = useMemo(() => {
    const redemptions = detail?.redemptions ?? [];
    const uniqueCustomers = new Set(redemptions.map((item) => item.customer_id).filter(Boolean));
    const totalDiscount = redemptions.reduce((sum, item) => sum + item.discount_amount, 0);
    const averageDiscount = redemptions.length > 0 ? totalDiscount / redemptions.length : 0;
    return {
      redemptions: redemptions.length,
      customers: uniqueCustomers.size,
      totalDiscount,
      averageDiscount,
      lastRedemption: redemptions[0]?.redeemed_at || '',
    };
  }, [detail]);

  const openPromotionModal = () => {
    if (!detail) return;
    setPromotionForm({
      ...adminPromotionsService.createPromotionForm(detail),
      starts_at: toDateTimeInput(detail.starts_at),
      ends_at: toDateTimeInput(detail.ends_at),
    });
    setPromotionOpen(true);
  };

  const openTargetModal = (record?: PromotionTargetRecord) => {
    if (!record) {
      setTargetForm(adminPromotionsService.createEmptyTargetForm());
      setTargetOpen(true);
      return;
    }
    setTargetForm(adminPromotionsService.createTargetForm(record));
    setTargetOpen(true);
  };

  const openCouponModal = (record?: PromotionCouponRecord) => {
    if (!record) {
      setCouponForm(adminPromotionsService.createEmptyCouponForm());
      setCouponOpen(true);
      return;
    }
    setCouponForm({
      ...adminPromotionsService.createCouponForm(record),
      starts_at: toDateTimeInput(record.starts_at),
      ends_at: toDateTimeInput(record.ends_at),
    });
    setCouponOpen(true);
  };

  const runMutation = async (handler: () => Promise<void>) => {
    try {
      setMutating(true);
      setError(null);
      await handler();
      await loadDetail();
    } catch (mutationError: any) {
      setError(mutationError?.message || 'No se pudo completar la accion');
    } finally {
      setMutating(false);
    }
  };

  const handlePromotionSave = async () => {
    if (!merchantId) return;
    await runMutation(async () => {
      const result = await adminPromotionsService.savePromotion(merchantId, promotionForm);
      if (result.error) throw result.error;
      setPromotionOpen(false);
      setSuccessMessage('Promocion actualizada');
    });
  };

  const handleTargetSave = async () => {
    if (!merchantId || !promotionId) return;
    await runMutation(async () => {
      const result = await adminPromotionsService.savePromotionTarget(merchantId, promotionId, targetForm);
      if (result.error) throw result.error;
      setTargetOpen(false);
      setSuccessMessage(targetForm.id ? 'Target actualizado' : 'Target agregado');
    });
  };

  const handleDeleteTargetRequested = (record: PromotionTargetRecord) => {
    if (record.is_locked) return;
    setTargetToDelete(record);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteTarget = async () => {
    if (!targetToDelete) return;
    setDeleteConfirmOpen(false);
    await runMutation(async () => {
      const result = await adminPromotionsService.deletePromotionTarget(targetToDelete.id);
      if (result.error) throw result.error;
      setSuccessMessage('Target eliminado');
    });
    setTargetToDelete(null);
  };

  const handleCouponSave = async () => {
    if (!promotionId) return;
    await runMutation(async () => {
      const result = await adminPromotionsService.saveCoupon(promotionId, couponForm);
      if (result.error) throw result.error;
      setCouponOpen(false);
      setSuccessMessage(couponForm.id ? 'Cupon actualizado' : 'Cupon agregado');
    });
  };

  if (!merchantId) {
    return <div>No hay comercio activo para administrar promociones.</div>;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !detail) {
    return <ErrorBanner message={error} />;
  }

  if (!detail) {
    return <div>No se encontro la promocion.</div>;
  }

  return (
    <AdminPageFrame
      title="Ficha de promocion"
      description="Centro comercial de la campana con segmentacion, cupones y uso real."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Promociones', to: AppRoutes.portal.admin.promotions },
        { label: detail.name || detail.id },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Promocion', tone: 'info' },
        { label: 'Modo', value: 'Comercial', tone: 'warning' },
        { label: 'Estado', value: getPromotionStatusLabel(detail), tone: getPromotionTone(detail) },
      ]}
    >
      <div>
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      </div>

      <AdminEntityHeader
        title={detail.name || 'Promocion'}
        description={`${detail.promo_type || 'sin tipo'} / ${detail.discount_type || 'sin descuento'} / ${getDiscountLabel(detail.discount_type, detail.discount_value)}`}
        status={{ label: getPromotionStatusLabel(detail), tone: getPromotionTone(detail) }}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={openPromotionModal} className="btn btn--secondary btn--sm">
              Editar promocion
            </button>
            <button type="button" onClick={() => openTargetModal()} className="btn btn--primary btn--sm">
              Agregar target
            </button>
            <button type="button" onClick={() => openCouponModal()} className="btn btn--primary btn--sm">
              Agregar cupon
            </button>
          </div>
        }
      />

      <AdminTabs
        tabs={[
          { id: 'summary', label: 'Resumen' },
          { id: 'targeting', label: 'Segmentacion', badge: String(detail.targets.length) },
          { id: 'coupons', label: 'Cupones', badge: String(detail.coupons.length) },
          { id: 'usage', label: 'Uso', badge: String(detail.redemptions.length) },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as PromotionDetailTab)}
      />

      {activeTab === 'summary' ? (
        <AdminTabPanel>
          <SectionCard title="Resumen comercial" description="Lectura rapida de configuracion, vigencia y limites de la promocion.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Descuento', value: getDiscountLabel(detail.discount_type, detail.discount_value) },
                { label: 'Minimo', value: detail.min_order_amount == null ? 'Sin minimo' : formatMoney(detail.min_order_amount) },
                { label: 'Maximo', value: detail.max_discount == null ? 'Sin tope' : formatMoney(detail.max_discount) },
                { label: 'Limite total', value: detail.usage_limit_total == null ? 'Sin limite' : String(detail.usage_limit_total) },
                { label: 'Limite por usuario', value: detail.usage_limit_per_user == null ? 'Sin limite' : String(detail.usage_limit_per_user) },
                { label: 'Redenciones', value: String(detail.redemptions.length) },
              ].map((item) => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#6b7280', fontSize: '13px' }}>Vigencia</div>
                <strong>{detail.starts_at ? formatDateTime(detail.starts_at) : 'Sin inicio'}</strong>
                <div style={{ color: '#6b7280', marginTop: '6px' }}>{detail.ends_at ? formatDateTime(detail.ends_at) : 'Sin fin'}</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#6b7280', fontSize: '13px' }}>Segmentacion</div>
                <strong>{detail.targets.length} targets</strong>
                <div style={{ color: '#6b7280', marginTop: '6px' }}>{detail.targets.slice(0, 2).map((target) => target.target_label).join(', ') || 'Sin targets'}</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#6b7280', fontSize: '13px' }}>Cupones</div>
                <strong>{detail.coupons.length}</strong>
                <div style={{ color: '#6b7280', marginTop: '6px' }}>{detail.coupons.filter((coupon) => coupon.is_active).length} activos</div>
              </div>
            </div>
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'targeting' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Targets de la promocion"
            description="promotion_targets se administra dentro de la ficha para evitar segmentacion ciega."
            actions={
              <button type="button" onClick={() => openTargetModal()} className="btn btn--secondary btn--sm">
                Agregar target
              </button>
            }
          >
            <AdminDataTable
              rows={detail.targets}
              getRowId={(record) => record.id}
              emptyMessage="No hay targets configurados."
              columns={[
                { id: 'type', header: 'Tipo', render: (record) => getTargetTypeLabel(record.target_type) },
                { id: 'target', header: 'Destino', render: (record) => record.target_label || record.target_id || 'Sin destino' },
                {
                  id: 'state',
                  header: 'Control',
                  render: (record) => (record.is_locked ? <StatusPill label="Target raiz" tone="info" /> : 'Editable'),
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '180px',
                  render: (record) => (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      {!record.is_locked ? (
                        <button type="button" onClick={() => openTargetModal(record)} className="btn btn--ghost btn--sm">
                          Editar
                        </button>
                      ) : null}
                      {!record.is_locked ? (
                        <button type="button" onClick={() => handleDeleteTargetRequested(record)} className="btn btn--ghost btn--sm" style={{ color: 'var(--acme-red)' }}>
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'coupons' ? (
        <AdminTabPanel>
          <SectionCard title="Lectura de cupones" description="Resumen para ver si la campana tiene suficiente inventario, actividad y vencimientos.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Cupones', value: String(couponSummary.total) },
                { label: 'Activos', value: String(couponSummary.active) },
                { label: 'Vencidos', value: String(couponSummary.expired) },
                { label: 'Con uso real', value: String(couponSummary.redeemed) },
              ].map((item) => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>

          <AdminInlineRelationTable
            title="Cupones"
            description="coupons vive dentro de la promocion para mantener consistencia entre campana y codigos."
            actions={
              <button type="button" onClick={() => openCouponModal()} className="btn btn--secondary btn--sm">
                Agregar cupon
              </button>
            }
          >
            <AdminDataTable
              rows={detail.coupons}
              getRowId={(record) => record.id}
              emptyMessage="No hay cupones configurados."
              columns={[
                {
                  id: 'coupon',
                  header: 'Cupon',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.code || 'Sin codigo'}</strong>
                      <span style={{ color: '#6b7280' }}>{record.redemption_count} redenciones</span>
                    </div>
                  ),
                },
                { id: 'window', header: 'Vigencia', render: (record) => `${record.starts_at ? formatDateTime(record.starts_at) : 'Sin inicio'} - ${record.ends_at ? formatDateTime(record.ends_at) : 'Sin fin'}` },
                {
                  id: 'limits',
                  header: 'Limites',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <span>Total: {record.usage_limit_total == null ? 'sin limite' : record.usage_limit_total}</span>
                      <span style={{ color: '#6b7280' }}>Usuario: {record.usage_limit_per_user == null ? 'sin limite' : record.usage_limit_per_user}</span>
                    </div>
                  ),
                },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => <StatusPill label={getCouponStatus(record).label} tone={getCouponStatus(record).tone} />,
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openCouponModal(record)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'usage' ? (
        <AdminTabPanel>
          <SectionCard title="Uso real" description="Lectura comercial de redenciones para validar alcance, adopcion y costo promocional.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Redenciones', value: String(usageSummary.redemptions) },
                { label: 'Clientes unicos', value: String(usageSummary.customers) },
                { label: 'Descuento total', value: formatMoney(usageSummary.totalDiscount) },
                { label: 'Descuento promedio', value: formatMoney(usageSummary.averageDiscount) },
                { label: 'Ultima redencion', value: usageSummary.lastRedemption ? formatDateTime(usageSummary.lastRedemption) : 'Sin uso' },
              ].map((item) => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>

          <AdminInlineRelationTable title="Redenciones" description="coupon_redemptions muestra el uso real de la campana por cliente y pedido.">
            <AdminDataTable
              rows={detail.redemptions}
              getRowId={(record) => record.id}
              emptyMessage="No hay redenciones registradas para esta promocion."
              columns={[
                { id: 'coupon', header: 'Cupon', render: (record) => record.coupon_code || 'Sin cupon' },
                { id: 'customer', header: 'Cliente', render: (record) => record.customer_label || 'Sin cliente' },
                {
                  id: 'order',
                  header: 'Pedido',
                  render: (record) =>
                    record.order_id ? (
                      <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', record.order_id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                        #{record.order_code || record.order_id}
                      </Link>
                    ) : (
                      'Sin pedido'
                    ),
                },
                { id: 'discount', header: 'Descuento', render: (record) => formatMoney(record.discount_amount) },
                { id: 'date', header: 'Fecha', render: (record) => formatDateTime(record.redeemed_at) },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      <FormStatusBar dirty={false} saving={mutating} error={error} successMessage={successMessage} />

      <AdminModalForm
        open={promotionOpen}
        title="Editar promocion"
        description="Actualiza la configuracion base de la campana."
        onClose={() => setPromotionOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setPromotionOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handlePromotionSave} disabled={mutating || !promotionForm.name} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar promocion'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Nombre">
            <TextField value={promotionForm.name} onChange={(event) => setPromotionForm((current) => ({ ...current, name: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Tipo de promo">
            <SelectField
              value={promotionForm.promo_type}
              onChange={(event) => setPromotionForm((current) => ({ ...current, promo_type: event.target.value }))}
              options={[
                { value: 'automatic', label: 'Automatica' },
                { value: 'coupon', label: 'Con cupon' },
                { value: 'campaign', label: 'Campana' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Tipo de descuento">
            <SelectField
              value={promotionForm.discount_type}
              onChange={(event) => setPromotionForm((current) => ({ ...current, discount_type: event.target.value }))}
              options={[
                { value: 'percent', label: 'Porcentaje' },
                { value: 'fixed', label: 'Monto fijo' },
                { value: 'free_delivery', label: 'Envio gratis' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Valor del descuento">
            <NumberField value={promotionForm.discount_value} onChange={(event) => setPromotionForm((current) => ({ ...current, discount_value: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Monto minimo">
            <NumberField value={promotionForm.min_order_amount} onChange={(event) => setPromotionForm((current) => ({ ...current, min_order_amount: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Descuento maximo">
            <NumberField value={promotionForm.max_discount} onChange={(event) => setPromotionForm((current) => ({ ...current, max_discount: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Inicia">
            <TextField type="datetime-local" value={promotionForm.starts_at} onChange={(event) => setPromotionForm((current) => ({ ...current, starts_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Termina">
            <TextField type="datetime-local" value={promotionForm.ends_at} onChange={(event) => setPromotionForm((current) => ({ ...current, ends_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Limite total">
            <NumberField value={promotionForm.usage_limit_total} onChange={(event) => setPromotionForm((current) => ({ ...current, usage_limit_total: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Limite por usuario">
            <NumberField value={promotionForm.usage_limit_per_user} onChange={(event) => setPromotionForm((current) => ({ ...current, usage_limit_per_user: event.target.value }))} />
          </FieldGroup>
        </div>
        <CheckboxField label="Promocion activa" checked={promotionForm.is_active} onChange={(event) => setPromotionForm((current) => ({ ...current, is_active: event.target.checked }))} />
      </AdminModalForm>

      <AdminModalForm
        open={targetOpen}
        title={targetForm.id ? 'Editar target' : 'Agregar target'}
        description="La segmentacion vive dentro de la promocion para que el admin siempre vea alcance y efectos juntos."
        onClose={() => setTargetOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setTargetOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleTargetSave} disabled={mutating || !targetForm.target_type || !(targetForm.target_type === 'merchant' || targetForm.target_id)} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar target'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Tipo">
            <SelectField
              value={targetForm.target_type}
              onChange={(event) =>
                setTargetForm((current) => ({
                  ...current,
                  target_type: event.target.value,
                  target_id: event.target.value === 'merchant' ? merchantId : '',
                }))
              }
              options={[
                { value: 'merchant', label: 'Comercio' },
                { value: 'branch', label: 'Sucursal' },
                { value: 'category', label: 'Categoria' },
                { value: 'product', label: 'Producto' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Destino">
            <SelectField value={targetForm.target_type === 'merchant' ? merchantId : targetForm.target_id} onChange={(event) => setTargetForm((current) => ({ ...current, target_id: event.target.value }))} options={targetOptions} />
          </FieldGroup>
        </div>
      </AdminModalForm>

      <AdminModalForm
        open={couponOpen}
        title={couponForm.id ? 'Editar cupon' : 'Agregar cupon'}
        description="Los cupones viven dentro de la promocion y heredan su estrategia comercial."
        onClose={() => setCouponOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setCouponOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleCouponSave} disabled={mutating || !couponForm.code} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar cupon'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Codigo">
            <TextField value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
          </FieldGroup>
          <FieldGroup label="Inicia">
            <TextField type="datetime-local" value={couponForm.starts_at} onChange={(event) => setCouponForm((current) => ({ ...current, starts_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Termina">
            <TextField type="datetime-local" value={couponForm.ends_at} onChange={(event) => setCouponForm((current) => ({ ...current, ends_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Limite total">
            <NumberField value={couponForm.usage_limit_total} onChange={(event) => setCouponForm((current) => ({ ...current, usage_limit_total: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Limite por usuario">
            <NumberField value={couponForm.usage_limit_per_user} onChange={(event) => setCouponForm((current) => ({ ...current, usage_limit_per_user: event.target.value }))} />
          </FieldGroup>
        </div>
        <CheckboxField label="Cupon activo" checked={couponForm.is_active} onChange={(event) => setCouponForm((current) => ({ ...current, is_active: event.target.checked }))} />
      </AdminModalForm>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="¿Eliminar target?"
        description="Esta acción eliminará la condición de la promoción. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteTarget}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </AdminPageFrame>
  );
}
