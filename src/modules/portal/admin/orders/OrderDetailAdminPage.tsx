import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminActionDialog } from '../../../../components/admin/AdminActionDialog';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminEntityHeader } from '../../../../components/admin/AdminEntityHeader';
import { FieldGroup, NumberField, SelectField, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminInlineRelationTable } from '../../../../components/admin/AdminInlineRelationTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { AdminTimeline } from '../../../../components/admin/AdminTimeline';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { TextField } from '../../../../components/ui/TextField';
import {
  getAdminOrderNextStatuses,
  getAdminOrderStatusLabel,
  getAdminOrderStatusTone,
  normalizeAdminOrderStatus,
} from '../../../../core/admin/utils/orderWorkflow';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminOrdersService,
  OrderAdminAssignment,
  OrderAdminAssignmentForm,
  OrderAdminCancellationForm,
  OrderAdminDetail,
  OrderAdminDeliveryForm,
  OrderAdminEvidenceForm,
  OrderAdminIncident,
  OrderAdminIncidentForm,
  OrderAdminPayment,
  OrderAdminPaymentForm,
  OrderAdminPaymentTransactionForm,
  OrderAdminRefundForm,
  OrderAdminStatusUpdateForm,
} from '../../../../core/services/adminOrdersService';
import { PortalContext } from '../../../auth/session/PortalContext';

type DetailTab = 'summary' | 'items' | 'operations' | 'support' | 'payments';

function normalizeId(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return null;
  }
  return String(value);
}

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
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

function createStatusForm(nextStatus: string): OrderAdminStatusUpdateForm {
  return {
    next_status: nextStatus,
    note: '',
  };
}

