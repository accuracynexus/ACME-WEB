import { supabase } from '../../integrations/supabase/client';

export interface MerchantAdminForm {
  id?: string;
  trade_name: string;
  legal_name: string;
  tax_id: string;
  logo_url: string;
  phone: string;
  email: string;
  status: string;
}

export interface AddressFormValue {
  id?: string;
  line1: string;
  line2: string;
  reference: string;
  district: string;
  city: string;
  region: string;
  country: string;
}

export interface BranchStatusFormValue {
  is_open: boolean;
  accepting_orders: boolean;
  status_code: string;
  pause_reason: string;
}

export interface BranchHourFormValue {
  id?: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface BranchClosureFormValue {
  id?: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface DeliveryZoneFormValue {
  id?: string;
  name: string;
  polygon_geojson: string;
  base_fee: string;
  min_order_amount: string;
  estimated_minutes: string;
  is_active: boolean;
}

export interface BranchDeliveryZoneFormValue {
  id?: string;
  zone_id: string;
  zone_name: string;
  assigned: boolean;
  fee_override: string;
  is_active: boolean;
}

export interface BranchAdminSummary {
  id: string;
  name: string;
  phone: string;
  status: string;
  accepts_orders: boolean;
  accepting_orders: boolean;
  prep_time_avg_min: number;
  is_open: boolean;
  status_code: string;
  pause_reason: string;
  hours_count: number;
  closures_count: number;
  coverage_count: number;
  address_text: string;
}

export interface BranchAdminForm {
  id?: string;
  merchant_id: string;
  name: string;
  phone: string;
  prep_time_avg_min: string;
  accepts_orders: boolean;
  status: string;
  address: AddressFormValue;
  branch_status: BranchStatusFormValue;
  hours: BranchHourFormValue[];
  closures: BranchClosureFormValue[];
  delivery_zones: DeliveryZoneFormValue[];
  branch_delivery_zones: BranchDeliveryZoneFormValue[];
}

export interface CategoryAdminRecord {
  id?: string;
  merchant_id?: string;
  name: string;
  sort_order: string;
  is_active: boolean;
}

export interface ModifierOptionAdminRecord {
  id?: string;
  name: string;
  price_delta: string;
  sort_order: string;
  is_active: boolean;
}

export interface ModifierGroupAdminRecord {
  id?: string;
  merchant_id?: string;
  name: string;
  min_select: string;
  max_select: string;
  is_required: boolean;
  is_active: boolean;
  options: ModifierOptionAdminRecord[];
}

export interface ProductModifierGroupForm {
  id?: string;
  group_id: string;
  group_name: string;
  min_select: string;
  max_select: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: string;
  selected: boolean;
  options: ModifierOptionAdminRecord[];
}

export interface ProductBranchSettingForm {
  id?: string;
  branch_id: string;
  branch_name: string;
  price_override: string;
  is_available: boolean;
  is_paused: boolean;
  pause_reason: string;
}

export interface ProductAdminSummary {
  id: string;
  name: string;
  sku: string;
  base_price: number;
  is_active: boolean;
  category_name: string;
  image_url: string;
}

export interface ProductAdminForm {
  id?: string;
  merchant_id?: string;
  category_id: string;
  sku: string;
  name: string;
  description: string;
  base_price: string;
  image_url: string;
  is_active: boolean;
  sort_order: string;
  branch_settings: ProductBranchSettingForm[];
  modifier_groups: ProductModifierGroupForm[];
}

export interface RoleAdminRecord {
  id: string;
  code: string;
  name: string;
}

export interface StaffAssignableProfile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  default_role: string;
  is_active: boolean;
}

export interface StaffAdminRecord {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  default_role: string;
  role: string;
  is_active: boolean;
  branch_ids: string[];
  primary_branch_id: string;
  branch_labels: string[];
  user_role_ids: string[];
  user_role_codes: string[];
  user_role_labels: string[];
  last_login_at: string;
}

export interface StaffAdminForm {
  id?: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  default_role: string;
  role: string;
  is_active: boolean;
  branch_ids: string[];
  primary_branch_id: string;
  user_role_ids: string[];
}

export interface OrderAdminRecord {
  id: string;
  order_code: string;
  status: string;
  total: number;
  customer_label: string;
  payment_label: string;
  placed_at: string;
  address_label: string;
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function nullableString(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isTempId(value: string | undefined) {
  return Boolean(value && value.startsWith('temp:'));
}

function createDefaultHours(): BranchHourFormValue[] {
  return Array.from({ length: 7 }, (_, index) => ({
    day_of_week: index,
    open_time: '08:00:00',
    close_time: '22:00:00',
    is_closed: false,
  }));
}

function mergeHours(rows: any[]): BranchHourFormValue[] {
  const defaults = createDefaultHours();
  for (const row of rows) {
    const target = defaults.find((item) => item.day_of_week === Number(row?.day_of_week ?? -1));
    if (!target) continue;
    target.id = row.id;
    target.open_time = row.open_time ?? target.open_time;
    target.close_time = row.close_time ?? target.close_time;
    target.is_closed = Boolean(row.is_closed ?? false);
  }
  return defaults;
}

function mapClosureRows(rows: any[]): BranchClosureFormValue[] {
  return rows.map((row) => ({
    id: row.id,
    starts_at: stringOrEmpty(row.starts_at),
    ends_at: stringOrEmpty(row.ends_at),
    reason: stringOrEmpty(row.reason),
  }));
}

function mapDeliveryZoneRows(rows: any[]): DeliveryZoneFormValue[] {
  return rows.map((row) => ({
    id: row.id,
    name: stringOrEmpty(row.name),
    polygon_geojson: stringOrEmpty(row.polygon_geojson),
    base_fee: String(row.base_fee ?? 0),
    min_order_amount: String(row.min_order_amount ?? 0),
    estimated_minutes: String(row.estimated_minutes ?? 0),
    is_active: Boolean(row.is_active ?? true),
  }));
}

function mapBranchDeliveryZoneRows(
  zones: DeliveryZoneFormValue[],
  rows: any[]
): BranchDeliveryZoneFormValue[] {
  const relationMap = new Map<string, any>(rows.map((row) => [String(row.zone_id), row]));
  return zones.map((zone) => {
    const relation = zone.id ? relationMap.get(zone.id) : null;
    return {
      id: relation?.id,
      zone_id: zone.id ?? '',
      zone_name: zone.name,
      assigned: Boolean(relation),
      fee_override: relation?.fee_override == null ? '' : String(relation.fee_override),
      is_active: Boolean(relation?.is_active ?? true),
    };
  });
}

function mapModifierOptionRows(rows: any[]): ModifierOptionAdminRecord[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: stringOrEmpty(row.name),
      price_delta: String(row.price_delta ?? 0),
      sort_order: String(row.sort_order ?? 0),
      is_active: Boolean(row.is_active ?? true),
    }))
    .sort((left, right) => Number(left.sort_order) - Number(right.sort_order) || left.name.localeCompare(right.name));
}

