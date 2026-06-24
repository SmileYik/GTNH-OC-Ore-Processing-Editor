import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import { Modal } from '../../../components/Modal';
import { fieldRow } from '../../../components/editors/shared';
import type { LogicalCommandDefinition } from '../LogicalRules';
import {
  findResourceRecord,
  formatResourceDisplay,
  getResourceKindLabel,
  getResourceSelectionValue,
  usePreloadResourceDatabase,
  useResourceDatabase,
  type ResourceKind,
  type ResourceRecord,
  type ResourceSelectionMode
} from '../../resourceDatabase';

type ComparisonOperator = '<' | '<=' | '==' | '>=' | '>' | '!=';

export interface ResourceFilters {
  query: string;
  modId: string;
  key: string;
  localizedName: string;
  internalName: string;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  gaseous: 'all' | 'yes' | 'no';
  itemIdMin: string;
  itemIdMax: string;
  itemDamageMin: string;
  itemDamageMax: string;
  maxDamageMin: string;
  maxDamageMax: string;
  maxStackSizeMin: string;
  maxStackSizeMax: string;
  fluidIdMin: string;
  fluidIdMax: string;
  densityMin: string;
  densityMax: string;
  viscosityMin: string;
  viscosityMax: string;
  temperatureMin: string;
  temperatureMax: string;
  luminosityMin: string;
  luminosityMax: string;
}

export interface ResourcePickerSpec {
  kind: ResourceKind;
  sortOptions: readonly { value: string; label: string }[];
  keyFieldLabel: string;
  keyPlaceholder: string;
  localizedNamePlaceholder: string;
  sectionCopy: string;
  createDefaultFilters: () => ResourceFilters;
  matchesSpecificFilters: (record: ResourceRecord, filters: ResourceFilters) => boolean;
  formatSubtitle: (record: ResourceRecord) => string;
  formatDetail: (record: ResourceRecord) => string;
  renderSpecificFields: (
    filters: ResourceFilters,
    setFilters: Dispatch<SetStateAction<ResourceFilters>>
  ) => ReactNode;
}

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

const VIRTUAL_ROW_HEIGHT = 96;
const VIRTUAL_OVERSCAN = 6;
const RESOURCE_SORT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

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
    amount: (match[3].trim() || '0').replace(/^0+/g, "") || '0'
  };
}

function formatComparisonExpression(resource: string, comparator: ComparisonOperator, amount: string): string {
  const compactResource = resource.trim();
  const compactAmount = amount.trim();
  return [compactResource, comparator, compactAmount].filter(Boolean).join(' ');
}

export function createDefaultResourceFilters(): ResourceFilters {
  return {
    query: '',
    modId: '',
    key: '',
    localizedName: '',
    internalName: '',
    sortKey: 'displayName',
    sortDirection: 'asc',
    gaseous: 'all',
    itemIdMin: '',
    itemIdMax: '',
    itemDamageMin: '',
    itemDamageMax: '',
    maxDamageMin: '',
    maxDamageMax: '',
    maxStackSizeMin: '',
    maxStackSizeMax: '',
    fluidIdMin: '',
    fluidIdMax: '',
    densityMin: '',
    densityMax: '',
    viscosityMin: '',
    viscosityMax: '',
    temperatureMin: '',
    temperatureMax: '',
    luminosityMin: '',
    luminosityMax: ''
  };
}

function getResourceSortValue(record: ResourceRecord, sortKey: string): string | number | boolean {
  if (sortKey in record) {
    return record[sortKey as keyof ResourceRecord] as string | number | boolean;
  }

  return record.displayName;
}

