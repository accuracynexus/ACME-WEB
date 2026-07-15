import { useContext, useEffect, useMemo, useState } from 'react';
import { AdminPageFrame, FormStatusBar, SaveActions, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { CheckboxField, FieldGroup, NumberField } from '../../../../components/admin/AdminFields';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { TableSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { AppRoutes } from '../../../../core/constants/routes';
import { hasDirtyState, serializeDirtyState } from '../../../../core/admin/utils/dirtyState';
import { adminService, ModifierGroupAdminRecord, ModifierOptionAdminRecord } from '../../../../core/services/adminService';
import { PortalContext } from '../../../auth/session/PortalContext';

function createEmptyOption(): ModifierOptionAdminRecord {
  return {
    name: '',
    price_delta: '0',
    sort_order: '0',
    is_active: true,
  };
}

function createEmptyGroup(): ModifierGroupAdminRecord {
  return {
    name: '',
    min_select: '0',
    max_select: '1',
    is_required: false,
    is_active: true,
    options: [],
  };
}

export function ModifiersAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.merchant?.id;
  const [activeTab, setActiveTab] = useState('group');
  const [groups, setGroups] = useState<ModifierGroupAdminRecord[]>([]);
  const [selected, setSelected] = useState<ModifierGroupAdminRecord>(createEmptyGroup());
  const [initialState, setInitialState] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadGroups = async () => {
    if (!merchantId) return;
    setLoading(true);
    const result = await adminService.fetchModifierGroups(merchantId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setGroups(result.data ?? []);
  };

  useEffect(() => {
    loadGroups();
  }, [merchantId]);

  const dirty = useMemo(() => hasDirtyState(selected, initialState), [selected, initialState]);

  const startNew = () => {
    const next = createEmptyGroup();
    setSelected(next);
    setInitialState(serializeDirtyState(next));
    setSuccessMessage(null);
    setError(null);
    setActiveTab('group');
  };

  const editGroup = (group: ModifierGroupAdminRecord) => {
    setSelected(group);
    setInitialState(serializeDirtyState(group));
    setSuccessMessage(null);
    setError(null);
    setActiveTab('group');
  };

  const addOption = () => {
    setSelected((current) => ({
      ...current,
      options: [...current.options, createEmptyOption()],
    }));
    setSuccessMessage(null);
    setActiveTab('options');
  };

  const updateOption = (index: number, patch: Partial<ModifierOptionAdminRecord>) => {
    setSelected((current) => ({
      ...current,
      options: current.options.map((option, currentIndex) => (currentIndex === index ? { ...option, ...patch } : option)),
    }));
    setSuccessMessage(null);
  };

  const removeOption = (index: number) => {
    setSelected((current) => ({
      ...current,
      options: current.options.filter((_, currentIndex) => currentIndex !== index),
    }));
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    setError(null);
    const result = await adminService.saveModifierGroup(merchantId, selected);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Guardado');
    await loadGroups();
    startNew();
  };

  const handleDelete = async () => {
    if (!selected.id) return;
    setSaving(true);
    setError(null);
    const result = await adminService.deleteModifierGroup(selected.id);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Grupo eliminado');
    await loadGroups();
    startNew();
  };

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar modificadores.</div>;
  }

  return (
    <AdminPageFrame
      title="Modificadores"
      description="Administra grupos y opciones reutilizables para productos del comercio."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Catalogo' },
        { label: 'Modificadores' },
      ]}
      contextItems={[
        { label: 'Rol', value: portal.staffAssignment?.role || 'sin rol', tone: 'info' },
        { label: 'Comercio', value: portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Modificadores', tone: 'info' },
        { label: 'Modo', value: selected.id ? 'Edicion' : 'Creacion', tone: dirty ? 'warning' : 'info' },
        { label: 'Estado', value: dirty ? 'Cambios pendientes' : 'Sin cambios', tone: dirty ? 'warning' : 'success' },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {selected.id ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="btn btn--secondary"
              style={{ color: 'var(--acme-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Eliminar grupo
            </button>
          ) : null}
          <SaveActions onSave={handleSave} onCancel={startNew} disabled={!dirty || loading} isSaving={saving} />
        </div>
      }
    >
      <SectionCard title="Grupos del comercio" description="Cada grupo representa una familia de extras, tamanos o toppings.">
        {loading ? (
          <TableSkeleton />
        ) : (
          <AdminDataTable
            rows={groups}
            getRowId={(group) => group.id ?? group.name}
            emptyMessage="No hay grupos de modificadores registrados."
            columns={[
              {
                id: 'name',
                header: 'Grupo de modificación',
                render: (group) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div className="module-icon-box" style={{ width: '40px', height: '40px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </div>
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{group.name}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>
                        {group.is_required ? 'Requerido' : 'Opcional'} · Selecciona entre {group.min_select} y {group.max_select}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'options',
                header: 'Opciones',
                render: (group) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600 }}>{group.options.length}</span>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>items</span>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Estado',
                render: (group) => <StatusPill label={group.is_active ? 'HABILITADO' : 'OCULTO'} tone={group.is_active ? 'success' : 'neutral'} />,
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '140px',
                render: (group) => (
                  <button type="button" onClick={() => editGroup(group)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                    Editar detalles
                  </button>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      <AdminTabs
        tabs={[
          { id: 'group', label: 'Grupo' },
          { id: 'options', label: 'Opciones', badge: String(selected.options.length) },
        ]}
        activeTabId={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'group' ? (
        <AdminTabPanel>
          <SectionCard title={selected.id ? 'Reglas del grupo' : 'Nuevo grupo maestro'} description="Define el comportamiento del grupo y cómo interactúa el cliente con las opciones.">
            <div className="form-grid">
              <FieldGroup label="Nombre identificador" hint="Ej: Extras de pizza, Tamaño de bebida.">
                <TextField value={selected.name} onChange={(event) => setSelected((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre del grupo..." />
              </FieldGroup>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FieldGroup label="Mínimo selección" hint="0 = Opcional">
                  <NumberField
                    value={selected.min_select}
                    onChange={(event) => setSelected((current) => ({ ...current, min_select: event.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="Máximo selección" hint="Límite permitido">
                  <NumberField
                    value={selected.max_select}
                    onChange={(event) => setSelected((current) => ({ ...current, max_select: event.target.value }))}
                  />
                </FieldGroup>
              </div>
            </div>
            
            <div className="form-grid" style={{ marginTop: '20px' }}>
              <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setSelected(c => ({...c, is_required: !c.is_required}))}>
                <CheckboxField
                  label="Marcar como grupo obligatorio para el cliente"
                  checked={selected.is_required}
                  onChange={() => {}}
                />
              </div>
              <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setSelected(c => ({...c, is_active: !c.is_active}))}>
                <CheckboxField
                  label="Grupo visible y disponible en el catálogo"
                  checked={selected.is_active}
                  onChange={() => {}}
                />
              </div>
            </div>
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'options' ? (
        <AdminTabPanel>
          <SectionCard title="Opciones disponibles" description="Carga los diferentes ítems que pertenecen a este grupo con sus precios adicionales.">
            {selected.options.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', background: 'var(--acme-bg-soft)', borderRadius: '16px', border: '2px dashed var(--acme-border)', color: 'var(--acme-text-muted)' }}>
                No hay opciones registradas. El grupo debe tener al menos una opción para ser funcional.
              </div>
            ) : null}
            
            <div style={{ display: 'grid', gap: '16px', marginTop: selected.options.length > 0 ? '12px' : '0' }}>
              {selected.options.map((option, index) => (
                <div key={option.id ?? `option-${index}`} className="scope-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px auto', gap: '20px', alignItems: 'start' }}>
                    <FieldGroup label="Nombre de la opción">
                      <TextField value={option.name} onChange={(event) => updateOption(index, { name: event.target.value })} placeholder="Ej: Extra queso, Familiar, etc." />
                    </FieldGroup>
                    <FieldGroup label="Costo extra">
                      <NumberField value={option.price_delta} onChange={(event) => updateOption(index, { price_delta: event.target.value })} />
                    </FieldGroup>
                    <FieldGroup label="Orden">
                      <NumberField value={option.sort_order} onChange={(event) => updateOption(index, { sort_order: event.target.value })} />
                    </FieldGroup>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'center' }}>
                      <CheckboxField
                        label="Activa"
                        checked={option.is_active}
                        onChange={(event) => updateOption(index, { is_active: event.target.checked })}
                      />
                      <button type="button" onClick={() => removeOption(index)} className="btn btn--ghost btn--sm" style={{ color: 'var(--acme-red)', padding: '4px', textDecoration: 'underline' }}>
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '24px' }}>
              <button type="button" onClick={addOption} className="btn btn--secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar nueva opción
              </button>
            </div>
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      <FormStatusBar dirty={dirty} saving={saving} error={error} successMessage={successMessage} />
    </AdminPageFrame>
  );
}
