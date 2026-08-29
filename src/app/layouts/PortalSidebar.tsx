import { useContext } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ModuleIcon } from '../../components/admin/ModuleIcon';
import { Link, useLocation } from 'react-router-dom';
import { PortalContext } from '../../modules/auth/session/PortalContext';
import { adminModuleGroups } from '../../core/admin/contracts';
import { getEnabledAdminModules } from '../../core/admin/registry/moduleRegistry';
import { getScopeLabel } from '../../core/auth/portalAccess';
import { useLogout } from '../../core/auth/useLogout';
import { AppRoutes } from '../../core/constants/routes';

interface PortalSidebarProps {
  onItemClick: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function PortalSidebar({ onItemClick, isMinimized, onToggleMinimize }: PortalSidebarProps) {
  const portal = useContext(PortalContext);
  const location = useLocation();
  const logout = useLogout();

  const enabledModules = getEnabledAdminModules({
    scopeType: portal.currentScopeType,
    hasMerchant: !!portal.currentMerchant,
    hasBranch: !!portal.currentBranch,
  });

  const groupedModules = adminModuleGroups
    .map((group) => ({
      group,
      modules: enabledModules.filter((module) => module.group === group.id),
    }))
    .filter((entry) => entry.modules.length > 0);
  const showGroupLabels = groupedModules.length > 1;

  const isNavActive = (path: string) => {
    if (path === AppRoutes.portal.admin.root) {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
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

        {groupedModules.map(({ group, modules }) => (
          <div key={group.id} className="portal-sidebar__group">
            {showGroupLabels ? (
              <>
                <div className="portal-sidebar__group-label">{group.label}</div>
                <div className="portal-sidebar__group-divider" aria-hidden="true" />
              </>
            ) : null}
            {modules.map((module) => (
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
          </div>
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
          onClick={logout.requestLogout}
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
        open={logout.confirmOpen}
        title="¿Cerrar sesión?"
        description="Estás a punto de salir de tu cuenta ACME. Asegúrate de haber guardado tus cambios pendientes."
        confirmLabel="Cerrar sesión"
        cancelLabel="Volver"
        onConfirm={logout.confirmLogout}
        onCancel={logout.cancelLogout}
      />
    </aside>
  );
}
