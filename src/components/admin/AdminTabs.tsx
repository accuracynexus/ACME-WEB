import { ReactNode } from 'react';

export interface AdminTabItem {
  id: string;
  label: string;
  badge?: string;
}

export function AdminTabs({
  tabs,
  activeTabId,
  onChange,
}: {
  tabs: AdminTabItem[];
  activeTabId: string;
  onChange: (tabId: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              padding: '10px 14px',
              borderRadius: '999px',
              border: `1px solid ${active ? 'rgba(77, 20, 140, 0.28)' : 'var(--acme-border)'}`,
              background: active ? 'var(--acme-purple-light)' : 'var(--acme-surface)',
              color: active ? 'var(--acme-purple)' : 'var(--acme-text-muted)',
              display: 'inline-flex',
              gap: '8px',
              alignItems: 'center',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <span>{tab.label}</span>
            {tab.badge ? (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: active ? 'rgba(77, 20, 140, 0.16)' : 'var(--acme-surface-muted)',
                  fontSize: '12px',
                }}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AdminTabPanel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: '16px' }}>{children}</div>;
}