function mapModifierGroupRows(rows: any[]): ModifierGroupAdminRecord[] {
  return rows
    .map((row) => ({
      id: row.id,
      merchant_id: row.merchant_id,
      name: stringOrEmpty(row.name),
      min_select: String(row.min_select ?? 0),
      max_select: String(row.max_select ?? 1),
      is_required: Boolean(row.is_required ?? false),
      is_active: Boolean(row.is_active ?? true),
      options: mapModifierOptionRows(Array.isArray(row.options) ? row.options : []),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function mapRoleRows(rows: any[]): RoleAdminRecord[] {
  return rows
    .map((row) => ({
      id: String(row.id),
      code: stringOrEmpty(row.code),
      name: stringOrEmpty(row.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function syncUserRolesForUser(userId: string, selectedRoleIds: string[]) {
  const normalizedRoleIds = uniqueIds(selectedRoleIds);
  const existingResult = await supabase.from('user_roles').select('id, role_id').eq('user_id', userId);

  if (existingResult.error) {
    return { data: null, error: existingResult.error };
  }

  const existingRows = (existingResult.data ?? []) as any[];
  const selectedRoleIdSet = new Set(normalizedRoleIds);
  const existingRoleIdSet = new Set(existingRows.map((row) => String(row.role_id)));

  const relationIdsToDelete = existingRows
    .filter((row) => !selectedRoleIdSet.has(String(row.role_id)))
    .map((row) => String(row.id));

  if (relationIdsToDelete.length > 0) {
    const deleteResult = await supabase.from('user_roles').delete().in('id', relationIdsToDelete);
    if (deleteResult.error) {
      return { data: null, error: deleteResult.error };
    }
  }

  const missingRoleIds = normalizedRoleIds.filter((roleId) => !existingRoleIdSet.has(roleId));
  if (missingRoleIds.length > 0) {
    const insertResult = await supabase.from('user_roles').insert(
      missingRoleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
      }))
    );

    if (insertResult.error) {
      return { data: null, error: insertResult.error };
    }
  }

  return { data: normalizedRoleIds, error: null };
}

export const adminService = {
  fetchDeliveryZones: async () => {
    const result = await supabase
      .from('delivery_zones')
      .select('id, name, polygon_geojson, base_fee, min_order_amount, estimated_minutes, is_active')
      .order('name', { ascending: true });

    if (result.error) return { data: null, error: result.error };
    return { data: mapDeliveryZoneRows((result.data ?? []) as any[]), error: null };
  },

  fetchMerchant: async (merchantId: string) => {
    const result = await supabase.from('merchants').select('*').eq('id', merchantId).maybeSingle();
    if (result.error) return { data: null, error: result.error };
    if (!result.data) return { data: null, error: null };

    const row: any = result.data;
    const data: MerchantAdminForm = {
      id: row.id,
      trade_name: stringOrEmpty(row.trade_name),
      legal_name: stringOrEmpty(row.legal_name),
      tax_id: stringOrEmpty(row.tax_id),
      logo_url: stringOrEmpty(row.logo_url),
      phone: stringOrEmpty(row.phone),
      email: stringOrEmpty(row.email),
      status: stringOrEmpty(row.status) || 'active',
    };

    return { data, error: null };
  },

  saveMerchant: async (merchantId: string, form: MerchantAdminForm) => {
    const payload = {
      trade_name: form.trade_name.trim(),
      legal_name: nullableString(form.legal_name),
      tax_id: nullableString(form.tax_id),
      logo_url: nullableString(form.logo_url),
      phone: nullableString(form.phone),
      email: nullableString(form.email),
      status: form.status,
    };

    return supabase.from('merchants').update(payload).eq('id', merchantId).select().single();
  },

  uploadMerchantLogo: async (merchantId: string, file: File, oldLogoUrl: string) => {
    const BUCKET = 'merchant-logos';
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${merchantId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) return { data: null, error: uploadError };

    if (oldLogoUrl) {
      try {
        const storagePrefix = `/storage/v1/object/public/${BUCKET}/`;
        const idx = oldLogoUrl.indexOf(storagePrefix);
        if (idx !== -1) {
          const oldPath = oldLogoUrl.slice(idx + storagePrefix.length).split('?')[0];
          if (oldPath) {
            await supabase.storage.from(BUCKET).remove([oldPath]);
          }
        }
      } catch {
        // best-effort: ignore delete errors
      }
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { data: urlData.publicUrl, error: null };
  },

  fetchBranches: async (merchantId: string) => {
    const result = await supabase
      .from('merchant_branches')
      .select(`
        id,
        name,
        phone,
        status,
        accepts_orders,
        prep_time_avg_min,
        address:addresses(id, line1, district, city),
        branch_status:merchant_branch_status(branch_id, is_open, accepting_orders, status_code, pause_reason),
        hours:merchant_branch_hours(id, is_closed),
        closures:merchant_branch_closures(id),
        coverage:branch_delivery_zones(id, is_active)
      `)
      .eq('merchant_id', merchantId)
      .order('name', { ascending: true });

    if (result.error) return { data: null, error: result.error };

    const data: BranchAdminSummary[] = (result.data ?? []).map((row: any) => ({
      id: row.id,
      name: stringOrEmpty(row.name),
      phone: stringOrEmpty(row.phone),
      status: stringOrEmpty(row.status) || 'active',
      accepts_orders: Boolean(row.accepts_orders ?? false),
      accepting_orders: Boolean(row.branch_status?.accepting_orders ?? row.accepts_orders ?? false),
      prep_time_avg_min: Number(row.prep_time_avg_min ?? 0),
      is_open: Boolean(row.branch_status?.is_open ?? false),
      status_code: stringOrEmpty(row.branch_status?.status_code) || 'closed',
      pause_reason: stringOrEmpty(row.branch_status?.pause_reason),
      hours_count: Array.isArray(row.hours) ? row.hours.filter((item: any) => !Boolean(item?.is_closed)).length : 0,
      closures_count: Array.isArray(row.closures) ? row.closures.length : 0,
      coverage_count: Array.isArray(row.coverage) ? row.coverage.filter((item: any) => Boolean(item?.is_active ?? true)).length : 0,
      address_text: [row.address?.line1, row.address?.district, row.address?.city].filter(Boolean).join(', ') || 'Sin direccion',
    }));

    return { data, error: null };
  },

  createDefaultBranchForm: (merchantId: string): BranchAdminForm => ({
    merchant_id: merchantId,
    name: '',
    phone: '',
    prep_time_avg_min: '20',
    accepts_orders: true,
    status: 'active',
    address: {
      line1: '',
      line2: '',
      reference: '',
      district: '',
      city: '',
      region: 'Junin',
      country: 'Peru',
    },
    branch_status: {
      is_open: true,
      accepting_orders: true,
      status_code: 'open',
      pause_reason: '',
    },
    hours: createDefaultHours(),
    closures: [],
    delivery_zones: [],
    branch_delivery_zones: [],
  }),

  fetchBranchForm: async (branchId: string) => {
    const result = await supabase
      .from('merchant_branches')
      .select(`
        id,
        merchant_id,
        name,
        phone,
        prep_time_avg_min,
        accepts_orders,
        status,
        address:addresses(id, line1, line2, reference, district, city, region, country),
        branch_status:merchant_branch_status(branch_id, is_open, accepting_orders, status_code, pause_reason),
        hours:merchant_branch_hours(id, day_of_week, open_time, close_time, is_closed),
        closures:merchant_branch_closures(id, starts_at, ends_at, reason),
        branch_zone_rows:branch_delivery_zones(id, zone_id, fee_override, is_active)
      `)
      .eq('id', branchId)
      .maybeSingle();

    if (result.error) return { data: null, error: result.error };
    if (!result.data) return { data: null, error: null };

    const zonesResult = await supabase
      .from('delivery_zones')
      .select('id, name, polygon_geojson, base_fee, min_order_amount, estimated_minutes, is_active')
      .order('name', { ascending: true });

    if (zonesResult.error) return { data: null, error: zonesResult.error };

    const row: any = result.data;
    const deliveryZones = mapDeliveryZoneRows((zonesResult.data ?? []) as any[]);
    const data: BranchAdminForm = {
      id: row.id,
      merchant_id: row.merchant_id,
      name: stringOrEmpty(row.name),
      phone: stringOrEmpty(row.phone),
      prep_time_avg_min: String(row.prep_time_avg_min ?? 20),
      accepts_orders: Boolean(row.accepts_orders ?? true),
      status: stringOrEmpty(row.status) || 'active',
      address: {
        id: row.address?.id,
        line1: stringOrEmpty(row.address?.line1),
        line2: stringOrEmpty(row.address?.line2),
        reference: stringOrEmpty(row.address?.reference),
        district: stringOrEmpty(row.address?.district),
        city: stringOrEmpty(row.address?.city),
        region: stringOrEmpty(row.address?.region) || 'Junin',
        country: stringOrEmpty(row.address?.country) || 'Peru',
      },
      branch_status: {
        is_open: Boolean(row.branch_status?.is_open ?? true),
        accepting_orders: Boolean(row.branch_status?.accepting_orders ?? true),
        status_code: stringOrEmpty(row.branch_status?.status_code) || 'open',
        pause_reason: stringOrEmpty(row.branch_status?.pause_reason),
      },
      hours: mergeHours(Array.isArray(row.hours) ? row.hours : []),
      closures: mapClosureRows(Array.isArray(row.closures) ? row.closures : []),
      delivery_zones: deliveryZones,
      branch_delivery_zones: mapBranchDeliveryZoneRows(deliveryZones, Array.isArray(row.branch_zone_rows) ? row.branch_zone_rows : []),
    };

    return { data, error: null };
  },

  saveBranch: async (form: BranchAdminForm, userId: string | null) => {
    const addressPayload = {
      line1: form.address.line1.trim(),
      line2: nullableString(form.address.line2),
      reference: nullableString(form.address.reference),
      district: nullableString(form.address.district),
      city: nullableString(form.address.city),
      region: nullableString(form.address.region),
      country: nullableString(form.address.country),
    };

    let addressId = form.address.id ?? null;
    if (addressId) {
      const addressUpdate = await supabase.from('addresses').update(addressPayload).eq('id', addressId).select().single();
      if (addressUpdate.error) return addressUpdate;
    } else {
      const addressInsert = await supabase.from('addresses').insert(addressPayload).select().single();
      if (addressInsert.error) return addressInsert;
      addressId = (addressInsert.data as any)?.id ?? null;
    }

    const branchPayload = {
      merchant_id: form.merchant_id,
      name: form.name.trim(),
      phone: nullableString(form.phone),
      prep_time_avg_min: Number(form.prep_time_avg_min || 0),
      accepts_orders: form.accepts_orders,
      status: form.status,
      address_id: addressId,
    };

    let branchId = form.id ?? null;
    if (branchId) {
      const branchUpdate = await supabase.from('merchant_branches').update(branchPayload).eq('id', branchId).select().single();
      if (branchUpdate.error) return branchUpdate;
    } else {
      const branchInsert = await supabase.from('merchant_branches').insert(branchPayload).select().single();
      if (branchInsert.error) return branchInsert;
      branchId = (branchInsert.data as any)?.id ?? null;
    }

    if (!branchId) {
      return { data: null, error: new Error('No se pudo resolver la sucursal') };
    }

    const statusPayload = {
      branch_id: branchId,
      is_open: form.branch_status.is_open,
      accepting_orders: form.branch_status.accepting_orders,
      status_code: form.branch_status.status_code,
      pause_reason: nullableString(form.branch_status.pause_reason),
      updated_by_user_id: userId,
    };

    const statusUpdate = await supabase.from('merchant_branch_status').update(statusPayload).eq('branch_id', branchId).select();
    if (statusUpdate.error) return statusUpdate;
    if ((statusUpdate.data ?? []).length === 0) {
      const statusInsert = await supabase.from('merchant_branch_status').insert(statusPayload).select();
      if (statusInsert.error) return statusInsert;
    }

    for (const hour of form.hours) {
      const hourPayload = {
        branch_id: branchId,
        day_of_week: hour.day_of_week,
        open_time: hour.open_time,
        close_time: hour.close_time,
        is_closed: hour.is_closed,
        updated_by_user_id: userId,
      };

      if (hour.id) {
        const updateHour = await supabase.from('merchant_branch_hours').update(hourPayload).eq('id', hour.id);
        if (updateHour.error) return updateHour;
      } else {
        const insertHour = await supabase.from('merchant_branch_hours').insert(hourPayload);
        if (insertHour.error) return insertHour;
      }
    }

    const persistedZones: DeliveryZoneFormValue[] = [];
    for (const zone of form.delivery_zones) {
      const zonePayload = {
        name: zone.name.trim(),
        polygon_geojson: nullableString(zone.polygon_geojson),
        base_fee: Number(zone.base_fee || 0),
        min_order_amount: Number(zone.min_order_amount || 0),
        estimated_minutes: Number(zone.estimated_minutes || 0),
        is_active: zone.is_active,
      };

      if (!zonePayload.name) {
        continue;
      }

      if (zone.id && !isTempId(zone.id)) {
        const updateZone = await supabase.from('delivery_zones').update(zonePayload).eq('id', zone.id).select().single();
        if (updateZone.error) return updateZone;
        persistedZones.push({ ...zone, id: zone.id });
      } else {
        const insertZone = await supabase.from('delivery_zones').insert(zonePayload).select().single();
        if (insertZone.error) return insertZone;
        persistedZones.push({
          ...zone,
          id: (insertZone.data as any)?.id ?? '',
        });
      }
    }

    const persistedZoneIdSet = new Set(persistedZones.map((zone) => zone.id).filter(Boolean));
    const persistedZoneIdMap = new Map<string, string>();
    persistedZones.forEach((zone, index) => {
      const sourceId = form.delivery_zones[index]?.id;
      const savedId = zone.id;
      if (sourceId && savedId) {
        persistedZoneIdMap.set(sourceId, savedId);
      }
    });

    const existingClosures = await supabase.from('merchant_branch_closures').select('id').eq('branch_id', branchId);
    if (existingClosures.error) return existingClosures;
    const currentClosureIds = new Set(form.closures.map((item) => item.id).filter(Boolean));
    const closureIdsToDelete = (existingClosures.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !currentClosureIds.has(id));
    if (closureIdsToDelete.length > 0) {
      const deleteClosures = await supabase.from('merchant_branch_closures').delete().in('id', closureIdsToDelete);
      if (deleteClosures.error) return deleteClosures;
    }

    for (const closure of form.closures) {
      if (!closure.starts_at || !closure.ends_at || !closure.reason.trim()) continue;
      const closurePayload = {
        branch_id: branchId,
        starts_at: closure.starts_at,
        ends_at: closure.ends_at,
        reason: closure.reason.trim(),
        created_by_user_id: userId,
      };

      if (closure.id) {
        const updateClosure = await supabase.from('merchant_branch_closures').update(closurePayload).eq('id', closure.id);
        if (updateClosure.error) return updateClosure;
      } else {
        const insertClosure = await supabase.from('merchant_branch_closures').insert(closurePayload);
        if (insertClosure.error) return insertClosure;
      }
    }

    const existingBranchZones = await supabase.from('branch_delivery_zones').select('id, zone_id').eq('branch_id', branchId);
    if (existingBranchZones.error) return existingBranchZones;
    const formZoneIds = new Set(
      form.branch_delivery_zones
        .filter((item) => item.assigned && item.zone_id && persistedZoneIdSet.has(item.zone_id))
        .map((item) => item.zone_id)
    );
    const branchZoneIdsToDelete = (existingBranchZones.data ?? [])
      .filter((row: any) => !formZoneIds.has(String(row.zone_id)))
      .map((row: any) => row.id);
    if (branchZoneIdsToDelete.length > 0) {
      const deleteBranchZones = await supabase.from('branch_delivery_zones').delete().in('id', branchZoneIdsToDelete);
      if (deleteBranchZones.error) return deleteBranchZones;
    }

    for (const relation of form.branch_delivery_zones) {
      const resolvedZoneId = persistedZoneIdMap.get(relation.zone_id) ?? relation.zone_id;
      if (!relation.assigned || !resolvedZoneId || !persistedZoneIdSet.has(resolvedZoneId)) continue;
      const relationPayload = {
        branch_id: branchId,
        zone_id: resolvedZoneId,
        fee_override: relation.fee_override.trim() ? Number(relation.fee_override) : null,
        is_active: relation.is_active,
      };

      const existing = (existingBranchZones.data ?? []).find((row: any) => String(row.zone_id) === resolvedZoneId);
      if (existing?.id) {
        const updateRelation = await supabase.from('branch_delivery_zones').update(relationPayload).eq('id', existing.id);
        if (updateRelation.error) return updateRelation;
      } else {
        const insertRelation = await supabase.from('branch_delivery_zones').insert(relationPayload);
        if (insertRelation.error) return insertRelation;
      }
    }

    return { data: { id: branchId }, error: null };
  },

  fetchCategories: async (merchantId: string) => {
    const result = await supabase
      .from('categories')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (result.error) return { data: null, error: result.error };

    const data: CategoryAdminRecord[] = (result.data ?? []).map((row: any) => ({
      id: row.id,
      merchant_id: row.merchant_id,
      name: stringOrEmpty(row.name),
      sort_order: String(row.sort_order ?? 0),
      is_active: Boolean(row.is_active ?? true),
    }));

    return { data, error: null };
  },

  fetchModifierGroups: async (merchantId: string) => {
    const result = await supabase
      .from('modifier_groups')
      .select(`
        id,
        merchant_id,
        name,
        min_select,
        max_select,
        is_required,
        is_active,
        options:modifier_options(id, group_id, name, price_delta, is_active, sort_order)
      `)
      .eq('merchant_id', merchantId)
      .order('name', { ascending: true });

    if (result.error) return { data: null, error: result.error };
    return { data: mapModifierGroupRows((result.data ?? []) as any[]), error: null };
  },

  saveModifierGroup: async (merchantId: string, form: ModifierGroupAdminRecord) => {
    const groupPayload = {
      merchant_id: merchantId,
      name: form.name.trim(),
      min_select: Number(form.min_select || 0),
      max_select: Number(form.max_select || 0),
      is_required: form.is_required,
      is_active: form.is_active,
    };

    let groupId = form.id ?? null;
    if (groupId) {
      const updateGroup = await supabase.from('modifier_groups').update(groupPayload).eq('id', groupId).select().single();
      if (updateGroup.error) return updateGroup;
    } else {
      const insertGroup = await supabase.from('modifier_groups').insert(groupPayload).select().single();
      if (insertGroup.error) return insertGroup;
      groupId = (insertGroup.data as any)?.id ?? null;
    }

    if (!groupId) {
      return { data: null, error: new Error('No se pudo resolver el grupo de modificadores') };
    }

    const existingOptions = await supabase.from('modifier_options').select('id').eq('group_id', groupId);
    if (existingOptions.error) return existingOptions;

    const currentOptionIds = new Set(form.options.map((option) => option.id).filter(Boolean));
    const optionIdsToDelete = (existingOptions.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !currentOptionIds.has(id));

    if (optionIdsToDelete.length > 0) {
      const deleteOptions = await supabase.from('modifier_options').delete().in('id', optionIdsToDelete);
      if (deleteOptions.error) return deleteOptions;
    }

    for (const option of form.options) {
      if (!option.name.trim()) continue;
      const optionPayload = {
        group_id: groupId,
        name: option.name.trim(),
        price_delta: Number(option.price_delta || 0),
        is_active: option.is_active,
        sort_order: Number(option.sort_order || 0),
      };

      if (option.id) {
        const updateOption = await supabase.from('modifier_options').update(optionPayload).eq('id', option.id);
        if (updateOption.error) return updateOption;
      } else {
        const insertOption = await supabase.from('modifier_options').insert(optionPayload);
        if (insertOption.error) return insertOption;
      }
    }

    return { data: { id: groupId }, error: null };
  },

  deleteModifierGroup: async (groupId: string) => {
    const deleteAssignments = await supabase.from('product_modifier_groups').delete().eq('group_id', groupId);
    if (deleteAssignments.error) return deleteAssignments;

    const deleteOptions = await supabase.from('modifier_options').delete().eq('group_id', groupId);
    if (deleteOptions.error) return deleteOptions;

    return supabase.from('modifier_groups').delete().eq('id', groupId);
  },

  saveCategory: async (merchantId: string, form: CategoryAdminRecord) => {
    const payload = {
      merchant_id: merchantId,
      name: form.name.trim(),
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
    };

    if (form.id) {
      return supabase.from('categories').update(payload).eq('id', form.id).select().single();
    }

    return supabase.from('categories').insert(payload).select().single();
  },

  createDefaultProductForm: (
    branches: Array<{ id: string; name: string }>,
    modifierGroups: ModifierGroupAdminRecord[] = []
  ): ProductAdminForm => ({
    category_id: '',
    sku: '',
    name: '',
    description: '',
    base_price: '0',
    image_url: '',
    is_active: true,
    sort_order: '0',
    branch_settings: branches.map((branch) => ({
      branch_id: branch.id,
      branch_name: branch.name,
      price_override: '',
      is_available: true,
      is_paused: false,
      pause_reason: '',
    })),
    modifier_groups: modifierGroups.map((group, index) => ({
      group_id: group.id ?? '',
      group_name: group.name,
      min_select: group.min_select,
      max_select: group.max_select,
      is_required: group.is_required,
      is_active: group.is_active,
      sort_order: String(index),
      selected: false,
      options: group.options,
    })),
  }),

  fetchProducts: async (merchantId: string) => {
    const result = await supabase
      .from('products')
      .select(`
      id,
      name,
      sku,
      base_price,
      image_url,
      is_active,
      category:categories(id, name)
      `)
      .eq('merchant_id', merchantId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (result.error) return { data: null, error: result.error };

    const data: ProductAdminSummary[] = (result.data ?? []).map((row: any) => ({
      id: row.id,
      name: stringOrEmpty(row.name),
      sku: stringOrEmpty(row.sku),
      base_price: Number(row.base_price ?? 0),
      image_url: stringOrEmpty(row.image_url),
      is_active: Boolean(row.is_active ?? true),
      category_name: stringOrEmpty(row.category?.name) || 'Sin categoria',
    }));

    return { data, error: null };
  },

  fetchProductForm: async (
    productId: string,
    branches: Array<{ id: string; name: string }>,
    modifierGroups: ModifierGroupAdminRecord[] = []
  ) => {
    const result = await supabase
      .from('products')
      .select(`
        id,
        merchant_id,
        category_id,
        sku,
        name,
        description,
        base_price,
        image_url,
        is_active,
        sort_order,
        branch_settings:product_branch_settings(id, branch_id, price_override, is_available, is_paused, pause_reason),
        modifier_links:product_modifier_groups(id, group_id, sort_order)
      `)
      .eq('id', productId)
      .maybeSingle();

    if (result.error) return { data: null, error: result.error };
    if (!result.data) return { data: null, error: null };

    const row: any = result.data;
    const settingsMap = new Map<string, any>(
      (Array.isArray(row.branch_settings) ? row.branch_settings : []).map((item: any) => [String(item.branch_id), item])
    );
    const modifierLinksMap = new Map<string, any>(
      (Array.isArray(row.modifier_links) ? row.modifier_links : []).map((item: any) => [String(item.group_id), item])
    );

    const data: ProductAdminForm = {
      id: row.id,
      merchant_id: row.merchant_id,
      category_id: stringOrEmpty(row.category_id),
      sku: stringOrEmpty(row.sku),
      name: stringOrEmpty(row.name),
      description: stringOrEmpty(row.description),
      base_price: String(row.base_price ?? 0),
      image_url: stringOrEmpty(row.image_url),
      is_active: Boolean(row.is_active ?? true),
      sort_order: String(row.sort_order ?? 0),
      branch_settings: branches.map((branch) => {
        const existing = settingsMap.get(branch.id);
        return {
          id: existing?.id,
          branch_id: branch.id,
          branch_name: branch.name,
          price_override: existing?.price_override == null ? '' : String(existing.price_override),
          is_available: Boolean(existing?.is_available ?? true),
          is_paused: Boolean(existing?.is_paused ?? false),
          pause_reason: stringOrEmpty(existing?.pause_reason),
        };
      }),
      modifier_groups: modifierGroups.map((group, index) => {
        const existing = group.id ? modifierLinksMap.get(group.id) : null;
        return {
          id: existing?.id,
          group_id: group.id ?? '',
          group_name: group.name,
          min_select: group.min_select,
          max_select: group.max_select,
          is_required: group.is_required,
          is_active: group.is_active,
          sort_order: String(existing?.sort_order ?? index),
          selected: Boolean(existing),
          options: group.options,
        };
      }),
    };

    return { data, error: null };
  },

  saveProduct: async (merchantId: string, form: ProductAdminForm) => {
    const productPayload = {
      merchant_id: merchantId,
      category_id: nullableString(form.category_id),
      sku: nullableString(form.sku),
      name: form.name.trim(),
      description: nullableString(form.description),
      base_price: Number(form.base_price || 0),
      image_url: nullableString(form.image_url),
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
    };

    let productId = form.id ?? null;
    if (productId) {
      const updateProduct = await supabase.from('products').update(productPayload).eq('id', productId).select().single();
      if (updateProduct.error) return updateProduct;
    } else {
      const insertProduct = await supabase.from('products').insert(productPayload).select().single();
      if (insertProduct.error) return insertProduct;
      productId = (insertProduct.data as any)?.id ?? null;
    }

    if (!productId) {
      return { data: null, error: new Error('No se pudo resolver el producto') };
    }

    for (const setting of form.branch_settings) {
      const payload = {
        product_id: productId,
        branch_id: setting.branch_id,
        price_override: setting.price_override.trim() ? Number(setting.price_override) : null,
        is_available: setting.is_available,
        is_paused: setting.is_paused,
        pause_reason: nullableString(setting.pause_reason),
      };

      if (setting.id) {
        const updateSetting = await supabase.from('product_branch_settings').update(payload).eq('id', setting.id);
        if (updateSetting.error) return updateSetting;
      } else if (
        payload.price_override !== null ||
        payload.is_available !== true ||
        payload.is_paused !== false ||
        payload.pause_reason !== null
      ) {
        const insertSetting = await supabase.from('product_branch_settings').insert(payload);
        if (insertSetting.error) return insertSetting;
      }
    }

    const existingLinks = await supabase.from('product_modifier_groups').select('id, group_id').eq('product_id', productId);
    if (existingLinks.error) return existingLinks;

    const selectedGroupIds = new Set(
      form.modifier_groups.filter((group) => group.selected && group.group_id).map((group) => group.group_id)
    );
    const linkIdsToDelete = (existingLinks.data ?? [])
      .filter((row: any) => !selectedGroupIds.has(String(row.group_id)))
      .map((row: any) => row.id);

    if (linkIdsToDelete.length > 0) {
      const deleteLinks = await supabase.from('product_modifier_groups').delete().in('id', linkIdsToDelete);
      if (deleteLinks.error) return deleteLinks;
    }

    for (const group of form.modifier_groups) {
      if (!group.selected || !group.group_id) continue;
      const payload = {
        product_id: productId,
        group_id: group.group_id,
        sort_order: Number(group.sort_order || 0),
      };

      const existing = (existingLinks.data ?? []).find((row: any) => String(row.group_id) === group.group_id);
      if (existing?.id) {
        const updateLink = await supabase.from('product_modifier_groups').update(payload).eq('id', existing.id);
        if (updateLink.error) return updateLink;
      } else {
        const insertLink = await supabase.from('product_modifier_groups').insert(payload);
        if (insertLink.error) return insertLink;
      }
    }

    return { data: { id: productId }, error: null };
  },

  fetchRoles: async () => {
    const result = await supabase.from('roles').select('id, code, name').order('name', { ascending: true });
    if (result.error) return { data: null, error: result.error };
    return { data: mapRoleRows((result.data ?? []) as any[]), error: null };
  },

  fetchAssignableProfiles: async (_merchantId: string) => {
    const [staffResult, profilesResult] = await Promise.all([
      supabase.from('merchant_staff').select('user_id'),
      supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, default_role, is_active')
        .order('full_name', { ascending: true })
        .order('email', { ascending: true }),
    ]);

    if (staffResult.error) return { data: null, error: staffResult.error };
    if (profilesResult.error) return { data: null, error: profilesResult.error };

    const assignedUserIds = new Set(((staffResult.data ?? []) as any[]).map((row) => String(row.user_id)).filter(Boolean));
    const data: StaffAssignableProfile[] = ((profilesResult.data ?? []) as any[])
      .filter((row) => !assignedUserIds.has(String(row.user_id)))
      .map((row) => ({
        user_id: String(row.user_id),
        full_name: stringOrEmpty(row.full_name),
        email: stringOrEmpty(row.email),
        phone: stringOrEmpty(row.phone),
        default_role: stringOrEmpty(row.default_role) || 'customer',
        is_active: Boolean(row.is_active ?? true),
      }))
      .sort((left, right) => {
        const leftLabel = (left.full_name || left.email || left.user_id).toLowerCase();
        const rightLabel = (right.full_name || right.email || right.user_id).toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      });

    return { data, error: null };
  },

  fetchStaff: async (merchantId: string) => {
    const staffResult = await supabase
      .from('merchant_staff')
      .select('id, user_id, staff_role, is_active, branch_id, last_login_at')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: true });

    if (staffResult.error) return { data: null, error: staffResult.error };

    const staffRows = (staffResult.data ?? []) as any[];
    const userIds = uniqueIds(staffRows.map((row) => String(row.user_id)).filter(Boolean));
    const staffIds = uniqueIds(staffRows.map((row) => String(row.id)).filter(Boolean));

    const [profilesResult, relationsResult, userRolesResult] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email, phone, default_role, is_active').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null } as any),
      staffIds.length > 0
        ? supabase.from('merchant_staff_branches').select('id, merchant_staff_id, branch_id, is_primary').in('merchant_staff_id', staffIds)
        : Promise.resolve({ data: [], error: null } as any),
      userIds.length > 0
        ? supabase.from('user_roles').select('id, user_id, role_id').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (profilesResult.error) return { data: null, error: profilesResult.error };
    if (relationsResult.error) return { data: null, error: relationsResult.error };
    if (userRolesResult.error) return { data: null, error: userRolesResult.error };

    const relationRows = (relationsResult.data ?? []) as any[];
    const branchIds = uniqueIds(relationRows.map((row) => String(row.branch_id)).filter(Boolean));
    const roleIds = uniqueIds(((userRolesResult.data ?? []) as any[]).map((row) => String(row.role_id)).filter(Boolean));

    const [branchesResult, rolesResult] = await Promise.all([
      branchIds.length > 0
        ? supabase.from('merchant_branches').select('id, name').in('id', branchIds)
        : Promise.resolve({ data: [], error: null } as any),
      roleIds.length > 0
        ? supabase.from('roles').select('id, code, name').in('id', roleIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (branchesResult.error) return { data: null, error: branchesResult.error };
    if (rolesResult.error) return { data: null, error: rolesResult.error };

    const profileMap = new Map<string, any>((profilesResult.data ?? []).map((row: any) => [String(row.user_id), row]));
    const branchMap = new Map<string, string>((branchesResult.data ?? []).map((row: any) => [String(row.id), stringOrEmpty(row.name)]));
    const roleMap = new Map<string, RoleAdminRecord>(mapRoleRows((rolesResult.data ?? []) as any[]).map((row) => [row.id, row]));

    const data: StaffAdminRecord[] = staffRows.map((row) => {
      const profile = profileMap.get(String(row.user_id));
      const relations = relationRows.filter((item) => String(item.merchant_staff_id) === String(row.id));
      const sortedRelations = [...relations].sort((left, right) => {
        const leftPrimary = Boolean(left.is_primary);
        const rightPrimary = Boolean(right.is_primary);
        if (leftPrimary === rightPrimary) return 0;
        return leftPrimary ? -1 : 1;
      });
      const primaryBranchId =
        String(sortedRelations.find((item) => Boolean(item.is_primary))?.branch_id ?? row.branch_id ?? '') || '';
      const branchIdsForRow = uniqueIds(sortedRelations.map((item) => String(item.branch_id)).filter(Boolean));
      const branchLabels = branchIdsForRow.map((branchId) => branchMap.get(branchId)).filter(Boolean) as string[];
      const userRoleRows = ((userRolesResult.data ?? []) as any[]).filter((item) => String(item.user_id) === String(row.user_id));
      const userRoleIds = uniqueIds(userRoleRows.map((item) => String(item.role_id)).filter(Boolean));
      const resolvedRoles = userRoleIds.map((roleId) => roleMap.get(roleId)).filter(Boolean) as RoleAdminRecord[];
      const profileIsActive = Boolean(profile?.is_active ?? true);

      return {
        id: String(row.id),
        user_id: String(row.user_id),
        full_name: stringOrEmpty(profile?.full_name) || 'Sin nombre',
        email: stringOrEmpty(profile?.email),
        phone: stringOrEmpty(profile?.phone),
        default_role: stringOrEmpty(profile?.default_role) || 'customer',
        role: stringOrEmpty(row.staff_role) || 'staff',
        is_active: Boolean(row.is_active ?? true) && profileIsActive,
        branch_ids: branchIdsForRow,
        primary_branch_id: branchIdsForRow.includes(primaryBranchId) ? primaryBranchId : branchIdsForRow[0] ?? '',
        branch_labels: branchLabels,
        user_role_ids: userRoleIds,
        user_role_codes: resolvedRoles.map((role) => role.code),
        user_role_labels: resolvedRoles.map((role) => role.name),
        last_login_at: stringOrEmpty(row.last_login_at),
      };
    });

    return { data, error: null };
  },

  saveStaff: async (merchantId: string, form: StaffAdminForm) => {
    const normalizedBranchIds = uniqueIds(form.branch_ids);
    const primaryBranchId = normalizedBranchIds.includes(form.primary_branch_id)
      ? form.primary_branch_id
      : normalizedBranchIds[0] ?? '';

    let staffId = form.id ?? null;
    let userId = form.user_id;

    if (staffId) {
      const existingStaffResult = await supabase
        .from('merchant_staff')
        .select('id, user_id')
        .eq('id', staffId)
        .maybeSingle();

      if (existingStaffResult.error) return { data: null, error: existingStaffResult.error };
      if (!existingStaffResult.data) {
        return { data: null, error: new Error('No se encontro el personal seleccionado') };
      }

      userId = String((existingStaffResult.data as any).user_id);

      const updateStaff = await supabase
        .from('merchant_staff')
        .update({
          staff_role: form.role,
          is_active: form.is_active,
          branch_id: nullableString(primaryBranchId),
        })
        .eq('id', staffId)
        .select('id')
        .single();

      if (updateStaff.error) return updateStaff;
    } else {
      const insertStaff = await supabase
        .from('merchant_staff')
        .insert({
          user_id: userId,
          merchant_id: merchantId,
          staff_role: form.role,
          is_active: form.is_active,
          branch_id: nullableString(primaryBranchId),
        })
        .select('id')
        .single();

      if (insertStaff.error) return insertStaff;
      staffId = String((insertStaff.data as any)?.id ?? '');
    }

    if (!staffId || !userId) {
      return { data: null, error: new Error('No se pudo resolver el usuario interno') };
    }

    const updateProfile = await supabase
      .from('profiles')
      .update({
        full_name: nullableString(form.full_name),
        phone: nullableString(form.phone),
        default_role: form.default_role,
        is_active: form.is_active,
      })
      .eq('user_id', userId)
      .select('user_id')
      .single();

    if (updateProfile.error) return updateProfile;

    const deleteRelations = await supabase.from('merchant_staff_branches').delete().eq('merchant_staff_id', staffId);
    if (deleteRelations.error) return deleteRelations;

    if (normalizedBranchIds.length > 0) {
      const insertRelations = await supabase.from('merchant_staff_branches').insert(
        normalizedBranchIds.map((branchId) => ({
          merchant_staff_id: staffId,
          branch_id: branchId,
          is_primary: branchId === primaryBranchId,
        }))
      );

      if (insertRelations.error) return insertRelations;
    }

    const syncRolesResult = await syncUserRolesForUser(userId, form.user_role_ids);
    if (syncRolesResult.error) return syncRolesResult;

    return { data: { id: staffId }, error: null };
  },

  fetchOrders: async (branchId: string) => {
    const result = await supabase
      .from('orders')
      .select(`
        id,
        order_code,
        status,
        total,
        placed_at,
        payment_method:payment_methods(name),
        customer:customers(user_id),
        delivery:order_delivery_details(address_snapshot, recipient_name)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (result.error) return { data: null, error: result.error };

    const customerIds = (result.data ?? []).map((row: any) => row.customer?.user_id).filter(Boolean);
    const profilesResult = customerIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', customerIds)
      : ({ data: [], error: null } as any);

    if (profilesResult.error) return { data: null, error: profilesResult.error };
    const profileMap = new Map<string, any>((profilesResult.data ?? []).map((row: any) => [row.user_id, row]));

    const data: OrderAdminRecord[] = (result.data ?? []).map((row: any) => ({
      id: row.id,
      order_code: stringOrEmpty(row.order_code || row.id),
      status: stringOrEmpty(row.status),
      total: Number(row.total ?? 0),
      customer_label: stringOrEmpty(profileMap.get(row.customer?.user_id)?.full_name) || stringOrEmpty(row.delivery?.recipient_name) || 'Cliente',
      payment_label: stringOrEmpty(row.payment_method?.name) || 'Sin metodo',
      placed_at: stringOrEmpty(row.placed_at || row.created_at),
      address_label: stringOrEmpty(row.delivery?.address_snapshot) || 'Sin direccion',
    }));

    return { data, error: null };
  },
};
