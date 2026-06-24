import {
  useDeferredValue,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import { Modal } from '../Modal';
import { fieldRow } from '../editors/shared';
import {
  DEFAULT_RESOURCE_LOCALE,
  findResourceRecord,
  formatResourceDisplay,
  getResourceKindLabel,
  getResourceLocaleLabel,
  RESOURCE_LOCALE_OPTIONS,
  useResourceDatabase,
  type ResourceKind,
  type ResourceLocale,
  type ResourceRecord,
  type ResourceSelectionMode
} from '../../lib/resourceDatabase';
import { useResourcePickerWorkerQuery } from './resourcePickerWorkerClient';
import type { ResourceFilters } from './resourcePickerQuery';
import { ResourcePickerVirtualList } from './ResourcePickerVirtualList';

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

function ResourcePickerListSkeleton() {
  return (
    <div className="resource-picker-skeleton__list">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="resource-picker-skeleton__card">
          <div className="skeleton skeleton--line skeleton--card-title" />
          <div className="skeleton skeleton--line skeleton--card-subtitle" />
          <div className="skeleton skeleton--line skeleton--card-detail" />
        </div>
      ))}
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
        <ResourcePickerListSkeleton/>
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
  const [locale, setLocale] = useState<ResourceLocale>(DEFAULT_RESOURCE_LOCALE);
  const { status: resourceStatus, database, error } = useResourceDatabase(spec.kind, locale);
  const records = database?.records ?? [];
  const deferredQuery = useDeferredValue(filters.query);
  const workerFilters = useMemo(
    () => ({
      ...filters,
      query: deferredQuery
    }),
    [deferredQuery, filters]
  );
  const selectedRecord = useMemo(
    () => (database ? findResourceRecord(database, currentValue, valueMode) : null),
    [currentValue, database, valueMode]
  );
  const selectionScrollKey = useMemo(
    () =>
      selectedRecord
        ? `${spec.kind}:${locale}:${valueMode}:${selectedRecord.key}`
        : `${spec.kind}:${locale}:${valueMode}:${currentValue.trim().toLowerCase()}`,
    [currentValue, locale, selectedRecord, spec.kind, valueMode]
  );
  const workerState = useResourcePickerWorkerQuery(spec.kind, locale, records, workerFilters);
  const filteredCount = workerState.isCurrentDatasetReady ? workerState.totalCount : 0;
  const isLoading = resourceStatus === 'idle' || resourceStatus === 'loading';
  const currentStatusLabel =
    isLoading
      ? `数据库加载中 · ${getResourceLocaleLabel(locale)}`
      : resourceStatus === 'error'
        ? `数据库加载失败 · ${getResourceLocaleLabel(locale)}`
        : workerState.status === 'error'
          ? `结果计算失败 · ${getResourceLocaleLabel(locale)}`
          : workerState.isCurrentDatasetReady
            ? workerState.status === 'loading'
              ? `数据库已加载 ${records.length} 条 · ${getResourceLocaleLabel(locale)} · 结果重新计算中`
              : `数据库已加载 ${records.length} 条 · ${getResourceLocaleLabel(locale)}`
            : `数据库已加载 ${records.length} 条 · ${getResourceLocaleLabel(locale)} · 结果计算中`;

  const showSkeleton = isLoading || (!workerState.isCurrentDatasetReady && workerState.status !== 'error');

  const resultCountLabel = workerState.isCurrentDatasetReady
    ? workerState.status === 'loading'
      ? `${filteredCount}/${records.length} · 计算中`
      : `${filteredCount}/${records.length}`
    : `0/${records.length}`;

  const resetFilters = () => {
    setFilters(spec.createDefaultFilters());
  };

  return (
    <Modal
      open
      title={`选择${getResourceKindLabel(spec.kind)}`}
      subtitle={currentStatusLabel + (selectedRecord ? ` · 匹配 ${formatResourceDisplay(selectedRecord)}` : '')}
      wide
      sheetClassName="modal-sheet--resource-picker"
      onClose={onClose}
      footer={
        <>
          <select className="input" value={locale} onChange={(event) => setLocale(event.target.value as ResourceLocale)}>
            {RESOURCE_LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" className="button button--filled" onClick={onClose}>
            关闭
          </button>
        </>
      }
    >
      <div className="resource-picker-modal">
        {resourceStatus === 'error' ? <div className="form-error">{error || '数据库加载失败'}</div> : null}

        {showSkeleton ? (
          <ResourcePickerSkeleton />
        ) : (
          <div className="resource-picker-modal__layout">
            <section className="editor-card resource-picker-modal__filters">
              <div className="resource-picker-modal__section-header">
                <div>
                  <h3 className="editor-card__title">筛选与排序</h3>
                </div>
                <div className="button-row">
                  <button type="button" 
                    className="button button--tonal button--compact" 
                    onClick={resetFilters}
                    title='重置筛选'
                  >
                    {resultCountLabel}
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
                </div>
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
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, localizedName: event.target.value }))
                  }
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
              {workerState.status === 'error' && !workerState.isCurrentDatasetReady ? (
                <div className="empty-state empty-state--compact">结果计算失败。</div>
              ) : workerState.isCurrentDatasetReady && workerState.totalCount === 0 ? (
                <div className="empty-state empty-state--compact">空空如也。</div>
              ) : workerState.isCurrentDatasetReady && workerState.status === 'loading' ? (
                <ResourcePickerListSkeleton/>
              ) : (
                <ResourcePickerVirtualList
                  records={records}
                  recordIndices={workerState.indices}
                  currentValue={currentValue}
                  valueMode={valueMode}
                  selectionScrollKey={selectionScrollKey}
                  onSelect={onSelect}
                  formatSubtitle={spec.formatSubtitle}
                  formatDetail={spec.formatDetail}
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

export function ResourcePickerControl({
  spec,
  value,
  onChange,
  valueMode,
  placeholder,
  actionLabel = '从列表选择'
}: ResourcePickerControlProps) {
  const [open, setOpen] = useState(false);

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
