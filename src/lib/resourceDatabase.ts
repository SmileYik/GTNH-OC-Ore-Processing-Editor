import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode
} from 'react';

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

type ResourceDatabaseStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ResourceDatabaseSliceState {
  status: ResourceDatabaseStatus;
  database: ResourceDatabaseEntry | null;
  error: string;
}

interface ResourceDatabaseState {
  item: ResourceDatabaseSliceState;
  fluid: ResourceDatabaseSliceState;
}

type ResourceDatabaseAction =
  | { type: 'request'; kind: ResourceKind }
  | { type: 'success'; kind: ResourceKind; database: ResourceDatabaseEntry }
  | { type: 'failure'; kind: ResourceKind; error: string };

interface ResourceDatabaseContextValue {
  state: ResourceDatabaseState;
  ensureDatabase: (kind: ResourceKind) => Promise<ResourceDatabaseEntry>;
}

const ResourceDatabaseContext = createContext<ResourceDatabaseContextValue | null>(null);

interface ResourceDatabaseCacheEntry {
  pending: Promise<ResourceDatabaseEntry> | null;
  snapshot: ResourceDatabaseEntry | null;
}

const resourceDatabaseCache = new Map<ResourceKind, ResourceDatabaseCacheEntry>();

function createResourceDatabaseSlice(kind: ResourceKind): ResourceDatabaseSliceState {
  const snapshot = peekResourceDatabase(kind);

  if (snapshot) {
    return {
      status: 'ready',
      database: snapshot,
      error: ''
    };
  }

  return {
    status: 'idle',
    database: null,
    error: ''
  };
}

function createInitialResourceDatabaseState(): ResourceDatabaseState {
  return {
    item: createResourceDatabaseSlice('item'),
    fluid: createResourceDatabaseSlice('fluid')
  };
}

function resourceDatabaseReducer(
  state: ResourceDatabaseState,
  action: ResourceDatabaseAction
): ResourceDatabaseState {
  const current = state[action.kind];

  if (action.type === 'request') {
    if (current.status === 'loading' || current.status === 'ready') {
      return state;
    }

    return {
      ...state,
      [action.kind]: {
        status: 'loading',
        database: null,
        error: ''
      }
    };
  }

  if (action.type === 'success') {
    if (current.status === 'ready' && current.database === action.database && current.error === '') {
      return state;
    }

    return {
      ...state,
      [action.kind]: {
        status: 'ready',
        database: action.database,
        error: ''
      }
    };
  }

  if (current.status === 'error' && current.error === action.error) {
    return state;
  }

  return {
    ...state,
    [action.kind]: {
      status: 'error',
      database: null,
      error: action.error
    }
  };
}

export function ResourceDatabaseProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(resourceDatabaseReducer, undefined, createInitialResourceDatabaseState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const dispatchIfMounted = useCallback(
    (action: ResourceDatabaseAction) => {
      if (isMountedRef.current) {
        dispatch(action);
      }
    },
    [dispatch]
  );

  const ensureDatabase = useCallback((kind: ResourceKind) => {
    const cacheEntry = getResourceDatabaseCacheEntry(kind);

    if (cacheEntry.snapshot) {
      dispatchIfMounted({ type: 'success', kind, database: cacheEntry.snapshot });
      return Promise.resolve(cacheEntry.snapshot);
    }

    dispatchIfMounted({ type: 'request', kind });

    return getResourceDatabasePromise(kind)
      .then((database) => {
        dispatchIfMounted({ type: 'success', kind, database });
        return database;
      })
      .catch((error: unknown) => {
        dispatchIfMounted({
          type: 'failure',
          kind,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      });
  }, [dispatchIfMounted]);

  const contextValue = useMemo(
    () => ({
      state,
      ensureDatabase
    }),
    [ensureDatabase, state]
  );

  return createElement(ResourceDatabaseContext.Provider, { value: contextValue }, children);
}

export function useResourceDatabase(kind: ResourceKind): ResourceDatabaseSliceState {
  const context = useContext(ResourceDatabaseContext);

  if (!context) {
    throw new Error('useResourceDatabase must be used within ResourceDatabaseProvider');
  }

  const { state, ensureDatabase } = context;
  const slice = state[kind];

  useEffect(() => {
    void ensureDatabase(kind);
  }, [ensureDatabase, kind]);

  return slice;
}

export function usePreloadResourceDatabase(kind: ResourceKind): void {
  const context = useContext(ResourceDatabaseContext);

  if (!context) {
    throw new Error('usePreloadResourceDatabase must be used within ResourceDatabaseProvider');
  }

  const { ensureDatabase } = context;

  useEffect(() => {
    void ensureDatabase(kind);
  }, [ensureDatabase, kind]);
}

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

function createResourceDatabaseSnapshot(records: ResourceRecord[]): ResourceDatabaseEntry {
  return {
    records,
    index: createResourceIndex(records)
  };
}

function getResourceDatabasePromise(kind: ResourceKind): Promise<ResourceDatabaseEntry> {
  const cacheEntry = getResourceDatabaseCacheEntry(kind);

  if (cacheEntry.snapshot) {
    return Promise.resolve(cacheEntry.snapshot);
  }

  if (!cacheEntry.pending) {
    cacheEntry.pending = fetchResourceDatabase(kind)
      .then((records) => {
        const snapshot = createResourceDatabaseSnapshot(records);
        cacheEntry.snapshot = snapshot;
        cacheEntry.pending = null;
        return snapshot;
      })
      .catch((error) => {
        cacheEntry.pending = null;
        throw error;
      });
  }

  return cacheEntry.pending;
}

export async function loadResourceDatabase(kind: ResourceKind): Promise<ResourceDatabaseEntry> {
  return getResourceDatabasePromise(kind);
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
