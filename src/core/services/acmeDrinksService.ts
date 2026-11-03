import { supabase } from '../../integrations/supabase/client';
import coca600 from '../../images/bebidas/coca_600.jpg';
import coca1500 from '../../images/bebidas/coca_1500.jpg';
import coca2500 from '../../images/bebidas/coca_2500.jpg';
import inka600 from '../../images/bebidas/inka_600.jpg';
import inka1500 from '../../images/bebidas/inka_1500.jpg';
import inka2500 from '../../images/bebidas/inka_2500.jpg';

/**
 * Bebidas estandarizadas de ACME (Inka Kola, Coca Cola...).
 *
 * Se cargan como productos de cada comercio para que el backend las cotice
 * (ver ACME-CLIENT/sql/2026-10-10_bebidas_acme.sql), pero las pone ACME, no el
 * local: el negocio no las prepara, no las ve en su pedido y su precio no
 * entra en lo que ACME le debe. Se reconocen por el prefijo de SKU.
 */
export const ACME_DRINK_SKU_PREFIX = 'ACME-BEB-';

export function isAcmeDrinkSku(sku: string | null | undefined) {
  return String(sku ?? '').toUpperCase().startsWith(ACME_DRINK_SKU_PREFIX);
}

const DRINK_IMAGES: Record<string, Record<string, string>> = {
  coca: { '600': coca600, '1.5': coca1500, '2.5': coca2500 },
  inka: { '600': inka600, '1.5': inka1500, '2.5': inka2500 },
};

/**
 * Foto de una bebida ACME por su nombre ("Inka Kola 1.5 L"). Las filas de la base
 * no traen image_url; las fotos viajan con la app, igual que en ACME-CLIENT.
 */
export function acmeDrinkImage(name: string | null | undefined): string {
  const text = String(name ?? '').toLowerCase();
  const brand = text.includes('coca') ? 'coca' : text.includes('inka') ? 'inka' : '';
  if (!brand) return '';
  const size = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|l)\b/);
  if (!size) return '';
  const value = size[2] === 'ml' ? size[1] : size[1].replace(',', '.');
  return DRINK_IMAGES[brand][value] ?? '';
}

export interface AcmeDrinkSummary {
  /** Suma de line_total de las bebidas ACME del pedido. */
  amount: number;
  /** Ids de order_items que son bebidas ACME. */
  itemIds: Set<string>;
}

/**
 * Bebidas ACME de cada pedido. Dos consultas planas (items y luego SKUs) en
 * vez de un embed, para no depender de que PostgREST conozca la FK.
 */
export async function fetchAcmeDrinksByOrder(orderIds: string[]): Promise<Map<string, AcmeDrinkSummary>> {
  const result = new Map<string, AcmeDrinkSummary>();
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const itemsResult = await supabase.from('order_items').select('id, order_id, product_id, line_total').in('order_id', ids);
  if (itemsResult.error) return result;
  const items = (itemsResult.data ?? []) as Array<{ id: string; order_id: string; product_id: string | null; line_total: number | string | null }>;

  const productIds = Array.from(new Set(items.map((item) => item.product_id).filter(Boolean))) as string[];
  if (productIds.length === 0) return result;

  const productsResult = await supabase.from('products').select('id, sku').in('id', productIds);
  if (productsResult.error) return result;
  const drinkProductIds = new Set(
    ((productsResult.data ?? []) as Array<{ id: string; sku: string | null }>).filter((row) => isAcmeDrinkSku(row.sku)).map((row) => String(row.id))
  );

  for (const item of items) {
    if (!item.product_id || !drinkProductIds.has(String(item.product_id))) continue;
    const key = String(item.order_id);
    const current = result.get(key) ?? { amount: 0, itemIds: new Set<string>() };
    current.amount += Number(item.line_total ?? 0) || 0;
    current.itemIds.add(String(item.id));
    result.set(key, current);
  }

  return result;
}

/** Monto de productos que le corresponde al negocio: sin las bebidas ACME. */
export function merchantProductsAmount(productsAmount: number, drinks?: AcmeDrinkSummary) {
  return Math.max(0, productsAmount - (drinks?.amount ?? 0));
}

/** "Gabriel Isaias Ccansaya Paccori" -> "Gabriel". El negocio solo ve el primer nombre. */
export function firstName(label: string | null | undefined) {
  const clean = String(label ?? '').trim();
  if (!clean || clean.includes('@')) return clean ? clean.split('@')[0] : '';
  return clean.split(/\s+/)[0];
}
