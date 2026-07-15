import { CSSProperties } from 'react';

/** Bloque primitivo con shimmer. Usa la clase global `.skeleton`. */
export function SkeletonBlock({
  width = '100%',
  height = 14,
  style,
}: {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  style?: CSSProperties;
}) {
  return <div className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

/** Esqueleto con la forma de AdminDataTable, para que el layout no salte al cargar. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="admin-table-wrap" aria-busy="true" aria-label="Cargando datos">
      <table className="admin-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, col) => (
              <th key={col}>
                <SkeletonBlock width={col === 0 ? '60%' : '40%'} height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }).map((_, col) => (
                <td key={col}>
                  <SkeletonBlock width={col === 0 ? '80%' : '55%'} height={13} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Esqueleto con la forma de una .stat-card. */
export function StatSkeleton() {
  return (
    <div className="stat-card" aria-busy="true" aria-hidden="true" style={{ animation: 'none' }}>
      <div className="stat-card__header">
        <SkeletonBlock width="45%" height={10} />
        <SkeletonBlock width={42} height={42} style={{ borderRadius: 'var(--acme-radius-md)' }} />
      </div>
      <SkeletonBlock width="55%" height={30} />
      <SkeletonBlock width="70%" height={11} />
    </div>
  );
}

/** Fila de StatSkeleton dentro de un .stat-grid. */
export function StatGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="stat-grid" aria-busy="true">
      {Array.from({ length: cards }).map((_, index) => (
        <StatSkeleton key={index} />
      ))}
    </div>
  );
}

/** Esqueleto de contenido para el cuerpo de un SectionCard. */
export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'grid', gap: '12px' }} aria-busy="true" aria-label="Cargando sección">
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock key={index} width={index === lines - 1 ? '60%' : '100%'} height={13} />
      ))}
    </div>
  );
}

/** Spinner pequeño para botones o refrescos inline. */
export function InlineSpinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Cargando"
    />
  );
}
