import { supabase } from '../../integrations/supabase/client';

const DEFAULT_API_URL = 'http://localhost:8000';
const API_BASE_URL = String(import.meta.env.VITE_ACME_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

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

export const courierPaymentService = {
  baseUrl: API_BASE_URL,

  createCheckoutOrder(payload: CourierCulqiOrderPayload) {
    return requestJson<CourierCulqiOrderResponse>('/api/courier/payments/order', {
      method: 'POST',
      json: payload,
    });
  },

  charge(payload: CourierChargePayload) {
    return requestJson<CourierChargeResponse>('/api/courier/payments/charge', {
      method: 'POST',
      json: payload,
    });
  },
};

