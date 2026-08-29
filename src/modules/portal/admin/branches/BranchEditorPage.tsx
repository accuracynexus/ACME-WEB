import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminPageFrame, FormStatusBar, SaveActions, SectionCard } from '../../../../components/admin/AdminScaffold';
import { CheckboxField, FieldGroup, NumberField, SelectField, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminTabPanel, AdminTabs } from '../../../../components/admin/AdminTabs';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { LocationPickerField } from '../../../../components/shared/LocationPickerField';
import { TextField } from '../../../../components/ui/TextField';
import { AppRoutes } from '../../../../core/constants/routes';
import { hasDirtyState, serializeDirtyState } from '../../../../core/admin/utils/dirtyState';
import {
  adminService,
  BranchAdminForm,
  BranchClosureFormValue,
  BranchDeliveryZoneFormValue,
  BranchHourFormValue,
  DeliveryZoneFormValue,
} from '../../../../core/services/adminService';
import { PortalContext } from '../../../auth/session/PortalContext';

const statusOptions = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
];

const branchStatusOptions = [
  { value: 'open', label: 'Abierta' },
  { value: 'paused', label: 'Pausada' },
  { value: 'closed', label: 'Cerrada' },
];

const weekdayLabels = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function createTempId() {
  return `temp:${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createBranchZoneRows(zones: DeliveryZoneFormValue[]): BranchDeliveryZoneFormValue[] {
  return zones.map((zone) => ({
    zone_id: zone.id ?? '',
    zone_name: zone.name,
    assigned: false,
    fee_override: '',
    is_active: true,
  }));
}

function normalizeDateTimeValue(value: string) {
  if (!value) return '';
  const normalized = value.trim().replace(' ', 'T');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) {
    return `${match[1]}T${match[2]}`;
  }
  return normalized;
}

export function BranchEditorPage() {
  const portal = useContext(PortalContext);
  const navigate = useNavigate();
  const params = useParams();
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const branchId = params.branchId;
  const isNew = !branchId;
  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState<BranchAdminForm | null>(null);
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

      if (isNew) {
        const baseForm = adminService.createDefaultBranchForm(merchantId);
        const zonesResult = await adminService.fetchDeliveryZones();
        const deliveryZones = zonesResult.data ?? [];
        const seededForm: BranchAdminForm = {
          ...baseForm,
          delivery_zones: deliveryZones,
          branch_delivery_zones: createBranchZoneRows(deliveryZones),
        };

        if (zonesResult.error) {
          setError(zonesResult.error.message);
        }

        setForm(seededForm);
        setInitialState(serializeDirtyState(seededForm));
        setLoading(false);
        return;
      }

      const result = await adminService.fetchBranchForm(branchId as string);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data) {
        const seededZones =
          result.data.branch_delivery_zones.length > 0
            ? result.data.branch_delivery_zones
            : createBranchZoneRows(result.data.delivery_zones);
        const seededForm: BranchAdminForm = {
          ...result.data,
          branch_delivery_zones: seededZones,
        };
        setForm(seededForm);
        setInitialState(serializeDirtyState(seededForm));
      }
    };

    load();
  }, [branchId, isNew, merchantId]);

  const dirty = useMemo(() => (form ? hasDirtyState(form, initialState) : false), [form, initialState]);

  const updateField = <K extends keyof BranchAdminForm>(key: K, value: BranchAdminForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSuccessMessage(null);
  };

  const updateAddress = (key: keyof BranchAdminForm['address'], value: string) => {
    setForm((current) => (current ? { ...current, address: { ...current.address, [key]: value } } : current));
    setSuccessMessage(null);
  };

  // Las dos coordenadas se escriben juntas: un click en el mapa cambia
  // ambas, y hacerlo en dos setForm encadenados perderia una.
  const updateCoordinates = (lat: string, lng: string) => {
    setForm((current) => (current ? { ...current, address: { ...current.address, lat, lng } } : current));
    setSuccessMessage(null);
  };

  const updateBranchStatus = (key: keyof BranchAdminForm['branch_status'], value: string | boolean) => {
    setForm((current) =>
      current
        ? {
            ...current,
            branch_status: { ...current.branch_status, [key]: value },
          }
        : current
    );
    setSuccessMessage(null);
  };

  const updateHour = (index: number, patch: Partial<BranchHourFormValue>) => {
    setForm((current) => {
      if (!current) return current;
      const hours = current.hours.map((hour, currentIndex) => (currentIndex === index ? { ...hour, ...patch } : hour));
      return { ...current, hours };
    });
    setSuccessMessage(null);
  };

  const addClosure = () => {
    setForm((current) =>
      current
        ? {
            ...current,
            closures: [...current.closures, { starts_at: '', ends_at: '', reason: '' }],
          }
        : current
    );
    setSuccessMessage(null);
  };

  const updateClosure = (index: number, patch: Partial<BranchClosureFormValue>) => {
    setForm((current) => {
      if (!current) return current;
      const closures = current.closures.map((closure, currentIndex) =>
        currentIndex === index ? { ...closure, ...patch } : closure
      );
      return { ...current, closures };
    });
    setSuccessMessage(null);
  };

  const removeClosure = (index: number) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        closures: current.closures.filter((_, currentIndex) => currentIndex !== index),
      };
    });
    setSuccessMessage(null);
  };

  const addZone = () => {
    const tempId = createTempId();
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        delivery_zones: [
          ...current.delivery_zones,
          {
            id: tempId,
            name: '',
            polygon_geojson: '',
            base_fee: '0',
            min_order_amount: '0',
            estimated_minutes: '0',
            is_active: true,
          },
        ],
        branch_delivery_zones: [
          ...current.branch_delivery_zones,
          {
            zone_id: tempId,
            zone_name: '',
            assigned: true,
            fee_override: '',
            is_active: true,
          },
        ],
      };
    });
    setSuccessMessage(null);
  };

  const updateZone = (index: number, patch: Partial<DeliveryZoneFormValue>) => {
    setForm((current) => {
      if (!current) return current;
      const target = current.delivery_zones[index];
      if (!target) return current;

      const nextZone = { ...target, ...patch };
      const delivery_zones = current.delivery_zones.map((zone, currentIndex) => (currentIndex === index ? nextZone : zone));
      const branch_delivery_zones = current.branch_delivery_zones.map((relation) =>
        relation.zone_id === target.id
          ? {
              ...relation,
              zone_name: nextZone.name,
            }
          : relation
      );

      return { ...current, delivery_zones, branch_delivery_zones };
    });
    setSuccessMessage(null);
  };

  const removeNewZone = (zoneId: string | undefined) => {
    if (!zoneId || !zoneId.startsWith('temp:')) return;
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        delivery_zones: current.delivery_zones.filter((zone) => zone.id !== zoneId),
        branch_delivery_zones: current.branch_delivery_zones.filter((relation) => relation.zone_id !== zoneId),
      };
    });
    setSuccessMessage(null);
  };

  const updateBranchZone = (zoneId: string, patch: Partial<BranchDeliveryZoneFormValue>) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        branch_delivery_zones: current.branch_delivery_zones.map((relation) =>
          relation.zone_id === zoneId ? { ...relation, ...patch } : relation
        ),
      };
    });
    setSuccessMessage(null);
  };

  const toggleBranchZone = (zoneId: string, assigned: boolean) => {
    updateBranchZone(zoneId, {
      assigned,
      is_active: assigned ? true : false,
    });
  };

  const handleSave = async (returnToList: boolean) => {
    if (!form) return;
    setSaving(true);
    setError(null);
    const result = await adminService.saveBranch(form, portal.sessionUserId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccessMessage('Guardado');
    const nextId = (result.data as any)?.id ?? branchId;
    if (returnToList) {
      navigate(AppRoutes.portal.admin.branches);
      return;
    }

    if (nextId) {
      const refreshed = await adminService.fetchBranchForm(nextId);
      if (!refreshed.error && refreshed.data) {
        const refreshedForm: BranchAdminForm = {
          ...refreshed.data,
          branch_delivery_zones:
            refreshed.data.branch_delivery_zones.length > 0
              ? refreshed.data.branch_delivery_zones
              : createBranchZoneRows(refreshed.data.delivery_zones),
        };
        setForm(refreshedForm);
        setInitialState(serializeDirtyState(refreshedForm));
      }
    }
    await portal.reloadPortalContext();
  };

  if (!merchantId) {
    return <div>No hay comercio activo para editar sucursales.</div>;
  }

  if (loading || !form) {
    return <LoadingScreen message="Cargando sucursal..." />;
  }

  return (
    <AdminPageFrame
      title={isNew ? 'Nueva sucursal' : form.name}
      description="Editor relacional de sucursal con direccion, estado operativo, horarios, cierres y cobertura de reparto."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Sucursales', to: AppRoutes.portal.admin.branches },
        { label: isNew ? 'Nueva' : form.name || 'Sucursal' },
      ]}
      contextItems={[
        { label: 'OPERADOR', value: portal.profile?.full_name?.split(' ')[0] || 'ADMIN', tone: 'info' },
        { label: 'NEGOCIO', value: portal.currentMerchant?.name || 'ESTÁNDAR', tone: 'neutral' },
        { label: 'NIVEL', value: isNew ? 'BORRADOR' : 'PUBLICADO', tone: isNew ? 'neutral' : 'success' },
        { label: 'SINCRONÍA', value: dirty ? 'CAMBIOS LOCALES' : 'EN LA NUBE', tone: dirty ? 'warning' : 'success' },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button" 
            onClick={() => navigate(AppRoutes.portal.admin.branches)} 
            className="btn btn--secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={() => handleSave(true)} 
            disabled={!dirty || saving}
            className="btn btn--secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Guardar y volver
          </button>
          <button 
            type="button" 
            onClick={() => handleSave(false)} 
            disabled={!dirty || saving}
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
          >
            {saving ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Guardando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar cambios
              </>
            )}
          </button>
        </div>
      }
    >
      <AdminTabs
        tabs={[
          { id: 'overview', label: 'Base' },
          { id: 'schedule', label: 'Operacion', badge: String(form.closures.length) },
          { id: 'coverage', label: 'Cobertura', badge: String(form.branch_delivery_zones.filter((item) => item.assigned).length) },
        ]}
        activeTabId={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'overview' ? (
        <AdminTabPanel>
          <SectionCard title="Identidad de Sucursal" description="Información base para la identificación pública y contacto interno.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <FieldGroup label="Nombre Comercial" hint="Nombre público que aparecerá en la App.">
                <TextField value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ej: Sucursal Centro" />
              </FieldGroup>
              <FieldGroup label="Teléfono Directo" hint="Para soporte y atención al cliente.">
                <TextField value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+51 999 999 999" />
              </FieldGroup>
              <FieldGroup label="Tiempo Preparación (min)" hint="Estimado base para el cálculo de entrega.">
                <NumberField value={form.prep_time_avg_min} onChange={(event) => updateField('prep_time_avg_min', event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Estado de Registro" hint="Define si la sucursal es visible en el sistema.">
                <SelectField value={form.status} onChange={(event) => updateField('status', event.target.value)} options={statusOptions} />
              </FieldGroup>
            </div>
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', background: 'var(--acme-bg-soft)', border: '1px solid var(--acme-border)' }}>
              <CheckboxField
                label="La sucursal está habilitada para recibir pedidos en vivo"
                checked={form.accepts_orders}
                onChange={(event) => updateField('accepts_orders', event.target.checked)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Ubicación Física" description="Dirección exacta para el despacho de pedidos y geolocalización.">
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FieldGroup label="Dirección Línea 1" hint="Calle, número, urbanización.">
                  <TextField value={form.address.line1} onChange={(event) => updateAddress('line1', event.target.value)} placeholder="Jr. Ejemplo 123" />
                </FieldGroup>
                <FieldGroup label="Dirección Línea 2 (Opcional)" hint="Piso, oficina, local.">
                  <TextField value={form.address.line2} onChange={(event) => updateAddress('line2', event.target.value)} placeholder="Local A-2" />
                </FieldGroup>
              </div>
              <FieldGroup label="Referencia de Ubicación" hint="Datos adicionales para facilitar la llegada del repartidor.">
                <TextField value={form.address.reference} onChange={(event) => updateAddress('reference', event.target.value)} placeholder="Frente al parque central" />
              </FieldGroup>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <FieldGroup label="Distrito">
                  <TextField value={form.address.district} onChange={(event) => updateAddress('district', event.target.value)} />
                </FieldGroup>
                <FieldGroup label="Ciudad/Provincia">
                  <TextField value={form.address.city} onChange={(event) => updateAddress('city', event.target.value)} />
                </FieldGroup>
                <FieldGroup label="Región/Departamento">
                  <TextField value={form.address.region} onChange={(event) => updateAddress('region', event.target.value)} />
                </FieldGroup>
                <FieldGroup label="País">
                  <TextField value={form.address.country} onChange={(event) => updateAddress('country', event.target.value)} />
                </FieldGroup>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'grid', gap: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)' }}>Punto en el mapa</span>
                  <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>
                    Se guarda en merchant_branches.lat y lng. Sin punto, el carrito no puede calcular la distancia de reparto desde este local.
                  </span>
                </div>
                <LocationPickerField
                  lat={form.address.lat}
                  lng={form.address.lng}
                  onChange={(next) => updateCoordinates(next.lat, next.lng)}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Estado Transaccional" description="Gobernanza operativa en tiempo real para la recepción de órdenes.">
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                <FieldGroup label="Situación de Atención" hint="Define si la sucursal está operando normalmente.">
                  <SelectField
                    value={form.branch_status.status_code}
                    onChange={(event) => updateBranchStatus('status_code', event.target.value)}
                    options={branchStatusOptions}
                  />
                </FieldGroup>
                <FieldGroup label="Nota de Estado (Opcional)" hint="Motivo visible si la sucursal está pausada.">
                  <TextField value={form.branch_status.pause_reason} onChange={(event) => updateBranchStatus('pause_reason', event.target.value)} placeholder="Ej: Mantenimiento de cocina" />
                </FieldGroup>
              </div>
              <div style={{ padding: '16px', borderRadius: '14px', border: '1px solid var(--acme-border)', background: 'var(--acme-bg-soft)', display: 'grid', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--acme-purple)' }}>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                   <span style={{ fontSize: '13px', fontWeight: 800 }}>CONTROLES DINÁMICOS</span>
                </div>
                <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                  <CheckboxField
                    label="Switch Maestro Puerta (Abierta)"
                    checked={form.branch_status.is_open}
                    onChange={(event) => updateBranchStatus('is_open', event.target.checked)}
                  />
                  <CheckboxField
                    label="Canal Online Activo (Recibiendo)"
                    checked={form.branch_status.accepting_orders}
                    onChange={(event) => updateBranchStatus('accepting_orders', event.target.checked)}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'schedule' ? (
        <AdminTabPanel>
          <SectionCard title="Cronograma Semanal" description="Configuración de horarios base por día. Los cambios afectan la visibilidad en tiempo real.">
            <div style={{ display: 'grid', gap: '1px', background: 'var(--acme-border)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--acme-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 120px', gap: '1px', background: 'var(--acme-surface-muted)', padding: '12px 16px', fontSize: '12px', fontWeight: 800, color: 'var(--acme-text-faint)' }}>
                <span>DÍA</span>
                <span>APERTURA</span>
                <span>CIERRE</span>
                <span style={{ textAlign: 'center' }}>ESTADO</span>
              </div>
              {form.hours.map((hour, index) => (
                <div key={hour.id ?? hour.day_of_week} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '140px 1fr 1fr 120px', 
                  gap: '16px', 
                  alignItems: 'center', 
                  background: 'white', 
                  padding: '10px 16px' 
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{weekdayLabels[hour.day_of_week]}</span>
                  <TextField 
                    disabled={hour.is_closed}
                    value={hour.open_time} 
                    onChange={(event) => updateHour(index, { open_time: event.target.value })} 
                    style={{ background: hour.is_closed ? 'var(--acme-bg-soft)' : 'white' }}
                  />
                  <TextField 
                    disabled={hour.is_closed}
                    value={hour.close_time} 
                    onChange={(event) => updateHour(index, { close_time: event.target.value })} 
                    style={{ background: hour.is_closed ? 'var(--acme-bg-soft)' : 'white' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => updateHour(index, { is_closed: !hour.is_closed })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: hour.is_closed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: hour.is_closed ? 'var(--acme-red)' : 'var(--acme-green)',
                      }}
                    >
                      {hour.is_closed ? 'CERRADO' : 'ABIERTO'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Gestión de Cierres Especiales"
            description="Registros sobre `merchant_branch_closures` para mantenimientos, feriados o bloqueos temporales."
          >
            <div style={{ display: 'grid', gap: '16px' }}>
              {form.closures.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed var(--acme-border)', borderRadius: '20px', color: 'var(--acme-text-faint)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <p style={{ fontSize: '14px' }}>No hay cierres especiales programados.</p>
                </div>
              ) : null}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {form.closures.map((closure, index) => (
                  <div
                    key={closure.id ?? `closure-${index}`}
                    style={{
                      display: 'grid',
                      gap: '16px',
                      padding: '20px',
                      border: '1px solid var(--acme-border)',
                      borderRadius: '18px',
                      background: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      position: 'relative'
                    }}
                  >
                    <button 
                      type="button" 
                      onClick={() => removeClosure(index)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        padding: '6px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(239, 68, 68, 0.05)',
                        color: 'var(--acme-red)',
                        cursor: 'pointer'
                      }}
                      title="Eliminar cierre"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <FieldGroup label="Desde">
                        <TextField
                          type="datetime-local"
                          value={normalizeDateTimeValue(closure.starts_at)}
                          onChange={(event) => updateClosure(index, { starts_at: event.target.value })}
                        />
                      </FieldGroup>
                      <FieldGroup label="Hasta">
                        <TextField
                          type="datetime-local"
                          value={normalizeDateTimeValue(closure.ends_at)}
                          onChange={(event) => updateClosure(index, { ends_at: event.target.value })}
                        />
                      </FieldGroup>
                    </div>
                    <FieldGroup label="Motivo o Justificación">
                      <TextField 
                        value={closure.reason} 
                        onChange={(event) => updateClosure(index, { reason: event.target.value })} 
                        placeholder="Ej: Feriado Regional"
                      />
                    </FieldGroup>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button" 
                onClick={addClosure}
                className="btn btn--secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Programar cierre especial
              </button>
            </div>
          </SectionCard>
        </AdminTabPanel>
      ) : null}

      {activeTab === 'coverage' ? (
        <AdminTabPanel>
          <SectionCard
            title="Catálogo Maestro de Zonas"
            description="Estas zonas son compartidas en toda la red. Los cambios en tarifas base afectan el catálogo global."
          >
            <div style={{ display: 'grid', gap: '20px' }}>
              {form.delivery_zones.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed var(--acme-border)', borderRadius: '20px', color: 'var(--acme-text-faint)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                  <p style={{ fontSize: '14px' }}>No hay zonas de reparto registradas en el catálogo.</p>
                </div>
              ) : null}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {form.delivery_zones.map((zone, index) => (
                  <div
                    key={zone.id ?? `zone-${index}`}
                    style={{
                      display: 'grid',
                      gap: '16px',
                      padding: '24px',
                      border: '1px solid var(--acme-border)',
                      borderRadius: '20px',
                      background: 'white',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(77,20,140,0.1)', color: 'var(--acme-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--acme-text)' }}>{zone.name || 'Zona sin nombre'}</span>
                      </div>
                      {zone.id?.startsWith('temp:') && (
                        <button 
                          type="button" 
                          onClick={() => removeNewZone(zone.id)}
                          style={{ padding: '6px', borderRadius: '50%', border: 'none', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--acme-red)', cursor: 'pointer' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>

                    <FieldGroup label="Nombre identificativo">
                      <TextField value={zone.name} onChange={(event) => updateZone(index, { name: event.target.value })} placeholder="Ej: Zona Norte A" />
                    </FieldGroup>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <FieldGroup label="Base S/">
                        <NumberField value={zone.base_fee} onChange={(event) => updateZone(index, { base_fee: event.target.value })} />
                      </FieldGroup>
                      <FieldGroup label="Min S/">
                        <NumberField value={zone.min_order_amount} onChange={(event) => updateZone(index, { min_order_amount: event.target.value })} />
                      </FieldGroup>
                      <FieldGroup label="ETA (min)">
                        <NumberField value={zone.estimated_minutes} onChange={(event) => updateZone(index, { estimated_minutes: event.target.value })} />
                      </FieldGroup>
                    </div>

                    <FieldGroup label="Geocerca (GeoJSON Polígono)" hint="Opcional. Se usará para validación espacial automática.">
                      <TextAreaField
                        value={zone.polygon_geojson}
                        onChange={(event) => updateZone(index, { polygon_geojson: event.target.value })}
                        placeholder='{"type":"Polygon","coordinates":[...]}'
                        style={{ fontSize: '11px', fontFamily: 'monospace', minHeight: '60px' }}
                      />
                    </FieldGroup>

                    <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--acme-bg-soft)', border: '1px solid var(--acme-border)' }}>
                      <CheckboxField
                        label="Habilitar en el catálogo maestro"
                        checked={zone.is_active}
                        onChange={(event) => updateZone(index, { is_active: event.target.checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button" 
                onClick={addZone}
                className="btn btn--secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Registrar nueva zona base
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Vínculo de Cobertura Propio"
            description="Active las zonas que atiende este punto de venta y defina ajustes de precio si es necesario."
          >
            <div style={{ display: 'grid', gap: '1px', background: 'var(--acme-border)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--acme-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 140px 100px', gap: '1px', background: 'var(--acme-surface-muted)', padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: 'var(--acme-text-faint)' }}>
                <span>ZONA DE REPARTO</span>
                <span>TARIFA SUCURSAL (S/)</span>
                <span style={{ textAlign: 'center' }}>ASIGNACIÓN</span>
                <span style={{ textAlign: 'center' }}>ACTIVA</span>
              </div>
              {form.branch_delivery_zones.map((relation) => (
                <div
                  key={relation.zone_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 140px 100px',
                    gap: '16px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: relation.assigned ? 'white' : 'var(--acme-bg-soft)',
                    opacity: relation.assigned ? 1 : 0.7
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: relation.assigned ? 'var(--acme-purple)' : 'var(--acme-border)' }} />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: relation.assigned ? 'var(--acme-text)' : 'var(--acme-text-faint)' }}>
                      {relation.zone_name || 'Zona sin nombre'}
                    </span>
                  </div>
                  <TextField
                    disabled={!relation.assigned}
                    value={relation.fee_override}
                    onChange={(event) => updateBranchZone(relation.zone_id, { fee_override: event.target.value })}
                    placeholder="Dejar vacío para usar base"
                  />
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleBranchZone(relation.zone_id, !relation.assigned)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        background: relation.assigned ? 'rgba(77,20,140,0.1)' : 'rgba(0,0,0,0.05)',
                        color: relation.assigned ? 'var(--acme-purple)' : 'var(--acme-text-faint)',
                      }}
                    >
                      {relation.assigned ? 'ASIGNADA' : 'INACTIVA'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <CheckboxField
                      label=""
                      checked={relation.is_active}
                      disabled={!relation.assigned}
                      onChange={(event) => updateBranchZone(relation.zone_id, { is_active: event.target.checked })}
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
