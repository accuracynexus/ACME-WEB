import { useContext, useEffect, useMemo, useState } from 'react';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { PortalContext } from '../../../auth/session/PortalContext';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminService, CategoryAdminRecord } from '../../../../core/services/adminService';
import { hasDirtyState, serializeDirtyState } from '../../../../core/admin/utils/dirtyState';
import { CheckboxField, FieldGroup, NumberField } from '../../../../components/admin/AdminFields';
import { TextField } from '../../../../components/ui/TextField';
import { TableSkeleton } from '../../../../components/shared/Skeleton';

function createEmptyCategory(): CategoryAdminRecord {
  return {
    name: '',
    sort_order: '0',
    is_active: true,
  };
}

export function CategoriesAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.merchant?.id;
  const [categories, setCategories] = useState<CategoryAdminRecord[]>([]);
  const [selected, setSelected] = useState<CategoryAdminRecord>(createEmptyCategory());
  const [modalOpen, setModalOpen] = useState(false);
  const [initialState, setInitialState] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadCategories = async () => {
    if (!merchantId) return;
    setLoading(true);
    const result = await adminService.fetchCategories(merchantId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setCategories(result.data ?? []);
  };

  useEffect(() => {
    loadCategories();
  }, [merchantId]);

  const dirty = useMemo(() => hasDirtyState(selected, initialState), [selected, initialState]);

  const startNew = () => {
    const next = createEmptyCategory();
    setSelected(next);
    setInitialState(serializeDirtyState(next));
    setModalOpen(true);
    setSuccessMessage(null);
    setError(null);
  };

  const editCategory = (category: CategoryAdminRecord) => {
    setSelected(category);
    setInitialState(serializeDirtyState(category));
    setModalOpen(true);
    setSuccessMessage(null);
    setError(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(createEmptyCategory());
    setInitialState('');
  };

  const handleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    setError(null);
    const result = await adminService.saveCategory(merchantId, selected);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Guardado');
    await loadCategories();
    closeModal();
  };

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar categorias.</div>;
  }

  return (
    <AdminPageFrame
      title="Categorias"
      description="Lista reusable con edicion contextual. El `merchant_id` se completa automaticamente."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Catalogo' },
        { label: 'Categorias' },
      ]}
      contextItems={[
        { label: 'Rol', value: portal.staffAssignment?.role || 'sin rol', tone: 'info' },
        { label: 'Comercio', value: portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Categoria', tone: 'info' },
        { label: 'Modo', value: modalOpen ? (selected.id ? 'Edicion' : 'Creacion') : 'Consulta', tone: dirty ? 'warning' : 'info' },
        { label: 'Estado', value: dirty ? 'Cambios pendientes' : 'Sin cambios', tone: dirty ? 'warning' : 'success' },
      ]}
      actions={
        <button type="button" onClick={startNew} className="btn btn--primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva categoría
        </button>
      }
    >
      <SectionCard title="Categorias del comercio" description="La lista sirve como fuente unica de seleccion para el resto del catalogo.">
        {loading ? (
          <TableSkeleton />
        ) : (
          <AdminDataTable
            rows={categories}
            getRowId={(category) => category.id ?? category.name}
            emptyMessage="No hay categorías registradas para este comercio."
            columns={[
              {
                id: 'name',
                header: 'Nombre de categoría',
                render: (category) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div className="module-icon-box" style={{ width: '36px', height: '36px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <strong>{category.name}</strong>
                  </div>
                ),
              },
              {
                id: 'sort',
                header: 'Prioridad / Orden',
                render: (category) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600 }}>#{category.sort_order}</span>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>(Posición)</span>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Visibilidad',
                render: (category) => (
                  <StatusPill 
                    label={category.is_active ? 'VISIBLE' : 'OCULTO'} 
                    tone={category.is_active ? 'success' : 'neutral'} 
                  />
                ),
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '140px',
                render: (category) => (
                  <button type="button" onClick={() => editCategory(category)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                    Configurar
                  </button>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      <FormStatusBar dirty={dirty && modalOpen} saving={saving} error={error} successMessage={successMessage} />

      <AdminModalForm
        open={modalOpen}
        title={selected.id ? 'Editar categoria' : 'Nueva categoria'}
        description="Formulario corto y contextual para una entidad raiz simple del catalogo."
        onClose={closeModal}
        actions={
          <>
            <button type="button" onClick={closeModal} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="btn btn--primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {saving ? 'Guardando...' : 'Guardar categoría'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="form-grid">
            <FieldGroup label="Nombre de la categoría" hint="Ej: Platos de Fondo, Bebidas, Entradas.">
              <TextField 
                value={selected.name} 
                onChange={(event) => setSelected((current) => ({ ...current, name: event.target.value }))} 
                placeholder="Nombre descriptivo..."
              />
            </FieldGroup>
            <FieldGroup label="Orden de visualización" hint="Menor número aparece primero en el menú.">
              <NumberField 
                value={selected.sort_order} 
                onChange={(event) => setSelected((current) => ({ ...current, sort_order: event.target.value }))} 
              />
            </FieldGroup>
          </div>
          
          <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setSelected(c => ({...c, is_active: !c.is_active}))}>
            <CheckboxField
              label="Categoría activa y visible en el menú público"
              checked={selected.is_active}
              onChange={() => {}}
            />
          </div>
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
