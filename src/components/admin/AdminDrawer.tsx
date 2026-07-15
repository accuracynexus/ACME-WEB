import { ReactNode } from 'react';

export function AdminDrawer({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 'min(520px, 100%)',
          background: 'var(--acme-surface)',
          borderLeft: '1px solid var(--acme-border)',
          padding: '24px',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--acme-text)' }}>{title}</h2>
            {description ? <p style={{ margin: '8px 0 0', color: 'var(--acme-text-muted)' }}>{description}</p> : null}
          </div>
          <button type="button" className="btn btn--secondary" onClick={onClose} style={{ padding: '10px 12px' }}>
            Cerrar
          </button>
        </div>
        <div style={{ overflowY: 'auto', display: 'grid', gap: '16px' }}>{children}</div>
      </div>
    </div>
  );
}
