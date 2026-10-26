import { supabase } from '../../integrations/supabase/client';

// Mismo backend de pagos que courierPaymentService: es el unico que tiene la
// clave de acme-yape, y comprueba que quien pide sea admin de plataforma.
const DEFAULT_API_URL = 'https://acme-pagos-api-gicpaccori-5337s-projects.vercel.app';
const API_BASE_URL = String(import.meta.env.VITE_ACME_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

export type YapeVeredicto = 'conciliado' | 'de_mas' | 'parcial' | 'anulado' | 'por_verificar' | 'huerfano' | 'ignorado';

export type CobroVeredicto =
  | 'en_curso'
  | 'conciliado'
  | 'de_mas'
  | 'incompleto'
  | 'anulado'
  | 'reclamado'
  | 'sin_pago'
  | 'reemplazado';

export interface YapeRecibido {
  id: string;
  recibido_en: string;
  publicado_en: string | null;
  nombre_pagador: string;
  monto_centimos: number;
  estado: 'asignado' | 'huerfano' | 'por_verificar' | 'ignorado';
  codigo_seguridad: string | null;
  dispositivo_id: string;
  texto_original: string;
  espera_ventanas: boolean;
  sesion_id: string | null;
  sesion_propuesta_id: string | null;
  /** false: es de antes del periodo, pero sigue sin resolverse. */
  del_periodo: boolean;
  veredicto: YapeVeredicto;
}

export interface YapeDeCobro {
  id: string;
  monto_centimos: number;
  nombre_pagador: string;
  recibido_en: string;
  codigo_seguridad: string | null;
}

export interface YapeCobro {
  id: string;
  referencia: string;
  cliente_id: string | null;
  estado: 'abierta' | 'pagada' | 'vencida' | 'cancelada' | 'anulada';
  veredicto: CobroVeredicto;
  del_periodo: boolean;
  monto_base_centimos: number;
  extra_centimos: number;
  monto_centimos: number;
  abonado_centimos: number;
  saldo_centimos: number | null;
  excedente_centimos: number;
  devuelto_centimos: number;
  quitado_centimos: number;
  saldo_favor_usado_centimos: number;
  saldo_favor_abonado_centimos: number;
  recibido_centimos: number;
  yapeos: YapeDeCobro[];
  metodo_confirmacion: string | null;
  nombre_esperado: string | null;
  creada_en: string;
  expira_en: string;
  libera_en: string;
  declaro_pago_en: string | null;
  pagada_en: string | null;
  reemplazada_por: string | null;
  intentos_codigo: number;
  intentos_registrados: number;
  tiene_reclamo: boolean;
  webhook_enviado_en: string | null;
  webhook_intentos: number;
  webhook_error: string | null;
}

export interface YapeDevolucion {
  id: string;
  sesion_id: string;
  referencia: string;
  motivo: 'abono' | 'excedente';
  monto_centimos: number;
  celular: string;
  titulares: string[];
  estado: 'pendiente' | 'hecha' | 'rechazada';
  numero_operacion: string | null;
  nota: string | null;
  creada_en: string;
  resuelta_en: string | null;
}

export interface YapeReclamo {
  id: string;
  referencia: string;
  sesion_id: string | null;
  pago_id: string | null;
  por_nombre: boolean;
  monto_centimos: number;
  resultado: 'aplicado' | 'en_espera' | 'revision' | 'no_encontrado';
  creado_en: string;
  resuelto_en: string | null;
}

export interface YapeCaptura {
  id: string;
  sesion_id: string;
  monto_centimos: number | null;
  numero_operacion: string | null;
  fecha_hora: string | null;
  destinatario: string | null;
  estado: 'asignada' | 'revision' | 'rechazada';
  motivo: string | null;
  pago_id: string | null;
  creada_en: string;
}

export interface YapeReceptor {
  id: string;
  ultimo_latido: string;
  version_app: string | null;
  bateria: number | null;
  notificaciones_activas: boolean | null;
}

export interface YapePedido {
  id: string;
  codigo: string | null;
  estado: string | null;
  estado_pago: string | null;
  total: number | null;
  creado_en: string | null;
  comercio: string | null;
  cliente_nombre: string | null;
  cliente_correo: string | null;
  cliente_celular: string | null;
}

export interface YapeCliente {
  nombre: string | null;
  correo: string | null;
  celular: string | null;
}

export interface YapeConciliacion {
  desde: string;
  hasta: string;
  generado_en: string;
  yapeos: YapeRecibido[];
  cobros: YapeCobro[];
  devoluciones: YapeDevolucion[];
  reclamos: YapeReclamo[];
  capturas: YapeCaptura[];
  receptores: YapeReceptor[];
  avisos_no_leidos: number;
  /** Por referencia (id del pedido). */
  pedidos: Record<string, YapePedido>;
  clientes: Record<string, YapeCliente>;
  aviso?: string;
}

export const adminYapeService = {
  async fetchConciliacion(desde: Date, hasta: Date, signal?: AbortSignal): Promise<YapeConciliacion> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Tu sesion vencio. Vuelve a entrar.');
    }
    const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
    const response = await fetch(`${API_BASE_URL}/api/admin/yape/conciliacion?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal,
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : `Error HTTP ${response.status}`);
    }
    return data as YapeConciliacion;
  },
};
