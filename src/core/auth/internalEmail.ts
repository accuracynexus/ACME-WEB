// Las cuentas internas (negocios, personal, repartidores y admins) las crea el panel
// y pueden usar cualquier correo valido; no se exige un dominio corporativo.
export const INTERNAL_EMAIL_PLACEHOLDER = 'nombre@correo.com';
export const INTERNAL_EMAIL_ERROR = 'Ingresa un correo valido';

export function isInternalEmail(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