function compareResourceRecords(
  left: ResourceRecord,
  right: ResourceRecord,
  sortKey: string,
  sortDirection: 'asc' | 'desc',
  leftValueStr?: string | number | boolean,
  rightValueStr?: string | number | boolean,
): number {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const leftValue = leftValueStr ?? getResourceSortValue(left, sortKey);
  const rightValue = rightValueStr ?? getResourceSortValue(right, sortKey);

  let result = 0;
  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    result = RESOURCE_SORT_COLLATOR.compare(leftValue, rightValue);
  } else {
    result = Number(leftValue) - Number(rightValue);
  }

  if (result !== 0) {
    return result * direction;
  }

  const fallback = RESOURCE_SORT_COLLATOR.compare(left.displayName, right.displayName);
  if (fallback !== 0) {
    return fallback * direction;
  }

  return RESOURCE_SORT_COLLATOR.compare(left.key, right.key) * direction;
}

function matchesCommonFilters(record: ResourceRecord, filters: ResourceFilters): boolean {
  const matches = (a: string, b: string) => {
    a = a.trim().toLowerCase()
    return !a || b.includes(a)
  }

  return matches(filters.query, record.searchText)
    && matches(filters.modId, record.modId)
    && matches(filters.key, record.key)
    && matches(filters.localizedName, record.localizedName)
    && matches(filters.internalName, record.internalName)
}

function useVirtualWindow(itemCount: number, rowHeight: number, overscan: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const updateViewport = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = null;
      setViewport({
        scrollTop: element.scrollTop,
        height: element.clientHeight
      });
    };

    const scheduleViewportUpdate = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateViewport);
    };

    scheduleViewportUpdate();

    element.addEventListener('scroll', scheduleViewportUpdate, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleViewportUpdate();
          })
        : null;

    resizeObserver?.observe(element);

    const handleWindowResize = () => scheduleViewportUpdate();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      element.removeEventListener('scroll', scheduleViewportUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [itemCount, rowHeight, overscan]);

  const startIndex = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    itemCount,
    Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + overscan
  );

  return {
    containerRef,
    startIndex,
    endIndex,
    topSpacerHeight: startIndex * rowHeight,
    bottomSpacerHeight: Math.max(0, (itemCount - endIndex) * rowHeight)
  };
}

interface ResourcePickerListProps {
  records: ResourceRecord[];
  currentValue: string;
  valueMode: ResourceSelectionMode;
  onSelect: (nextValue: string, record: ResourceRecord) => void;
  spec: ResourcePickerSpec;
}

function matchesSelectedValue(record: ResourceRecord, value: string, mode: ResourceSelectionMode): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (mode === 'label') {
    return record.localizedName === trimmed || record.key === trimmed;
  }

  return record.key === trimmed || record.internalName === trimmed || record.localizedName === trimmed;
}

function ResourcePickerList({ records, currentValue, valueMode, onSelect, spec }: ResourcePickerListProps) {
  const { containerRef, startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = useVirtualWindow(
    records.length,
    VIRTUAL_ROW_HEIGHT,
    VIRTUAL_OVERSCAN
  );

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
  }, [containerRef, records]);

  const visibleRecords = records.slice(startIndex, endIndex);

  return (
    <div className="resource-picker-modal__list" ref={containerRef}>
      <div style={{ height: topSpacerHeight }} aria-hidden="true" />

      {visibleRecords.map((record) => {
        const isSelected = matchesSelectedValue(record, currentValue, valueMode);
        const selectionValue = getResourceSelectionValue(record, valueMode);
        let title = record.displayName
        if ('tooltip' in record) {
          title += '\n\n' + record.tooltip
        }
        return (
          <button
            key={record.key}
            type="button"
            className={`resource-picker-modal__result${isSelected ? ' is-selected' : ''}`}
            onClick={() => onSelect(selectionValue, record)}
            title={title}
          >
            <span className="resource-picker-modal__result-title">{formatResourceDisplay(record)}</span>
            <span className="resource-picker-modal__result-subtitle">{spec.formatSubtitle(record)}</span>
            <span className="resource-picker-modal__result-detail">{spec.formatDetail(record)}</span>
          </button>
        );
      })}

      <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
    </div>
  );
}

