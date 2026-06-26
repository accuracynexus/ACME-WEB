import { supabase } from '../../integrations/supabase/client';

const DEFAULT_API_URL = 'https://acme-operacione.vercel.app';
const API_BASE_URL = String(import.meta.env.VITE_ACME_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

// ─── Tipos existentes ────────────────────────────────────────────────────────

export interface CourierCulqiOrderPayload {
  order_id: string;
  email_cliente?: string;
  nombre_cliente?: string;
  telefono_cliente?: string;
  descripcion?: string;
}

export interface CourierCulqiOrderResponse {
  order_id: string;
  courier_order_id: string;
  payment_id: string;
  monto_centimos: number;
  mensaje: string;
}

export interface CourierChargePayload {
  order_id: string;
  token: string;
  payment_id?: string;
  email_cliente?: string;
  nombre_cliente?: string;
}

export interface CourierChargeResponse {
  exito: boolean;
  courier_order_id: string;
  payment_id?: string;
  transaccion_id?: string | null;
  mensaje: string;
}

// ─── Nuevos tipos — Motor Financiero ────────────────────────────────────────

export interface QuoteItemInput {
  product_id: string;
  quantity: number;
  modifier_ids?: string[];
}

export interface CourierQuoteRequest {
  branch_id: string;
  payment_method?: string;
  tip_amount?: number;
  latitude?: number | null;
  longitude?: number | null;
  fulfillment_type?: 'delivery' | 'pickup';
  zone?: 'A' | 'B' | 'C' | 'D';
  weight_kg?: number;
  service_type?: 'normal' | 'express' | 'scheduled';
  is_difficult_zone?: boolean;
  is_out_of_city?: boolean;
  wait_or_second_visit?: boolean;
  items: QuoteItemInput[];
}

export interface CourierTariffSurcharge {
  code: string;
  label: string;
  amount: number;
}

export interface CourierQuoteResponse {
  quote_id: string;
  subtotal: number;
  discount: number;
  service_fee: number;
  service_fee_rate: number;
  delivery_fee: number;
  tip_amount: number;
  taxable_base?: number;
  igv_rate?: number;
  igv_amount?: number;
  payment_processing_fee?: number;
  payment_processing_rate?: number;
  payment_processing_fixed?: number;
  payment_processing_provider?: string;
  payment_processing_note?: string | null;
  payment_processing_tax_amount?: number;
  total: number;
  distance_km: number | null;
  delivery_zone?: string | null;
  delivery_zone_label?: string | null;
  delivery_detail?: string | null;
  delivery_surcharges_total?: number;
  delivery_surcharges?: CourierTariffSurcharge[];
  expires_at: string;
}

export interface CourierReverseGeocodeResponse {
  line1?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  display_name?: string | null;
}

export interface CourierGeocodeSearchResult extends CourierReverseGeocodeResponse {
  label: string;
  lat: number;
  lng: number;
}

export interface CourierOrderDeliveryAddress {
  line1: string;
  line2?: string;
  reference?: string;
  district?: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface CourierCreateOrderRequest {
  quote_id: string;
  fulfillment_type?: 'delivery' | 'pickup';
  special_instructions?: string;
  recipient_name?: string;
  recipient_phone?: string;
  address?: CourierOrderDeliveryAddress;
}

export interface CourierCreateOrderResponse {
  order_id: string;
  order_code: number;
  total: number;
  payment_status: string;
}

export interface CourierPaymentStatusResponse {
  payment_status: string;
  order_id: string;
}

// ─── Utilidades HTTP ─────────────────────────────────────────────────────────

type RequestOptions = RequestInit & {
  json?: unknown;
};

function endpoint(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = await getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint(path), {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  const rawBody = await response.text();
  const data = rawBody ? JSON.parse(rawBody) : null;

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ')
          : `Error HTTP ${response.status}`;
    throw new Error(message || `Error HTTP ${response.status}`);
  }

  return data as T;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export const courierPaymentService = {
  baseUrl: API_BASE_URL,

  /**
   * FASE 1 — Obtiene una cotización del backend con precios reales.
   * El backend consulta productos en Supabase y calcula: subtotal, 3.6%, envío por distancia, propina.
   */
  createQuote(payload: CourierQuoteRequest) {
    return requestJson<CourierQuoteResponse>('/api/courier/quote', {
      method: 'POST',
      json: payload,
    });
  },

  reverseGeocode(lat: number, lng: number) {
    return requestJson<CourierReverseGeocodeResponse>(
      `/api/courier/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
    );
  },

  searchAddresses(query: string, limit = 6) {
    return requestJson<CourierGeocodeSearchResult[]>(
      `/api/courier/geocode-search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`
    );
  },

  /**
   * FASE 2 — Crea el pedido de forma atómica en el backend a partir de un quote_id.
   * El frontend nunca envía precios; el backend usa los datos de la cotización.
   */
  createOrder(payload: CourierCreateOrderRequest) {
    return requestJson<CourierCreateOrderResponse>('/api/courier/orders', {
      method: 'POST',
      json: payload,
    });
  },

  /**
   * FASE 3 — Crea la orden de Culqi para abrir el checkout multipago.
   * Usa el order_id creado por createOrder().
   */
  createCheckoutOrder(payload: CourierCulqiOrderPayload) {
    return requestJson<CourierCulqiOrderResponse>('/api/courier/payments/order', {
      method: 'POST',
      json: payload,
    });
  },

  /**
   * FASE 3 — Ejecuta el cobro con el token Culqi generado en el frontend.
   * El backend obtiene el monto desde orders.total (nunca del frontend).
   */
  charge(payload: CourierChargePayload) {
    return requestJson<CourierChargeResponse>('/api/courier/payments/charge', {
      method: 'POST',
      json: payload,
    });
  },

  /**
   * FASE 3 — Consulta el estado de pago actual del pedido en Supabase.
   */
  async getPaymentStatus(orderId: string): Promise<CourierPaymentStatusResponse> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('id', orderId)
      .single();

    if (error) throw new Error(error.message);
    return {
      order_id: data.id as string,
      payment_status: (data.payment_status as string) ?? 'pending',
    };
  },
};
