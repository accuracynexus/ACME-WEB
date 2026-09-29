// Negocios, personal, repartidores y admins inician sesion con un correo corporativo.
// Los clientes de la tienda pueden usar cualquier correo.
export const INTERNAL_EMAIL_DOMAIN = 'acmedidos.com';
export const INTERNAL_EMAIL_PLACEHOLDER = `nombre@${INTERNAL_EMAIL_DOMAIN}`;
export const INTERNAL_EMAIL_ERROR = `El correo debe terminar en @${INTERNAL_EMAIL_DOMAIN}`;

export function isInternalEmail(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}
