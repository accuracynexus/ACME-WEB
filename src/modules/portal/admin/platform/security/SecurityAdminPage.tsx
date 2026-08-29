import { useContext, useEffect, useMemo, useState } from 'react';
import { AdminDataTable } from '../../../../../components/admin/AdminDataTable';
import { AdminDrawer } from '../../../../../components/admin/AdminDrawer';
import { CheckboxField, FieldGroup } from '../../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../../components/admin/AdminScaffold';
import { AdminTabPanel, AdminTabs } from '../../../../../components/admin/AdminTabs';
import { SectionSkeleton } from '../../../../../components/shared/Skeleton';
import { TextField } from '../../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../../core/auth/portalAccess';
import { hasDirtyState, serializeDirtyState } from '../../../../../core/admin/utils/dirtyState';
import { AppRoutes } from '../../../../../core/constants/routes';
import {
  adminSecurityService,
  SecurityAccessForm,
  SecurityAccessRecord,
  SecurityOverview,
  SecurityRoleForm,
  SecurityRoleRecord,
} from '../../../../../core/services/adminSecurityService';
import { PortalContext } from '../../../../auth/session/PortalContext';
import { IconPlus } from '../../../../../components/admin/AdminIcons';

type SecurityTab = 'access' | 'roles';

function getAccessLabel(record: SecurityAccessRecord) {
  return record.full_name || record.email || record.user_id;
}

