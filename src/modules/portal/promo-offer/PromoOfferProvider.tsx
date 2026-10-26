import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { PortalContext } from '../../auth/session/PortalContext';
import { toast } from '../../../core/utils/toast';
import { isPromoSaved, markPromoSaved, markShownThisSession, PromoOfferContext, wasShownThisSession } from './promoOffer';
import { PromoOfferModal } from './PromoOfferModal';

/** Pausa tras entrar al portal: que primero se vea el panel y luego el modal. */
const OPEN_DELAY_MS = 900;

/**
 * Decide cuando mostrar el modal de promocion y comparte su estado con el
 * menu lateral. Solo para administradores de un local: el admin general no
 * se promociona a si mismo.
 */
export function PromoOfferProvider({ children }: { children: ReactNode }) {
  const portal = useContext(PortalContext);
  const userId = portal.sessionUserId ?? '';
  const merchantName = portal.currentMerchant?.name ?? '';

  const eligible = Boolean(
    userId &&
      portal.isAccountActive &&
      !portal.mustChangePassword &&
      !portal.permissions.canAccessPlatform &&
      portal.currentMerchant &&
      (portal.currentScopeType === 'business' || portal.currentScopeType === 'branch')
  );

  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setSaved(userId ? isPromoSaved(userId) : false);
  }, [userId]);

  // Al iniciar sesion: una vez por sesion del navegador.
  useEffect(() => {
    if (!eligible || wasShownThisSession(userId)) return;
    const timer = window.setTimeout(() => {
      markShownThisSession(userId);
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, userId]);

  const handleClose = () => {
    setOpen(false);
    if (!saved) {
      markPromoSaved(userId);
      setSaved(true);
      setJustSaved(true);
      toast.info('Lo guardamos en tu menú', 'Encuéntralo cuando quieras en “Solicitar promoción”.');
      window.setTimeout(() => setJustSaved(false), 4000);
    }
  };

  const value = useMemo(
    () => ({ eligible, saved: eligible && saved, justSaved, open: () => setOpen(true) }),
    [eligible, saved, justSaved]
  );

  return (
    <PromoOfferContext.Provider value={value}>
      {children}
      {eligible && open ? <PromoOfferModal merchantName={merchantName} onClose={handleClose} /> : null}
    </PromoOfferContext.Provider>
  );
}
