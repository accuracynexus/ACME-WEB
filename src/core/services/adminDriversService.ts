import { supabase } from '../../integrations/supabase/client';

export interface DriverAdminRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  status: string;
  is_verified: boolean;
  rating_avg: number;
  vehicle_type_label: string;
  active_vehicle_label: string;
  current_state_status: string;
  is_online: boolean;
  current_order_code: string;
  recent_assignments_count: number;
  pending_cash_total: number;
  last_seen_at: string;
  joined_at: string;
}

export interface DriverAssignableProfile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
}

export interface DriverVehicleTypeOption {
  id: string;
  code: string;
  name: string;
}

export interface DriverDocumentRecord {
  id: string;
  document_type: string;
  document_number: string;
  file_url: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface DriverVehicleRecord {
  id: string;
  vehicle_type_id: string;
  vehicle_type_label: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverShiftRecord {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
}

export interface DriverLocationRecord {
  id: string;
  order_id: string;
  order_code: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_kmh: number;
  heading: number;
  recorded_at: string;
}

export interface DriverCashCollectionRecord {
  id: string;
  order_id: string;
  order_code: string;
  amount_collected: number;
  status: string;
  collected_at: string;
  settled_at: string;
}

export interface DriverSettlementItemRecord {
  id: string;
  settlement_id: string;
  order_id: string;
  order_code: string;
  earning_amount: number;
  bonus_amount: number;
  penalty_amount: number;
  net_amount: number;
  created_at: string;
}

export interface DriverSettlementRecord {
  id: string;
  period_start: string;
  period_end: string;
  deliveries_count: number;
  gross_earnings: number;
  bonuses: number;
  penalties: number;
  cash_collected: number;
  net_payable: number;
  status: string;
  generated_at: string;
  paid_at: string;
  created_at: string;
  updated_at: string;
  items: DriverSettlementItemRecord[];
}

export interface DriverAssignmentRecord {
  id: string;
  order_id: string;
  order_code: string;
  branch_label: string;
  status: string;
  assigned_at: string;
  accepted_at: string;
  rejected_at: string;
  picked_up_at: string;
  completed_at: string;
  reason: string;
}

export interface DriverOrderOption {
  id: string;
  label: string;
}

export interface DriverAdminDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  status: string;
  is_verified: boolean;
  rating_avg: number;
  document_number: string;
  license_number: string;
  vehicle_type_id: string;
  vehicle_type_label: string;
  joined_at: string;
  updated_at: string;
  current_state_status: string;
  is_online: boolean;
  current_order_id: string;
  current_order_code: string;
  last_lat: string;
  last_lng: string;
  last_seen_at: string;
  documents: DriverDocumentRecord[];
  vehicles: DriverVehicleRecord[];
  shifts: DriverShiftRecord[];
  locations: DriverLocationRecord[];
  assignments: DriverAssignmentRecord[];
  cash_collections: DriverCashCollectionRecord[];
  settlements: DriverSettlementRecord[];
  vehicle_type_options: DriverVehicleTypeOption[];
  order_options: DriverOrderOption[];
}

export interface DriverRootForm {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  document_number: string;
  license_number: string;
  vehicle_type_id: string;
  status: string;
  is_verified: boolean;
}

export interface DriverStateForm {
  status: string;
  is_online: boolean;
}

export interface DriverDocumentForm {
  id?: string;
  document_type: string;
  document_number: string;
  file_url: string;
  status: string;
  expires_at: string;
}

export interface DriverVehicleForm {
  id?: string;
  vehicle_type_id: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  is_active: boolean;
}

export interface DriverShiftForm {
  id?: string;
  start_at: string;
  end_at: string;
  status: string;
}

export interface DriverCashCollectionForm {
  id?: string;
  order_id: string;
  amount_collected: string;
  status: string;
  collected_at: string;
  settled_at: string;
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function nullableString(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function numberOrZero(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringNumberOrNull(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// String(null) devuelve "null", que pasa el filter(Boolean) y llega a los
// .in() como si fuera un uuid: Postgres responde
// "invalid input syntax for type uuid". Pasa con cualquier FK opcional
// (current_order_id, order_id, branch_id) cuando viene vacia.
function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => Boolean(value) && value !== 'null' && value !== 'undefined')));
}

function createProfileLabel(row: any) {
  return stringOrEmpty(row?.full_name) || stringOrEmpty(row?.email) || stringOrEmpty(row?.user_id);
}

export const adminDriversService = {
  createEmptyRootForm: (): DriverRootForm => ({
    user_id: '',
    full_name: '',
    email: '',
    phone: '',
    is_active: true,
    document_number: '',
    license_number: '',
    vehicle_type_id: '',
    status: 'pending',
    is_verified: false,
  }),

  createEmptyStateForm: (): DriverStateForm => ({
    status: 'offline',
    is_online: false,
  }),

  createEmptyDocumentForm: (): DriverDocumentForm => ({
    document_type: 'license',
    document_number: '',
    file_url: '',
    status: 'pending',
    expires_at: '',
  }),

  createEmptyVehicleForm: (): DriverVehicleForm => ({
    vehicle_type_id: '',
    plate: '',
    brand: '',
    model: '',
    color: '',
    is_active: true,
  }),

  createEmptyShiftForm: (): DriverShiftForm => ({
    start_at: '',
    end_at: '',
    status: 'scheduled',
  }),

  createEmptyCashCollectionForm: (): DriverCashCollectionForm => ({
    order_id: '',
    amount_collected: '',
    status: 'pending',
    collected_at: '',
    settled_at: '',
  }),

  createRootForm: (detail: DriverAdminDetail): DriverRootForm => ({
    user_id: detail.id,
    full_name: detail.full_name,
    email: detail.email,
    phone: detail.phone,
    is_active: detail.is_active,
    document_number: detail.document_number,
    license_number: detail.license_number,
    vehicle_type_id: detail.vehicle_type_id,
    status: detail.status,
    is_verified: detail.is_verified,
  }),

  createStateForm: (detail: DriverAdminDetail): DriverStateForm => ({
    status: detail.current_state_status || detail.status || 'offline',
    is_online: detail.is_online,
  }),

  createDocumentForm: (record: DriverDocumentRecord): DriverDocumentForm => ({
    id: record.id,
    document_type: record.document_type,
    document_number: record.document_number,
    file_url: record.file_url,
    status: record.status,
    expires_at: record.expires_at,
  }),

  createVehicleForm: (record: DriverVehicleRecord): DriverVehicleForm => ({
    id: record.id,
    vehicle_type_id: record.vehicle_type_id,
    plate: record.plate,
    brand: record.brand,
    model: record.model,
    color: record.color,
    is_active: record.is_active,
  }),

  createShiftForm: (record: DriverShiftRecord): DriverShiftForm => ({
    id: record.id,
    start_at: record.start_at,
    end_at: record.end_at,
    status: record.status,
  }),

  createCashCollectionForm: (record: DriverCashCollectionRecord): DriverCashCollectionForm => ({
    id: record.id,
    order_id: record.order_id,
    amount_collected: String(record.amount_collected || 0),
    status: record.status,
    collected_at: record.collected_at,
    settled_at: record.settled_at,
  }),

  fetchVehicleTypes: async () => {
    const result = await supabase.from('vehicle_types').select('id, code, name').order('name', { ascending: true });
    if (result.error) return { data: null, error: result.error };
    const data: DriverVehicleTypeOption[] = ((result.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      code: stringOrEmpty(row.code),
      name: stringOrEmpty(row.name),
    }));
    return { data, error: null };
  },