function ResourcePickerSkeleton() {
  return (
    <div className="resource-picker-skeleton" aria-busy="true" aria-live="polite">
      <section className="editor-card resource-picker-skeleton__panel resource-picker-skeleton__panel--filters">
        <div className="resource-picker-skeleton__header">
          <div className="resource-picker-skeleton__title-block">
            <div className="skeleton skeleton--line skeleton--wide" />
            <div className="skeleton skeleton--line skeleton--medium" />
          </div>
          <div className="skeleton skeleton--pill" />
        </div>

        <div className="resource-picker-skeleton__group">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--field" />
        </div>
        <div className="resource-picker-skeleton__group">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--field" />
        </div>
        <div className="resource-picker-skeleton__group">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--field" />
        </div>
        <div className="resource-picker-skeleton__group">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--field" />
        </div>
        <div className="resource-picker-skeleton__group">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--field" />
        </div>
      </section>

      <section className="editor-card resource-picker-skeleton__panel resource-picker-skeleton__panel--results">
        <div className="resource-picker-skeleton__header">
          <div className="resource-picker-skeleton__title-block">
            <div className="skeleton skeleton--line skeleton--wide" />
            <div className="skeleton skeleton--line skeleton--long" />
          </div>
          <div className="skeleton skeleton--pill skeleton--small" />
        </div>

        <div className="resource-picker-skeleton__list">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="resource-picker-skeleton__card">
              <div className="skeleton skeleton--line skeleton--card-title" />
              <div className="skeleton skeleton--line skeleton--card-subtitle" />
              <div className="skeleton skeleton--line skeleton--card-detail" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface ResourcePickerModalProps {
  spec: ResourcePickerSpec;
  currentValue: string;
  valueMode: ResourceSelectionMode;
  onClose: () => void;
  onSelect: (nextValue: string, record: ResourceRecord) => void;
}

export function ResourcePickerModal({ spec, currentValue, valueMode, onClose, onSelect }: ResourcePickerModalProps) {
  const [filters, setFilters] = useState<ResourceFilters>(() => spec.createDefaultFilters());
  const { status, database, error } = useResourceDatabase(spec.kind);
  const records = database?.records ?? [];
  const deferredQuery = useDeferredValue(filters.query);
  const selectedRecord = useMemo(() => (database ? findResourceRecord(database, currentValue, valueMode) : null), [
    currentValue,
    database,
    valueMode
  ]);
  const currentDisplayValue = selectedRecord ? formatResourceDisplay(selectedRecord) : currentValue.trim() || '（空）';
  const isLoading = status === 'idle' || status === 'loading';
  const currentStatusLabel =
    isLoading
      ? '数据库加载中'
      : status === 'error'
        ? '数据库加载失败'
        : `数据库已加载 ${records.length} 条`;

  const sortedRecords = useMemo(() => {
    return [...records].sort((left, right) =>
      compareResourceRecords(
        left,
        right,
        filters.sortKey,
        filters.sortDirection,
      )
    );
  }, [filters.sortDirection, filters.sortKey, records]);

  const filterState = useMemo(
    () => ({
      query: deferredQuery,
      modId: filters.modId,
      key: filters.key,
      localizedName: filters.localizedName,
      internalName: filters.internalName,
      gaseous: filters.gaseous,
      itemIdMin: filters.itemIdMin,
      itemIdMax: filters.itemIdMax,
      itemDamageMin: filters.itemDamageMin,
      itemDamageMax: filters.itemDamageMax,
      maxDamageMin: filters.maxDamageMin,
      maxDamageMax: filters.maxDamageMax,
      maxStackSizeMin: filters.maxStackSizeMin,
      maxStackSizeMax: filters.maxStackSizeMax,
      fluidIdMin: filters.fluidIdMin,
      fluidIdMax: filters.fluidIdMax,
      densityMin: filters.densityMin,
      densityMax: filters.densityMax,
      viscosityMin: filters.viscosityMin,
      viscosityMax: filters.viscosityMax,
      temperatureMin: filters.temperatureMin,
      temperatureMax: filters.temperatureMax,
      luminosityMin: filters.luminosityMin,
      luminosityMax: filters.luminosityMax,
      sortKey: filters.sortKey,
      sortDirection: filters.sortDirection,
    }),
    [
      deferredQuery,
      filters.densityMax,
      filters.densityMin,
      filters.fluidIdMax,
      filters.fluidIdMin,
      filters.gaseous,
      filters.internalName,
      filters.itemDamageMax,
      filters.itemDamageMin,
      filters.itemIdMax,
      filters.itemIdMin,
      filters.key,
      filters.localizedName,
      filters.luminosityMax,
      filters.luminosityMin,
      filters.maxDamageMax,
      filters.maxDamageMin,
      filters.maxStackSizeMax,
      filters.maxStackSizeMin,
      filters.modId,
      filters.temperatureMax,
      filters.temperatureMin,
      filters.viscosityMax,
      filters.viscosityMin,
      filters.sortKey,
      filters.sortDirection
    ]
  );

  const filteredRecords = useMemo(() => {
    return sortedRecords.filter((record) => {
      return matchesCommonFilters(record, filterState) && spec.matchesSpecificFilters(record, filterState);
    });
  }, [filterState, records, spec]);

  const resetFilters = () => {
    setFilters(spec.createDefaultFilters());
  };

  return (
    <Modal
      open
      title={`选择${getResourceKindLabel(spec.kind)}`}
      subtitle={`挑选一个你喜欢的${getResourceKindLabel(spec.kind)}`}
      wide
      sheetClassName="modal-sheet--resource-picker"
      onClose={onClose}
      footer={
        <button type="button" className="button button--filled" onClick={onClose}>
          关闭
        </button>
      }
    >
      <div className="resource-picker-modal">
        {fieldRow(
          '当前输入',
          <code className="logical-rule-editor__preview mono">{currentDisplayValue}</code>,
          currentStatusLabel + (selectedRecord ? ` · 匹配 ${formatResourceDisplay(selectedRecord)}` : '')
        )}

        {status === 'error' ? <div className="form-error">{error || '数据库加载失败'}</div> : null}

        {isLoading ? (
          <ResourcePickerSkeleton />
        ) : (
          <div className="resource-picker-modal__layout">
            <section className="editor-card resource-picker-modal__filters">
              <div className="resource-picker-modal__section-header">
                <div>
                  <h3 className="editor-card__title">筛选与排序</h3>
                  <p className="resource-picker-modal__section-copy">{spec.sectionCopy}</p>
                </div>
                <div className="button-row">
                  <button type="button" className="button button--tonal button--compact" onClick={resetFilters}>
                    重置筛选
                  </button>
                </div>
              </div>

              {fieldRow(
                '快速搜索',
                <input
                  className="input input--search"
                  autoFocus
                  value={filters.query}
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="搜索名称、ID、模组、内部名等"
                />
              )}

              {fieldRow(
                '排序字段',
                <div className="resource-picker-modal__sort-row">
                  <select
                    className="input input--sort"
                    value={filters.sortKey}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        sortKey: event.target.value
                      }))
                    }
                  >
                    {spec.sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button button--tonal button--compact"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc'
                      }))
                    }
                  >
                    {filters.sortDirection === 'asc' ? '升序' : '降序'}
                  </button>
                </div>,
                `当前共 ${filteredRecords.length} 条结果。`
              )}

              {fieldRow(
                '模组 ID',
                <input
                  className="input"
                  value={filters.modId}
                  onChange={(event) => setFilters((current) => ({ ...current, modId: event.target.value }))}
                  placeholder="例如 gregtech"
                />
              )}

              {fieldRow(
                spec.keyFieldLabel,
                <input
                  className="input"
                  value={filters.key}
                  onChange={(event) => setFilters((current) => ({ ...current, key: event.target.value }))}
                  placeholder={spec.keyPlaceholder}
                />
              )}

              {fieldRow(
                '本地名称',
                <input
                  className="input"
                  value={filters.localizedName}
                  onChange={(event) => setFilters((current) => ({ ...current, localizedName: event.target.value }))}
                  placeholder={spec.localizedNamePlaceholder}
                />
              )}

              {fieldRow(
                '内部名',
                <input
                  className="input"
                  value={filters.internalName}
                  onChange={(event) => setFilters((current) => ({ ...current, internalName: event.target.value }))}
                  placeholder="例如 molten.iron"
                />
              )}

              {spec.renderSpecificFields(filters, setFilters)}
            </section>

            <section className="editor-card resource-picker-modal__results">
              <div className="resource-picker-modal__section-header">
                <div>
                  <h3 className="editor-card__title">结果列表</h3>
                  <p className="resource-picker-modal__section-copy">
                    挑选一个你喜欢的
                  </p>
                </div>
                <div className="chip chip--soft">
                  {filteredRecords.length}/{records.length}
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="empty-state empty-state--compact">空空如也。</div>
              ) : (
                <ResourcePickerList
                  records={filteredRecords}
                  currentValue={currentValue}
                  valueMode={valueMode}
                  onSelect={onSelect}
                  spec={spec}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface ResourcePickerControlProps {
  spec: ResourcePickerSpec;
  value: string;
  onChange: (next: string) => void;
  valueMode: ResourceSelectionMode;
  placeholder: string;
  actionLabel?: string;
}

function ResourcePickerControl({
  spec,
  value,
  onChange,
  valueMode,
  placeholder,
  actionLabel = '从列表选择'
}: ResourcePickerControlProps) {
  const [open, setOpen] = useState(false);
  usePreloadResourceDatabase(spec.kind);

  return (
    <div className="resource-picker-control">
      <div className="resource-picker-control__row">
        <input
          className="input resource-picker-control__input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="button button--tonal button--compact" onClick={() => setOpen(true)}>
          {actionLabel}
        </button>
      </div>

      {open ? (
        <ResourcePickerModal
          spec={spec}
          currentValue={value}
          valueMode={valueMode}
          onClose={() => setOpen(false)}
          onSelect={(nextValue) => {
            onChange(nextValue);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function createResourceSelectorLogicalCommandArgsField(
  spec: ResourcePickerSpec,
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
): LogicalCommandDefinition['renderArgsField'] {
  return ({ value, onChange }) => (
    <LogicalCommandFieldPanel label={label} hint={hint}>
      <ResourcePickerControl
        spec={spec}
        value={value}
        onChange={onChange}
        valueMode={valueMode}
        placeholder={placeholder}
      />
    </LogicalCommandFieldPanel>
  );
}

export function createResourceComparisonLogicalCommandArgsField(
  spec: ResourcePickerSpec,
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
): LogicalCommandDefinition['renderArgsField'] {
  return ({ value, onChange }) => {
    const parsed = parseComparisonExpression(value);
    const handleChange = (next: { resource?: string; comparator?: ComparisonOperator; amount?: string }) => {
      const resource = next.resource ?? parsed.resource;
      const comparator = next.comparator ?? parsed.comparator;
      const amount = ((next.amount ?? parsed.amount) || '0').replace(/^0+/, '') || '0';
      
      onChange(formatComparisonExpression(resource, comparator, amount));
    };

    return (
      <LogicalCommandFieldPanel label={label} hint={hint}>
        <div className="resource-comparison">
          <div className="resource-comparison__resource">
            <span className="resource-comparison__label">{getResourceKindLabel(spec.kind)}</span>
            <ResourcePickerControl
              spec={spec}
              value={parsed.resource}
              onChange={(nextValue) => handleChange({ resource: nextValue })}
              valueMode={valueMode}
              placeholder={placeholder}
              actionLabel="选择"
            />
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
