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
        resize: 'vertical',
      }}
    />
  );
}

export function SelectField({
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid var(--acme-border-strong)',
        background: 'var(--acme-surface)',
        color: 'var(--acme-text)',
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
    <label style={{ display: 'inline-flex', gap: '10px', alignItems: 'center', color: disabled ? 'var(--acme-text-faint)' : 'var(--acme-text)' }}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

export function NumberField(props: React.ComponentProps<typeof TextField>) {
  return <TextField {...props} type={props.type ?? 'number'} />;
}
