import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckboxField, FieldGroup, SelectField, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminEntityHeader } from '../../../../components/admin/AdminEntityHeader';
import { AdminInlineRelationTable } from '../../../../components/admin/AdminInlineRelationTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard } from '../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { AdminTimeline } from '../../../../components/admin/AdminTimeline';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminMessagesService,
  ConversationDetail,
  ConversationMessageForm,
  ConversationParticipantForm,
  ConversationStatusForm,
} from '../../../../core/services/adminMessagesService';
import { PortalContext } from '../../../auth/session/PortalContext';

type ConversationTab = 'summary' | 'messages' | 'participants';

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'open') return 'success' as const;
  if (normalized === 'pending') return 'warning' as const;
  if (normalized === 'resolved' || normalized === 'closed') return 'info' as const;
  return 'neutral' as const;
}

export function ConversationDetailAdminPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const portal = useContext(PortalContext);
  const merchantId = portal.merchant?.id;
  const branchId = portal.currentScopeType === 'branch' ? portal.currentBranch?.id ?? null : null;
  const sessionUserId = portal.sessionUserId;
  const [activeTab, setActiveTab] = useState<ConversationTab>('summary');
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState<ConversationStatusForm>(adminMessagesService.createEmptyConversationStatusForm());
  const [participantOpen, setParticipantOpen] = useState(false);
  const [participantForm, setParticipantForm] = useState<ConversationParticipantForm>(adminMessagesService.createEmptyParticipantForm());
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageForm, setMessageForm] = useState<ConversationMessageForm>(adminMessagesService.createEmptyMessageForm());

  const statusOptions = useMemo(
    () => [
      { value: 'open', label: 'Abierta' },
      { value: 'pending', label: 'Pendiente' },
      { value: 'resolved', label: 'Resuelta' },
      { value: 'closed', label: 'Cerrada' },
    ],
    []
  );

  const participantRoleOptions = useMemo(
    () => [
      { value: 'staff', label: 'Staff' },
      { value: 'customer', label: 'Cliente' },
      { value: 'driver', label: 'Repartidor' },
      { value: 'support', label: 'Soporte' },
    ],
    []
  );

  const messageTypeOptions = useMemo(
    () => [
      { value: 'text', label: 'Texto' },
      { value: 'note', label: 'Nota interna' },
      { value: 'file', label: 'Archivo' },
    ],
    []
  );

  const loadDetail = async () => {
    if (!merchantId || !conversationId) return;
    setLoading(true);
    setError(null);
    const result = await adminMessagesService.fetchConversationDetail(merchantId, conversationId, branchId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setDetail(result.data ?? null);
  };

  useEffect(() => {
    loadDetail();
  }, [branchId, merchantId, conversationId]);

  const availableParticipants = useMemo(() => {
    const assigned = new Set((detail?.participants ?? []).filter((item) => !item.left_at).map((item) => item.user_id));
    return (detail?.available_participants ?? []).filter((item) => !assigned.has(item.id));
  }, [detail]);

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

  const handleStatusSave = async () => {
    if (!merchantId || !sessionUserId || !conversationId) return;
    await runMutation(async () => {
      const result = await adminMessagesService.updateConversationStatus(merchantId, sessionUserId, conversationId, statusForm);
      if (result.error) throw result.error;
      setStatusOpen(false);
      setSuccessMessage('Estado actualizado');
    });
  };

  const handleParticipantSave = async () => {
    if (!merchantId || !sessionUserId || !conversationId) return;
    await runMutation(async () => {
      const result = await adminMessagesService.addParticipant(merchantId, sessionUserId, conversationId, participantForm);
      if (result.error) throw result.error;
      setParticipantOpen(false);
      setParticipantForm(adminMessagesService.createEmptyParticipantForm());
      setSuccessMessage('Participante agregado');
    });
  };

  const handleMessageSave = async () => {
    if (!merchantId || !sessionUserId || !conversationId) return;
    await runMutation(async () => {
      const result = await adminMessagesService.sendMessage(merchantId, sessionUserId, conversationId, messageForm);
      if (result.error) throw result.error;
      setMessageOpen(false);
      setMessageForm(adminMessagesService.createEmptyMessageForm());
      setSuccessMessage('Mensaje enviado');
    });
  };

  const handleMarkRead = async () => {
    if (!sessionUserId || !conversationId) return;
    await runMutation(async () => {
      const result = await adminMessagesService.markConversationRead(conversationId, sessionUserId);
      if (result.error) throw result.error;
      setSuccessMessage('Lecturas registradas');
    });
  };

  if (!merchantId) {
    return <div>No hay comercio activo para administrar conversaciones.</div>;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !detail) {
    return <ErrorBanner message={error} />;
  }

  if (!detail) {
    return <div>No se encontro la conversacion.</div>;
  }

  return (
    <AdminPageFrame
      title="Conversacion"
      description="Vista operativa del hilo con participantes, mensajes y lecturas."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Mensajes', to: AppRoutes.portal.admin.messages },
        { label: detail.id },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentScopeType === 'branch' ? portal.currentBranch?.name || detail.branch_label || 'sin sucursal' : detail.branch_label || 'Multiples', tone: 'neutral' },
        { label: 'Entidad', value: 'Conversacion', tone: 'info' },
        { label: 'Estado', value: detail.status || 'sin estado', tone: getStatusTone(detail.status) },
      ]}
    >
      <div>
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      </div>

      <AdminEntityHeader
        title={detail.conversation_type || 'Conversacion'}
        description={detail.order_id ? `Pedido #${detail.order_code || detail.order_id} - ${detail.branch_label}` : `Creada ${formatDateTime(detail.created_at)}`}
        status={{ label: detail.status || 'sin estado', tone: getStatusTone(detail.status) }}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setStatusOpen(true)} className="btn btn--secondary btn--sm">
              Cambiar estado
            </button>
            <button type="button" onClick={() => setParticipantOpen(true)} className="btn btn--secondary btn--sm">
              Agregar participante
            </button>
            <button type="button" onClick={() => setMessageOpen(true)} className="btn btn--primary btn--sm">
              Nuevo mensaje
            </button>
          </div>
        }
      />

      <FormStatusBar dirty={false} saving={mutating} error={error} successMessage={successMessage} />

      <AdminTabs
        tabs={[
          { id: 'summary', label: 'Resumen' },
          { id: 'messages', label: 'Mensajes', badge: String(detail.messages.length) },
          { id: 'participants', label: 'Participantes', badge: String(detail.participants.length) },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as ConversationTab)}
      />

      {activeTab === 'summary' ? (
        <AdminTabPanel>
          <SectionCard title="Contexto" description="Cabecera operacional de la conversacion.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Creada por', value: detail.created_by_label || 'Sin creador' },
                { label: 'Creada', value: formatDateTime(detail.created_at) },
                { label: 'Participantes', value: String(detail.participants.length) },
                { label: 'Mensajes', value: String(detail.messages.length) },
              ].map((item) => (
                <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            {detail.order_id ? (
              <div>
                <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', detail.order_id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                  Ir al pedido #{detail.order_code || detail.order_id}
                </Link>
              </div>
            ) : null}
          </SectionCard>

          <AdminInlineRelationTable title="Participantes activos" description="conversation_participants se administra desde esta misma ficha.">
            <AdminDataTable
              rows={detail.participants}
              getRowId={(record) => record.id}
              emptyMessage="No hay participantes registrados."
              columns={[
                { id: 'user', header: 'Usuario', render: (record) => record.user_label || record.user_id },
                { id: 'role', header: 'Rol', render: (record) => record.participant_role || 'sin rol' },
                { id: 'joined', header: 'Ingreso', render: (record) => formatDateTime(record.joined_at) },
                { id: 'left', header: 'Salida', render: (record) => (record.left_at ? formatDateTime(record.left_at) : 'Activo') },
              ]}
            />
          </AdminInlineRelationTable>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'messages' ? (
        <AdminTabPanel>
          <SectionCard title="Hilo" description="messages y message_reads se muestran en orden temporal para operar el caso.">
            <div>
              <button type="button" onClick={handleMarkRead} className="btn btn--secondary btn--sm">
                Marcar todo como leido
              </button>
            </div>
            <AdminTimeline
              items={detail.messages.map((message) => ({
                id: message.id,
                title: `${message.sender_label || message.sender_user_id} - ${message.message_type || 'mensaje'}`,
                subtitle: formatDateTime(message.created_at),
                tone: message.is_system ? 'warning' : 'info',
                body: (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <span>{message.body || 'Sin cuerpo'}</span>
                    {message.file_url ? (
                      <a href={message.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
                        Abrir archivo
                      </a>
                    ) : null}
                    <span style={{ color: '#6b7280' }}>
                      {message.read_count > 0 ? `Leido por ${message.read_count}: ${message.readers_label || 'sin detalle'}` : 'Sin lecturas registradas'}
                    </span>
                  </div>
                ),
              }))}
            />
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'participants' ? (
        <AdminTabPanel>
          <SectionCard title="Participantes" description="Vista tabular para revisar roles y permanencia en la conversacion.">
            <AdminDataTable
              rows={detail.participants}
              getRowId={(record) => record.id}
              emptyMessage="No hay participantes registrados."
              columns={[
                { id: 'user', header: 'Usuario', render: (record) => record.user_label || record.user_id },
                { id: 'role', header: 'Rol', render: (record) => record.participant_role || 'sin rol' },
                { id: 'joined', header: 'Ingreso', render: (record) => formatDateTime(record.joined_at) },
                { id: 'left', header: 'Salida', render: (record) => (record.left_at ? formatDateTime(record.left_at) : 'Activo') },
              ]}
            />
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      <AdminModalForm
        open={statusOpen}
        title="Cambiar estado"
        description="Actualiza el contexto operativo de la conversacion."
        onClose={() => setStatusOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setStatusOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleStatusSave} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <FieldGroup label="Estado">
          <SelectField value={statusForm.status} onChange={(event) => setStatusForm({ status: event.target.value })} options={statusOptions} />
        </FieldGroup>
      </AdminModalForm>

      <AdminModalForm
        open={participantOpen}
        title="Agregar participante"
        description="Inserta un nuevo participante dentro del hilo actual."
        onClose={() => setParticipantOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setParticipantOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleParticipantSave} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Agregar'}
            </button>
          </>
        }
      >
        <FieldGroup label="Usuario">
          <SelectField
            value={participantForm.user_id}
            onChange={(event) => setParticipantForm((current) => ({ ...current, user_id: event.target.value }))}
            options={[{ value: '', label: 'Selecciona un usuario' }, ...availableParticipants.map((item) => ({ value: item.id, label: item.label }))]}
          />
        </FieldGroup>
        <FieldGroup label="Rol">
          <SelectField
            value={participantForm.participant_role}
            onChange={(event) => setParticipantForm((current) => ({ ...current, participant_role: event.target.value }))}
            options={participantRoleOptions}
          />
        </FieldGroup>
      </AdminModalForm>

      <AdminModalForm
        open={messageOpen}
        title="Nuevo mensaje"
        description="Publica un mensaje o nota en la conversacion actual."
        onClose={() => setMessageOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setMessageOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleMessageSave} className="btn btn--primary">
              {mutating ? 'Enviando...' : 'Enviar'}
            </button>
          </>
        }
      >
        <FieldGroup label="Tipo">
          <SelectField
            value={messageForm.message_type}
            onChange={(event) => setMessageForm((current) => ({ ...current, message_type: event.target.value }))}
            options={messageTypeOptions}
          />
        </FieldGroup>
        <FieldGroup label="Mensaje">
          <TextAreaField value={messageForm.body} onChange={(event) => setMessageForm((current) => ({ ...current, body: event.target.value }))} placeholder="Escribe el mensaje..." />
        </FieldGroup>
        <FieldGroup label="URL de archivo">
          <input
            value={messageForm.file_url}
            onChange={(event) => setMessageForm((current) => ({ ...current, file_url: event.target.value }))}
            placeholder="https://..."
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db' }}
          />
        </FieldGroup>
        <CheckboxField label="Marcar como mensaje del sistema" checked={messageForm.is_system} onChange={(event) => setMessageForm((current) => ({ ...current, is_system: event.target.checked }))} />
      </AdminModalForm>
    </AdminPageFrame>
  );
}
