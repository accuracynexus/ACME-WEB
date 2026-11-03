import { ReactNode, useMemo, useState } from 'react';
import { productAvailabilityService } from '../../core/services/productAvailabilityService';
import { toast } from '../../core/utils/toast';
import { AdminSearchBar } from './AdminSearchBar';
import './ProductAvailabilityBoard.css';

export interface AvailabilityRow {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  active: boolean;
  /** Texto chico bajo el precio (ej. "Precio del local"). */
  priceNote?: string;
}

type Filter = 'all' | 'on' | 'off';

const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(value);

/** Interruptor accesible: dice en palabras que hace, no solo el color. */
export function AvailabilitySwitch({ on, busy, onChange, name }: { on: boolean; busy?: boolean; onChange: (next: boolean) => void; name: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${name}: ${on ? 'disponible' : 'no disponible'}`}
      disabled={busy}
      className={`avail-switch ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="avail-switch__track">
        <span className="avail-switch__thumb" />
      </span>
      <span className="avail-switch__label">{on ? 'Disponible' : 'No disponible'}</span>
    </button>
  );
}

/**
 * Menu completo del local con un interruptor por producto.
 *
 * Lo usan Catalogo (dueño) y Menu operativo (sucursal): los dos cambian lo
 * mismo, products.is_active, asi que lo que se apaga en uno se ve apagado en
 * el otro y en la tienda.
 */
export function ProductAvailabilityBoard({
  rows,
  onChanged,
  renderExtra,
}: {
  rows: AvailabilityRow[];
  /** El padre actualiza su lista; se llama al instante y de nuevo si hay que deshacer. */
  onChanged: (productId: string, active: boolean) => void;
  renderExtra?: (row: AvailabilityRow) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const on = rows.filter((row) => row.active).length;
    return { all: rows.length, on, off: rows.length - on };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'on' && !row.active) return false;
      if (filter === 'off' && row.active) return false;
      return !q || `${row.name} ${row.category}`.toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  // Categorias en el orden en que llegan (ya vienen ordenadas por el menu).
  const groups = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>();
    visible.forEach((row) => map.set(row.category, [...(map.get(row.category) ?? []), row]));
    return Array.from(map.entries());
  }, [visible]);

  const toggle = async (row: AvailabilityRow, next: boolean) => {
    setSaving((current) => new Set(current).add(row.id));
    onChanged(row.id, next); // optimista: el cambio se ve ya
    const result = await productAvailabilityService.setAvailable(row.id, next);
    setSaving((current) => {
      const copy = new Set(current);
      copy.delete(row.id);
      return copy;
    });
    if (result.error) {
      onChanged(row.id, !next); // se deshace
      toast.error('No se pudo cambiar', result.error.message);
      return;
    }
    toast.success(next ? `${row.name} disponible` : `${row.name} marcado como no disponible`);
  };

  return (
    <div className="avail-board">
      <div className="avail-toolbar">
        <div className="avail-filters" role="tablist" aria-label="Filtrar productos">
          {([
            ['all', 'Todos', counts.all],
            ['on', 'Disponibles', counts.on],
            ['off', 'No disponibles', counts.off],
          ] as Array<[Filter, string, number]>).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" aria-selected={filter === key} className={`avail-chip ${filter === key ? 'is-active' : ''}`} onClick={() => setFilter(key)}>
              {label}
              <b>{count}</b>
            </button>
          ))}
        </div>
      </div>

      <AdminSearchBar value={query} onChange={setQuery} placeholder="Buscar un plato o una categoria" label="Buscar productos" total={rows.length} shown={visible.length} noun="productos" />

      {groups.length === 0 ? (
        <div className="avail-empty">
          {rows.length === 0 ? 'Todavia no hay productos en el menu.' : 'No hay productos con ese filtro.'}
        </div>
      ) : (
        groups.map(([category, items]) => (
          <section key={category} className="avail-category">
            <div className="avail-category__head">
              <span>{category}</span>
              <span>
                {items.filter((item) => item.active).length} de {items.length} disponibles
              </span>
            </div>
            {items.map((row) => (
              <div key={row.id} className={`avail-row ${row.active ? '' : 'is-off'} ${renderExtra ? 'has-extra' : ''}`}>
                <div className="avail-row__thumb" style={row.imageUrl ? { backgroundImage: `url(${row.imageUrl})` } : undefined} />
                <div className="avail-row__name">
                  <strong title={row.name}>{row.name}</strong>
                  <span>{row.active ? 'Los clientes lo ven y lo pueden pedir' : 'Oculto: los clientes no lo ven'}</span>
                </div>
                <div className="avail-row__price">
                  {money(row.price)}
                  {row.priceNote ? <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--acme-text-muted)' }}>{row.priceNote}</div> : null}
                </div>
                <AvailabilitySwitch on={row.active} busy={saving.has(row.id)} name={row.name} onChange={(next) => toggle(row, next)} />
                {renderExtra ? <div className="avail-row__extra">{renderExtra(row)}</div> : null}
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
