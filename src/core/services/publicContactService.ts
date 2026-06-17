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
};
