import { supabase } from '../../integrations/supabase/client';

export interface CustomerAdminRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  default_role: string;
  rating_avg: number;
  ratings_count: number;
  merchant_score_avg: number | null;
  driver_score_avg: number | null;
  order_count: number;
  total_spent: number;
  active_cart_count: number;
  last_order_at: string;
  last_order_status: string;
}

export interface CustomerOrderRatingRecord {
  id: string;
  order_id: string;
  order_code: string;
  customer_id: string;
  driver_name: string;
  merchant_score: number;
  driver_score: number | null;
  comment: string;
  rated_at: string;
}

export interface CustomerAddressRecord {
  relation_id: string;
  address_id: string;
  label: string;
  is_default: boolean;
  line1: string;
  line2: string;
  reference: string;
  district: string;
  city: string;
  region: string;
  country: string;
  lat: string;
  lng: string;
}

export interface CustomerPaymentMethodRecord {
  id: string;
  payment_method_id: string;
  payment_method_label: string;
  provider_token: string;
  brand: string;
  masked_reference: string;
  is_default: boolean;
  status: string;
}

export interface CustomerCartItemModifier {
  id: string;
  option_name_snapshot: string;
  price_delta: number;
  quantity: number;
}

export interface CustomerCartItem {
  id: string;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  notes: string;
  line_total: number;
  modifiers: CustomerCartItemModifier[];
}

export interface CustomerCartRecord {
  id: string;
  branch_id: string;
  branch_label: string;
  status: string;
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  expires_at: string;
  updated_at: string;
  items: CustomerCartItem[];
}

export interface CustomerOrderRecord {
  id: string;
  order_code: string;
  branch_label: string;
  status: string;
  payment_status: string;
  total: number;
  placed_at: string;
  address_label: string;
}

export interface CustomerCouponRedemptionRecord {
  id: string;
  coupon_code: string;
  order_id: string;
  order_code: string;
  discount_amount: number;
  redeemed_at: string;
}

export interface CustomerPaymentMethodOption {
  id: string;
  code: string;
  name: string;
}

export interface CustomerAdminDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  default_role: string;
  rating_avg: number;
  ratings_count: number;
  merchant_score_avg: number | null;
  driver_score_avg: number | null;
  ratings: CustomerOrderRatingRecord[];
  created_at: string;
  updated_at: string;
  order_count: number;
  total_spent: number;
  active_cart_count: number;
  last_order_at: string;
  last_order_status: string;
  addresses: CustomerAddressRecord[];
  payment_methods: CustomerPaymentMethodRecord[];
  carts: CustomerCartRecord[];
  orders: CustomerOrderRecord[];
  coupon_redemptions: CustomerCouponRedemptionRecord[];
  payment_method_options: CustomerPaymentMethodOption[];
}

export interface CustomerProfileForm {
  full_name: string;
  phone: string;
  is_active: boolean;
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
  lat: string;
  lng: string;
}

