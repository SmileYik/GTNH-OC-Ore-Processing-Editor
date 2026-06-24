export type ResourceKind = 'item' | 'fluid';

interface ResourceBaseRecord {
  kind: ResourceKind;
  key: string;
  localizedName: string;
  modId: string;
  internalName: string;
  displayName: string;
  searchText: string;
}

export interface ItemResourceRecord extends ResourceBaseRecord {
  kind: 'item';
  itemId: number;
  itemDamage: number;
  maxDamage: number;
  maxStackSize: number;
  tooltip: string;
  unlocalizedName: string;
}

export interface FluidResourceRecord extends ResourceBaseRecord {
  kind: 'fluid';
  fluidId: number;
  density: number;
  gaseous: boolean;
  luminosity: number;
  temperature: number;
  viscosity: number;
  unlocalizedName: string;
}

export type ResourceRecord = ItemResourceRecord | FluidResourceRecord;
export type ResourceSelectionMode = 'id' | 'label';

const RESOURCE_FILE_NAMES: Record<ResourceKind, string> = {
  item: 'items.json',
  fluid: 'fluids.json'
};

const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  item: '物品',
  fluid: '流体'
};

export interface ResourceDatabaseIndex {
  byKey: Map<string, ResourceRecord>;
  byLocalizedName: Map<string, ResourceRecord>;
  byInternalName: Map<string, ResourceRecord>;
}

export interface ResourceDatabaseEntry {
  records: ResourceRecord[];
  index: ResourceDatabaseIndex;
}

interface ResourceDatabaseCacheEntry {
  pending: Promise<ResourceDatabaseEntry> | null;
  snapshot: ResourceDatabaseEntry | null;
}

const resourceDatabaseCache = new Map<ResourceKind, ResourceDatabaseCacheEntry>();

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    return '/';
  }

  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getResourceFileUrl(kind: ResourceKind): string {
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL || '/');
  return `${baseUrl}static/database/${RESOURCE_FILE_NAMES[kind]}`;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return Boolean(value);
}

function createDisplayName(localizedName: string, key: string): string {
  const trimmedName = localizedName.trim();
  const trimmedKey = key.trim();
  if (!trimmedName) {
    return trimmedKey;
  }

  if (!trimmedKey) {
    return trimmedName;
  }

  return `${trimmedName}(${trimmedKey})`;
}

function buildSearchText(parts: Array<string | number | boolean | null | undefined>): string {
  return parts
    .map((part) => String(part ?? ''))
    .join('\u0000')
    .toLowerCase();
}

function normalizeItemRecord(key: string, raw: Record<string, unknown>): ItemResourceRecord {
  const localizedName = String(raw.localizedName ?? '');
  const internalName = String(raw.internalName ?? '');
  const modId = String(raw.modId ?? '');
  const itemId = toNumber(raw.itemId);
  const itemDamage = toNumber(raw.itemDamage);
  const maxDamage = toNumber(raw.maxDamage);
  const maxStackSize = toNumber(raw.maxStackSize, 1);
  const tooltip = String(raw.tooltip ?? '');
  const unlocalizedName = String(raw.unlocalizedName ?? '');

  return {
    kind: 'item',
    key,
    localizedName,
    modId,
    internalName,
    displayName: createDisplayName(localizedName, key),
    searchText: buildSearchText([
      key,
      localizedName,
      modId,
      internalName,
      itemId,
      itemDamage,
      maxDamage,
      maxStackSize,
      tooltip,
      unlocalizedName
    ]),
    itemId,
    itemDamage,
    maxDamage,
    maxStackSize,
    tooltip,
    unlocalizedName
  };
}

function normalizeFluidRecord(key: string, raw: Record<string, unknown>): FluidResourceRecord {
  const localizedName = String(raw.localizedName ?? '');
  const internalName = String(raw.internalName ?? '');
  const modId = String(raw.modId ?? '');
  const fluidId = toNumber(raw.fluidId);
  const density = toNumber(raw.density);
  const gaseous = toBoolean(raw.gaseous);
  const luminosity = toNumber(raw.luminosity);
  const temperature = toNumber(raw.temperature);
  const viscosity = toNumber(raw.viscosity);
  const unlocalizedName = String(raw.unlocalizedName ?? '');

  return {
    kind: 'fluid',
    key,
    localizedName,
    modId,
    internalName,
    displayName: createDisplayName(localizedName, key),
    searchText: buildSearchText([
      key,
      localizedName,
      modId,
      internalName,
      fluidId,
      density,
      gaseous,
      luminosity,
      temperature,
      viscosity,
      unlocalizedName
    ]),
    fluidId,
    density,
    gaseous,
    luminosity,
    temperature,
    viscosity,
    unlocalizedName
  };
}

