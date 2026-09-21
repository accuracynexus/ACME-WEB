import { supabase } from '../../integrations/supabase/client';
import { BranchHour } from '../types';
import { branchService } from './branchService';
import { adminMessagesService, ConversationOverviewRecord, NotificationOverviewRecord } from './adminMessagesService';
import { adminOrdersService, OrderAdminRecord } from './adminOrdersService';
import { adminService } from './adminService';
import { menuService } from './menuService';

export interface BranchTurnOverview {
  summary: {
    active_orders: number;
    issues_orders: number;
    ready_orders: number;
    open_conversations: number;
    unread_messages: number;
    pending_notifications: number;
  };
  orders: OrderAdminRecord[];
  conversations: ConversationOverviewRecord[];
  notifications: NotificationOverviewRecord[];
}

export interface BranchLocalStatusOverview {
  status: {
    is_open: boolean;
    accepting_orders: boolean;
    pause_reason: string;
  };
  hours: BranchHour[];
  closures: Array<{
    id?: string;
    starts_at: string;
    ends_at: string;
    reason: string;
  }>;
  coverage_count: number;
}

export interface OperationalMenuRecord {
  id: string;
  name: string;
  description: string;
  category_name: string;
  base_price: number;
  branch_price: number;
  is_active: boolean;
  is_available: boolean;
  is_paused: boolean;
  pause_reason: string;
  branch_setting_id: string;
  image_url: string;
}

export interface OperationalMenuForm {
  branch_setting_id?: string;
  price_override: string;
  is_available: boolean;
  is_paused: boolean;
  pause_reason: string;
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export const adminBranchOperationsService = {
  createOperationalMenuForm(record?: OperationalMenuRecord): OperationalMenuForm {
    if (!record) {
      return {
        price_override: '',
        is_available: true,
        is_paused: false,
        pause_reason: '',
      };
    }

    return {
      branch_setting_id: record.branch_setting_id || undefined,
      price_override: record.branch_setting_id ? String(record.branch_price) : '',
      is_available: record.is_available,
      is_paused: record.is_paused,
      pause_reason: record.pause_reason,
    };
  },

  async fetchTurnOverview(merchantId: string, branchId: string, currentUserId: string | null) {
    const [ordersResult, messagesResult] = await Promise.all([
      adminOrdersService.fetchOrders(branchId),
      adminMessagesService.fetchMessagesOverview(merchantId, currentUserId, branchId),
    ]);

    if (ordersResult.error) return { data: null, error: ordersResult.error };
    if (messagesResult.error) return { data: null, error: messagesResult.error };

    const orders = ordersResult.data ?? [];
    const conversations = messagesResult.data?.conversations ?? [];
    const notifications = messagesResult.data?.notifications ?? [];

    return {
      data: {
        summary: {
          active_orders: orders.filter((item) => !['delivered', 'cancelled', 'failed'].includes(item.status)).length,
          issues_orders: orders.filter((item) => item.payment_status === 'failed' || ['cancelled', 'failed'].includes(item.status)).length,
          ready_orders: orders.filter((item) => item.status === 'ready_for_pickup').length,
          open_conversations: conversations.filter((item) => ['open', 'pending'].includes(item.status)).length,
          unread_messages: conversations.reduce((total, item) => total + item.unread_count, 0),
          pending_notifications: notifications.filter((item) => item.status !== 'read').length,
        },
        orders: orders.slice(0, 12),
        conversations: conversations.slice(0, 12),
        notifications: notifications.slice(0, 12),
      } satisfies BranchTurnOverview,
      error: null,
    };
  },

  async fetchLocalStatusOverview(branchId: string) {
    const [statusResult, hoursResult, branchFormResult] = await Promise.all([
      branchService.fetchBranchStatus(branchId),
      branchService.fetchBranchHours(branchId),
      adminService.fetchBranchForm(branchId),
    ]);

    if (statusResult.error) return { data: null, error: statusResult.error };
    if (hoursResult.error) return { data: null, error: hoursResult.error };
    if (branchFormResult.error) return { data: null, error: branchFormResult.error };

    const form = branchFormResult.data;

    return {
      data: {
        status: {
          is_open: Boolean((statusResult.data as any)?.is_open ?? false),
          accepting_orders: Boolean((statusResult.data as any)?.accepting_orders ?? false),
          pause_reason: stringOrEmpty((statusResult.data as any)?.pause_reason),
        },
        hours: hoursResult.data ?? [],
        closures: form?.closures ?? [],
        coverage_count: (form?.branch_delivery_zones ?? []).filter((item) => item.assigned && item.is_active).length,
      } satisfies BranchLocalStatusOverview,
      error: null,
    };
  },

  async updateBranchStatus(branchId: string, form: BranchLocalStatusOverview['status']) {
    return branchService.updateBranchStatus(branchId, form);
  },

  async fetchOperationalMenu(merchantId: string, branchId: string) {
    const [categoriesResult, productsResult, settingsResult] = await Promise.all([
      menuService.fetchCategories(merchantId),
      menuService.fetchProducts(merchantId),
      supabase
        .from('product_branch_settings')
        .select('id, product_id, branch_id, price_override, is_available, is_paused, pause_reason')
        .eq('branch_id', branchId),
    ]);

    if (categoriesResult.error) return { data: null, error: categoriesResult.error };
    if (productsResult.error) return { data: null, error: productsResult.error };
    if (settingsResult.error) return { data: null, error: settingsResult.error };

    const categoryMap = new Map((categoriesResult.data ?? []).map((item) => [item.id, item.name]));
    const settingMap = new Map<string, any>(((settingsResult.data ?? []) as any[]).map((row) => [stringOrEmpty(row.product_id), row]));

    const data: OperationalMenuRecord[] = (productsResult.data ?? []).map((product) => {
      const setting = settingMap.get(product.id);
      const basePrice = numberOrZero((product as any).price ?? (product as any).base_price);
      const branchPrice = setting?.price_override == null ? basePrice : numberOrZero(setting.price_override);

      return {
        id: product.id,
        name: product.name,
        description: product.description ?? '',
        category_name: categoryMap.get(product.category_id ?? '') || 'Sin categoria',
        base_price: basePrice,
        branch_price: branchPrice,
        is_active: Boolean(product.active),
        is_available: Boolean(setting?.is_available ?? true),
        is_paused: Boolean(setting?.is_paused ?? false),
        pause_reason: stringOrEmpty(setting?.pause_reason),
        branch_setting_id: stringOrEmpty(setting?.id),
        image_url: stringOrEmpty((product as any).image_url),
      } satisfies OperationalMenuRecord;
    });

    return { data, error: null };
  },

  async saveOperationalMenu(branchId: string, productId: string, form: OperationalMenuForm) {
    const payload = {
      branch_id: branchId,
      product_id: productId,
      price_override: nullableNumber(form.price_override),
      is_available: form.is_available,
      is_paused: form.is_paused,
      pause_reason: form.pause_reason.trim() || null,
    };

    if (form.branch_setting_id) {
      return supabase.from('product_branch_settings').update(payload).eq('id', form.branch_setting_id).select('id').single();
    }

    const existing = await supabase
      .from('product_branch_settings')
      .select('id')
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing.error) return existing;

    if (existing.data?.id) {
      return supabase.from('product_branch_settings').update(payload).eq('id', existing.data.id).select('id').single();
    }

    return supabase.from('product_branch_settings').insert(payload).select('id').single();
  },
};
