import { supabase } from '../../integrations/supabase/client';
import { PortalScopeType } from '../types';

export interface AdminMetricCard {
  id: string;
  label: string;
  value: string;
  help: string;
}

export interface OrdersTrendPoint {
  day: string;
  label: string;
  count: number;
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat('es-PE').format(value ?? 0);
}

const BUSINESS_SETTING_KEYS = ['order_timeouts'];

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function countRows(table: string, filters: Array<{ column: string; value: string }> = []) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const filter of filters) {
    query = query.eq(filter.column, filter.value);
  }
  const result = await query;
  if (result.error) {
    return { count: 0, error: result.error };
  }
  return { count: result.count ?? 0, error: null };
}

async function countRowsIn(table: string, column: string, values: string[]) {
  if (values.length === 0) {
    return { count: 0, error: null };
  }
  const result = await supabase.from(table).select('*', { count: 'exact', head: true }).in(column, values);
  if (result.error) {
    return { count: 0, error: result.error };
  }
  return { count: result.count ?? 0, error: null };
}

async function countRowsExcluding(table: string, column: string, values: string[]) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (values.length > 0) {
    query = query.not(column, 'in', `(${values.join(',')})`);
  }
  const result = await query;
  if (result.error) {
    return { count: 0, error: result.error };
  }
  return { count: result.count ?? 0, error: null };
}

async function countMerchantSettingsRows(merchantId: string) {
  const result = await supabase.from('merchant_settings').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId);
  if (result.error) {
    const message = `${result.error.message} ${String((result.error as any).details ?? '')}`.toLowerCase();
    if (message.includes('merchant_settings')) {
      return { count: 0, error: null };
    }
    return { count: 0, error: result.error };
  }
  return { count: result.count ?? 0, error: null };
}

async function countMerchantCustomers(merchantId: string) {
  const [ordersResult, cartsResult] = await Promise.all([
    supabase.from('orders').select('customer_id').eq('merchant_id', merchantId),
    supabase.from('carts').select('customer_id').eq('merchant_id', merchantId),
  ]);

  if (ordersResult.error) {
    return { count: 0, error: ordersResult.error };
  }

  if (cartsResult.error) {
    return { count: 0, error: cartsResult.error };
  }

  const customerIds = uniqueStrings([
    ...((ordersResult.data ?? []) as any[]).map((row) => String(row.customer_id ?? '')).filter(Boolean),
    ...((cartsResult.data ?? []) as any[]).map((row) => String(row.customer_id ?? '')).filter(Boolean),
  ]);

  return { count: customerIds.length, error: null };
}

