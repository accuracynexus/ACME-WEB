import { supabase } from '../../integrations/supabase/client';
import {
  adminService,
  MerchantAdminForm,
  StaffAdminRecord,
} from './adminService';

export interface PlatformMerchantRecord {
  id: string;
  trade_name: string;
  legal_name: string;
  status: string;
  email: string;
  phone: string;
  branches_count: number;
  active_branches_count: number;
  staff_count: number;
  orders_count: number;
  active_orders_count: number;
  promotions_count: number;
  owner_label: string;
  created_at: string;
}

export interface PlatformMerchantActivityRecord {
  id: string;
  order_code: string;
  branch_label: string;
  status: string;
  total: number;
  placed_at: string;
}

export interface PlatformMerchantBranchRecord {
  id: string;
  name: string;
  phone: string;
  address_text: string;
  prep_time_avg_min: number;
  is_open: boolean;
  accepts_orders: boolean;
  status_code: string;
  pause_reason: string;
  hours_count: number;
  closures_count: number;
  next_closure_starts_at: string;
}

export interface PlatformMerchantAuditRecord {
  id: string;
  branch_label: string;
  user_label: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata_json: unknown;
  created_at: string;
}

export interface PlatformMerchantDetail {
  merchant: MerchantAdminForm;
  branches: PlatformMerchantBranchRecord[];
  staff: StaffAdminRecord[];
  recent_orders: PlatformMerchantActivityRecord[];
  audit_logs: PlatformMerchantAuditRecord[];
  counters: {
    branches: number;
    active_branches: number;
    staff: number;
    orders: number;
    active_orders: number;
    promotions: number;
    customers: number;
    audit_logs: number;
  };
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function listMerchantCustomerIds(merchantId: string) {
  const [ordersResult, cartsResult] = await Promise.all([
    supabase.from('orders').select('customer_id').eq('merchant_id', merchantId),
    supabase.from('carts').select('customer_id').eq('merchant_id', merchantId),
  ]);

  if (ordersResult.error) {
    return { data: [] as string[], error: ordersResult.error };
  }

  if (cartsResult.error) {
    return { data: [] as string[], error: cartsResult.error };
  }

  return {
    data: uniqueStrings([
      ...((ordersResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.customer_id)),
      ...((cartsResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.customer_id)),
    ]),
    error: null,
  };
}

function isPromotionTargetForMerchant(
  targetType: string,
  targetId: string,
  merchantId: string,
  branchIds: Set<string>,
  categoryIds: Set<string>,
  productIds: Set<string>
) {
  const normalized = targetType.trim().toLowerCase();
  if (!targetId) return false;
  if (normalized === 'merchant') return targetId === merchantId;
  if (normalized === 'branch') return branchIds.has(targetId);
  if (normalized === 'category') return categoryIds.has(targetId);
  if (normalized === 'product') return productIds.has(targetId);
  return false;
}

function getMerchantLabel(row: any) {
  return stringOrEmpty(row?.trade_name) || stringOrEmpty(row?.legal_name) || stringOrEmpty(row?.id);
}

export const adminPlatformService = {
  fetchMerchants: async () => {
    const [
      merchantsResult,
      branchesResult,
      staffResult,
      profilesResult,
      ordersResult,
      categoriesResult,
      productsResult,
      promotionsResult,
      promotionTargetsResult,
    ] = await Promise.all([
      supabase.from('merchants').select('*').order('created_at', { ascending: false }),
      supabase.from('merchant_branches').select('id, merchant_id, name, branch_status:merchant_branch_status(is_open)'),
      supabase.from('merchant_staff').select('id, merchant_id, user_id, staff_role'),
      supabase.from('profiles').select('user_id, full_name, email'),
      supabase.from('orders').select('id, merchant_id, status'),
      supabase.from('categories').select('id, merchant_id'),
      supabase.from('products').select('id, merchant_id'),
      supabase.from('promotions').select('id, is_active'),
      supabase.from('promotion_targets').select('promotion_id, target_type, target_id'),
    ]);

    if (merchantsResult.error) return { data: null, error: merchantsResult.error };
    if (branchesResult.error) return { data: null, error: branchesResult.error };
    if (staffResult.error) return { data: null, error: staffResult.error };
    if (profilesResult.error) return { data: null, error: profilesResult.error };
    if (ordersResult.error) return { data: null, error: ordersResult.error };
    if (categoriesResult.error) return { data: null, error: categoriesResult.error };
    if (productsResult.error) return { data: null, error: productsResult.error };
    if (promotionsResult.error) return { data: null, error: promotionsResult.error };
    if (promotionTargetsResult.error) return { data: null, error: promotionTargetsResult.error };

    const profileMap = new Map<string, any>(((profilesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.user_id), row]));
    const branchRows = (branchesResult.data ?? []) as any[];
    const staffRows = (staffResult.data ?? []) as any[];
    const orderRows = (ordersResult.data ?? []) as any[];
    const categoryRows = (categoriesResult.data ?? []) as any[];
    const productRows = (productsResult.data ?? []) as any[];
    const promotionRows = (promotionsResult.data ?? []) as any[];
    const promotionTargetRows = (promotionTargetsResult.data ?? []) as any[];

    const data: PlatformMerchantRecord[] = ((merchantsResult.data ?? []) as any[]).map((row) => {
      const merchantId = stringOrEmpty(row.id);
      const merchantBranches = branchRows.filter((branch) => stringOrEmpty(branch.merchant_id) === merchantId);
      const merchantStaff = staffRows.filter((staff) => stringOrEmpty(staff.merchant_id) === merchantId);
      const merchantOrders = orderRows.filter((order) => stringOrEmpty(order.merchant_id) === merchantId);
      const merchantBranchIds = new Set(merchantBranches.map((branch) => stringOrEmpty(branch.id)));
      const merchantCategoryIds = new Set(
        categoryRows
          .filter((category) => stringOrEmpty(category.merchant_id) === merchantId)
          .map((category) => stringOrEmpty(category.id))
      );
      const merchantProductIds = new Set(
        productRows
          .filter((product) => stringOrEmpty(product.merchant_id) === merchantId)
          .map((product) => stringOrEmpty(product.id))
      );
      const merchantPromotionIds = new Set(
        uniqueStrings(
          promotionTargetRows
            .filter((target) =>
              isPromotionTargetForMerchant(
                stringOrEmpty(target.target_type),
                stringOrEmpty(target.target_id),
                merchantId,
                merchantBranchIds,
                merchantCategoryIds,
                merchantProductIds
              )
            )
            .map((target) => stringOrEmpty(target.promotion_id))
        )
      );
      const merchantPromotions = promotionRows.filter((promotion) => merchantPromotionIds.has(stringOrEmpty(promotion.id)));
      const owner = merchantStaff.find((staff) => stringOrEmpty(staff.staff_role).toLowerCase() === 'owner') ?? merchantStaff[0];
      const ownerProfile = owner ? profileMap.get(stringOrEmpty(owner.user_id)) : null;

      return {
        id: merchantId,
        trade_name: stringOrEmpty(row.trade_name),
        legal_name: stringOrEmpty(row.legal_name),
        status: stringOrEmpty(row.status) || 'active',
        email: stringOrEmpty(row.email),
        phone: stringOrEmpty(row.phone),
        branches_count: merchantBranches.length,
        active_branches_count: merchantBranches.filter((branch) => Boolean(branch.branch_status?.is_open)).length,
        staff_count: merchantStaff.length,
        orders_count: merchantOrders.length,
        active_orders_count: merchantOrders.filter((order) => {
          const status = stringOrEmpty(order.status).toLowerCase();
          return status && !['delivered', 'cancelled', 'rejected'].includes(status);
        }).length,
        promotions_count: merchantPromotions.filter((promotion) => Boolean(promotion.is_active ?? true)).length,
        owner_label:
          stringOrEmpty(ownerProfile?.full_name) ||
          stringOrEmpty(ownerProfile?.email) ||
          stringOrEmpty(owner?.user_id) ||
          'Sin responsable',
        created_at: stringOrEmpty(row.created_at),
      } satisfies PlatformMerchantRecord;
    });

    return { data, error: null };
  },

