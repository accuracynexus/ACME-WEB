import { supabase } from '../../integrations/supabase/client';

export interface PublicMarketplaceModifierOption {
  id: string;
  name: string;
  price_delta: number;
}

export interface PublicMarketplaceModifierGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  options: PublicMarketplaceModifierOption[];
}

export interface PublicMarketplaceProductSetting {
  branch_id: string;
  price: number;
  is_available: boolean;
  is_paused: boolean;
  stock_qty: number | null;
}

export interface PublicMarketplaceProduct {
  id: string;
  merchant_id: string;
  category_id: string;
  name: string;
  description: string;
  base_price: number;
  image_url: string;
  sort_order: number;
  settings: PublicMarketplaceProductSetting[];
  modifier_groups: PublicMarketplaceModifierGroup[];
}

export interface PublicMarketplaceCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface PublicMarketplaceBranch {
  id: string;
  merchant_id: string;
  name: string;
  phone: string;
  prep_time_avg_min: number;
  accepts_orders: boolean;
  address_label: string;
  district: string;
  city: string;
  is_open: boolean;
  accepting_orders: boolean;
  status_code: string;
}

export interface PublicMarketplaceMerchant {
  id: string;
  trade_name: string;
  logo_url: string;
  status: string;
  branches: PublicMarketplaceBranch[];
  categories: PublicMarketplaceCategory[];
  products: PublicMarketplaceProduct[];
  featured_product_names: string[];
}

export interface PublicMarketplacePaymentMethod {
  id: string;
  code: string;
  name: string;
  is_online: boolean;
}

