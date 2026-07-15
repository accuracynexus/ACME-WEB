import { useContext, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CheckboxField, FieldGroup, NumberField, TextAreaField } from '../../../../components/admin/AdminFields';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame, FormStatusBar, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { TableSkeleton } from '../../../../components/shared/Skeleton';
import { TextField } from '../../../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminBranchOperationsService,
  OperationalMenuForm,
  OperationalMenuRecord,
} from '../../../../core/services/adminBranchOperationsService';
import { PortalContext } from '../../../auth/session/PortalContext';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value);
}

function productThumbStyle(imageUrl: string | null | undefined): CSSProperties {
  return imageUrl
    ? {
        width: '56px',
        height: '56px',
        borderRadius: '14px',
        background: `center / cover no-repeat url(${imageUrl})`,
        border: '1px solid #e5e7eb',
        flex: '0 0 auto',
      }
    : {
        width: '56px',
        height: '56px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(255,98,0,.18), rgba(255,177,122,.28))',
        border: '1px solid #e5e7eb',
        flex: '0 0 auto',
      };
}

export function BranchOperationalMenuPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id;
  const branchId = portal.currentBranch?.id;

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<OperationalMenuRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<OperationalMenuRecord | null>(null);
  const [form, setForm] = useState<OperationalMenuForm>(adminBranchOperationsService.createOperationalMenuForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!merchantId || !branchId) return;
    setLoading(true);
    setError(null);
    const result = await adminBranchOperationsService.fetchOperationalMenu(merchantId, branchId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRows(result.data ?? []);
  };

  useEffect(() => {
    loadData();
  }, [branchId, merchantId]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((record) =>
      [record.name, record.description, record.category_name, record.pause_reason].join(' ').toLowerCase().includes(normalized)
    );
  }, [query, rows]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((record) => record.is_active).length,
      available: rows.filter((record) => record.is_active && record.is_available && !record.is_paused).length,
      paused: rows.filter((record) => record.is_paused).length,
      inactive: rows.filter((record) => !record.is_active).length,
    }),
    [rows]
  );

  const dirty = useMemo(() => {
    if (!selectedRecord) return false;
    const initial = adminBranchOperationsService.createOperationalMenuForm(selectedRecord);
    return JSON.stringify(initial) !== JSON.stringify(form);
  }, [form, selectedRecord]);

  const handleOpenModal = (record: OperationalMenuRecord) => {
    setSelectedRecord(record);
    setForm(adminBranchOperationsService.createOperationalMenuForm(record));
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRecord(null);
    setForm(adminBranchOperationsService.createOperationalMenuForm());
  };

  const handleSave = async () => {
    if (!branchId || !selectedRecord) return;
    setSaving(true);
    setError(null);
    const result = await adminBranchOperationsService.saveOperationalMenu(branchId, selectedRecord.id, form);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccessMessage('Configuracion operativa actualizada');
    handleCloseModal();
    await loadData();
  };

  if (!merchantId || !branchId) {
    return <div>No hay sucursal activa para operar el menu.</div>;
  }

  if (portal.currentScopeType !== 'branch') {
    return <div>Esta vista pertenece a la capa sucursal.</div>;
  }

  return (
    <AdminPageFrame
      title="Menu operativo"
      description="Control rapido de disponibilidad por sucursal para pausar productos, ajustar precio de turno y evitar errores en caja."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Menu operativo' },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        {
          label: 'Actor',
          value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }),
          tone: 'info',
        },
        { label: 'Comercio', value: portal.currentMerchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Sucursal', value: portal.currentBranch?.name || 'sin sucursal', tone: 'neutral' },
        { label: 'Modo', value: 'Operacion del menu', tone: 'warning' },
      ]}
    >
      <SectionCard title="Lectura operativa" description="Resumen consolidado del inventario activo y disponible para venta inmediata.">
        <div className="stat-grid">
          {[
            { label: 'Total productos', value: String(summary.total), color: 'var(--acme-purple)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
            { label: 'Activos (Ficha)', value: String(summary.active), color: 'var(--acme-green)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
            { label: 'En vitrina', value: String(summary.available), color: 'var(--acme-blue)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> },
            { label: 'Pausas activas', value: String(summary.paused), color: 'var(--acme-red)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg> },
            { label: 'Sin visibilidad', value: String(summary.inactive), color: 'var(--acme-text-muted)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> },
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

      <SectionCard title="Filtrado rápido" description="Busca por nombre, categoría o motivo para gestionar la disponibilidad durante el turno.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <TextField 
            value={query} 
            onChange={(event) => setQuery(event.target.value)} 
            placeholder="Escribe el nombre de un plato, categoría o motivo..." 
            style={{ paddingLeft: '48px' }}
          />
        </div>
      </SectionCard>

      <FormStatusBar dirty={false} saving={saving} error={error} successMessage={successMessage} />

      <SectionCard title="Carta por sucursal" description="Aqui ves el estado real que usa el local para vender, pausar o ajustar disponibilidad.">
        {loading ? (
          <TableSkeleton />
        ) : (
          <AdminDataTable
            rows={filteredRows}
            getRowId={(record) => record.id}
            emptyMessage="No se encontraron productos con el filtro aplicado."
            columns={[
              {
                id: 'product',
                header: 'Producto / Categoría',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={productThumbStyle(record.image_url)} />
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{record.name}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{record.category_name}</span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'price',
                header: 'Precio Operativo',
                render: (record) => {
                  const hasOverride = record.branch_price !== record.base_price;
                  return (
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span style={{ fontWeight: 700, color: hasOverride ? 'var(--acme-purple)' : 'inherit' }}>
                        {formatMoney(record.branch_price)}
                      </span>
                      {hasOverride && (
                        <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px', textDecoration: 'line-through' }}>
                          Base: {formatMoney(record.base_price)}
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                id: 'state',
                header: 'Disponibilidad',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <StatusPill label={record.is_available ? 'VITRINA' : 'OCULTO'} tone={record.is_available ? 'info' : 'neutral'} />
                    {record.is_paused && <StatusPill label="PAUSADO" tone="danger" />}
                    {!record.is_active && <StatusPill label="INACTIVO" tone="danger" />}
                  </div>
                ),
              },
              {
                id: 'pause_reason',
                header: 'Nota Operativa',
                render: (record) => (
                  <span style={{ fontSize: '13px', color: record.is_paused ? 'var(--acme-red)' : 'var(--acme-text-muted)' }}>
                    {record.pause_reason || 'Sin observaciones'}
                  </span>
                ),
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '140px',
                render: (record) => (
                  <button type="button" onClick={() => handleOpenModal(record)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                    Ajustar
                  </button>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      <AdminModalForm
        open={modalOpen && Boolean(selectedRecord)}
        title={selectedRecord ? `Configurar ${selectedRecord.name}` : 'Configurar producto'}
        description="Actualiza product_branch_settings para esta sucursal sin tocar la ficha global del producto."
        onClose={handleCloseModal}
        actions={
          <>
            <button type="button" onClick={handleCloseModal} className="btn btn--secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn btn--primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        {selectedRecord ? (
          <div style={{ display: 'grid', gap: '24px' }}>
            <FormStatusBar dirty={dirty} saving={saving} error={error} successMessage={null} />
            
            <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card">
                <div className="stat-card__badge" style={{ background: 'var(--acme-purple)' }} />
                <div className="stat-card__header">
                  <span className="stat-card__label">Producto Seleccionado</span>
                  <div style={productThumbStyle(selectedRecord.image_url)} />
                </div>
                <strong className="stat-card__value" style={{ fontSize: '18px', marginTop: '12px' }}>{selectedRecord.name}</strong>
                <p className="stat-card__help">{selectedRecord.category_name}</p>
              </div>
              <div className="stat-card">
                <div className="stat-card__badge" style={{ background: 'var(--acme-text-muted)' }} />
                <div className="stat-card__header">
                  <span className="stat-card__label">Precio Base Global</span>
                  <div className="stat-card__icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                </div>
                <strong className="stat-card__value" style={{ fontSize: '24px', marginTop: '12px' }}>{formatMoney(selectedRecord.base_price)}</strong>
                <p className="stat-card__help">Precio de referencia</p>
              </div>
            </div>

            <div className="form-grid">
              <FieldGroup label="Precio Operativo (Sucursal)" hint="Este precio anula el global solo para este local.">
                <NumberField
                  value={form.price_override}
                  onChange={(event) => setForm((current) => ({ ...current, price_override: event.target.value }))}
                  placeholder={String(selectedRecord.base_price)}
                />
              </FieldGroup>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setForm(c => ({...c, is_available: !c.is_available}))}>
                <CheckboxField
                  label="Mostrar en carta"
                  checked={form.is_available}
                  onChange={() => {}}
                />
              </div>
              <div className="scope-card" style={{ cursor: 'pointer', padding: '16px' }} onClick={() => setForm(c => ({...c, is_paused: !c.is_paused}))}>
                <CheckboxField
                  label="Pausar temporalmente"
                  checked={form.is_paused}
                  onChange={() => {}}
                />
              </div>
            </div>

            <FieldGroup label="Motivo de pausa / Nota interna" hint="Explica al equipo por qué no se puede vender este plato.">
              <TextAreaField
                value={form.pause_reason}
                onChange={(event) => setForm((current) => ({ ...current, pause_reason: event.target.value }))}
                placeholder="Ejemplo: Sin insumo, cocina detenida, stock parcial."
              />
            </FieldGroup>
          </div>
        ) : null}
      </AdminModalForm>
    </AdminPageFrame>
  );
}