export function OrderDetailAdminPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const portal = useContext(PortalContext);
  const branchId = normalizeId(portal.currentBranch?.id);

  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [order, setOrder] = useState<OrderAdminDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusForm, setStatusForm] = useState<OrderAdminStatusUpdateForm>(createStatusForm('confirmed'));

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState<OrderAdminDeliveryForm>(adminOrdersService.createEmptyDeliveryForm());

  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<OrderAdminAssignmentForm>(adminOrdersService.createEmptyAssignmentForm());

  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancellationForm, setCancellationForm] = useState<OrderAdminCancellationForm>(adminOrdersService.createEmptyCancellationForm());

  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState<OrderAdminIncidentForm>(adminOrdersService.createEmptyIncidentForm());

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState<OrderAdminEvidenceForm>(adminOrdersService.createEmptyEvidenceForm());

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<OrderAdminPaymentForm>(adminOrdersService.createEmptyPaymentForm());

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState<OrderAdminPaymentTransactionForm>(adminOrdersService.createEmptyTransactionForm());

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundForm, setRefundForm] = useState<OrderAdminRefundForm>(adminOrdersService.createEmptyRefundForm());

  // silent: refresca los datos sin activar el gate de loading. Ese gate
  // reemplaza el arbol entero por LoadingScreen, asi que tras cada accion
  // se desmontaba FormStatusBar y el toast de exito nunca llegaba a
  // observarse montado. Ademas evita el parpadeo de pagina completa.
  const loadOrder = async (options?: { silent?: boolean }) => {
    if (!branchId || !orderId) return;
    if (!options?.silent) setLoading(true);
    setError(null);
    const result = await adminOrdersService.fetchOrderDetail(orderId, branchId);
    if (!options?.silent) setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setOrder(result.data ?? null);
  };

  useEffect(() => {
    loadOrder();
  }, [branchId, orderId]);

  const nextStatuses = useMemo(() => (order ? getAdminOrderNextStatuses(order.status) : []), [order]);

  const driverOptions = useMemo(
    () => [
      { value: '', label: 'Sin repartidor' },
      ...((order?.available_drivers ?? []).map((driver) => ({
        value: driver.driver_id,
        label: `${driver.label}${driver.vehicle_label ? ` - ${driver.vehicle_label}` : ''}`,
      })) as Array<{ value: string; label: string }>),
    ],
    [order]
  );

  const paymentMethodOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un metodo' },
      ...((order?.payment_methods ?? []).map((method) => ({
        value: method.id,
        label: `${method.name} (${method.code})`,
      })) as Array<{ value: string; label: string }>),
    ],
    [order]
  );

  const paymentOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un pago' },
      ...((order?.payments ?? []).map((payment) => ({
        value: payment.id,
        label: `${payment.payment_method_label} - ${formatMoney(payment.amount, payment.currency)}`,
      })) as Array<{ value: string; label: string }>),
    ],
    [order]
  );

  const openStatusDialog = (nextStatus: string) => {
    setStatusForm(createStatusForm(nextStatus));
    setStatusDialogOpen(true);
  };

  const openDeliveryModal = () => {
    setDeliveryForm(adminOrdersService.createDeliveryForm(order?.delivery_detail ?? null));
    setDeliveryOpen(true);
  };

  const openAssignmentModal = (assignment?: OrderAdminAssignment) => {
    setAssignmentForm(adminOrdersService.createAssignmentForm(assignment ?? null));
    setAssignmentOpen(true);
  };

  const openIncidentModal = (incident?: OrderAdminIncident) => {
    setIncidentForm(adminOrdersService.createIncidentForm(incident ?? null));
    setIncidentOpen(true);
  };

  const openPaymentModal = (payment?: OrderAdminPayment) => {
    setPaymentForm(adminOrdersService.createPaymentForm(payment ?? null, order?.total ?? 0, order?.currency ?? 'PEN'));
    setPaymentOpen(true);
  };

  const runMutation = async (handler: () => Promise<void>) => {
    try {
      setMutating(true);
      setError(null);
      // Se limpia antes de la accion: si vuelve a producir el mismo texto
      // (cancelar dos veces, por ejemplo) sin un cambio de valor el efecto
      // que emite el toast no se volveria a disparar.
      setSuccessMessage(null);
      await handler();
      await loadOrder({ silent: true });
    } catch (mutationError: any) {
      setError(mutationError?.message || 'No se pudo completar la accion');
    } finally {
      setMutating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.updateOrderStatus(orderId, portal.sessionUserId, statusForm);
      if (result.error) throw result.error;
      setStatusDialogOpen(false);
      setSuccessMessage('Estado actualizado');
    });
  };

  const handleDeliverySave = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.upsertOrderDelivery(orderId, deliveryForm);
      if (result.error) throw result.error;
      setDeliveryOpen(false);
      setSuccessMessage('Entrega actualizada');
    });
  };

  const handleAssignmentSave = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.saveAssignment(orderId, assignmentForm);
      if (result.error) throw result.error;
      setAssignmentOpen(false);
      setSuccessMessage('Asignacion guardada');
    });
  };

  const handleCancellation = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.cancelOrder(orderId, portal.sessionUserId, cancellationForm);
      if (result.error) throw result.error;
      setCancellationOpen(false);
      setSuccessMessage('Pedido cancelado');
    });
  };

  const handleIncidentSave = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.saveIncident(orderId, incidentForm);
      if (result.error) throw result.error;
      setIncidentOpen(false);
      setSuccessMessage(incidentForm.id ? 'Incidencia actualizada' : 'Incidencia registrada');
    });
  };

  const handleEvidenceSave = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.saveEvidence(orderId, evidenceForm);
      if (result.error) throw result.error;
      setEvidenceOpen(false);
      setEvidenceForm(adminOrdersService.createEmptyEvidenceForm());
      setSuccessMessage('Evidencia registrada');
    });
  };

  const handlePaymentSave = async () => {
    if (!orderId || !order) return;
    await runMutation(async () => {
      const result = await adminOrdersService.upsertPayment(orderId, order.customer_id, paymentForm);
      if (result.error) throw result.error;
      setPaymentOpen(false);
      setSuccessMessage(paymentForm.id ? 'Pago actualizado' : 'Pago registrado');
    });
  };

  const handleTransactionSave = async () => {
    await runMutation(async () => {
      const result = await adminOrdersService.savePaymentTransaction(transactionForm);
      if (result.error) throw result.error;
      setTransactionOpen(false);
      setTransactionForm(adminOrdersService.createEmptyTransactionForm());
      setSuccessMessage('Transaccion registrada');
    });
  };

  const handleRefundSave = async () => {
    if (!orderId) return;
    await runMutation(async () => {
      const result = await adminOrdersService.saveRefund(orderId, refundForm);
      if (result.error) throw result.error;
      setRefundOpen(false);
      setRefundForm(adminOrdersService.createEmptyRefundForm());
      setSuccessMessage('Refund registrado');
    });
  };

  if (!branchId) {
    return <div>No hay sucursal seleccionada.</div>;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !order) {
    return <ErrorBanner message={error} />;
  }

  if (!order) {
    return <div>No se encontro el pedido.</div>;
  }

  return (
    <AdminPageFrame
      title="Ficha de pedido"
      description="Centro operativo del pedido con lectura y acciones sobre preparacion, entrega, soporte y pago."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Pedidos', to: AppRoutes.portal.admin.orders },
        { label: `#${order.order_code}` },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        {
          label: 'Actor',
          value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }),
          tone: 'info',
        },
        { label: 'Comercio', value: portal.currentMerchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentBranch?.name || 'sin sucursal', tone: 'neutral' },
        { label: 'Entidad', value: 'Pedido', tone: 'info' },
        { label: 'Modo', value: 'Operacion', tone: 'warning' },
        { label: 'Estado', value: getAdminOrderStatusLabel(order.status), tone: getAdminOrderStatusTone(order.status) },
      ]}
    >
      <div>
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      </div>

      <AdminEntityHeader
        title={`Pedido #${order.order_code}`}
        description={`${order.customer_label} / ${formatDateTime(order.placed_at)} / ${order.fulfillment_type || 'sin tipo'}`}
        status={{ label: getAdminOrderStatusLabel(order.status), tone: getAdminOrderStatusTone(order.status) }}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {nextStatuses.map((nextStatus) => (
              <button key={nextStatus} type="button" onClick={() => openStatusDialog(nextStatus)} className="btn btn--secondary btn--sm">
                Marcar {getAdminOrderStatusLabel(nextStatus)}
              </button>
            ))}
            <button type="button" onClick={() => openAssignmentModal()} className="btn btn--secondary btn--sm">
              Asignar reparto
            </button>
            {normalizeAdminOrderStatus(order.status) !== 'cancelled' ? (
              <button type="button" onClick={() => setCancellationOpen(true)} className="btn btn--ghost btn--sm" style={{ color: 'var(--acme-red)' }}>
                Cancelar pedido
              </button>
            ) : null}
          </div>
        }
      />

      <AdminTabs
        tabs={[
          { id: 'summary', label: 'Resumen' },
          { id: 'items', label: 'Items', badge: String(order.items.length) },
          { id: 'operations', label: 'Operacion', badge: String(order.assignments.length) },
          { id: 'support', label: 'Soporte', badge: String(order.incidents.length + order.evidences.length) },
          { id: 'payments', label: 'Pago', badge: String(order.payments.length + order.refunds.length) },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as DetailTab)}
      />

      {activeTab === 'summary' ? (
        <AdminTabPanel>
          <SectionCard title="Resumen comercial" description="Vista rapida para tomar decisiones operativas sin perder contexto del pedido.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {([
                { label: 'Subtotal', value: formatMoney(order.subtotal, order.currency) },
                { label: 'Descuentos', value: formatMoney(order.discount_total + order.coupon_discount_total, order.currency) },
                { label: 'Entrega', value: formatMoney(order.delivery_fee, order.currency) },
                { label: 'Servicio', value: formatMoney(order.service_fee, order.currency) },
                { label: 'Propina', value: formatMoney(order.tip_amount, order.currency) },
                // El total va destacado: es el dato que se busca primero y
                // antes quedaba indistinguible del resto de la fila.
                { label: 'Total', value: formatMoney(order.total, order.currency), emphasis: true },
              ] as Array<{ label: string; value: string; emphasis?: boolean }>).map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: item.emphasis ? 'var(--acme-purple-light)' : 'var(--acme-surface-muted)',
                    border: `1px solid ${item.emphasis ? 'var(--acme-purple)' : 'var(--acme-border)'}`,
                  }}
                >
                  <div
                    style={{
                      color: 'var(--acme-text-muted)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                    }}
                  >
                    {item.label}
                  </div>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: item.emphasis ? '21px' : '17px',
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      // Cifras de ancho fijo: alinea los importes en columna.
                      fontVariantNumeric: 'tabular-nums',
                      color: item.emphasis ? 'var(--acme-purple)' : 'var(--acme-text)',
                    }}
                  >
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Metodo de pago</div>
                <strong>{order.payment_method_label}</strong>
                <div style={{ marginTop: '8px' }}>
                  <StatusPill label={order.payment_status || 'sin estado'} tone={order.payment_status === 'failed' ? 'danger' : 'info'} />
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Reparto actual</div>
                <strong>{order.current_driver_label || 'Sin asignar'}</strong>
                <div style={{ color: 'var(--acme-text-muted)', marginTop: '8px' }}>{order.zone_name || 'Sin zona de entrega'}</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Cupon</div>
                <strong>{order.coupon_code || 'Sin cupon'}</strong>
                <div style={{ color: 'var(--acme-text-muted)', marginTop: '8px' }}>{order.cash_change_for ? `Vuelto para ${order.cash_change_for}` : 'Sin vuelto solicitado'}</div>
              </div>
            </div>
            {order.special_instructions ? (
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Instrucciones</div>
                <strong>{order.special_instructions}</strong>
              </div>
            ) : null}
          </SectionCard>

          <AdminInlineRelationTable
            title="Entrega"
            description="Snapshot editable del pedido para soporte o correcciones operativas."
            actions={
              <button type="button" onClick={openDeliveryModal} className="btn btn--secondary btn--sm">
                {order.delivery_detail ? 'Editar entrega' : 'Completar entrega'}
              </button>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Direccion</div>
                <strong>{order.delivery_detail?.address_snapshot || 'Sin direccion registrada'}</strong>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Destinatario</div>
                <strong>{order.delivery_detail?.recipient_name || order.customer_label}</strong>
                <div style={{ color: 'var(--acme-text-muted)', marginTop: '6px' }}>{order.delivery_detail?.recipient_phone || 'Sin telefono'}</div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Referencia</div>
                <strong>{order.delivery_detail?.reference_snapshot || 'Sin referencia'}</strong>
              </div>
            </div>
          </AdminInlineRelationTable>

          <AdminInlineRelationTable title="Cronologia operativa" description="Timestamps principales del pedido desde que entra hasta que se cierra.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Recibido', value: order.placed_at },
                { label: 'Confirmado', value: order.accepted_at },
                { label: 'Preparando', value: order.preparing_at },
                { label: 'Listo', value: order.ready_at },
                { label: 'Salida', value: order.picked_up_at },
                { label: 'Entregado', value: order.delivered_at },
                { label: 'Cancelado', value: order.cancelled_at },
              ].map((item) => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                  <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>{item.label}</div>
                  <strong>{item.value ? formatDateTime(item.value) : 'Pendiente'}</strong>
                </div>
              ))}
            </div>
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'items' ? (
        <AdminTabPanel>
          <SectionCard title="Items y personalizaciones" description="La vista integra order_items con sus order_item_modifiers sin separar la experiencia.">
            <AdminDataTable
              rows={order.items}
              getRowId={(item) => item.id}
              emptyMessage="No hay items en este pedido."
              columns={[
                {
                  id: 'product',
                  header: 'Producto',
                  render: (item) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{item.product_name_snapshot}</strong>
                      {item.notes ? <span style={{ color: 'var(--acme-text-muted)' }}>Nota: {item.notes}</span> : null}
                    </div>
                  ),
                },
                {
                  id: 'qty',
                  header: 'Cantidad',
                  render: (item) => item.quantity,
                },
                {
                  id: 'unit',
                  header: 'Unitario',
                  render: (item) => formatMoney(item.unit_price, order.currency),
                },
                {
                  id: 'mods',
                  header: 'Modificadores',
                  render: (item) =>
                    item.modifiers.length > 0 ? (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {item.modifiers.map((modifier) => (
                          <span key={modifier.id}>
                            {modifier.option_name_snapshot} x{modifier.quantity} ({formatMoney(modifier.price_delta, order.currency)})
                          </span>
                        ))}
                      </div>
                    ) : (
                      'Sin modificadores'
                    ),
                },
                {
                  id: 'total',
                  header: 'Total',
                  align: 'right',
                  render: (item) => formatMoney(item.line_total, order.currency),
                },
              ]}
            />
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'operations' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Asignaciones de reparto"
            description="Esta tabla concentra order_assignments y el estado operativo de cada intento de reparto."
            actions={
              <button type="button" onClick={() => openAssignmentModal()} className="btn btn--secondary btn--sm">
                Nueva asignacion
              </button>
            }
          >
            <AdminDataTable
              rows={order.assignments}
              getRowId={(assignment) => assignment.id}
              emptyMessage="No hay asignaciones de reparto registradas."
              columns={[
                {
                  id: 'driver',
                  header: 'Repartidor',
                  render: (assignment) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{assignment.driver_label || 'Sin repartidor'}</strong>
                      <span style={{ color: 'var(--acme-text-muted)' }}>
                        {assignment.driver_status || 'sin estado'} {assignment.is_online ? '/ online' : ''}
                      </span>
                    </div>
                  ),
                },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (assignment) => assignment.status || 'sin estado',
                },
                {
                  id: 'timestamps',
                  header: 'Tiempos',
                  render: (assignment) => (
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span>Asignado: {assignment.assigned_at ? formatDateTime(assignment.assigned_at) : 'n/a'}</span>
                      <span>Recojo: {assignment.picked_up_at ? formatDateTime(assignment.picked_up_at) : 'n/a'}</span>
                      <span>Completado: {assignment.completed_at ? formatDateTime(assignment.completed_at) : 'n/a'}</span>
                    </div>
                  ),
                },
                {
                  id: 'reason',
                  header: 'Motivo',
                  render: (assignment) => assignment.reason || 'Sin motivo',
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (assignment) => (
                    <button type="button" onClick={() => openAssignmentModal(assignment)} className="btn btn--ghost btn--sm">
                      Actualizar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable title="Historial de estado" description="Trazabilidad completa registrada en order_status_history.">
            <AdminTimeline
              items={order.history.map((item) => ({
                id: item.id,
                title: `${getAdminOrderStatusLabel(item.from_status || 'placed')} -> ${getAdminOrderStatusLabel(item.to_status)}`,
                subtitle: `${item.actor_user_label} / ${formatDateTime(item.created_at)}`,
                body: item.note || undefined,
                tone: getAdminOrderStatusTone(item.to_status),
              }))}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable title="Cancelaciones" description="Registro de order_cancellations ligado al pedido.">
            <AdminDataTable
              rows={order.cancellations}
              getRowId={(cancellation) => cancellation.id}
              emptyMessage="No hay cancelaciones registradas."
              columns={[
                { id: 'actor', header: 'Actor', render: (cancellation) => cancellation.cancelled_by_label || cancellation.actor_type },
                { id: 'reason', header: 'Motivo', render: (cancellation) => cancellation.reason_text || cancellation.reason_code || 'Sin motivo' },
                { id: 'refund', header: 'Monto', render: (cancellation) => formatMoney(cancellation.refund_amount, order.currency) },
                { id: 'date', header: 'Fecha', render: (cancellation) => formatDateTime(cancellation.created_at) },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'support' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Incidencias"
            description="order_incidents se usa para soporte, disputas y seguimiento postventa."
            actions={
              <button type="button" onClick={() => openIncidentModal()} className="btn btn--secondary btn--sm">
                Registrar incidencia
              </button>
            }
          >
            <AdminDataTable
              rows={order.incidents}
              getRowId={(incident) => incident.id}
              emptyMessage="No hay incidencias registradas."
              columns={[
                {
                  id: 'type',
                  header: 'Tipo',
                  render: (incident) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{incident.incident_type}</strong>
                      <span style={{ color: 'var(--acme-text-muted)' }}>{incident.driver_label || 'Sin repartidor asociado'}</span>
                    </div>
                  ),
                },
                { id: 'description', header: 'Descripcion', render: (incident) => incident.description || 'Sin detalle' },
                { id: 'status', header: 'Estado', render: (incident) => incident.status || 'open' },
                { id: 'date', header: 'Fecha', render: (incident) => formatDateTime(incident.created_at) },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (incident) => (
                    <button type="button" onClick={() => openIncidentModal(incident)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable
            title="Evidencias"
            description="order_evidences se integra como soporte de entrega, reclamos y verificacion."
            actions={
              <button
                type="button"
                onClick={() => {
                  setEvidenceForm(adminOrdersService.createEmptyEvidenceForm());
                  setEvidenceOpen(true);
                }}
                className="btn btn--secondary btn--sm"
              >
                Registrar evidencia
              </button>
            }
          >
            <AdminDataTable
              rows={order.evidences}
              getRowId={(evidence) => evidence.id}
              emptyMessage="No hay evidencias registradas."
              columns={[
                { id: 'type', header: 'Tipo', render: (evidence) => evidence.evidence_type || 'Sin tipo' },
                { id: 'driver', header: 'Repartidor', render: (evidence) => evidence.driver_label || 'Sin repartidor' },
                {
                  id: 'file',
                  header: 'Archivo',
                  render: (evidence) =>
                    evidence.file_url ? (
                      <a href={evidence.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                        Abrir archivo
                      </a>
                    ) : (
                      'Sin archivo'
                    ),
                },
                { id: 'note', header: 'Nota', render: (evidence) => evidence.note || 'Sin nota' },
                { id: 'date', header: 'Fecha', render: (evidence) => formatDateTime(evidence.created_at) },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'payments' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Pagos"
            description="payments concentra intentos o cobros asociados al pedido."
            actions={
              <button type="button" onClick={() => openPaymentModal()} className="btn btn--secondary btn--sm">
                Registrar pago
              </button>
            }
          >
            <AdminDataTable
              rows={order.payments}
              getRowId={(payment) => payment.id}
              emptyMessage="No hay pagos registrados."
              columns={[
                {
                  id: 'method',
                  header: 'Metodo',
                  render: (payment) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{payment.payment_method_label}</strong>
                      <span style={{ color: 'var(--acme-text-muted)' }}>{payment.provider || 'Sin provider'}</span>
                    </div>
                  ),
                },
                { id: 'amount', header: 'Monto', render: (payment) => formatMoney(payment.amount, payment.currency) },
                { id: 'status', header: 'Estado', render: (payment) => payment.status || 'pending' },
                { id: 'date', header: 'Solicitado', render: (payment) => formatDateTime(payment.requested_at) },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (payment) => (
                    <button type="button" onClick={() => openPaymentModal(payment)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable
            title="Transacciones"
            description="payment_transactions queda visible dentro de la misma ficha, no como tabla tecnica separada."
            actions={
              <button
                type="button"
                onClick={() => {
                  setTransactionForm(adminOrdersService.createEmptyTransactionForm());
                  setTransactionOpen(true);
                }}
                className="btn btn--secondary btn--sm"
              >
                Registrar transaccion
              </button>
            }
          >
            <AdminDataTable
              rows={order.payment_transactions}
              getRowId={(transaction) => transaction.id}
              emptyMessage="No hay transacciones registradas."
              columns={[
                { id: 'payment', header: 'Pago', render: (transaction) => transaction.payment_id },
                { id: 'type', header: 'Tipo', render: (transaction) => transaction.transaction_type || 'Sin tipo' },
                { id: 'amount', header: 'Monto', render: (transaction) => formatMoney(transaction.amount, order.currency) },
                { id: 'status', header: 'Estado', render: (transaction) => transaction.status || 'pending' },
                { id: 'date', header: 'Fecha', render: (transaction) => formatDateTime(transaction.created_at) },
              ]}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable
            title="Refunds"
            description="refunds concentra devoluciones parciales o totales ligadas al pedido."
            actions={
              <button
                type="button"
                onClick={() => {
                  setRefundForm(adminOrdersService.createEmptyRefundForm());
                  setRefundOpen(true);
                }}
                className="btn btn--secondary btn--sm"
              >
                Registrar refund
              </button>
            }
          >
            <AdminDataTable
              rows={order.refunds}
              getRowId={(refund) => refund.id}
              emptyMessage="No hay refunds registrados."
              columns={[
                { id: 'payment', header: 'Pago', render: (refund) => refund.payment_label || 'Sin pago' },
                { id: 'amount', header: 'Monto', render: (refund) => formatMoney(refund.amount, order.currency) },
                { id: 'reason', header: 'Motivo', render: (refund) => refund.reason || 'Sin motivo' },
                { id: 'status', header: 'Estado', render: (refund) => refund.status || 'requested' },
                { id: 'date', header: 'Fecha', render: (refund) => formatDateTime(refund.requested_at) },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      <FormStatusBar dirty={false} saving={mutating} error={error} successMessage={successMessage} />

      <AdminActionDialog
        open={statusDialogOpen}
        title={`Marcar pedido como ${getAdminOrderStatusLabel(statusForm.next_status)}`}
        description="La accion actualiza orders y agrega una entrada en order_status_history."
        confirmLabel="Confirmar estado"
        isLoading={mutating}
        onConfirm={handleStatusUpdate}
        onClose={() => setStatusDialogOpen(false)}
      >
        <FieldGroup label="Nota operativa">
          <TextAreaField value={statusForm.note} onChange={(event) => setStatusForm((current) => ({ ...current, note: event.target.value }))} />
        </FieldGroup>
      </AdminActionDialog>

      <AdminModalForm
        open={deliveryOpen}
        title="Entrega del pedido"
        description="Actualiza order_delivery_details para mantener el snapshot operativo consistente."
        onClose={() => setDeliveryOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setDeliveryOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleDeliverySave} disabled={mutating} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar entrega'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Direccion">
            <TextField value={deliveryForm.address_snapshot} onChange={(event) => setDeliveryForm((current) => ({ ...current, address_snapshot: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Referencia">
            <TextField value={deliveryForm.reference_snapshot} onChange={(event) => setDeliveryForm((current) => ({ ...current, reference_snapshot: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Distrito">
            <TextField value={deliveryForm.district_snapshot} onChange={(event) => setDeliveryForm((current) => ({ ...current, district_snapshot: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Ciudad">
            <TextField value={deliveryForm.city_snapshot} onChange={(event) => setDeliveryForm((current) => ({ ...current, city_snapshot: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Region">
            <TextField value={deliveryForm.region_snapshot} onChange={(event) => setDeliveryForm((current) => ({ ...current, region_snapshot: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Destinatario">
            <TextField value={deliveryForm.recipient_name} onChange={(event) => setDeliveryForm((current) => ({ ...current, recipient_name: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Telefono">
            <TextField value={deliveryForm.recipient_phone} onChange={(event) => setDeliveryForm((current) => ({ ...current, recipient_phone: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Latitud">
            <NumberField value={deliveryForm.lat} onChange={(event) => setDeliveryForm((current) => ({ ...current, lat: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Longitud">
            <NumberField value={deliveryForm.lng} onChange={(event) => setDeliveryForm((current) => ({ ...current, lng: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Distancia estimada (km)">
            <NumberField value={deliveryForm.estimated_distance_km} onChange={(event) => setDeliveryForm((current) => ({ ...current, estimated_distance_km: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Tiempo estimado (min)">
            <NumberField value={deliveryForm.estimated_time_min} onChange={(event) => setDeliveryForm((current) => ({ ...current, estimated_time_min: event.target.value }))} />
          </FieldGroup>
        </div>
      </AdminModalForm>

      <AdminModalForm
        open={assignmentOpen}
        title={assignmentForm.id ? 'Actualizar asignacion' : 'Nueva asignacion'}
        description="Gestiona order_assignments y sincroniza el current_driver_id del pedido."
        onClose={() => setAssignmentOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setAssignmentOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleAssignmentSave} disabled={mutating || !assignmentForm.driver_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar asignacion'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Repartidor">
            <SelectField value={assignmentForm.driver_id} onChange={(event) => setAssignmentForm((current) => ({ ...current, driver_id: event.target.value }))} options={driverOptions} />
          </FieldGroup>
          <FieldGroup label="Estado de asignacion">
            <SelectField
              value={assignmentForm.status}
              onChange={(event) => setAssignmentForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'assigned', label: 'Asignado' },
                { value: 'accepted', label: 'Aceptado' },
                { value: 'picked_up', label: 'Recogido' },
                { value: 'completed', label: 'Completado' },
                { value: 'rejected', label: 'Rechazado' },
              ]}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Motivo o nota">
          <TextAreaField value={assignmentForm.reason} onChange={(event) => setAssignmentForm((current) => ({ ...current, reason: event.target.value }))} />
        </FieldGroup>
        {order.available_drivers.length === 0 ? (
          <div style={{ color: 'var(--acme-text-muted)' }}>No hay repartidores creados en la base por ahora, pero la ficha ya queda lista para cuando existan.</div>
        ) : null}
      </AdminModalForm>

      <AdminActionDialog
        open={cancellationOpen}
        title="Cancelar pedido"
        description="Esta accion actualiza orders, registra order_cancellations y agrega el evento en order_status_history."
        confirmLabel="Cancelar pedido"
        isLoading={mutating}
        onConfirm={handleCancellation}
        onClose={() => setCancellationOpen(false)}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Codigo de motivo">
            <SelectField
              value={cancellationForm.reason_code}
              onChange={(event) => setCancellationForm((current) => ({ ...current, reason_code: event.target.value }))}
              options={[
                { value: 'customer_request', label: 'Solicitud del cliente' },
                { value: 'store_issue', label: 'Problema del comercio' },
                { value: 'logistics_issue', label: 'Problema logistico' },
                { value: 'payment_issue', label: 'Problema de pago' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Monto a devolver">
            <NumberField value={cancellationForm.refund_amount} onChange={(event) => setCancellationForm((current) => ({ ...current, refund_amount: event.target.value }))} />
          </FieldGroup>
        </div>
        <FieldGroup label="Motivo detallado">
          <TextAreaField value={cancellationForm.reason_text} onChange={(event) => setCancellationForm((current) => ({ ...current, reason_text: event.target.value }))} />
        </FieldGroup>
      </AdminActionDialog>

      <AdminModalForm
        open={incidentOpen}
        title={incidentForm.id ? 'Actualizar incidencia' : 'Registrar incidencia'}
        description="La incidencia se guarda en order_incidents dentro de la ficha del pedido."
        onClose={() => setIncidentOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setIncidentOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleIncidentSave} disabled={mutating || !incidentForm.incident_type} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar incidencia'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Repartidor">
            <SelectField value={incidentForm.driver_id} onChange={(event) => setIncidentForm((current) => ({ ...current, driver_id: event.target.value }))} options={driverOptions} />
          </FieldGroup>
          <FieldGroup label="Tipo">
            <SelectField
              value={incidentForm.incident_type}
              onChange={(event) => setIncidentForm((current) => ({ ...current, incident_type: event.target.value }))}
              options={[
                { value: 'customer_issue', label: 'Cliente' },
                { value: 'delivery_issue', label: 'Entrega' },
                { value: 'product_issue', label: 'Producto' },
                { value: 'payment_issue', label: 'Pago' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={incidentForm.status}
              onChange={(event) => setIncidentForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'open', label: 'Abierta' },
                { value: 'in_review', label: 'En revision' },
                { value: 'resolved', label: 'Resuelta' },
              ]}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Descripcion">
          <TextAreaField value={incidentForm.description} onChange={(event) => setIncidentForm((current) => ({ ...current, description: event.target.value }))} />
        </FieldGroup>
      </AdminModalForm>

      <AdminModalForm
        open={evidenceOpen}
        title="Registrar evidencia"
        description="La evidencia queda asociada al pedido para respaldo de soporte o entrega."
        onClose={() => setEvidenceOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setEvidenceOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleEvidenceSave} disabled={mutating || !evidenceForm.evidence_type} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar evidencia'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Repartidor">
            <SelectField value={evidenceForm.driver_id} onChange={(event) => setEvidenceForm((current) => ({ ...current, driver_id: event.target.value }))} options={driverOptions} />
          </FieldGroup>
          <FieldGroup label="Tipo">
            <SelectField
              value={evidenceForm.evidence_type}
              onChange={(event) => setEvidenceForm((current) => ({ ...current, evidence_type: event.target.value }))}
              options={[
                { value: 'delivery_proof', label: 'Prueba de entrega' },
                { value: 'incident_photo', label: 'Foto de incidencia' },
                { value: 'chat_capture', label: 'Captura' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="URL del archivo">
            <TextField value={evidenceForm.file_url} onChange={(event) => setEvidenceForm((current) => ({ ...current, file_url: event.target.value }))} />
          </FieldGroup>
        </div>
        <FieldGroup label="Nota">
          <TextAreaField value={evidenceForm.note} onChange={(event) => setEvidenceForm((current) => ({ ...current, note: event.target.value }))} />
        </FieldGroup>
      </AdminModalForm>

      <AdminModalForm
        open={paymentOpen}
        title={paymentForm.id ? 'Editar pago' : 'Registrar pago'}
        description="La ficha usa payments como detalle integrado del pedido, no como modulo separado."
        onClose={() => setPaymentOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setPaymentOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handlePaymentSave} disabled={mutating || !paymentForm.payment_method_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar pago'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Metodo de pago">
            <SelectField value={paymentForm.payment_method_id} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method_id: event.target.value }))} options={paymentMethodOptions} />
          </FieldGroup>
          <FieldGroup label="Monto">
            <NumberField value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Moneda">
            <TextField value={paymentForm.currency} onChange={(event) => setPaymentForm((current) => ({ ...current, currency: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={paymentForm.status}
              onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'authorized', label: 'Autorizado' },
                { value: 'captured', label: 'Capturado' },
                { value: 'failed', label: 'Fallido' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Provider">
            <TextField value={paymentForm.provider} onChange={(event) => setPaymentForm((current) => ({ ...current, provider: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Referencia externa">
            <TextField value={paymentForm.external_reference} onChange={(event) => setPaymentForm((current) => ({ ...current, external_reference: event.target.value }))} />
          </FieldGroup>
        </div>
      </AdminModalForm>

      <AdminModalForm
        open={transactionOpen}
        title="Registrar transaccion"
        description="Usa payment_transactions para reflejar cobros, autorizaciones o respuestas manuales del gateway."
        onClose={() => setTransactionOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setTransactionOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleTransactionSave} disabled={mutating || !transactionForm.payment_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar transaccion'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Pago asociado">
            <SelectField value={transactionForm.payment_id} onChange={(event) => setTransactionForm((current) => ({ ...current, payment_id: event.target.value }))} options={paymentOptions} />
          </FieldGroup>
          <FieldGroup label="Tipo">
            <SelectField
              value={transactionForm.transaction_type}
              onChange={(event) => setTransactionForm((current) => ({ ...current, transaction_type: event.target.value }))}
              options={[
                { value: 'authorize', label: 'Authorize' },
                { value: 'capture', label: 'Capture' },
                { value: 'void', label: 'Void' },
                { value: 'refund', label: 'Refund' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Monto">
            <NumberField value={transactionForm.amount} onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={transactionForm.status}
              onChange={(event) => setTransactionForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'success', label: 'Exitosa' },
                { value: 'failed', label: 'Fallida' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Referencia del provider">
            <TextField value={transactionForm.provider_transaction_id} onChange={(event) => setTransactionForm((current) => ({ ...current, provider_transaction_id: event.target.value }))} />
          </FieldGroup>
        </div>
        <FieldGroup label="Request JSON">
          <TextAreaField value={transactionForm.request_json} onChange={(event) => setTransactionForm((current) => ({ ...current, request_json: event.target.value }))} />
        </FieldGroup>
        <FieldGroup label="Response JSON">
          <TextAreaField value={transactionForm.response_json} onChange={(event) => setTransactionForm((current) => ({ ...current, response_json: event.target.value }))} />
        </FieldGroup>
      </AdminModalForm>

      <AdminModalForm
        open={refundOpen}
        title="Registrar refund"
        description="La devolucion queda visible dentro del mismo pedido y ligada al pago correspondiente."
        onClose={() => setRefundOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setRefundOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleRefundSave} disabled={mutating || !refundForm.amount} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar refund'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Pago asociado">
            <SelectField value={refundForm.payment_id} onChange={(event) => setRefundForm((current) => ({ ...current, payment_id: event.target.value }))} options={paymentOptions} />
          </FieldGroup>
          <FieldGroup label="Monto">
            <NumberField value={refundForm.amount} onChange={(event) => setRefundForm((current) => ({ ...current, amount: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={refundForm.status}
              onChange={(event) => setRefundForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'requested', label: 'Solicitado' },
                { value: 'processed', label: 'Procesado' },
                { value: 'rejected', label: 'Rechazado' },
              ]}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Motivo">
          <TextAreaField value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} />
        </FieldGroup>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
