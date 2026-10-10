import { supabase } from '../../integrations/supabase/client';
import { PortalScopeType } from '../types';

export interface PlatformPaymentMethodRecord {
  id: string;
  code: string;
  name: string;
  is_online: boolean;
  is_active: boolean;
  payments_count: number;
  transactions_count: number;
  refunds_count: number;
}

export interface PlatformPaymentRecord {
  id: string;
  order_id: string;
  order_code: string;
  merchant_id: string;
  merchant_label: string;
  branch_label: string;
  customer_label: string;
  payment_method_id: string;
  payment_method_label: string;
  amount: number;
  /** Solo productos del pedido: lo que le corresponde al negocio, sin delivery ni cargos de ACME. */
  products_amount: number;
  currency: string;
  status: string;
  provider: string;
  external_reference: string;
  requested_at: string;
  authorized_at: string;
  captured_at: string;
  failed_at: string;
}

export interface PlatformPaymentTransactionRecord {
  id: string;
  payment_id: string;
  payment_label: string;
  merchant_label: string;
  transaction_type: string;
  amount: number;
  status: string;
  provider_transaction_id: string;
  created_at: string;
}

export interface PlatformRefundRecord {
  id: string;
  payment_id: string;
  payment_label: string;
  merchant_label: string;
  amount: number;
  reason: string;
  status: string;
  requested_at: string;
  processed_at: string;
}

export interface PlatformCashCollectionRecord {
  id: string;
  order_id: string;
  order_code: string;
  merchant_label: string;
  branch_label: string;
  driver_id: string;
  driver_label: string;
  amount_collected: number;
  status: string;
  collected_at: string;
  settled_at: string;
}

export interface PlatformPaymentsOverview {
  summary: {
    payments: number;
    transactions: number;
    refunds: number;
    cash_collections: number;
    active_methods: number;
    gross_amount: number;
    /** Suma de productos de los cobros validos: las ventas del negocio. */
    products_amount: number;
    refunded_amount: number;
    pending_cash_amount: number;
    settled_cash_amount: number;
  };
  payment_methods: PlatformPaymentMethodRecord[];
  payments: PlatformPaymentRecord[];
  transactions: PlatformPaymentTransactionRecord[];
  refunds: PlatformRefundRecord[];
  cash_collections: PlatformCashCollectionRecord[];
}

export interface PaymentMethodAdminForm {
  id?: string;
  code: string;
  name: string;
  is_online: boolean;
  is_active: boolean;
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}

