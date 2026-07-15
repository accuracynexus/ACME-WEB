import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FieldGroup, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard } from '../../../../components/admin/AdminScaffold';
import { AdminTimeline } from '../../../../components/admin/AdminTimeline';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminSystemService, SystemOverview, SystemSettingForm, SystemSettingRecord } from '../../../../core/services/adminSystemService';
import { PortalContext } from '../../../auth/session/PortalContext';

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function previewJson(value: unknown) {
  const text = JSON.stringify(value ?? {}, null, 2);
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

export function SystemAdminPage() {
  const portal = useContext(PortalContext);
  const sessionUserId = portal.sessionUserId;
  const [query, setQuery] = useState('');
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [settingOpen, setSettingOpen] = useState(false);
  const [settingForm, setSettingForm] = useState<SystemSettingForm>(adminSystemService.createEmptySettingForm());

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const result = await adminSystemService.fetchSystemOverview();
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setOverview(result.data ?? null);
  };

  useEffect(() => {
    if (portal.currentScopeType === 'platform') {
      loadData();
    }
  }, [portal.currentScopeType]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSettings = useMemo(() => {
    const rows = overview?.settings ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) => [row.key, row.description, JSON.stringify(row.value_json ?? {})].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.settings, normalizedQuery]);

  const filteredAuditLogs = useMemo(() => {
    const rows = overview?.audit_logs ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) => [row.actor_label, row.entity_type, row.action, row.entity_id].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.audit_logs, normalizedQuery]);

  const filteredMerchantAuditLogs = useMemo(() => {
    const rows = overview?.merchant_audit_logs ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) => [row.user_label, row.branch_label, row.entity_type, row.action, row.entity_id].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.merchant_audit_logs, normalizedQuery]);

  const filteredAnalytics = useMemo(() => {
    const rows = overview?.analytics_events ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((row) => [row.user_label, row.event_name, row.order_code, JSON.stringify(row.properties_json ?? {})].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.analytics_events, normalizedQuery]);

  const openSettingModal = (record?: SystemSettingRecord) => {
    setSuccessMessage(null);
    setSettingForm(record ? adminSystemService.createSettingForm(record) : adminSystemService.createEmptySettingForm());
    setSettingOpen(true);
  };

  const handleSettingSave = async () => {
    if (!sessionUserId) return;
    setMutating(true);
    setError(null);
    const result = await adminSystemService.saveSetting(sessionUserId, settingForm);
    setMutating(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSettingOpen(false);
    setSuccessMessage(settingForm.id ? 'Configuracion actualizada' : 'Configuracion creada');
    await loadData();
  };

  if (!portal.permissions.canManageSystem || portal.currentScopeType !== 'platform') {
    return (
      <AdminPageFrame
        title="Sistema"
        description="Esta vista ahora pertenece solo a plataforma."
        breadcrumbs={[
          { label: 'Admin', to: AppRoutes.portal.admin.root },
          { label: 'Sistema' },
        ]}
        contextItems={[
          { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'warning' },
          { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
          { label: 'Estado', value: 'Bloqueado por alcance', tone: 'danger' },
        ]}
      >
        <SectionCard
          title="Acceso restringido"
          description="system_settings, audit_logs y analytics_events son gobierno global. El owner del negocio no deberia editar esta capa."
        >
          <Link to={AppRoutes.portal.admin.root} style={{ color: '#2563eb', fontWeight: 700 }}>
            Volver al resumen del alcance actual
          </Link>
        </SectionCard>
      </AdminPageFrame>
    );
  }

  return (
    <AdminPageFrame
      title="Sistema"
      description="Gobierno global de configuracion, auditoria y telemetria de la plataforma."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Sistema' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'System settings', tone: 'warning' },
        { label: 'Modo', value: 'Control global', tone: 'warning' },
      ]}
      actions={
        <button type="button" onClick={() => openSettingModal()} className="btn btn--primary">
          Nueva configuracion
        </button>
      }
    >
      <SectionCard title="Terminal de Control Global" description="Monitoreo de trazas, telemetría y configuración del núcleo de la plataforma.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Escribir comando o filtrar por clave, actor o acción..."
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
              { label: 'Configuraciones', value: String(overview?.settings.length ?? 0), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> },
              { label: 'Auditoría Global', value: String(overview?.audit_logs.length ?? 0), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { label: 'Eventos Telemetría', value: String(overview?.analytics_events.length ?? 0), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> },
              { label: 'Logs de Negocio', value: String(overview?.merchant_audit_logs.length ?? 0), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
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

          <SectionCard title="Configuración del Núcleo" description="Modifica las variables dinámicas que gobiernan el comportamiento global del sistema.">
            <AdminDataTable
              rows={filteredSettings}
              getRowId={(record) => record.id}
              emptyMessage="No se encontraron configuraciones del sistema."
              columns={[
                {
                  id: 'key',
                  header: 'Variable / Descripción',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-bg-soft)', color: 'var(--acme-blue)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      </div>
                      <div className="module-info">
                        <code style={{ fontWeight: 800, color: 'var(--acme-blue)', fontSize: '13px' }}>{record.key}</code>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.description || 'Configuración general de sistema'}</span>
                      </div>
                    </div>
                  ),
                },
                { id: 'value', header: 'Valor (JSON)', render: (record) => <code style={{ fontSize: '11px', background: 'var(--acme-bg-soft)', padding: '4px 8px', borderRadius: '6px', color: 'var(--acme-text-muted)' }}>{previewJson(record.value_json)}</code> },
                { id: 'updated', header: 'Último Cambio', render: (record) => <span style={{ fontSize: '11px', color: 'var(--acme-text-faint)' }}>{formatDateTime(record.updated_at || record.created_at)}</span> },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openSettingModal(record)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-blue)', fontWeight: 700 }}>
                      Configurar
                    </button>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Auditoria de negocios" description="merchant_audit_logs sigue visible aqui como supervision de lo que pasa dentro de los comercios.">
            <AdminTimeline
              items={filteredMerchantAuditLogs.slice(0, 20).map((item) => ({
                id: item.id,
                title: `${item.action || 'accion'} sobre ${item.entity_type || 'entidad'}`,
                subtitle: `${item.user_label || 'Sin usuario'} - ${item.branch_label || 'Sin sucursal'} - ${formatDateTime(item.created_at)}`,
                tone: 'info',
                body: <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>{previewJson(item.metadata_json)}</pre>,
              }))}
            />
          </SectionCard>

          <SectionCard title="Auditoria global" description="audit_logs registra cambios administrativos sensibles sobre la plataforma.">
            <AdminDataTable
              rows={filteredAuditLogs}
              getRowId={(record) => record.id}
              emptyMessage="No hay trazas globales disponibles."
              columns={[
                {
                  id: 'actor',
                  header: 'Actor',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.actor_label || record.actor_user_id}</strong>
                      <span style={{ color: '#6b7280' }}>{record.action || 'sin accion'}</span>
                    </div>
                  ),
                },
                { id: 'entity', header: 'Entidad', render: (record) => `${record.entity_type || 'entidad'} / ${record.entity_id || 'sin id'}` },
                { id: 'created', header: 'Fecha', render: (record) => formatDateTime(record.created_at) },
                { id: 'payload', header: 'Cambio', render: (record) => <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>{previewJson(record.new_values_json ?? record.old_values_json)}</pre> },
              ]}
            />
          </SectionCard>

          <SectionCard title="Eventos analytics" description="analytics_events se lee aqui como telemetria global y deja de quedar escondido dentro del negocio.">
            <AdminDataTable
              rows={filteredAnalytics}
              getRowId={(record) => record.id}
              emptyMessage="No hay eventos analytics visibles."
              columns={[
                {
                  id: 'event',
                  header: 'Evento',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.event_name || 'sin evento'}</strong>
                      <span style={{ color: '#6b7280' }}>{record.user_label || 'Sin usuario'}</span>
                    </div>
                  ),
                },
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
                { id: 'created', header: 'Fecha', render: (record) => formatDateTime(record.created_at) },
                { id: 'props', header: 'Propiedades', render: (record) => <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>{previewJson(record.properties_json)}</pre> },
              ]}
            />
          </SectionCard>
        </>
      )}

      <AdminModalForm
        open={settingOpen}
        title={settingForm.id ? 'Configurar Variable de Sistema' : 'Nueva Configuración Core'}
        description="Asegúrate de que el valor JSON sea válido. Los cambios impactan a toda la arquitectura en tiempo real."
        onClose={() => setSettingOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setSettingOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleSettingSave} disabled={mutating || !settingForm.key} className="btn btn--primary">
              {mutating ? 'Guardando...' : 'Aplicar Cambios'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="form-grid">
            <FieldGroup label="Clave Única" hint="Ej: platform_fees, max_delivery_radius">
              <TextField value={settingForm.key} onChange={(event) => setSettingForm((current) => ({ ...current, key: event.target.value }))} placeholder="platform_key_name" />
            </FieldGroup>
            <FieldGroup label="Meta-Descripción" hint="Uso y alcance de esta variable.">
              <TextField
                value={settingForm.description}
                onChange={(event) => setSettingForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Explica qué controla esta clave..."
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Definición de Valor (JSON)" hint="Estructura de datos que consumirá el backend.">
            <TextAreaField 
              value={settingForm.value_json_text} 
              onChange={(event) => setSettingForm((current) => ({ ...current, value_json_text: event.target.value }))} 
              style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '13px' }}
            />
          </FieldGroup>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
