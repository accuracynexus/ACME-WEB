import { ReactNode, useEffect } from 'react';
import { toast } from '../../core/utils/toast';
import { Link } from 'react-router-dom';

export type AdminTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface AdminBreadcrumb {
  label: string;
  to?: string;
}

export interface AdminContextItem {
  label: string;
  value: string;
  tone?: AdminTone;
}

function getToneStyles(tone: AdminTone = 'neutral') {
  if (tone === 'info')    return { background: 'var(--acme-purple-light)', color: 'var(--acme-purple)', border: 'rgba(77,20,140,0.20)' };
  if (tone === 'success') return { background: 'var(--acme-green-light)',  color: 'var(--acme-green)',  border: 'rgba(16,185,129,0.22)' };
  if (tone === 'warning') return { background: 'var(--acme-orange-light)', color: 'var(--acme-orange)', border: 'rgba(255,98,0,0.26)' };
  if (tone === 'danger')  return { background: 'var(--acme-red-light)',    color: 'var(--acme-red)',    border: 'rgba(239,68,68,0.22)' };
  return { background: 'var(--acme-surface-muted)', color: 'var(--acme-text-muted)', border: 'var(--acme-border)' };
}

/* ——— Status Pill ——————————————————————————————— */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: AdminTone }) {
  const styles = getToneStyles(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '999px',
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: '12px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

/* ——— Breadcrumbs Bar ——————————————————————————— */
export function BreadcrumbsBar({ items }: { items: AdminBreadcrumb[] }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          {item.to
            ? <Link to={item.to} style={{ color: 'var(--acme-purple)', fontWeight: 700, fontSize: '13px' }}>{item.label}</Link>
            : <span style={{ color: 'var(--acme-text-muted)', fontSize: '13px', fontWeight: 500 }}>{item.label}</span>
          }
          {index < items.length - 1 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--acme-text-faint)' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

/* ——— Context Bar ———————————————————————————————— */
export function ContextBar({ items }: { items: AdminContextItem[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '12px 14px',
        borderRadius: 'var(--acme-radius-md)',
        border: '1px solid var(--acme-border)',
        background: 'var(--acme-surface-muted)',
      }}
    >
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 'var(--acme-radius-sm)',
            background: 'var(--acme-surface)',
            border: '1px solid var(--acme-border)',
          }}
        >
          <span style={{ color: 'var(--acme-text-faint)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {item.label}
          </span>
          <StatusPill label={item.value} tone={item.tone} />
        </div>
      ))}
    </div>
  );
}

/* ——— Section Card ——————————————————————————————— */
export function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-card__header">
        <div>
          <h2 className="section-card__title">{title}</h2>
          {description && <p className="section-card__subtitle">{description}</p>}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
      <div style={{ display: 'grid', gap: '16px' }}>{children}</div>
    </section>
  );
}

/* ——— Save Actions ——————————————————————————————— */
export function SaveActions({
  onSave,
  onCancel,
  onSecondarySave,
  saveLabel = 'Guardar',
  secondaryLabel = 'Guardar y seguir',
  isSaving = false,
  disabled = false,
}: {
  onSave: () => void;
  onCancel?: () => void;
  onSecondarySave?: () => void;
  saveLabel?: string;
  secondaryLabel?: string;
  isSaving?: boolean;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="btn btn--secondary"
        >
          Cancelar
        </button>
      )}
      {onSecondarySave && (
        <button
          type="button"
          onClick={onSecondarySave}
          disabled={disabled || isSaving}
          className="btn btn--secondary"
        >
          {secondaryLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || isSaving}
        className="btn btn--primary"
      >
        {isSaving ? 'Guardando...' : saveLabel}
      </button>
    </div>
  );
}

/* ——— Form Status Bar ———————————————————————————— */
export function FormStatusBar({
  dirty,
  saving,
  error,
  successMessage,
}: {
  dirty: boolean;
  saving: boolean;
  error?: string | null;
  successMessage?: string | null;
}) {
  useEffect(() => {
    if (successMessage) {
      toast.success('Éxito', successMessage);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      toast.error('Error', error);
    }
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
        padding: '12px 14px',
        borderRadius: 'var(--acme-radius-md)',
        border: '1px solid var(--acme-border)',
        background: 'var(--acme-surface-muted)',
      }}
    >
      <StatusPill
        label={saving ? 'Guardando...' : dirty ? 'Cambios pendientes' : 'Sin cambios'}
        tone={saving ? 'info' : dirty ? 'warning' : 'success'}
      />
      {successMessage && <StatusPill label={successMessage} tone="success" />}
      {error && <StatusPill label={error} tone="danger" />}
    </div>
  );
}

/* ——— Admin Page Frame ———————————————————————————— */
export function AdminPageFrame({
  title,
  description,
  breadcrumbs,
  contextItems,
  actions,
  children,
}: {
  title: string;
  description?: string;
  breadcrumbs: AdminBreadcrumb[];
  contextItems: AdminContextItem[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Breadcrumbs */}
      <BreadcrumbsBar items={breadcrumbs} />

      {/* Context pills */}
      {contextItems.length > 0 && <ContextBar items={contextItems} />}

      {/* Title + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <h1 className="page-header__title">{title}</h1>
          {description && <p className="page-header__desc">{description}</p>}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gap: '20px' }}>{children}</div>
    </div>
  );
}
