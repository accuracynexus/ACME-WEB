import { ReactNode } from 'react';

/**
 * Celda de dato con etiqueta arriba y valor abajo. Vivia dentro de la ficha
 * de pedido, pero el mismo bloque estaba repetido a mano en la ficha de
 * negocio y en la de repartidor, cada una con sus propios estilos inline.
 */
export function DataTile({
  label,
  value,
  hint,
  empty,
  numeric,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** El valor es un "sin dato": se muestra apagado en vez de en negrita. */
  empty?: boolean;
  /** Contadores: cifra mas grande y de ancho fijo, para que columnas de
   *  numeros queden alineadas entre tarjetas. */
  numeric?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '5px',
        alignContent: 'start',
        padding: '15px 17px',
        borderRadius: '14px',
        background: 'var(--acme-surface-muted)',
      }}
    >
      <span
        style={{
          color: 'var(--acme-text-muted)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <strong
        style={{
          fontSize: numeric ? '22px' : '15px',
          fontWeight: empty ? 500 : numeric ? 800 : 700,
          lineHeight: numeric ? 1.1 : 1.35,
          letterSpacing: numeric ? '-0.02em' : undefined,
          fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
          color: empty ? 'var(--acme-text-faint)' : 'var(--acme-text)',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </strong>
      {hint ? <span style={{ color: 'var(--acme-text-muted)', fontSize: '12.5px' }}>{hint}</span> : null}
      {children}
    </div>
  );
}