export interface PublicMarketplaceSnapshot {
  merchants: PublicMarketplaceMerchant[];
  payment_methods: PublicMarketplacePaymentMethod[];
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface PublicBrandLogo {
  id: string;
  trade_name: string;
  logo_url: string;
}

export const publicMarketplaceService = {
  // Lightweight list of active merchants that have a logo, for the home brands strip.
  fetchBrandLogos: async (): Promise<{ data: PublicBrandLogo[]; error: unknown }> => {
    const [merchantsResult, branchesResult] = await Promise.all([
      supabase.from('merchants').select('id, trade_name, logo_url, status').order('trade_name', { ascending: true }),
      supabase.from('merchant_branches').select('merchant_id, status'),
    ]);

    if (merchantsResult.error) return { data: [], error: merchantsResult.error };
    if (branchesResult.error) return { data: [], error: branchesResult.error };

    // Un negocio puede estar "active" pero tener su única sucursal desactivada
    // (ej: locales de prueba). En ese caso no debe aparecer en la franja.
    const merchantsWithBranch = new Set<string>();
    const merchantsWithActiveBranch = new Set<string>();
    for (const branch of (branchesResult.data ?? []) as any[]) {
      const mid = stringOrEmpty(branch.merchant_id);
      merchantsWithBranch.add(mid);
      if (stringOrEmpty(branch.status) !== 'inactive') merchantsWithActiveBranch.add(mid);
    }

    const brands = ((merchantsResult.data ?? []) as any[])
      .filter((merchant) => {
        const id = stringOrEmpty(merchant.id);
        if (stringOrEmpty(merchant.status) === 'inactive') return false;
        if (!stringOrEmpty(merchant.logo_url)) return false;
        // Tiene sucursales pero todas están inactivas → ocultar.
        if (merchantsWithBranch.has(id) && !merchantsWithActiveBranch.has(id)) return false;
        return true;
      })
      .map((merchant) => ({
        id: stringOrEmpty(merchant.id),
        trade_name: stringOrEmpty(merchant.trade_name),
        logo_url: stringOrEmpty(merchant.logo_url),
      }));

    return { data: brands, error: null };
  },

  // Carga ligera para pintar la barra lateral y la cabecera del local al instante,
  // SIN traer productos/modificadores (lo pesado). El catálogo se carga después con fetchSnapshot.
  fetchMerchantsLite: async () => {
    const [merchantsResult, branchesResult, addressesResult, branchStatusResult, categoriesResult] = await Promise.all([
      supabase.from('merchants').select('id, trade_name, logo_url, status').order('trade_name', { ascending: true }),
      supabase
        .from('merchant_branches')
        .select('id, merchant_id, name, address_id, phone, prep_time_avg_min, accepts_orders, status')
        .order('created_at', { ascending: true }),
      supabase.from('addresses').select('id, line1, district, city'),
      supabase.from('merchant_branch_status').select('branch_id, is_open, accepting_orders, status_code'),
      supabase.from('categories').select('id, merchant_id, name, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);

    if (merchantsResult.error) return { data: null, error: merchantsResult.error };
    if (branchesResult.error) return { data: null, error: branchesResult.error };
    if (addressesResult.error) return { data: null, error: addressesResult.error };
    if (branchStatusResult.error) return { data: null, error: branchStatusResult.error };
    if (categoriesResult.error) return { data: null, error: categoriesResult.error };

    const addressMap = new Map<string, any>(((addressesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), row]));
    const branchStatusMap = new Map<string, any>(((branchStatusResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.branch_id), row]));

    const branchesByMerchant = new Map<string, any[]>();
    ((branchesResult.data ?? []) as any[]).forEach((b) => {
      const mid = stringOrEmpty(b.merchant_id);
      if (!branchesByMerchant.has(mid)) branchesByMerchant.set(mid, []);
      branchesByMerchant.get(mid)!.push(b);
    });

    const categoriesByMerchant = new Map<string, any[]>();
    ((categoriesResult.data ?? []) as any[]).forEach((c) => {
      const mid = stringOrEmpty(c.merchant_id);
      if (!categoriesByMerchant.has(mid)) categoriesByMerchant.set(mid, []);
      categoriesByMerchant.get(mid)!.push(c);
    });

    const merchants: PublicMarketplaceMerchant[] = ((merchantsResult.data ?? []) as any[])
      .filter((merchant) => stringOrEmpty(merchant.status) !== 'inactive')
      .map((merchant) => {
        const merchantId = stringOrEmpty(merchant.id);

        const branches: PublicMarketplaceBranch[] = (branchesByMerchant.get(merchantId) ?? []).map((branch) => {
          const branchId = stringOrEmpty(branch.id);
          const branchAddress = addressMap.get(stringOrEmpty(branch.address_id));
          const branchStatus = branchStatusMap.get(branchId);
          return {
            id: branchId,
            merchant_id: merchantId,
            name: stringOrEmpty(branch.name),
            phone: stringOrEmpty(branch.phone),
            prep_time_avg_min: numberOrZero(branch.prep_time_avg_min),
            accepts_orders: Boolean(branch.accepts_orders ?? false),
            address_label: stringOrEmpty(branchAddress?.line1),
            district: stringOrEmpty(branchAddress?.district),
            city: stringOrEmpty(branchAddress?.city),
            is_open: Boolean(branchStatus?.is_open ?? false),
            accepting_orders: Boolean(branchStatus?.accepting_orders ?? branch.accepts_orders ?? false),
            status_code: stringOrEmpty(branchStatus?.status_code || branch.status || 'active'),
          };
        });

        const categories: PublicMarketplaceCategory[] = (categoriesByMerchant.get(merchantId) ?? [])
          .map((category) => ({
            id: stringOrEmpty(category.id),
            name: stringOrEmpty(category.name),
            sort_order: numberOrZero(category.sort_order),
          }))
          .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));

        return {
          id: merchantId,
          trade_name: stringOrEmpty(merchant.trade_name),
          logo_url: stringOrEmpty(merchant.logo_url),
          status: stringOrEmpty(merchant.status),
          branches,
          categories,
          products: [],
          featured_product_names: [],
        };
      });

    return { data: { merchants }, error: null };
  },

