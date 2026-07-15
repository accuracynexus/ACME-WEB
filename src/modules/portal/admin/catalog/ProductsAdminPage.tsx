import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminService, ProductAdminSummary } from '../../../../core/services/adminService';
import { PortalContext } from '../../../auth/session/PortalContext';

function productThumbStyle(imageUrl: string | null | undefined): CSSProperties {
  return imageUrl
    ? {
        width: '52px',
        height: '52px',
        borderRadius: '14px',
        background: `center / cover no-repeat url(${imageUrl})`,
        border: '1px solid #e5e7eb',
        flex: '0 0 auto',
      }
    : {
        width: '52px',
        height: '52px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(255,98,0,.18), rgba(255,177,122,.28))',
        border: '1px solid #e5e7eb',
        flex: '0 0 auto',
      };
}

export function ProductsAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
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

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar productos.</div>;
  }

  return (
    <AdminPageFrame
      title="Productos"
      description="Vista base del catalogo con categoria y estado ya relacionados. Cada fila abre el editor compuesto del producto."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Catalogo' },
        { label: 'Productos' },
      ]}
      contextItems={[
        { label: 'Rol', value: portal.staffAssignment?.role || 'sin rol', tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Producto', tone: 'info' },
        { label: 'Modo', value: 'Consulta', tone: 'success' },
        { label: 'Estado', value: 'Sin cambios', tone: 'success' },
      ]}
      actions={
        <Link
          to={AppRoutes.portal.admin.productNew}
          className="btn btn--primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo producto
        </Link>
      }
    >
      <SectionCard title="Productos del comercio" description="La lista ya resume categoria, precio y estado para entrar a configuracion por local y modificadores.">
        {loading ? (
          <SectionSkeleton lines={5} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : (
          <AdminDataTable
            rows={products}
            getRowId={(product) => product.id}
            emptyMessage="No hay productos registrados en el catálogo global."
            columns={[
              {
                id: 'name',
                header: 'Producto',
                render: (product) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={productThumbStyle(product.image_url)} />
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{product.name}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{product.category_name}</span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'sku',
                header: 'SKU / Código',
                render: (product) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'var(--acme-text-muted)' }}>
                    {product.sku || 'N/A'}
                  </span>
                ),
              },
              {
                id: 'price',
                header: 'Precio base',
                render: (product) => (
                  <strong style={{ color: 'var(--acme-text-muted)' }}>
                    S/ {product.base_price.toFixed(2)}
                  </strong>
                ),
              },
              {
                id: 'status',
                header: 'Estado',
                render: (product) => (
                  <StatusPill 
                    label={product.is_active ? 'HABILITADO' : 'DESACTIVADO'} 
                    tone={product.is_active ? 'success' : 'neutral'} 
                  />
                ),
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '120px',
                render: (product) => (
                  <Link to={`${AppRoutes.portal.admin.products}/${product.id}`} className="btn btn--sm btn--ghost" style={{ color: 'var(--acme-purple)' }}>
                    Gestionar
                  </Link>
                ),
              },
            ]}
          />
        )}
      </SectionCard>
    </AdminPageFrame>
  );
}
