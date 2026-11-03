import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconEdit, IconPlus } from '../../../../components/admin/AdminIcons';
import { AdminPageFrame } from '../../../../components/admin/AdminScaffold';
import { AvailabilityRow, ProductAvailabilityBoard } from '../../../../components/admin/ProductAvailabilityBoard';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { AppRoutes } from '../../../../core/constants/routes';
import { isAcmeDrinkSku } from '../../../../core/services/acmeDrinksService';
import { adminService, ProductAdminSummary } from '../../../../core/services/adminService';
import { PortalContext } from '../../../auth/session/PortalContext';

export function ProductsAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const isPlatformAdmin = portal.permissions.canAccessPlatform;
  const [products, setProducts] = useState<ProductAdminSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!merchantId) return;
      setLoading(true);
      const result = await adminService.fetchProducts(merchantId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setProducts(result.data ?? []);
    };

    load();
  }, [merchantId]);

  // Las bebidas ACME las pone ACME, no el local: el local no las gestiona.
  const rows = useMemo<AvailabilityRow[]>(
    () =>
      products
        .filter((product) => isPlatformAdmin || !isAcmeDrinkSku(product.sku))
        .map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category_name,
          price: product.base_price,
          imageUrl: product.image_url,
          active: product.is_active,
        })),
    [products, isPlatformAdmin]
  );

  const handleChanged = (productId: string, active: boolean) =>
    setProducts((current) => current.map((product) => (product.id === productId ? { ...product, is_active: active } : product)));

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar productos.</div>;
  }

  return (
    <AdminPageFrame
      title="Productos"
      description="Tu menu completo. Activa o desactiva cada producto segun lo que tengas hoy: los clientes solo ven y piden lo que esta disponible."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Catalogo' },
        { label: 'Productos' },
      ]}
      contextItems={[]}
      actions={
        <Link to={AppRoutes.portal.admin.productNew} className="btn btn--primary">
          <IconPlus />
          Nuevo producto
        </Link>
      }
    >
      {loading ? (
        <SectionSkeleton lines={5} />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <ProductAvailabilityBoard
          rows={rows}
          onChanged={handleChanged}
          renderExtra={(row) => (
            <Link to={`${AppRoutes.portal.admin.products}/${row.id}`} className="avail-edit" aria-label={`Editar ${row.name}`}>
              <IconEdit size={15} />
              Editar
            </Link>
          )}
        />
      )}
    </AdminPageFrame>
  );
}
