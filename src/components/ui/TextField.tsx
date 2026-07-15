import { InputHTMLAttributes } from 'react';

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid var(--acme-border-strong)',
        background: 'var(--acme-surface)',
        color: 'var(--acme-text)',
      }}
    />
  );
}
