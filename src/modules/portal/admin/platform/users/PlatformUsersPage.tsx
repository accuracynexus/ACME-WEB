import { type CSSProperties, useContext, useEffect, useMemo, useState } from 'react';
import { AdminDataTable } from '../../../../../components/admin/AdminDataTable';
import { AdminDrawer } from '../../../../../components/admin/AdminDrawer';
import { CheckboxField, FieldGroup, SelectField } from '../../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../../components/admin/AdminScaffold';
import { TableSkeleton } from '../../../../../components/shared/Skeleton';
import { TextField } from '../../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../../core/auth/portalAccess';
import { hasDirtyState, serializeDirtyState } from '../../../../../core/admin/utils/dirtyState';
import { AppRoutes } from '../../../../../core/constants/routes';
import {
  adminPlatformUsersService,
  PlatformMerchantOption,
  PlatformRoleOption,
  PlatformUserCreatePayload,
  PlatformUserRecord,
  PlatformUserUpdatePayload,
} from '../../../../../core/services/adminPlatformUsersService';
import { PortalContext } from '../../../../auth/session/PortalContext';

type AssignmentScope = 'merchant' | 'branches';

interface CreateFormState {
  email: string;
  fullName: string;
  phone: string;
  password: string;
  merchantId: string;
  assignmentScope: AssignmentScope;
  branchIds: string[];
  primaryBranchId: string;
  staffRole: string;
  roleIds: string[];
  isActive: boolean;
  mustChangePassword: boolean;
}

interface EditFormState {
  staffId: string;
  userId: string;
  fullName: string;
  phone: string;
  merchantId: string;
  assignmentScope: AssignmentScope;
  branchIds: string[];
  primaryBranchId: string;
  staffRole: string;
  roleIds: string[];
  isActive: boolean;
  password: string;
  mustChangePassword: boolean;
}

const MERCHANT_SCOPE_ROLE_VALUES = new Set(['owner', 'manager']);

function getInitialStaffRole(scope: AssignmentScope) {
  return scope === 'merchant' ? 'manager' : 'staff';
}

function adaptStaffRoleToScope(scope: AssignmentScope, currentRole: string) {
  const normalizedRole = currentRole.trim() || getInitialStaffRole(scope);
  if (scope === 'merchant' && !MERCHANT_SCOPE_ROLE_VALUES.has(normalizedRole)) {
    return 'manager';
  }
  return normalizedRole;
}

function createEmptyForm(): CreateFormState {
  return {
    email: '',
    fullName: '',
    phone: '',
    password: '',
    merchantId: '',
    assignmentScope: 'merchant',
    branchIds: [],
    primaryBranchId: '',
    staffRole: 'manager',
    roleIds: [],
    isActive: true,
    mustChangePassword: true,
  };
}

function createEditForm(record: PlatformUserRecord): EditFormState {
  const assignmentScope = record.assignment_scope || (record.branch_ids.length > 0 ? 'branches' : 'merchant');
  return {
    staffId: record.staff_id,
    userId: record.user_id,
    fullName: record.full_name,
    phone: record.phone,
    merchantId: record.merchant_id,
    assignmentScope,
    branchIds: assignmentScope === 'branches' ? record.branch_ids : [],
    primaryBranchId: assignmentScope === 'branches' ? record.primary_branch_id : '',
    staffRole: adaptStaffRoleToScope(assignmentScope, record.staff_role),
    roleIds: record.role_ids,
    isActive: record.is_active,
    password: '',
    mustChangePassword: true,
  };
}

function getUserLabel(record: PlatformUserRecord) {
  return record.full_name || record.email || record.user_id;
}

