import { supabase } from '../../integrations/supabase/client';

// Mismo backend de pagos: guarda con su clave de servicio despues de
// comprobar que quien guarda es admin de plataforma.
const DEFAULT_API_URL = 'https://acme-pagos-api-gicpaccori-5337s-projects.vercel.app';
const API_BASE_URL = String(import.meta.env.VITE_ACME_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

export type ClientGroup = 'producto' | 'envio' | 'comision';
export type GatewayKey = 'yape_directo' | 'izipay' | 'culqi_yape' | 'culqi_card';
export type GatewayMode = 'cost' | 'percent' | 'absorb';

export interface Tier {
  up_to: number | null;
  rate: number;
}

export interface SectorPoint {
  lat: number;
  lng: number;
  fee: number;
  sector: string;
  source?: string;
}

export interface Zone {
  code: string;
  label?: string;
  name?: string;
  description?: string;
  max_distance_km?: number | null;
  base_fee: number;
}

export interface MerchantRule {
  merchant_id: string;
  name: string;
  markup_rate: number | null;
  markup_fixed_per_unit: number | null;
  service_fee_rate: number | null;
  service_fee_exempt: boolean;
}

export interface PricingConfig {
  version: number;
  service_fee: {
    enabled: boolean;
    base: Array<'products' | 'delivery' | 'multi_store'>;
    tier_by: 'products' | 'base';
    tier_mode: 'whole' | 'progressive';
    tiers: Tier[];
    fixed: number;
    min: number;
    max: number;
    exempt_categories: string[];
    exempt_only_orders_pay: boolean;
    group: ClientGroup;
  };
  product_markup: { rate: number; fixed_per_unit: number; group: ClientGroup };
  merchant_rules: MerchantRule[];
  multi_store: { rates: number[]; max_amount: number; group: ClientGroup };
  delivery: {
    group: ClientGroup;
    rounding_increment: number;
    rounding_mode: 'nearest' | 'up' | 'down';
    service_surcharges: Record<string, number>;
    weight: { included_kg: number; step_kg: number; fee_per_step: number };
    difficult_zone_fee: number;
    wait_or_second_visit_fee: number;
    outside_city: { base_fee: number; cost_per_km: number };
    zones: Zone[];
    sector_pricing: { enabled: boolean; center_fee: number; points: SectorPoint[]; source?: string; rule?: string };
  };
  igv: {
    rate: number;
    mode: 'added' | 'included' | 'none';
    applies_to: { delivery: boolean; multi_store: boolean; service_fee: boolean; product_markup: boolean };
  };
  gateways: { group: ClientGroup } & Record<GatewayKey, { mode: GatewayMode; rate: number; fixed: number }>;
  display: { labels: Record<ClientGroup, string> };
}

export interface GatewayCost {
  label: string;
  rate: number;
  fixed: number;
  fixed_usd?: number;
  min_fee?: number;
  min_fee_below?: number;
  igv: boolean;
  note: string;
}

export interface PricingConfigResponse {
  config: PricingConfig;
  defaults: PricingConfig;
  saved: boolean;
  updated_at: string | null;
  updated_by: string | null;
  gateway_costs: { igv_rate: number; exchange_rate: number } & Record<GatewayKey, GatewayCost>;
  coverage: { label?: string; points?: { lat: number; lng: number }[] };
}

export interface SimItem {
  price: number;
  quantity: number;
  merchant_id?: string | null;
  exempt?: boolean;
}

export interface SimRequest {
  config?: PricingConfig;
  items: SimItem[];
  delivery_fee?: number | null;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  branch_count: number;
  tip: number;
  fulfillment_type?: 'delivery' | 'pickup';
  service_type?: string;
  weight_kg?: number;
  is_difficult_zone?: boolean;
  wait_or_second_visit?: boolean;
}

export interface SimConcept {
  key: string;
  label: string;
  amount: number;
  to: string;
  group: ClientGroup | null;
}

export interface SimResult {
  method: string;
  label: string;
  error?: string;
  total: number;
  products: number;
  product_markup: number;
  delivery_fee: number;
  multi_store_surcharge: number;
  service_fee: number;
  igv_amount: number;
  igv_added: boolean;
  gateway_fee: number;
  gateway_cost: number;
  acme_gateway_margin: number;
  acme_net: number;
  tip: number;
  gateway: { note: string; provider: string };
  client_groups: { key: ClientGroup; label: string; amount: number }[];
  client_group_details: Record<ClientGroup, string[]>;
  concepts: SimConcept[];
  payout: { to: string; amount: number }[];
}

export interface SimResponse {
  delivery: {
    source: 'manual' | 'map' | 'pickup';
    fee?: number;
    distance_km?: number;
    coverage?: string;
    zone_label?: string;
    detail?: string;
    surcharges?: { label: string; amount: number }[];
  };
  results: SimResult[];
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Tu sesion vencio. Vuelve a entrar.');
  }
  const response = await fetch(`${API_BASE_URL}/api/admin/pricing${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d?.msg).join(', ') : `Error HTTP ${response.status}`);
  }
  return data as T;
}

export interface BranchOption {
  id: string;
  name: string;
  merchant_id: string;
  merchant_name: string;
  lat: number | null;
  lng: number | null;
}

export const adminPricingService = {
  fetchConfig(): Promise<PricingConfigResponse> {
    return call('/config');
  },
  saveConfig(config: PricingConfig): Promise<{ config: PricingConfig; updated_at: string }> {
    return call('/config', { method: 'PUT', body: JSON.stringify({ config }) });
  },
  simulate(request: SimRequest, signal?: AbortSignal): Promise<SimResponse> {
    return call('/simulate', { method: 'POST', body: JSON.stringify(request), signal });
  },
  async fetchBranches(): Promise<BranchOption[]> {
    const [branches, merchants] = await Promise.all([
      supabase.from('merchant_branches').select('id, merchant_id, name, lat, lng'),
      supabase.from('merchants').select('id, trade_name, legal_name'),
    ]);
    if (branches.error) throw branches.error;
    const names = new Map<string, string>(
      (merchants.data ?? []).map((m: { id: string; trade_name?: string | null; legal_name?: string | null }) => [
        String(m.id),
        String(m.trade_name || m.legal_name || 'Negocio'),
      ]),
    );
    return (branches.data ?? [])
      .map((b: { id: string; merchant_id: string; name?: string | null; lat?: number | null; lng?: number | null }) => ({
        id: String(b.id),
        name: String(b.name || 'Sucursal'),
        merchant_id: String(b.merchant_id),
        merchant_name: names.get(String(b.merchant_id)) ?? 'Negocio',
        lat: b.lat != null ? Number(b.lat) : null,
        lng: b.lng != null ? Number(b.lng) : null,
      }))
      .sort((a, b) => a.merchant_name.localeCompare(b.merchant_name));
  },
};
