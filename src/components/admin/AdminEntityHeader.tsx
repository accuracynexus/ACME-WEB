import { ReactNode } from 'react';
import { StatusPill } from './AdminScaffold';

export function AdminEntityHeader({
  title,
  description,
  status,
  actions,
}: {
  title: string;
  description?: string;
  status?: { label: string; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' };
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        padding: '20px',
        borderRadius: 'var(--acme-radius-lg)',
        background: 'var(--acme-surface)',
        border: '1px solid var(--acme-border)',
      }}
    >
      <div style={{ display: 'grid', gap: '8px', minWidth: '240px', flex: 1 }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px', letterSpacing: '-0.02em', color: 'var(--acme-text)' }}>{title}</h2>
          {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
        </div>
        {description ? (
          <p style={{ margin: 0, color: 'var(--acme-text-muted)', fontSize: '14px' }}>{description}</p>
        ) : null}
      </div>
      {/* Esta cabecera llega a tener cinco acciones (la ficha de repartidor).
          Agrupadas y alineadas a la derecha se leen como una barra, no como
          botones sueltos que se reacomodan al cambiar el ancho. */}
      {actions ? (
        <div className="btn-group" style={{ justifyContent: 'flex-end', flexShrink: 0 }}>{actions}</div>
      ) : null}
    </div>
  );
}
