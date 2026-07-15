import { PortalScopeType } from '../types';

export type AdminModuleId =
  | 'overview'
  | 'turn'
  | 'businesses'
  | 'commerce'
  | 'branches'
  | 'people'
  | 'customers'
  | 'catalog'
  | 'orders'
  | 'local_status'
  | 'operational_menu'
  | 'drivers'
  | 'payments'
  | 'promotions'
  | 'settlements'
  | 'messages'
  | 'security'
  | 'platform_users'
  | 'system';

export type AdminExposureMode =
  | 'page'
  | 'tab'
  | 'inline_grid'
  | 'modal'
  | 'drawer'
  | 'timeline'
  | 'gallery'
  | 'readonly_panel';

export type SaveStrategyKind = 'direct' | 'relational_nested' | 'action_controlled' | 'rpc' | 'readonly_backend';

export type AdminModuleGroupId =
  | 'resumen'
  | 'operacion'
  | 'catalogo'
  | 'negocio'
  | 'personas'
  | 'finanzas'
  | 'sistema';

export interface AdminModuleGroupSpec {
  id: AdminModuleGroupId;
  label: string;
  order: number;
}

export const adminModuleGroups: AdminModuleGroupSpec[] = [
  { id: 'resumen', label: 'Resumen', order: 1 },
  { id: 'operacion', label: 'Operación', order: 2 },
  { id: 'catalogo', label: 'Catálogo', order: 3 },
  { id: 'negocio', label: 'Negocio', order: 4 },
  { id: 'personas', label: 'Personas', order: 5 },
  { id: 'finanzas', label: 'Finanzas', order: 6 },
  { id: 'sistema', label: 'Sistema', order: 7 },
];

export interface AdminModuleSpec {
  id: AdminModuleId;
  label: string;
  description: string;
  route: string;
  icon?: string;
  group: AdminModuleGroupId;
  entityRootIds: string[];
  enabled: boolean;
  scopeVisibility: PortalScopeType[];
  requiresMerchant?: boolean;
  requiresBranch?: boolean;
}

export interface ChildRelationSpec {
  table: string;
  label: string;
  exposure: AdminExposureMode;
  editable: boolean;
  saveStrategy: SaveStrategyKind;
}

export interface EntityRootSpec {
  id: string;
  moduleId: AdminModuleId;
  label: string;
  singularLabel: string;
  description: string;
  ownerTables: string[];
  childRelations: ChildRelationSpec[];
  listRoute?: string;
  detailRoute?: string;
}

export interface LookupSpec {
  id: string;
  label: string;
  sourceTable: string;
  labelField: string;
  valueField: string;
  dependsOn?: string[];
}

export interface ActionSpec {
  id: string;
  label: string;
  kind: 'navigate' | 'modal' | 'mutation';
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}