  fetchAssignableProfiles: async () => {
    const [profilesResult, driversResult] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, phone, is_active').order('full_name', { ascending: true }),
      supabase.from('drivers').select('user_id'),
    ]);

    if (profilesResult.error) return { data: null, error: profilesResult.error };
    if (driversResult.error) return { data: null, error: driversResult.error };

    const existingDriverIds = new Set<string>(((driversResult.data ?? []) as any[]).map((row) => String(row.user_id)));
    const data: DriverAssignableProfile[] = ((profilesResult.data ?? []) as any[])
      .filter((row) => !existingDriverIds.has(String(row.user_id)))
      .map((row) => ({
        user_id: String(row.user_id),
        full_name: stringOrEmpty(row.full_name),
        email: stringOrEmpty(row.email),
        phone: stringOrEmpty(row.phone),
        is_active: Boolean(row.is_active ?? true),
      }));

    return { data, error: null };
  },

  fetchDrivers: async () => {
    const [driversResult, vehicleTypesResult] = await Promise.all([
      supabase.from('drivers').select('*').order('joined_at', { ascending: false }),
      adminDriversService.fetchVehicleTypes(),
    ]);

    if (driversResult.error) return { data: null, error: driversResult.error };
    if (vehicleTypesResult.error) return { data: null, error: vehicleTypesResult.error };

    const driverRows = (driversResult.data ?? []) as any[];
    const driverIds = uniqueStrings(driverRows.map((row) => String(row.user_id)));
    if (driverIds.length === 0) {
      return { data: [] as DriverAdminRecord[], error: null };
    }

    const [profilesResult, stateResult, vehiclesResult, assignmentsResult, cashResult] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, phone, is_active').in('user_id', driverIds),
      supabase.from('driver_current_state').select('driver_id, status, is_online, current_order_id, last_seen_at').in('driver_id', driverIds),
      supabase.from('vehicles').select('id, driver_id, vehicle_type_id, plate, brand, model, is_active').in('driver_id', driverIds),
      supabase.from('order_assignments').select('driver_id, order_id').in('driver_id', driverIds),
      supabase.from('cash_collections').select('driver_id, amount_collected, status').in('driver_id', driverIds),
    ]);

    if (profilesResult.error) return { data: null, error: profilesResult.error };
    if (stateResult.error) return { data: null, error: stateResult.error };
    if (vehiclesResult.error) return { data: null, error: vehiclesResult.error };
    if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
    if (cashResult.error) return { data: null, error: cashResult.error };

    const currentOrderIds = uniqueStrings(((stateResult.data ?? []) as any[]).map((row) => String(row.current_order_id)).filter(Boolean));
    const currentOrdersResult =
      currentOrderIds.length > 0
        ? await supabase.from('orders').select('id, order_code').in('id', currentOrderIds)
        : ({ data: [], error: null } as any);

    if (currentOrdersResult.error) return { data: null, error: currentOrdersResult.error };

    const profileMap = new Map<string, any>(((profilesResult.data ?? []) as any[]).map((row) => [String(row.user_id), row]));
    const stateMap = new Map<string, any>(((stateResult.data ?? []) as any[]).map((row) => [String(row.driver_id), row]));
    const orderMap = new Map<string, string>(((currentOrdersResult.data ?? []) as any[]).map((row) => [String(row.id), stringOrEmpty(row.order_code || row.id)]));
    const vehicleTypeMap = new Map<string, DriverVehicleTypeOption>((vehicleTypesResult.data ?? []).map((row) => [row.id, row]));
    const vehicleRows = (vehiclesResult.data ?? []) as any[];
    const assignmentRows = (assignmentsResult.data ?? []) as any[];
    const cashRows = (cashResult.data ?? []) as any[];

    const data: DriverAdminRecord[] = driverRows.map((row) => {
      const driverId = String(row.user_id);
      const profile = profileMap.get(driverId);
      const currentState = stateMap.get(driverId);
      const activeVehicle = vehicleRows.find((vehicle) => String(vehicle.driver_id) === driverId && Boolean(vehicle.is_active));
      const vehicleType = vehicleTypeMap.get(stringOrEmpty(activeVehicle?.vehicle_type_id) || stringOrEmpty(row.vehicle_type_id));
      const activeVehicleLabel = [stringOrEmpty(activeVehicle?.brand), stringOrEmpty(activeVehicle?.model), stringOrEmpty(activeVehicle?.plate)]
        .filter(Boolean)
        .join(' ');

      return {
        id: driverId,
        full_name: createProfileLabel(profile),
        email: stringOrEmpty(profile?.email),
        phone: stringOrEmpty(profile?.phone),
        is_active: Boolean(profile?.is_active ?? true),
        status: stringOrEmpty(row.status) || 'pending',
        is_verified: Boolean(row.is_verified ?? false),
        rating_avg: numberOrZero(row.rating_avg),
        vehicle_type_label: vehicleType ? vehicleType.name : 'Sin tipo',
        active_vehicle_label: activeVehicleLabel || 'Sin vehiculo activo',
        current_state_status: stringOrEmpty(currentState?.status) || 'offline',
        is_online: Boolean(currentState?.is_online ?? false),
        current_order_code: orderMap.get(String(currentState?.current_order_id)) || '',
        recent_assignments_count: assignmentRows.filter((assignment) => String(assignment.driver_id) === driverId).length,
        pending_cash_total: cashRows
          .filter((cash) => String(cash.driver_id) === driverId && stringOrEmpty(cash.status).toLowerCase() !== 'settled')
          .reduce((sum, cash) => sum + numberOrZero(cash.amount_collected), 0),
        last_seen_at: stringOrEmpty(currentState?.last_seen_at),
        joined_at: stringOrEmpty(row.joined_at),
      };
    });

    return { data, error: null };
  },

  fetchDriverDetail: async (driverId: string) => {
    const [driverResult, profileResult, currentStateResult, documentsResult, vehiclesResult, shiftsResult, locationsResult, cashResult, settlementsResult, vehicleTypesResult, assignmentsResult] =
      await Promise.all([
        supabase.from('drivers').select('*').eq('user_id', driverId).maybeSingle(),
        supabase.from('profiles').select('user_id, full_name, email, phone, is_active').eq('user_id', driverId).maybeSingle(),
        supabase.from('driver_current_state').select('*').eq('driver_id', driverId).maybeSingle(),
        supabase.from('driver_documents').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }),
        supabase.from('driver_shifts').select('*').eq('driver_id', driverId).order('start_at', { ascending: false }),
        supabase.from('driver_locations').select('*').eq('driver_id', driverId).order('recorded_at', { ascending: false }).limit(25),
        supabase.from('cash_collections').select('*').eq('driver_id', driverId).order('collected_at', { ascending: false }),
        supabase.from('driver_settlements').select('*').eq('driver_id', driverId).order('period_start', { ascending: false }),
        adminDriversService.fetchVehicleTypes(),
        supabase.from('order_assignments').select('*').eq('driver_id', driverId).order('assigned_at', { ascending: false }).limit(25),
      ]);

    if (driverResult.error) return { data: null, error: driverResult.error };
    if (profileResult.error) return { data: null, error: profileResult.error };
    if (currentStateResult.error) return { data: null, error: currentStateResult.error };
    if (documentsResult.error) return { data: null, error: documentsResult.error };
    if (vehiclesResult.error) return { data: null, error: vehiclesResult.error };
    if (shiftsResult.error) return { data: null, error: shiftsResult.error };
    if (locationsResult.error) return { data: null, error: locationsResult.error };
    if (cashResult.error) return { data: null, error: cashResult.error };
    if (settlementsResult.error) return { data: null, error: settlementsResult.error };
    if (vehicleTypesResult.error) return { data: null, error: vehicleTypesResult.error };
    if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
    if (!driverResult.data || !profileResult.data) {
      return { data: null, error: null };
    }

    const driverRow: any = driverResult.data;
    const profileRow: any = profileResult.data;
    const currentState: any = currentStateResult.data;
    const documentsRows = (documentsResult.data ?? []) as any[];
    const vehicleRows = (vehiclesResult.data ?? []) as any[];
    const shiftRows = (shiftsResult.data ?? []) as any[];
    const locationRows = (locationsResult.data ?? []) as any[];
    const cashRows = (cashResult.data ?? []) as any[];
    const settlementRows = (settlementsResult.data ?? []) as any[];
    const assignmentRows = (assignmentsResult.data ?? []) as any[];

    const settlementIds = uniqueStrings(settlementRows.map((row) => String(row.id)).filter(Boolean));
    const orderIds = uniqueStrings([
      ...assignmentRows.map((row) => String(row.order_id)).filter(Boolean),
      ...cashRows.map((row) => String(row.order_id)).filter(Boolean),
      ...locationRows.map((row) => String(row.order_id)).filter(Boolean),
      ...[stringOrEmpty(currentState?.current_order_id)].filter(Boolean),
    ]);

    const settlementItemsResult =
      settlementIds.length > 0
        ? await supabase.from('driver_settlement_items').select('*').in('settlement_id', settlementIds).order('created_at', { ascending: true })
        : ({ data: [], error: null } as any);

    if (settlementItemsResult.error) return { data: null, error: settlementItemsResult.error };

    const settlementItemRows = (settlementItemsResult.data ?? []) as any[];
    const allOrderIds = uniqueStrings([...orderIds, ...settlementItemRows.map((row) => String(row.order_id)).filter(Boolean)]);

    const ordersResult =
      allOrderIds.length > 0
        ? await supabase.from('orders').select('id, order_code, branch_id').in('id', allOrderIds)
        : ({ data: [], error: null } as any);

    if (ordersResult.error) return { data: null, error: ordersResult.error };

    const branchIds = uniqueStrings(((ordersResult.data ?? []) as any[]).map((row) => String(row.branch_id)).filter(Boolean));
    const branchesResult =
      branchIds.length > 0
        ? await supabase.from('merchant_branches').select('id, name').in('id', branchIds)
        : ({ data: [], error: null } as any);

    if (branchesResult.error) return { data: null, error: branchesResult.error };

    const vehicleTypeMap = new Map<string, DriverVehicleTypeOption>((vehicleTypesResult.data ?? []).map((row) => [row.id, row]));
    const orderMap = new Map<string, any>(((ordersResult.data ?? []) as any[]).map((row) => [String(row.id), row]));
    const branchMap = new Map<string, string>(((branchesResult.data ?? []) as any[]).map((row) => [String(row.id), stringOrEmpty(row.name)]));

    const documents: DriverDocumentRecord[] = documentsRows.map((row) => ({
      id: String(row.id),
      document_type: stringOrEmpty(row.document_type),
      document_number: stringOrEmpty(row.document_number),
      file_url: stringOrEmpty(row.file_url),
      status: stringOrEmpty(row.status),
      expires_at: stringOrEmpty(row.expires_at),
      created_at: stringOrEmpty(row.created_at),
      updated_at: stringOrEmpty(row.updated_at),
    }));

    const vehicles: DriverVehicleRecord[] = vehicleRows.map((row) => ({
      id: String(row.id),
      vehicle_type_id: stringOrEmpty(row.vehicle_type_id),
      vehicle_type_label: vehicleTypeMap.get(String(row.vehicle_type_id))?.name || 'Sin tipo',
      plate: stringOrEmpty(row.plate),
      brand: stringOrEmpty(row.brand),
      model: stringOrEmpty(row.model),
      color: stringOrEmpty(row.color),
      is_active: Boolean(row.is_active ?? false),
      created_at: stringOrEmpty(row.created_at),
      updated_at: stringOrEmpty(row.updated_at),
    }));

    const shifts: DriverShiftRecord[] = shiftRows.map((row) => ({
      id: String(row.id),
      start_at: stringOrEmpty(row.start_at),
      end_at: stringOrEmpty(row.end_at),
      status: stringOrEmpty(row.status),
      created_at: stringOrEmpty(row.created_at),
    }));

    const locations: DriverLocationRecord[] = locationRows.map((row) => ({
      id: String(row.id),
      order_id: stringOrEmpty(row.order_id),
      order_code: stringOrEmpty(orderMap.get(String(row.order_id))?.order_code) || '',
      lat: numberOrZero(row.lat),
      lng: numberOrZero(row.lng),
      accuracy_m: numberOrZero(row.accuracy_m),
      speed_kmh: numberOrZero(row.speed_kmh),
      heading: numberOrZero(row.heading),
      recorded_at: stringOrEmpty(row.recorded_at),
    }));

    const assignments: DriverAssignmentRecord[] = assignmentRows.map((row) => {
      const order = orderMap.get(String(row.order_id));
      return {
        id: String(row.id),
        order_id: stringOrEmpty(row.order_id),
        order_code: stringOrEmpty(order?.order_code) || String(row.order_id),
        branch_label: branchMap.get(String(order?.branch_id)) || 'Sucursal',
        status: stringOrEmpty(row.status),
        assigned_at: stringOrEmpty(row.assigned_at),
        accepted_at: stringOrEmpty(row.accepted_at),
        rejected_at: stringOrEmpty(row.rejected_at),
        picked_up_at: stringOrEmpty(row.picked_up_at),
        completed_at: stringOrEmpty(row.completed_at),
        reason: stringOrEmpty(row.reason),
      };
    });

    const cashCollections: DriverCashCollectionRecord[] = cashRows.map((row) => ({
      id: String(row.id),
      order_id: stringOrEmpty(row.order_id),
      order_code: stringOrEmpty(orderMap.get(String(row.order_id))?.order_code) || String(row.order_id || ''),
      amount_collected: numberOrZero(row.amount_collected),
      status: stringOrEmpty(row.status),
      collected_at: stringOrEmpty(row.collected_at),
      settled_at: stringOrEmpty(row.settled_at),
    }));

    const settlements: DriverSettlementRecord[] = settlementRows.map((row) => ({
      id: String(row.id),
      period_start: stringOrEmpty(row.period_start),
      period_end: stringOrEmpty(row.period_end),
      deliveries_count: numberOrZero(row.deliveries_count),
      gross_earnings: numberOrZero(row.gross_earnings),
      bonuses: numberOrZero(row.bonuses),
      penalties: numberOrZero(row.penalties),
      cash_collected: numberOrZero(row.cash_collected),
      net_payable: numberOrZero(row.net_payable),
      status: stringOrEmpty(row.status),
      generated_at: stringOrEmpty(row.generated_at),
      paid_at: stringOrEmpty(row.paid_at),
      created_at: stringOrEmpty(row.created_at),
      updated_at: stringOrEmpty(row.updated_at),
      items: settlementItemRows
        .filter((item) => String(item.settlement_id) === String(row.id))
        .map((item) => ({
          id: String(item.id),
          settlement_id: String(item.settlement_id),
          order_id: stringOrEmpty(item.order_id),
          order_code: stringOrEmpty(orderMap.get(String(item.order_id))?.order_code) || String(item.order_id || ''),
          earning_amount: numberOrZero(item.earning_amount),
          bonus_amount: numberOrZero(item.bonus_amount),
          penalty_amount: numberOrZero(item.penalty_amount),
          net_amount: numberOrZero(item.net_amount),
          created_at: stringOrEmpty(item.created_at),
        })),
    }));

    const detail: DriverAdminDetail = {
      id: driverId,
      full_name: createProfileLabel(profileRow),
      email: stringOrEmpty(profileRow.email),
      phone: stringOrEmpty(profileRow.phone),
      is_active: Boolean(profileRow.is_active ?? true),
      status: stringOrEmpty(driverRow.status) || 'pending',
      is_verified: Boolean(driverRow.is_verified ?? false),
      rating_avg: numberOrZero(driverRow.rating_avg),
      document_number: stringOrEmpty(driverRow.document_number),
      license_number: stringOrEmpty(driverRow.license_number),
      vehicle_type_id: stringOrEmpty(driverRow.vehicle_type_id),
      vehicle_type_label: vehicleTypeMap.get(String(driverRow.vehicle_type_id))?.name || 'Sin tipo',
      joined_at: stringOrEmpty(driverRow.joined_at),
      updated_at: stringOrEmpty(driverRow.updated_at),
      current_state_status: stringOrEmpty(currentState?.status) || 'offline',
      is_online: Boolean(currentState?.is_online ?? false),
      current_order_id: stringOrEmpty(currentState?.current_order_id),
      current_order_code: stringOrEmpty(orderMap.get(String(currentState?.current_order_id))?.order_code),
      last_lat: stringOrEmpty(currentState?.last_lat),
      last_lng: stringOrEmpty(currentState?.last_lng),
      last_seen_at: stringOrEmpty(currentState?.last_seen_at),
      documents,
      vehicles,
      shifts,
      locations,
      assignments,
      cash_collections: cashCollections,
      settlements,
      vehicle_type_options: vehicleTypesResult.data ?? [],
      order_options: Array.from(orderMap.values()).map((row: any) => ({
        id: String(row.id),
        label: `#${stringOrEmpty(row.order_code || row.id)}`,
      })),
    };

    return { data: detail, error: null };
  },

  saveDriver: async (form: DriverRootForm) => {
    const now = new Date().toISOString();

    const profileUpdate = await supabase
      .from('profiles')
      .update({
        full_name: nullableString(form.full_name),
        phone: nullableString(form.phone),
        is_active: form.is_active,
        updated_at: now,
      })
      .eq('user_id', form.user_id)
      .select('user_id')
      .single();

    if (profileUpdate.error) return profileUpdate;

    const existingDriver = await supabase.from('drivers').select('user_id').eq('user_id', form.user_id).maybeSingle();
    if (existingDriver.error) return existingDriver;

    const payload = {
      user_id: form.user_id,
      document_number: nullableString(form.document_number),
      license_number: nullableString(form.license_number),
      vehicle_type_id: nullableString(form.vehicle_type_id),
      is_verified: form.is_verified,
      status: form.status.trim() || 'pending',
      updated_at: now,
    };

    if (existingDriver.data) {
      return supabase.from('drivers').update(payload).eq('user_id', form.user_id).select('user_id').single();
    }

    return supabase
      .from('drivers')
      .insert({
        ...payload,
        joined_at: now,
      })
      .select('user_id')
      .single();
  },

  saveDriverState: async (driverId: string, form: DriverStateForm) => {
    return supabase.from('driver_current_state').upsert(
      {
        driver_id: driverId,
        status: form.status.trim() || 'offline',
        is_online: form.is_online,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id' }
    );
  },

  saveDriverDocument: async (driverId: string, form: DriverDocumentForm) => {
    const now = new Date().toISOString();
    const payload = {
      driver_id: driverId,
      document_type: form.document_type.trim(),
      document_number: nullableString(form.document_number),
      file_url: nullableString(form.file_url),
      status: form.status.trim() || 'pending',
      expires_at: nullableString(form.expires_at),
      updated_at: now,
    };

    if (form.id) {
      return supabase.from('driver_documents').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase
      .from('driver_documents')
      .insert({
        ...payload,
        created_at: now,
      })
      .select('id')
      .single();
  },

  saveVehicle: async (driverId: string, form: DriverVehicleForm) => {
    const now = new Date().toISOString();

    if (form.is_active) {
      const clearActive = await supabase.from('vehicles').update({ is_active: false, updated_at: now }).eq('driver_id', driverId);
      if (clearActive.error) return clearActive;
    }

    const payload = {
      driver_id: driverId,
      vehicle_type_id: nullableString(form.vehicle_type_id),
      plate: nullableString(form.plate),
      brand: nullableString(form.brand),
      model: nullableString(form.model),
      color: nullableString(form.color),
      is_active: form.is_active,
      updated_at: now,
    };

    const result = form.id
      ? await supabase.from('vehicles').update(payload).eq('id', form.id).select('id').single()
      : await supabase
          .from('vehicles')
          .insert({
            ...payload,
            created_at: now,
          })
          .select('id')
          .single();

    if (result.error) return result;

    if (form.is_active && form.vehicle_type_id) {
      const driverUpdate = await supabase
        .from('drivers')
        .update({ vehicle_type_id: form.vehicle_type_id, updated_at: now })
        .eq('user_id', driverId);
      if (driverUpdate.error) return driverUpdate;
    }

    return { data: result.data, error: null };
  },

  saveShift: async (driverId: string, form: DriverShiftForm) => {
    const payload = {
      driver_id: driverId,
      start_at: nullableString(form.start_at),
      end_at: nullableString(form.end_at),
      status: form.status.trim() || 'scheduled',
    };

    if (form.id) {
      return supabase.from('driver_shifts').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase
      .from('driver_shifts')
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
  },

  saveCashCollection: async (driverId: string, form: DriverCashCollectionForm) => {
    const payload = {
      driver_id: driverId,
      order_id: nullableString(form.order_id),
      amount_collected: numberOrZero(form.amount_collected),
      status: form.status.trim() || 'pending',
      collected_at: nullableString(form.collected_at),
      settled_at: nullableString(form.settled_at),
    };

    if (form.id) {
      return supabase.from('cash_collections').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase
      .from('cash_collections')
      .insert(payload)
      .select('id')
      .single();
  },
};
