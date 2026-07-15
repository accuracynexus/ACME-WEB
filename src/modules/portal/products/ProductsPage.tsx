import { useContext, useEffect, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { menuService } from '../../../core/services/menuService';
import { Product } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { toast } from '../../../core/utils/toast';

export function ProductsPage() {
  const portal = useContext(PortalContext);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const merchantId = portal.merchant?.id;

  const loadProducts = async () => {
    if (!merchantId) return;
    setLoading(true);
    const result = await menuService.fetchProducts(merchantId);
    setLoading(false);
    if (result.error) {
      toast.error('Error al cargar productos', result.error.message);
      return;
    }
    setProducts(result.data ?? []);
  };

  useEffect(() => { loadProducts(); }, [merchantId]);

  const toggleActive = async (product: Product) => {
    const newState = !product.active;
    setToggleLoading(product.id);
    const result = await menuService.toggleProductActive(product.id, newState);
    setToggleLoading(null);
    if (result.error) {
      toast.error('Error al actualizar producto', result.error.message);
      return;
    }
    toast.success(
      newState ? 'Producto activado' : 'Producto desactivado',
      product.name
    );
    await loadProducts();
  };

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <TagIcon /> Catálogo del negocio
          </span>
          <h1 className="page-header__title">Productos</h1>
          <p className="page-header__desc">Gestión y publicación de productos. Usa el toggle para activar o desactivar la disponibilidad.</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={loadProducts} disabled={loading}>
            <RefreshIcon /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {products.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'var(--acme-surface)', border: '1px solid var(--acme-border)',
            borderRadius: 'var(--acme-radius-md)', padding: '0 14px', height: '40px',
            maxWidth: '340px', transition: 'all 0.18s ease',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--acme-text-faint)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: '13px', color: 'var(--acme-text)', fontFamily: 'inherit',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="btn btn--ghost btn--sm" style={{ padding: '4px', minWidth: 'auto' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : products.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><ProductsEmptyIcon /></div>
            <p className="empty-state__title">Sin productos</p>
            <p className="empty-state__desc">No hay productos registrados para este comercio todavía.</p>
          </div>
        </div>
      ) : (
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Todos los productos</h2>
              <p className="section-card__subtitle">
                {filtered.length} de {products.length} producto{products.length !== 1 ? 's' : ''}
                {' · '}
                {products.filter((p) => p.active).length} activos
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 20px' }}>
              <p className="empty-state__title">Sin resultados</p>
              <p className="empty-state__desc">No hay productos que coincidan con "{search}".</p>
            </div>
          ) : (
            <div className="data-list">
              {filtered.map((product, i) => (
                <div key={product.id} className="data-item" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="data-item__icon" style={{
                    background: product.active ? 'var(--acme-green-light)' : 'var(--acme-surface-muted)',
                    color: product.active ? 'var(--acme-green)' : 'var(--acme-text-faint)',
                  }}>
                    <ProductIcon />
                  </div>

                  <div className="data-item__body">
                    <div className="data-item__title">{product.name}</div>
                    {product.description && (
                      <div className="data-item__sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px' }}>
                        {product.description}
                      </div>
                    )}
                  </div>

                  <div className="data-item__end">
                    <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--acme-purple)', letterSpacing: '-0.02em', minWidth: '80px', textAlign: 'right' }}>
                      S/ {product.price.toFixed(2)}
                    </span>
                    <span className={`status-badge ${product.active ? 'status-badge--active' : 'status-badge--inactive'}`}>
                      {product.active ? 'Activo' : 'Inactivo'}
                    </span>
                    <label className="toggle-switch" title={product.active ? 'Desactivar producto' : 'Activar producto'}>
                      <input
                        type="checkbox"
                        checked={product.active}
                        disabled={toggleLoading === product.id}
                        onChange={() => toggleActive(product)}
                      />
                      <span className="toggle-switch__slider" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function ProductsEmptyIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function TagIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
