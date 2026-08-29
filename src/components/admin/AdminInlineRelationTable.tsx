import { ReactNode } from 'react';

export function AdminInlineRelationTable({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '14px',
        padding: '18px',
        borderRadius: '16px',
        border: '1px solid var(--acme-border)',
        background: 'var(--acme-surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '3px', minWidth: '200px', flex: 1 }}>
          <strong style={{ fontSize: '16px', letterSpacing: '-0.01em' }}>{title}</strong>
          {description ? (
            <span style={{ color: 'var(--acme-text-muted)', fontSize: '13px', lineHeight: 1.5 }}>{description}</span>
          ) : null}
        </div>
        {/* Las acciones se agrupan y se alinean al inicio del bloque, no al
            centro: con descripciones de dos lineas quedaban flotando. */}
        {actions ? <div className="btn-group" style={{ flexShrink: 0 }}>{actions}</div> : null}
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>{children}</div>
    </div>
  );
}
