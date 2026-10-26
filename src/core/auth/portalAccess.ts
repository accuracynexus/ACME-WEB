import {
  MerchantBranch,
  MerchantStaff,
  PortalPermissions,
  PortalRoleAssignment,
  PortalScopeType,
  UserProfile,
} from '../types';
import type { AdminModuleId } from '../admin/contracts';

const PLATFORM_ROLE_CODES = new Set(['super_admin', 'admin']);
const BUSINESS_ROLE_CODES = new Set(['owner', 'manager']);
const BRANCH_ROLE_CODES = new Set(['cashier', 'operator', 'kitchen', 'support', 'staff']);

function normalizeCode(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function hasMatchingRole(roleAssignments: PortalRoleAssignment[], codes: Set<string>) {
  return roleAssignments.some((assignment) => codes.has(normalizeCode(assignment.code)));
}

export function hasPlatformRole(roleAssignments: PortalRoleAssignment[], profile: UserProfile | null) {
  return hasMatchingRole(roleAssignments, PLATFORM_ROLE_CODES) || PLATFORM_ROLE_CODES.has(normalizeCode(profile?.default_role));
}

function getStaffRoleCode(staffAssignment: MerchantStaff | null) {
  return normalizeCode(staffAssignment?.role);
}

function hasBusinessStaffAccess(staffAssignment: MerchantStaff | null) {
  return BUSINESS_ROLE_CODES.has(getStaffRoleCode(staffAssignment));
}

function hasBranchStaffAccess(staffAssignment: MerchantStaff | null) {
  const roleCode = getStaffRoleCode(staffAssignment);
  return BUSINESS_ROLE_CODES.has(roleCode) || BRANCH_ROLE_CODES.has(roleCode);
}

export function resolvePortalAccess(params: {
  roleAssignments: PortalRoleAssignment[];
  profile: UserProfile | null;
  staffAssignment: MerchantStaff | null;
  branches: MerchantBranch[];
}) {
  const hasPlatformAccess = hasPlatformRole(params.roleAssignments, params.profile);
  const hasBusinessAccess = !!params.staffAssignment && hasBusinessStaffAccess(params.staffAssignment);
  const hasBranchAccess = !!params.staffAssignment && params.branches.length > 0 && hasBranchStaffAccess(params.staffAssignment);
  const availableScopeTypes: PortalScopeType[] = [];

  if (hasPlatformAccess) {
    availableScopeTypes.push('platform');
  }
  if (hasBusinessAccess) {
    availableScopeTypes.push('business');
  }
  if (hasBranchAccess) {
    availableScopeTypes.push('branch');
  }

  return {
    hasPlatformAccess,
    hasBusinessAccess,
    hasBranchAccess,
    availableScopeTypes,
  };
}

export function resolvePreferredScopeType(params: {
  availableScopeTypes: PortalScopeType[];
  preferredScopeType?: PortalScopeType | null;
}) {
  const { availableScopeTypes, preferredScopeType } = params;
  if (preferredScopeType && availableScopeTypes.includes(preferredScopeType)) {
    return preferredScopeType;
  }
  if (availableScopeTypes.includes('platform')) {
    return 'platform' satisfies PortalScopeType;
  }
  if (availableScopeTypes.includes('business')) {
    return 'business' satisfies PortalScopeType;
  }
  if (availableScopeTypes.includes('branch')) {
    return 'branch' satisfies PortalScopeType;
  }
  return null;
}

export function getScopeLabel(scopeType: PortalScopeType | null) {
  if (scopeType === 'platform') return 'Plataforma';
  if (scopeType === 'business') return 'Negocio';
  if (scopeType === 'branch') return 'Sucursal';
  return 'Sin capa';
}

export function getScopeDescription(scopeType: PortalScopeType | null) {
  if (scopeType === 'platform') return 'Control global de negocios, gobierno y configuracion.';
  if (scopeType === 'business') return 'Gestion integral del comercio y sus sucursales.';
  if (scopeType === 'branch') return 'Operacion del local actual con foco en el turno.';
  return 'Sin acceso administrativo asignado.';
}

export function getScopeModeLabel(scopeType: PortalScopeType | null) {
  if (scopeType === 'platform') return 'Gobierno global';
  if (scopeType === 'business') return 'Gestion de negocio';
  if (scopeType === 'branch') return 'Operacion de sucursal';
  return 'Sin modo';
}

export function getPortalActorLabel(params: {
  roleAssignments: PortalRoleAssignment[];
  profile: UserProfile | null;
  staffAssignment: MerchantStaff | null;
}) {
  const platformRole = params.roleAssignments.find((assignment) => PLATFORM_ROLE_CODES.has(normalizeCode(assignment.code)));
  if (platformRole) {
    return 'Admin de plataforma';
  }
  if (PLATFORM_ROLE_CODES.has(normalizeCode(params.profile?.default_role))) {
    return 'Admin de plataforma';
  }
  if (params.staffAssignment?.role) {
    return params.staffAssignment.role;
  }
  if (params.profile?.default_role) {
    return params.profile.default_role;
  }
  return 'sin rol';
}

export function resolvePortalPermissions(params: {
  currentScopeType: PortalScopeType | null;
  hasPlatformAccess: boolean;
  hasBusinessAccess: boolean;
  hasBranchAccess: boolean;
  roleAssignments: PortalRoleAssignment[];
  profile: UserProfile | null;
  staffAssignment: MerchantStaff | null;
}) {
  const isPlatform = params.currentScopeType === 'platform' && params.hasPlatformAccess;
  const isBusiness = params.currentScopeType === 'business' && params.hasBusinessAccess;
  const isBranch = params.currentScopeType === 'branch' && params.hasBranchAccess;
  const staffRoleCode = getStaffRoleCode(params.staffAssignment);
  const hasPlatformControl = hasPlatformRole(params.roleAssignments, params.profile);

  const basePermissions: PortalPermissions = {
    canManageOrders: false,
    canManageMenu: false,
    canManageBranch: false,
    canViewStaff: false,
    canViewCustomers: false,
    canManagePayments: false,
    canManagePromotions: false,
    canManageSettlements: false,
    canManageMessages: false,
    canManageSecurity: false,
    canManageSystem: false,
    canManageDrivers: false,
    canAccessPlatform: params.hasPlatformAccess,
    canAccessBusiness: params.hasBusinessAccess,
    canAccessBranch: params.hasBranchAccess,
  };

  if (isPlatform) {
    return {
      ...basePermissions,
      canManageOrders: hasPlatformControl,
      canManageMenu: hasPlatformControl,
      canManageBranch: hasPlatformControl,
      canViewStaff: hasPlatformControl,
      canViewCustomers: hasPlatformControl,
      canManagePayments: hasPlatformControl,
      canManagePromotions: hasPlatformControl,
      canManageSettlements: hasPlatformControl,
      canManageMessages: hasPlatformControl,
      canManageSecurity: hasPlatformControl,
      canManageSystem: hasPlatformControl,
      canManageDrivers: hasPlatformControl,
    };
  }

  if (isBusiness) {
    return {
      ...basePermissions,
      canManageOrders: true,
      canManageMenu: true,
      canManageBranch: true,
      canViewStaff: true,
      canViewCustomers: true,
      canManagePayments: true,
      canManagePromotions: true,
      canManageSettlements: true,
      canManageMessages: true,
    };
  }

  if (isBranch) {
    if (BUSINESS_ROLE_CODES.has(staffRoleCode)) {
      return {
        ...basePermissions,
        canManageOrders: true,
        canManageMenu: true,
        canManageBranch: true,
        canManageMessages: true,
      };
    }

    if (staffRoleCode === 'operator') {
      return {
        ...basePermissions,
        canManageOrders: true,
        canManageBranch: true,
        canManageMessages: true,
      };
    }

    if (staffRoleCode === 'kitchen') {
      return {
        ...basePermissions,
        canManageOrders: true,
        canManageMenu: true,
      };
    }

    return {
      ...basePermissions,
      canManageOrders: true,
      canManageMessages: true,
    };
  }

  return basePermissions;
}

export function canAccessAdminModule(moduleId: AdminModuleId, permissions: PortalPermissions) {
  switch (moduleId) {
    case 'overview':
      return true;
    case 'turn':
      return permissions.canAccessBranch;
    case 'businesses':
      return permissions.canAccessPlatform;
    case 'commerce':
      return permissions.canAccessBusiness;
    case 'branches':
      return permissions.canManageBranch;
    case 'people':
      return permissions.canViewStaff;
    case 'customers':
      return permissions.canViewCustomers;
    case 'catalog':
      return permissions.canManageMenu;
    case 'orders':
      return permissions.canManageOrders;
    case 'local_status':
      return permissions.canManageBranch;
    case 'operational_menu':
      return permissions.canManageMenu;
    case 'drivers':
      return permissions.canManageDrivers;
    case 'payments':
      return permissions.canManagePayments;
    // Nombres y montos de quien yapeo: solo plataforma.
    case 'yape':
      return permissions.canAccessPlatform;
    case 'promotions':
      return permissions.canManagePromotions;
    case 'settlements':
      return permissions.canManageSettlements;
    case 'messages':
      return permissions.canManageMessages;
    case 'security':
      return permissions.canManageSecurity;
    case 'platform_users':
      return permissions.canAccessPlatform;
    case 'system':
      return permissions.canManageSystem;
    default:
      return false;
  }
}
