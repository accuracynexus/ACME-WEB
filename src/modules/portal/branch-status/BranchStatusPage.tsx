import { useContext, useEffect, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { branchService } from '../../../core/services/branchService';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { toast } from '../../../core/utils/toast';

interface BranchStatus {
  is_open: boolean;
  accepting_orders: boolean;
  pause_reason?: string;
}

export function BranchStatusPage() {
  const portal = useContext(PortalContext);
  const [status, setStatus] = useState<BranchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState('');

  const branchId = portal.currentBranch?.id;

  useEffect(() => {
    const load = async () => {
      if (!branchId) return;
      setLoading(true);
      const result = await branchService.fetchBranchStatus(branchId);
      setLoading(false);
      if (result.error) {
        toast.error('Error al cargar estado del local', result.error.message);
        return;
      }
      const s = result.data ?? null;
      setStatus(s);
      setPauseReason(s?.pause_reason ?? '');
    };
    load();
  }, [branchId]);

  const updateStatus = async (key: string, payload: Partial<BranchStatus>, successMsg: string) => {
    if (!branchId) return;
    setSaving(key);
    const result = await branchService.updateBranchStatus(branchId, payload);
    setSaving(null);
    if (result.error) {
      toast.error('Error al actualizar', result.error.message);
      return;
    }
    setStatus((curr) => curr ? { ...curr, ...payload } : null);
    toast.success(successMsg);
  };

  if (!branchId) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><StoreIcon /></div>
        <p className="empty-state__title">Sin sucursal seleccionada</p>
        <p className="empty-state__desc">Selecciona una sucursal para controlar su estado operativo.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <ToggleIcon /> Operaciones de sucursal
          </span>
          <h1 className="page-header__title">Estado del local</h1>
          <p className="page-header__desc">
            Controla si{' '}
            <strong style={{ color: 'var(--acme-purple)', fontWeight: 800 }}>
              {portal.currentBranch?.name}
            </strong>{' '}
            está abierto y si acepta pedidos en este momento.
          </p>
        </div>
      </div>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : !status ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><StoreIcon /></div>
            <p className="empty-state__title">Sin datos de estado</p>
            <p className="empty-state__desc">No se encontró configuración de estado para esta sucursal.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>

          {/* Is open */}
          <div className="section-card">
            <div className="section-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: 'var(--acme-radius-lg)',
                  background: status.is_open ? 'var(--acme-green-light)' : 'var(--acme-red-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: status.is_open ? 'var(--acme-green)' : 'var(--acme-red)',
                  flexShrink: 0,
                  boxShadow: status.is_open ? '0 4px 12px rgba(16,185,129,0.18)' : '0 4px 12px rgba(239,68,68,0.12)',
                }}>
                  <DoorIcon />
                </div>
                <div>
                  <h2 className="section-card__title">Apertura del local</h2>
                  <p className="section-card__subtitle">Define si el local está operativamente abierto hoy</p>
                </div>
              </div>
              <span className={`status-badge ${status.is_open ? 'status-badge--ready' : 'status-badge--inactive'}`}>
                <span className="status-badge__dot" />
                {status.is_open ? 'Abierto' : 'Cerrado'}
              </span>
            </div>
            <button
              className={`btn ${status.is_open ? 'btn--danger' : 'btn--success'}`}
              disabled={saving === 'open'}
              onClick={() => updateStatus('open', { is_open: !status.is_open }, status.is_open ? 'Local cerrado' : 'Local abierto')}
              style={{ width: 'fit-content' }}
            >
              {saving === 'open' ? (
                <><SpinnerIcon /> Actualizando...</>
              ) : status.is_open ? (
                <><LockIcon /> Cerrar local</>
              ) : (
                <><UnlockIcon /> Abrir local</>
              )}
            </button>
          </div>

          {/* Accepting orders */}
          <div className="section-card">
            <div className="section-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: 'var(--acme-radius-lg)',
                  background: status.accepting_orders ? 'var(--acme-green-light)' : 'var(--acme-yellow-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: status.accepting_orders ? 'var(--acme-green)' : 'var(--acme-yellow)',
                  flexShrink: 0,
                  boxShadow: status.accepting_orders ? '0 4px 12px rgba(16,185,129,0.18)' : '0 4px 12px rgba(245,158,11,0.15)',
                }}>
                  <CartIcon />
                </div>
                <div>
                  <h2 className="section-card__title">Recepción de pedidos</h2>
                  <p className="section-card__subtitle">Activa o pausa la llegada de nuevos pedidos</p>
                </div>
              </div>
              <span className={`status-badge ${status.accepting_orders ? 'status-badge--ready' : 'status-badge--paused'}`}>
                <span className="status-badge__dot" />
                {status.accepting_orders ? 'Recibiendo' : 'En pausa'}
              </span>
            </div>
            <button
              className={`btn ${status.accepting_orders ? 'btn--secondary' : 'btn--primary'}`}
              disabled={saving === 'orders'}
              onClick={() => updateStatus('orders', { accepting_orders: !status.accepting_orders }, status.accepting_orders ? 'Recepción pausada' : 'Recepción activada')}
              style={{ width: 'fit-content' }}
            >
              {saving === 'orders' ? (
                <><SpinnerIcon /> Actualizando...</>
              ) : status.accepting_orders ? (
                <><PauseIcon /> Pausar recepción</>
              ) : (
                <><PlayIcon /> Activar recepción</>
              )}
            </button>
          </div>

          {/* Pause reason */}
          <div className="section-card">
            <div className="section-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: 'var(--acme-radius-lg)',
                  background: 'var(--acme-surface-muted)', border: '1px solid var(--acme-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--acme-text-muted)', flexShrink: 0,
                }}>
                  <NoteIcon />
                </div>
                <div>
                  <h2 className="section-card__title">Motivo de cierre / pausa</h2>
                  <p className="section-card__subtitle">Visible internamente para el equipo de operaciones</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                rows={3}
                placeholder="Ej: Cierre por mantenimiento de cocina, festivo local, etc."
                style={{
                  width: '100%', padding: '12px 14px',
                  borderRadius: 'var(--acme-radius-md)',
                  border: '1px solid var(--acme-border)',
                  background: 'var(--acme-surface-muted)',
                  fontSize: '14px', color: 'var(--acme-text)',
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(77,20,140,0.3)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(77,20,140,0.08)';
                  e.target.style.background = 'var(--acme-surface)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--acme-border)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'var(--acme-surface-muted)';
                }}
              />
              <button
                className="btn btn--secondary"
                disabled={saving === 'reason'}
                onClick={() => updateStatus('reason', { pause_reason: pauseReason }, 'Motivo guardado')}
                style={{ width: 'fit-content' }}
              >
                {saving === 'reason' ? <><SpinnerIcon /> Guardando...</> : <><SaveIcon /> Guardar motivo</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function DoorIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function CartIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
}
function NoteIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function LockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
}
function UnlockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
}
function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function SaveIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
}
function SpinnerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>;
}
function ToggleIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/></svg>;
}
