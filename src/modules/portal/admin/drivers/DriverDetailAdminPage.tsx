import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminDrawer } from '../../../../components/admin/AdminDrawer';
import { AdminEntityHeader } from '../../../../components/admin/AdminEntityHeader';
import { CheckboxField, FieldGroup, NumberField, SelectField } from '../../../../components/admin/AdminFields';
import { AdminInlineRelationTable } from '../../../../components/admin/AdminInlineRelationTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { AdminTimeline } from '../../../../components/admin/AdminTimeline';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminDriversService,
  DriverAdminDetail,
  DriverCashCollectionForm,
  DriverCashCollectionRecord,
  DriverDocumentForm,
  DriverDocumentRecord,
  DriverRootForm,
  DriverShiftForm,
  DriverShiftRecord,
  DriverStateForm,
  DriverVehicleForm,
  DriverVehicleRecord,
} from '../../../../core/services/adminDriversService';
import { PortalContext } from '../../../auth/session/PortalContext';

type DriverDetailTab = 'summary' | 'documents' | 'operations' | 'cash';

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

function getDriverTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active' || normalized === 'available') return 'success' as const;
  if (normalized === 'suspended' || normalized === 'blocked') return 'danger' as const;
  if (normalized === 'pending' || normalized === 'pending_verification') return 'warning' as const;
  return 'info' as const;
}

// Tonos del enum driver_state: offline, available, busy, paused
function getStateTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'available') return 'success' as const;
  if (normalized === 'busy') return 'info' as const;
  if (normalized === 'offline') return 'neutral' as const;
  return 'warning' as const;
}

