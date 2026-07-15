import { useContext, useEffect, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { branchService } from '../../../core/services/branchService';
import { BranchHour } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { toast } from '../../../core/utils/toast';

const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const WEEKDAY_FULL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export function HoursPage() {
  const portal = useContext(PortalContext);
  const [hours, setHours] = useState<BranchHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const branchId = portal.currentBranch?.id;

  useEffect(() => {
    const load = async () => {
      if (!branchId) return;
      setLoading(true);
      const result = await branchService.fetchBranchHours(branchId);
      setLoading(false);
      if (result.error) {
        toast.error('Error al cargar horarios', result.error.message);
        return;
      }
      setHours((result.data ?? []).sort((a, b) => a.weekday - b.weekday));
    };
    load();
  }, [branchId]);

  const updateHour = async (hourId: string, weekday: number, payload: Partial<BranchHour>) => {
    setSavingId(hourId);
    const result = await branchService.updateBranchHour(hourId, payload);
    setSavingId(null);
    if (result.error) {
      toast.error('Error al guardar', result.error.message);
      return;
    }
    toast.success(`${WEEKDAY_FULL[weekday]} actualizado`);
    setHours((curr) => curr.map((h) => (h.id === hourId ? { ...h, ...payload } : h)));
  };

  if (!branchId) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><ClockIcon /></div>
        <p className="empty-state__title">Sin sucursal seleccionada</p>
        <p className="empty-state__desc">Selecciona una sucursal para gestionar sus horarios de atención.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <ClockSmIcon /> Configuración de sucursal
          </span>
          <h1 className="page-header__title">Horarios</h1>
          <p className="page-header__desc">Define apertura y cierre para cada día de la semana. Los cambios se guardan automáticamente al cambiar el campo.</p>
        </div>
      </div>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : hours.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><ClockIcon /></div>
            <p className="empty-state__title">Sin horarios definidos</p>
            <p className="empty-state__desc">No hay horarios configurados para esta sucursal todavía.</p>
          </div>
        </div>
      ) : (
        <div className="hours-grid">
          {hours.map((hour, i) => {
            const isSaving = savingId === hour.id;
            return (
              <div key={hour.id} className="hour-card" style={{ animationDelay: `${i * 40}ms` }}>
                {/* Day header */}
                <div className="hour-card__day">
                  <span className="hour-card__day-abbr">{WEEKDAY_NAMES[hour.weekday]}</span>
                  <span className="hour-card__day-full">{WEEKDAY_FULL[hour.weekday] ?? `Día ${hour.weekday}`}</span>
                  {isSaving && (
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--acme-purple)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <SpinnerIcon /> Guardando
                    </span>
                  )}
                </div>

                {/* Times */}
                <div className="hour-card__times">
                  <label className="hour-input-group">
                    <span className="hour-input-group__label">
                      <SunriseIcon /> Apertura
                    </span>
                    <input
                      type="time"
                      className="hour-input"
                      value={hour.open_time}
                      onChange={(e) => updateHour(hour.id, hour.weekday, { open_time: e.target.value })}
                      disabled={isSaving}
                    />
                  </label>
                  <label className="hour-input-group">
                    <span className="hour-input-group__label">
                      <MoonIcon /> Cierre
                    </span>
                    <input
                      type="time"
                      className="hour-input"
                      value={hour.close_time}
                      onChange={(e) => updateHour(hour.id, hour.weekday, { close_time: e.target.value })}
                      disabled={isSaving}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ——— Icons ——— */
function ClockIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function ClockSmIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function SunriseIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/></svg>;
}
function MoonIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function SpinnerIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>;
}
