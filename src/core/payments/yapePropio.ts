/**
 * Pasarela Yape propia de ACME (repo acme-yape).
 *
 * El backend de pagos abre una sesion con el monto exacto a yapear (el total
 * del pedido, o unos centimos mas si otro pago en curso tiene el mismo monto)
 * y una ventana corta. El celular de ACME detecta el yapeo y el pedido queda
 * pagado. Aqui solo se consulta la sesion y se sube la captura del cliente,
 * con el token de la sesion; el pago nunca se da por bueno en el navegador.
 */

export interface YapePropioSesion {
  sesion_id: string;
  token?: string;
  referencia: string;
  estado: 'abierta' | 'pagada' | 'vencida' | 'cancelada' | 'anulada';
  monto_centimos: number;
  monto_base_centimos: number;
  extra_centimos: number;
  monto_texto: string;
  expira_en: string | null;
  segundos_restantes: number;
  /** Hasta cuando se espera un yapeo tardio y se acepta el codigo. */
  segundos_cierre?: number;
  pagada_en: string | null;
  metodo_confirmacion: string | null;
  puede_subir_captura: boolean;
  /** Nombre del Yape del cliente, si lo dio: ayuda a reconocer un yapeo tardio. */
  nombre_pagador?: string | null;
  /** El cliente pulso "Ya yapeé": el monto queda reservado un minuto mas. */
  declaro_pago?: boolean;
  /** Lo ya yapeado y, si no alcanzo para el pedido, lo que falta. */
  abonado_centimos?: number;
  abonado_texto?: string | null;
  saldo_centimos?: number | null;
  saldo_texto?: string | null;
  /** Llego un yapeo que parece del cliente pero no fue exacto: se confirma con el codigo. */
  pago_por_verificar?: {
    monto_texto: string;
    nombre_pagador?: string | null;
    /** Menor que el pedido: se confirma solo cuando terminen las sesiones de otros clientes. */
    se_confirma_solo?: boolean;
  } | null;
  puede_ingresar_codigo?: boolean;
  intentos_codigo_restantes?: number;
  /** Lo yapeado de mas sobre el pedido. */
  excedente_texto?: string | null;
  /** Puede pedir que le devuelvan su abono (deja la compra) o lo pagado de mas. */
  puede_pedir_devolucion?: boolean;
  devolucion_posible_texto?: string | null;
  /** Si hay algo yapeado que devolver por Yape; si no, solo se libera su saldo a favor. */
  devolucion_requiere_celular?: boolean;
  /** Saldo a favor de Yape directo usado en este pedido, y el que quedo por pagar de mas. */
  saldo_favor_usado_texto?: string | null;
  saldo_favor_abonado_texto?: string | null;
  devoluciones?: { motivo: 'abono' | 'excedente'; monto_texto: string; estado: string; celular: string }[];
  yape: { numero: string; titular: string; qr_url: string };
  /** URL de acme-yape; la agrega el backend de pagos. */
  api_url?: string;
}

export interface YapePropioCodigoResultado {
  resultado: 'asignado' | 'abonado' | 'no_coincide' | 'bloqueada' | 'ya_pagada' | 'fuera_de_plazo' | 'anulada';
  mensaje: string;
  sesion: YapePropioSesion;
}

export interface YapePropioCapturaResultado {
  resultado: 'asignado' | 'revision' | 'rechazada' | 'ya_pagada';
  mensaje: string;
  sesion: YapePropioSesion;
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const detalle = (cuerpo as { detail?: unknown }).detail;
    throw new Error(typeof detalle === 'string' ? detalle : 'No se pudo consultar el pago con Yape.');
  }
  return cuerpo as T;
}

export function consultarSesion(apiUrl: string, sesionId: string, token: string): Promise<YapePropioSesion> {
  return pedir<YapePropioSesion>(
    `${apiUrl}/v1/sesiones/${encodeURIComponent(sesionId)}?token=${encodeURIComponent(token)}`,
  );
}

/** El cliente avisa que ya yapeo: se reserva el monto un rato mas mientras llega la notificacion. */
export function declararPago(apiUrl: string, sesionId: string, token: string): Promise<YapePropioSesion> {
  return pedir<YapePropioSesion>(
    `${apiUrl}/v1/sesiones/${encodeURIComponent(sesionId)}/ya-pague?token=${encodeURIComponent(token)}`,
    { method: 'POST' },
  );
}

/** Confirma un yapeo con el codigo de seguridad de 3 digitos de la constancia. */
export function verificarCodigo(
  apiUrl: string,
  sesionId: string,
  token: string,
  codigo: string,
): Promise<YapePropioCodigoResultado> {
  return pedir<YapePropioCodigoResultado>(
    `${apiUrl}/v1/sesiones/${encodeURIComponent(sesionId)}/codigo?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    },
  );
}

export interface YapePropioDevolucionResultado {
  resultado: 'solicitada' | 'ya_solicitada' | 'nada_que_devolver';
  mensaje: string;
  sesion: YapePropioSesion;
}

/**
 * Pide devolver lo abonado (anula la compra) o lo pagado de mas, al Yape del
 * mismo titular. Sin nada yapeado, solo libera su saldo a favor y no lleva celular.
 */
export function pedirDevolucion(
  apiUrl: string,
  sesionId: string,
  token: string,
  celular?: string,
): Promise<YapePropioDevolucionResultado> {
  return pedir<YapePropioDevolucionResultado>(
    `${apiUrl}/v1/sesiones/${encodeURIComponent(sesionId)}/devolucion?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(celular ? { celular } : {}),
    },
  );
}

function leerComoBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '');
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    lector.readAsDataURL(archivo);
  });
}

export async function subirCaptura(
  apiUrl: string,
  sesionId: string,
  token: string,
  archivo: File,
): Promise<YapePropioCapturaResultado> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
    throw new Error('La captura debe ser una imagen PNG, JPG o WEBP.');
  }
  if (archivo.size > 4 * 1024 * 1024) {
    throw new Error('La captura pesa más de 4 MB.');
  }
  const imagen = await leerComoBase64(archivo);
  return pedir<YapePropioCapturaResultado>(
    `${apiUrl}/v1/sesiones/${encodeURIComponent(sesionId)}/captura?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagen_base64: imagen, tipo: archivo.type }),
    },
  );
}
