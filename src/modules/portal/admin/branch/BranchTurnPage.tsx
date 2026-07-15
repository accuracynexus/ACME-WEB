import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { getAdminOrderStatusLabel, getAdminOrderStatusTone } from '../../../../core/admin/utils/orderWorkflow';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminBranchOperationsService, BranchTurnOverview } from '../../../../core/services/adminBranchOperationsService';
import { PortalContext } from '../../../auth/session/PortalContext';

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function normalizeId(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return null;
  }
  return String(value);
}

export function BranchTurnPage() {
  const portal = useContext(PortalContext);
  const merchantId = normalizeId(portal.currentMerchant?.id ?? portal.merchant?.id);
  const branchId = normalizeId(portal.currentBranch?.id);
  const [overview, setOverview] = useState<BranchTurnOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!merchantId || !branchId) return;
      setLoading(true);
      setError(null);
      const result = await adminBranchOperationsService.fetchTurnOverview(merchantId, branchId, portal.sessionUserId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setOverview(result.data ?? null);
    };

    load();
  }, [branchId, merchantId, portal.sessionUserId]);

  if (!merchantId || !branchId) {
    return <div>No hay sucursal activa para operar el turno.</div>;
  }

  if (portal.currentScopeType !== 'branch') {
    return <div>Esta vista pertenece a la capa sucursal.</div>;
  }

  return (
    <AdminPageFrame
      title="Turno"
      description="Centro rapido del turno actual con colas de pedidos, conversaciones abiertas y alertas pendientes."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Turno' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentBranch?.name || 'sin sucursal', tone: 'neutral' },
        { label: 'Modo', value: 'Turno activo', tone: 'warning' },
      ]}
    >
      {loading ? (
        <SectionSkeleton lines={5} />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <>
          <SectionCard title="Centro de Operaciones" description="Monitoreo en tiempo real del estado de la sucursal y atención inmediata de incidencias.">
            <div className="stat-grid">
              {[
                { label: 'Pedidos Activos', value: String(overview?.summary.active_orders ?? 0), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
                { label: 'Listos/Despacho', value: String(overview?.summary.ready_orders ?? 0), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> },
                { label: 'Incidencias', value: String(overview?.summary.issues_orders ?? 0), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
                { label: 'Chats Abiertos', value: String(overview?.summary.open_conversations ?? 0), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                { label: 'Sin Leer', value: String(overview?.summary.unread_messages ?? 0), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
                { label: 'Notificaciones', value: String(overview?.summary.pending_notifications ?? 0), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
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

          <SectionCard title="Cola de Pedidos en Curso" description="Seguimiento de órdenes, destinos y estados de pago para la operación diaria.">
            <AdminDataTable
              rows={overview?.orders ?? []}
              getRowId={(record) => record.id}
              emptyMessage="No hay pedidos registrados para este turno."
              columns={[
                {
                  id: 'order',
                  header: 'Orden / Cliente',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-bg-soft)', color: 'var(--acme-blue)', fontSize: '11px', fontWeight: 800 }}>
                        {record.order_code}
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{record.customer_label}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>Pedido #{record.order_code}</span>
                      </div>
                    </div>
                  ),
                },
                { 
                  id: 'delivery', 
                  header: 'Destino', 
                  render: (record) => (
                    <span style={{ fontSize: '13px', color: 'var(--acme-text-muted)' }}>{record.address_label || 'Retiro en local'}</span>
                  )
                },
                { 
                  id: 'status', 
                  header: 'Estado', 
                  render: (record) => (
                    <StatusPill label={getAdminOrderStatusLabel(record.status).toUpperCase()} tone={getAdminOrderStatusTone(record.status)} />
                  ) 
                },
                { 
                  id: 'payment', 
                  header: 'Medio de Pago', 
                  render: (record) => (
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{record.payment_label || 'Pendiente'}</span>
                  ) 
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '120px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', record.id)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                      Gestionar
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Canales de Comunicación" description="Interacción directa con clientes y repartidores sobre pedidos activos.">
            <AdminDataTable
              rows={overview?.conversations ?? []}
              getRowId={(record) => record.id}
              emptyMessage="No hay conversaciones activas en esta sucursal."
              columns={[
                {
                  id: 'conversation',
                  header: 'Canal / Participantes',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-purple-soft)', color: 'var(--acme-purple)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{record.conversation_type === 'order' ? 'Chat de Pedido' : 'Soporte Directo'}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.participants_summary}</span>
                      </div>
                    </div>
                  ),
                },
                { 
                  id: 'order', 
                  header: 'Ref. Pedido', 
                  render: (record) => (
                    <span style={{ fontWeight: 700, color: 'var(--acme-blue)', fontSize: '13px' }}>
                      {record.order_code ? `#${record.order_code}` : '—'}
                    </span>
                  ) 
                },
                { 
                  id: 'last', 
                  header: 'Último Mensaje', 
                  render: (record) => (
                    <span style={{ color: 'var(--acme-text-muted)', fontSize: '12px', maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {record.last_message_preview || 'Sin mensajes aún'}
                    </span>
                  ) 
                },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <StatusPill label={record.status === 'open' ? 'ABIERTO' : 'CERRADO'} tone={record.status === 'open' ? 'success' : 'neutral'} />
                      {record.unread_count > 0 && (
                        <div style={{ background: 'var(--acme-red)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                          {record.unread_count}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '120px',
                  render: (record) => (
                    <Link to={AppRoutes.portal.admin.messageDetail.replace(':conversationId', record.id)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                      Responder
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Alertas de Servicio" description="Notificaciones críticas y avisos de atención inmediata para la sucursal.">
            <AdminDataTable
              rows={overview?.notifications ?? []}
              getRowId={(record) => record.id}
              emptyMessage="No hay alertas críticas pendientes."
              columns={[
                {
                  id: 'title',
                  header: 'Incidencia / Aviso',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '36px', height: '36px', background: record.status === 'read' ? 'var(--acme-bg-soft)' : 'rgba(239, 68, 68, 0.1)', color: record.status === 'read' ? 'var(--acme-text-faint)' : 'var(--acme-red)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{record.title || 'Centro de Notificaciones'}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.body}</span>
                      </div>
                    </div>
                  ),
                },
                { id: 'target', header: 'Destinatario', render: (record) => <span style={{ fontSize: '13px' }}>{record.user_label || 'Público'}</span> },
                { 
                  id: 'status', 
                  header: 'Estado', 
                  render: (record) => (
                    <StatusPill label={record.status === 'read' ? 'VISTO' : 'PENDIENTE'} tone={record.status === 'read' ? 'neutral' : 'warning'} />
                  ) 
                },
                { 
                  id: 'created', 
                  header: 'Momento', 
                  render: (record) => (
                    <span style={{ fontSize: '12px', color: 'var(--acme-text-faint)' }}>{formatDateTime(record.created_at)}</span>
                  ) 
                },
              ]}
            />
          </SectionCard>
        </>
      )}
    </AdminPageFrame>
  );
}
