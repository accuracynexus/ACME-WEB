import { ModuleIcon } from './ModuleIcon';

type StatTone = 'purple' | 'green' | 'orange' | 'red' | 'neutral';

const TONES: Record<StatTone, { color: string; background: string }> = {
  purple: { color: 'var(--acme-purple)', background: 'var(--acme-purple-light)' },
  green: { color: 'var(--acme-green)', background: 'var(--acme-green-light)' },
  orange: { color: 'var(--acme-orange)', background: 'var(--acme-orange-light)' },
  red: { color: 'var(--acme-red)', background: 'var(--acme-red-light)' },
  neutral: { color: 'var(--acme-text-muted)', background: 'var(--acme-surface-muted)' },
};

/**
 * Tarjeta de cifra con icono. Pagos y Liquidaciones armaban cada una la suya
 * con SVG sueltos y colores distintos; aca el icono sale de ModuleIcon y el
 * color de un tono fijo, asi las dos paginas se leen igual.
 */
export function AdminStatCard({
  label,
  value,
  icon,
  tone = 'neutral',
  help,
}: {
  label: string;
  value: string;
  icon: string;
  tone?: StatTone;
  help?: string;
}) {
  const colors = TONES[tone];
  return (
    <div className="stat-card">
      <div className="stat-card__header" style={{ alignItems: 'center', gap: '10px' }}>
        <span className="stat-card__label">{label}</span>
        <div className="stat-card__icon-box" style={{ color: colors.color, background: colors.background }}>
          <ModuleIcon icon={icon} size={17} />
        </div>
      </div>
      <strong className="stat-card__value">{value}</strong>
      {help ? <span className="stat-card__help">{help}</span> : null}
    </div>
  );
}
