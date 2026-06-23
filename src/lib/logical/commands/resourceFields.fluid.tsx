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

const FLUID_SORT_OPTIONS = [
  { value: 'displayName', label: '本地名称' },
  { value: 'key', label: '流体 ID' },
  { value: 'modId', label: '模组 ID' },
  { value: 'internalName', label: '内部名' },
  { value: 'fluidId', label: '数值 ID' },
  { value: 'density', label: '密度' },
  { value: 'viscosity', label: '粘度' },
  { value: 'temperature', label: '温度' },
  { value: 'luminosity', label: '亮度' },
  { value: 'gaseous', label: '气态' }
] as const;

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesFluidFilters(record: ResourceRecord, filters: ResourceFilters): boolean {
  if (record.kind !== 'fluid') {
    return false;
  }

  const fluidIdMin = parseOptionalNumber(filters.fluidIdMin);
  const fluidIdMax = parseOptionalNumber(filters.fluidIdMax);
  const densityMin = parseOptionalNumber(filters.densityMin);
  const densityMax = parseOptionalNumber(filters.densityMax);
  const viscosityMin = parseOptionalNumber(filters.viscosityMin);
  const viscosityMax = parseOptionalNumber(filters.viscosityMax);
  const temperatureMin = parseOptionalNumber(filters.temperatureMin);
  const temperatureMax = parseOptionalNumber(filters.temperatureMax);
  const luminosityMin = parseOptionalNumber(filters.luminosityMin);
  const luminosityMax = parseOptionalNumber(filters.luminosityMax);

  if (fluidIdMin !== null && record.fluidId < fluidIdMin) {
    return false;
  }
  if (fluidIdMax !== null && record.fluidId > fluidIdMax) {
    return false;
  }
  if (densityMin !== null && record.density < densityMin) {
    return false;
  }
  if (densityMax !== null && record.density > densityMax) {
    return false;
  }
  if (viscosityMin !== null && record.viscosity < viscosityMin) {
    return false;
  }
  if (viscosityMax !== null && record.viscosity > viscosityMax) {
    return false;
  }
  if (temperatureMin !== null && record.temperature < temperatureMin) {
    return false;
  }
  if (temperatureMax !== null && record.temperature > temperatureMax) {
    return false;
  }
  if (luminosityMin !== null && record.luminosity < luminosityMin) {
    return false;
  }
  if (luminosityMax !== null && record.luminosity > luminosityMax) {
    return false;
  }

  if (filters.gaseous === 'yes' && !record.gaseous) {
    return false;
  }

  if (filters.gaseous === 'no' && record.gaseous) {
    return false;
  }

  return true;
}

function formatFluidSubtitle(record: ResourceRecord): string {
  if (record.kind !== 'fluid') {
    return '';
  }

  return `模组 ${record.modId} · 数值 ID ${record.fluidId} · 密度 ${record.density} · 粘度 ${record.viscosity}`;
}

function formatFluidDetail(record: ResourceRecord): string {
  if (record.kind !== 'fluid') {
    return '';
  }

  return `内部名 ${record.internalName} · 温度 ${record.temperature} · 亮度 ${record.luminosity} · ${record.gaseous ? '气态' : '非气态'}`;
}

function renderFluidSpecificFields(
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
            value={filters.fluidIdMin}
            onChange={(event) => setFilters((current) => ({ ...current, fluidIdMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最大"
            value={filters.fluidIdMax}
            onChange={(event) => setFilters((current) => ({ ...current, fluidIdMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '密度',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="最小"
            value={filters.densityMin}
            onChange={(event) => setFilters((current) => ({ ...current, densityMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="最大"
            value={filters.densityMax}
            onChange={(event) => setFilters((current) => ({ ...current, densityMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '粘度',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="最小"
            value={filters.viscosityMin}
            onChange={(event) => setFilters((current) => ({ ...current, viscosityMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="最大"
            value={filters.viscosityMax}
            onChange={(event) => setFilters((current) => ({ ...current, viscosityMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '温度',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="最小"
            value={filters.temperatureMin}
            onChange={(event) => setFilters((current) => ({ ...current, temperatureMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="最大"
            value={filters.temperatureMax}
            onChange={(event) => setFilters((current) => ({ ...current, temperatureMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '亮度',
        <div className="resource-picker-modal__range-row">
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最小"
            value={filters.luminosityMin}
            onChange={(event) => setFilters((current) => ({ ...current, luminosityMin: event.target.value }))}
          />
          <span className="resource-picker-modal__range-separator">~</span>
          <input
            className="input input--compact"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="最大"
            value={filters.luminosityMax}
            onChange={(event) => setFilters((current) => ({ ...current, luminosityMax: event.target.value }))}
          />
        </div>
      )}

      {fieldRow(
        '是否气态',
        <select
          className="input"
          value={filters.gaseous}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              gaseous: event.target.value as ResourceFilters['gaseous']
            }))
          }
        >
          <option value="all">全部</option>
          <option value="yes">气态</option>
          <option value="no">非气态</option>
        </select>
      )}
    </>
  );
}

export const FLUID_RESOURCE_PICKER_SPEC = {
  kind: 'fluid',
  sortOptions: FLUID_SORT_OPTIONS,
  keyFieldLabel: '流体 ID',
  keyPlaceholder: '例如 water',
  localizedNamePlaceholder: '例如 蒸汽',
  sectionCopy: '按流体字段搜索、排序和过滤。',
  createDefaultFilters: createDefaultResourceFilters,
  matchesSpecificFilters: matchesFluidFilters,
  formatSubtitle: formatFluidSubtitle,
  formatDetail: formatFluidDetail,
  renderSpecificFields: renderFluidSpecificFields
} satisfies ResourcePickerSpec;

export function createFluidResourceSelectorLogicalCommandArgsField(
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
) {
  return createResourceSelectorLogicalCommandArgsField(
    FLUID_RESOURCE_PICKER_SPEC,
    label,
    placeholder,
    hint,
    valueMode
  );
}

export function createFluidResourceComparisonLogicalCommandArgsField(
  label: string,
  placeholder: string,
  hint: string,
  valueMode: ResourceSelectionMode = 'id'
) {
  return createResourceComparisonLogicalCommandArgsField(
    FLUID_RESOURCE_PICKER_SPEC,
    label,
    placeholder,
    hint,
    valueMode
  );
}
