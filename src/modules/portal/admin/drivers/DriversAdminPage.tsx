import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { CheckboxField, FieldGroup, SelectField } from '../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminDriversService,
  DriverAdminRecord,
  DriverAssignableProfile,
  DriverRootForm,
  DriverVehicleTypeOption,
} from '../../../../core/services/adminDriversService';
import { PortalContext } from '../../../auth/session/PortalContext';

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function getDriverTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active' || normalized === 'available') return 'success' as const;
  if (normalized === 'suspended' || normalized === 'blocked') return 'danger' as const;
  if (normalized === 'pending' || normalized === 'pending_verification') return 'warning' as const;
  return 'info' as const;
}

export function DriversAdminPage() {
  const navigate = useNavigate();
  const portal = useContext(PortalContext);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<DriverAdminRecord[]>([]);
  const [assignableProfiles, setAssignableProfiles] = useState<DriverAssignableProfile[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<DriverVehicleTypeOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<DriverRootForm>(adminDriversService.createEmptyRootForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [driversResult, profilesResult, vehicleTypesResult] = await Promise.all([
      adminDriversService.fetchDrivers(),
      adminDriversService.fetchAssignableProfiles(),
      adminDriversService.fetchVehicleTypes(),
    ]);

    setLoading(false);

    const nextError = driversResult.error || profilesResult.error || vehicleTypesResult.error;
    if (nextError) {
      setError(nextError.message);
      return;
    }

    setRecords(driversResult.data ?? []);
    setAssignableProfiles(profilesResult.data ?? []);
    setVehicleTypes(vehicleTypesResult.data ?? []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.full_name, record.email, record.phone, record.status, record.active_vehicle_label, record.current_order_code]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query, records]);

  const profileOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un perfil existente' },
      ...assignableProfiles.map((profile) => ({
        value: profile.user_id,
        label: `${profile.full_name || profile.email || profile.user_id} (${profile.email || 'sin email'})`,
      })),
    ],
    [assignableProfiles]
  );

  const vehicleTypeOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona un tipo de vehiculo' },
      ...vehicleTypes.map((vehicleType) => ({
        value: vehicleType.id,
        label: `${vehicleType.name} (${vehicleType.code})`,
      })),
    ],
    [vehicleTypes]
  );

  const resetCreateForm = () => {
    setCreateForm(adminDriversService.createEmptyRootForm());
    setCreateOpen(false);
  };

  const handleProfileSelection = (userId: string) => {
    const profile = assignableProfiles.find((item) => item.user_id === userId);
    if (!profile) {
      setCreateForm(adminDriversService.createEmptyRootForm());
      return;
    }

    setCreateForm((current) => ({
      ...current,
      user_id: profile.user_id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      is_active: profile.is_active,
    }));
  };

  const handleCreate = async () => {
    if (!createForm.user_id) return;
    setSaving(true);
    setError(null);

    const result = await adminDriversService.saveDriver(createForm);

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    const driverId = String((result.data as { user_id?: string } | null)?.user_id ?? createForm.user_id);
    setSuccessMessage('Repartidor creado');
    resetCreateForm();
    await loadData();
    navigate(AppRoutes.portal.admin.driverDetail.replace(':driverId', driverId));
  };

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista pertenece a la capa plataforma.</div>;
  }

  return (
    <AdminPageFrame
      title="Reparto"
      description="Padron operativo de repartidores con alta guiada y acceso a la ficha completa de campo."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Reparto' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Entidad', value: 'Repartidor', tone: 'info' },
        { label: 'Modo', value: 'Supervision de flota', tone: 'warning' },
      ]}
    >
      {loading ? (
        <SectionSkeleton lines={5} />
      ) : error ? (
        <div style={{ color: 'var(--acme-red)', padding: '20px' }}>{error}</div>
      ) : (
        <>
          <SectionCard title="Monitor de Flota" description="Estado operativo de los repartidores y balance de entregas en curso para toda la red.">
            <div className="stat-grid">
              {[
                { label: 'Repartidores', value: String(records.length), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg> },
                { label: 'En línea', value: String(records.filter(r => r.is_online).length), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
                { label: 'En Entrega', value: String(records.filter(r => r.current_order_code).length), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
                { label: 'Rating Global', value: (records.reduce((sum, r) => sum + r.rating_avg, 0) / (records.length || 1)).toFixed(1), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
              ].map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-card__badge" style={{ background: item.color }} />
                  <div className="stat-card__header">
                    <span className="stat-card__label">{item.label}</span>
                    <div className="stat-card__icon-box">{item.icon}</div>
                  </div>
                  <strong className="stat-card__value">{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Gestión de Flota" description="Búsqueda de repartidores por contacto, vehículo asignado o actividad reciente.">
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Escribe el nombre, placa, teléfono o correo del repartidor..."
                className="input-field"
                style={{ paddingLeft: '48px', width: '100%', border: '1px solid var(--acme-bg-soft)', borderRadius: '12px', padding: '12px 12px 12px 48px' }}
              />
            </div>
          </SectionCard>

          <SectionCard title="Directorio Operativo" description="Acceso a expedientes, control de liquidaciones y monitoreo de actividad.">
            <AdminDataTable
              rows={filteredRecords}
              getRowId={(record) => record.id}
              emptyMessage="No hay repartidores que coincidan con los criterios de búsqueda."
              columns={[
                {
                  id: 'driver',
                  header: 'Colaborador',
                  render: (record) => (
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div className="module-icon-box" style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, var(--acme-purple), var(--acme-blue))',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '12px'
                      }}>
                        {(record.full_name || record.email || '?').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="module-info">
                        <strong style={{ fontWeight: 800 }}>{record.full_name || 'Sin Nombre'}</strong>
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>{record.email}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'operations',
                  header: 'Operación y Vehículo',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <StatusPill label={record.status.toUpperCase()} tone={getDriverTone(record.status)} />
                        <StatusPill label={record.is_online ? 'ONLINE' : 'OFFLINE'} tone={record.is_online ? 'success' : 'neutral'} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--acme-text-muted)' }}>
                        {record.active_vehicle_label || 'Sin vehículo asignado'}
                      </span>
                    </div>
                  ),
                },
                {
                  id: 'risk',
                  header: 'Control y Verificación',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusPill label={record.is_verified ? 'VERIFICADO' : 'PENDIENTE'} tone={record.is_verified ? 'success' : 'warning'} />
                        <span style={{ color: 'var(--acme-purple)', fontWeight: 800, fontSize: '13px' }}>★ {record.rating_avg.toFixed(1)}</span>
                      </div>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>
                         Alta: {new Date(record.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  ),
                },
                {
                  id: 'finances',
                  header: 'Caja en Mano',
                  render: (record) => (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <strong style={{ color: record.pending_cash_total > 50 ? 'var(--acme-red)' : 'var(--acme-green)', fontSize: '14px' }}>
                        {formatMoney(record.pending_cash_total)}
                      </strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>Deuda operativa</span>
                    </div>
                  ),
                },
                {
                  id: 'action',
                  header: '',
                  align: 'right',
                  width: '140px',
                  render: (record) => (
                    <Link 
                      to={AppRoutes.portal.admin.driverDetail.replace(':driverId', record.id)} 
                      className="btn btn--sm btn--ghost" 
                      style={{ color: 'var(--acme-purple)', fontWeight: 700 }}
                    >
                      Ver Ficha
                    </Link>
                  ),
                },
              ]}
            />
          </SectionCard>
        </>
      )}

      <FormStatusBar dirty={false} saving={saving} error={error} successMessage={successMessage} />

      <AdminModalForm
        open={createOpen}
        title="Agregar repartidor"
        description="Vincula una cuenta de usuario a la red de reparto. Deberá completar su perfil en la App ACME Driver para comenzar."
        onClose={resetCreateForm}
        actions={
          <>
            <button type="button" onClick={resetCreateForm} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !createForm.user_id}
              className="btn btn--primary"
            >
              {saving ? 'Guardando...' : 'Crear repartidor'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="form-grid">
            <FieldGroup label="Perfil de usuario" hint="Busca por nombre o correo registrado en la plataforma.">
              <SelectField value={createForm.user_id} onChange={(event) => handleProfileSelection(event.target.value)} options={profileOptions} />
            </FieldGroup>
            <FieldGroup label="Email institucional">
              <TextField value={createForm.email} disabled />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Nombre Operativo">
              <TextField value={createForm.full_name} onChange={(event) => setCreateForm((current) => ({ ...current, full_name: event.target.value }))} placeholder="Nombre del repartidor..." />
            </FieldGroup>
            <FieldGroup label="Teléfono de Contacto">
              <TextField value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+51 ..." />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="DNI / Documento">
              <TextField value={createForm.document_number} onChange={(event) => setCreateForm((current) => ({ ...current, document_number: event.target.value }))} placeholder="Nº de documento" />
            </FieldGroup>
            <FieldGroup label="Licencia de Conducir">
              <TextField value={createForm.license_number} onChange={(event) => setCreateForm((current) => ({ ...current, license_number: event.target.value }))} placeholder="Nº de licencia" />
            </FieldGroup>
          </div>

          <div className="form-grid">
            <FieldGroup label="Tipo de Vehículo">
              <SelectField
                value={createForm.vehicle_type_id}
                onChange={(event) => setCreateForm((current) => ({ ...current, vehicle_type_id: event.target.value }))}
                options={vehicleTypeOptions}
              />
            </FieldGroup>
            <FieldGroup label="Estado Inicial">
              <SelectField
                value={createForm.status}
                onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}
                options={[
                  { value: 'pending', label: 'Pendiente de Revisión' },
                  { value: 'active', label: 'Activo' },
                  { value: 'suspended', label: 'Suspendido' },
                  { value: 'inactive', label: 'Inactivo' },
                ]}
              />
            </FieldGroup>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setCreateForm(c => ({...c, is_active: !c.is_active}))}>
              <CheckboxField
                label="Habilitar Acceso App"
                checked={createForm.is_active}
                onChange={() => {}}
              />
            </div>
            <div className="scope-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setCreateForm(c => ({...c, is_verified: !c.is_verified}))}>
              <CheckboxField
                label="Repartidor Verificado"
                checked={createForm.is_verified}
                onChange={() => {}}
              />
            </div>
          </div>

          {!assignableProfiles.length && (
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--acme-red)', fontSize: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              No hay perfiles de usuario disponibles para convertir en repartidores en este momento.
            </div>
          )}
        </div>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
