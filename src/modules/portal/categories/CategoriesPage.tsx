import { useContext, useEffect, useState } from 'react';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { menuService } from '../../../core/services/menuService';
import { Category } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { toast } from '../../../core/utils/toast';

export function CategoriesPage() {
  const portal = useContext(PortalContext);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const merchantId = portal.merchant?.id;

  const loadCategories = async () => {
    if (!merchantId) return;
    setLoading(true);
    const result = await menuService.fetchCategories(merchantId);
    setLoading(false);
    if (result.error) {
      toast.error('Error al cargar categorías', result.error.message);
      return;
    }
    setCategories(result.data ?? []);
  };

  useEffect(() => { loadCategories(); }, [merchantId]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">
            <GridSmIcon /> Catálogo del negocio
          </span>
          <h1 className="page-header__title">Categorías</h1>
          <p className="page-header__desc">Estructura del menú organizada por categorías de productos.</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={loadCategories} disabled={loading}>
            <RefreshIcon /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {loading ? (
        <SectionSkeleton lines={5} />
      ) : !merchantId ? (
        <div className="empty-state">
          <div className="empty-state__icon"><GridIcon /></div>
          <p className="empty-state__title">Sin comercio seleccionado</p>
          <p className="empty-state__desc">Selecciona un comercio para ver sus categorías.</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state__icon"><GridIcon /></div>
            <p className="empty-state__title">Sin categorías</p>
            <p className="empty-state__desc">No hay categorías registradas para este comercio todavía.</p>
          </div>
        </div>
      ) : (
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Categorías del menú</h2>
              <p className="section-card__subtitle">
                {categories.length} categoría{categories.length !== 1 ? 's' : ''} registrada{categories.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="data-list">
            {categories.map((category, i) => (
              <div key={category.id} className="data-item" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="data-item__icon" style={{ background: 'var(--acme-purple-light)', color: 'var(--acme-purple)' }}>
                  <GridIcon />
                </div>

                <div className="data-item__body">
                  <div className="data-item__title">{category.name}</div>
                  {category.description && (
                    <div className="data-item__sub">{category.description}</div>
                  )}
                </div>

                {category.sort_order !== undefined && (
                  <div className="data-item__end">
                    <span style={{
                      fontSize: '11px', fontWeight: 800,
                      color: 'var(--acme-purple)',
                      background: 'var(--acme-purple-light)',
                      border: '1px solid rgba(77,20,140,0.15)',
                      borderRadius: '999px', padding: '3px 9px',
                    }}>
                      #{category.sort_order}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GridIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function GridSmIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
