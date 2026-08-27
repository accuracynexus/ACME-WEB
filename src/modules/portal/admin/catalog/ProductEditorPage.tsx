import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminPageFrame, FormStatusBar, SaveActions, SectionCard } from '../../../../components/admin/AdminScaffold';
import { CheckboxField, FieldGroup, NumberField, RelationSelect, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { ImageUploadField } from '../../../../components/shared/ImageUploadField';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { TextField } from '../../../../components/ui/TextField';
import { AppRoutes } from '../../../../core/constants/routes';
import { hasDirtyState, serializeDirtyState } from '../../../../core/admin/utils/dirtyState';
import { adminService, buildProductSku, ModifierGroupAdminRecord, ProductAdminForm } from '../../../../core/services/adminService';
import { PortalContext } from '../../../auth/session/PortalContext';

export function ProductEditorPage() {
  const portal = useContext(PortalContext);
  const navigate = useNavigate();
  const params = useParams();
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const productId = params.productId;
  const isNew = !productId;
  const [activeTab, setActiveTab] = useState('base');
  // portal.branches es un array nuevo cada vez que se recarga el contexto, y
  // eso pasa solo: onAuthStateChange dispara loadPortalContext ante cualquier
  // evento, incluido el refresco periodico del token y el foco de pestana.
  // Si el efecto depende de la identidad del array, se vuelve a montar el
  // formulario y se pierde lo que se este escribiendo. La clave por contenido
  // hace que branchOptions solo cambie cuando las sucursales cambian de verdad.
  const branchKey = portal.branches.map((branch) => `${branch.id}:${branch.name}`).join('|');
  const branchOptions = useMemo(
    () => portal.branches.map((branch) => ({ id: branch.id, name: branch.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchKey]
  );
  // Segunda defensa: el formulario se monta una sola vez por producto.
  const loadedKeyRef = useRef<string | null>(null);
  // Mientras nadie toque el SKU a mano, se deriva del nombre. Al editarlo
  // se respeta lo escrito y deja de regenerarse.
  const skuTouchedRef = useRef(false);
  // Sufijo fijo por sesion de edicion: si se regenerara en cada tecla, el SKU
  // parpadearia mientras se escribe el nombre.
  const skuSuffixRef = useRef(Math.random().toString(36).slice(2, 6).toUpperCase());
  const [form, setForm] = useState<ProductAdminForm | null>(null);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupAdminRecord[]>([]);
  const [initialState, setInitialState] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!merchantId) return;
      setLoading(true);
      setError(null);

      const [categoryResult, modifierResult] = await Promise.all([
        adminService.fetchCategories(merchantId),
        adminService.fetchModifierGroups(merchantId),
      ]);

      if (categoryResult.error) {
        setLoading(false);
        setError(categoryResult.error.message);
        return;
      }

      if (modifierResult.error) {
        setLoading(false);
        setError(modifierResult.error.message);
        return;
      }

      setCategories([
        { value: '', label: 'Sin categoria' },
        ...((categoryResult.data ?? []).map((item) => ({ value: item.id || '', label: item.name }))),
      ]);
      setModifierGroups(modifierResult.data ?? []);

      // Categorias y modificadores se refrescan siempre, pero el formulario
      // no se vuelve a montar si ya se cargo para este mismo producto.
      const loadKey = `${merchantId}:${productId ?? 'new'}`;
      if (loadedKeyRef.current === loadKey) {
        setLoading(false);
        return;
      }
      loadedKeyRef.current = loadKey;

      if (isNew) {
        const next = adminService.createDefaultProductForm(branchOptions, modifierResult.data ?? []);
        setForm(next);
        setInitialState(serializeDirtyState(next));
        setLoading(false);
        return;
      }

      const result = await adminService.fetchProductForm(productId as string, branchOptions, modifierResult.data ?? []);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data) {
        setForm(result.data);
        setInitialState(serializeDirtyState(result.data));
      }
    };

    load();
  }, [branchOptions, isNew, merchantId, productId]);

  const dirty = useMemo(() => (form ? hasDirtyState(form, initialState) : false), [form, initialState]);

  const updateField = <K extends keyof ProductAdminForm>(key: K, value: ProductAdminForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSuccessMessage(null);
  };

  // El SKU acompana al nombre solo mientras no se haya editado a mano y solo
  // en productos nuevos: cambiarle el SKU a uno ya guardado romperia
  // referencias externas.
  const updateName = (value: string) => {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, name: value };
      if (isNew && !skuTouchedRef.current) {
        next.sku = value.trim() ? buildProductSku(value, skuSuffixRef.current) : '';
      }
      return next;
    });
    setSuccessMessage(null);
  };

  const updateSetting = (branchId: string, patch: Partial<ProductAdminForm['branch_settings'][number]>) => {
    setForm((current) => {
      if (!current) return current;
      const branch_settings = current.branch_settings.map((setting) =>
        setting.branch_id === branchId ? { ...setting, ...patch } : setting
      );
      return { ...current, branch_settings };
    });
    setSuccessMessage(null);
  };

  const updateModifierGroup = (groupId: string, patch: Partial<ProductAdminForm['modifier_groups'][number]>) => {
    setForm((current) => {
      if (!current) return current;
      const modifier_groups = current.modifier_groups.map((group) =>
        group.group_id === groupId ? { ...group, ...patch } : group
      );
      return { ...current, modifier_groups };
    });
    setSuccessMessage(null);
  };

  const handleSave = async (returnToList: boolean) => {
    if (!merchantId || !form) return;
    setSaving(true);
    setError(null);
    const result = await adminService.saveProduct(merchantId, form);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Guardado');
    const nextId = (result.data as any)?.id ?? productId;
    if (returnToList) {
      navigate(AppRoutes.portal.admin.products);
      return;
    }
    if (nextId) {
      const refreshed = await adminService.fetchProductForm(nextId, branchOptions, modifierGroups);
      if (!refreshed.error && refreshed.data) {
        setForm(refreshed.data);
        setInitialState(serializeDirtyState(refreshed.data));
      }
    }
  };

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar productos.</div>;
  }

  if (loading || !form) {
    return <LoadingScreen message="Cargando producto..." />;
  }

  return (
    <AdminPageFrame
      title={isNew ? 'Nuevo producto' : form.name}
      description="Editor relacional de producto con categoria, modificadores y configuracion por sucursal."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Catalogo' },
        { label: 'Productos', to: AppRoutes.portal.admin.products },
        { label: isNew ? 'Nuevo' : form.name || 'Producto' },
      ]}
      contextItems={[
        { label: 'Rol', value: portal.staffAssignment?.role || 'sin rol', tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Producto', tone: 'info' },
        { label: 'Modo', value: isNew ? 'Creacion' : 'Edicion', tone: dirty ? 'warning' : 'info' },
        { label: 'Estado', value: dirty ? 'Cambios pendientes' : 'Sin cambios', tone: dirty ? 'warning' : 'success' },
      ]}
      actions={
        <SaveActions
          onSave={() => handleSave(false)}
          onSecondarySave={() => handleSave(true)}
          onCancel={() => navigate(AppRoutes.portal.admin.products)}
          saveLabel="Guardar cambios"
          secondaryLabel="Guardar y volver al listado"
          disabled={!dirty}
          isSaving={saving}
        />
      }
    >
      <AdminTabs
        tabs={[
          { id: 'base', label: 'Base' },
          { id: 'modifiers', label: 'Modificadores', badge: String(form.modifier_groups.filter((group) => group.selected).length) },
          { id: 'branches', label: 'Sucursales', badge: String(form.branch_settings.length) },
        ]}
        activeTabId={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'base' ? (
        <AdminTabPanel>
          <SectionCard title="Datos base" description="El comercio actual se relaciona automaticamente al guardar.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <FieldGroup label="Nombre">
                <TextField value={form.name} onChange={(event) => updateName(event.target.value)} />
              </FieldGroup>
              <FieldGroup label="SKU">
                <TextField
                  value={form.sku}
                  placeholder="Se genera solo desde el nombre"
                  onChange={(event) => {
                    skuTouchedRef.current = true;
                    updateField('sku', event.target.value);
                  }}
                />
              </FieldGroup>
              <FieldGroup label="Precio base">
                <NumberField value={form.base_price} onChange={(event) => updateField('base_price', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Orden">
                <NumberField value={form.sort_order} onChange={(event) => updateField('sort_order', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Categoria">
                <RelationSelect value={form.category_id} onChange={(event) => updateField('category_id', event.target.value)} options={categories} />
              </FieldGroup>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gap: '3px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)' }}>Imagen del producto</span>
                <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>
                  Es la foto que ve el cliente en el marketplace. Sube una propia o pega una URL externa.
                </span>
              </div>
              <ImageUploadField
                currentUrl={form.image_url}
                onChange={(url) => updateField('image_url', url)}
                upload={(file) => adminService.uploadProductImage(merchantId, file, form.image_url)}
                previewLabel="Imagen actual"
                emptyLabel="Sin imagen cargada"
                nounLabel="imagen"
                previewFit="cover"
                maxSizeMb={5}
              />
              <FieldGroup label="O pegar una URL externa">
                <TextField
                  value={form.image_url}
                  placeholder="https://..."
                  onChange={(event) => updateField('image_url', event.target.value)}
                />
              </FieldGroup>
            </div>
            <FieldGroup label="Descripcion">
              <TextAreaField value={form.description} onChange={(event) => updateField('description', event.target.value)} />
            </FieldGroup>
            <CheckboxField label="Producto activo" checked={form.is_active} onChange={(event) => updateField('is_active', event.target.checked)} />
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'modifiers' ? (
        <AdminTabPanel>
          <SectionCard
            title="Modificadores"
            description="Aqui solo asignas grupos al producto. La definicion completa de grupos y opciones vive en el catalogo de modificadores."
          >
            {form.modifier_groups.length === 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <span style={{ color: '#6b7280' }}>Todavia no hay grupos de modificadores creados para este comercio.</span>
                <Link to={AppRoutes.portal.admin.modifiers} style={{ color: '#2563eb', fontWeight: 700 }}>
                  Crear grupos de modificadores
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {form.modifier_groups.map((group) => (
                  <div
                    key={group.group_id}
                    style={{
                      display: 'grid',
                      gap: '12px',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid #e5e7eb',
                      background: group.selected ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <strong>{group.group_name}</strong>
                        <div style={{ color: '#6b7280', marginTop: '6px' }}>
                          {group.is_required ? 'Obligatorio' : 'Opcional'} · Min {group.min_select} · Max {group.max_select}
                        </div>
                      </div>
                      <CheckboxField
                        label="Asignado al producto"
                        checked={group.selected}
                        onChange={(event) => updateModifierGroup(group.group_id, { selected: event.target.checked })}
                      />
                    </div>
                    <FieldGroup label="Orden dentro del producto">
                      <NumberField
                        value={group.sort_order}
                        disabled={!group.selected}
                        onChange={(event) => updateModifierGroup(group.group_id, { sort_order: event.target.value })}
                      />
                    </FieldGroup>
                    <div style={{ color: '#4b5563' }}>
                      Opciones: {group.options.length === 0 ? 'sin opciones' : group.options.map((option) => option.name).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'branches' ? (
        <AdminTabPanel>
          <SectionCard title="Configuracion por sucursal" description="Cada fila actualiza `product_branch_settings` sin pedir ids manuales.">
            <div style={{ display: 'grid', gap: '14px' }}>
              {form.branch_settings.map((setting) => (
                <div
                  key={setting.branch_id}
                  style={{ display: 'grid', gap: '12px', padding: '14px', borderRadius: '14px', border: '1px solid #e5e7eb', background: '#f9fafb' }}
                >
                  <strong>{setting.branch_name}</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <FieldGroup label="Sobreprecio">
                      <NumberField
                        value={setting.price_override}
                        onChange={(event) => updateSetting(setting.branch_id, { price_override: event.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="Motivo de pausa">
                      <TextField
                        value={setting.pause_reason}
                        onChange={(event) => updateSetting(setting.branch_id, { pause_reason: event.target.value })}
                      />
                    </FieldGroup>
                  </div>
                  <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                    <CheckboxField
                      label="Disponible"
                      checked={setting.is_available}
                      onChange={(event) => updateSetting(setting.branch_id, { is_available: event.target.checked })}
                    />
                    <CheckboxField
                      label="Pausado"
                      checked={setting.is_paused}
                      onChange={(event) => updateSetting(setting.branch_id, { is_paused: event.target.checked })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      <FormStatusBar dirty={dirty} saving={saving} error={error} successMessage={successMessage} />
    </AdminPageFrame>
  );
}