  fetchSnapshot: async () => {
    const [
      merchantsResult,
      branchesResult,
      addressesResult,
      branchStatusResult,
      categoriesResult,
      productsResult,
      settingsResult,
      productGroupsResult,
      modifierGroupsResult,
      modifierOptionsResult,
      paymentMethodsResult,
    ] = await Promise.all([
      supabase.from('merchants').select('id, trade_name, logo_url, status').order('trade_name', { ascending: true }),
      supabase
        .from('merchant_branches')
        .select('id, merchant_id, name, address_id, phone, prep_time_avg_min, accepts_orders, status')
        .order('created_at', { ascending: true }),
      supabase.from('addresses').select('id, line1, district, city'),
      supabase.from('merchant_branch_status').select('branch_id, is_open, accepting_orders, status_code'),
      supabase.from('categories').select('id, merchant_id, name, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase
        .from('products')
        .select('id, merchant_id, category_id, name, description, base_price, image_url, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('product_branch_settings').select('product_id, branch_id, price_override, is_available, stock_qty, is_paused'),
      supabase.from('product_modifier_groups').select('product_id, group_id, sort_order').order('sort_order', { ascending: true }),
      supabase
        .from('modifier_groups')
        .select('id, merchant_id, name, min_select, max_select, is_required, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      supabase
        .from('modifier_options')
        .select('id, group_id, name, price_delta, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('payment_methods').select('id, code, name, is_online').eq('is_active', true).order('created_at', { ascending: true }),
    ]);

    if (merchantsResult.error) return { data: null, error: merchantsResult.error };
    if (branchesResult.error) return { data: null, error: branchesResult.error };
    if (addressesResult.error) return { data: null, error: addressesResult.error };
    if (branchStatusResult.error) return { data: null, error: branchStatusResult.error };
    if (categoriesResult.error) return { data: null, error: categoriesResult.error };
    if (productsResult.error) return { data: null, error: productsResult.error };
    if (settingsResult.error) return { data: null, error: settingsResult.error };
    if (productGroupsResult.error) return { data: null, error: productGroupsResult.error };
    if (modifierGroupsResult.error) return { data: null, error: modifierGroupsResult.error };
    if (modifierOptionsResult.error) return { data: null, error: modifierOptionsResult.error };
    if (paymentMethodsResult.error) return { data: null, error: paymentMethodsResult.error };

    const addressMap = new Map<string, any>(((addressesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), row]));
    const branchStatusMap = new Map<string, any>(((branchStatusResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.branch_id), row]));
    const modifierOptionRows = (modifierOptionsResult.data ?? []) as any[];

    // Index modifier options by group
    const optionsByGroup = new Map<string, PublicMarketplaceModifierOption[]>();
    modifierOptionRows.forEach((opt) => {
      const gid = stringOrEmpty(opt.group_id);
      if (!optionsByGroup.has(gid)) optionsByGroup.set(gid, []);
      optionsByGroup.get(gid)!.push({
        id: stringOrEmpty(opt.id),
        name: stringOrEmpty(opt.name),
        price_delta: numberOrZero(opt.price_delta),
      });
    });

    const modifierGroupMap = new Map<string, PublicMarketplaceModifierGroup>(
      ((modifierGroupsResult.data ?? []) as any[]).map((row) => {
        const gid = stringOrEmpty(row.id);
        return [
          gid,
          {
            id: gid,
            merchant_id: stringOrEmpty(row.merchant_id),
            name: stringOrEmpty(row.name),
            min_select: numberOrZero(row.min_select),
            max_select: numberOrZero(row.max_select),
            is_required: Boolean(row.is_required ?? false),
            options: optionsByGroup.get(gid) ?? [],
          },
        ];
      })
    );

    const productSettingsRows = (settingsResult.data ?? []) as any[];
    const productModifierRows = (productGroupsResult.data ?? []) as any[];

    // Index settings by product
    const settingsByProduct = new Map<string, PublicMarketplaceProductSetting[]>();
    productSettingsRows.forEach((s) => {
      const pid = stringOrEmpty(s.product_id);
      if (!settingsByProduct.has(pid)) settingsByProduct.set(pid, []);
      settingsByProduct.get(pid)!.push({
        branch_id: stringOrEmpty(s.branch_id),
        price: numberOrZero(s.price_override),
        is_available: Boolean(s.is_available ?? true),
        is_paused: Boolean(s.is_paused ?? false),
        stock_qty: s.stock_qty == null ? null : numberOrZero(s.stock_qty),
      });
    });

    // Index modifier groups by product
    const groupsByProduct = new Map<string, PublicMarketplaceModifierGroup[]>();
    productModifierRows.forEach((pm) => {
      const pid = stringOrEmpty(pm.product_id);
      const group = modifierGroupMap.get(stringOrEmpty(pm.group_id));
      if (group) {
        if (!groupsByProduct.has(pid)) groupsByProduct.set(pid, []);
        groupsByProduct.get(pid)!.push(group);
      }
    });

    // Index everything by merchant
    const branchesByMerchant = new Map<string, any[]>();
    ((branchesResult.data ?? []) as any[]).forEach((b) => {
      const mid = stringOrEmpty(b.merchant_id);
      if (!branchesByMerchant.has(mid)) branchesByMerchant.set(mid, []);
      branchesByMerchant.get(mid)!.push(b);
    });

    const categoriesByMerchant = new Map<string, any[]>();
    ((categoriesResult.data ?? []) as any[]).forEach((c) => {
      const mid = stringOrEmpty(c.merchant_id);
      if (!categoriesByMerchant.has(mid)) categoriesByMerchant.set(mid, []);
      categoriesByMerchant.get(mid)!.push(c);
    });

    const productsByMerchant = new Map<string, any[]>();
    ((productsResult.data ?? []) as any[]).forEach((p) => {
      const mid = stringOrEmpty(p.merchant_id);
      if (!productsByMerchant.has(mid)) productsByMerchant.set(mid, []);
      productsByMerchant.get(mid)!.push(p);
    });

    const payment_methods: PublicMarketplacePaymentMethod[] = ((paymentMethodsResult.data ?? []) as any[]).map((row) => ({
      id: stringOrEmpty(row.id),
      code: stringOrEmpty(row.code),
      name: stringOrEmpty(row.name),
      is_online: Boolean(row.is_online ?? false),
    }));

    const merchants: PublicMarketplaceMerchant[] = ((merchantsResult.data ?? []) as any[])
      .filter((merchant) => stringOrEmpty(merchant.status) !== 'inactive')
      .map((merchant) => {
        const merchantId = stringOrEmpty(merchant.id);

        const branches: PublicMarketplaceBranch[] = (branchesByMerchant.get(merchantId) ?? []).map((branch) => {
          const branchId = stringOrEmpty(branch.id);
          const branchAddress = addressMap.get(stringOrEmpty(branch.address_id));
          const branchStatus = branchStatusMap.get(branchId);
          return {
            id: branchId,
            merchant_id: merchantId,
            name: stringOrEmpty(branch.name),
            phone: stringOrEmpty(branch.phone),
            prep_time_avg_min: numberOrZero(branch.prep_time_avg_min),
            accepts_orders: Boolean(branch.accepts_orders ?? false),
            address_label: stringOrEmpty(branchAddress?.line1),
            district: stringOrEmpty(branchAddress?.district),
            city: stringOrEmpty(branchAddress?.city),
            is_open: Boolean(branchStatus?.is_open ?? false),
            accepting_orders: Boolean(branchStatus?.accepting_orders ?? branch.accepts_orders ?? false),
            status_code: stringOrEmpty(branchStatus?.status_code || branch.status || 'active'),
          };
        });

        const categories: PublicMarketplaceCategory[] = (categoriesByMerchant.get(merchantId) ?? [])
          .map((category) => ({
            id: stringOrEmpty(category.id),
            name: stringOrEmpty(category.name),
            sort_order: numberOrZero(category.sort_order),
          }))
          .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));

        const products: PublicMarketplaceProduct[] = (productsByMerchant.get(merchantId) ?? [])
          .map((product) => {
            const pid = stringOrEmpty(product.id);
            const basePrice = numberOrZero(product.base_price);
            const settings = (settingsByProduct.get(pid) ?? []).map((s) => ({
              ...s,
              price: s.price || basePrice,
            }));

            return {
              id: pid,
              merchant_id: merchantId,
              category_id: stringOrEmpty(product.category_id),
              name: stringOrEmpty(product.name),
              description: stringOrEmpty(product.description),
              base_price: basePrice,
              image_url: stringOrEmpty(product.image_url),
              sort_order: numberOrZero(product.sort_order),
              settings,
              modifier_groups: groupsByProduct.get(pid) ?? [],
            };
          })
          .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));

        return {
          id: merchantId,
          trade_name: stringOrEmpty(merchant.trade_name),
          logo_url: stringOrEmpty(merchant.logo_url),
          status: stringOrEmpty(merchant.status),
          branches,
          categories,
          products,
          featured_product_names: products.slice(0, 3).map((product) => product.name),
        };
      });

    return {
      data: {
        merchants,
        payment_methods,
      },
      error: null,
    };
  },
};
