/**
 * Reglas para guardar un producto: validar antes de tocar la base y traducir
 * sus errores. Vive aparte de adminService para poder probarlo sin conexion.
 */

export interface ProductFormToCheck {
  name: string;
  base_price: string;
  packaging_cost: string;
  image_url: string;
  branch_settings: Array<{ branch_name: string; price_override: string }>;
}

const MAX_PRICE = 100000;
/** Un taper o una caja no cuesta mas que esto; un monto mayor es casi seguro un error de tipeo. */
const MAX_PACKAGING = 100;

/** Devuelve el primer problema en palabras del usuario, o null si esta bien. */
export function validateProductForm(form: ProductFormToCheck): string | null {
  if (form.name.trim().length < 2) return 'Escribe el nombre del producto.';

  const priceText = String(form.base_price ?? '').trim();
  if (!priceText) return 'Escribe el precio.';
  const price = Number(priceText);
  if (!Number.isFinite(price)) return 'El precio no es valido.';
  if (price < 0) return 'El precio no puede ser negativo.';
  if (price > MAX_PRICE) return 'Revisa el precio: es demasiado alto.';

  // El empaque es opcional: vacio cuenta como 0.
  const packagingText = String(form.packaging_cost ?? '').trim();
  if (packagingText) {
    const packaging = Number(packagingText);
    if (!Number.isFinite(packaging)) return 'El costo de empaque no es valido.';
    if (packaging < 0) return 'El costo de empaque no puede ser negativo.';
    if (packaging > MAX_PACKAGING) return 'Revisa el costo de empaque: es demasiado alto.';
  }

  const image = form.image_url.trim();
  if (image && !/^https?:\/\//i.test(image)) return 'La URL de la imagen debe empezar con https://';

  for (const setting of form.branch_settings) {
    const text = setting.price_override.trim();
    if (!text) continue;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
      return `El precio de ${setting.branch_name || 'la sucursal'} no es valido.`;
    }
  }

  return null;
}

/** Dos decimales, como en la columna numeric. */
export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Errores de Postgres / PostgREST en palabras que se entienden. */
export function friendlyProductError(error: { code?: string; message?: string } | null | undefined): string {
  const message = String(error?.message ?? '');
  const code = String(error?.code ?? '');

  if (code === '23505' || /duplicate key|ux_products_merchant_name_sku/i.test(message)) {
    return 'Ya tienes un producto con ese nombre y ese SKU. Cambia el nombre o el SKU.';
  }
  if (/packaging_cost/i.test(message)) {
    // Columna ausente (migracion sin aplicar) o regla de >= 0.
    return /does not exist|schema cache|could not find/i.test(message)
      ? 'Falta activar el costo de empaque en la base de datos. Avisa al equipo tecnico.'
      : 'El costo de empaque no puede ser negativo.';
  }
  if (code === '23514' || /products_base_price_check/i.test(message)) return 'El precio no puede ser negativo.';
  if (code === '23503' || /foreign key/i.test(message)) return 'La categoria elegida ya no existe. Elige otra.';
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'No tienes permiso para guardar este producto.';
  }
  if (code === 'PGRST116' || /coerce the result to a single/i.test(message)) {
    return 'No se pudo guardar: el producto ya no existe o no tienes permiso para cambiarlo.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Sin conexion. Revisa tu internet e intenta de nuevo.';
  return message || 'No se pudo guardar el producto.';
}

/**
 * Ruta de un archivo dentro del bucket a partir de su URL publica, o null si la
 * URL no es de ese bucket (por ejemplo, una foto externa que nunca se borra).
 */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  const prefix = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(prefix);
  if (index === -1) return null;
  const path = decodeURIComponent(url.slice(index + prefix.length).split('?')[0]);
  return path || null;
}