function formatLastLogin(value: string) {
  if (!value) return 'Sin ingreso';
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

function patchBranchSelection(current: string[], branchId: string, checked: boolean) {
  return checked
    ? Array.from(new Set([...current, branchId]))
    : current.filter((item) => item !== branchId);
}

function resolveMerchantBranches(merchants: PlatformMerchantOption[], merchantId: string) {
  return merchants.find((merchant) => merchant.id === merchantId)?.branches ?? [];
}

function reconcileBranchSelection(params: {
  branches: PlatformMerchantOption['branches'];
  branchIds: string[];
  primaryBranchId: string;
}) {
  const availableBranchIds = new Set(params.branches.map((branch) => branch.id));
  const normalizedBranchIds = Array.from(new Set(params.branchIds.filter((branchId) => availableBranchIds.has(branchId))));
  const branchIds = normalizedBranchIds.length > 0
    ? normalizedBranchIds
    : params.branches[0]
      ? [params.branches[0].id]
      : [];
  const primaryBranchId = branchIds.includes(params.primaryBranchId) ? params.primaryBranchId : branchIds[0] ?? '';
  return { branchIds, primaryBranchId };
}

function renderAssignmentScopeButtons(params: {
  value: AssignmentScope;
  onChange: (scope: AssignmentScope) => void;
}) {
  return (
    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
      <div 
        className={`scope-card ${params.value === 'merchant' ? 'scope-card--active' : ''}`}
        style={{ padding: '12px', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => params.onChange('merchant')}
      >
        <div style={{ fontWeight: 700, fontSize: '13px' }}>Todo el Negocio</div>
      </div>
      <div 
        className={`scope-card ${params.value === 'branches' ? 'scope-card--active' : ''}`}
        style={{ padding: '12px', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => params.onChange('branches')}
      >
        <div style={{ fontWeight: 700, fontSize: '13px' }}>Sedes Específicas</div>
      </div>
    </div>
  );
}

export function PlatformUsersPage() {
  const portal = useContext(PortalContext);
  const [records, setRecords] = useState<PlatformUserRecord[]>([]);
  const [roles, setRoles] = useState<PlatformRoleOption[]>([]);
  const [merchants, setMerchants] = useState<PlatformMerchantOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(createEmptyForm());
  const [createInitialState, setCreateInitialState] = useState(serializeDirtyState(createEmptyForm()));

  // Edit drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PlatformUserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editInitialState, setEditInitialState] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [usersResult, rolesResult, merchantsResult] = await Promise.all([
      adminPlatformUsersService.fetchPlatformUsers(),
      adminPlatformUsersService.fetchRoles(),
      adminPlatformUsersService.fetchMerchantsWithBranches(),
    ]);
    setLoading(false);

    const nextError = usersResult.error || rolesResult.error || merchantsResult.error;
    if (nextError) {
      setError(nextError.message);
      return;
    }

    setRecords(usersResult.data ?? []);
    setRoles(rolesResult.data ?? []);
    setMerchants(merchantsResult.data ?? []);
  };

  useEffect(() => {
    if (portal.currentScopeType === 'platform') {
      loadData();
    }
  }, [portal.currentScopeType]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [
        record.full_name,
        record.email,
        record.phone,
        record.merchant_label,
        record.staff_role,
        record.assignment_scope === 'merchant' ? 'negocio completo' : 'sucursales',
        record.branch_labels.join(' '),
        record.role_labels.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [records, query]);

  const createDirty = useMemo(() => hasDirtyState(createForm, createInitialState), [createForm, createInitialState]);
  const editDirty = useMemo(() => (editForm ? hasDirtyState(editForm, editInitialState) : false), [editForm, editInitialState]);

  // Role options for the <SelectField> of staff role — hardcoded operational roles
  const staffRoleOptions = useMemo(() => [
    { value: 'owner', label: 'Owner' },
    { value: 'manager', label: 'Manager' },
    { value: 'cashier', label: 'Caja' },
    { value: 'kitchen', label: 'Cocina' },
    { value: 'operator', label: 'Operador' },
    { value: 'support', label: 'Soporte' },
    { value: 'staff', label: 'Staff' },
  ], []);

  const createStaffRoleOptions = useMemo(
    () => staffRoleOptions.filter((option) => createForm.assignmentScope === 'branches' || MERCHANT_SCOPE_ROLE_VALUES.has(option.value)),
    [createForm.assignmentScope, staffRoleOptions]
  );

  const editStaffRoleOptions = useMemo(() => {
    if (!editForm) return staffRoleOptions;
    return staffRoleOptions.filter((option) => editForm.assignmentScope === 'branches' || MERCHANT_SCOPE_ROLE_VALUES.has(option.value));
  }, [editForm, staffRoleOptions]);

  // Merchant options for the <SelectField>
  const merchantOptions = useMemo(() => {
    return [
      { value: '', label: 'Selecciona un negocio' },
      ...merchants.map((merchant) => ({ value: merchant.id, label: merchant.label })),
    ];
  }, [merchants]);

  // Branches for selected merchant in create form
  const createBranches = useMemo(() => {
    const merchant = merchants.find((m) => m.id === createForm.merchantId);
    return merchant?.branches ?? [];
  }, [merchants, createForm.merchantId]);

  // Branches for selected merchant in edit form
  const editBranches = useMemo(() => {
    if (!editForm) return [];
    const merchant = merchants.find((m) => m.id === editForm.merchantId);
    return merchant?.branches ?? [];
  }, [merchants, editForm?.merchantId]);

  // Primary branch options for create form
  const createPrimaryBranchOptions = useMemo(() => [
    { value: '', label: 'Sin principal' },
    ...createBranches
      .filter((branch) => createForm.branchIds.includes(branch.id))
      .map((branch) => ({ value: branch.id, label: branch.name })),
  ], [createBranches, createForm.branchIds]);

  // Primary branch options for edit form
  const editPrimaryBranchOptions = useMemo(() => {
    if (!editForm) return [{ value: '', label: 'Sin principal' }];
    return [
      { value: '', label: 'Sin principal' },
      ...editBranches
        .filter((branch) => editForm.branchIds.includes(branch.id))
        .map((branch) => ({ value: branch.id, label: branch.name })),
    ];
  }, [editBranches, editForm?.branchIds]);

  // --- Actions ---

  const openCreateModal = () => {
    const nextForm = createEmptyForm();
    setCreateForm(nextForm);
    setCreateInitialState(serializeDirtyState(nextForm));
    setCreateModalOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateForm(createEmptyForm());
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.merchantId) return;
    setSaving(true);
    setError(null);

    const payload: PlatformUserCreatePayload = {
      email: createForm.email,
      fullName: createForm.fullName,
      phone: createForm.phone,
      password: createForm.password,
      merchantId: createForm.merchantId,
      assignmentScope: createForm.assignmentScope,
      branchIds: createForm.assignmentScope === 'branches' ? createForm.branchIds : [],
      primaryBranchId: createForm.assignmentScope === 'branches' ? createForm.primaryBranchId : '',
      staffRole: createForm.staffRole,
      roleIds: createForm.roleIds,
      isActive: createForm.isActive,
      mustChangePassword: createForm.mustChangePassword,
    };

    const result = await adminPlatformUsersService.createPlatformUser(payload);
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccessMessage('Usuario creado exitosamente');
    setCreateModalOpen(false);
    await loadData();
  };

  const openEditDrawer = (record: PlatformUserRecord) => {
    const nextForm = createEditForm(record);
    setSelectedRecord(record);
    setEditForm(nextForm);
    setEditInitialState(serializeDirtyState(nextForm));
    setDrawerOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    setError(null);

    const payload: PlatformUserUpdatePayload = {
      staffId: editForm.staffId,
      userId: editForm.userId,
      fullName: editForm.fullName,
      phone: editForm.phone,
      merchantId: editForm.merchantId,
      assignmentScope: editForm.assignmentScope,
      branchIds: editForm.assignmentScope === 'branches' ? editForm.branchIds : [],
      primaryBranchId: editForm.assignmentScope === 'branches' ? editForm.primaryBranchId : '',
      staffRole: editForm.staffRole,
      roleIds: editForm.roleIds,
      isActive: editForm.isActive,
      password: editForm.password,
      mustChangePassword: editForm.password.trim() ? editForm.mustChangePassword : undefined,
    };

    const result = await adminPlatformUsersService.updatePlatformUser(payload);
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccessMessage(editForm.password.trim() ? 'Usuario actualizado y contraseña temporal reiniciada' : 'Usuario actualizado');
    setDrawerOpen(false);
    await loadData();
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm('¿Desvincular al usuario de este negocio? Esto eliminara su asignacion de personal y sucursales.')) return;
    setSaving(true);
    setError(null);
    const result = await adminPlatformUsersService.deletePlatformUser(staffId);
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccessMessage('Usuario desvinculado');
    setDrawerOpen(false);
    setSelectedRecord(null);
    setEditForm(null);
    await loadData();
  };

  // Handle merchant change in create form — reset branches
  const handleCreateMerchantChange = (merchantId: string) => {
    setCreateForm((current) => {
      if (current.assignmentScope !== 'branches') {
        return {
          ...current,
          merchantId,
          branchIds: [],
          primaryBranchId: '',
        };
      }

      const nextBranches = resolveMerchantBranches(merchants, merchantId);
      const nextSelection = reconcileBranchSelection({
        branches: nextBranches,
        branchIds: [],
        primaryBranchId: '',
      });

      return {
        ...current,
        merchantId,
        branchIds: nextSelection.branchIds,
        primaryBranchId: nextSelection.primaryBranchId,
      };
    });
  };

  const handleCreateScopeChange = (assignmentScope: AssignmentScope) => {
    setCreateForm((current) => {
      if (assignmentScope === 'merchant') {
        return {
          ...current,
          assignmentScope,
          branchIds: [],
          primaryBranchId: '',
          staffRole: adaptStaffRoleToScope(assignmentScope, current.staffRole),
        };
      }

      const nextBranches = resolveMerchantBranches(merchants, current.merchantId);
      const nextSelection = reconcileBranchSelection({
        branches: nextBranches,
        branchIds: current.branchIds,
        primaryBranchId: current.primaryBranchId,
      });

      return {
        ...current,
        assignmentScope,
        branchIds: nextSelection.branchIds,
        primaryBranchId: nextSelection.primaryBranchId,
        staffRole: adaptStaffRoleToScope(assignmentScope, current.staffRole),
      };
    });
  };

  const handleEditMerchantChange = (merchantId: string) => {
    setEditForm((current) => (
      current
        ? {
            ...current,
            merchantId,
            ...(current.assignmentScope === 'branches'
              ? reconcileBranchSelection({
                  branches: resolveMerchantBranches(merchants, merchantId),
                  branchIds: [],
                  primaryBranchId: '',
                })
              : {
                  branchIds: [],
                  primaryBranchId: '',
                }),
          }
        : current
    ));
  };

  const handleEditScopeChange = (assignmentScope: AssignmentScope) => {
    setEditForm((current) => (
      current
        ? {
            ...current,
            assignmentScope,
            ...(assignmentScope === 'merchant'
              ? {
                  branchIds: [],
                  primaryBranchId: '',
                }
              : reconcileBranchSelection({
                  branches: resolveMerchantBranches(merchants, current.merchantId),
                  branchIds: current.branchIds,
                  primaryBranchId: current.primaryBranchId,
                })),
            staffRole: adaptStaffRoleToScope(assignmentScope, current.staffRole),
          }
        : current
    ));
  };

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista pertenece a la capa plataforma.</div>;
  }

  return (
    <AdminPageFrame
      title="Usuarios"
      description="Gestion centralizada de usuarios asignados al negocio completo o a sucursales puntuales desde la capa de plataforma."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Usuarios' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'Usuarios de plataforma', tone: 'warning' },
        { label: 'Total', value: String(records.length), tone: 'info' },
      ]}
      actions={
        <button
          type="button"
          onClick={openCreateModal}
          className="btn btn--primary"
        >
          <PlusIcon /> Agregar usuario
        </button>
      }
    >
      <SectionCard title="Directorio Maestro de Usuarios" description="Administra el personal de todos los comercios, sus alcances de sucursal y roles técnicos de plataforma.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, email, comercio, sucursal o rol..."
            className="input-field"
            style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
          />
        </div>
      </SectionCard>

      <FormStatusBar dirty={editDirty || createDirty} saving={saving} error={error} successMessage={successMessage} />

      <SectionCard title="Usuarios asignados" description="Cada usuario puede quedar asignado al negocio completo o a sucursales especificas, con contraseña temporal y recuperacion por correo.">
        {loading ? (
          <TableSkeleton />
        ) : (
          <AdminDataTable
            rows={filteredRecords}
            getRowId={(record) => record.staff_id}
            emptyMessage="No se encontraron usuarios asignados."
            columns={[
              {
                id: 'user',
                header: 'Colaborador',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="module-icon-box" style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: 'var(--acme-bg-soft)', 
                      color: 'var(--acme-purple)',
                      fontWeight: 800,
                      fontSize: '12px' 
                    }}>
                      {(record.full_name || record.email || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{getUserLabel(record)}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.email}</span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'merchant',
                header: 'Entidad y Alcance',
                render: (record) => (
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--acme-text-muted)' }}>{record.merchant_label}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <StatusPill 
                        label={record.assignment_scope === 'merchant' ? 'NEGOCIO' : 'SEDES'} 
                        tone={record.assignment_scope === 'merchant' ? 'info' : 'neutral'} 
                      />
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                        {record.assignment_scope === 'merchant' ? 'Acceso Maestro' : record.branch_labels.join(', ')}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'role',
                header: 'Rol Op.',
                render: (record) => (
                  <StatusPill label={(record.staff_role || 'STAFF').toUpperCase()} tone="info" />
                ),
              },
              {
                id: 'platform_roles',
                header: 'Permisos Sistema',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '180px' }}>
                    {record.role_labels.length > 0
                      ? record.role_labels.map((label) => <StatusPill key={label} label={label.toUpperCase()} tone="neutral" />)
                      : <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px', fontStyle: 'italic' }}>Sin roles de sistema</span>}
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Estado',
                render: (record) => (
                   <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <StatusPill label={record.is_active ? 'ACTIVO' : 'INACTIVO'} tone={record.is_active ? 'success' : 'danger'} />
                      {record.must_change_password && <div title="Cambio de clave pendiente" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--acme-orange)' }} />}
                   </div>
                ),
              },
              {
                id: 'last_login',
                header: 'Último Acceso',
                render: (record) => <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{formatLastLogin(record.last_login_at)}</span>,
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '140px',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      type="button" 
                      onClick={() => openEditDrawer(record)} 
                      className="btn btn--ghost btn--sm" 
                      style={{ color: 'var(--acme-purple)', padding: '6px' }}
                      title="Editar usuario"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleDelete(record.staff_id)} 
                      className="btn btn--ghost btn--sm" 
                      style={{ color: 'var(--acme-red)', padding: '6px' }}
                      title="Quitar acceso"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      {/* --- Create Modal --- */}
      <AdminModalForm
        open={createModalOpen}
        title="Alta de Usuario Institucional"
        description="Crea una cuenta para personal operativo. Podrás definir su alcance desde el negocio maestro hasta sedes puntuales."
        onClose={closeCreateModal}
        actions={
          <>
            <button type="button" onClick={closeCreateModal} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!createForm.email || !createForm.password || !createForm.merchantId || saving}
              className="btn btn--primary"
            >
              {saving ? 'Creando...' : 'Finalizar Alta'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="form-grid">
            <FieldGroup label="Correo de Acceso" hint="Será su identificador único.">
              <TextField
                value={createForm.email}
                onChange={(event) => setCreateForm((c) => ({ ...c, email: event.target.value }))}
                placeholder="usuario@acme.pe"
              />
            </FieldGroup>
            <FieldGroup label="Nombre Operativo">
              <TextField
                value={createForm.fullName}
                onChange={(event) => setCreateForm((c) => ({ ...c, fullName: event.target.value }))}
                placeholder="Nombre y Apellidos"
              />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Teléfono">
              <TextField
                value={createForm.phone}
                onChange={(event) => setCreateForm((c) => ({ ...c, phone: event.target.value }))}
                placeholder="+51 ..."
              />
            </FieldGroup>
            <FieldGroup label="Clave Temporal" hint="Mínimo 8 caracteres institucionales.">
              <TextField
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((c) => ({ ...c, password: event.target.value }))}
                placeholder="••••••••"
              />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Negocio Asignado">
              <SelectField
                value={createForm.merchantId}
                onChange={(event) => handleCreateMerchantChange(event.target.value)}
                options={merchantOptions}
              />
            </FieldGroup>
            <FieldGroup label="Rol Operativo Interno">
              <SelectField
                value={createForm.staffRole}
                onChange={(event) => setCreateForm((c) => ({ ...c, staffRole: event.target.value }))}
                options={createStaffRoleOptions}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Alcance de Responsabilidad" hint="Define si el usuario ve todo el negocio o solo sedes específicas.">
            {renderAssignmentScopeButtons({
              value: createForm.assignmentScope,
              onChange: handleCreateScopeChange,
            })}
          </FieldGroup>

          {createForm.assignmentScope === 'branches' && (
            <div style={{ padding: '20px', background: 'var(--acme-bg-soft)', borderRadius: '14px', border: '1px solid var(--acme-bg-soft)' }}>
               <FieldGroup label="Sucursal Principal de Reporte" style={{ marginBottom: '16px' }}>
                <SelectField
                  value={createForm.primaryBranchId}
                  onChange={(event) => setCreateForm((c) => ({ ...c, primaryBranchId: event.target.value }))}
                  options={createPrimaryBranchOptions}
                />
              </FieldGroup>
              
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>Todas las sedes autorizadas:</strong>
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                {createBranches.map((branch) => (
                  <div 
                    key={branch.id} 
                    className="scope-card" 
                    style={{ padding: '10px 14px', cursor: 'pointer', borderColor: createForm.branchIds.includes(branch.id) ? 'var(--acme-purple)' : undefined }}
                    onClick={() => {
                      const isChecked = createForm.branchIds.includes(branch.id);
                      const nextIds = patchBranchSelection(createForm.branchIds, branch.id, !isChecked);
                      setCreateForm(c => ({
                        ...c,
                        branchIds: nextIds,
                        primaryBranchId: nextIds.includes(c.primaryBranchId) ? c.primaryBranchId : nextIds[0] ?? ''
                      }));
                    }}
                  >
                    <CheckboxField label={branch.name} checked={createForm.branchIds.includes(branch.id)} onChange={() => {}} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: '12px' }}>
            <div className="scope-card" style={{ padding: '16px', background: createForm.isActive ? 'rgba(34, 197, 94, 0.05)' : undefined, cursor: 'pointer' }} onClick={() => setCreateForm(c => ({...c, isActive: !c.isActive}))}>
              <CheckboxField label="Usuario Habilitado para Ingresar" checked={createForm.isActive} onChange={() => {}} />
            </div>
            <div className="scope-card" style={{ padding: '16px', background: createForm.mustChangePassword ? 'rgba(234, 179, 8, 0.05)' : undefined, cursor: 'pointer' }} onClick={() => setCreateForm(c => ({...c, mustChangePassword: !c.mustChangePassword}))}>
              <CheckboxField label="Forzar Cambio de Clave en Primer Login" checked={createForm.mustChangePassword} onChange={() => {}} />
            </div>
          </div>
        </div>
      </AdminModalForm>

      {/* --- Edit Drawer --- */}
      <AdminDrawer
        open={drawerOpen && !!editForm}
        title={selectedRecord ? `Editar: ${getUserLabel(selectedRecord)}` : 'Editar usuario'}
        description="Modifica negocio, alcance, sucursales, roles y reinicia una contraseña temporal si hace falta."
        onClose={() => setDrawerOpen(false)}
      >
        {editForm ? (
          <>
            <FieldGroup label="Correo">
              <TextField value={selectedRecord?.email ?? ''} readOnly />
            </FieldGroup>
            <FieldGroup label="Nombre completo">
              <TextField
                value={editForm.fullName}
                onChange={(event) => setEditForm((c) => (c ? { ...c, fullName: event.target.value } : c))}
              />
            </FieldGroup>
            <FieldGroup label="Telefono">
              <TextField
                value={editForm.phone}
                onChange={(event) => setEditForm((c) => (c ? { ...c, phone: event.target.value } : c))}
              />
            </FieldGroup>
            <FieldGroup label="Negocio">
              <SelectField
                value={editForm.merchantId}
                onChange={(event) => handleEditMerchantChange(event.target.value)}
                options={merchantOptions}
              />
            </FieldGroup>
            <FieldGroup label="Alcance de trabajo">
              {renderAssignmentScopeButtons({
                value: editForm.assignmentScope,
                onChange: handleEditScopeChange,
              })}
            </FieldGroup>
            <FieldGroup label="Rol operativo">
              <SelectField
                value={editForm.staffRole}
                onChange={(event) => setEditForm((c) => (c ? { ...c, staffRole: event.target.value } : c))}
                options={editStaffRoleOptions}
              />
            </FieldGroup>
            {editForm.assignmentScope === 'branches' ? (
              <>
                <FieldGroup label="Sucursal principal">
                  <SelectField
                    value={editForm.primaryBranchId}
                    onChange={(event) => setEditForm((c) => (c ? { ...c, primaryBranchId: event.target.value } : c))}
                    options={editPrimaryBranchOptions}
                  />
                </FieldGroup>

                {editBranches.length > 0 ? (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <strong style={{ fontSize: '13px' }}>Sucursales asignadas</strong>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {editBranches.map((branch) => (
                        <CheckboxField
                          key={branch.id}
                          label={branch.name}
                          checked={editForm.branchIds.includes(branch.id)}
                          onChange={(event) =>
                            setEditForm((c) =>
                              c
                                ? {
                                    ...c,
                                    branchIds: patchBranchSelection(c.branchIds, branch.id, event.target.checked),
                                    primaryBranchId: (() => {
                                      const nextBranchIds = patchBranchSelection(c.branchIds, branch.id, event.target.checked);
                                      return nextBranchIds.includes(c.primaryBranchId) ? c.primaryBranchId : nextBranchIds[0] ?? '';
                                    })(),
                                  }
                                : c
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>Este negocio no tiene sucursales registradas.</div>
                )}
              </>
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', color: '#4b5563', fontSize: '13px' }}>
                El usuario quedara amarrado al negocio completo, sin limitarse a sucursales puntuales.
              </div>
            )}

            <div style={{ display: 'grid', gap: '10px' }}>
              <strong style={{ fontSize: '13px' }}>Permisos globales de plataforma (Opcional)</strong>
              <div style={{ display: 'grid', gap: '8px' }}>
                {roles
                  .filter((r) => ['admin', 'super_admin'].includes(r.code))
                  .map((role) => (
                    <CheckboxField
                      key={role.id}
                      label={`${role.name} (${role.code})`}
                      checked={editForm.roleIds.includes(role.id)}
                      onChange={(event) =>
                        setEditForm((c) =>
                          c
                            ? {
                                ...c,
                                roleIds: event.target.checked
                                  ? Array.from(new Set([...c.roleIds, role.id]))
                                  : c.roleIds.filter((id) => id !== role.id),
                              }
                            : c
                        )
                      }
                    />
                ))}
              </div>
            </div>

            <SectionCard title="Acceso y contraseña" description="Puedes dejar la contraseña actual intacta o definir una nueva temporal para el usuario.">
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <StatusPill label={selectedRecord?.must_change_password ? 'Cambio pendiente' : 'Sin cambio forzado'} tone={selectedRecord?.must_change_password ? 'warning' : 'neutral'} />
                  <StatusPill label="Recuperable por correo" tone="info" />
                </div>
                <FieldGroup label="Nueva contraseña temporal" hint="Solo completa este campo si quieres resetear la contraseña actual.">
                  <TextField
                    type="password"
                    value={editForm.password}
                    onChange={(event) => setEditForm((c) => (c ? { ...c, password: event.target.value } : c))}
                    placeholder="Minimo 8 caracteres"
                  />
                </FieldGroup>
                <CheckboxField
                  label="Exigir cambio en el siguiente ingreso"
                  checked={editForm.mustChangePassword}
                  onChange={(event) => setEditForm((c) => (c ? { ...c, mustChangePassword: event.target.checked } : c))}
                  disabled={!editForm.password.trim()}
                />
                <div style={{ color: '#6b7280', fontSize: '13px' }}>
                  Si el usuario olvida su acceso, tambien podra usar la opcion de recuperacion desde la pantalla de login con su correo.
                </div>
              </div>
            </SectionCard>

            <CheckboxField
              label="Usuario activo"
              checked={editForm.isActive}
              onChange={(event) => setEditForm((c) => (c ? { ...c, isActive: event.target.checked } : c))}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <button type="button" onClick={() => setDrawerOpen(false)} className="btn btn--secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editDirty || saving}
                className="btn btn--primary"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </>
        ) : null}
      </AdminDrawer>
    </AdminPageFrame>
  );
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
