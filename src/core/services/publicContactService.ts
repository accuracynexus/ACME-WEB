import { supabase } from '../../integrations/supabase/client';

export interface ContactRequestPayload {
  business_name: string;
  category?: string;
  contact_name: string;
  phone: string;
  email: string;
  address?: string;
  daily_orders?: string;
  referral_source?: string;
  message?: string;
}

const clean = (value: string | undefined) => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const publicContactService = {
  // Inserta una solicitud del formulario público. No usa .select() a propósito:
  // la política RLS permite INSERT a cualquiera pero SELECT solo a administradores.
  submitContactRequest: async (payload: ContactRequestPayload) => {
    const { error } = await supabase.from('contact_requests').insert({
      business_name: payload.business_name.trim(),
      category: clean(payload.category),
      contact_name: payload.contact_name.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim(),
      address: clean(payload.address),
      daily_orders: clean(payload.daily_orders),
      referral_source: clean(payload.referral_source),
      message: clean(payload.message),
      status: 'new',
    });

    return { error };
  },

  /**
   * Registra una hoja del Libro de Reclamaciones. Se guarda en contact_requests
   * porque esa tabla ya acepta INSERT anonimo por RLS; los campos propios del
   * reclamo que no tienen columna van formateados dentro de `message`, para no
   * perder ninguno de los datos que exige el D.S. 011-2011-PCM.
   */
  submitComplaint: async (payload: ComplaintPayload) => {
    const detalle = [
      `Codigo: ${payload.code}`,
      `Tipo: ${payload.kind === 'queja' ? 'Queja' : 'Reclamo'}`,
      `DNI: ${payload.document}`,
      payload.orderCode ? `Pedido: ${payload.orderCode}` : null,
      '',
      'Detalle:',
      payload.detail,
      '',
      'Pedido concreto del consumidor:',
      payload.request,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const { error } = await supabase.from('contact_requests').insert({
      business_name: `Libro de Reclamaciones ${payload.code}`,
      category: payload.kind,
      contact_name: payload.fullName.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim(),
      address: clean(payload.address),
      message: detalle,
      status: 'new',
    });

    return { error };
  },
};

export interface ComplaintPayload {
  code: string;
  kind: 'reclamo' | 'queja';
  fullName: string;
  document: string;
  address?: string;
  phone: string;
  email: string;
  orderCode?: string;
  detail: string;
  request: string;
}
