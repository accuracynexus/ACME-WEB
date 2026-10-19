import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminActionDialog } from '../../../../components/admin/AdminActionDialog';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
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
  canBusinessAssignDriver,
  canBusinessCancelOrder,
  getAdminOrderNextStatuses,
  getAdminOrderStatusLabel,
  getAdminOrderStatusTone,
  isOrderAwaitingPayment,
  normalizeAdminOrderStatus,
} from '../../../../core/admin/utils/orderWorkflow';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminOrdersService,
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
import { useOrdersLiveRefresh } from '../../orders/useOrdersLiveRefresh';

type DetailTab = 'summary' | 'operations' | 'support' | 'payments';

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

/* ——— Piezas de presentacion ———————————————————————————
   La ficha se lee de arriba abajo en el orden en que se atiende un pedido:
   que hay que hacer ahora, en que punto va, que se prepara, a quien se
   entrega y cuanto se cobra. Lo tecnico (pagos, soporte, historial) queda
   en las pestanas. */

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_COLORS: Record<Tone, { accent: string; soft: string }> = {
  neutral: { accent: 'var(--acme-text-muted)', soft: 'var(--acme-surface-muted)' },
  info: { accent: 'var(--acme-purple)', soft: 'var(--acme-purple-light)' },
  success: { accent: 'var(--acme-green)', soft: 'var(--acme-green-light)' },
  warning: { accent: 'var(--acme-orange)', soft: 'var(--acme-orange-light)' },
  danger: { accent: 'var(--acme-red)', soft: 'var(--acme-red-light)' },
};

const PAYMENT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'Pagado', tone: 'success' },
  captured: { label: 'Pagado', tone: 'success' },
  authorized: { label: 'Autorizado', tone: 'info' },
  pending: { label: 'Pago pendiente', tone: 'warning' },
  failed: { label: 'Pago fallido', tone: 'danger' },
  refunded: { label: 'Devuelto', tone: 'neutral' },
  cancelled: { label: 'Pago anulado', tone: 'neutral' },
};

function getPaymentStatusMeta(status: string) {
  const key = String(status || '').trim().toLowerCase();
  return PAYMENT_STATUS_META[key] ?? { label: key || 'Sin estado', tone: 'neutral' as Tone };
}

const FULFILLMENT_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  pickup: 'Recojo en tienda',
  dine_in: 'Consumo en local',
};

function getFulfillmentLabel(type: string) {
  return FULFILLMENT_LABELS[String(type || '').toLowerCase()] || type || 'Sin tipo';
}

