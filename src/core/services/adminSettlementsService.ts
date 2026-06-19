import { supabase } from '../../integrations/supabase/client';

export interface CommissionRuleScopeOption {
  id: string;
  label: string;
}

export interface CommissionRuleRecord {
  id: string;
  scope_type: string;
  scope_id: string;
  scope_label: string;
  who_pays: string;
  rule_type: string;
  value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export interface MerchantSettlementRecord {
  id: string;
  period_start: string;
  period_end: string;
  gross_sales: number;
  commission_amount: number;
  adjustments: number;
  net_payable: number;
  status: string;
  generated_at: string;
  paid_at: string;
  items_count: number;
}

export interface MerchantSettlementItemRecord {
  id: string;
  order_id: string;
  order_code: string;
  order_total: number;
  commission_amount: number;
  net_amount: number;
  created_at: string;
}

export interface DriverSettlementRecord {
  id: string;
  driver_id: string;
  driver_label: string;
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
  items_count: number;
}

export interface DriverSettlementItemRecord {
  id: string;
  order_id: string;
  order_code: string;
  earning_amount: number;
  bonus_amount: number;
  penalty_amount: number;
  net_amount: number;
  created_at: string;
}

export interface MerchantSettlementDetail {
  id: string;
  period_start: string;
  period_end: string;
  gross_sales: number;
  commission_amount: number;
  adjustments: number;
  net_payable: number;
  status: string;
  generated_at: string;
  paid_at: string;
  created_at: string;
  updated_at: string;
  items: MerchantSettlementItemRecord[];
}

export interface DriverSettlementDetail {
  id: string;
  driver_id: string;
  driver_label: string;
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

export interface SettlementsOverview {
  commission_rules: CommissionRuleRecord[];
  merchant_settlements: MerchantSettlementRecord[];
  driver_settlements: DriverSettlementRecord[];
  branch_options: CommissionRuleScopeOption[];
  driver_options: CommissionRuleScopeOption[];
}

export interface CommissionRuleForm {
  id?: string;
  scope_type: string;
  scope_id: string;
  who_pays: string;
  rule_type: string;
  value: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
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

async function fetchMerchantDriverIds(merchantId: string) {
  const merchantOrdersResult = await supabase.from('orders').select('id, current_driver_id').eq('merchant_id', merchantId);
  if (merchantOrdersResult.error) {
    return { data: null, error: merchantOrdersResult.error };
  }

  const merchantOrderRows = (merchantOrdersResult.data ?? []) as any[];
  const orderIds = uniqueStrings(merchantOrderRows.map((row) => stringOrEmpty(row.id)).filter(Boolean));
  const currentDriverIds = uniqueStrings(merchantOrderRows.map((row) => stringOrEmpty(row.current_driver_id)).filter(Boolean));
  const assignmentsResult =
    orderIds.length > 0
      ? await supabase.from('order_assignments').select('driver_id').in('order_id', orderIds)
      : ({ data: [], error: null } as any);

  if (assignmentsResult.error) {
    return { data: null, error: assignmentsResult.error };
  }

  return {
    data: uniqueStrings([
      ...currentDriverIds,
      ...(((assignmentsResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.driver_id)).filter(Boolean)),
    ]),
    error: null,
  };
}

function resolveRuleScopeLabel(
  scopeType: string,
  scopeId: string,
  merchantId: string,
  branchMap: Map<string, string>,
  driverMap: Map<string, string>
) {
  const normalized = scopeType.trim().toLowerCase();
  if (normalized === 'merchant') {
    return scopeId === merchantId ? 'Comercio actual' : 'Otro comercio';
  }
  if (normalized === 'branch') {
    return branchMap.get(scopeId) || 'Sucursal no encontrada';
  }
  if (normalized === 'driver') {
    return driverMap.get(scopeId) || 'Repartidor no encontrado';
  }
  if (normalized === 'global') {
    return 'Global';
  }
  return scopeId || 'Sin alcance';
}

function isRelevantRule(
  scopeType: string,
  scopeId: string,
  merchantId: string,
  branchIds: Set<string>,
  driverIds: Set<string>
) {
  const normalized = scopeType.trim().toLowerCase();
  if (normalized === 'merchant') return scopeId === merchantId;
  if (normalized === 'branch') return branchIds.has(scopeId);
  if (normalized === 'driver') return driverIds.has(scopeId);
  if (normalized === 'global') return true;
  return false;
}

async function fetchSettlementLookups(merchantId: string) {
  const relevantDriverIdsResult = await fetchMerchantDriverIds(merchantId);
  if (relevantDriverIdsResult.error) return { data: null, error: relevantDriverIdsResult.error };

  const relevantDriverIds = relevantDriverIdsResult.data ?? [];
  const [branchesResult, driversResult, profilesResult] = await Promise.all([
    supabase.from('merchant_branches').select('id, name').eq('merchant_id', merchantId).order('name', { ascending: true }),
    relevantDriverIds.length > 0
      ? supabase.from('drivers').select('user_id').in('user_id', relevantDriverIds).order('joined_at', { ascending: true })
      : Promise.resolve({ data: [], error: null } as any),
    relevantDriverIds.length > 0
      ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', relevantDriverIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (branchesResult.error) return { data: null, error: branchesResult.error };
  if (driversResult.error) return { data: null, error: driversResult.error };
  if (profilesResult.error) return { data: null, error: profilesResult.error };

  const branchOptions: CommissionRuleScopeOption[] = ((branchesResult.data ?? []) as any[]).map((row) => ({
    id: String(row.id),
    label: stringOrEmpty(row.name) || String(row.id),
  }));

  const profileMap = new Map<string, any>(((profilesResult.data ?? []) as any[]).map((row) => [String(row.user_id), row]));
  const driverOptions: CommissionRuleScopeOption[] = ((driversResult.data ?? []) as any[]).map((row) => {
    const profile = profileMap.get(String(row.user_id));
    return {
      id: String(row.user_id),
      label: stringOrEmpty(profile?.full_name) || stringOrEmpty(profile?.email) || String(row.user_id),
    };
  });

  return {
    data: {
      branchOptions,
      driverOptions,
      branchMap: new Map<string, string>(branchOptions.map((item) => [item.id, item.label])),
      driverMap: new Map<string, string>(driverOptions.map((item) => [item.id, item.label])),
    },
    error: null,
  };
}

export const adminSettlementsService = {
  createEmptyCommissionRuleForm: (): CommissionRuleForm => ({
    scope_type: 'merchant',
    scope_id: '',
    who_pays: 'merchant',
    rule_type: 'percent',
    value: '0',
    starts_at: '',
    ends_at: '',
    is_active: true,
  }),

  createCommissionRuleForm: (record: CommissionRuleRecord): CommissionRuleForm => ({
    id: record.id,
    scope_type: record.scope_type,
    scope_id: record.scope_id,
    who_pays: record.who_pays,
    rule_type: record.rule_type,
    value: String(record.value ?? 0),
    starts_at: record.starts_at,
    ends_at: record.ends_at,
    is_active: record.is_active,
  }),

  fetchSettlementsOverview: async (merchantId: string) => {
    const lookupsResult = await fetchSettlementLookups(merchantId);
    if (lookupsResult.error) return { data: null, error: lookupsResult.error };

    const { branchOptions, driverOptions, branchMap, driverMap } = lookupsResult.data!;
    const branchIds = new Set(branchOptions.map((item) => item.id));
    const driverIds = new Set(driverOptions.map((item) => item.id));

    const [rulesResult, merchantSettlementsResult, driverSettlementsResult] = await Promise.all([
      supabase.from('commission_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('merchant_settlements').select('*').eq('merchant_id', merchantId).order('period_start', { ascending: false }),
      supabase.from('driver_settlements').select('*').order('period_start', { ascending: false }),
    ]);

    if (rulesResult.error) return { data: null, error: rulesResult.error };
    if (merchantSettlementsResult.error) return { data: null, error: merchantSettlementsResult.error };
    if (driverSettlementsResult.error) return { data: null, error: driverSettlementsResult.error };

    const merchantRows = (merchantSettlementsResult.data ?? []) as any[];
    const driverRows = (driverSettlementsResult.data ?? []) as any[];

    const [merchantItemsResult, driverItemsResult] = await Promise.all([
      merchantRows.length > 0
        ? supabase.from('merchant_settlement_items').select('id, settlement_id').in('settlement_id', merchantRows.map((row) => row.id))
        : Promise.resolve({ data: [], error: null } as any),
      driverRows.length > 0
        ? supabase.from('driver_settlement_items').select('id, settlement_id').in('settlement_id', driverRows.map((row) => row.id))
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (merchantItemsResult.error) return { data: null, error: merchantItemsResult.error };
    if (driverItemsResult.error) return { data: null, error: driverItemsResult.error };

    const driverItemRows = (driverItemsResult.data ?? []) as any[];
    const driverOrderIds = uniqueStrings(driverItemRows.map((row) => stringOrEmpty(row.order_id)));
    const driverOrdersResult =
      driverOrderIds.length > 0
        ? await supabase.from('orders').select('id, merchant_id').in('id', driverOrderIds)
        : ({ data: [], error: null } as any);

    if (driverOrdersResult.error) return { data: null, error: driverOrdersResult.error };

    const driverOrderMap = new Map<string, string>(((driverOrdersResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), stringOrEmpty(row.merchant_id)]));
    const relevantDriverSettlementIds = new Set(
      driverItemRows
        .filter((row) => driverOrderMap.get(stringOrEmpty(row.order_id)) === merchantId)
        .map((row) => stringOrEmpty(row.settlement_id))
    );
    const filteredDriverRows = driverRows.filter((row) => relevantDriverSettlementIds.has(stringOrEmpty(row.id)));
    const filteredDriverItemRows = driverItemRows.filter((row) => relevantDriverSettlementIds.has(stringOrEmpty(row.settlement_id)));

    const commissionRules: CommissionRuleRecord[] = ((rulesResult.data ?? []) as any[])
      .filter((row) => isRelevantRule(stringOrEmpty(row.scope_type), stringOrEmpty(row.scope_id), merchantId, branchIds, driverIds))
      .map((row) => ({
        id: String(row.id),
        scope_type: stringOrEmpty(row.scope_type),
        scope_id: stringOrEmpty(row.scope_id),
        scope_label: resolveRuleScopeLabel(stringOrEmpty(row.scope_type), stringOrEmpty(row.scope_id), merchantId, branchMap, driverMap),
        who_pays: stringOrEmpty(row.who_pays),
        rule_type: stringOrEmpty(row.rule_type),
        value: numberOrZero(row.value),
        starts_at: stringOrEmpty(row.starts_at),
        ends_at: stringOrEmpty(row.ends_at),
        is_active: Boolean(row.is_active ?? false),
      }));

    const merchantSettlements: MerchantSettlementRecord[] = merchantRows.map((row) => ({
      id: String(row.id),
      period_start: stringOrEmpty(row.period_start),
      period_end: stringOrEmpty(row.period_end),
      gross_sales: numberOrZero(row.gross_sales),
      commission_amount: numberOrZero(row.commission_amount),
      adjustments: numberOrZero(row.adjustments),
      net_payable: numberOrZero(row.net_payable),
      status: stringOrEmpty(row.status),
      generated_at: stringOrEmpty(row.generated_at),
      paid_at: stringOrEmpty(row.paid_at),
      items_count: ((merchantItemsResult.data ?? []) as any[]).filter((item) => String(item.settlement_id) === String(row.id)).length,
    }));

    const driverSettlements: DriverSettlementRecord[] = filteredDriverRows.map((row) => ({
      id: String(row.id),
      driver_id: stringOrEmpty(row.driver_id),
      driver_label: driverMap.get(String(row.driver_id)) || String(row.driver_id || 'Sin repartidor'),
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
      items_count: filteredDriverItemRows.filter((item) => String(item.settlement_id) === String(row.id)).length,
    }));

    return {
      data: {
        commission_rules: commissionRules,
        merchant_settlements: merchantSettlements,
        driver_settlements: driverSettlements,
        branch_options: branchOptions,
        driver_options: driverOptions,
      } satisfies SettlementsOverview,
      error: null,
    };
  },

  fetchMerchantSettlementDetail: async (merchantId: string, settlementId: string) => {
    const [settlementResult, itemsResult] = await Promise.all([
      supabase.from('merchant_settlements').select('*').eq('id', settlementId).eq('merchant_id', merchantId).maybeSingle(),
      supabase.from('merchant_settlement_items').select('*').eq('settlement_id', settlementId).order('created_at', { ascending: true }),
    ]);

    if (settlementResult.error) return { data: null, error: settlementResult.error };
    if (itemsResult.error) return { data: null, error: itemsResult.error };
    if (!settlementResult.data) return { data: null, error: null };

    const itemRows = (itemsResult.data ?? []) as any[];
    const orderIds = uniqueStrings(itemRows.map((row) => String(row.order_id)).filter(Boolean));
    const ordersResult =
      orderIds.length > 0
        ? await supabase.from('orders').select('id, order_code').in('id', orderIds)
        : ({ data: [], error: null } as any);

    if (ordersResult.error) return { data: null, error: ordersResult.error };
    const orderMap = new Map<string, string>(((ordersResult.data ?? []) as any[]).map((row) => [String(row.id), stringOrEmpty(row.order_code || row.id)]));

    const settlement: any = settlementResult.data;
    const detail: MerchantSettlementDetail = {
      id: String(settlement.id),
      period_start: stringOrEmpty(settlement.period_start),
      period_end: stringOrEmpty(settlement.period_end),
      gross_sales: numberOrZero(settlement.gross_sales),
      commission_amount: numberOrZero(settlement.commission_amount),
      adjustments: numberOrZero(settlement.adjustments),
      net_payable: numberOrZero(settlement.net_payable),
      status: stringOrEmpty(settlement.status),
      generated_at: stringOrEmpty(settlement.generated_at),
      paid_at: stringOrEmpty(settlement.paid_at),
      created_at: stringOrEmpty(settlement.created_at),
      updated_at: stringOrEmpty(settlement.updated_at),
      items: itemRows.map((row) => ({
        id: String(row.id),
        order_id: stringOrEmpty(row.order_id),
        order_code: orderMap.get(String(row.order_id)) || String(row.order_id || ''),
        order_total: numberOrZero(row.order_total),
        commission_amount: numberOrZero(row.commission_amount),
        net_amount: numberOrZero(row.net_amount),
        created_at: stringOrEmpty(row.created_at),
      })),
    };

    return { data: detail, error: null };
  },

  fetchDriverSettlementDetail: async (merchantId: string, settlementId: string) => {
    const [settlementResult, itemsResult] = await Promise.all([
      supabase.from('driver_settlements').select('*').eq('id', settlementId).maybeSingle(),
      supabase.from('driver_settlement_items').select('*').eq('settlement_id', settlementId).order('created_at', { ascending: true }),
    ]);

    if (settlementResult.error) return { data: null, error: settlementResult.error };
    if (itemsResult.error) return { data: null, error: itemsResult.error };
    if (!settlementResult.data) return { data: null, error: null };

    const settlement: any = settlementResult.data;
    const itemRows = (itemsResult.data ?? []) as any[];
    const orderIds = uniqueStrings(itemRows.map((row) => String(row.order_id)).filter(Boolean));

    const [ordersResult, profileResult] = await Promise.all([
      orderIds.length > 0
        ? supabase.from('orders').select('id, order_code, merchant_id').in('id', orderIds)
        : Promise.resolve({ data: [], error: null } as any),
      settlement.driver_id
        ? supabase.from('profiles').select('user_id, full_name, email').eq('user_id', settlement.driver_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (ordersResult.error) return { data: null, error: ordersResult.error };
    if (profileResult.error) return { data: null, error: profileResult.error };

    const orderRows = (ordersResult.data ?? []) as any[];
    const isSettlementVisible =
      orderRows.length > 0 && orderRows.some((row) => stringOrEmpty(row.merchant_id) === merchantId);

    if (!isSettlementVisible) {
      return { data: null, error: null };
    }

    const orderMap = new Map<string, string>(orderRows.map((row) => [String(row.id), stringOrEmpty(row.order_code || row.id)]));
    const profile: any = profileResult.data;

    const detail: DriverSettlementDetail = {
      id: String(settlement.id),
      driver_id: stringOrEmpty(settlement.driver_id),
      driver_label: stringOrEmpty(profile?.full_name) || stringOrEmpty(profile?.email) || stringOrEmpty(settlement.driver_id),
      period_start: stringOrEmpty(settlement.period_start),
      period_end: stringOrEmpty(settlement.period_end),
      deliveries_count: numberOrZero(settlement.deliveries_count),
      gross_earnings: numberOrZero(settlement.gross_earnings),
      bonuses: numberOrZero(settlement.bonuses),
      penalties: numberOrZero(settlement.penalties),
      cash_collected: numberOrZero(settlement.cash_collected),
      net_payable: numberOrZero(settlement.net_payable),
      status: stringOrEmpty(settlement.status),
      generated_at: stringOrEmpty(settlement.generated_at),
      paid_at: stringOrEmpty(settlement.paid_at),
      created_at: stringOrEmpty(settlement.created_at),
      updated_at: stringOrEmpty(settlement.updated_at),
      items: itemRows.map((row) => ({
        id: String(row.id),
        order_id: stringOrEmpty(row.order_id),
        order_code: orderMap.get(String(row.order_id)) || String(row.order_id || ''),
        earning_amount: numberOrZero(row.earning_amount),
        bonus_amount: numberOrZero(row.bonus_amount),
        penalty_amount: numberOrZero(row.penalty_amount),
        net_amount: numberOrZero(row.net_amount),
        created_at: stringOrEmpty(row.created_at),
      })),
    };

    return { data: detail, error: null };
  },

  saveCommissionRule: async (merchantId: string, form: CommissionRuleForm) => {
    const now = new Date().toISOString();
    const normalizedScopeType = form.scope_type.trim().toLowerCase();
    const payload = {
      scope_type: normalizedScopeType,
      scope_id: normalizedScopeType === 'merchant' ? merchantId : nullableString(form.scope_id),
      who_pays: form.who_pays.trim(),
      rule_type: form.rule_type.trim(),
      value: numberOrZero(form.value),
      starts_at: nullableString(form.starts_at),
      ends_at: nullableString(form.ends_at),
      is_active: form.is_active,
      updated_at: now,
    };

    if (form.id) {
      return supabase.from('commission_rules').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase
      .from('commission_rules')
      .insert({
        ...payload,
        created_at: now,
      })
      .select('id')
      .single();
  },

  /**
   * FASE 4 — Liquida un pedido pagado.
   * Calcula los montos para: comercio, repartidor, plataforma ACME.
   * Un pedido solo puede liquidarse una vez (is_settled = true).
   * El cálculo usa los valores guardados en el pedido (productos, service_fee, delivery_fee, tip_amount).
   */
  settleOrder: async (orderId: string, settledByUserId: string) => {
    const now = new Date().toISOString();

    // 1. Verificar que el pedido exista y esté pagado y no liquidado
    const orderResult = await supabase
      .from('orders')
      .select('id, payment_status, is_settled, subtotal, service_fee, delivery_fee, tip_amount, total, discount_total')
      .eq('id', orderId)
      .maybeSingle();

    if (orderResult.error) return { data: null, error: orderResult.error };
    if (!orderResult.data) return { data: null, error: { message: 'Pedido no encontrado.', code: 'NOT_FOUND' } as any };

    const order = orderResult.data as any;

    if (order.payment_status !== 'paid') {
      return { data: null, error: { message: 'Solo se pueden liquidar pedidos con pago confirmado.', code: 'INVALID_STATUS' } as any };
    }
    if (order.is_settled) {
      return { data: null, error: { message: 'Este pedido ya fue liquidado anteriormente.', code: 'ALREADY_SETTLED' } as any };
    }

    // 2. Calcular reembolsos activos
    const refundsResult = await supabase
      .from('payments')
      .select('amount, status')
      .eq('order_id', orderId)
      .eq('status', 'refunded');

    const refundAdjustment = refundsResult.data
      ? (refundsResult.data as any[]).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
      : 0;

    // 3. Distribución del dinero (según regla del MD)
    // base = subtotal - descuentos
    const base = Number(order.subtotal ?? 0) - Number(order.discount_total ?? 0);
    const serviceFee = Number(order.service_fee ?? 0);
    const deliveryFee = Number(order.delivery_fee ?? 0);
    const tipAmount = Number(order.tip_amount ?? 0);

    // Comercio recibe el base (precio de productos sin markup de plataforma)
    // Por ahora, sin merchant_price individual, usamos base como aproximación
    // En el futuro se sumará merchant_price de cada order_item
    const merchantAmount = Math.max(0, base - refundAdjustment);

    // Repartidor recibe delivery_fee + 100% de la propina
    const driverAmount = deliveryFee + tipAmount;

    // ACME retiene service_fee (la diferencia del markup ya está en merchant_amount)
    const platformAmount = serviceFee;

    // 4. Guardar en order_settlements
    const settlementResult = await supabase
      .from('order_settlements')
      .insert({
        order_id: orderId,
        merchant_amount: parseFloat(merchantAmount.toFixed(2)),
        driver_amount: parseFloat(driverAmount.toFixed(2)),
        tip_amount: parseFloat(tipAmount.toFixed(2)),
        platform_amount: parseFloat(platformAmount.toFixed(2)),
        refund_adjustment: parseFloat(refundAdjustment.toFixed(2)),
        culqi_fee: null, // Se registrará cuando Culqi lo notifique
        settled_at: now,
        settled_by: settledByUserId,
      })
      .select('id')
      .single();

    if (settlementResult.error) return { data: null, error: settlementResult.error };

    // 5. Marcar el pedido como liquidado
    const updateResult = await supabase
      .from('orders')
      .update({ is_settled: true, settled_at: now, updated_at: now })
      .eq('id', orderId)
      .select('id')
      .single();

    if (updateResult.error) return { data: null, error: updateResult.error };

    return { data: { settlement_id: (settlementResult.data as any)?.id, order_id: orderId }, error: null };
  },
};
