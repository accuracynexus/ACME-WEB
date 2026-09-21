import { useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { resolvePortalLandingRoute } from '../../core/auth/portalLanding';
import { canAccessAdminModule, getScopeLabel } from '../../core/auth/portalAccess';
import { getEnabledAdminModules } from '../../core/admin/registry/moduleRegistry';
import { AppRoutes } from '../../core/constants/routes';
import { PortalContext } from '../../modules/auth/session/PortalContext';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';
import { IncomingOrderAlert } from '../../modules/portal/orders/IncomingOrderAlert';

export function PortalLayout() {
  const portal = useContext(PortalContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('acme-portal-sidebar-minimized') === 'true';
  });

  const toggleMinimize = () => {
    setIsMinimized((prev) => {
      const newState = !prev;
      localStorage.setItem('acme-portal-sidebar-minimized', String(newState));
      return newState;
    });
  };

  const enabledModules = useMemo(
    () =>
      portal.mustChangePassword || !portal.isAccountActive
        ? []
        : getEnabledAdminModules({
            scopeType: portal.currentScopeType,
            hasMerchant: !!portal.currentMerchant,
            hasBranch: !!portal.currentBranch,
          }).filter((module) => canAccessAdminModule(module.id, portal.permissions)),
    [portal.currentScopeType, portal.currentMerchant, portal.currentBranch, portal.permissions, portal.mustChangePassword, portal.isAccountActive]
  );
  const landingRoute = useMemo(
    () => resolvePortalLandingRoute(portal),
    [portal.currentScopeType, portal.currentMerchant, portal.currentBranch, portal.permissions]
  );

  const isBusinessScope = portal.currentScopeType === 'business';
  const isBranchScope = portal.currentScopeType === 'branch';
  const showMerchantSelector = (isBusinessScope || isBranchScope) && portal.businessAssignments.length > 0;
  const showBranchSelector = isBranchScope && !!portal.currentMerchant && portal.branches.length > 0;
  const needsMerchantSelection = (isBusinessScope || isBranchScope) && !portal.currentMerchant && portal.businessAssignments.length > 0;
  const needsBranchSelection = isBranchScope && !!portal.currentMerchant && !portal.currentBranch && portal.branches.length > 0;

  useEffect(() => {
    if (location.pathname === AppRoutes.portal.dashboard && landingRoute !== AppRoutes.portal.dashboard) {
      navigate(landingRoute, { replace: true });
      return;
    }

    if (!location.pathname.startsWith(AppRoutes.portal.admin.root) || location.pathname === AppRoutes.portal.admin.root) {
      return;
    }

    const isAllowed = enabledModules.some((module) => location.pathname === module.route || location.pathname.startsWith(`${module.route}/`));
    if (!isAllowed) {
      navigate(landingRoute, { replace: true });
    }
  }, [enabledModules, landingRoute, location.pathname, navigate]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const hasContextBar = showMerchantSelector || showBranchSelector || portal.availableScopeTypes.length > 1;

  return (
    <div className={`portal-shell ${sidebarOpen ? 'portal-shell--sidebarOpen' : ''} ${isMinimized ? 'portal-shell--minimized' : ''}`}>
      {/* Mobile overlay */}
      <div className="portal-overlay" onClick={closeSidebar} />

      {/* Sidebar */}
      <PortalSidebar onItemClick={closeSidebar} isMinimized={isMinimized} onToggleMinimize={toggleMinimize} />

      {/* Main area */}
      <div className="portal-main-area">
        {/* Top header */}
        <PortalHeader onMenuClick={toggleSidebar} />

        {/* Context bar: scope / merchant / branch selectors */}
        {hasContextBar && (
          <div className="portal-context-bar">
            {portal.availableScopeTypes.length > 1 && (
              <div className="portal-context-bar__scope-pills">
                {portal.availableScopeTypes.map((scopeType) => (
                  <button
                    key={scopeType}
                    type="button"
                    onClick={() => portal.setCurrentScopeType(scopeType)}
                    className={`portal-context-bar__scope-btn ${portal.currentScopeType === scopeType ? 'portal-context-bar__scope-btn--active' : ''}`}
                  >
                    {getScopeLabel(scopeType)}
                  </button>
                ))}
              </div>
            )}

            {(showMerchantSelector || showBranchSelector) && portal.availableScopeTypes.length > 1 && (
              <div className="portal-context-bar__divider" />
            )}

            {showMerchantSelector && (
              <select
                value={portal.currentMerchant?.id ?? ''}
                onChange={(e) => portal.setCurrentMerchantId(e.target.value)}
                className="portal-context-select"
              >
                <option value="">Selecciona un negocio</option>
                {portal.businessAssignments.map((assignment) => (
                  <option key={assignment.merchant.id} value={assignment.merchant.id}>
                    {assignment.merchant.name}
                  </option>
                ))}
              </select>
            )}

            {showBranchSelector && (
              <select
                value={portal.currentBranch?.id ?? ''}
                onChange={(e) => portal.setCurrentBranchId(e.target.value)}
                className="portal-context-select"
              >
                <option value="">Selecciona una sucursal</option>
                {portal.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Scrollable content area */}
        <div className="portal-scroll-area">
          <main className="portal-content">
            {needsMerchantSelection ? (
              <section className="portal-emptyState">
                <strong>Selecciona un negocio para continuar</strong>
                <span>
                  En capa {getScopeLabel(portal.currentScopeType).toLowerCase()} debes elegir un comercio desde el selector superior antes de acceder a los módulos.
                </span>
              </section>
            ) : null}

            {needsBranchSelection ? (
              <section className="portal-emptyState">
                <strong>Selecciona una sucursal</strong>
                <span>Esta capa necesita una sucursal operativa antes de mostrar pedidos, turno y estado local.</span>
              </section>
            ) : null}

            {!needsMerchantSelection && !needsBranchSelection && <Outlet />}
          </main>
        </div>
      </div>

      {/* Va al final y por encima de todo: el local tiene que ver el pedido
          esté en el módulo que esté. */}
      <IncomingOrderAlert />
    </div>
  );
}
