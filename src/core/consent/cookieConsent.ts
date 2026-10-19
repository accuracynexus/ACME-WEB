import { useEffect, useState } from 'react';

/**
 * Consentimiento de cookies y almacenamiento local.
 *
 * La Ley 29733 y su reglamento (D.S. 016-2024-JUS) piden consentimiento
 * previo, libre, expreso e informado para lo que no es indispensable. Las
 * cookies necesarias (sesion, carrito, pago) no lo requieren, pero hay que
 * informarlas; las de analitica o marketing solo se activan si la persona
 * las acepta. Hoy la web no carga ninguna de estas ultimas: cualquier script
 * nuevo de ese tipo debe esperar a hasCookieConsent('analytics' | 'marketing').
 *
 * Al cambiar las categorias o la politica, sube CONSENT_VERSION: el aviso
 * vuelve a mostrarse y se pide el consentimiento otra vez.
 */
export const CONSENT_VERSION = '2026-10';
const STORAGE_KEY = 'acmeCookieConsent';
const CHANGE_EVENT = 'acme:cookie-consent-change';
const OPEN_EVENT = 'acme:cookie-consent-open';

export type OptionalCookieCategory = 'analytics' | 'marketing';

export interface CookieConsent {
  version: string;
  /** Fecha ISO en que la persona eligio. Sirve como evidencia del consentimiento. */
  decidedAt: string;
  analytics: boolean;
  marketing: boolean;
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(choice: Pick<CookieConsent, OptionalCookieCategory>) {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    analytics: choice.analytics,
    marketing: choice.marketing,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Sin almacenamiento el aviso volvera a salir en la proxima visita; no es grave.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: consent }));
  return consent;
}

export function hasCookieConsent(category: OptionalCookieCategory) {
  return readCookieConsent()?.[category] === true;
}

/** Vuelve a abrir el panel de preferencias (enlace "Configurar cookies"). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readCookieConsent());
  const [settingsRequested, setSettingsRequested] = useState(0);

  useEffect(() => {
    const onChange = () => setConsent(readCookieConsent());
    const onOpen = () => setSettingsRequested((n) => n + 1);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  return { consent, settingsRequested };
}