// Indice del paso actual en la barra de progreso, segun el estado del pedido.
function getProgressIndex(status: string) {
  const normalized = normalizeAdminOrderStatus(status);
  if (normalized === 'delivered') return 3;
  if (normalized === 'picked_up' || normalized === 'on_the_way') return 2;
  if (normalized === 'ready_for_pickup' || normalized === 'assigned' || normalized === 'driver_accepted') return 1;
  return 0;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        color: 'var(--acme-text-muted)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function OrderProgress({ order }: { order: OrderAdminDetail }) {
  const cancelled = normalizeAdminOrderStatus(order.status) === 'cancelled' || normalizeAdminOrderStatus(order.status) === 'failed';
  const current = getProgressIndex(order.status);
  const steps = [
    { label: 'Recibido', at: order.placed_at },
    { label: 'Listo', at: order.ready_at },
    { label: order.fulfillment_type === 'pickup' ? 'Recogido' : 'En camino', at: order.picked_up_at },
    { label: 'Entregado', at: order.delivered_at },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: '6px' }}>
      {steps.map((step, index) => {
        const done = !cancelled && index <= current;
        const active = !cancelled && index === current;
        const accent = done ? 'var(--acme-purple)' : 'var(--acme-border)';
        return (
          <div key={step.label} style={{ display: 'grid', gap: '8px', alignContent: 'start' }}>
            <div
              style={{
                height: '6px',
                borderRadius: '999px',
                background: accent,
                opacity: done && !active ? 0.45 : 1,
              }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: active ? 800 : 600,
                color: done ? 'var(--acme-text)' : 'var(--acme-text-faint)',
              }}
            >
              {step.label}
            </span>
            {step.at && !cancelled ? (
              <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>{formatDateTime(step.at)}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function NextStepCard({
  tone,
  title,
  body,
  progress,
  actions,
}: {
  tone: Tone;
  title: string;
  body: ReactNode;
  progress: ReactNode;
  actions?: ReactNode;
}) {
  const colors = TONE_COLORS[tone];
  return (
    <section
      style={{
        display: 'grid',
        gap: '18px',
        padding: '20px 22px',
        borderRadius: 'var(--acme-radius-lg)',
        background: 'var(--acme-surface)',
        border: '1px solid var(--acme-border)',
        borderLeft: `5px solid ${colors.accent}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: '4px', flex: '1 1 280px' }}>
          <SectionLabel>Que sigue</SectionLabel>
          <strong style={{ fontSize: '18px', color: 'var(--acme-text)' }}>{title}</strong>
          <span style={{ color: 'var(--acme-text-muted)', fontSize: '14px', lineHeight: 1.45 }}>{body}</span>
        </div>
        {actions ? <div className="btn-group" style={{ justifyContent: 'flex-end' }}>{actions}</div> : null}
      </div>
      {progress}
    </section>
  );
}

function ReceiptRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: strong ? '18px' : '14px',
        fontWeight: strong ? 800 : 500,
        color: muted ? 'var(--acme-text-muted)' : 'var(--acme-text)',
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: strong ? 'var(--acme-purple)' : undefined }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '3px' }}>
      <SectionLabel>{label}</SectionLabel>
      <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--acme-text)', overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

function EmptyValue({ children }: { children: ReactNode }) {
  return <span style={{ fontWeight: 500, color: 'var(--acme-text-faint)' }}>{children}</span>;
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

  // La ficha se actualiza sola cuando el pedido cambia (pago, repartidor, entrega).
  useOrdersLiveRefresh(() => loadOrder({ silent: true }), Boolean(branchId && orderId), `admin-order-${orderId}`);

  const nextStatuses = useMemo(() => (order ? getAdminOrderNextStatuses(order.status, order.payment_status) : []), [order]);
  const awaitingPayment = order ? isOrderAwaitingPayment(order.status, order.payment_status) : false;
  const isPlatformAdmin = portal.permissions.canAccessPlatform;
  // Asignar repartidor es tarea del administrador general; la tienda solo
  // marca listo y el despacho automatico ofrece el pedido.
  const canAssignDriver = order && isPlatformAdmin ? canBusinessAssignDriver(order.status, order.payment_status) : false;
  const canCancel = order ? canBusinessCancelOrder(order.status) : false;

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

  const openAssignmentModal = () => {
    setAssignmentForm({ ...adminOrdersService.createEmptyAssignmentForm(), driver_id: order?.current_driver_id ?? '' });
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
      setSuccessMessage('Devolucion registrada');
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

  const normalizedStatus = normalizeAdminOrderStatus(order.status);
  const statusLabel = getAdminOrderStatusLabel(order.status, order.payment_status);
  const statusTone = getAdminOrderStatusTone(order.status, order.payment_status);
  const paymentMeta = getPaymentStatusMeta(order.payment_status);
  const latestCancellation = order.cancellations[0];
  const discounts = order.discount_total + order.coupon_discount_total;

  // Una sola frase que dice que hacer con el pedido ahora mismo.
  const nextStep: { tone: Tone; title: string; body: string } = (() => {
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'failed') {
      return {
        tone: 'danger',
        title: normalizedStatus === 'failed' ? 'El pedido no se completo' : 'Pedido cancelado',
        body: latestCancellation?.reason_text || latestCancellation?.reason_code || 'No hay nada mas que hacer con este pedido.',
      };
    }
    if (awaitingPayment) {
      return {
        tone: 'warning',
        title: 'Esperando el pago del cliente',
        body: 'Todavia no prepares nada: el pedido entra a cocina cuando el pago figure como pagado.',
      };
    }
    if (nextStatuses.length > 0) {
      return {
        tone: 'info',
        title: 'Prepara el pedido',
        body: 'Cuando este empacado, marcalo como listo para que el repartidor lo recoja.',
      };
    }
    if (normalizedStatus === 'ready_for_pickup') {
      return order.current_driver_label
        ? { tone: 'success', title: 'Listo, esperando al repartidor', body: `${order.current_driver_label} recogera el pedido.` }
        : {
            tone: 'warning',
            title: 'Listo, buscando repartidor',
            body: canAssignDriver
              ? 'El sistema lo ofrece a los repartidores cercanos. Si tarda, asigna uno a mano.'
              : 'El sistema lo esta ofreciendo a los repartidores cercanos. No hace falta hacer nada.',
          };
    }
    if (normalizedStatus === 'assigned' || normalizedStatus === 'driver_accepted') {
      return {
        tone: 'info',
        title: 'El repartidor va al local',
        body: `${order.current_driver_label || 'El repartidor'} esta en camino a recoger el pedido.`,
      };
    }
    if (normalizedStatus === 'picked_up' || normalizedStatus === 'on_the_way') {
      return { tone: 'info', title: 'En camino al cliente', body: 'El repartidor ya tiene el pedido. No hace falta hacer nada.' };
    }
    if (normalizedStatus === 'delivered') {
      return { tone: 'success', title: 'Pedido entregado', body: order.delivered_at ? `Entregado el ${formatDateTime(order.delivered_at)}.` : 'El pedido se entrego.' };
    }
    return { tone: 'neutral', title: statusLabel, body: 'Revisa el historial para ver el detalle.' };
  })();

  return (
    <AdminPageFrame
      title={`Pedido #${order.order_code}`}
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Pedidos', to: AppRoutes.portal.admin.orders },
        { label: `#${order.order_code}` },
      ]}
      contextItems={[]}
      actions={
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      }
    >
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '-10px' }}>
        <StatusPill label={statusLabel} tone={statusTone} />
        <span style={{ color: 'var(--acme-text-muted)', fontSize: '14px' }}>
          {getFulfillmentLabel(order.fulfillment_type)} · {formatDateTime(order.placed_at)} · {order.customer_label}
        </span>
      </div>

      <NextStepCard
        tone={nextStep.tone}
        title={nextStep.title}
        body={nextStep.body}
        progress={<OrderProgress order={order} />}
        actions={
          nextStatuses.length > 0 || canAssignDriver || canCancel ? (
            <>
              {canCancel ? (
                <button type="button" onClick={() => setCancellationOpen(true)} className="btn btn--ghost btn--sm" style={{ color: 'var(--acme-red)' }}>
                  Cancelar pedido
                </button>
              ) : null}
              {canAssignDriver ? (
                <button
                  type="button"
                  onClick={() => openAssignmentModal()}
                  className={`btn ${nextStatuses.length === 0 && !order.current_driver_label ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                >
                  {order.current_driver_label ? 'Cambiar repartidor' : 'Asignar repartidor'}
                </button>
              ) : null}
              {nextStatuses.map((nextStatus) => (
                <button key={nextStatus} type="button" onClick={() => openStatusDialog(nextStatus)} className="btn btn--primary btn--sm">
                  Marcar como {getAdminOrderStatusLabel(nextStatus).toLowerCase()}
                </button>
              ))}
            </>
          ) : null
        }
      />

      <AdminTabs
        tabs={[
          { id: 'summary', label: 'Pedido' },
          { id: 'operations', label: 'Reparto e historial', badge: order.assignments.length ? String(order.assignments.length) : undefined },
          // Los pagos muestran lo que pago el cliente, delivery incluido: solo para el admin.
          ...(isPlatformAdmin
            ? [{ id: 'payments', label: 'Pagos', badge: order.payments.length + order.refunds.length ? String(order.payments.length + order.refunds.length) : undefined }]
            : []),
          { id: 'support', label: 'Soporte', badge: order.incidents.length + order.evidences.length ? String(order.incidents.length + order.evidences.length) : undefined },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as DetailTab)}
      />

      {activeTab === 'summary' ? (
        <AdminTabPanel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px', alignItems: 'start' }}>
            <SectionCard
              title="Que se prepara"
              description={`${order.items.reduce((sum, item) => sum + item.quantity, 0)} productos`}
            >
              {order.special_instructions ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--acme-orange-light)',
                    color: 'var(--acme-text)',
                    fontSize: '14px',
                  }}
                >
                  <strong>Nota del cliente:</strong> {order.special_instructions}
                </div>
              ) : null}
              {order.items.length === 0 ? (
                <EmptyValue>Este pedido no tiene productos.</EmptyValue>
              ) : (
                <div style={{ display: 'grid' }}>
                  {order.items.map((item, index) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: '12px',
                        alignItems: 'start',
                        padding: '12px 0',
                        borderTop: index === 0 ? 'none' : '1px solid var(--acme-border)',
                      }}
                    >
                      <span
                        style={{
                          minWidth: '34px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: 'var(--acme-purple-light)',
                          color: 'var(--acme-purple)',
                          fontWeight: 800,
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.quantity}×
                      </span>
                      <div style={{ display: 'grid', gap: '3px' }}>
                        <strong style={{ fontSize: '15px' }}>{item.product_name_snapshot}</strong>
                        {item.modifiers.map((modifier) => (
                          <span key={modifier.id} style={{ fontSize: '13px', color: 'var(--acme-text-muted)' }}>
                            + {modifier.option_name_snapshot}
                            {modifier.quantity > 1 ? ` x${modifier.quantity}` : ''}
                          </span>
                        ))}
                        {item.notes ? (
                          <span style={{ fontSize: '13px', color: 'var(--acme-orange)', fontWeight: 600 }}>Nota: {item.notes}</span>
                        ) : null}
                      </div>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(item.line_total, order.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div style={{ display: 'grid', gap: '20px' }}>
              <SectionCard
                title={order.fulfillment_type === 'pickup' ? 'Cliente' : 'Cliente y entrega'}
                actions={
                  <button type="button" onClick={openDeliveryModal} className="btn btn--ghost btn--sm">
                    Editar
                  </button>
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <InfoRow label="Recibe">{order.delivery_detail?.recipient_name || order.customer_label}</InfoRow>
                  <InfoRow label="Telefono">
                    {order.delivery_detail?.recipient_phone ? (
                      <a href={`tel:${order.delivery_detail.recipient_phone}`} style={{ color: 'var(--acme-purple)' }}>
                        {order.delivery_detail.recipient_phone}
                      </a>
                    ) : (
                      <EmptyValue>Sin telefono</EmptyValue>
                    )}
                  </InfoRow>
                  {order.fulfillment_type !== 'pickup' ? (
                    <>
                      <InfoRow label="Direccion">
                        {order.delivery_detail?.address_snapshot || <EmptyValue>Sin direccion</EmptyValue>}
                      </InfoRow>
                      <InfoRow label="Referencia">
                        {order.delivery_detail?.reference_snapshot || <EmptyValue>Sin referencia</EmptyValue>}
                      </InfoRow>
                      <InfoRow label="Repartidor">
                        {order.current_driver_label || <EmptyValue>Sin asignar</EmptyValue>}
                      </InfoRow>
                      <InfoRow label="Zona">{order.zone_name || <EmptyValue>Sin zona</EmptyValue>}</InfoRow>
                    </>
                  ) : null}
                </div>
              </SectionCard>

              {/* La tienda ve solo el monto de sus productos: delivery, servicio,
                  propina y el total que paga el cliente son de ACME. */}
              {!isPlatformAdmin ? (
                <SectionCard title="Tus productos">
                  <ReceiptRow label="Total de tus productos" value={formatMoney(order.subtotal, order.currency)} strong />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'var(--acme-text-muted)' }}>{order.payment_method_label || 'Sin metodo de pago'}</span>
                    <StatusPill label={paymentMeta.label} tone={paymentMeta.tone} />
                  </div>
                </SectionCard>
              ) : (
              <SectionCard title="Cobro">
                <div style={{ display: 'grid', gap: '8px' }}>
                  <ReceiptRow label="Productos" value={formatMoney(order.subtotal, order.currency)} />
                  {discounts > 0 ? (
                    <ReceiptRow
                      label={order.coupon_code ? `Descuento (${order.coupon_code})` : 'Descuento'}
                      value={`- ${formatMoney(discounts, order.currency)}`}
                      muted
                    />
                  ) : null}
                  {order.delivery_fee > 0 ? <ReceiptRow label="Delivery" value={formatMoney(order.delivery_fee, order.currency)} muted /> : null}
                  {order.service_fee > 0 ? <ReceiptRow label="Servicio" value={formatMoney(order.service_fee, order.currency)} muted /> : null}
                  {order.tax_amount > 0 ? <ReceiptRow label="Impuestos" value={formatMoney(order.tax_amount, order.currency)} muted /> : null}
                  {order.tip_amount > 0 ? <ReceiptRow label="Propina" value={formatMoney(order.tip_amount, order.currency)} muted /> : null}
                  <div style={{ height: '1px', background: 'var(--acme-border)', margin: '4px 0' }} />
                  <ReceiptRow label="Total" value={formatMoney(order.total, order.currency)} strong />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'var(--acme-text-muted)' }}>
                    {order.payment_method_label || 'Sin metodo de pago'}
                    {order.cash_change_for ? ` · Vuelto para ${order.cash_change_for}` : ''}
                  </span>
                  <StatusPill label={paymentMeta.label} tone={paymentMeta.tone} />
                </div>
              </SectionCard>
              )}
            </div>
          </div>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'operations' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Asignaciones de reparto"
            description="Repartidores a los que se ofrecio este pedido y en que quedo cada intento."
            actions={
              canAssignDriver ? (
                <button type="button" onClick={() => openAssignmentModal()} className="btn btn--secondary btn--sm">
                  Asignar reparto
                </button>
              ) : null
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
              ]}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable title="Historial de estado" description="Cada cambio de estado, quien lo hizo y cuando.">
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

          <AdminInlineRelationTable title="Cancelaciones" description="Quien cancelo el pedido y por que.">
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
            description="Reclamos o problemas reportados con este pedido."
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
            description="Fotos o archivos que respaldan la entrega o un reclamo."
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
                      <a href={evidence.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--acme-purple)', fontWeight: 600 }}>
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
            description="Cobros e intentos de cobro de este pedido."
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
            description="Respuestas de la pasarela de pago para cada cobro."
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
            title="Devoluciones"
            description="Dinero devuelto al cliente, total o parcial."
            actions={
              <button
                type="button"
                onClick={() => {
                  setRefundForm(adminOrdersService.createEmptyRefundForm());
                  setRefundOpen(true);
                }}
                className="btn btn--secondary btn--sm"
              >
                Registrar devolucion
              </button>
            }
          >
            <AdminDataTable
              rows={order.refunds}
              getRowId={(refund) => refund.id}
              emptyMessage="No hay devoluciones registradas."
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
        title={`Marcar pedido como ${getAdminOrderStatusLabel(statusForm.next_status).toLowerCase()}`}
        description="Confirma que el pedido ya esta preparado. Desde aqui el repartidor se encarga de los siguientes estados."
        confirmLabel="Confirmar listo"
        isLoading={mutating}
        onConfirm={handleStatusUpdate}
        onClose={() => setStatusDialogOpen(false)}
      >
        <FieldGroup label="Nota (opcional)">
          <TextAreaField value={statusForm.note} onChange={(event) => setStatusForm((current) => ({ ...current, note: event.target.value }))} />
        </FieldGroup>
      </AdminActionDialog>

      <AdminModalForm
        open={deliveryOpen}
        title="Entrega del pedido"
        description="Corrige los datos de entrega si el cliente los cambio."
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
        title="Asignar reparto"
        description="Elige el repartidor que llevara el pedido. El repartidor acepta y actualiza el reparto desde su app."
        onClose={() => setAssignmentOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setAssignmentOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleAssignmentSave} disabled={mutating || !assignmentForm.driver_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Asignar repartidor'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Repartidor">
            <SelectField value={assignmentForm.driver_id} onChange={(event) => setAssignmentForm((current) => ({ ...current, driver_id: event.target.value }))} options={driverOptions} />
          </FieldGroup>
        </div>
        <FieldGroup label="Nota para el repartidor (opcional)">
          <TextAreaField value={assignmentForm.reason} onChange={(event) => setAssignmentForm((current) => ({ ...current, reason: event.target.value }))} />
        </FieldGroup>
        {order.available_drivers.length === 0 ? (
          <div style={{ color: 'var(--acme-text-muted)' }}>No hay repartidores creados en la base por ahora, pero la ficha ya queda lista para cuando existan.</div>
        ) : null}
      </AdminModalForm>

      <AdminActionDialog
        open={cancellationOpen}
        title="Cancelar pedido"
        description="El pedido queda cancelado y se registra el motivo."
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
        description="Describe el problema para darle seguimiento."
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
        description="Registra un cobro hecho fuera de la pasarela o corrige uno existente."
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
        description="Registra a mano una respuesta de la pasarela de pago."
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
        title="Registrar devolucion"
        description="La devolucion queda visible dentro del mismo pedido y ligada al pago correspondiente."
        onClose={() => setRefundOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setRefundOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleRefundSave} disabled={mutating || !refundForm.amount} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar devolucion'}
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
