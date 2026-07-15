import { useContext, useEffect, useMemo, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { menuService } from '../../../core/services/menuService';
import { Category, Product, ProductBranchSettings } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { toast } from '../../../core/utils/toast';

export function MenuPage() {
  const portal = useContext(PortalContext);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchSettings, setBranchSettings] = useState<ProductBranchSettings[]>([]);
  const [loading, setLoading] = useState(false);

  const merchantId = portal.merchant?.id;
  const branchId = portal.currentBranch?.id;

  useEffect(() => {
    const load = async () => {
      if (!merchantId || !branchId) return;
      setLoading(true);
      const [categoryResult, productResult, settingsResult] = await Promise.all([
        menuService.fetchCategories(merchantId),
        menuService.fetchProducts(merchantId),
        menuService.fetchBranchProductSettings(branchId),
      ]);
      setLoading(false);
      if (categoryResult.error || productResult.error || settingsResult.error) {
        toast.error('Error al cargar menú', categoryResult.error?.message || productResult.error?.message || settingsResult.error?.message || 'Error desconocido');
        return;
      }
      setCategories(categoryResult.data ?? []);
      setProducts(productResult.data ?? []);
      setBranchSettings(settingsResult.data ?? []);
    };
    load();
  }, [merchantId, branchId]);

  const productWithBranchData = useMemo(() => {
    return products.map((product) => {
      const setting = branchSettings.find((item) => item.product_id === product.id);
      return {
        ...product,
        branch_price: setting?.price_override ?? product.price,
        paused: setting?.paused ?? false,
        branchSettingId: setting?.id,
      };
    });
  }, [products, branchSettings]);

  if (!merchantId || !branchId) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><MenuEmptyIcon /></div>
        <p className="empty-state__title">Sucursal no disponible</p>
        <p className="empty-state__desc">Selecciona una sucursal válida para ver la carta del menú.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <BookSmIcon /> Carta del negocio
          </span>
          <h1 className="page-header__title">Menú</h1>
          <p className="page-header__desc">
            Productos agrupados por categoría.{' '}
            {!loading && categories.length > 0 && (
              <span>
                <strong style={{ color: 'var(--acme-purple)', fontWeight: 800 }}>{categories.length}</strong> categorías,{' '}
                <strong style={{ color: 'var(--acme-purple)', fontWeight: 800 }}>{products.length}</strong> productos.
              </span>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : categories.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><MenuEmptyIcon /></div>
            <p className="empty-state__title">Sin categorías</p>
            <p className="empty-state__desc">No hay categorías en este comercio. Agrégalas desde el módulo de catálogo.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {categories.map((category, ci) => {
            const categoryProducts = productWithBranchData.filter((p) => p.category_id === category.id);
            return (
              <div key={category.id} className="category-group" style={{ animationDelay: `${ci * 50}ms` }}>
                <div className="category-group__header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: 'var(--acme-radius-md)',
                      background: 'var(--acme-purple-light)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: 'var(--acme-purple)',
                      boxShadow: '0 2px 6px rgba(77,20,140,0.12)',
                    }}>
                      <CategoryIcon />
                    </div>
                    <span className="category-group__name">{category.name}</span>
                  </div>
                  <span style={{
                    background: categoryProducts.length > 0 ? 'var(--acme-purple-light)' : 'var(--acme-surface)',
                    color: categoryProducts.length > 0 ? 'var(--acme-purple)' : 'var(--acme-text-faint)',
                    border: '1px solid',
                    borderColor: categoryProducts.length > 0 ? 'rgba(77,20,140,0.15)' : 'var(--acme-border)',
                    borderRadius: '999px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}>
                    {categoryProducts.length} producto{categoryProducts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {categoryProducts.length === 0 ? (
                  <div style={{ padding: '18px 22px', color: 'var(--acme-text-faint)', fontSize: '13px', fontStyle: 'italic' }}>
                    Sin productos en esta categoría
                  </div>
                ) : (
                  <div className="category-group__products">
                    {categoryProducts.map((product) => (
                      <div key={product.id} className="product-row">
                        <div style={{
                          width: '34px', height: '34px', borderRadius: 'var(--acme-radius-sm)',
                          background: product.active ? 'var(--acme-green-light)' : 'var(--acme-surface-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          color: product.active ? 'var(--acme-green)' : 'var(--acme-text-faint)',
                          border: '1px solid',
                          borderColor: product.active ? 'rgba(16,185,129,0.2)' : 'var(--acme-border)',
                        }}>
                          <ProductIcon />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="product-row__name">{product.name}</div>
                          {product.description && (
                            <div className="product-row__desc">{product.description}</div>
                          )}
                        </div>

                        <div className="product-row__badges">
                          <span className={`status-badge ${product.active ? 'status-badge--active' : 'status-badge--inactive'}`}>
                            {product.active ? 'Activo' : 'Inactivo'}
                          </span>
                          {product.paused && (
                            <span className="status-badge status-badge--paused">Pausado</span>
                          )}
                        </div>

                        <span className="product-row__price">S/ {product.branch_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuEmptyIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}
function BookSmIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}
function CategoryIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function ProductIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
