export function AccessDeniedScreen({
  title,
  paragraphs,
  action,
}: {
  title: string;
  paragraphs: string[];
  action?: { label: string; href: string };
}) {
  return (
    <div style={{ padding: '96px 24px', maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
      <div
        aria-hidden="true"
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 20px',
          borderRadius: 'var(--acme-radius-lg)',
          background: 'var(--acme-purple-light)',
          color: 'var(--acme-purple)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 style={{ marginBottom: '12px', color: 'var(--acme-text)' }}>{title}</h2>
      {paragraphs.map((text, index) => (
        <p key={index} style={{ color: 'var(--acme-text-muted)', marginBottom: index === paragraphs.length - 1 ? '24px' : '18px' }}>
          {text}
        </p>
      ))}
      {action ? (
        <a href={action.href} className="btn btn--primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
