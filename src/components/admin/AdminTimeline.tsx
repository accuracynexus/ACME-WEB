import { ReactNode } from 'react';

export interface AdminTimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  body?: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

function getBulletColor(tone: AdminTimelineItem['tone']) {
  if (tone === 'info') return 'var(--acme-blue)';
  if (tone === 'success') return 'var(--acme-green)';
  if (tone === 'warning') return 'var(--acme-yellow)';
  if (tone === 'danger') return 'var(--acme-red)';
  return 'var(--acme-text-faint)';
}

export function AdminTimeline({ items }: { items: AdminTimelineItem[] }) {
  if (items.length === 0) {
    return <div style={{ color: 'var(--acme-text-muted)' }}>No hay eventos para mostrar.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {items.map((item) => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                marginTop: '6px',
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                background: getBulletColor(item.tone),
                flexShrink: 0,
              }}
            />
          </div>
          <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--acme-border)', display: 'grid', gap: '6px' }}>
            <strong>{item.title}</strong>
            {item.subtitle ? <span style={{ color: 'var(--acme-text-muted)' }}>{item.subtitle}</span> : null}
            {item.body ? <div style={{ color: 'var(--acme-text)' }}>{item.body}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
