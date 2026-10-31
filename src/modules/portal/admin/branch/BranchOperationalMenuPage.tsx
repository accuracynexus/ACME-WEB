import { useContext, useEffect, useMemo, useState } from 'react';
import { FieldGroup, NumberField } from '../../../../components/admin/AdminFields';
import { AdminModalForm } from '../../../../components/admin/AdminModalForm';
import { AdminPageFrame } from '../../../../components/admin/AdminScaffold';
import { AvailabilityRow, ProductAvailabilityBoard } from '../../../../components/admin/ProductAvailabilityBoard';
import { TableSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { AppRoutes } from '../../../../core/constants/routes';
import { isAcmeDrinkSku } from '../../../../core/services/acmeDrinksService';
import {
  adminBranchOperationsService,
  OperationalMenuForm,
  OperationalMenuRecord,
} from '../../../../core/services/adminBranchOperationsService';
import { toast } from '../../../../core/utils/toast';
import { PortalContext } from '../../../auth/session/PortalContext';

const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(value);

/**
 * Menu operativo de la sucursal: todo el menu con un interruptor por plato.
 * El personal apaga lo que se acabo y lo vuelve a prender cuando hay; los
 * clientes solo ven lo que esta disponible. Por sucursal solo se ajusta el
 * precio del local.
 */
export function BranchOperationalMenuPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id;
  const branchId = portal.currentBranch?.id;

  const [records, setRecords] = useState<OperationalMenuRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceFor, setPriceFor] = useState<OperationalMenuRecord | null>(null);
  const [form, setForm] = useState<OperationalMenuForm>(adminBranchOperationsService.createOperationalMenuForm());
  const [saving, setSaving] = useState(false);

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
    setRecords(result.data ?? []);
  };

  useEffect(() => {
    loadData();
  }, [branchId, merchantId]);

  // Las bebidas ACME las pone ACME, no el local: el local no las gestiona.
  const rows = useMemo<AvailabilityRow[]>(
    () =>
      records
        .filter((record) => !isAcmeDrinkSku(record.sku))
        .map((record) => ({
          id: record.id,
          name: record.name,
          category: record.category_name,
          price: record.branch_price,
          priceNote: record.branch_price !== record.base_price ? 'Precio del local' : undefined,
          imageUrl: record.image_url,
          active: record.is_active,
        })),
    [records]
  );

  const handleChanged = (productId: string, active: boolean) =>
    setRecords((current) => current.map((record) => (record.id === productId ? { ...record, is_active: active } : record)));

  const openPrice = (record: OperationalMenuRecord) => {
    setPriceFor(record);
    setForm(adminBranchOperationsService.createOperationalMenuForm(record));
  };

  const savePrice = async () => {
    if (!branchId || !priceFor) return;
    setSaving(true);
    const result = await adminBranchOperationsService.saveOperationalMenu(branchId, priceFor.id, form);
    setSaving(false);
    if (result.error) {
      toast.error('No se pudo guardar el precio', result.error.message);
      return;
    }
    toast.success('Precio del local actualizado');
    setPriceFor(null);
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
      description="Tu menu completo. Apaga lo que se te acabo y vuelve a prenderlo cuando lo tengas: los clientes solo ven lo que esta disponible."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Menu operativo' },
      ]}
      contextItems={[]}
    >
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <ProductAvailabilityBoard
          rows={rows}
          onChanged={handleChanged}
          renderExtra={(row) => {
            const record = records.find((item) => item.id === row.id);
            return record ? (
              <button type="button" onClick={() => openPrice(record)} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                Precio del local
              </button>
            ) : null;
          }}
        />
      )}

      <AdminModalForm
        open={Boolean(priceFor)}
        title={priceFor ? `Precio de ${priceFor.name}` : 'Precio'}
        description={priceFor ? `Precio base: ${money(priceFor.base_price)}. Si lo cambias aqui, solo aplica en este local.` : undefined}
        onClose={() => setPriceFor(null)}
        actions={
          <>
            <button type="button" onClick={() => setPriceFor(null)} className="btn btn--secondary">
              Cancelar
            </button>
            <button type="button" onClick={savePrice} disabled={saving} className="btn btn--primary">
              {saving ? 'Guardando...' : 'Guardar precio'}
            </button>
          </>
        }
      >
        <FieldGroup label="Precio en este local" hint="Dejalo vacio para usar el precio base.">
          <NumberField
            value={form.price_override}
            onChange={(event) => setForm((current) => ({ ...current, price_override: event.target.value }))}
            placeholder={priceFor ? String(priceFor.base_price) : ''}
          />
        </FieldGroup>
      </AdminModalForm>
    </AdminPageFrame>
  );
}
