import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FieldGroup, SelectField, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminMessagesService, ConversationCreateForm, MessagesOverview, NotificationOverviewRecord } from '../../../../core/services/adminMessagesService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { IconPlus } from '../../../../components/admin/AdminIcons';

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'open' || normalized === 'sent') return 'success' as const;
  if (normalized === 'pending') return 'warning' as const;
  if (normalized === 'closed' || normalized === 'resolved' || normalized === 'read') return 'info' as const;
  return 'neutral' as const;
}

function getNotificationLink(record: NotificationOverviewRecord) {
  if (record.entity_type === 'conversation' && record.entity_id) {
    return AppRoutes.portal.admin.messageDetail.replace(':conversationId', record.entity_id);
  }
  if (record.entity_type === 'order' && record.entity_id) {
    return AppRoutes.portal.admin.orderDetail.replace(':orderId', record.entity_id);
  }
  return '';
}

export function MessagesAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.merchant?.id;
  const branchId = portal.currentScopeType === 'branch' ? portal.currentBranch?.id ?? null : null;
  const sessionUserId = portal.sessionUserId;
  const [query, setQuery] = useState('');
  const [overview, setOverview] = useState<MessagesOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ConversationCreateForm>(adminMessagesService.createEmptyConversationForm());

  const conversationTypeOptions = useMemo(
    () => [
      { value: 'order_support', label: 'Soporte de pedido' },
      { value: 'customer_chat', label: 'Cliente' },
      { value: 'driver_chat', label: 'Reparto' },
      { value: 'internal', label: 'Interna' },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: 'open', label: 'Abierta' },
      { value: 'pending', label: 'Pendiente' },
      { value: 'resolved', label: 'Resuelta' },
      { value: 'closed', label: 'Cerrada' },
    ],
    []
  );

  const roleOptions = useMemo(
    () => [
      { value: 'customer', label: 'Cliente' },
      { value: 'driver', label: 'Repartidor' },
      { value: 'staff', label: 'Staff' },
      { value: 'support', label: 'Soporte' },
    ],
    []
  );

  const loadData = async () => {
    if (!merchantId) return;
    setLoading(true);
    setError(null);
    const result = await adminMessagesService.fetchMessagesOverview(merchantId, sessionUserId, branchId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setOverview(result.data ?? null);
  };

  useEffect(() => {
    loadData();
  }, [branchId, merchantId, sessionUserId]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredConversations = useMemo(() => {
    const rows = overview?.conversations ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.order_code, row.branch_label, row.conversation_type, row.status, row.participants_summary, row.last_message_preview]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [overview?.conversations, normalizedQuery]);

  const filteredNotifications = useMemo(() => {
    const rows = overview?.notifications ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.user_label, row.title, row.body, row.type, row.status, row.entity_type].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [overview?.notifications, normalizedQuery]);

  const handleCreateConversation = async () => {
    if (!merchantId || !sessionUserId) return;
    setMutating(true);
    setError(null);
    const result = await adminMessagesService.createConversation(merchantId, sessionUserId, form);
    setMutating(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setCreateOpen(false);
    setForm(adminMessagesService.createEmptyConversationForm());
    setSuccessMessage('Conversacion creada');
    await loadData();
  };

  const handleNotificationRead = async (notificationId: string) => {
    setMutating(true);
    setError(null);
    const result = await adminMessagesService.markNotificationRead(notificationId);
    setMutating(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Notificacion actualizada');
    await loadData();
  };

  if (!merchantId) {
    return <div>No hay comercio activo para administrar mensajes.</div>;
  }

  return (
    <AdminPageFrame
      title="Mensajes"
      description="Conversaciones operativas del negocio y centro de notificaciones del equipo."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Mensajes' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentScopeType === 'branch' ? portal.currentBranch?.name || 'sin sucursal' : 'Todas', tone: portal.currentScopeType === 'branch' ? 'neutral' : 'warning' },
        { label: 'Entidad', value: 'Mensajes', tone: 'info' },
        { label: 'Modo', value: 'Soporte', tone: 'warning' },
      ]}
      actions={
        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null);
            setForm(adminMessagesService.createEmptyConversationForm());
            setCreateOpen(true);
          }}
          className="btn btn--primary"
        >
          <IconPlus />
            Nueva conversacion
        </button>
      }
    >
      <SectionCard title="Centro de Operaciones" description="Gestión de soporte, comunicación con repartidores y monitoreo de alertas de sistema.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por cliente, repartidor, pedido o contenido del mensaje..."
            className="input-field"
            style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
          />
        </div>
      </SectionCard>

      <FormStatusBar dirty={false} saving={mutating} error={error} successMessage={successMessage} />

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Soporte Activo', value: String(overview?.conversations.length ?? 0), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
              { label: 'Sin Leer', value: String((overview?.conversations ?? []).reduce((sum, item) => sum + item.unread_count, 0)), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
              { label: 'Notificaciones', value: String(overview?.notifications.length ?? 0), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg> },
              { label: 'Resolución', value: `${((overview?.conversations.filter(c => c.status === 'resolved').length || 0) / (overview?.conversations.length || 1) * 100).toFixed(0)}%`, color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 11.08 12 19 9 16"/><path d="M22 4L12 14.01 9 11.01"/></svg> },
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

          <SectionCard title="Bandeja de Conversaciones" description="Hilos persistentes de comunicación con usuarios, staff y socios logísticos.">
            <AdminDataTable
              rows={filteredConversations}
              getRowId={(record) => record.id}
              emptyMessage="No se encontraron conversaciones activas."
              columns={[
                {
                  id: 'conversation',
                  header: 'Contexto / Participantes',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-bg-soft)', color: 'var(--acme-blue)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{(record.conversation_type || 'General').toUpperCase().replace('_', ' ')}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.participants_summary || 'Sin participantes'}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'order',
                  header: 'Vinculación',
                  render: (record) =>
                    record.order_id ? (
                      <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', record.order_id)} style={{ color: 'var(--acme-blue)', fontWeight: 800, fontSize: '13px' }}>
                        #{record.order_code || record.order_id}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>Personal</span>
                    ),
                },
                {
                  id: 'activity',
                  header: 'Última actividad',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--acme-text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {record.last_message_preview || 'Iniciando conversación...'}
                      </span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{formatDateTime(record.last_message_at)}</span>
                    </div>
                  ),
                },
                {
                  id: 'status',
                  header: 'Prioridad / Estado',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <StatusPill label={(record.status || 'abierta').toUpperCase()} tone={getStatusTone(record.status)} />
                      {record.unread_count > 0 && (
                        <span style={{ background: 'var(--acme-red)', color: 'white', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: 800 }}>
                          {record.unread_count} NUEVOS
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '150px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.messageDetail.replace(':conversationId', record.id)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-blue)', fontWeight: 700 }}>
                      Abrir chat
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Notificaciones" description="notifications se muestran como centro de alertas accionables del equipo.">
            <AdminDataTable
              rows={filteredNotifications}
              getRowId={(record) => record.id}
              emptyMessage="No hay notificaciones registradas."
              columns={[
                {
                  id: 'recipient',
                  header: 'Destino',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.user_label || 'Sin usuario'}</strong>
                      <span style={{ color: '#6b7280' }}>{record.channel || 'sin canal'}</span>
                    </div>
                  ),
                },
                {
                  id: 'content',
                  header: 'Contenido',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.title || 'Sin titulo'}</strong>
                      <span style={{ color: '#6b7280' }}>{record.body || 'Sin cuerpo'}</span>
                    </div>
                  ),
                },
                {
                  id: 'entity',
                  header: 'Entidad',
                  render: (record) => {
                    const target = getNotificationLink(record);
                    return target ? (
                      <Link to={target} style={{ color: '#2563eb', fontWeight: 700 }}>
                        {record.entity_type || 'entidad'}
                      </Link>
                    ) : (
                      record.entity_type || 'Sin entidad'
                    );
                  },
                },
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
                  render: (record) =>
                    record.read_at ? (
                      <span style={{ color: '#6b7280' }}>Leida</span>
                    ) : (
                      <button type="button" onClick={() => handleNotificationRead(record.id)} className="btn btn--ghost btn--sm">
                        Marcar leida
                      </button>
                    ),
                },
              ]}
            />
          </SectionCard>
        </>
      )}

      <AdminModalForm
        open={createOpen}
        title="Nueva Conversación de Soporte"
        description="Inicia un hilo de comunicación contextual. El primer mensaje notificará de inmediato a los participantes."
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleCreateConversation} disabled={mutating || !form.initial_message} className="btn btn--primary">
              {mutating ? 'Enviando...' : 'Iniciar Conversación'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="form-grid">
            <FieldGroup label="Pedido Vinculado" hint="Asocia esta charla a una orden específica.">
              <SelectField
                value={form.order_id}
                onChange={(event) => setForm((current) => ({ ...current, order_id: event.target.value }))}
                options={[{ value: '', label: 'Sin asociación directa' }, ...((overview?.order_options ?? []).map((item) => ({ value: item.id, label: item.label })) as any)]}
              />
            </FieldGroup>
            <FieldGroup label="Categoría de Hilo">
              <SelectField value={form.conversation_type} onChange={(event) => setForm((current) => ({ ...current, conversation_type: event.target.value }))} options={conversationTypeOptions} />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Estado Inicial">
              <SelectField value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} options={statusOptions} />
            </FieldGroup>
            <FieldGroup label="Participante Primario" hint="Usuario que recibirá la notificación.">
              <SelectField
                value={form.participant_user_id}
                onChange={(event) => setForm((current) => ({ ...current, participant_user_id: event.target.value }))}
                options={[{ value: '', label: 'Solo equipo interno' }, ...((overview?.participant_options ?? []).map((item) => ({ value: item.id, label: item.label })) as any)]}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Contexto del Mensaje (Primer Envío)" hint="Explica el motivo del contacto de forma clara.">
            <TextAreaField 
              value={form.initial_message} 
              onChange={(event) => setForm((current) => ({ ...current, initial_message: event.target.value }))} 
              placeholder="Escribe el mensaje de apertura..." 
              style={{ minHeight: '120px' }}
            />
          </FieldGroup>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
