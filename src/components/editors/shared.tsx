import { type ReactNode } from 'react';

export function fieldRow(label: string, children: ReactNode, hint?: string) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
