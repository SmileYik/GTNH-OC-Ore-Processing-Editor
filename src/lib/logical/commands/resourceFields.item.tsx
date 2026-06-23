import { type Dispatch, type SetStateAction } from 'react';
import { fieldRow } from '../../../components/editors/shared';
import {
  createDefaultResourceFilters,
  createResourceComparisonLogicalCommandArgsField,
  createResourceSelectorLogicalCommandArgsField,
  type ResourceFilters,
  type ResourcePickerSpec,
  type ResourceRecord
} from './resourceFields';
import type { ResourceSelectionMode } from '../../resourceDatabase';

const ITEM_SORT_OPTIONS = [
  { value: 'displayName', label: '本地名称' },
  { value: 'key', label: '物品 ID' },
  { value: 'modId', label: '模组 ID' },
  { value: 'internalName', label: '内部名' },
  { value: 'itemId', label: '数值 ID' },
  { value: 'itemDamage', label: '损伤值' },
  { value: 'maxStackSize', label: '堆叠上限' },
  { value: 'maxDamage', label: '最大耐久' }
] as const;

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesItemFilters(record: ResourceRecord, filters: ResourceFilters): boolean {
  if (record.kind !== 'item') {
    return false;
  }

  const itemIdMin = parseOptionalNumber(filters.itemIdMin);
  const itemIdMax = parseOptionalNumber(filters.itemIdMax);
  const itemDamageMin = parseOptionalNumber(filters.itemDamageMin);
  const itemDamageMax = parseOptionalNumber(filters.itemDamageMax);
  const maxDamageMin = parseOptionalNumber(filters.maxDamageMin);
  const maxDamageMax = parseOptionalNumber(filters.maxDamageMax);
  const maxStackSizeMin = parseOptionalNumber(filters.maxStackSizeMin);
  const maxStackSizeMax = parseOptionalNumber(filters.maxStackSizeMax);

  if (itemIdMin !== null && record.itemId < itemIdMin) {
    return false;
  }
  if (itemIdMax !== null && record.itemId > itemIdMax) {
    return false;
  }
  if (itemDamageMin !== null && record.itemDamage < itemDamageMin) {
    return false;
  }
  if (itemDamageMax !== null && record.itemDamage > itemDamageMax) {
    return false;
  }
  if (maxDamageMin !== null && record.maxDamage < maxDamageMin) {
    return false;
  }
  if (maxDamageMax !== null && record.maxDamage > maxDamageMax) {
    return false;
  }
  if (maxStackSizeMin !== null && record.maxStackSize < maxStackSizeMin) {
    return false;
  }
  if (maxStackSizeMax !== null && record.maxStackSize > maxStackSizeMax) {
    return false;
  }

  return true;
}

function formatItemSubtitle(record: ResourceRecord): string {
  if (record.kind !== 'item') {
    return '';
  }

  return `模组 ${record.modId} · 数值 ID ${record.itemId} · 损伤值 ${record.itemDamage}`;
}

function formatItemDetail(record: ResourceRecord): string {
  if (record.kind !== 'item') {
    return '';
  }

  return `内部名 ${record.internalName} · 堆叠 ${record.maxStackSize} · 耐久 ${record.maxDamage}`;
}

function renderItemSpecificFields(
  filters: ResourceFilters,
  setFilters: Dispatch<SetStateAction<ResourceFilters>>
) {
  return (
    <>
      {fieldRow(
        '数值 ID',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最小"
            value={filters.itemIdMin}
            onChange={(event) => setFilters((current) => ({ ...current, itemIdMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最大"
            value={filters.itemIdMax}
            onChange={(event) => setFilters((current) => ({ ...current, itemIdMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '损伤值',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最小"
            value={filters.itemDamageMin}
            onChange={(event) => setFilters((current) => ({ ...current, itemDamageMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最大"
            value={filters.itemDamageMax}
            onChange={(event) => setFilters((current) => ({ ...current, itemDamageMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '堆叠上限',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最小"
            value={filters.maxStackSizeMin}
            onChange={(event) => setFilters((current) => ({ ...current, maxStackSizeMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最大"
            value={filters.maxStackSizeMax}
            onChange={(event) => setFilters((current) => ({ ...current, maxStackSizeMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '最大耐久',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最小"
            value={filters.maxDamageMin}
            onChange={(event) => setFilters((current) => ({ ...current, maxDamageMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最大"
            value={filters.maxDamageMax}
            onChange={(event) => setFilters((current) => ({ ...current, maxDamageMax: event.target.value }))}
          />
        </div>
      )}
    </>
  );
}

export const ITEM_RESOURCE_PICKER_SPEC = {
  kind: 'item',
  sortOptions: ITEM_SORT_OPTIONS,
  keyFieldLabel: '物品 ID',
  keyPlaceholder: '例如 minecraft:stone:0',
  localizedNamePlaceholder: '例如 铁锭',
  sectionCopy: '按物品字段搜索、排序和过滤。',
  createDefaultFilters: createDefaultResourceFilters,
  matchesSpecificFilters: matchesItemFilters,
  formatSubtitle: formatItemSubtitle,
  formatDetail: formatItemDetail,
  renderSpecificFields: renderItemSpecificFields
} satisfies ResourcePickerSpec;

export function createItemResourceSelectorLogicalCommandArgsField(
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
) {
  return createResourceSelectorLogicalCommandArgsField(
    ITEM_RESOURCE_PICKER_SPEC,
    label,
    placeholder,
    hint,
    valueMode
  );
}

export function createItemResourceComparisonLogicalCommandArgsField(
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
) {
  return createResourceComparisonLogicalCommandArgsField(
    ITEM_RESOURCE_PICKER_SPEC,
    label,
    placeholder,
    hint,
    valueMode
  );
}