const DAY_LABELS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function toLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const adminOverviewService = {
  fetchOrdersTrend: async (params: {
    scopeType: PortalScopeType | null;
    merchantId?: string | null;
    branchId?: string | null;
  }): Promise<{ data: OrdersTrendPoint[] | null; error: { message: string } | null }> => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    let query = supabase.from('orders').select('placed_at').gte('placed_at', since.toISOString());
    if (params.scopeType === 'business' && params.merchantId) {
      query = query.eq('merchant_id', params.merchantId);
    } else if (params.scopeType === 'branch' && params.branchId) {
      query = query.eq('branch_id', params.branchId);
    }

    const result = await query;
    if (result.error) {
      return { data: null, error: result.error };
    }

    const counts = new Map<string, number>();
    for (const row of (result.data ?? []) as Array<{ placed_at: string | null }>) {
      if (!row.placed_at) continue;
      const key = toLocalDayKey(new Date(row.placed_at));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const points: OrdersTrendPoint[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(since);
      date.setDate(since.getDate() + offset);
      const key = toLocalDayKey(date);
      points.push({
        day: key,
        label: DAY_LABELS[date.getDay()],
        count: counts.get(key) ?? 0,
      });
    }

    return { data: points, error: null };
  },

  fetchMetricCards: async (params: {
    scopeType: PortalScopeType | null;
    merchantId?: string | null;
    branchId?: string | null;
  }) => {
    if (params.scopeType === 'platform') {
      const [merchantsResult, branchesResult, driversResult, settingsResult, adminsResult] = await Promise.all([
        countRows('merchants'),
        countRows('merchant_branches'),
        countRows('drivers'),
        countRowsExcluding('system_settings', 'key', BUSINESS_SETTING_KEYS),
        countRows('user_roles'),
      ]);

      const error = merchantsResult.error || branchesResult.error || driversResult.error || settingsResult.error || adminsResult.error;
      if (error) {
        return { data: null, error };
      }

      return {
        data: [
          { id: 'merchants', label: 'Comercios', value: formatCount(merchantsResult.count), help: 'Negocios visibles en toda la plataforma.' },
          { id: 'branches', label: 'Sucursales', value: formatCount(branchesResult.count), help: 'Locales creados entre todos los negocios.' },
          { id: 'drivers', label: 'Repartidores', value: formatCount(driversResult.count), help: 'Padron global de reparto.' },
          { id: 'settings', label: 'Settings globales', value: formatCount(settingsResult.count), help: 'Claves de system_settings administradas por plataforma.' },
          { id: 'access', label: 'Asignaciones de acceso', value: formatCount(adminsResult.count), help: 'Registros de user_roles activos en el sistema.' },
        ] satisfies AdminMetricCard[],
        error: null,
      };
    }

    if (params.scopeType === 'business' && params.merchantId) {
      const filters = [{ column: 'merchant_id', value: params.merchantId }];
      const branchIdsResult = await supabase.from('merchant_branches').select('id').eq('merchant_id', params.merchantId);
      if (branchIdsResult.error) {
        return { data: null, error: branchIdsResult.error };
      }
      const branchIds = ((branchIdsResult.data ?? []) as any[]).map((row) => String(row.id)).filter(Boolean);

      const [branchesResult, staffResult, customersResult, categoriesResult, productsResult, modifiersResult, hoursResult, closuresResult, coverageResult, merchantSettingsResult] = await Promise.all([
        countRows('merchant_branches', filters),
        countRows('merchant_staff', filters),
        countMerchantCustomers(params.merchantId),
        countRows('categories', filters),
        countRows('products', filters),
        countRows('modifier_groups', filters),
        countRowsIn('merchant_branch_hours', 'branch_id', branchIds),
        countRowsIn('merchant_branch_closures', 'branch_id', branchIds),
        countRowsIn('branch_delivery_zones', 'branch_id', branchIds),
        countMerchantSettingsRows(params.merchantId),
      ]);

      const error =
        branchesResult.error ||
        staffResult.error ||
        customersResult.error ||
        categoriesResult.error ||
        productsResult.error ||
        modifiersResult.error ||
        hoursResult.error ||
        closuresResult.error ||
        coverageResult.error ||
        merchantSettingsResult.error;
      if (error) {
        return { data: null, error };
      }

      return {
        data: [
          { id: 'branches', label: 'Sucursales', value: formatCount(branchesResult.count), help: 'Locales que dependen del negocio actual.' },
          { id: 'staff', label: 'Equipo', value: formatCount(staffResult.count), help: 'Personal asignado al comercio.' },
          { id: 'customers', label: 'Clientes', value: formatCount(customersResult.count), help: 'Clientes vinculados al negocio por historico o actividad.' },
          { id: 'categories', label: 'Categorias', value: formatCount(categoriesResult.count), help: 'Estructura base del catalogo del negocio.' },
          { id: 'products', label: 'Productos', value: formatCount(productsResult.count), help: 'Catalogo operativo del negocio.' },
          { id: 'modifiers', label: 'Modificadores', value: formatCount(modifiersResult.count), help: 'Grupos reutilizables para personalizacion del menu.' },
          { id: 'merchant_settings', label: 'Settings negocio', value: formatCount(merchantSettingsResult.count), help: 'Claves propias del negocio en merchant_settings.' },
          { id: 'hours', label: 'Horarios', value: formatCount(hoursResult.count), help: 'Bloques activos configurados en merchant_branch_hours.' },
          { id: 'closures', label: 'Cierres', value: formatCount(closuresResult.count), help: 'Cierres especiales cargados para las sucursales.' },
          { id: 'coverage', label: 'Cobertura', value: formatCount(coverageResult.count), help: 'Asignaciones branch_delivery_zones activas para el negocio.' },
        ] satisfies AdminMetricCard[],
        error: null,
      };
    }

    if (params.scopeType === 'branch' && params.branchId) {
      const filters = [{ column: 'branch_id', value: params.branchId }];
      const [ordersResult, coverageResult, assignmentsResult, schedulesResult, statusResult] = await Promise.all([
        countRows('orders', filters),
        countRows('branch_delivery_zones', filters),
        countRows('merchant_staff_branches', filters),
        countRows('merchant_branch_hours', filters),
        countRows('merchant_branch_status', filters),
      ]);

      const error = ordersResult.error || coverageResult.error || assignmentsResult.error || schedulesResult.error || statusResult.error;
      if (error) {
        return { data: null, error };
      }

      return {
        data: [
          { id: 'orders', label: 'Pedidos', value: formatCount(ordersResult.count), help: 'Pedidos registrados para la sucursal actual.' },
          { id: 'coverage', label: 'Zonas cubiertas', value: formatCount(coverageResult.count), help: 'Relaciones branch_delivery_zones del local.' },
          { id: 'assignments', label: 'Equipo asignado', value: formatCount(assignmentsResult.count), help: 'Vinculos merchant_staff_branches para el local.' },
          { id: 'schedules', label: 'Bloques horario', value: formatCount(schedulesResult.count), help: 'Configuracion operativa cargada en merchant_branch_hours.' },
          { id: 'status', label: 'Estado operativo', value: formatCount(statusResult.count), help: 'Registros de estado del local en merchant_branch_status.' },
        ] satisfies AdminMetricCard[],
        error: null,
      };
    }

    return { data: [] as AdminMetricCard[], error: null };
  },
};