async function fetchResourceDatabase(kind: ResourceKind): Promise<ResourceRecord[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const response = await fetch(getResourceFileUrl(kind), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`加载${RESOURCE_KIND_LABELS[kind]}数据库失败: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as Record<string, Record<string, unknown>>;
  const records = Object.entries(payload).map(([key, raw]) =>
    kind === 'item' ? normalizeItemRecord(key, raw) : normalizeFluidRecord(key, raw)
  );

  return records;
}

function createResourceIndex(records: ResourceRecord[]): ResourceDatabaseIndex {
  const byKey = new Map<string, ResourceRecord>();
  const byLocalizedName = new Map<string, ResourceRecord>();
  const byInternalName = new Map<string, ResourceRecord>();

  for (const record of records) {
    if (!byKey.has(record.key)) {
      byKey.set(record.key, record);
    }

    const localizedName = record.localizedName.trim();
    if (localizedName && !byLocalizedName.has(localizedName)) {
      byLocalizedName.set(localizedName, record);
    }

    const internalName = record.internalName.trim();
    if (internalName && !byInternalName.has(internalName)) {
      byInternalName.set(internalName, record);
    }
  }

  return {
    byKey,
    byLocalizedName,
    byInternalName
  };
}

function getResourceDatabaseCacheEntry(kind: ResourceKind): ResourceDatabaseCacheEntry {
  let cacheEntry = resourceDatabaseCache.get(kind);
  if (!cacheEntry) {
    cacheEntry = {
      pending: null,
      snapshot: null
    };
    resourceDatabaseCache.set(kind, cacheEntry);
  }

  return cacheEntry;
}

export async function loadResourceDatabase(kind: ResourceKind): Promise<ResourceDatabaseEntry> {
  const cacheEntry = getResourceDatabaseCacheEntry(kind);
  if (cacheEntry.snapshot) {
    return cacheEntry.snapshot;
  }

  if (!cacheEntry.pending) {
    cacheEntry.pending = fetchResourceDatabase(kind)
      .then((records) => {
        const snapshot: ResourceDatabaseEntry = {
          records,
          index: createResourceIndex(records)
        };
        cacheEntry.snapshot = snapshot;
        return snapshot;
      })
      .catch((error) => {
        cacheEntry.pending = null;
        throw error;
      });
  }

  return cacheEntry.pending;
}

export function peekResourceDatabase(kind: ResourceKind): ResourceDatabaseEntry | null {
  return getResourceDatabaseCacheEntry(kind).snapshot;
}

export function getResourceKindLabel(kind: ResourceKind): string {
  return RESOURCE_KIND_LABELS[kind];
}

export function formatResourceDisplay(record: ResourceRecord): string {
  return record.displayName;
}

export function getResourceSelectionValue(record: ResourceRecord, mode: ResourceSelectionMode): string {
  if (mode === 'label') {
    return record.localizedName.trim() || record.key;
  }

  if (record.kind === 'item') {
    return `${record.modId.trim()}:${record.internalName.trim()}:${record.itemDamage}`;
  } else {
    return record.internalName.trim()
  }
}

function isResourceDatabaseEntry(value: ResourceRecord[] | ResourceDatabaseEntry): value is ResourceDatabaseEntry {
  return !Array.isArray(value);
}

export function findResourceRecord(
  records: ResourceRecord[] | ResourceDatabaseEntry,
  value: string,
  mode: ResourceSelectionMode = 'id'
): ResourceRecord | null {
  const trimmed = value.trim();
  
  if (!trimmed) {
    return null;
  }

  let lowerCase = trimmed.replace('#', ':').toLowerCase();

  if (isResourceDatabaseEntry(records)) {
    const { index } = records;
    if (mode === 'label') {
      return (
        index.byLocalizedName.get(trimmed) ??
        index.byKey.get(lowerCase) ??
        index.byInternalName.get(trimmed) ??
        null
      );
    }
    
    return (
      index.byKey.get(lowerCase) ?? index.byInternalName.get(trimmed) ?? index.byLocalizedName.get(trimmed) ?? null
    );
  }

  const matchers =
    mode === 'label'
      ? [
          (record: ResourceRecord) => record.localizedName === trimmed,
          (record: ResourceRecord) => record.key === lowerCase,
          (record: ResourceRecord) => record.internalName === trimmed
        ]
      : [
          (record: ResourceRecord) => record.key === lowerCase,
          (record: ResourceRecord) => record.internalName === trimmed,
          (record: ResourceRecord) => record.localizedName === trimmed
        ];

  for (const matcher of matchers) {
    const found = records.find((record) => matcher(record));
    if (found) {
      return found;
    }
  }

  return null;
}

export async function loadResourceRecords(kind: ResourceKind): Promise<ResourceRecord[]> {
  return loadResourceDatabase(kind).then((database) => database.records);
}

export function peekResourceRecords(kind: ResourceKind): ResourceRecord[] | null {
  return peekResourceDatabase(kind)?.records ?? null;
}
