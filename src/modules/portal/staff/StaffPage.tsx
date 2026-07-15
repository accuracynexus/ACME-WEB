import { useContext, useEffect, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { staffService } from '../../../core/services/staffService';
import { StaffMember } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { toast } from '../../../core/utils/toast';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  manager: 'Gerente',
  cashier: 'Cajero',
  kitchen: 'Cocina',
  delivery: 'Repartidor',
  staff: 'Personal',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  owner: 'status-badge--new',
  manager: 'status-badge--accepted',
  cashier: 'status-badge--ready',
  kitchen: 'status-badge--preparing',
  delivery: 'status-badge--active',
  staff: 'status-badge--completed',
};

// HSL color pick per member ID for avatar gradient
function avatarGradient(id: string) {
  const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const h1 = (seed * 37) % 360;
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1},65%,55%), hsl(${h2},70%,60%))`;
}

function getInitials(member: StaffMember) {
  if (member.full_name) {
    return member.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  }
  return member.email?.[0]?.toUpperCase() ?? 'U';
}

export function StaffPage() {
  const portal = useContext(PortalContext);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  const merchantId = portal.merchant?.id;

  useEffect(() => {
    const load = async () => {
      if (!merchantId) return;
      setLoading(true);
      const result = await staffService.fetchStaffForMerchant(merchantId);
      setLoading(false);
      if (result.error) {
        toast.error('Error al cargar personal', result.error.message);
        return;
      }
      setStaff(result.data ?? []);
    };
    load();
  }, [merchantId]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <UsersSmIcon /> Equipo del negocio
          </span>
          <h1 className="page-header__title">Personal</h1>
          <p className="page-header__desc">
            Listado de empleados y sus roles operativos.
          </p>
        </div>
      </div>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : staff.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><UsersIcon /></div>
            <p className="empty-state__title">Sin personal registrado</p>
            <p className="empty-state__desc">No hay empleados registrados para este comercio todavía.</p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--acme-text-muted)' }}>
              {staff.length} miembro{staff.length !== 1 ? 's' : ''} en el equipo
            </span>
          </div>

          <div className="staff-grid">
            {staff.map((member, i) => (
              <div key={member.id} className="staff-card" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="staff-card__avatar" style={{ background: avatarGradient(member.id ?? member.email ?? String(i)) }}>
                  {getInitials(member)}
                </div>

                <div className="staff-card__body">
                  <div className="staff-card__name">
                    {member.full_name || member.email || 'Sin nombre'}
                  </div>
                  {member.email && member.full_name && (
                    <div className="staff-card__email">{member.email}</div>
                  )}

                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span className={`status-badge ${ROLE_BADGE_CLASS[member.role] ?? 'status-badge--completed'}`}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  </div>

                  {member.branch_ids && member.branch_ids.length > 0 && (
                    <div className="staff-card__branches">
                      <BuildingIcon />
                      {member.branch_ids.length} sucursal{member.branch_ids.length !== 1 ? 'es' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UsersIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function UsersSmIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function BuildingIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
}
