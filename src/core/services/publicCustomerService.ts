import { supabase } from '../../integrations/supabase/client';
import { AppRoutes } from '../constants/routes';

export interface CustomerRegistrationPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  address?: CustomerAddressForm;
}

export interface CustomerProfileLite {
  full_name: string;
  email: string;
  phone: string;
  rating_avg: number;
}

export interface CustomerAddressForm {
  relation_id?: string;
  address_id?: string;
  label: string;
  is_default: boolean;
  line1: string;
  line2: string;
  reference: string;
  district: string;
  city: string;
  region: string;
  country: string;
  lat?: number | null;
  lng?: number | null;
}

export interface CustomerAddressRecord extends CustomerAddressForm {
  relation_id: string;
  address_id: string;
}

export interface CustomerOrderModifierRecord {
  id: string;
  option_name_snapshot: string;
  price_delta: number;
  quantity: number;
}

export interface CustomerOrderItemRecord {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string;
  modifiers: CustomerOrderModifierRecord[];
}

export interface CustomerOrderHistoryRecord {
  id: string;
  order_code: string;
  merchant_label: string;
  branch_label: string;
  status: string;
  payment_status: string;
  fulfillment_type: string;
  total: number;
  currency: string;
  placed_at: string;
  special_instructions: string;
  address_snapshot: string;
  reference_snapshot: string;
  recipient_name: string;
  recipient_phone: string;
  estimated_distance_km: string;
  estimated_time_min: string;
  items: CustomerOrderItemRecord[];
  history: Array<{
    id: string;
    from_status: string;
    to_status: string;
    actor_type: string;
    note: string;
    created_at: string;
  }>;
}

export interface CustomerAccountSnapshot {
  profile: CustomerProfileLite;
  addresses: CustomerAddressRecord[];
  orders: CustomerOrderHistoryRecord[];
}

export interface PublicCartModifierSelection {
  id: string;
  option_id: string;
  group_id: string;
  name: string;
  price_delta: number;
  quantity: number;
}

export interface PublicCartItemInput {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  notes: string;
  modifiers: PublicCartModifierSelection[];
}

export interface PlaceOrderPayload {
  merchant_id: string;
  branch_id: string;
  fulfillment_type: 'delivery' | 'pickup';
  special_instructions: string;
  recipient_name: string;
  recipient_phone: string;
  address: CustomerAddressForm;
  save_address: boolean;
  items: PublicCartItemInput[];
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

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function randomId() {
  return crypto.randomUUID();
}

function isMissingLatLngColumn(error: unknown) {
  const item = error as { code?: string; message?: string } | null;
  const message = `${item?.code ?? ''} ${item?.message ?? ''}`.toLowerCase();
  return message.includes('lat') || message.includes('lng');
}

function buildAddressPayload(form: CustomerAddressForm, now: string, includeCoordinates: boolean) {
  const payload: Record<string, unknown> = {
    line1: form.line1,
    line2: nullableString(form.line2),
    reference: nullableString(form.reference),
    district: nullableString(form.district),
    city: nullableString(form.city),
    region: nullableString(form.region),
    country: nullableString(form.country || 'Peru'),
    updated_at: now,
  };

  const lat = numberOrNull(form.lat);
  const lng = numberOrNull(form.lng);
  if (includeCoordinates && lat !== null && lng !== null) {
    payload.lat = lat;
    payload.lng = lng;
  }

  return payload;
}

function calculateItemTotal(item: PublicCartItemInput) {
  const modifiersTotal = item.modifiers.reduce((sum, modifier) => sum + numberOrZero(modifier.price_delta) * Math.max(1, numberOrZero(modifier.quantity)), 0);
  return (numberOrZero(item.unit_price) + modifiersTotal) * Math.max(1, numberOrZero(item.quantity));
}

async function ensureCustomerRow(userId: string) {
  const now = new Date().toISOString();
  const result = await supabase
    .from('customers')
    .upsert(
      {
        user_id: userId,
        rating_avg: 0,
        updated_at: now,
        created_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id')
    .single();
  return result;
}

export const publicCustomerService = {
  signUpCustomer: async (payload: CustomerRegistrationPayload) => {
    return supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: `${window.location.origin}${AppRoutes.public.account}`,
        data: {
          full_name: payload.full_name,
          phone: payload.phone,
          primary_address: payload.address ?? null,
        },
      },
    });
  },