export interface CustomerPaymentMethodForm {
  id?: string;
  payment_method_id: string;
  provider_token: string;
  brand: string;
  masked_reference: string;
  is_default: boolean;
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

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Las funciones nuevas de la base (merchant_customer_directory,
// merchant_order_ratings) llegan con una migracion; mientras no esten
// aplicadas el panel sigue funcionando con la lectura directa de antes.
function isMissingFunction(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '');
}

interface CustomerDirectoryRow {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  default_role: string;
  is_active: boolean;
  rating_avg: number;
  ratings_count: number;
  merchant_score_avg: number | null;
  driver_score_avg: number | null;
}

function mapDirectoryRow(row: any): CustomerDirectoryRow {
  return {
    user_id: String(row.user_id),
    full_name: stringOrEmpty(row.full_name),
    email: stringOrEmpty(row.email),
    phone: stringOrEmpty(row.phone),
    default_role: stringOrEmpty(row.default_role) || 'customer',
    is_active: Boolean(row.is_active ?? true),
    rating_avg: numberOrZero(row.rating_avg),
    ratings_count: numberOrZero(row.ratings_count),
    merchant_score_avg: numberOrNull(row.merchant_score_avg),
    driver_score_avg: numberOrNull(row.driver_score_avg),
  };
}

function mapRatingRow(row: any): CustomerOrderRatingRecord {
  return {
    id: String(row.id),
    order_id: stringOrEmpty(row.order_id),
    order_code: stringOrEmpty(row.order_code),
    customer_id: stringOrEmpty(row.customer_id),
    driver_name: stringOrEmpty(row.driver_name),
    merchant_score: numberOrZero(row.merchant_score),
    driver_score: numberOrNull(row.driver_score),
    comment: stringOrEmpty(row.comment),
    rated_at: stringOrEmpty(row.rated_at),
  };
}

async function fetchCustomerDirectory(merchantId: string, customerIds: string[]) {
  const directoryResult = await supabase.rpc('merchant_customer_directory', { p_merchant_id: merchantId });
  if (!directoryResult.error) {
    const rows = ((directoryResult.data ?? []) as any[]).map(mapDirectoryRow);
    return { data: new Map(rows.map((row) => [row.user_id, row])), error: null };
  }
  if (!isMissingFunction(directoryResult.error)) {
    return { data: null, error: directoryResult.error };
  }

  const [profilesResult, customersResult] = await Promise.all([
    supabase.from('profiles').select('user_id, full_name, email, phone, default_role, is_active').in('user_id', customerIds),
    supabase.from('customers').select('user_id, rating_avg').in('user_id', customerIds),
  ]);
  if (profilesResult.error) return { data: null, error: profilesResult.error };
  if (customersResult.error) return { data: null, error: customersResult.error };

  const ratingMap = new Map<string, any>((customersResult.data ?? []).map((row: any) => [String(row.user_id), row]));
  const rows = ((profilesResult.data ?? []) as any[]).map((row) =>
    mapDirectoryRow({ ...row, rating_avg: ratingMap.get(String(row.user_id))?.rating_avg, ratings_count: 0 })
  );
  return { data: new Map(rows.map((row) => [row.user_id, row])), error: null };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export const adminCustomersService = {
  createEmptyProfileForm: (): CustomerProfileForm => ({
    full_name: '',
    phone: '',
    is_active: true,
  }),

  createEmptyAddressForm: (): CustomerAddressForm => ({
    label: 'Casa',
    is_default: false,
    line1: '',
    line2: '',
    reference: '',
    district: '',
    city: '',
    region: 'Junin',
    country: 'Peru',
    lat: '',
    lng: '',
  }),

  createEmptyPaymentMethodForm: (): CustomerPaymentMethodForm => ({
    payment_method_id: '',
    provider_token: '',
    brand: '',
    masked_reference: '',
    is_default: false,
    status: 'active',
  }),

  createProfileForm: (detail: CustomerAdminDetail): CustomerProfileForm => ({
    full_name: detail.full_name,
    phone: detail.phone,
    is_active: detail.is_active,
  }),

  createAddressForm: (record: CustomerAddressRecord): CustomerAddressForm => ({
    relation_id: record.relation_id,
    address_id: record.address_id,
    label: record.label,
    is_default: record.is_default,
    line1: record.line1,
    line2: record.line2,
    reference: record.reference,
    district: record.district,
    city: record.city,
    region: record.region,
    country: record.country,
    lat: record.lat,
    lng: record.lng,
  }),

  createPaymentMethodForm: (record: CustomerPaymentMethodRecord): CustomerPaymentMethodForm => ({
    id: record.id,
    payment_method_id: record.payment_method_id,
    provider_token: record.provider_token,
    brand: record.brand,
    masked_reference: record.masked_reference,
    is_default: record.is_default,
    status: record.status,
  }),

  fetchCustomers: async (merchantId: string) => {
    const [ordersResult, cartsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('customer_id, total, status, placed_at')
        .eq('merchant_id', merchantId)
        .order('placed_at', { ascending: false }),
      supabase
        .from('carts')
        .select('customer_id, status')
        .eq('merchant_id', merchantId),
    ]);

    if (ordersResult.error) return { data: null, error: ordersResult.error };
    if (cartsResult.error) return { data: null, error: cartsResult.error };

    const orderRows = (ordersResult.data ?? []) as any[];
    const cartRows = (cartsResult.data ?? []) as any[];
    const customerIds = uniqueStrings([
      ...orderRows.map((row) => String(row.customer_id)).filter(Boolean),
      ...cartRows.map((row) => String(row.customer_id)).filter(Boolean),
    ]);

    if (customerIds.length === 0) {
      return { data: [] as CustomerAdminRecord[], error: null };
    }

    const directoryResult = await fetchCustomerDirectory(merchantId, customerIds);
    if (directoryResult.error || !directoryResult.data) return { data: null, error: directoryResult.error };
    const directory = directoryResult.data;

    const data: CustomerAdminRecord[] = customerIds
      .map((customerId) => {
        const profile = directory.get(customerId);
        const customerOrders = orderRows.filter((row) => String(row.customer_id) === customerId);
        const customerCarts = cartRows.filter((row) => String(row.customer_id) === customerId);
        const lastOrder = customerOrders[0];

        return {
          id: customerId,
          full_name: profile?.full_name || 'Sin nombre',
          email: profile?.email ?? '',
          phone: profile?.phone ?? '',
          is_active: profile?.is_active ?? true,
          default_role: profile?.default_role || 'customer',
          rating_avg: profile?.rating_avg ?? 0,
          ratings_count: profile?.ratings_count ?? 0,
          merchant_score_avg: profile?.merchant_score_avg ?? null,
          driver_score_avg: profile?.driver_score_avg ?? null,
          order_count: customerOrders.length,
          total_spent: customerOrders.reduce((sum, row) => sum + numberOrZero(row.total), 0),
          active_cart_count: customerCarts.filter((row) => String(row.status).toLowerCase() !== 'abandoned').length,
          last_order_at: stringOrEmpty(lastOrder?.placed_at),
          last_order_status: stringOrEmpty(lastOrder?.status),
        };
      })
      .sort((left, right) => (right.last_order_at || '').localeCompare(left.last_order_at || '') || left.full_name.localeCompare(right.full_name));

    return { data, error: null };
  },

  fetchMerchantRatings: async (merchantId: string, customerId?: string) => {
    const result = await supabase.rpc('merchant_order_ratings', {
      p_merchant_id: merchantId,
      p_customer_id: customerId ?? null,
    });
    if (result.error) {
      if (isMissingFunction(result.error)) return { data: [] as CustomerOrderRatingRecord[], error: null };
      return { data: null, error: result.error };
    }
    return { data: ((result.data ?? []) as any[]).map(mapRatingRow), error: null };
  },

  fetchCustomerDetail: async (customerId: string, merchantId: string) => {
    const [directoryResult, ratingsResult, customerResult, addressLinksResult, paymentLinksResult, cartsResult, ordersResult, paymentMethodOptionsResult] = await Promise.all([
      fetchCustomerDirectory(merchantId, [customerId]),
      adminCustomersService.fetchMerchantRatings(merchantId, customerId),
      supabase.from('customers').select('user_id, rating_avg, created_at, updated_at').eq('user_id', customerId).maybeSingle(),
      supabase.from('customer_addresses').select('id, customer_id, address_id, label, is_default, created_at').eq('customer_id', customerId).order('created_at', { ascending: true }),
      supabase.from('customer_payment_methods').select('id, customer_id, payment_method_id, provider_token, brand, masked_reference, is_default, status, created_at, updated_at').eq('customer_id', customerId).order('created_at', { ascending: true }),
      supabase.from('carts').select('id, customer_id, merchant_id, branch_id, status, subtotal, discount_total, delivery_fee, service_fee, total, expires_at, created_at, updated_at').eq('customer_id', customerId).eq('merchant_id', merchantId).order('updated_at', { ascending: false }),
      supabase.from('orders').select('id, order_code, branch_id, status, payment_status, total, placed_at').eq('customer_id', customerId).eq('merchant_id', merchantId).order('placed_at', { ascending: false }),
      supabase.from('payment_methods').select('id, code, name').eq('is_active', true).order('name', { ascending: true }),
    ]);

    if (directoryResult.error || !directoryResult.data) return { data: null, error: directoryResult.error };
    if (ratingsResult.error) return { data: null, error: ratingsResult.error };
    if (customerResult.error) return { data: null, error: customerResult.error };
    if (addressLinksResult.error) return { data: null, error: addressLinksResult.error };
    if (paymentLinksResult.error) return { data: null, error: paymentLinksResult.error };
    if (cartsResult.error) return { data: null, error: cartsResult.error };
    if (ordersResult.error) return { data: null, error: ordersResult.error };
    if (paymentMethodOptionsResult.error) return { data: null, error: paymentMethodOptionsResult.error };
    const directoryRow = directoryResult.data.get(customerId);
    if (!directoryRow && !customerResult.data) {
      return { data: null, error: null };
    }

    const addressLinks = (addressLinksResult.data ?? []) as any[];
    const paymentLinks = (paymentLinksResult.data ?? []) as any[];
    const cartRows = (cartsResult.data ?? []) as any[];
    const orderRows = (ordersResult.data ?? []) as any[];

    const addressIds = uniqueStrings(addressLinks.map((row) => String(row.address_id)).filter(Boolean));
    const cartIds = uniqueStrings(cartRows.map((row) => String(row.id)).filter(Boolean));
    const orderIds = uniqueStrings(orderRows.map((row) => String(row.id)).filter(Boolean));
    const paymentMethodIds = uniqueStrings(paymentLinks.map((row) => String(row.payment_method_id)).filter(Boolean));
    const branchIds = uniqueStrings([
      ...cartRows.map((row) => String(row.branch_id)).filter(Boolean),
      ...orderRows.map((row) => String(row.branch_id)).filter(Boolean),
    ]);

    const [addressesResult, paymentMethodsResult, cartItemsResult, orderDeliveryResult, couponRedemptionsResult, branchesResult] = await Promise.all([
      addressIds.length > 0 ? supabase.from('addresses').select('*').in('id', addressIds) : Promise.resolve({ data: [], error: null } as any),
      paymentMethodIds.length > 0 ? supabase.from('payment_methods').select('id, code, name').in('id', paymentMethodIds) : Promise.resolve({ data: [], error: null } as any),
      cartIds.length > 0 ? supabase.from('cart_items').select('*').in('cart_id', cartIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0 ? supabase.from('order_delivery_details').select('order_id, address_snapshot').in('order_id', orderIds) : Promise.resolve({ data: [], error: null } as any),
      orderIds.length > 0 ? supabase.from('coupon_redemptions').select('id, coupon_id, customer_id, order_id, discount_amount, redeemed_at').eq('customer_id', customerId).in('order_id', orderIds).order('redeemed_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
      branchIds.length > 0 ? supabase.from('merchant_branches').select('id, name').in('id', branchIds) : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (addressesResult.error) return { data: null, error: addressesResult.error };
    if (paymentMethodsResult.error) return { data: null, error: paymentMethodsResult.error };
    if (cartItemsResult.error) return { data: null, error: cartItemsResult.error };
    if (orderDeliveryResult.error) return { data: null, error: orderDeliveryResult.error };
    if (couponRedemptionsResult.error) return { data: null, error: couponRedemptionsResult.error };
    if (branchesResult.error) return { data: null, error: branchesResult.error };

    const cartItems = (cartItemsResult.data ?? []) as any[];
    const cartItemIds = uniqueStrings(cartItems.map((row) => String(row.id)).filter(Boolean));
    const couponIds = uniqueStrings(((couponRedemptionsResult.data ?? []) as any[]).map((row) => String(row.coupon_id)).filter(Boolean));

    const [cartModifiersResult, couponsResult] = await Promise.all([
      cartItemIds.length > 0 ? supabase.from('cart_item_modifiers').select('*').in('cart_item_id', cartItemIds) : Promise.resolve({ data: [], error: null } as any),
      couponIds.length > 0 ? supabase.from('coupons').select('id, code').in('id', couponIds) : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (cartModifiersResult.error) return { data: null, error: cartModifiersResult.error };
    if (couponsResult.error) return { data: null, error: couponsResult.error };

    const addressMap = new Map<string, any>((addressesResult.data ?? []).map((row: any) => [String(row.id), row]));
    const paymentMethodMap = new Map<string, any>((paymentMethodsResult.data ?? []).map((row: any) => [String(row.id), row]));
    const branchMap = new Map<string, string>((branchesResult.data ?? []).map((row: any) => [String(row.id), stringOrEmpty(row.name)]));
    const orderDeliveryMap = new Map<string, string>((orderDeliveryResult.data ?? []).map((row: any) => [String(row.order_id), stringOrEmpty(row.address_snapshot)]));
    const couponMap = new Map<string, string>((couponsResult.data ?? []).map((row: any) => [String(row.id), stringOrEmpty(row.code)]));
    const cartModifierRows = (cartModifiersResult.data ?? []) as any[];

    const addresses: CustomerAddressRecord[] = addressLinks.map((row) => {
      const address = addressMap.get(String(row.address_id));
      return {
        relation_id: String(row.id),
        address_id: String(row.address_id),
        label: stringOrEmpty(row.label) || 'Direccion',
        is_default: Boolean(row.is_default ?? false),
        line1: stringOrEmpty(address?.line1),
        line2: stringOrEmpty(address?.line2),
        reference: stringOrEmpty(address?.reference),
        district: stringOrEmpty(address?.district),
        city: stringOrEmpty(address?.city),
        region: stringOrEmpty(address?.region),
        country: stringOrEmpty(address?.country),
        lat: stringOrEmpty(address?.lat),
        lng: stringOrEmpty(address?.lng),
      };
    });

    const paymentMethods: CustomerPaymentMethodRecord[] = paymentLinks.map((row) => ({
      id: String(row.id),
      payment_method_id: stringOrEmpty(row.payment_method_id),
      payment_method_label: stringOrEmpty(paymentMethodMap.get(String(row.payment_method_id))?.name) || 'Sin metodo',
      provider_token: stringOrEmpty(row.provider_token),
      brand: stringOrEmpty(row.brand),
      masked_reference: stringOrEmpty(row.masked_reference),
      is_default: Boolean(row.is_default ?? false),
      status: stringOrEmpty(row.status) || 'active',
    }));

    const carts: CustomerCartRecord[] = cartRows.map((row) => {
      const items: CustomerCartItem[] = cartItems
        .filter((item) => String(item.cart_id) === String(row.id))
        .map((item) => ({
          id: String(item.id),
          product_name_snapshot: stringOrEmpty(item.product_name_snapshot) || 'Producto',
          unit_price: numberOrZero(item.unit_price),
          quantity: numberOrZero(item.quantity),
          notes: stringOrEmpty(item.notes),
          line_total: numberOrZero(item.line_total),
          modifiers: cartModifierRows
            .filter((modifier) => String(modifier.cart_item_id) === String(item.id))
            .map((modifier) => ({
              id: String(modifier.id),
              option_name_snapshot: stringOrEmpty(modifier.option_name_snapshot) || 'Modificador',
              price_delta: numberOrZero(modifier.price_delta),
              quantity: numberOrZero(modifier.quantity),
            })),
        }));

      return {
        id: String(row.id),
        branch_id: stringOrEmpty(row.branch_id),
        branch_label: branchMap.get(String(row.branch_id)) || 'Sucursal',
        status: stringOrEmpty(row.status),
        subtotal: numberOrZero(row.subtotal),
        discount_total: numberOrZero(row.discount_total),
        delivery_fee: numberOrZero(row.delivery_fee),
        service_fee: numberOrZero(row.service_fee),
        total: numberOrZero(row.total),
        expires_at: stringOrEmpty(row.expires_at),
        updated_at: stringOrEmpty(row.updated_at),
        items,
      };
    });

    const orders: CustomerOrderRecord[] = orderRows.map((row) => ({
      id: String(row.id),
      order_code: stringOrEmpty(row.order_code ?? row.id),
      branch_label: branchMap.get(String(row.branch_id)) || 'Sucursal',
      status: stringOrEmpty(row.status),
      payment_status: stringOrEmpty(row.payment_status),
      total: numberOrZero(row.total),
      placed_at: stringOrEmpty(row.placed_at),
      address_label: orderDeliveryMap.get(String(row.id)) || 'Sin direccion',
    }));

    const couponRedemptions: CustomerCouponRedemptionRecord[] = ((couponRedemptionsResult.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      coupon_code: couponMap.get(String(row.coupon_id)) || 'Sin cupon',
      order_id: stringOrEmpty(row.order_id),
      order_code: orders.find((order) => order.id === String(row.order_id))?.order_code || '',
      discount_amount: numberOrZero(row.discount_amount),
      redeemed_at: stringOrEmpty(row.redeemed_at),
    }));

    const customer: any = customerResult.data ?? {};
    const lastOrder = orders[0];

    const detail: CustomerAdminDetail = {
      id: customerId,
      full_name: directoryRow?.full_name || 'Sin nombre',
      email: directoryRow?.email ?? '',
      phone: directoryRow?.phone ?? '',
      is_active: directoryRow?.is_active ?? true,
      default_role: directoryRow?.default_role || 'customer',
      rating_avg: numberOrZero(directoryRow?.rating_avg ?? customer.rating_avg),
      ratings_count: directoryRow?.ratings_count ?? 0,
      merchant_score_avg: directoryRow?.merchant_score_avg ?? null,
      driver_score_avg: directoryRow?.driver_score_avg ?? null,
      ratings: ratingsResult.data ?? [],
      created_at: stringOrEmpty(customer.created_at),
      updated_at: stringOrEmpty(customer.updated_at),
      order_count: orders.length,
      total_spent: orders.reduce((sum, row) => sum + row.total, 0),
      active_cart_count: carts.filter((cart) => cart.status.toLowerCase() !== 'abandoned').length,
      last_order_at: stringOrEmpty(lastOrder?.placed_at),
      last_order_status: stringOrEmpty(lastOrder?.status),
      addresses,
      payment_methods: paymentMethods,
      carts,
      orders,
      coupon_redemptions: couponRedemptions,
      payment_method_options: ((paymentMethodOptionsResult.data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        code: stringOrEmpty(row.code),
        name: stringOrEmpty(row.name),
      })),
    };

    return { data: detail, error: null };
  },

  saveCustomerProfile: async (customerId: string, form: CustomerProfileForm) => {
    return supabase
      .from('profiles')
      .update({
        full_name: nullableString(form.full_name),
        phone: nullableString(form.phone),
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', customerId)
      .select('user_id')
      .single();
  },

  saveCustomerAddress: async (customerId: string, form: CustomerAddressForm) => {
    const now = new Date().toISOString();
    const addressPayload = {
      line1: form.line1.trim(),
      line2: nullableString(form.line2),
      reference: nullableString(form.reference),
      district: nullableString(form.district),
      city: nullableString(form.city),
      region: nullableString(form.region),
      country: nullableString(form.country),
      lat: stringNumberOrNull(form.lat),
      lng: stringNumberOrNull(form.lng),
      updated_at: now,
    };

    let addressId = form.address_id ?? '';
    if (form.address_id) {
      const updateAddress = await supabase.from('addresses').update(addressPayload).eq('id', form.address_id).select('id').single();
      if (updateAddress.error) return updateAddress;
      addressId = String((updateAddress.data as any)?.id ?? form.address_id);
    } else {
      const insertAddress = await supabase
        .from('addresses')
        .insert({
          ...addressPayload,
          created_at: now,
        })
        .select('id')
        .single();
      if (insertAddress.error) return insertAddress;
      addressId = String((insertAddress.data as any)?.id ?? '');
    }

    if (form.is_default) {
      const clearDefaults = await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
      if (clearDefaults.error) return clearDefaults;
    }

    const relationPayload = {
      customer_id: customerId,
      address_id: addressId,
      label: nullableString(form.label),
      is_default: form.is_default,
    };

    if (form.relation_id) {
      return supabase.from('customer_addresses').update(relationPayload).eq('id', form.relation_id).select('id').single();
    }

    return supabase
      .from('customer_addresses')
      .insert({
        ...relationPayload,
        created_at: now,
      })
      .select('id')
      .single();
  },

  deleteCustomerAddress: async (relationId: string) => {
    return supabase.from('customer_addresses').delete().eq('id', relationId);
  },

  saveCustomerPaymentMethod: async (customerId: string, form: CustomerPaymentMethodForm) => {
    const now = new Date().toISOString();

    if (form.is_default) {
      const clearDefaults = await supabase.from('customer_payment_methods').update({ is_default: false }).eq('customer_id', customerId);
      if (clearDefaults.error) return clearDefaults;
    }

    const payload = {
      customer_id: customerId,
      payment_method_id: form.payment_method_id,
      provider_token: nullableString(form.provider_token),
      brand: nullableString(form.brand),
      masked_reference: nullableString(form.masked_reference),
      is_default: form.is_default,
      status: form.status.trim() || 'active',
      updated_at: now,
    };

    if (form.id) {
      return supabase.from('customer_payment_methods').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase
      .from('customer_payment_methods')
      .insert({
        ...payload,
        created_at: now,
      })
      .select('id')
      .single();
  },

  deleteCustomerPaymentMethod: async (paymentMethodRelationId: string) => {
    return supabase.from('customer_payment_methods').delete().eq('id', paymentMethodRelationId);
  },
};
