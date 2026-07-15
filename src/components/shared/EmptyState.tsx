import { ReactNode } from 'react';

/**
 * Estado vacío estándar del portal, formaliza las clases globales `.empty-state`.
 * Acepta un CTA opcional para que las listas vacías inviten a crear el primer registro.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  padding = '40px 20px',
}: {
  icon?: ReactNode;
  title?: string;
  description: string;
  action?: { label: string; onClick: () => void };
  padding?: string;
}) {
  return (
    <div className="empty-state" style={{ padding }}>
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      {title ? <p className="empty-state__title">{title}</p> : null}
      <p className="empty-state__desc">{description}</p>
      {action ? (
        <button type="button" className="btn btn--primary btn--sm" onClick={action.onClick} style={{ marginTop: '12px' }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