  fetchMerchantDetail: async (merchantId: string) => {
    const [
      merchantResult,
      platformBranchesResult,
      staffResult,
      ordersResult,
      categoriesResult,
      productsResult,
      promotionsResult,
      promotionTargetsResult,
      customerIdsResult,
      merchantAuditResult,
    ] = await Promise.all([
      adminService.fetchMerchant(merchantId),
      supabase
        .from('merchant_branches')
        .select(`
          id,
          merchant_id,
          name,
          phone,
          prep_time_avg_min,
          address_id,
          hours:merchant_branch_hours(id, day_of_week, open_time, close_time, is_closed),
          closures:merchant_branch_closures(id, starts_at, ends_at, reason)
        `)
        .eq('merchant_id', merchantId)
        .order('name', { ascending: true }),
      adminService.fetchStaff(merchantId),
      supabase
        .from('orders')
        .select('id, order_code, branch_id, status, total, placed_at')
        .eq('merchant_id', merchantId)
        .order('placed_at', { ascending: false })
        .limit(12),
      supabase.from('categories').select('id, merchant_id').eq('merchant_id', merchantId),
      supabase.from('products').select('id, merchant_id').eq('merchant_id', merchantId),
      supabase.from('promotions').select('id, is_active'),
      supabase.from('promotion_targets').select('promotion_id, target_type, target_id'),
      listMerchantCustomerIds(merchantId),
      supabase.from('merchant_audit_logs').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(40),
    ]);

    if (merchantResult.error) return { data: null, error: merchantResult.error };
    if (platformBranchesResult.error) return { data: null, error: platformBranchesResult.error };
    if (staffResult.error) return { data: null, error: staffResult.error };
    if (ordersResult.error) return { data: null, error: ordersResult.error };
    if (categoriesResult.error) return { data: null, error: categoriesResult.error };
    if (productsResult.error) return { data: null, error: productsResult.error };
    if (promotionsResult.error) return { data: null, error: promotionsResult.error };
    if (promotionTargetsResult.error) return { data: null, error: promotionTargetsResult.error };
    if (customerIdsResult.error) return { data: null, error: customerIdsResult.error };
    if (merchantAuditResult.error) return { data: null, error: merchantAuditResult.error };
    if (!merchantResult.data) return { data: null, error: new Error('No se encontro el comercio solicitado') };

    const orderRows = (ordersResult.data ?? []) as any[];
    const orderBranchIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.branch_id)));
    const orderBranchNamesResult = orderBranchIds.length > 0
      ? await supabase.from('merchant_branches').select('id, name').in('id', orderBranchIds)
      : ({ data: [], error: null } as any);
    if (orderBranchNamesResult.error) return { data: null, error: orderBranchNamesResult.error };
    const orderBranchNameMap = new Map<string, string>(
      ((orderBranchNamesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), stringOrEmpty(row.name)])
    );

    const branchRows = (platformBranchesResult.data ?? []) as any[];

    // Fetch address and branch_status separately to avoid "Cannot coerce to single JSON object" error
    // which happens when a branch has multiple rows in those tables
    const branchIds = branchRows.map((row) => stringOrEmpty(row.id)).filter(Boolean);
    const addressIds = branchRows.map((row) => stringOrEmpty(row.address_id)).filter(Boolean);
    const [branchStatusResult, addressesResult] = await Promise.all([
      branchIds.length > 0
        ? supabase.from('merchant_branch_status').select('branch_id, is_open, accepting_orders, status_code, pause_reason').in('branch_id', branchIds)
        : ({ data: [], error: null } as any),
      addressIds.length > 0
        ? supabase.from('addresses').select('id, line1, line2, district, city, region').in('id', addressIds)
        : ({ data: [], error: null } as any),
    ]);

    if (branchStatusResult.error) return { data: null, error: branchStatusResult.error };
    if (addressesResult.error) return { data: null, error: addressesResult.error };

    const branchStatusMap = new Map<string, any>(
      ((branchStatusResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.branch_id), row])
    );
    const addressMap = new Map<string, any>(
      ((addressesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), row])
    );

    const categoryRows = (categoriesResult.data ?? []) as any[];
    const productRows = (productsResult.data ?? []) as any[];
    const promotionRows = (promotionsResult.data ?? []) as any[];
    const promotionTargetRows = (promotionTargetsResult.data ?? []) as any[];
    const staff = staffResult.data ?? [];
    const orders = orderRows.map((row) => ({
      id: stringOrEmpty(row.id),
      order_code: stringOrEmpty(row.order_code || row.id),
      branch_label: orderBranchNameMap.get(stringOrEmpty(row.branch_id)) || 'Sin sucursal',
      status: stringOrEmpty(row.status),
      total: numberOrZero(row.total),
      placed_at: stringOrEmpty(row.placed_at),
    })) satisfies PlatformMerchantActivityRecord[];

    const activeOrders = orders.filter((order) => {
      const status = order.status.toLowerCase();
      return status && !['delivered', 'cancelled', 'rejected'].includes(status);
    }).length;
    const merchantBranchIds = new Set(branchRows.map((row) => stringOrEmpty(row.id)));
    const merchantCategoryIds = new Set(categoryRows.map((row) => stringOrEmpty(row.id)));
    const merchantProductIds = new Set(productRows.map((row) => stringOrEmpty(row.id)));
    const merchantPromotionIds = new Set(
      uniqueStrings(
        promotionTargetRows
          .filter((target) =>
            isPromotionTargetForMerchant(
              stringOrEmpty(target.target_type),
              stringOrEmpty(target.target_id),
              merchantId,
              merchantBranchIds,
              merchantCategoryIds,
              merchantProductIds
            )
          )
          .map((target) => stringOrEmpty(target.promotion_id))
      )
    );
    const merchantPromotions = promotionRows.filter((promotion) => merchantPromotionIds.has(stringOrEmpty(promotion.id)));

    const branchMap = new Map<string, string>(
      branchRows.map((row) => [stringOrEmpty(row.id), stringOrEmpty(row.name) || stringOrEmpty(row.id)])
    );
    const auditRows = (merchantAuditResult.data ?? []) as any[];
    const auditUserIds = uniqueStrings(auditRows.map((row) => stringOrEmpty(row.user_id)));
    const auditProfilesResult =
      auditUserIds.length > 0
        ? await supabase.from('profiles').select('user_id, full_name, email').in('user_id', auditUserIds)
        : ({ data: [], error: null } as any);

    if (auditProfilesResult.error) return { data: null, error: auditProfilesResult.error };

    const auditProfileMap = new Map<string, any>(
      ((auditProfilesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.user_id), row])
    );
    const branches: PlatformMerchantBranchRecord[] = branchRows.map((row) => {
      const branchStatus = branchStatusMap.get(stringOrEmpty(row.id)) ?? null;
      const address = addressMap.get(stringOrEmpty(row.address_id)) ?? null;
      const closures = Array.isArray(row.closures) ? row.closures : [];
      const nextClosure = closures
        .map((closure: any) => stringOrEmpty(closure.starts_at))
        .filter(Boolean)
        .sort((left: string, right: string) => left.localeCompare(right))[0] ?? '';
      return {
        id: stringOrEmpty(row.id),
        name: stringOrEmpty(row.name),
        phone: stringOrEmpty(row.phone),
        address_text: [stringOrEmpty(address?.line1), stringOrEmpty(address?.line2), stringOrEmpty(address?.district), stringOrEmpty(address?.city)]
          .filter(Boolean)
          .join(', '),
        prep_time_avg_min: numberOrZero(row.prep_time_avg_min),
        is_open: Boolean(branchStatus?.is_open ?? false),
        accepts_orders: Boolean(branchStatus?.accepting_orders ?? false),
        status_code: stringOrEmpty(branchStatus?.status_code) || 'closed',
        pause_reason: stringOrEmpty(branchStatus?.pause_reason),
        hours_count: Array.isArray(row.hours) ? row.hours.filter((item: any) => !Boolean(item?.is_closed)).length : 0,
        closures_count: closures.length,
        next_closure_starts_at: nextClosure,
      } satisfies PlatformMerchantBranchRecord;
    });
    const auditLogs: PlatformMerchantAuditRecord[] = auditRows.map((row) => ({
      id: stringOrEmpty(row.id),
      branch_label: branchMap.get(stringOrEmpty(row.branch_id)) || 'Sin sucursal',
      user_label:
        stringOrEmpty(auditProfileMap.get(stringOrEmpty(row.user_id))?.full_name) ||
        stringOrEmpty(auditProfileMap.get(stringOrEmpty(row.user_id))?.email) ||
        stringOrEmpty(row.user_id),
      entity_type: stringOrEmpty(row.entity_type),
      entity_id: stringOrEmpty(row.entity_id),
      action: stringOrEmpty(row.action),
      metadata_json: row.metadata_json ?? null,
      created_at: stringOrEmpty(row.created_at),
    }));

    return {
      data: {
        merchant: merchantResult.data,
        branches,
        staff,
        recent_orders: orders,
        audit_logs: auditLogs,
        counters: {
          branches: branches.length,
          active_branches: branches.filter((branch) => branch.is_open).length,
          staff: staff.length,
          orders: orders.length,
          active_orders: activeOrders,
          promotions: merchantPromotions.filter((promotion) => Boolean(promotion.is_active ?? true)).length,
          customers: customerIdsResult.data.length,
          audit_logs: auditLogs.length,
        },
      } satisfies PlatformMerchantDetail,
      error: null,
    };
  },

  saveMerchant: async (merchantId: string, form: MerchantAdminForm) => {
    return adminService.saveMerchant(merchantId, form);
  },
};