export function SecurityAdminPage() {
  const portal = useContext(PortalContext);
  const [activeTab, setActiveTab] = useState<SecurityTab>('access');
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<SecurityAccessRecord | null>(null);
  const [accessForm, setAccessForm] = useState<SecurityAccessForm | null>(null);
  const [accessInitialState, setAccessInitialState] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<SecurityRoleForm>(adminSecurityService.createRoleForm());

  const loadData = async (targetUserId?: string) => {
    setLoading(true);
    setError(null);
    const result = await adminSecurityService.fetchSecurityOverview();
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    const nextOverview = result.data ?? null;
    setOverview(nextOverview);

    const nextSelected =
      (targetUserId ? nextOverview?.access_records.find((item) => item.user_id === targetUserId) : null) ||
      (selectedAccess ? nextOverview?.access_records.find((item) => item.user_id === selectedAccess.user_id) : null) ||
      null;

    if (nextSelected) {
      const nextForm = adminSecurityService.createAccessForm(nextSelected);
      setSelectedAccess(nextSelected);
      setAccessForm(nextForm);
      setAccessInitialState(serializeDirtyState(nextForm));
    } else {
      setSelectedAccess(null);
      setAccessForm(null);
      setAccessInitialState('');
    }
  };

  useEffect(() => {
    if (portal.currentScopeType === 'platform') {
      loadData();
    }
  }, [portal.currentScopeType]);

  const filteredAccessRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = overview?.access_records ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((record) =>
      [
        record.full_name,
        record.email,
        record.phone,
        record.default_role,
        record.role_labels.join(' '),
        record.layers.join(' '),
        record.merchant_labels.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [overview?.access_records, query]);

  const filteredRoles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = overview?.roles ?? [];
    if (!normalizedQuery) return rows;
    return rows.filter((record) => [record.code, record.name].join(' ').toLowerCase().includes(normalizedQuery));
  }, [overview?.roles, query]);

  const accessDirty = useMemo(() => (accessForm ? hasDirtyState(accessForm, accessInitialState) : false), [accessForm, accessInitialState]);

  const handleOpenAccess = (record: SecurityAccessRecord) => {
    const nextForm = adminSecurityService.createAccessForm(record);
    setSelectedAccess(record);
    setAccessForm(nextForm);
    setAccessInitialState(serializeDirtyState(nextForm));
    setDrawerOpen(true);
    setSuccessMessage(null);
  };

  const handleSaveAccess = async () => {
    if (!accessForm) return;
    setSaving(true);
    setError(null);
    const result = await adminSecurityService.saveAccess(accessForm);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Accesos actualizados');
    setDrawerOpen(false);
    await loadData(accessForm.user_id);
  };

  const openRoleModal = (role?: SecurityRoleRecord) => {
    setRoleForm(adminSecurityService.createRoleForm(role));
    setRoleModalOpen(true);
    setSuccessMessage(null);
  };

  const handleSaveRole = async () => {
    setSaving(true);
    setError(null);
    const result = await adminSecurityService.saveRole(roleForm);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRoleModalOpen(false);
    setSuccessMessage(roleForm.id ? 'Rol actualizado' : 'Rol creado');
    await loadData();
  };

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista pertenece a la capa plataforma.</div>;
  }

  return (
    <AdminPageFrame
      title="Seguridad"
      description="Centro institucional de roles, accesos y jerarquia de plataforma."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Seguridad' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'Roles y accesos', tone: 'warning' },
        { label: 'Modo', value: 'Gobierno', tone: 'warning' },
      ]}
    >
      <SectionCard title="Centro de Comando de Seguridad" description="Localiza usuarios por nombre, correo o rol para gestionar permisos y accesos institucionales.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por usuario, email, rol o capa..."
            className="input-field"
            style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
          />
        </div>
      </SectionCard>

      <FormStatusBar dirty={accessDirty} saving={saving} error={error} successMessage={successMessage} />

      <SectionCard title="Centro de seguridad" description="roles y user_roles dejan de quedar escondidos dentro de Personal y pasan a una consola de plataforma.">
        <AdminTabs
          tabs={[
            { id: 'access', label: 'Accesos', badge: String(overview?.access_records.length ?? 0) },
            { id: 'roles', label: 'Roles', badge: String(overview?.roles.length ?? 0) },
          ]}
          activeTabId={activeTab}
          onChange={(tabId) => setActiveTab(tabId as SecurityTab)}
        />

        {loading ? <SectionSkeleton lines={5} /> : null}

        {activeTab === 'access' && !loading ? (
          <AdminTabPanel>
            <AdminDataTable
              rows={filteredAccessRecords}
              getRowId={(record) => record.user_id}
              emptyMessage="No se encontraron usuarios con perfiles de acceso."
              columns={[
                {
                  id: 'user',
                  header: 'Identidad Digital',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ width: '40px', height: '40px', background: 'var(--acme-bg-soft)', color: 'var(--acme-purple)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{getAccessLabel(record)}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.email || 'Acceso sso-only'}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'layers',
                  header: 'Nivel / Capa',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {record.layers.length > 0 ? (
                        record.layers.map((layer) => (
                          <StatusPill key={layer} label={layer.toUpperCase()} tone="info" />
                        ))
                      ) : (
                        <StatusPill label="SIN ALCANCE" tone="warning" />
                      )}
                    </div>
                  ),
                },
                {
                  id: 'roles',
                  header: 'Asignaciones de Rol',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--acme-purple)' }}>{record.default_role || 'Invitado'}</span>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>
                        {record.role_labels.length > 0 ? record.role_labels.join(', ') : 'Sin roles adicionales'}
                      </span>
                    </div>
                  ),
                },
                {
                  id: 'scope',
                  header: 'Entidades Propias',
                  render: (record) => (
                    <span style={{ fontSize: '12px' }}>{record.merchant_labels.join(', ') || 'Todo el Ecosistema'}</span>
                  )
                },
                { 
                  id: 'status', 
                  header: 'Estado', 
                  render: (record) => (
                    <StatusPill label={record.is_active ? 'HABILITADO' : 'SUSPENDIDO'} tone={record.is_active ? 'success' : 'danger'} />
                  ) 
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '150px',
                  render: (record) => (
                    <button type="button" onClick={() => handleOpenAccess(record)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)', fontWeight: 700 }}>
                      Gestionar Permisos
                    </button>
                  ),
                },
              ]}
            />
          </AdminTabPanel>
        ) : null}

        {activeTab === 'roles' && !loading ? (
          <AdminTabPanel>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => openRoleModal()} className="btn btn--primary">
                <IconPlus />
            Nuevo rol
              </button>
            </div>
            <AdminDataTable
              rows={filteredRoles}
              getRowId={(record) => record.id}
              emptyMessage="No hay roles registrados."
              columns={[
                {
                  id: 'name',
                  header: 'Rol',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <strong>{record.name}</strong>
                      <span style={{ color: '#6b7280' }}>{record.code}</span>
                    </div>
                  ),
                },
                {
                  id: 'action',
                  header: 'Accion',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <button type="button" onClick={() => openRoleModal(record)} className="btn btn--ghost btn--sm">
                      Editar
                    </button>
                  ),
                },
              ]}
            />
          </AdminTabPanel>
        ) : null}
      </SectionCard>

      <AdminDrawer
        open={drawerOpen && !!accessForm}
        title={selectedAccess ? `Editar acceso: ${getAccessLabel(selectedAccess)}` : 'Editar acceso'}
        description="Aqui se gobiernan default_role y user_roles desde plataforma."
        onClose={() => setDrawerOpen(false)}
      >
        {accessForm ? (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div className="form-grid">
              <FieldGroup label="Identidad">
                <TextField value={accessForm.full_name || accessForm.email || accessForm.user_id} disabled />
              </FieldGroup>
              <FieldGroup label="Email Principal">
                <TextField value={accessForm.email} disabled />
              </FieldGroup>
            </div>

            <FieldGroup label="Rol Base de Sistema" hint="Rol principal que define el comportamiento del menú.">
              <TextField value={accessForm.default_role} onChange={(event) => setAccessForm((current) => (current ? { ...current, default_role: event.target.value } : current))} placeholder="Ej: admin_platform" />
            </FieldGroup>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="module-icon-box" style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--acme-purple-soft)', color: 'var(--acme-purple)' }}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <strong style={{ fontSize: '14px', color: 'var(--acme-title)' }}>Matriz de Roles de Plataforma</strong>
              </div>

              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                {(overview?.roles ?? []).map((role) => (
                  <div 
                    key={role.id} 
                    className="scope-card" 
                    style={{ padding: '12px 16px', cursor: 'pointer', borderColor: accessForm.role_ids.includes(role.id) ? 'var(--acme-purple)' : undefined }}
                    onClick={() => {
                      const isChecked = accessForm.role_ids.includes(role.id);
                      setAccessForm(current => current ? {
                        ...current,
                        role_ids: isChecked 
                          ? current.role_ids.filter(id => id !== role.id)
                          : [...current.role_ids, role.id]
                      } : null);
                    }}
                  >
                    <CheckboxField
                      label={role.name}
                      checked={accessForm.role_ids.includes(role.id)}
                      onChange={() => {}}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--acme-text-faint)', marginLeft: '28px' }}>{role.code}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="scope-card" style={{ padding: '16px', background: accessForm.is_active ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)', cursor: 'pointer' }} onClick={() => setAccessForm(c => c ? {...c, is_active: !c.is_active} : null)}>
              <CheckboxField
                label="Usuario con Acceso Habilitado"
                checked={accessForm.is_active}
                onChange={() => {}}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setDrawerOpen(false)} className="btn btn--secondary">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveAccess} disabled={saving || !accessDirty} className="btn btn--primary" style={{ paddingInline: '24px' }}>
                {saving ? 'Guardando...' : 'Aplicar Cambios'}
              </button>
            </div>
          </div>
        ) : null}
      </AdminDrawer>

      <AdminModalForm
        open={roleModalOpen}
        title={roleForm.id ? 'Configurar Rol Institucional' : 'Nuevo Rol de Plataforma'}
        description="Define los códigos de rol que el backend utilizará para validar políticas RLS y filtros de seguridad."
        onClose={() => setRoleModalOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setRoleModalOpen(false)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleSaveRole} disabled={saving || !roleForm.code || !roleForm.name} className="btn btn--primary">
              {saving ? 'Guardando...' : 'Guardar Definición'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="form-grid">
            <FieldGroup label="Código Técnico" hint="Ej: supervisor_reparto, analista_contable">
              <TextField value={roleForm.code} onChange={(event) => setRoleForm((current) => ({ ...current, code: event.target.value }))} placeholder="codigo_del_rol" />
            </FieldGroup>
            <FieldGroup label="Nombre Descriptivo" hint="Nombre visible en la matriz de seguridad">
              <TextField value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Analista de Operaciones" />
            </FieldGroup>
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
