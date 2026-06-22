import { type ReactNode } from 'react';
import type { LogicalCommandDefinition } from '../LogicalRules';

interface LogicalCommandFieldProps {
  label: string;
  hint: string;
  children: ReactNode;
}

function LogicalCommandField({ label, hint, children }: LogicalCommandFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function createInputLogicalCommandArgsField(
  label: string,
  placeholder: string,
  hint: string
): LogicalCommandDefinition['renderArgsField'] {
  return ({ value, onChange }) => (
    <LogicalCommandField label={label} hint={hint}>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </LogicalCommandField>
  );
}

export function createTextareaLogicalCommandArgsField(
  label: string,
  placeholder: string,
  hint: string,
  rows: number = 5
): LogicalCommandDefinition['renderArgsField'] {
  return ({ value, onChange }) => (
    <LogicalCommandField label={label} hint={hint}>
      <textarea
        className="input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </LogicalCommandField>
  );
}
