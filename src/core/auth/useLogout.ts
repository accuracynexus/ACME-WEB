import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalContext } from '../../modules/auth/session/PortalContext';
import { AppRoutes } from '../constants/routes';
import { toast } from '../utils/toast';

/**
 * Lógica de cierre de sesión del portal, compartida por el sidebar y el header.
 * Cada consumidor renderiza su propio ConfirmDialog con estos handlers.
 */
export function useLogout() {
  const portal = useContext(PortalContext);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestLogout = () => setConfirmOpen(true);
  const cancelLogout = () => setConfirmOpen(false);

  const confirmLogout = async () => {
    setConfirmOpen(false);
    try {
      await portal.signOut();
      toast.success('Sesión cerrada', 'Hasta pronto.');
      navigate(AppRoutes.public.portalLogin);
    } catch (err: any) {
      toast.error('Error al cerrar sesión', err.message);
    }
  };

  return { confirmOpen, requestLogout, confirmLogout, cancelLogout };
}
