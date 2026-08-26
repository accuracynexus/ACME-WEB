import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function AdminModalForm({
  open,
  title,
  description,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  // Escape para cerrar + bloqueo del scroll de fondo mientras esta abierto.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Va por portal a body: cualquier ancestro con transform, filter o
  // contain convierte a position:fixed en relativo a ese ancestro y el
  // overlay deja de cubrir el viewport.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 9, 20, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        zIndex: 1000,
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 'min(680px, 100%)',
          maxHeight: '90dvh',
          background: 'var(--acme-surface)',
          borderRadius: 'var(--acme-radius-xl)',
          border: '1px solid var(--acme-border)',
          boxShadow: 'var(--acme-shadow-xl)',
          // Columna con el cuerpo scrolleable: el titulo y los botones
          // quedan siempre visibles por largo que sea el formulario.
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          animation: 'fadeInUp 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'flex-start',
            padding: '28px 28px 20px',
            borderBottom: '1px solid var(--acme-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'grid', gap: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--acme-text)' }}>
              {title}
            </h2>
            {description && (
              <p style={{ margin: 0, color: 'var(--acme-text-muted)', fontSize: '14px', lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--acme-radius-sm)',
              border: '1px solid var(--acme-border)',
              background: 'var(--acme-surface-muted)',
              color: 'var(--acme-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--acme-red-light)';
              e.currentTarget.style.color = 'var(--acme-red)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--acme-surface-muted)';
              e.currentTarget.style.color = 'var(--acme-text-muted)';
              e.currentTarget.style.borderColor = 'var(--acme-border)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gap: '16px', padding: '20px 28px', overflowY: 'auto', minHeight: 0, flex: 1 }}>
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              padding: '20px 28px 24px',
              borderTop: '1px solid var(--acme-border)',
              background: 'var(--acme-surface)',
              flexShrink: 0,
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