export function DriverDetailAdminPage() {
  const navigate = useNavigate();
  const { driverId } = useParams();
  const portal = useContext(PortalContext);

  const [activeTab, setActiveTab] = useState<DriverDetailTab>('summary');
  const [detail, setDetail] = useState<DriverAdminDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [rootOpen, setRootOpen] = useState(false);
  const [rootForm, setRootForm] = useState<DriverRootForm>(adminDriversService.createEmptyRootForm());

  const [stateOpen, setStateOpen] = useState(false);
  const [stateForm, setStateForm] = useState<DriverStateForm>(adminDriversService.createEmptyStateForm());

  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState<DriverDocumentForm>(adminDriversService.createEmptyDocumentForm());

  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<DriverVehicleForm>(adminDriversService.createEmptyVehicleForm());

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState<DriverShiftForm>(adminDriversService.createEmptyShiftForm());

  const [cashOpen, setCashOpen] = useState(false);
  const [cashForm, setCashForm] = useState<DriverCashCollectionForm>(adminDriversService.createEmptyCashCollectionForm());

  const [vehicleTypesDrawerOpen, setVehicleTypesDrawerOpen] = useState(false);

  const loadDetail = async () => {
    if (!driverId) return;
    setLoading(true);
    setError(null);
    const result = await adminDriversService.fetchDriverDetail(driverId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setDetail(result.data ?? null);
  };

  useEffect(() => {
    loadDetail();
  }, [driverId]);

  const vehicleTypeOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un tipo de vehiculo' },
      ...((detail?.vehicle_type_options ?? []).map((item) => ({
        value: item.id,
        label: `${item.name} (${item.code})`,
      })) as Array<{ value: string; label: string }>),
    ],
    [detail]
  );

  const orderOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un pedido' },
      ...((detail?.order_options ?? []).map((item) => ({
        value: item.id,
        label: item.label,
      })) as Array<{ value: string; label: string }>),
    ],
    [detail]
  );

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

  const openRootModal = () => {
    if (!detail) return;
    setRootForm(adminDriversService.createRootForm(detail));
    setRootOpen(true);
  };

  const openStateModal = () => {
    if (!detail) return;
    setStateForm(adminDriversService.createStateForm(detail));
    setStateOpen(true);
  };

  const openDocumentModal = (record?: DriverDocumentRecord) => {
    if (!record) {
      setDocumentForm(adminDriversService.createEmptyDocumentForm());
      setDocumentOpen(true);
      return;
    }

    setDocumentForm({
      ...adminDriversService.createDocumentForm(record),
      expires_at: toDateTimeInput(record.expires_at),
    });
    setDocumentOpen(true);
  };

  const openVehicleModal = (record?: DriverVehicleRecord) => {
    setVehicleForm(record ? adminDriversService.createVehicleForm(record) : adminDriversService.createEmptyVehicleForm());
    setVehicleOpen(true);
  };

  const openShiftModal = (record?: DriverShiftRecord) => {
    if (!record) {
      setShiftForm(adminDriversService.createEmptyShiftForm());
      setShiftOpen(true);
      return;
    }

    setShiftForm({
      ...adminDriversService.createShiftForm(record),
      start_at: toDateTimeInput(record.start_at),
      end_at: toDateTimeInput(record.end_at),
    });
    setShiftOpen(true);
  };

  const openCashModal = (record?: DriverCashCollectionRecord) => {
    if (!record) {
      setCashForm(adminDriversService.createEmptyCashCollectionForm());
      setCashOpen(true);
      return;
    }

    setCashForm({
      ...adminDriversService.createCashCollectionForm(record),
      collected_at: toDateTimeInput(record.collected_at),
      settled_at: toDateTimeInput(record.settled_at),
    });
    setCashOpen(true);
  };

  const handleRootSave = async () => {
    await runMutation(async () => {
      const result = await adminDriversService.saveDriver(rootForm);
      if (result.error) throw result.error;
      setRootOpen(false);
      setSuccessMessage('Ficha del repartidor actualizada');
    });
  };

  const handleStateSave = async () => {
    if (!driverId) return;
    await runMutation(async () => {
      const result = await adminDriversService.saveDriverState(driverId, stateForm);
      if (result.error) throw result.error;
      setStateOpen(false);
      setSuccessMessage('Estado del repartidor actualizado');
    });
  };

  const handleDocumentSave = async () => {
    if (!driverId) return;
    await runMutation(async () => {
      const result = await adminDriversService.saveDriverDocument(driverId, documentForm);
      if (result.error) throw result.error;
      setDocumentOpen(false);
      setSuccessMessage(documentForm.id ? 'Documento actualizado' : 'Documento agregado');
    });
  };

  const handleVehicleSave = async () => {
    if (!driverId) return;
    await runMutation(async () => {
      const result = await adminDriversService.saveVehicle(driverId, vehicleForm);
      if (result.error) throw result.error;
      setVehicleOpen(false);
      setSuccessMessage(vehicleForm.id ? 'Vehiculo actualizado' : 'Vehiculo agregado');
    });
  };

  const handleShiftSave = async () => {
    if (!driverId) return;
    await runMutation(async () => {
      const result = await adminDriversService.saveShift(driverId, shiftForm);
      if (result.error) throw result.error;
      setShiftOpen(false);
      setSuccessMessage(shiftForm.id ? 'Turno actualizado' : 'Turno agregado');
    });
  };

  const handleCashSave = async () => {
    if (!driverId) return;
    await runMutation(async () => {
      const result = await adminDriversService.saveCashCollection(driverId, cashForm);
      if (result.error) throw result.error;
      setCashOpen(false);
      setSuccessMessage(cashForm.id ? 'Cobranza actualizada' : 'Cobranza registrada');
    });
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !detail) {
    return <ErrorBanner message={error} />;
  }

  if (!detail) {
    return <div>No se encontro el repartidor.</div>;
  }

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista pertenece a la capa plataforma.</div>;
  }

  const activeVehicle = detail.vehicles.find((vehicle) => vehicle.is_active) ?? detail.vehicles[0] ?? null;

  return (
    <AdminPageFrame
      title="Ficha de repartidor"
      description="Operacion completa de reparto: onboarding, estado, vehiculo, turnos, tracking, caja y liquidaciones."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Reparto', to: AppRoutes.portal.admin.drivers },
        { label: detail.full_name || detail.email || detail.id },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'Repartidor', tone: 'info' },
        { label: 'Modo', value: 'Supervision y soporte', tone: 'warning' },
        { label: 'Estado', value: detail.status || 'sin estado', tone: getDriverTone(detail.status) },
      ]}
    >
      <div>
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      </div>

      <AdminEntityHeader
        title={detail.full_name || detail.email || 'Repartidor'}
        description={`${detail.email || 'Sin email'} / ${detail.phone || 'Sin telefono'} / ${detail.vehicle_type_label || 'Sin tipo de vehiculo'}`}
        status={{ label: detail.status || 'sin estado', tone: getDriverTone(detail.status) }}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={openRootModal} className="btn btn--secondary btn--sm">
              Editar ficha
            </button>
            <button type="button" onClick={openStateModal} className="btn btn--secondary btn--sm">
              Editar estado
            </button>
            <button type="button" onClick={() => openShiftModal()} className="btn btn--secondary btn--sm">
              Agregar turno
            </button>
            <button type="button" onClick={() => openCashModal()} className="btn btn--secondary btn--sm">
              Registrar cobranza
            </button>
            <button type="button" onClick={() => setVehicleTypesDrawerOpen(true)} className="btn btn--secondary btn--sm">
              Ver tipos de vehiculo
            </button>
          </div>
        }
      />

      <AdminTabs
        tabs={[
          { id: 'summary', label: 'Resumen' },
          { id: 'documents', label: 'Documentos', badge: String(detail.documents.length) },
          { id: 'operations', label: 'Operacion', badge: String(detail.shifts.length + detail.vehicles.length) },
          { id: 'cash', label: 'Caja', badge: String(detail.cash_collections.length + detail.settlements.length) },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as DriverDetailTab)}
      />

      {activeTab === 'summary' ? (
        <AdminTabPanel>
          <SectionCard title="Resumen operativo" description="Vista rapida para validar onboarding, disponibilidad y nivel de riesgo del repartidor.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {([
                // Los dos primeros son los que habilitan al repartidor a operar:
                // la app exige is_verified && profiles.is_active para dejarlo
                // salir de la pantalla de revision. Van al frente porque el
                // resto del resumen no dice nada sobre el onboarding.
                { label: 'Verificacion', value: detail.is_verified ? 'Verificado' : 'Pendiente', tone: detail.is_verified ? 'ok' : 'warn' },
                { label: 'Perfil', value: detail.is_active ? 'Activo' : 'Inactivo', tone: detail.is_active ? 'ok' : 'warn' },
                { label: 'Rating', value: detail.rating_avg.toFixed(1) },
                { label: 'Estado en vivo', value: detail.current_state_status || 'offline' },
                { label: 'Online', value: detail.is_online ? 'Si' : 'No' },
                { label: 'Pedido actual', value: detail.current_order_code ? `#${detail.current_order_code}` : 'Sin pedido' },
                { label: 'Ultima senal', value: detail.last_seen_at ? formatDateTime(detail.last_seen_at) : 'Sin senal' },
                { label: 'Alta', value: detail.joined_at ? formatDateTime(detail.joined_at) : 'Sin fecha' },
              ] as Array<{ label: string; value: string; tone?: 'ok' | 'warn' }>).map((item) => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                  <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>{item.label}</div>
                  <strong style={{ color: item.tone === 'ok' ? 'var(--acme-green)' : item.tone === 'warn' ? 'var(--acme-orange)' : undefined }}>
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </SectionCard>

          <AdminInlineRelationTable
            title="Estado en vivo"
            description="driver_current_state se usa como tablero operativo en vivo y no como CRUD suelto."
            actions={
              <button type="button" onClick={openStateModal} className="btn btn--secondary btn--sm">
                Editar estado
              </button>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Estado</div>
                <div style={{ marginTop: '8px' }}>
                  <StatusPill label={detail.current_state_status || 'offline'} tone={getStateTone(detail.current_state_status)} />
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Conexion</div>
                <strong>{detail.is_online ? 'Online' : 'Offline'}</strong>
                <div style={{ color: 'var(--acme-text-muted)', marginTop: '6px' }}>
                  {detail.last_seen_at ? `Ultima senal ${formatDateTime(detail.last_seen_at)}` : 'Sin ultima senal'}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Ubicacion actual</div>
                <strong>
                  {detail.last_lat || detail.last_lng ? `${detail.last_lat || '-'}, ${detail.last_lng || '-'}` : 'Sin coordenadas'}
                </strong>
                <div style={{ color: 'var(--acme-text-muted)', marginTop: '6px' }}>
                  {detail.current_order_id ? (
                    <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', detail.current_order_id)} style={{ color: '#2563eb' }}>
                      Ver pedido #{detail.current_order_code || detail.current_order_id}
                    </Link>
                  ) : (
                    'Sin pedido en curso'
                  )}
                </div>
              </div>
            </div>
          </AdminInlineRelationTable>

          <AdminInlineRelationTable
            title="Asignaciones recientes"
            description="order_assignments aparece aqui como lectura integrada para entender carga y trazabilidad del driver."
          >
            <AdminDataTable
              rows={detail.assignments}
              getRowId={(record) => record.id}
              emptyMessage="No hay asignaciones registradas para este repartidor."
              columns={[
                {
                  id: 'order',
                  header: 'Pedido',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>#{record.order_code}</strong>
                      <span style={{ color: 'var(--acme-text-muted)' }}>{record.branch_label}</span>
                    </div>
                  ),
                },
                { id: 'status', header: 'Estado', render: (record) => record.status || 'sin estado' },
                { id: 'assigned', header: 'Asignado', render: (record) => formatDateTime(record.assigned_at) },
                { id: 'reason', header: 'Nota', render: (record) => record.reason || 'Sin nota' },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '150px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', record.order_id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                      Ver pedido
                    </Link>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'documents' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Documentos"
            description="driver_documents se administra dentro de la ficha para validar onboarding y vigencias."
            actions={
              <button type="button" onClick={() => openDocumentModal()} className="btn btn--secondary btn--sm">
                Agregar documento
              </button>
            }
          >
            <AdminDataTable
              rows={detail.documents}
              getRowId={(record) => record.id}
              emptyMessage="No hay documentos cargados."
              columns={[
                {
                  id: 'type',
                  header: 'Documento',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.document_type || 'Documento'}</strong>
                      <span style={{ color: 'var(--acme-text-muted)' }}>{record.document_number || 'Sin numero'}</span>
                    </div>
                  ),
                },
                { id: 'status', header: 'Estado', render: (record) => record.status || 'sin estado' },
                { id: 'expires', header: 'Vence', render: (record) => (record.expires_at ? formatDateTime(record.expires_at) : 'Sin vencimiento') },
                {
                  id: 'file',
                  header: 'Archivo',
                  render: (record) =>
                    record.file_url ? (
                      <a href={record.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                        Abrir archivo
                      </a>
                    ) : (
                      'Sin archivo'
                    ),
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openDocumentModal(record)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'operations' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Vehiculos"
            description="vehicles y vehicle_types viven juntos para controlar el vehiculo activo y el historial del repartidor."
            actions={
              <button type="button" onClick={() => openVehicleModal()} className="btn btn--secondary btn--sm">
                Agregar vehiculo
              </button>
            }
          >
            <AdminDataTable
              rows={detail.vehicles}
              getRowId={(record) => record.id}
              emptyMessage="No hay vehiculos registrados."
              columns={[
                {
                  id: 'vehicle',
                  header: 'Vehiculo',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{[record.brand, record.model].filter(Boolean).join(' ') || 'Vehiculo'}</strong>
                      <span style={{ color: 'var(--acme-text-muted)' }}>{record.plate || 'Sin placa'} / {record.vehicle_type_label}</span>
                    </div>
                  ),
                },
                { id: 'color', header: 'Color', render: (record) => record.color || 'Sin color' },
                {
                  id: 'state',
                  header: 'Activo',
                  render: (record) => (record.is_active ? <StatusPill label="Activo" tone="success" /> : 'No'),
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openVehicleModal(record)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>

          <AdminInlineRelationTable
            title="Turnos"
            description="driver_shifts se usa para organizar disponibilidad y cierre operativo del repartidor."
            actions={
              <button type="button" onClick={() => openShiftModal()} className="btn btn--secondary btn--sm">
                Agregar turno
              </button>
            }
          >
            <AdminDataTable
              rows={detail.shifts}
              getRowId={(record) => record.id}
              emptyMessage="No hay turnos registrados."
              columns={[
                { id: 'start', header: 'Inicio', render: (record) => formatDateTime(record.start_at) },
                { id: 'end', header: 'Fin', render: (record) => (record.end_at ? formatDateTime(record.end_at) : 'Sin cierre') },
                { id: 'status', header: 'Estado', render: (record) => record.status || 'sin estado' },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openShiftModal(record)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>

          <SectionCard title="Tracking reciente" description="driver_locations se expone como lectura integrada para soporte y monitoreo de reparto.">
            {detail.locations.length === 0 ? (
              <div style={{ color: 'var(--acme-text-muted)' }}>No hay ubicaciones registradas todavia.</div>
            ) : (
              <AdminTimeline
                items={detail.locations.map((location) => ({
                  id: location.id,
                  title: `${location.order_code ? `Pedido #${location.order_code}` : 'Sin pedido'} / ${formatDateTime(location.recorded_at)}`,
                  subtitle: `${location.lat}, ${location.lng}`,
                  body: (
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span>Precision: {location.accuracy_m || 0} m</span>
                      <span>Velocidad: {location.speed_kmh || 0} km/h</span>
                      <span>Heading: {location.heading || 0}</span>
                    </div>
                  ),
                  tone: 'info',
                }))}
              />
            )}
          </SectionCard>

          <SectionCard title="Vehiculo activo" description="Resumen rapido del vehiculo principal del repartidor.">
            {activeVehicle ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                  <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Unidad</div>
                  <strong>{[activeVehicle.brand, activeVehicle.model].filter(Boolean).join(' ') || 'Vehiculo'}</strong>
                </div>
                <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                  <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Placa</div>
                  <strong>{activeVehicle.plate || 'Sin placa'}</strong>
                </div>
                <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)' }}>
                  <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>Tipo</div>
                  <strong>{activeVehicle.vehicle_type_label || 'Sin tipo'}</strong>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--acme-text-muted)' }}>No hay vehiculo activo registrado.</div>
            )}
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'cash' ? (
        <AdminTabPanel>
          <AdminInlineRelationTable
            title="Cobranza en efectivo"
            description="cash_collections vive en esta ficha para cuadrar efectivo por pedido y estado de liquidacion."
            actions={
              <button type="button" onClick={() => openCashModal()} className="btn btn--secondary btn--sm">
                Registrar cobranza
              </button>
            }
          >
            <AdminDataTable
              rows={detail.cash_collections}
              getRowId={(record) => record.id}
              emptyMessage="No hay cobranzas registradas."
              columns={[
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
                { id: 'amount', header: 'Monto', render: (record) => formatMoney(record.amount_collected) },
                { id: 'status', header: 'Estado', render: (record) => record.status || 'sin estado' },
                { id: 'collected', header: 'Cobrado', render: (record) => (record.collected_at ? formatDateTime(record.collected_at) : 'Sin fecha') },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openCashModal(record)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminInlineRelationTable>

          <SectionCard title="Liquidaciones del repartidor" description="driver_settlements y driver_settlement_items se leen juntos para validar pagos, bonos y penalidades.">
            {detail.settlements.length === 0 ? (
              <div style={{ color: 'var(--acme-text-muted)' }}>No hay liquidaciones registradas todavia.</div>
            ) : (
              <div style={{ display: 'grid', gap: '18px' }}>
                {detail.settlements.map((settlement) => (
                  <div key={settlement.id} style={{ padding: '18px', borderRadius: '16px', background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)', display: 'grid', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <strong>
                          Periodo {formatDateTime(settlement.period_start)} - {formatDateTime(settlement.period_end)}
                        </strong>
                        <div style={{ color: 'var(--acme-text-muted)', marginTop: '6px' }}>
                          {settlement.deliveries_count} entregas / generado {formatDateTime(settlement.generated_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <StatusPill label={settlement.status || 'sin estado'} tone={settlement.status === 'paid' ? 'success' : 'warning'} />
                        <strong>{formatMoney(settlement.net_payable)}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                      {[
                        { label: 'Bruto', value: formatMoney(settlement.gross_earnings) },
                        { label: 'Bonos', value: formatMoney(settlement.bonuses) },
                        { label: 'Penalidades', value: formatMoney(settlement.penalties) },
                        { label: 'Efectivo', value: formatMoney(settlement.cash_collected) },
                      ].map((item) => (
                        <div key={item.label} style={{ padding: '12px', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--acme-border)' }}>
                          <div style={{ color: 'var(--acme-text-muted)', fontSize: '13px' }}>{item.label}</div>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                    <AdminDataTable
                      rows={settlement.items}
                      getRowId={(item) => item.id}
                      emptyMessage="No hay items en esta liquidacion."
                      columns={[
                        {
                          id: 'order',
                          header: 'Pedido',
                          render: (item) =>
                            item.order_id ? (
                              <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', item.order_id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                                #{item.order_code || item.order_id}
                              </Link>
                            ) : (
                              'Sin pedido'
                            ),
                        },
                        { id: 'earning', header: 'Ganancia', render: (item) => formatMoney(item.earning_amount) },
                        { id: 'bonus', header: 'Bono', render: (item) => formatMoney(item.bonus_amount) },
                        { id: 'penalty', header: 'Penalidad', render: (item) => formatMoney(item.penalty_amount) },
                        { id: 'net', header: 'Neto', align: 'right', render: (item) => formatMoney(item.net_amount) },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      <FormStatusBar dirty={false} saving={mutating} error={error} successMessage={successMessage} />

      <AdminModalForm
        open={rootOpen}
        title="Editar ficha del repartidor"
        description="Actualiza profiles y drivers desde un solo modal contextual."
        onClose={() => setRootOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setRootOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleRootSave} disabled={mutating || !rootForm.user_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar ficha'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Email">
            <TextField value={rootForm.email} disabled />
          </FieldGroup>
          <FieldGroup label="Nombre completo">
            <TextField value={rootForm.full_name} onChange={(event) => setRootForm((current) => ({ ...current, full_name: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Telefono">
            <TextField value={rootForm.phone} onChange={(event) => setRootForm((current) => ({ ...current, phone: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Documento">
            <TextField value={rootForm.document_number} onChange={(event) => setRootForm((current) => ({ ...current, document_number: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Licencia">
            <TextField value={rootForm.license_number} onChange={(event) => setRootForm((current) => ({ ...current, license_number: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Tipo de vehiculo preferente">
            <SelectField value={rootForm.vehicle_type_id} onChange={(event) => setRootForm((current) => ({ ...current, vehicle_type_id: event.target.value }))} options={vehicleTypeOptions} />
          </FieldGroup>
          <FieldGroup label="Estado operativo">
            <SelectField
              value={rootForm.status}
              onChange={(event) => setRootForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'active', label: 'Activo' },
                { value: 'suspended', label: 'Suspendido' },
                { value: 'inactive', label: 'Inactivo' },
              ]}
            />
          </FieldGroup>
        </div>
        {/* Un div y no un FieldGroup: ese renderiza un <label>, y anidar
            checkboxes con label propio adentro es invalido y ademas haria
            que clickear el titulo togglee el primero. */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)' }}>Habilitacion para operar</span>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <CheckboxField label="Verificado" checked={rootForm.is_verified} onChange={(event) => setRootForm((current) => ({ ...current, is_verified: event.target.checked }))} />
            <CheckboxField label="Perfil activo" checked={rootForm.is_active} onChange={(event) => setRootForm((current) => ({ ...current, is_active: event.target.checked }))} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>
            La app del repartidor exige las dos marcadas para dejarlo salir de la pantalla de revision y recibir pedidos. El estado operativo de arriba no interviene.
          </span>
        </div>
      </AdminModalForm>

      <AdminModalForm
        open={stateOpen}
        title="Editar estado del repartidor"
        description="Controla driver_current_state como vista operativa de disponibilidad."
        onClose={() => setStateOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setStateOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleStateSave} disabled={mutating} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar estado'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Estado en vivo">
            {/* Valores del enum driver_state: offline, available, busy, paused */}
            <SelectField
              value={stateForm.status}
              onChange={(event) => setStateForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'offline', label: 'Offline' },
                { value: 'available', label: 'Disponible' },
                { value: 'busy', label: 'Ocupado' },
                { value: 'paused', label: 'En pausa' },
              ]}
            />
          </FieldGroup>
        </div>
        <CheckboxField label="Marcar como online" checked={stateForm.is_online} onChange={(event) => setStateForm((current) => ({ ...current, is_online: event.target.checked }))} />
      </AdminModalForm>

      <AdminModalForm
        open={documentOpen}
        title={documentForm.id ? 'Editar documento' : 'Agregar documento'}
        description="Documentos de verificacion y cumplimiento del repartidor."
        onClose={() => setDocumentOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setDocumentOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleDocumentSave} disabled={mutating || !documentForm.document_type} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar documento'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Tipo">
            <SelectField
              value={documentForm.document_type}
              onChange={(event) => setDocumentForm((current) => ({ ...current, document_type: event.target.value }))}
              options={[
                { value: 'license', label: 'Licencia' },
                { value: 'identity', label: 'Identidad' },
                { value: 'insurance', label: 'Seguro' },
                { value: 'background_check', label: 'Antecedentes' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Numero">
            <TextField value={documentForm.document_number} onChange={(event) => setDocumentForm((current) => ({ ...current, document_number: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="URL del archivo">
            <TextField value={documentForm.file_url} onChange={(event) => setDocumentForm((current) => ({ ...current, file_url: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={documentForm.status}
              onChange={(event) => setDocumentForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'approved', label: 'Aprobado' },
                { value: 'rejected', label: 'Rechazado' },
                { value: 'expired', label: 'Vencido' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Vence">
            <TextField type="datetime-local" value={documentForm.expires_at} onChange={(event) => setDocumentForm((current) => ({ ...current, expires_at: event.target.value }))} />
          </FieldGroup>
        </div>
      </AdminModalForm>

      <AdminModalForm
        open={vehicleOpen}
        title={vehicleForm.id ? 'Editar vehiculo' : 'Agregar vehiculo'}
        description="Gestiona vehicles y sincroniza el tipo preferente del repartidor cuando la unidad queda activa."
        onClose={() => setVehicleOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setVehicleOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleVehicleSave} disabled={mutating || !vehicleForm.vehicle_type_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar vehiculo'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Tipo">
            <SelectField value={vehicleForm.vehicle_type_id} onChange={(event) => setVehicleForm((current) => ({ ...current, vehicle_type_id: event.target.value }))} options={vehicleTypeOptions} />
          </FieldGroup>
          <FieldGroup label="Placa">
            <TextField value={vehicleForm.plate} onChange={(event) => setVehicleForm((current) => ({ ...current, plate: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Marca">
            <TextField value={vehicleForm.brand} onChange={(event) => setVehicleForm((current) => ({ ...current, brand: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Modelo">
            <TextField value={vehicleForm.model} onChange={(event) => setVehicleForm((current) => ({ ...current, model: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Color">
            <TextField value={vehicleForm.color} onChange={(event) => setVehicleForm((current) => ({ ...current, color: event.target.value }))} />
          </FieldGroup>
        </div>
        <CheckboxField label="Vehiculo activo" checked={vehicleForm.is_active} onChange={(event) => setVehicleForm((current) => ({ ...current, is_active: event.target.checked }))} />
      </AdminModalForm>

      <AdminModalForm
        open={shiftOpen}
        title={shiftForm.id ? 'Editar turno' : 'Agregar turno'}
        description="driver_shifts se usa para disponibilidad y control de cierre del repartidor."
        onClose={() => setShiftOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setShiftOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleShiftSave} disabled={mutating || !shiftForm.start_at} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar turno'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Inicio">
            <TextField type="datetime-local" value={shiftForm.start_at} onChange={(event) => setShiftForm((current) => ({ ...current, start_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Fin">
            <TextField type="datetime-local" value={shiftForm.end_at} onChange={(event) => setShiftForm((current) => ({ ...current, end_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Estado">
            {/* Valores del enum shift_status: scheduled, started, ended, cancelled */}
            <SelectField
              value={shiftForm.status}
              onChange={(event) => setShiftForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'scheduled', label: 'Programado' },
                { value: 'started', label: 'En curso' },
                { value: 'ended', label: 'Finalizado' },
                { value: 'cancelled', label: 'Cancelado' },
              ]}
            />
          </FieldGroup>
        </div>
      </AdminModalForm>

      <AdminModalForm
        open={cashOpen}
        title={cashForm.id ? 'Editar cobranza' : 'Registrar cobranza'}
        description="cash_collections se gestiona dentro de la ficha del repartidor con contexto de pedido."
        onClose={() => setCashOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setCashOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleCashSave} disabled={mutating || !cashForm.order_id} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar cobranza'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <FieldGroup label="Pedido">
            <SelectField value={cashForm.order_id} onChange={(event) => setCashForm((current) => ({ ...current, order_id: event.target.value }))} options={orderOptions} />
          </FieldGroup>
          <FieldGroup label="Monto">
            <NumberField value={cashForm.amount_collected} onChange={(event) => setCashForm((current) => ({ ...current, amount_collected: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Estado">
            <SelectField
              value={cashForm.status}
              onChange={(event) => setCashForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'collected', label: 'Cobrado' },
                { value: 'settled', label: 'Liquidado' },
                { value: 'disputed', label: 'Observado' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Cobrado en">
            <TextField type="datetime-local" value={cashForm.collected_at} onChange={(event) => setCashForm((current) => ({ ...current, collected_at: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Liquidado en">
            <TextField type="datetime-local" value={cashForm.settled_at} onChange={(event) => setCashForm((current) => ({ ...current, settled_at: event.target.value }))} />
          </FieldGroup>
        </div>
        {detail.order_options.length === 0 ? (
          <div style={{ color: 'var(--acme-text-muted)' }}>Aun no hay pedidos relacionados a este repartidor para vincular una cobranza.</div>
        ) : null}
      </AdminModalForm>

      <AdminDrawer
        open={vehicleTypesDrawerOpen}
        title="Tipos de vehiculo"
        description="Catalogo de vehicle_types usado por la ficha del repartidor y sus unidades."
        onClose={() => setVehicleTypesDrawerOpen(false)}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          {detail.vehicle_type_options.map((item) => (
            <div key={item.id} style={{ padding: '14px', borderRadius: '14px', border: '1px solid var(--acme-border)', background: 'var(--acme-surface-muted)', display: 'grid', gap: '8px' }}>
              <strong>{item.name}</strong>
              <StatusPill label={item.code} tone="info" />
            </div>
          ))}
        </div>
      </AdminDrawer>
    </AdminPageFrame>
  );
}
