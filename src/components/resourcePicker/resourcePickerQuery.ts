import type { ResourceRecord } from '../../lib/resourceDatabase';

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

const RESOURCE_SORT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesTextFilter(filterValue: string, searchableValue: string): boolean {
  const normalizedFilterValue = filterValue.trim().toLowerCase();
  return !normalizedFilterValue || searchableValue.includes(normalizedFilterValue);
}

function getResourceSortValue(record: ResourceRecord, sortKey: string): string | number | boolean {
  if (sortKey in record) {
    return record[sortKey as keyof ResourceRecord] as string | number | boolean;
  }

  return record.displayName;
}

export function compareResourceRecords(
  left: ResourceRecord,
  right: ResourceRecord,
  sortKey: string,
  sortDirection: 'asc' | 'desc'
): number {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const leftValue = getResourceSortValue(left, sortKey);
  const rightValue = getResourceSortValue(right, sortKey);

  let result = 0;
  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    result = RESOURCE_SORT_COLLATOR.compare(leftValue, rightValue);
  } else {
    result = Number(leftValue) - Number(rightValue);
  }

  if (result !== 0) {
    return result * direction;
  }

  const displayNameFallback = RESOURCE_SORT_COLLATOR.compare(left.displayName, right.displayName);
  if (displayNameFallback !== 0) {
    return displayNameFallback * direction;
  }

  return RESOURCE_SORT_COLLATOR.compare(left.key, right.key) * direction;
}

export function matchesCommonFilters(record: ResourceRecord, filters: ResourceFilters): boolean {
  return (
    matchesTextFilter(filters.query, record.searchText) &&
    matchesTextFilter(filters.modId, record.modId) &&
    matchesTextFilter(filters.key, record.key) &&
    matchesTextFilter(filters.localizedName, record.localizedName) &&
    matchesTextFilter(filters.internalName, record.internalName)
  );
}

function matchesNumericRange(value: number, minimum: string, maximum: string): boolean {
  const parsedMinimum = parseOptionalNumber(minimum);
  const parsedMaximum = parseOptionalNumber(maximum);

  if (parsedMinimum !== null && value < parsedMinimum) {
    return false;
  }

  if (parsedMaximum !== null && value > parsedMaximum) {
    return false;
  }

  return true;
}

export function matchesResourceSpecificFilters(record: ResourceRecord, filters: ResourceFilters): boolean {
  if (record.kind === 'item') {
    return (
      matchesNumericRange(record.itemId, filters.itemIdMin, filters.itemIdMax) &&
      matchesNumericRange(record.itemDamage, filters.itemDamageMin, filters.itemDamageMax) &&
      matchesNumericRange(record.maxDamage, filters.maxDamageMin, filters.maxDamageMax) &&
      matchesNumericRange(record.maxStackSize, filters.maxStackSizeMin, filters.maxStackSizeMax)
    );
  }

  if (filters.gaseous === 'yes' && !record.gaseous) {
    return false;
  }

  if (filters.gaseous === 'no' && record.gaseous) {
    return false;
  }

  return (
    matchesNumericRange(record.fluidId, filters.fluidIdMin, filters.fluidIdMax) &&
    matchesNumericRange(record.density, filters.densityMin, filters.densityMax) &&
    matchesNumericRange(record.viscosity, filters.viscosityMin, filters.viscosityMax) &&
    matchesNumericRange(record.temperature, filters.temperatureMin, filters.temperatureMax) &&
    matchesNumericRange(record.luminosity, filters.luminosityMin, filters.luminosityMax)
  );
}

export function filterAndSortResourceRecords(records: ResourceRecord[], filters: ResourceFilters): Uint32Array {
  const matchedIndices: number[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!matchesCommonFilters(record, filters) || !matchesResourceSpecificFilters(record, filters)) {
      continue;
    }

    matchedIndices.push(index);
  }

  matchedIndices.sort((leftIndex, rightIndex) =>
    compareResourceRecords(records[leftIndex], records[rightIndex], filters.sortKey, filters.sortDirection)
  );

  return Uint32Array.from(matchedIndices);
}