  signInCustomer: async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  },

  signOutCustomer: async () => {
    return supabase.auth.signOut();
  },

  resendSignupVerification: async (email: string) => {
    return supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${AppRoutes.public.account}`,
      },
    });
  },

  ensureCustomerAccount: async (userId: string, payload: Omit<CustomerRegistrationPayload, 'password'>) => {
    const now = new Date().toISOString();

    const profileResult = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          default_role: 'customer',
          is_active: true,
          updated_at: now,
          created_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('user_id')
      .single();

    if (profileResult.error) return { data: null, error: profileResult.error };

    const customerResult = await ensureCustomerRow(userId);
    if (customerResult.error) return { data: null, error: customerResult.error };

    if (payload.address?.line1?.trim()) {
      const existingAddress = await supabase
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', userId)
        .limit(1);
      if (existingAddress.error) return { data: null, error: existingAddress.error };

      if ((existingAddress.data ?? []).length === 0) {
        const addressResult = await publicCustomerService.saveAddress(userId, {
          ...payload.address,
          label: payload.address.label || 'Casa',
          is_default: true,
        });
        if (addressResult.error) return { data: null, error: addressResult.error };
      }
    }

    return { data: { user_id: userId }, error: null };
  },

  fetchCustomerAddresses: async (userId: string) => {
    const addressLinksResult = await supabase
      .from('customer_addresses')
      .select('id, address_id, label, is_default')
      .eq('customer_id', userId)
      .order('created_at', { ascending: true });

    if (addressLinksResult.error) return { data: null, error: addressLinksResult.error };

    const addressLinks = (addressLinksResult.data ?? []) as any[];
    const addressIds = addressLinks.map((row) => stringOrEmpty(row.address_id)).filter(Boolean);
    const addressesResult =
      addressIds.length > 0
        ? await supabase.from('addresses').select('*').in('id', addressIds)
        : ({ data: [], error: null } as any);

    if (addressesResult.error) return { data: null, error: addressesResult.error };

    const addressMap = new Map<string, any>(((addressesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), row]));
    const addresses: CustomerAddressRecord[] = addressLinks.map((row) => {
      const address = addressMap.get(stringOrEmpty(row.address_id));
      return {
        relation_id: stringOrEmpty(row.id),
        address_id: stringOrEmpty(row.address_id),
        label: stringOrEmpty(row.label),
        is_default: Boolean(row.is_default ?? false),
        line1: stringOrEmpty(address?.line1),
        line2: stringOrEmpty(address?.line2),
        reference: stringOrEmpty(address?.reference),
        district: stringOrEmpty(address?.district),
        city: stringOrEmpty(address?.city),
        region: stringOrEmpty(address?.region),
        country: stringOrEmpty(address?.country) || 'Peru',
        lat: numberOrNull(address?.lat),
        lng: numberOrNull(address?.lng),
      };
    });

    return { data: addresses, error: null };
  },

  fetchProfileLite: async (userId: string) => {
    const [profileResult, customerResult] = await Promise.all([
      supabase.from('profiles').select('full_name, email, phone').eq('user_id', userId).maybeSingle(),
      supabase.from('customers').select('rating_avg').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileResult.error) return { data: null, error: profileResult.error };
    if (customerResult.error) return { data: null, error: customerResult.error };

    return {
      data: {
        full_name: stringOrEmpty(profileResult.data?.full_name),
        email: stringOrEmpty(profileResult.data?.email),
        phone: stringOrEmpty(profileResult.data?.phone),
        rating_avg: numberOrZero(customerResult.data?.rating_avg),
      },
      error: null,
    };
  },

  fetchAccountSnapshot: async (userId: string) => {
    const [profileResult, customerResult, addressLinksResult, ordersResult] = await Promise.all([
      supabase.from('profiles').select('full_name, email, phone').eq('user_id', userId).maybeSingle(),
      supabase.from('customers').select('rating_avg').eq('user_id', userId).maybeSingle(),
      supabase.from('customer_addresses').select('id, address_id, label, is_default').eq('customer_id', userId).order('created_at', { ascending: true }),
      supabase
        .from('orders')
        .select('id, order_code, merchant_id, branch_id, status, payment_status, fulfillment_type, total, currency, placed_at, special_instructions')
        .eq('customer_id', userId)
        .order('placed_at', { ascending: false }),
    ]);

    if (profileResult.error) return { data: null, error: profileResult.error };
    if (customerResult.error) return { data: null, error: customerResult.error };
    if (addressLinksResult.error) return { data: null, error: addressLinksResult.error };
    if (ordersResult.error) return { data: null, error: ordersResult.error };

    const addressLinks = (addressLinksResult.data ?? []) as any[];
    const orderRows = (ordersResult.data ?? []) as any[];
    const addressIds = addressLinks.map((row) => stringOrEmpty(row.address_id)).filter(Boolean);
    const orderIds = orderRows.map((row) => stringOrEmpty(row.id)).filter(Boolean);

    const [addressesResult, deliveryResult, itemsResult, historyResult, merchantsResult, branchesResult] = await Promise.all([
      addressIds.length > 0 ? supabase.from('addresses').select('*').in('id', addressIds) : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0
        ? supabase
            .from('order_delivery_details')
            .select('order_id, address_snapshot, reference_snapshot, recipient_name, recipient_phone, estimated_distance_km, estimated_time_min')
            .in('order_id', orderIds)
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0
        ? supabase
            .from('order_items')
            .select('id, order_id, product_name_snapshot, quantity, unit_price, line_total, notes')
            .in('order_id', orderIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0
        ? supabase
            .from('order_status_history')
            .select('id, order_id, from_status, to_status, actor_type, note, created_at')
            .in('order_id', orderIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      supabase.from('merchants').select('id, trade_name'),
      supabase.from('merchant_branches').select('id, name'),
    ]);

    if (addressesResult.error) return { data: null, error: addressesResult.error };
    if (deliveryResult.error) return { data: null, error: deliveryResult.error };
    if (itemsResult.error) return { data: null, error: itemsResult.error };
    if (historyResult.error) return { data: null, error: historyResult.error };
    if (merchantsResult.error) return { data: null, error: merchantsResult.error };
    if (branchesResult.error) return { data: null, error: branchesResult.error };

    const itemRows = (itemsResult.data ?? []) as any[];
    const itemIds = itemRows.map((row) => stringOrEmpty(row.id)).filter(Boolean);
    const finalModifiersResult =
      itemIds.length > 0
        ? await supabase
            .from('order_item_modifiers')
            .select('id, order_item_id, option_name_snapshot, price_delta, quantity')
            .in('order_item_id', itemIds)
        : ({ data: [], error: null } as any);

    if (finalModifiersResult.error) return { data: null, error: finalModifiersResult.error };

    const addressMap = new Map<string, any>(((addressesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), row]));
    const deliveryMap = new Map<string, any>(((deliveryResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.order_id), row]));
    const merchantMap = new Map<string, string>(((merchantsResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), stringOrEmpty(row.trade_name)]));
    const branchMap = new Map<string, string>(((branchesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), stringOrEmpty(row.name)]));
    const modifierRows = (finalModifiersResult.data ?? []) as any[];
    const historyRows = (historyResult.data ?? []) as any[];

    const addresses: CustomerAddressRecord[] = addressLinks.map((row) => {
      const address = addressMap.get(stringOrEmpty(row.address_id));
      return {
        relation_id: stringOrEmpty(row.id),
        address_id: stringOrEmpty(row.address_id),
        label: stringOrEmpty(row.label),
        is_default: Boolean(row.is_default ?? false),
        line1: stringOrEmpty(address?.line1),
        line2: stringOrEmpty(address?.line2),
        reference: stringOrEmpty(address?.reference),
        district: stringOrEmpty(address?.district),
        city: stringOrEmpty(address?.city),
        region: stringOrEmpty(address?.region),
        country: stringOrEmpty(address?.country) || 'Peru',
        lat: numberOrNull(address?.lat),
        lng: numberOrNull(address?.lng),
      };
    });

    const orders: CustomerOrderHistoryRecord[] = orderRows.map((row) => {
      const rowItems = itemRows.filter((item) => stringOrEmpty(item.order_id) === stringOrEmpty(row.id));
      const delivery = deliveryMap.get(stringOrEmpty(row.id));
      return {
        id: stringOrEmpty(row.id),
        order_code: String(row.order_code ?? row.id),
        merchant_label: merchantMap.get(stringOrEmpty(row.merchant_id)) || 'Negocio',
        branch_label: branchMap.get(stringOrEmpty(row.branch_id)) || 'Sucursal',
        status: stringOrEmpty(row.status),
        payment_status: stringOrEmpty(row.payment_status),
        fulfillment_type: stringOrEmpty(row.fulfillment_type),
        total: numberOrZero(row.total),
        currency: stringOrEmpty(row.currency) || 'PEN',
        placed_at: stringOrEmpty(row.placed_at),
        special_instructions: stringOrEmpty(row.special_instructions),
        address_snapshot: stringOrEmpty(delivery?.address_snapshot),
        reference_snapshot: stringOrEmpty(delivery?.reference_snapshot),
        recipient_name: stringOrEmpty(delivery?.recipient_name),
        recipient_phone: stringOrEmpty(delivery?.recipient_phone),
        estimated_distance_km: stringOrEmpty(delivery?.estimated_distance_km),
        estimated_time_min: stringOrEmpty(delivery?.estimated_time_min),
        items: rowItems.map((item) => ({
          id: stringOrEmpty(item.id),
          product_name_snapshot: stringOrEmpty(item.product_name_snapshot),
          quantity: numberOrZero(item.quantity),
          unit_price: numberOrZero(item.unit_price),
          line_total: numberOrZero(item.line_total),
          notes: stringOrEmpty(item.notes),
          modifiers: modifierRows
            .filter((modifier) => stringOrEmpty(modifier.order_item_id) === stringOrEmpty(item.id))
            .map((modifier) => ({
              id: stringOrEmpty(modifier.id),
              option_name_snapshot: stringOrEmpty(modifier.option_name_snapshot),
              price_delta: numberOrZero(modifier.price_delta),
              quantity: numberOrZero(modifier.quantity),
            })),
        })),
        history: historyRows
          .filter((entry) => stringOrEmpty(entry.order_id) === stringOrEmpty(row.id))
          .map((entry) => ({
            id: stringOrEmpty(entry.id),
            from_status: stringOrEmpty(entry.from_status),
            to_status: stringOrEmpty(entry.to_status),
            actor_type: stringOrEmpty(entry.actor_type) || 'system',
            note: stringOrEmpty(entry.note),
            created_at: stringOrEmpty(entry.created_at),
          })),
      };
    });

    return {
      data: {
        profile: {
          full_name: stringOrEmpty(profileResult.data?.full_name),
          email: stringOrEmpty(profileResult.data?.email),
          phone: stringOrEmpty(profileResult.data?.phone),
          rating_avg: numberOrZero(customerResult.data?.rating_avg),
        },
        addresses,
        orders,
      },
      error: null,
    };
  },

  saveProfile: async (userId: string, profile: Omit<CustomerRegistrationPayload, 'password'>) => {
    return publicCustomerService.ensureCustomerAccount(userId, profile);
  },

  saveAddress: async (userId: string, form: CustomerAddressForm) => {
    const now = new Date().toISOString();

    let addressId = form.address_id;
    if (addressId) {
      const payload = buildAddressPayload(form, now, true);
      const updateAddress = await supabase
        .from('addresses')
        .update(payload)
        .eq('id', addressId)
        .select('id')
        .single();

      if (updateAddress.error && isMissingLatLngColumn(updateAddress.error)) {
        const retryAddress = await supabase
          .from('addresses')
          .update(buildAddressPayload(form, now, false))
          .eq('id', addressId)
          .select('id')
          .single();
        if (retryAddress.error) return { data: null, error: retryAddress.error };
        addressId = stringOrEmpty(retryAddress.data?.id);
      } else if (updateAddress.error) {
        return { data: null, error: updateAddress.error };
      } else {
        addressId = stringOrEmpty(updateAddress.data?.id);
      }
    } else {
      const payload = {
        id: randomId(),
        ...buildAddressPayload(form, now, true),
        created_at: now,
      };
      const insertAddress = await supabase
        .from('addresses')
        .insert(payload)
        .select('id')
        .single();

      if (insertAddress.error && isMissingLatLngColumn(insertAddress.error)) {
        const retryAddress = await supabase
          .from('addresses')
          .insert({
            id: payload.id,
            ...buildAddressPayload(form, now, false),
            created_at: now,
          })
          .select('id')
          .single();
        if (retryAddress.error) return { data: null, error: retryAddress.error };
        addressId = stringOrEmpty(retryAddress.data?.id);
      } else if (insertAddress.error) {
        return { data: null, error: insertAddress.error };
      } else {
        addressId = stringOrEmpty(insertAddress.data?.id);
      }
    }

    if (form.is_default) {
      const clearDefaults = await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', userId);
      if (clearDefaults.error) return { data: null, error: clearDefaults.error };
    }

    if (form.relation_id) {
      const updateRelation = await supabase
        .from('customer_addresses')
        .update({
          address_id: addressId,
          label: form.label,
          is_default: form.is_default,
        })
        .eq('id', form.relation_id)
        .select('id')
        .single();
      return updateRelation.error ? { data: null, error: updateRelation.error } : { data: updateRelation.data, error: null };
    }

    const insertRelation = await supabase
      .from('customer_addresses')
      .insert({
        id: randomId(),
        customer_id: userId,
        address_id: addressId,
        label: form.label,
        is_default: form.is_default,
        created_at: now,
      })
      .select('id')
      .single();

    return insertRelation.error ? { data: null, error: insertRelation.error } : { data: insertRelation.data, error: null };
  },

  /**
   * Guarda una dirección de entrega en el perfil del cliente.
   * Retorna el address_id guardado.
   * NOTA: La creación del pedido ya NO ocurre aquí — se delega al backend
   * mediante courierPaymentService.createOrder(quote_id, ...).
   * El frontend nunca calcula precios ni crea pedidos directamente en Supabase.
   */
  saveDeliveryAddress: async (userId: string, payload: PlaceOrderPayload): Promise<{ data: { address_id: string } | null; error: Error | null }> => {
    const ensuredCustomer = await ensureCustomerRow(userId);
    if (ensuredCustomer.error) return { data: null, error: ensuredCustomer.error as Error };

    if (payload.fulfillment_type !== 'delivery') {
      return { data: { address_id: '' }, error: null };
    }

    const now = new Date().toISOString();
    const addressResult = await supabase
      .from('addresses')
      .insert({
        id: randomId(),
        line1: payload.address.line1,
        line2: nullableString(payload.address.line2),
        reference: nullableString(payload.address.reference),
        district: nullableString(payload.address.district),
        city: nullableString(payload.address.city),
        region: nullableString(payload.address.region),
        country: nullableString(payload.address.country || 'Peru'),
        lat: numberOrNull(payload.address.lat),
        lng: numberOrNull(payload.address.lng),
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (addressResult.error) return { data: null, error: addressResult.error as Error };
    const addressId = stringOrEmpty(addressResult.data?.id);

    if (payload.save_address && addressId) {
      const savedAddressResult = await publicCustomerService.saveAddress(userId, {
        ...payload.address,
        address_id: addressId,
      });
      if (savedAddressResult.error) return { data: null, error: savedAddressResult.error as Error };
    }

    return { data: { address_id: addressId }, error: null };
  },
};
