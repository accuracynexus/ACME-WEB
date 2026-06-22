import { supabase } from '../../integrations/supabase/client';

export interface OrderAdminRecord {
  id: string;
  order_code: string;
  status: string;
  payment_status: string;
  fulfillment_type: string;
  total: number;
  customer_label: string;
  payment_label: string;
  driver_label: string;
  placed_at: string;
  address_label: string;
}

export interface OrderAdminItemModifier {
  id: string;
  option_name_snapshot: string;
  price_delta: number;
  quantity: number;
}

export interface OrderAdminItem {
  id: string;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  notes: string;
  line_total: number;
  modifiers: OrderAdminItemModifier[];
}

export interface OrderAdminDeliveryDetail {
  order_id: string;
  address_snapshot: string;
  reference_snapshot: string;
  district_snapshot: string;
  city_snapshot: string;
  region_snapshot: string;
  lat: string;
  lng: string;
  recipient_name: string;
  recipient_phone: string;
  estimated_distance_km: string;
  estimated_time_min: string;
}

export interface OrderAdminStatusHistory {
  id: string;
  from_status: string;
  to_status: string;
  actor_type: string;
  actor_user_label: string;
  note: string;
  created_at: string;
}

export interface OrderAdminAssignment {
  id: string;
  driver_id: string;
  driver_label: string;
  driver_status: string;
  is_online: boolean;
  reason: string;
  status: string;
  assigned_at: string;
  accepted_at: string;
  rejected_at: string;
  picked_up_at: string;
  completed_at: string;
}

export interface OrderAdminCancellation {
  id: string;
  actor_type: string;
  cancelled_by_label: string;
  reason_code: string;
  reason_text: string;
  refund_amount: number;
  created_at: string;
}

export interface OrderAdminIncident {
  id: string;
  driver_id: string;
  driver_label: string;
  incident_type: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at: string;
}

export interface OrderAdminEvidence {
  id: string;
  driver_id: string;
  driver_label: string;
  evidence_type: string;
  file_url: string;
  note: string;
  created_at: string;
}

export interface OrderAdminPaymentTransaction {
  id: string;
  payment_id: string;
  transaction_type: string;
  amount: number;
  provider_transaction_id: string;
  status: string;
  request_json: string;
  response_json: string;
  created_at: string;
}

export interface OrderAdminPayment {
  id: string;
  payment_method_id: string;
  payment_method_label: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  external_reference: string;
  requested_at: string;
  authorized_at: string;
  captured_at: string;
  failed_at: string;
}

export interface OrderAdminRefund {
  id: string;
  payment_id: string;
  payment_label: string;
  amount: number;
  reason: string;
  status: string;
  requested_at: string;
  processed_at: string;
}

export interface OrderAdminDriverOption {
  driver_id: string;
  label: string;
  status: string;
  is_online: boolean;
  vehicle_label: string;
}

export interface OrderAdminPaymentMethodOption {
  id: string;
  code: string;
  name: string;
  is_online: boolean;
}

export interface OrderAdminDetail {
  id: string;
  order_code: string;
  status: string;
  payment_status: string;
  fulfillment_type: string;
  special_instructions: string;
  currency: string;
  subtotal: number;
  discount_total: number;
  coupon_discount_total: number;
  delivery_fee: number;
  service_fee: number;
  tax_amount: number;
  tip_amount: number;
  total: number;
  cash_change_for: string;
  placed_at: string;
  accepted_at: string;
  preparing_at: string;
  ready_at: string;
  picked_up_at: string;
  delivered_at: string;
  cancelled_at: string;
  customer_id: string;
  customer_label: string;
  current_driver_id: string;
  current_driver_label: string;
  zone_name: string;
  coupon_code: string;
  payment_method_id: string;
  payment_method_label: string;
  items: OrderAdminItem[];
  delivery_detail: OrderAdminDeliveryDetail | null;
  history: OrderAdminStatusHistory[];
  assignments: OrderAdminAssignment[];
  cancellations: OrderAdminCancellation[];
  incidents: OrderAdminIncident[];
  evidences: OrderAdminEvidence[];
  payments: OrderAdminPayment[];
  payment_transactions: OrderAdminPaymentTransaction[];
  refunds: OrderAdminRefund[];
  available_drivers: OrderAdminDriverOption[];
  payment_methods: OrderAdminPaymentMethodOption[];
}

export interface OrderAdminStatusUpdateForm {
  next_status: string;
  note: string;
}

export interface OrderAdminDeliveryForm {
  address_snapshot: string;
  reference_snapshot: string;
  district_snapshot: string;
  city_snapshot: string;
  region_snapshot: string;
  lat: string;
  lng: string;
  recipient_name: string;
  recipient_phone: string;
  estimated_distance_km: string;
  estimated_time_min: string;
}

export interface OrderAdminAssignmentForm {
  id?: string;
  driver_id: string;
  status: string;
  reason: string;
}

export interface OrderAdminCancellationForm {
  reason_code: string;
  reason_text: string;
  refund_amount: string;
}

export interface OrderAdminIncidentForm {
  id?: string;
  driver_id: string;
  incident_type: string;
  description: string;
  status: string;
}

