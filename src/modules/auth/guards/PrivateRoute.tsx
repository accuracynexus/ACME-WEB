import { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccessDeniedScreen } from '../../../components/shared/AccessDeniedScreen';
import { LoadingScreen } from '../../../components/shared/LoadingScreen';
import { resolvePortalLandingRoute } from '../../../core/auth/portalLanding';
import { AppRoutes } from '../../../core/constants/routes';
import { PortalContext } from '../session/PortalContext';

export function PrivateRoute() {
  const portal = useContext(PortalContext);
  const location = useLocation();
  const isFirstAccessRoute = location.pathname === AppRoutes.portal.firstAccess;
  const landingRoute = resolvePortalLandingRoute(portal);

  if (portal.isLoading) {
    return <LoadingScreen message="Validando sesion..." />;
  }

  if (!portal.sessionUserId) {
    return <Navigate to={AppRoutes.public.portalLogin} replace />;
  }

  if (portal.mustChangePassword && !isFirstAccessRoute) {
    return <Navigate to={AppRoutes.portal.firstAccess} replace />;
  }

  if (!portal.mustChangePassword && isFirstAccessRoute) {
    return <Navigate to={landingRoute} replace />;
  }

  if (!portal.isAccountActive) {
    const onboardingStatus = portal.accessControl?.onboarding_status ?? null;
    const isPendingReview = onboardingStatus === 'pending_review';

    return (
      <AccessDeniedScreen
        title={isPendingReview ? 'Tu negocio esta en revision' : 'Tu acceso esta desactivado'}
        paragraphs={[
          isPendingReview
            ? 'Tu cuenta ya existe, pero la plataforma todavia no habilita este negocio para operar dentro del admin.'
            : 'La plataforma desactivo temporalmente este acceso. Si necesitas volver a entrar, solicita reactivacion al administrador general.',
          isPendingReview
            ? 'Cuando el equipo valide el alta, tu negocio pasara a estado activo y podras usar el portal normalmente.'
            : 'Mientras tanto, la cuenta puede iniciar sesion tecnicamente, pero el portal no dejara operar hasta que vuelva a estar activa.',
        ]}
        action={{ label: 'Contactar soporte', href: AppRoutes.public.contact }}
      />
    );
  }

  if (!portal.hasPlatformAccess && !portal.hasBusinessAccess && !portal.hasBranchAccess) {
    return (
      <AccessDeniedScreen
        title="Tu cuenta no tiene acceso administrativo"
        paragraphs={[
          'El inicio de sesion fue correcto, pero todavia no tienes un rol de plataforma ni una asignacion de negocio para ingresar al portal.',
          'Puedes registrar tu negocio o solicitar que un administrador te asigne permisos de plataforma, negocio o sucursal.',
        ]}
        action={{ label: 'Ir al registro de negocio', href: AppRoutes.public.businesses }}
      />
    );
  }

  return <Outlet />;
}
