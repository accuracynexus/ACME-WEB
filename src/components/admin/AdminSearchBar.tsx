import { IconSearch } from './AdminIcons';

/**
 * Buscador de una tabla, con el conteo de resultados al lado.
 *
 * Varias paginas envolvian este campo en su propia SectionCard —con titulo y
 * descripcion— gastando una franja entera de pantalla en un solo input. Va
 * pegado a la tabla que filtra, que es lo que el campo afecta.
 *
 * El conteo importa: sin el, filtrar y no encontrar nada se ve igual que no
 * tener registros cargados.
 */
export function AdminSearchBar({
  value,
  onChange,
  placeholder,
  label,
  total,
  shown,
  noun,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Etiqueta accesible del campo, ej. "Buscar comercios". */
  label: string;
  /** Los tres se omiten cuando el campo filtra varias listas a la vez y un
   *  solo conteo seria enganoso. */
  total?: number;
  shown?: number;
  /** Plural de lo que se lista, ej. "comercios". */
  noun?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
        <span
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--acme-text-faint)',
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <IconSearch size={16} />
        </span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          style={{
            width: '100%',
            minHeight: '42px',
            padding: '11px 14px 11px 40px',
            borderRadius: '10px',
            border: '1px solid var(--acme-border-strong)',
            background: 'var(--acme-surface)',
            color: 'var(--acme-text)',
            fontSize: '14px',
          }}
        />
      </div>
      {total !== undefined && shown !== undefined ? (
        <span style={{ color: 'var(--acme-text-muted)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {shown === total ? `${total} ${noun ?? ''}`.trim() : `${shown} de ${total}`}
        </span>
      ) : null}
    </div>
  );
}
