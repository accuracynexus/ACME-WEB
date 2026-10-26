import { createContext, useContext } from 'react';

/**
 * Oferta de promocion para los locales: un modal al iniciar sesion que les
 * propone aparecer destacados en la app de clientes y los manda al WhatsApp
 * de ACME Pedidos. Al cerrarlo queda como "Solicitar promocion" en el menu.
 */

/**
 * WhatsApp comercial de ACME Pedidos, en formato internacional sin "+".
 * Se puede cambiar sin tocar codigo con VITE_ACME_WHATSAPP_NUMBER en el .env.
 */
export const ACME_WHATSAPP_NUMBER = String(import.meta.env.VITE_ACME_WHATSAPP_NUMBER ?? '').replace(/\D/g, '') || '51968797070';

export type PromoOptionId = 'business' | 'products' | 'season';

export interface PromoOption {
  id: PromoOptionId;
  title: string;
  description: string;
  /** Como se nombra la opcion dentro del mensaje de WhatsApp. */
  messageLabel: string;
}

export const PROMO_OPTIONS: PromoOption[] = [
  {
    id: 'business',
    title: 'Destaca tu negocio',
    description: 'Tu local en la portada de la app y entre los primeros de tu categoría.',
    messageLabel: 'destacar mi negocio en la app',
  },
  {
    id: 'products',
    title: 'Promociona tus productos',
    description: 'Tus platos estrella en la sección de ofertas, con precio especial o en combo.',
    messageLabel: 'promocionar mis productos en la app',
  },
  {
    id: 'season',
    title: 'Campañas de temporada',
    description: 'Fechas especiales con más pedidos: armamos la campaña contigo.',
    messageLabel: 'una campaña de temporada',
  },
];

/** Fechas fuertes de venta en Peru. month es 1-12. */
const SEASONS: Array<{ month: number; day: number; name: string }> = [
  { month: 2, day: 14, name: 'San Valentín' },
  { month: 5, day: 11, name: 'Día de la Madre' },
  { month: 6, day: 15, name: 'Día del Padre' },
  { month: 7, day: 28, name: 'Fiestas Patrias' },
  { month: 10, day: 31, name: 'Halloween y Canción Criolla' },
  { month: 12, day: 25, name: 'Navidad' },
  { month: 12, day: 31, name: 'Año Nuevo' },
];

/** Las dos proximas temporadas a partir de hoy, para sugerirlas en el modal. */
export function getUpcomingSeasons(today = new Date(), count = 2) {
  const year = today.getFullYear();
  const start = new Date(year, today.getMonth(), today.getDate()).getTime();
  return [...SEASONS.map((s) => ({ ...s, date: new Date(year, s.month - 1, s.day) })), ...SEASONS.map((s) => ({ ...s, date: new Date(year + 1, s.month - 1, s.day) }))]
    .filter((s) => s.date.getTime() >= start)
    .slice(0, count)
    .map((s) => ({
      name: s.name,
      when: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long' }).format(s.date),
    }));
}

export function buildWhatsAppLink(merchantName: string, option: PromoOption, seasonName?: string) {
  const negocio = merchantName ? `*${merchantName}*` : 'un negocio de la app';
  const detalle = option.id === 'season' && seasonName ? `${option.messageLabel} para ${seasonName}` : option.messageLabel;
  const text = `Hola ACME Pedidos 👋 Les escribo de ${negocio}. Me interesa ${detalle}. ¿Me cuentan las opciones?`;
  return `https://wa.me/${ACME_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

// ── Persistencia ─────────────────────────────────────────────────────────
// localStorage/sessionStorage pueden fallar (modo privado, sitio bloqueado):
// en ese caso el modal se comporta como si fuera la primera vez.

const SAVED_KEY = (userId: string) => `acme.promoOffer.saved.${userId}`;
const SHOWN_KEY = (userId: string) => `acme.promoOffer.shown.${userId}`;

export function isPromoSaved(userId: string) {
  try {
    return localStorage.getItem(SAVED_KEY(userId)) === '1';
  } catch {
    return false;
  }
}

export function markPromoSaved(userId: string) {
  try {
    localStorage.setItem(SAVED_KEY(userId), '1');
  } catch {
    /* sin almacenamiento: el item del menu aparece igual durante la sesion */
  }
}

/** Una vez por sesion del navegador: al iniciar sesion, no en cada recarga. */
export function wasShownThisSession(userId: string) {
  try {
    return sessionStorage.getItem(SHOWN_KEY(userId)) === '1';
  } catch {
    return false;
  }
}

export function markShownThisSession(userId: string) {
  try {
    sessionStorage.setItem(SHOWN_KEY(userId), '1');
  } catch {
    /* ignorar */
  }
}

// ── Contexto compartido entre el layout y el menu lateral ────────────────

export interface PromoOfferState {
  /** El usuario es administrador de un local (no el admin general). */
  eligible: boolean;
  /** Ya cerro el modal alguna vez: se muestra el item del menu. */
  saved: boolean;
  /** Recien guardado: el item del menu se resalta un momento. */
  justSaved: boolean;
  open: () => void;
}

export const PromoOfferContext = createContext<PromoOfferState>({
  eligible: false,
  saved: false,
  justSaved: false,
  open: () => {},
});

export const usePromoOffer = () => useContext(PromoOfferContext);
