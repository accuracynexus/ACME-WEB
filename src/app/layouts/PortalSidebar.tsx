import { useContext, useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../core/utils/toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PortalContext } from '../../modules/auth/session/PortalContext';
import { AdminModuleSpec } from '../../core/admin/contracts';
import { getEnabledAdminModules } from '../../core/admin/registry/moduleRegistry';
import { getScopeLabel } from '../../core/auth/portalAccess';
import { AppRoutes } from '../../core/constants/routes';

interface PortalSidebarProps {
  onItemClick: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function PortalSidebar({ onItemClick, isMinimized, onToggleMinimize }: PortalSidebarProps) {
  const portal = useContext(PortalContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const enabledModules = getEnabledAdminModules({
    scopeType: portal.currentScopeType,
    hasMerchant: !!portal.currentMerchant,
    hasBranch: !!portal.currentBranch,
  });

  const isNavActive = (path: string) => {
    if (path === AppRoutes.portal.admin.root) {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogoutRequested = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false);
    try {
      await portal.signOut();
      toast.success('Sesión cerrada', 'Hasta pronto.');
      navigate(AppRoutes.public.portalLogin);
    } catch (err: any) {
      toast.error('Error al cerrar sesión', err.message);
    }
  };

  const initials = portal.profile?.full_name
    ? portal.profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A';

  return (
    <aside className="portal-sidebar">
      {/* ——— Brand ——— */}
      <div className="portal-sidebar__brand">
        <div className="portal-sidebar__logo-mark">A</div>

        <div className="portal-sidebar__logo-text">
          <div className="portal-sidebar__logo-name">
            <span>ACME</span>
            <span>Portal</span>
          </div>
          <div className="portal-sidebar__logo-sub">Panel de control</div>
        </div>

        {/* Toggle button — chevron rotates via CSS when minimized */}
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleMinimize}
          title={isMinimized ? 'Expandir menú' : 'Contraer menú'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* ——— Navigation ——— */}
      <nav className="portal-sidebar__nav" aria-label="Menú principal">
        <div className="portal-sidebar__nav-label">
          {getScopeLabel(portal.currentScopeType)}
        </div>

        {enabledModules.map((module) => (
          <Link
            key={module.id}
            to={module.route}
            className={`portal-nav-item ${isNavActive(module.route) ? 'portal-nav-item--active' : ''}`}
            onClick={onItemClick}
            title={isMinimized ? module.label : ''}
          >
            <span className="portal-nav-item__icon">
              <ModuleIcon icon={module.icon} />
            </span>
            <span className="portal-nav-item__label">{module.label}</span>
          </Link>
        ))}
      </nav>

      {/* ——— Footer ——— */}
      <div className="portal-sidebar__footer">
        {/* User card */}
        <div className="portal-user-card" title={isMinimized ? (portal.profile?.full_name || 'Admin') : ''}>
          <div className="portal-user-avatar">{initials}</div>
          <div className="portal-user-info">
            <div className="portal-user-name">{portal.profile?.full_name || 'Administrador'}</div>
            <div className="portal-user-role">{getScopeLabel(portal.currentScopeType)}</div>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogoutRequested}
          className="portal-logout-btn"
          title={isMinimized ? 'Cerrar sesión' : ''}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="portal-logout-btn__text">Cerrar sesión</span>
        </button>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="¿Cerrar sesión?"
        description="Estás a punto de salir de tu cuenta ACME. Asegúrate de haber guardado tus cambios pendientes."
        confirmLabel="Cerrar sesión"
        cancelLabel="Volver"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </aside>
  );
}

/* ——— Module Icons ——————————————————————————————— */
function ModuleIcon({ icon }: { icon?: string }) {
  const props = {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (icon) {
    case 'layout':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'building':
      return (
        <svg {...props}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="9" y1="22" x2="9" y2="2" />
          <line x1="15" y1="22" x2="15" y2="2" />
          <line x1="4" y1="14" x2="20" y2="14" />
          <line x1="4" y1="10" x2="20" y2="10" />
          <line x1="4" y1="6" x2="20" y2="6" />
        </svg>
      );
    case 'shop':
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...props}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'list':
      return (
        <svg {...props}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
    case 'shopping-cart':
      return (
        <svg {...props}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    case 'book-open':
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'truck':
      return (
        <svg {...props}>
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case 'credit-card':
      return (
        <svg {...props}>
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case 'dollar-sign':
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'toggle-right':
      return (
        <svg {...props}>
          <rect x="1" y="5" width="22" height="14" rx="7" />
          <circle cx="16" cy="12" r="3" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'message-circle':
      return (
        <svg {...props}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}