export const adminPaymentsService = {
  createEmptyPaymentMethodForm(): PaymentMethodAdminForm {
    return {
      code: '',
      name: '',
      is_online: true,
      is_active: true,
    };
  },

  createPaymentMethodForm(record: PlatformPaymentMethodRecord): PaymentMethodAdminForm {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      is_online: record.is_online,
      is_active: record.is_active,
    };
  },

  async fetchOverview(params?: { scopeType?: PortalScopeType | null; merchantId?: string | null }) {
    const [paymentMethodsResult, paymentsResult, transactionsResult, refundsResult, cashCollectionsResult] = await Promise.all([
      supabase.from('payment_methods').select('id, code, name, is_online, is_active').order('name', { ascending: true }),
      supabase
        .from('payments')
        .select('id, order_id, payment_method_id, amount, currency, status, provider, external_reference, requested_at, authorized_at, captured_at, failed_at')
        .order('requested_at', { ascending: false })
        .limit(300),
      supabase
        .from('payment_transactions')
        .select('id, payment_id, transaction_type, amount, status, provider_transaction_id, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('refunds')
        .select('id, payment_id, order_id, amount, reason, status, requested_at, processed_at')
        .order('requested_at', { ascending: false })
        .limit(300),
      supabase
        .from('cash_collections')
        .select('id, driver_id, order_id, amount_collected, status, collected_at, settled_at')
        .order('collected_at', { ascending: false })
        .limit(300),
    ]);

    if (paymentMethodsResult.error) return { data: null, error: paymentMethodsResult.error };
    if (paymentsResult.error) return { data: null, error: paymentsResult.error };
    if (transactionsResult.error) return { data: null, error: transactionsResult.error };
    if (refundsResult.error) return { data: null, error: refundsResult.error };
    if (cashCollectionsResult.error) return { data: null, error: cashCollectionsResult.error };

    let paymentRows = (paymentsResult.data ?? []) as any[];
    const transactionRows = (transactionsResult.data ?? []) as any[];
    let refundRows = (refundsResult.data ?? []) as any[];
    let cashCollectionRows = (cashCollectionsResult.data ?? []) as any[];
    const paymentMethodRows = (paymentMethodsResult.data ?? []) as any[];

    const orderIds = uniqueStrings([
      ...paymentRows.map((row) => stringOrEmpty(row.order_id)),
      ...refundRows.map((row) => stringOrEmpty(row.order_id)),
      ...cashCollectionRows.map((row) => stringOrEmpty(row.order_id)),
    ]);

    const ordersResult =
      orderIds.length > 0
        ? await supabase.from('orders').select('id, order_code, merchant_id, branch_id, customer_id, subtotal').in('id', orderIds)
        : ({ data: [], error: null } as any);

    if (ordersResult.error) return { data: null, error: ordersResult.error };

    let orderRows = (ordersResult.data ?? []) as any[];
    const shouldFilterByMerchant = params?.scopeType === 'business' && !!params.merchantId;
    if (shouldFilterByMerchant) {
      const merchantId = stringOrEmpty(params?.merchantId);
      const allowedOrderIds = new Set(
        orderRows
          .filter((row) => stringOrEmpty(row.merchant_id) === merchantId)
          .map((row) => stringOrEmpty(row.id))
      );

      orderRows = orderRows.filter((row) => allowedOrderIds.has(stringOrEmpty(row.id)));
      paymentRows = paymentRows.filter((row) => allowedOrderIds.has(stringOrEmpty(row.order_id)));
      refundRows = refundRows.filter((row) => allowedOrderIds.has(stringOrEmpty(row.order_id)));
      cashCollectionRows = cashCollectionRows.filter((row) => allowedOrderIds.has(stringOrEmpty(row.order_id)));
    }

    const paymentIds = uniqueStrings(paymentRows.map((row) => stringOrEmpty(row.id)));
    const filteredTransactionRows = transactionRows.filter((row) => paymentIds.includes(stringOrEmpty(row.payment_id)));

    const merchantIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.merchant_id)));
    const branchIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.branch_id)));
    const customerIds = uniqueStrings(orderRows.map((row) => stringOrEmpty(row.customer_id)));
    const driverIds = uniqueStrings(cashCollectionRows.map((row) => stringOrEmpty(row.driver_id)));

    const [merchantsResult, branchesResult, profilesResult] = await Promise.all([
      merchantIds.length > 0
        ? supabase.from('merchants').select('id, trade_name, legal_name').in('id', merchantIds)
        : Promise.resolve({ data: [], error: null } as any),
      branchIds.length > 0
        ? supabase.from('merchant_branches').select('id, name').in('id', branchIds)
        : Promise.resolve({ data: [], error: null } as any),
      customerIds.length + driverIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', uniqueStrings([...customerIds, ...driverIds]))
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (merchantsResult.error) return { data: null, error: merchantsResult.error };
    if (branchesResult.error) return { data: null, error: branchesResult.error };
    if (profilesResult.error) return { data: null, error: profilesResult.error };

    const paymentMethodMap = new Map<string, PlatformPaymentMethodRecord>(
      paymentMethodRows.map((row) => [
        stringOrEmpty(row.id),
        {
          id: stringOrEmpty(row.id),
          code: stringOrEmpty(row.code),
          name: stringOrEmpty(row.name),
          is_online: Boolean(row.is_online ?? false),
          is_active: Boolean(row.is_active ?? true),
          payments_count: 0,
          transactions_count: 0,
          refunds_count: 0,
        } satisfies PlatformPaymentMethodRecord,
      ])
    );

    const orderMap = new Map<string, any>(orderRows.map((row) => [stringOrEmpty(row.id), row]));
    const merchantMap = new Map<string, string>(
      ((merchantsResult.data ?? []) as any[]).map((row) => [
        stringOrEmpty(row.id),
        stringOrEmpty(row.trade_name) || stringOrEmpty(row.legal_name) || stringOrEmpty(row.id),
      ])
    );
    const branchMap = new Map<string, string>(((branchesResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.id), stringOrEmpty(row.name)]));
    const profileMap = new Map<string, string>(
      ((profilesResult.data ?? []) as any[]).map((row) => [
        stringOrEmpty(row.user_id),
        stringOrEmpty(row.full_name) || stringOrEmpty(row.email) || stringOrEmpty(row.user_id),
      ])
    );

    const payments: PlatformPaymentRecord[] = paymentRows.map((row) => {
      const order = orderMap.get(stringOrEmpty(row.order_id));
      const methodId = stringOrEmpty(row.payment_method_id);
      const method = paymentMethodMap.get(methodId);
      if (method) {
        method.payments_count += 1;
      }

      return {
        id: stringOrEmpty(row.id),
        order_id: stringOrEmpty(row.order_id),
        order_code: stringOrEmpty(order?.order_code) || stringOrEmpty(row.order_id),
        merchant_id: stringOrEmpty(order?.merchant_id),
        merchant_label: merchantMap.get(stringOrEmpty(order?.merchant_id)) || 'Sin comercio',
        branch_label: branchMap.get(stringOrEmpty(order?.branch_id)) || 'Sin sucursal',
        customer_label: profileMap.get(stringOrEmpty(order?.customer_id)) || 'Sin cliente',
        payment_method_id: methodId,
        payment_method_label: method?.name || 'Sin metodo',
        amount: numberOrZero(row.amount),
        products_amount: numberOrZero(order?.subtotal),
        currency: stringOrEmpty(row.currency) || 'PEN',
        status: stringOrEmpty(row.status) || 'pending',
        provider: stringOrEmpty(row.provider),
        external_reference: stringOrEmpty(row.external_reference),
        requested_at: stringOrEmpty(row.requested_at),
        authorized_at: stringOrEmpty(row.authorized_at),
        captured_at: stringOrEmpty(row.captured_at),
        failed_at: stringOrEmpty(row.failed_at),
      } satisfies PlatformPaymentRecord;
    });

    const paymentMap = new Map<string, PlatformPaymentRecord>(payments.map((payment) => [payment.id, payment]));
    const transactions: PlatformPaymentTransactionRecord[] = filteredTransactionRows.map((row) => {
      const payment = paymentMap.get(stringOrEmpty(row.payment_id));
      const method = payment ? paymentMethodMap.get(payment.payment_method_id) : null;
      if (method) {
        method.transactions_count += 1;
      }

      return {
        id: stringOrEmpty(row.id),
        payment_id: stringOrEmpty(row.payment_id),
        payment_label: payment ? `${payment.payment_method_label} / ${payment.order_code}` : stringOrEmpty(row.payment_id),
        merchant_label: payment?.merchant_label || 'Sin comercio',
        transaction_type: stringOrEmpty(row.transaction_type),
        amount: numberOrZero(row.amount),
        status: stringOrEmpty(row.status) || 'pending',
        provider_transaction_id: stringOrEmpty(row.provider_transaction_id),
        created_at: stringOrEmpty(row.created_at),
      } satisfies PlatformPaymentTransactionRecord;
    });

    const refunds: PlatformRefundRecord[] = refundRows.map((row) => {
      const payment = paymentMap.get(stringOrEmpty(row.payment_id));
      const method = payment ? paymentMethodMap.get(payment.payment_method_id) : null;
      if (method) {
        method.refunds_count += 1;
      }

      return {
        id: stringOrEmpty(row.id),
        payment_id: stringOrEmpty(row.payment_id),
        payment_label: payment ? `${payment.payment_method_label} / ${payment.order_code}` : 'Sin pago',
        merchant_label:
          payment?.merchant_label || merchantMap.get(stringOrEmpty(orderMap.get(stringOrEmpty(row.order_id))?.merchant_id)) || 'Sin comercio',
        amount: numberOrZero(row.amount),
        reason: stringOrEmpty(row.reason),
        status: stringOrEmpty(row.status) || 'requested',
        requested_at: stringOrEmpty(row.requested_at),
        processed_at: stringOrEmpty(row.processed_at),
      } satisfies PlatformRefundRecord;
    });

    const cashCollections: PlatformCashCollectionRecord[] = cashCollectionRows.map((row) => {
      const order = orderMap.get(stringOrEmpty(row.order_id));
      return {
        id: stringOrEmpty(row.id),
        order_id: stringOrEmpty(row.order_id),
        order_code: stringOrEmpty(order?.order_code) || stringOrEmpty(row.order_id),
        merchant_label: merchantMap.get(stringOrEmpty(order?.merchant_id)) || 'Sin comercio',
        branch_label: branchMap.get(stringOrEmpty(order?.branch_id)) || 'Sin sucursal',
        driver_id: stringOrEmpty(row.driver_id),
        driver_label: profileMap.get(stringOrEmpty(row.driver_id)) || stringOrEmpty(row.driver_id) || 'Sin repartidor',
        amount_collected: numberOrZero(row.amount_collected),
        status: stringOrEmpty(row.status) || 'pending',
        collected_at: stringOrEmpty(row.collected_at),
        settled_at: stringOrEmpty(row.settled_at),
      } satisfies PlatformCashCollectionRecord;
    });

    const validPayments = payments.filter((payment) => !['failed', 'cancelled'].includes(normalizeStatus(payment.status)));
    const grossAmount = validPayments.reduce((total, payment) => total + payment.amount, 0);
    const productsAmount = validPayments.reduce((total, payment) => total + payment.products_amount, 0);
    const refundedAmount = refunds.reduce((total, refund) => total + refund.amount, 0);
    const pendingCashAmount = cashCollections
      .filter((collection) => normalizeStatus(collection.status) !== 'settled')
      .reduce((total, collection) => total + collection.amount_collected, 0);
    const settledCashAmount = cashCollections
      .filter((collection) => normalizeStatus(collection.status) === 'settled')
      .reduce((total, collection) => total + collection.amount_collected, 0);

    return {
      data: {
        summary: {
          payments: payments.length,
          transactions: transactions.length,
          refunds: refunds.length,
          cash_collections: cashCollections.length,
          active_methods: Array.from(paymentMethodMap.values()).filter((item) => item.is_active).length,
          gross_amount: grossAmount,
          products_amount: productsAmount,
          refunded_amount: refundedAmount,
          pending_cash_amount: pendingCashAmount,
          settled_cash_amount: settledCashAmount,
        },
        payment_methods: Array.from(paymentMethodMap.values()),
        payments,
        transactions,
        refunds,
        cash_collections: cashCollections,
      } satisfies PlatformPaymentsOverview,
      error: null,
    };
  },

  async savePaymentMethod(form: PaymentMethodAdminForm) {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      is_online: form.is_online,
      is_active: form.is_active,
    };

    if (form.id) {
      return supabase.from('payment_methods').update(payload).eq('id', form.id).select('id').single();
    }

    return supabase.from('payment_methods').insert(payload).select('id').single();
  },
};
