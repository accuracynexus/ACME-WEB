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
        <div>
          <strong style={{ display: 'block', fontSize: '16px' }}>{title}</strong>
          {description ? <span style={{ color: 'var(--acme-text-muted)' }}>{description}</span> : null}
        </div>
        {actions}
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>{children}</div>
    </div>
  );
}
