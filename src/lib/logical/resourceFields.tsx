import type { ReactNode } from 'react';
import { type LogicalCommandDefinition } from './LogicalRules';
import { ResourcePickerControl, type ResourcePickerSpec } from '../../components/resourcePicker';
import { peekAndFindResourceRecord, type ResourceSelectionMode } from '../resourceDatabase';
import { LanguageConfig, loadConfig } from '../../config';

type ComparisonOperator = '<' | '<=' | '==' | '>=' | '>' | '!=';

interface LogicalCommandFieldPanelProps {
  label: string;
  hint: string;
  children: ReactNode;
}

function LogicalCommandFieldPanel({ label, hint, children }: LogicalCommandFieldPanelProps) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-control field-control--stack">{children}</div>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

const COMPARISON_OPTIONS: Array<{ value: ComparisonOperator; label: string }> = [
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
  { value: '>=', label: '>=' },
  { value: '>', label: '>' },
  { value: '!=', label: '!=' }
];

function normalizeComparator(value: string): ComparisonOperator {
  if (value === '~=') {
    return '!=';
  }

  return (COMPARISON_OPTIONS.find((option) => option.value === value)?.value ?? '>=') as ComparisonOperator;
}

function parseComparisonExpression(value: string): {
  resource: string;
  comparator: ComparisonOperator;
  amount: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      resource: '',
      comparator: '>=',
      amount: '0'
    };
  }

  const match = trimmed.match(/^(.+?)\s*([<>=!~]+)\s*(.*?)$/);
  if (!match) {
    return {
      resource: trimmed,
      comparator: '>=',
      amount: '0'
    };
  }

  const comparator = normalizeComparator(match[2]);

  return {
    resource: match[1].trim(),
    comparator,
    amount: (match[3].trim() || '0').replace(/^0+/g, '') || '0'
  };
}

function formatComparisonExpression(resource: string, comparator: ComparisonOperator, amount: string): string {
  const compactResource = resource.trim();
  const compactAmount = amount.trim();
  return [compactResource, comparator, compactAmount].filter(Boolean).join(' ');
}

export function createResourceSelectorLogicalCommandArgsField(
  spec: ResourcePickerSpec,
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
): LogicalCommandDefinition['renderArgsField'] {
  return ({ value, onChange, userConfig }) => {
    const record = peekAndFindResourceRecord(spec.kind, valueMode === 'id', label, userConfig.lang)
    
    return (
      <LogicalCommandFieldPanel label={label} hint={hint}>
        <ResourcePickerControl
          userConfig={userConfig}
          spec={spec}
          value={value}
          onChange={onChange}
          valueMode={valueMode}
          placeholder={placeholder}
          actionLabel='选择'
        />
        {record && <span className="chip chip--soft">{`当前填入的为: ${record.localizedName}`}</span>}
      </LogicalCommandFieldPanel>
    )
  };
}

export function createResourceComparisonLogicalCommandArgsField(
  spec: ResourcePickerSpec,
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
): LogicalCommandDefinition['renderArgsField'] {
  return ({ value, onChange, userConfig }) => {
    const parsed = parseComparisonExpression(value);
    const handleChange = (next: { resource?: string; comparator?: ComparisonOperator; amount?: string }) => {
      const resource = next.resource ?? parsed.resource;
      const comparator = next.comparator ?? parsed.comparator;
      const amount = ((next.amount ?? parsed.amount) || '0').replace(/^0+/, '') || '0';

      onChange(formatComparisonExpression(resource, comparator, amount));
    };

    const record = peekAndFindResourceRecord(spec.kind, valueMode === 'id', parsed.resource, userConfig.lang);

    return (
      <LogicalCommandFieldPanel label={label} hint={hint}>
        <div className="resource-comparison">
          <div className="resource-comparison__resource">
            <span className="resource-comparison__label">{spec.kind === 'item' ? '物品' : '流体'}</span>
            <ResourcePickerControl
              userConfig={userConfig}
              spec={spec}
              value={parsed.resource}
              onChange={(nextValue) => handleChange({ resource: nextValue })}
              valueMode={valueMode}
              placeholder={placeholder}
              actionLabel="选择"
            />
            {record && <span className='chip chip--soft'>{`当前填入的为: ${record.localizedName}`}</span>}
          </div>

          <div className="resource-comparison__operators">
            <div className="resource-comparison__operator">
              <span className="resource-comparison__label">比较符号</span>
              <select
                className="input"
                value={parsed.comparator}
                onChange={(event) => handleChange({ comparator: event.target.value as ComparisonOperator })}
              >
                {COMPARISON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="resource-comparison__operator">
              <span className="resource-comparison__label">数量</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="any"
                value={parsed.amount}
                onChange={(event) => handleChange({ amount: event.target.value })}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </LogicalCommandFieldPanel>
    );
  };
}
