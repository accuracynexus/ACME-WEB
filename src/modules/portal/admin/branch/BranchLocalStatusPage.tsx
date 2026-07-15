import { useContext, useEffect, useMemo, useState } from 'react';
import { CheckboxField, FieldGroup, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminBranchOperationsService, BranchLocalStatusOverview } from '../../../../core/services/adminBranchOperationsService';
import { PortalContext } from '../../../auth/session/PortalContext';

const weekdayLabels = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

export function BranchLocalStatusPage() {
  const portal = useContext(PortalContext);
  const branchId = portal.currentBranch?.id;
  const [overview, setOverview] = useState<BranchLocalStatusOverview | null>(null);
  const [form, setForm] = useState<BranchLocalStatusOverview['status'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    const result = await adminBranchOperationsService.fetchLocalStatusOverview(branchId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setOverview(result.data ?? null);
    setForm(result.data?.status ?? null);
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  const dirty = useMemo(() => {
    if (!overview || !form) return false;
    return JSON.stringify(overview.status) !== JSON.stringify(form);
  }, [form, overview]);

  const handleSave = async () => {
    if (!branchId || !form) return;
    setSaving(true);
    setError(null);
    const result = await adminBranchOperationsService.updateBranchStatus(branchId, form);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Estado del local actualizado');
    await loadData();
  };

  if (!branchId) {
    return <div>No hay sucursal activa para operar el local.</div>;
  }

  if (portal.currentScopeType !== 'branch') {
    return <div>Esta vista pertenece a la capa sucursal.</div>;
  }

  return (
    <AdminPageFrame
      title="Estado del local"
      description="Control operativo rapido de apertura, recepcion de pedidos y lectura del horario de la sucursal."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Estado del local' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentBranch?.name || 'sin sucursal', tone: 'neutral' },
        { label: 'Modo', value: 'Operacion del local', tone: 'warning' },
      ]}
    >
      {loading ? (
        <SectionSkeleton lines={5} />
      ) : !overview || !form ? (
        <div>No se pudo cargar el estado del local.</div>
      ) : (
        <>
          <FormStatusBar dirty={dirty} saving={saving} error={error} successMessage={successMessage} />

          <SectionCard title="Control inmediato" description="Gestiona la visibilidad y recepción de pedidos en tiempo real para esta sucursal.">
            <div className="form-grid" style={{ marginBottom: '24px' }}>
              <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setForm(c => c ? {...c, is_open: !c.is_open} : c)}>
                <CheckboxField label="Sucursal abierta al público" checked={form.is_open} onChange={() => {}} />
              </div>
              <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setForm(c => c ? {...c, accepting_orders: !c.accepting_orders} : c)}>
                <CheckboxField label="Recibiendo nuevos pedidos" checked={form.accepting_orders} onChange={() => {}} />
              </div>
            </div>
            
            <FieldGroup label="Observación operativa / Motivo de pausa" hint="Este mensaje será visible si la sucursal está cerrada o pausada.">
              <TextAreaField 
                value={form.pause_reason} 
                onChange={(event) => setForm((current) => (current ? { ...current, pause_reason: event.target.value } : current))}
                placeholder="Ej: Estamos en mantenimiento de cocina..."
              />
            </FieldGroup>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
              <button type="button" onClick={handleSave} disabled={!dirty || saving} className="btn btn--primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                {saving ? 'Actualizando...' : 'Actualizar estado'}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <StatusPill label={form.is_open ? 'ABIERTA' : 'CERRADA'} tone={form.is_open ? 'success' : 'danger'} />
                <StatusPill label={form.accepting_orders ? 'RECIBIENDO' : 'PAUSADA'} tone={form.accepting_orders ? 'info' : 'warning'} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Horario operativo" description="La sucursal ve el horario cargado para entender el turno y revisar si hay cierres programados.">
            <AdminDataTable
              rows={overview.hours}
              getRowId={(record) => record.id}
              emptyMessage="No hay horarios cargados para esta sucursal."
              columns={[
                { id: 'day', header: 'Dia', render: (record) => weekdayLabels[record.weekday] || `Dia ${record.weekday}` },
                { id: 'open', header: 'Apertura', render: (record) => record.open_time },
                { id: 'close', header: 'Cierre', render: (record) => record.close_time },
              ]}
            />
          </SectionCard>

          <SectionCard title="Cierres y cobertura" description="Información clave para entender la disponibilidad de reparto y bloqueos temporales.">
            <div className="stat-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card">
                <div className="stat-card__badge" style={{ background: 'var(--acme-purple)' }} />
                <div className="stat-card__header">
                  <span className="stat-card__label">Zonas de reparto</span>
                  <div className="stat-card__icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                </div>
                <strong className="stat-card__value">{overview.coverage_count}</strong>
                <p className="stat-card__help">Zonas activas en el mapa</p>
              </div>
              <div className="stat-card">
                <div className="stat-card__badge" style={{ background: 'var(--acme-red)' }} />
                <div className="stat-card__header">
                  <span className="stat-card__label">Cierres programados</span>
                  <div className="stat-card__icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  </div>
                </div>
                <strong className="stat-card__value">{overview.closures.length}</strong>
                <p className="stat-card__help">Fechas especiales de cierre</p>
              </div>
            </div>
            
            <AdminDataTable
              rows={overview.closures}
              getRowId={(record) => record.id || `${record.starts_at}-${record.ends_at}`}
              emptyMessage="No hay cierres especiales registrados."
              columns={[
                { 
                  id: 'period', 
                  header: 'Período de cierre', 
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 600 }}>{formatDateTime(record.starts_at)}</span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>hasta {formatDateTime(record.ends_at)}</span>
                    </div>
                  )
                },
                { 
                  id: 'reason', 
                  header: 'Motivo', 
                  render: (record) => (
                    <span style={{ color: 'var(--acme-text-muted)', fontSize: '14px' }}>{record.reason || 'Sin motivo especificado'}</span>
                  )
                },
                {
                  id: 'status',
                  header: 'Estado',
                  render: (record) => {
                    const now = new Date();
                    const start = new Date(record.starts_at);
                    const end = new Date(record.ends_at);
                    const isActive = now >= start && now <= end;
                    return <StatusPill label={isActive ? 'ACTIVO AHORA' : 'PROGRAMADO'} tone={isActive ? 'danger' : 'neutral'} />;
                  }
                }
              ]}
            />
          </SectionCard>
        </>
      )}
    </AdminPageFrame>
  );
}
