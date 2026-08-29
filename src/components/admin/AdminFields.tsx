import { ChangeEventHandler, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { TextField } from '../ui/TextField';

export interface SelectOption {
  value: string;
  label: string;
}

export function FieldGroup({
  label,
  hint,
  style,
  children,
}: {
  label: string;
  hint?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: '8px', ...style }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)' }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>{hint}</span> : null}
    </label>
  );
}

export function TextAreaField(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        minHeight: '96px',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid var(--acme-border-strong)',
        background: 'var(--acme-surface)',
        color: 'var(--acme-text)',
        fontSize: '14px',
        fontFamily: 'inherit',
        lineHeight: 1.5,
        resize: 'vertical',
        ...props.style,
      }}
    />
  );
}

// Flecha propia: la nativa cambia de forma en cada navegador y desalinea el
// campo respecto de los inputs de al lado.
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";

export function SelectField({
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        minHeight: '42px',
        padding: '11px 38px 11px 14px',
        borderRadius: '10px',
        border: '1px solid var(--acme-border-strong)',
        background: `var(--acme-surface) ${SELECT_CHEVRON} no-repeat right 14px center`,
        color: 'var(--acme-text)',
        fontSize: '14px',
        appearance: 'none',
        WebkitAppearance: 'none',
        cursor: 'pointer',
        ...props.style,
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function RelationSelect(props: SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return <SelectField {...props} />;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        gap: '10px',
        alignItems: 'center',
        // Golpe de click mas grande que la casilla: 16px es incomodo de
        // acertar, sobre todo en pantallas tactiles.
        minHeight: '38px',
        padding: '2px 2px',
        color: disabled ? 'var(--acme-text-faint)' : 'var(--acme-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ width: '17px', height: '17px', accentColor: 'var(--acme-purple)', cursor: 'inherit', flexShrink: 0 }}
      />
      <span>{label}</span>
    </label>
  );
}

export function NumberField(props: React.ComponentProps<typeof TextField>) {
  return <TextField {...props} type={props.type ?? 'number'} />;
}