export interface OrderAdminEvidenceForm {
  driver_id: string;
  evidence_type: string;
  file_url: string;
  note: string;
}

export interface OrderAdminPaymentForm {
  id?: string;
  payment_method_id: string;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  external_reference: string;
}

export interface OrderAdminPaymentTransactionForm {
  payment_id: string;
  transaction_type: string;
  amount: string;
  provider_transaction_id: string;
  status: string;
  request_json: string;
  response_json: string;
}

export interface OrderAdminRefundForm {
  payment_id: string;
  amount: string;
  reason: string;
  status: string;
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function createProfileLabelMap(rows: any[]) {
  return new Map<string, string>(
    rows.map((row) => [
      String(row.user_id),
      stringOrEmpty(row.full_name) || stringOrEmpty(row.email) || String(row.user_id),
    ])
  );
}

function getOrderTimestampPatch(nextStatus: string, now: string) {
  const status = String(nextStatus).toLowerCase();

  if (status === 'confirmed' || status === 'accepted') {
    return { accepted_at: now };
  }
  if (status === 'preparing') {
    return { preparing_at: now };
  }
  if (status === 'ready') {
    return { ready_at: now };
  }
  if (status === 'on_the_way') {
    return { picked_up_at: now };
  }
  if (status === 'delivered') {
    return { delivered_at: now };
  }
  if (status === 'cancelled' || status === 'rejected') {
    return { cancelled_at: now };
  }

  return {};
}

async function fetchDriverDirectory(merchantId?: string | null) {
  const scopedToMerchant = merchantId !== undefined;
  const normalizedMerchantId = stringOrEmpty(merchantId);
  let allowedDriverIds: string[] = [];

  if (scopedToMerchant) {
    if (!normalizedMerchantId) {
      return { data: [], error: null };
    }

    const merchantOrdersResult = await supabase.from('orders').select('id, current_driver_id').eq('merchant_id', normalizedMerchantId);
    if (merchantOrdersResult.error) return { data: null, error: merchantOrdersResult.error };

    const merchantOrderRows = (merchantOrdersResult.data ?? []) as any[];
    const orderIds = uniqueStrings(merchantOrderRows.map((row) => stringOrEmpty(row.id)).filter(Boolean));
    const currentDriverIds = uniqueStrings(merchantOrderRows.map((row) => stringOrEmpty(row.current_driver_id)).filter(Boolean));
    const assignmentsResult =
      orderIds.length > 0
        ? await supabase.from('order_assignments').select('driver_id').in('order_id', orderIds)
        : ({ data: [], error: null } as any);

    if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
    allowedDriverIds = uniqueStrings([
      ...currentDriverIds,
      ...(((assignmentsResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.driver_id)).filter(Boolean)),
    ]);
  }

  if (scopedToMerchant && allowedDriverIds.length === 0) {
    return { data: [], error: null };
  }

  const [driversResult, profilesResult, statesResult, vehiclesResult] = await Promise.all([
    scopedToMerchant
      ? supabase.from('drivers').select('user_id, status').in('user_id', allowedDriverIds).order('joined_at', { ascending: true })
      : supabase.from('drivers').select('user_id, status').order('joined_at', { ascending: true }),
    scopedToMerchant
      ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', allowedDriverIds)
      : supabase.from('profiles').select('user_id, full_name, email'),
    scopedToMerchant
      ? supabase.from('driver_current_state').select('driver_id, status, is_online').in('driver_id', allowedDriverIds)
      : supabase.from('driver_current_state').select('driver_id, status, is_online'),
    scopedToMerchant
      ? supabase.from('vehicles').select('driver_id, plate, brand, model, is_active').in('driver_id', allowedDriverIds)
      : supabase.from('vehicles').select('driver_id, plate, brand, model, is_active'),
  ]);

  if (driversResult.error) return { data: null, error: driversResult.error };
  if (profilesResult.error) return { data: null, error: profilesResult.error };
  if (statesResult.error) return { data: null, error: statesResult.error };
  if (vehiclesResult.error) return { data: null, error: vehiclesResult.error };

  const profileMap = new Map<string, any>((profilesResult.data ?? []).map((row: any) => [String(row.user_id), row]));
  const stateMap = new Map<string, any>((statesResult.data ?? []).map((row: any) => [String(row.driver_id), row]));
  const vehicleRows = (vehiclesResult.data ?? []) as any[];

  const data: OrderAdminDriverOption[] = ((driversResult.data ?? []) as any[]).map((row) => {
    const driverId = String(row.user_id);
    const profile = profileMap.get(driverId);
    const currentState = stateMap.get(driverId);
    const activeVehicle = vehicleRows.find((vehicle) => String(vehicle.driver_id) === driverId && Boolean(vehicle.is_active));
    const vehicleLabel = [stringOrEmpty(activeVehicle?.brand), stringOrEmpty(activeVehicle?.model), stringOrEmpty(activeVehicle?.plate)]
      .filter(Boolean)
      .join(' ');

    return {
      driver_id: driverId,
      label: stringOrEmpty(profile?.full_name) || stringOrEmpty(profile?.email) || driverId,
      status: stringOrEmpty(currentState?.status) || stringOrEmpty(row.status) || 'offline',
      is_online: Boolean(currentState?.is_online ?? false),
      vehicle_label: vehicleLabel,
    };
  });

  return { data, error: null };
}

export const adminOrdersService = {
  createEmptyDeliveryForm: (): OrderAdminDeliveryForm => ({
    address_snapshot: '',
    reference_snapshot: '',
    district_snapshot: '',
    city_snapshot: '',
    region_snapshot: '',
    lat: '',
    lng: '',
    recipient_name: '',
    recipient_phone: '',
    estimated_distance_km: '',
    estimated_time_min: '',
  }),

  createEmptyAssignmentForm: (): OrderAdminAssignmentForm => ({
    driver_id: '',
    status: 'assigned',
    reason: '',
  }),

  createEmptyCancellationForm: (): OrderAdminCancellationForm => ({
    reason_code: 'customer_request',
    reason_text: '',
    refund_amount: '',
  }),

  createEmptyIncidentForm: (): OrderAdminIncidentForm => ({
    driver_id: '',
    incident_type: 'customer_issue',
    description: '',
    status: 'open',
  }),

  createEmptyEvidenceForm: (): OrderAdminEvidenceForm => ({
    driver_id: '',
    evidence_type: 'delivery_proof',
    file_url: '',
    note: '',
  }),

  createEmptyPaymentForm: (total = 0, currency = 'PEN'): OrderAdminPaymentForm => ({
    payment_method_id: '',
    amount: String(total || 0),
    currency,
    status: 'pending',
    provider: '',
    external_reference: '',
  }),

  createEmptyTransactionForm: (): OrderAdminPaymentTransactionForm => ({
    payment_id: '',
    transaction_type: 'capture',
    amount: '',
    provider_transaction_id: '',
    status: 'pending',
    request_json: '',
    response_json: '',
  }),

  createEmptyRefundForm: (): OrderAdminRefundForm => ({
    payment_id: '',
    amount: '',
    reason: '',
    status: 'requested',
  }),

  createDeliveryForm(detail: OrderAdminDeliveryDetail | null): OrderAdminDeliveryForm {
    if (!detail) {
      return adminOrdersService.createEmptyDeliveryForm();
    }

    return {
      address_snapshot: detail.address_snapshot,
      reference_snapshot: detail.reference_snapshot,
      district_snapshot: detail.district_snapshot,
      city_snapshot: detail.city_snapshot,
      region_snapshot: detail.region_snapshot,
      lat: detail.lat,
      lng: detail.lng,
      recipient_name: detail.recipient_name,
      recipient_phone: detail.recipient_phone,
      estimated_distance_km: detail.estimated_distance_km,
      estimated_time_min: detail.estimated_time_min,
    };
  },

  createPaymentForm(payment: OrderAdminPayment | null, fallbackTotal = 0, fallbackCurrency = 'PEN'): OrderAdminPaymentForm {
    if (!payment) {
      return adminOrdersService.createEmptyPaymentForm(fallbackTotal, fallbackCurrency);
    }

    return {
      id: payment.id,
      payment_method_id: payment.payment_method_id,
      amount: String(payment.amount),
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      external_reference: payment.external_reference,
    };
  },

  createAssignmentForm(assignment: OrderAdminAssignment | null): OrderAdminAssignmentForm {
    if (!assignment) {
      return adminOrdersService.createEmptyAssignmentForm();
    }

    return {
      id: assignment.id,
      driver_id: assignment.driver_id,
      status: assignment.status || 'assigned',
      reason: assignment.reason,
    };
  },

  createIncidentForm(incident: OrderAdminIncident | null): OrderAdminIncidentForm {
    if (!incident) {
      return adminOrdersService.createEmptyIncidentForm();
    }

    return {
      id: incident.id,
      driver_id: incident.driver_id,
      incident_type: incident.incident_type,
      description: incident.description,
      status: incident.status,
    };
  },

  fetchOrders: async (branchId: string) => {
    const ordersResult = await supabase
      .from('orders')
      .select('id, order_code, status, payment_status, fulfillment_type, total, placed_at, customer_id, payment_method_id, current_driver_id')
      .eq('branch_id', branchId)
      .order('placed_at', { ascending: false });

    if (ordersResult.error) return { data: null, error: ordersResult.error };

    const orderRows = (ordersResult.data ?? []) as any[];
    const orderIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.id)).filter(Boolean));
    const customerIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.customer_id)).filter(Boolean));
    const paymentMethodIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.payment_method_id)).filter(Boolean));
    const driverIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.current_driver_id)).filter(Boolean));

    const [profilesResult, deliveryResult, paymentMethodsResult, driverProfilesResult] = await Promise.all([
      customerIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', customerIds)
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0
        ? supabase.from('order_delivery_details').select('order_id, address_snapshot, recipient_name').in('order_id', orderIds)
        : Promise.resolve({ data: [], error: null } as any),
      paymentMethodIds.length > 0
        ? supabase.from('payment_methods').select('id, name').in('id', paymentMethodIds)
        : Promise.resolve({ data: [], error: null } as any),
      driverIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', driverIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (profilesResult.error) return { data: null, error: profilesResult.error };
    if (deliveryResult.error) return { data: null, error: deliveryResult.error };
    if (paymentMethodsResult.error) return { data: null, error: paymentMethodsResult.error };
    if (driverProfilesResult.error) return { data: null, error: driverProfilesResult.error };

    const customerMap = createProfileLabelMap((profilesResult.data ?? []) as any[]);
    const driverMap = createProfileLabelMap((driverProfilesResult.data ?? []) as any[]);
    const deliveryMap = new Map<string, any>((deliveryResult.data ?? []).map((row: any) => [String(row.order_id), row]));
    const paymentMethodMap = new Map<string, string>((paymentMethodsResult.data ?? []).map((row: any) => [String(row.id), stringOrEmpty(row.name)]));

    const data: OrderAdminRecord[] = orderRows.map((row) => {
      const delivery = deliveryMap.get(String(row.id));
      return {
        id: String(row.id),
        order_code: stringOrEmpty(row.order_code ?? row.id),
        status: stringOrEmpty(row.status),
        payment_status: stringOrEmpty(row.payment_status),
        fulfillment_type: stringOrEmpty(row.fulfillment_type) || 'delivery',
        total: numberOrZero(row.total),
        customer_label: customerMap.get(stringOrEmpty(row.customer_id)) || stringOrEmpty(delivery?.recipient_name) || 'Cliente',
        payment_label: paymentMethodMap.get(stringOrEmpty(row.payment_method_id)) || 'Sin metodo',
        driver_label: driverMap.get(stringOrEmpty(row.current_driver_id)) || '',
        placed_at: stringOrEmpty(row.placed_at),
        address_label: stringOrEmpty(delivery?.address_snapshot) || 'Sin direccion',
      };
    });

    return { data, error: null };
  },

  fetchOrderDetail: async (orderId: string, branchId: string) => {
    const orderResult = await supabase.from('orders').select('*').eq('id', orderId).eq('branch_id', branchId).maybeSingle();
    if (orderResult.error) return { data: null, error: orderResult.error };
    if (!orderResult.data) return { data: null, error: null };

    const orderRow: any = orderResult.data;

    const [
      itemsResult,
      deliveryResult,
      historyResult,
      assignmentsResult,
      cancellationsResult,
      incidentsResult,
      evidencesResult,
      paymentsResult,
      refundsResult,
      paymentMethodsResult,
      couponResult,
      zoneResult,
      driverDirectoryResult,
    ] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
      supabase.from('order_delivery_details').select('*').eq('order_id', orderId).maybeSingle(),
      supabase.from('order_status_history').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
      supabase.from('order_assignments').select('*').eq('order_id', orderId).order('assigned_at', { ascending: false }),
      supabase.from('order_cancellations').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      supabase.from('order_incidents').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      supabase.from('order_evidences').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('order_id', orderId).order('requested_at', { ascending: false }),
      supabase.from('refunds').select('*').eq('order_id', orderId).order('requested_at', { ascending: false }),
      supabase.from('payment_methods').select('id, code, name, is_online').eq('is_active', true).order('name', { ascending: true }),
      orderRow.coupon_id ? supabase.from('coupons').select('id, code').eq('id', orderRow.coupon_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
      orderRow.zone_id ? supabase.from('delivery_zones').select('id, name').eq('id', orderRow.zone_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
      fetchDriverDirectory(stringOrEmpty(orderRow.merchant_id) || null),
    ]);

    if (itemsResult.error) return { data: null, error: itemsResult.error };
    if (deliveryResult.error) return { data: null, error: deliveryResult.error };
    if (historyResult.error) return { data: null, error: historyResult.error };
    if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
    if (cancellationsResult.error) return { data: null, error: cancellationsResult.error };
    if (incidentsResult.error) return { data: null, error: incidentsResult.error };
    if (evidencesResult.error) return { data: null, error: evidencesResult.error };
    if (paymentsResult.error) return { data: null, error: paymentsResult.error };
    if (refundsResult.error) return { data: null, error: refundsResult.error };
    if (paymentMethodsResult.error) return { data: null, error: paymentMethodsResult.error };
    if (couponResult.error) return { data: null, error: couponResult.error };
    if (zoneResult.error) return { data: null, error: zoneResult.error };
    if (driverDirectoryResult.error) return { data: null, error: driverDirectoryResult.error };

    const itemRows = (itemsResult.data ?? []) as any[];
    const itemIds = uniqueStrings(itemRows.map((row) => stringOrEmpty(row.id)).filter(Boolean));
    const paymentRows = (paymentsResult.data ?? []) as any[];
    const paymentIds = uniqueStrings(paymentRows.map((row) => stringOrEmpty(row.id)).filter(Boolean));
    const actorUserIds = uniqueStrings(
      [
        ...((historyResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.actor_user_id)).filter(Boolean),
        ...((cancellationsResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.cancelled_by_user_id)).filter(Boolean),
        stringOrEmpty(orderRow.customer_id),
      ].filter(Boolean)
    );

    const [modifiersResult, transactionsResult, profilesResult] = await Promise.all([
      itemIds.length > 0
        ? supabase.from('order_item_modifiers').select('*').in('order_item_id', itemIds)
        : Promise.resolve({ data: [], error: null } as any),
      paymentIds.length > 0
        ? supabase.from('payment_transactions').select('*').in('payment_id', paymentIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
      actorUserIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', actorUserIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (modifiersResult.error) return { data: null, error: modifiersResult.error };
    if (transactionsResult.error) return { data: null, error: transactionsResult.error };
    if (profilesResult.error) return { data: null, error: profilesResult.error };

    const modifierRows = (modifiersResult.data ?? []) as any[];
    const driverDirectory = driverDirectoryResult.data ?? [];
    const driverMap = new Map<string, OrderAdminDriverOption>(driverDirectory.map((row) => [row.driver_id, row]));
    const paymentMethodMap = new Map<string, OrderAdminPaymentMethodOption>(
      ((paymentMethodsResult.data ?? []) as any[]).map((row) => [
        String(row.id),
        {
          id: String(row.id),
          code: stringOrEmpty(row.code),
          name: stringOrEmpty(row.name),
          is_online: Boolean(row.is_online ?? false),
        },
      ])
    );
    const paymentLabelMap = new Map<string, string>(
      paymentRows.map((row) => [String(row.id), paymentMethodMap.get(stringOrEmpty(row.payment_method_id))?.name || 'Sin metodo'])
    );
    const profileLabelMap = createProfileLabelMap((profilesResult.data ?? []) as any[]);

    const items: OrderAdminItem[] = itemRows.map((row) => ({
      id: String(row.id),
      product_name_snapshot: stringOrEmpty(row.product_name_snapshot) || 'Producto',
      unit_price: numberOrZero(row.unit_price),
      quantity: numberOrZero(row.quantity),
      notes: stringOrEmpty(row.notes),
      line_total: numberOrZero(row.line_total),
      modifiers: modifierRows
        .filter((modifier) => String(modifier.order_item_id) === String(row.id))
        .map((modifier) => ({
          id: String(modifier.id),
          option_name_snapshot: stringOrEmpty(modifier.option_name_snapshot) || 'Modificador',
          price_delta: numberOrZero(modifier.price_delta),
          quantity: numberOrZero(modifier.quantity),
        })),
    }));

    const deliveryDetail: OrderAdminDeliveryDetail | null = deliveryResult.data
      ? {
          order_id: String((deliveryResult.data as any).order_id),
          address_snapshot: stringOrEmpty((deliveryResult.data as any).address_snapshot),
          reference_snapshot: stringOrEmpty((deliveryResult.data as any).reference_snapshot),
          district_snapshot: stringOrEmpty((deliveryResult.data as any).district_snapshot),
          city_snapshot: stringOrEmpty((deliveryResult.data as any).city_snapshot),
          region_snapshot: stringOrEmpty((deliveryResult.data as any).region_snapshot),
          lat: stringOrEmpty((deliveryResult.data as any).lat),
          lng: stringOrEmpty((deliveryResult.data as any).lng),
          recipient_name: stringOrEmpty((deliveryResult.data as any).recipient_name),
          recipient_phone: stringOrEmpty((deliveryResult.data as any).recipient_phone),
          estimated_distance_km: stringOrEmpty((deliveryResult.data as any).estimated_distance_km),
          estimated_time_min: stringOrEmpty((deliveryResult.data as any).estimated_time_min),
        }
      : null;

    const history: OrderAdminStatusHistory[] = ((historyResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      from_status: stringOrEmpty(row.from_status),
      to_status: stringOrEmpty(row.to_status),
      actor_type: stringOrEmpty(row.actor_type) || 'system',
      actor_user_label: profileLabelMap.get(stringOrEmpty(row.actor_user_id)) || stringOrEmpty(row.actor_type) || 'Sistema',
      note: stringOrEmpty(row.note),
      created_at: stringOrEmpty(row.created_at),
    }));

    const assignments: OrderAdminAssignment[] = ((assignmentsResult.data ?? []) as any[]).map((row) => {
      const driver = driverMap.get(stringOrEmpty(row.driver_id));
      return {
        id: String(row.id),
        driver_id: stringOrEmpty(row.driver_id),
        driver_label: driver?.label || String(row.driver_id || 'Sin repartidor'),
        driver_status: driver?.status || '',
        is_online: Boolean(driver?.is_online ?? false),
        reason: stringOrEmpty(row.reason),
        status: stringOrEmpty(row.status),
        assigned_at: stringOrEmpty(row.assigned_at),
        accepted_at: stringOrEmpty(row.accepted_at),
        rejected_at: stringOrEmpty(row.rejected_at),
        picked_up_at: stringOrEmpty(row.picked_up_at),
        completed_at: stringOrEmpty(row.completed_at),
      };
    });

    const cancellations: OrderAdminCancellation[] = ((cancellationsResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      actor_type: stringOrEmpty(row.actor_type),
      cancelled_by_label: profileLabelMap.get(stringOrEmpty(row.cancelled_by_user_id)) || stringOrEmpty(row.actor_type) || 'Sistema',
      reason_code: stringOrEmpty(row.reason_code),
      reason_text: stringOrEmpty(row.reason_text),
      refund_amount: numberOrZero(row.refund_amount),
      created_at: stringOrEmpty(row.created_at),
    }));

    const incidents: OrderAdminIncident[] = ((incidentsResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      driver_id: stringOrEmpty(row.driver_id),
      driver_label: driverMap.get(stringOrEmpty(row.driver_id))?.label || '',
      incident_type: stringOrEmpty(row.incident_type),
      description: stringOrEmpty(row.description),
      status: stringOrEmpty(row.status),
      created_at: stringOrEmpty(row.created_at),
      resolved_at: stringOrEmpty(row.resolved_at),
    }));

    const evidences: OrderAdminEvidence[] = ((evidencesResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      driver_id: stringOrEmpty(row.driver_id),
      driver_label: driverMap.get(stringOrEmpty(row.driver_id))?.label || '',
      evidence_type: stringOrEmpty(row.evidence_type),
      file_url: stringOrEmpty(row.file_url),
      note: stringOrEmpty(row.note),
      created_at: stringOrEmpty(row.created_at),
    }));

    const payments: OrderAdminPayment[] = paymentRows.map((row) => ({
      id: String(row.id),
      payment_method_id: stringOrEmpty(row.payment_method_id),
      payment_method_label: paymentMethodMap.get(stringOrEmpty(row.payment_method_id))?.name || 'Sin metodo',
      amount: numberOrZero(row.amount),
      currency: stringOrEmpty(row.currency) || 'PEN',
      status: stringOrEmpty(row.status),
      provider: stringOrEmpty(row.provider),
      external_reference: stringOrEmpty(row.external_reference),
      requested_at: stringOrEmpty(row.requested_at),
      authorized_at: stringOrEmpty(row.authorized_at),
      captured_at: stringOrEmpty(row.captured_at),
      failed_at: stringOrEmpty(row.failed_at),
    }));

    const paymentTransactions: OrderAdminPaymentTransaction[] = ((transactionsResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      payment_id: stringOrEmpty(row.payment_id),
      transaction_type: stringOrEmpty(row.transaction_type),
      amount: numberOrZero(row.amount),
      provider_transaction_id: stringOrEmpty(row.provider_transaction_id),
      status: stringOrEmpty(row.status),
      request_json: row.request_json == null ? '' : JSON.stringify(row.request_json, null, 2),
      response_json: row.response_json == null ? '' : JSON.stringify(row.response_json, null, 2),
      created_at: stringOrEmpty(row.created_at),
    }));

    const refunds: OrderAdminRefund[] = ((refundsResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      payment_id: stringOrEmpty(row.payment_id),
      payment_label: paymentLabelMap.get(String(row.payment_id)) || 'Pago no asociado',
      amount: numberOrZero(row.amount),
      reason: stringOrEmpty(row.reason),
      status: stringOrEmpty(row.status),
      requested_at: stringOrEmpty(row.requested_at),
      processed_at: stringOrEmpty(row.processed_at),
    }));

    const detail: OrderAdminDetail = {
      id: String(orderRow.id),
      order_code: stringOrEmpty(orderRow.order_code ?? orderRow.id),
      status: stringOrEmpty(orderRow.status),
      payment_status: stringOrEmpty(orderRow.payment_status),
      fulfillment_type: stringOrEmpty(orderRow.fulfillment_type),
      special_instructions: stringOrEmpty(orderRow.special_instructions),
      currency: stringOrEmpty(orderRow.currency) || 'PEN',
      subtotal: numberOrZero(orderRow.subtotal),
      discount_total: numberOrZero(orderRow.discount_total),
      coupon_discount_total: numberOrZero(orderRow.coupon_discount_total),
      delivery_fee: numberOrZero(orderRow.delivery_fee),
      service_fee: numberOrZero(orderRow.service_fee),
      tax_amount: numberOrZero(orderRow.tax_amount),
      tip_amount: numberOrZero(orderRow.tip_amount),
      total: numberOrZero(orderRow.total),
      cash_change_for: stringOrEmpty(orderRow.cash_change_for),
      placed_at: stringOrEmpty(orderRow.placed_at || orderRow.created_at),
      accepted_at: stringOrEmpty(orderRow.accepted_at),
      preparing_at: stringOrEmpty(orderRow.preparing_at),
      ready_at: stringOrEmpty(orderRow.ready_at),
      picked_up_at: stringOrEmpty(orderRow.picked_up_at),
      delivered_at: stringOrEmpty(orderRow.delivered_at),
      cancelled_at: stringOrEmpty(orderRow.cancelled_at),
      customer_id: stringOrEmpty(orderRow.customer_id),
      customer_label: profileLabelMap.get(stringOrEmpty(orderRow.customer_id)) || deliveryDetail?.recipient_name || 'Cliente',
      current_driver_id: stringOrEmpty(orderRow.current_driver_id),
      current_driver_label: driverMap.get(stringOrEmpty(orderRow.current_driver_id))?.label || '',
      zone_name: stringOrEmpty((zoneResult.data as any)?.name),
      coupon_code: stringOrEmpty((couponResult.data as any)?.code),
      payment_method_id: stringOrEmpty(orderRow.payment_method_id),
      payment_method_label: paymentMethodMap.get(stringOrEmpty(orderRow.payment_method_id))?.name || 'Sin metodo',
      items,
      delivery_detail: deliveryDetail,
      history,
      assignments,
      cancellations,
      incidents,
      evidences,
      payments,
      payment_transactions: paymentTransactions,
      refunds,
      available_drivers: driverDirectory,
      payment_methods: Array.from(paymentMethodMap.values()),
    };

    return { data: detail, error: null };
  },

  updateOrderStatus: async (orderId: string, actorUserId: string | null, form: OrderAdminStatusUpdateForm) => {
    const currentOrderResult = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (currentOrderResult.error) return { data: null, error: currentOrderResult.error };
    if (!currentOrderResult.data) return { data: null, error: new Error('No se encontro el pedido') };

    const now = new Date().toISOString();
    const nextStatus = form.next_status.trim();
    const updateResult = await supabase
      .from('orders')
      .update({
        status: nextStatus,
        updated_at: now,
        ...getOrderTimestampPatch(nextStatus, now),
      })
      .eq('id', orderId)
      .select('id')
      .single();

    if (updateResult.error) return updateResult;

    const historyResult = await supabase.from('order_status_history').insert({
      order_id: orderId,
      from_status: stringOrEmpty((currentOrderResult.data as any).status),
      to_status: nextStatus,
      actor_user_id: actorUserId,
      actor_type: 'merchant_staff',
      note: nullableString(form.note),
      created_at: now,
    });

    if (historyResult.error) return historyResult;
    return { data: updateResult.data, error: null };
  },

  upsertOrderDelivery: async (orderId: string, form: OrderAdminDeliveryForm) => {
    const now = new Date().toISOString();
    const payload = {
      order_id: orderId,
      address_snapshot: nullableString(form.address_snapshot),
      reference_snapshot: nullableString(form.reference_snapshot),
      district_snapshot: nullableString(form.district_snapshot),
      city_snapshot: nullableString(form.city_snapshot),
      region_snapshot: nullableString(form.region_snapshot),
      lat: stringNumberOrNull(form.lat),
      lng: stringNumberOrNull(form.lng),
      recipient_name: nullableString(form.recipient_name),
      recipient_phone: nullableString(form.recipient_phone),
      estimated_distance_km: stringNumberOrNull(form.estimated_distance_km),
      estimated_time_min: stringNumberOrNull(form.estimated_time_min),
      updated_at: now,
    };

    const updateResult = await supabase.from('order_delivery_details').update(payload).eq('order_id', orderId).select();
    if (updateResult.error) return updateResult;

    if ((updateResult.data ?? []).length > 0) {
      return { data: updateResult.data, error: null };
    }

    return supabase.from('order_delivery_details').insert({
      ...payload,
      created_at: now,
    });
  },

  saveAssignment: async (orderId: string, form: OrderAdminAssignmentForm) => {
    const now = new Date().toISOString();
    const basePayload = {
      order_id: orderId,
      driver_id: form.driver_id,
      status: form.status,
      reason: nullableString(form.reason),
      assigned_at: form.status === 'assigned' ? now : null,
      accepted_at: form.status === 'accepted' ? now : null,
      rejected_at: form.status === 'rejected' ? now : null,
      picked_up_at: form.status === 'picked_up' ? now : null,
      completed_at: form.status === 'completed' ? now : null,
    };

    let assignmentId = form.id ?? '';
    if (form.id) {
      const updateAssignment = await supabase.from('order_assignments').update(basePayload).eq('id', form.id).select('id').single();
      if (updateAssignment.error) return updateAssignment;
      assignmentId = String((updateAssignment.data as any)?.id ?? form.id);
    } else {
      const insertAssignment = await supabase.from('order_assignments').insert(basePayload).select('id').single();
      if (insertAssignment.error) return insertAssignment;
      assignmentId = String((insertAssignment.data as any)?.id ?? '');
    }

    const updateOrder = await supabase
      .from('orders')
      .update({ current_driver_id: nullableString(form.driver_id), updated_at: now })
      .eq('id', orderId)
      .select('id')
      .single();

    if (updateOrder.error) return updateOrder;
    return { data: { id: assignmentId }, error: null };
  },

  cancelOrder: async (orderId: string, actorUserId: string | null, form: OrderAdminCancellationForm) => {
    const currentOrderResult = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (currentOrderResult.error) return { data: null, error: currentOrderResult.error };
    if (!currentOrderResult.data) return { data: null, error: new Error('No se encontro el pedido') };

    const now = new Date().toISOString();
    const updateOrder = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', orderId)
      .select('id')
      .single();

    if (updateOrder.error) return updateOrder;

    const cancellationInsert = await supabase.from('order_cancellations').insert({
      order_id: orderId,
      cancelled_by_user_id: actorUserId,
      actor_type: 'merchant_staff',
      reason_code: nullableString(form.reason_code),
      reason_text: nullableString(form.reason_text),
      refund_amount: stringNumberOrNull(form.refund_amount),
      created_at: now,
    });

    if (cancellationInsert.error) return cancellationInsert;

    const historyInsert = await supabase.from('order_status_history').insert({
      order_id: orderId,
      from_status: stringOrEmpty((currentOrderResult.data as any).status),
      to_status: 'cancelled',
      actor_user_id: actorUserId,
      actor_type: 'merchant_staff',
      note: nullableString(form.reason_text),
      created_at: now,
    });

    if (historyInsert.error) return historyInsert;
    return { data: updateOrder.data, error: null };
  },

  saveIncident: async (orderId: string, form: OrderAdminIncidentForm) => {
    const payload = {
      order_id: orderId,
      driver_id: nullableString(form.driver_id),
      incident_type: form.incident_type.trim(),
      description: nullableString(form.description),
      status: form.status.trim(),
      resolved_at: form.status === 'resolved' ? new Date().toISOString() : null,
    };

    if (form.id) {
      return supabase.from('order_incidents').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase
      .from('order_incidents')
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
  },

  saveEvidence: async (orderId: string, form: OrderAdminEvidenceForm) => {
    return supabase
      .from('order_evidences')
      .insert({
        order_id: orderId,
        driver_id: nullableString(form.driver_id),
        evidence_type: form.evidence_type.trim(),
        file_url: nullableString(form.file_url),
        note: nullableString(form.note),
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
  },

  upsertPayment: async (orderId: string, customerId: string, form: OrderAdminPaymentForm) => {
    const now = new Date().toISOString();

    // Seguridad: no permitir que un administrador apruebe manualmente un pago online.
    // El estado de pagos Culqi solo puede actualizarse desde el webhook /api/webhooks/culqi.
    // Solo se permiten pagos manuales para métodos offline (efectivo, transferencia, etc.).
    const requestedStatus = form.status.trim();
    const isOnlineProvider = (form.provider || '').toLowerCase() === 'culqi';
    if (isOnlineProvider && requestedStatus === 'paid') {
      return {
        data: null,
        error: {
          message: 'Los pagos con Culqi solo pueden marcarse como pagados a través del webhook de confirmación. No se permite aprobación manual.',
          code: 'FORBIDDEN',
        } as any,
      };
    }

    const payload = {
      order_id: orderId,
      customer_id: nullableString(customerId),
      payment_method_id: nullableString(form.payment_method_id),
      amount: numberOrZero(form.amount),
      currency: form.currency.trim() || 'PEN',
      status: requestedStatus,
      provider: nullableString(form.provider),
      external_reference: nullableString(form.external_reference),
      updated_at: now,
      requested_at: now,
    };

    let paymentId = form.id ?? '';
    if (form.id) {
      const updatePayment = await supabase.from('payments').update(payload).eq('id', form.id).select('id').single();
      if (updatePayment.error) return updatePayment;
      paymentId = String((updatePayment.data as any)?.id ?? form.id);
    } else {
      const insertPayment = await supabase
        .from('payments')
        .insert({
          ...payload,
          created_at: now,
        })
        .select('id')
        .single();
      if (insertPayment.error) return insertPayment;
      paymentId = String((insertPayment.data as any)?.id ?? '');
    }

    const orderUpdate = await supabase
      .from('orders')
      .update({
        payment_method_id: nullableString(form.payment_method_id),
        payment_status: form.status.trim(),
        updated_at: now,
      })
      .eq('id', orderId)
      .select('id')
      .single();

    if (orderUpdate.error) return orderUpdate;
    return { data: { id: paymentId }, error: null };
  },

  savePaymentTransaction: async (form: OrderAdminPaymentTransactionForm) => {
    let requestJson: unknown = null;
    let responseJson: unknown = null;

    if (form.request_json.trim()) {
      requestJson = JSON.parse(form.request_json);
    }
    if (form.response_json.trim()) {
      responseJson = JSON.parse(form.response_json);
    }

    const payload = {
      payment_id: form.payment_id,
      transaction_type: form.transaction_type.trim(),
      amount: numberOrZero(form.amount),
      provider_transaction_id: nullableString(form.provider_transaction_id),
      status: form.status.trim(),
      request_json: requestJson,
      response_json: responseJson,
      created_at: new Date().toISOString(),
    };

    const insertTransaction = await supabase.from('payment_transactions').insert(payload).select('id').single();
    if (insertTransaction.error) return insertTransaction;

    const paymentUpdate = await supabase
      .from('payments')
      .update({
        status: form.status.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', form.payment_id);

    if (paymentUpdate.error) return paymentUpdate;
    return { data: insertTransaction.data, error: null };
  },

  saveRefund: async (orderId: string, form: OrderAdminRefundForm) => {
    return supabase
      .from('refunds')
      .insert({
        order_id: orderId,
        payment_id: nullableString(form.payment_id),
        amount: numberOrZero(form.amount),
        reason: nullableString(form.reason),
        status: form.status.trim(),
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single();
  },
};
