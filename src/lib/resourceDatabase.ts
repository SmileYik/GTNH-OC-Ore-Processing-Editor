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
export type ResourceLocale = 'zh_CN' | 'en_US';

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

export const RESOURCE_LOCALE_OPTIONS: Array<{ value: ResourceLocale; label: string }> = [
  { value: 'zh_CN', label: '简体中文' },
  { value: 'en_US', label: 'English (US)' }
];

export const DEFAULT_RESOURCE_LOCALE: ResourceLocale = 'zh_CN';

const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  item: '物品',
  fluid: '流体'
};

const RESOURCE_LOCALE_LABELS: Record<ResourceLocale, string> = {
  zh_CN: '简体中文',
  en_US: 'English (US)'
};

const RESOURCE_LOCALE_SET = new Set<ResourceLocale>(RESOURCE_LOCALE_OPTIONS.map((option) => option.value));

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
  [locale: string]: ResourceDatabaseLocaleState;
}

interface ResourceDatabaseLocaleState {
  item: ResourceDatabaseSliceState;
  fluid: ResourceDatabaseSliceState;
}

type ResourceDatabaseAction =
  | { type: 'request'; locale: ResourceLocale; kind: ResourceKind }
  | { type: 'success'; locale: ResourceLocale; kind: ResourceKind; database: ResourceDatabaseEntry }
  | { type: 'failure'; locale: ResourceLocale; kind: ResourceKind; error: string };

interface ResourceDatabaseContextValue {
  state: ResourceDatabaseState;
  ensureDatabase: (kind: ResourceKind, locale?: ResourceLocale) => Promise<ResourceDatabaseEntry>;
}

const ResourceDatabaseContext = createContext<ResourceDatabaseContextValue | null>(null);

interface ResourceDatabaseCacheEntry {
  pending: Promise<ResourceDatabaseEntry> | null;
  snapshot: ResourceDatabaseEntry | null;
}

const resourceDatabaseCache = new Map<ResourceLocale, Map<ResourceKind, ResourceDatabaseCacheEntry>>();

function normalizeResourceLocale(locale: string | undefined): ResourceLocale {
  const compactLocale = (locale ?? DEFAULT_RESOURCE_LOCALE).trim().replace('-', '_') as ResourceLocale;
  return RESOURCE_LOCALE_SET.has(compactLocale) ? compactLocale : DEFAULT_RESOURCE_LOCALE;
}

export function getResourceLocaleLabel(locale: string): string {
  const normalizedLocale = normalizeResourceLocale(locale);
  return RESOURCE_LOCALE_LABELS[normalizedLocale];
}

function createResourceDatabaseSlice(locale: ResourceLocale, kind: ResourceKind): ResourceDatabaseSliceState {
  const snapshot = peekResourceDatabase(kind, locale);

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

function createEmptyResourceDatabaseLocaleState(locale: ResourceLocale): ResourceDatabaseLocaleState {
  return {
    item: createResourceDatabaseSlice(locale, 'item'),
    fluid: createResourceDatabaseSlice(locale, 'fluid')
  };
}

function createInitialResourceDatabaseState(): ResourceDatabaseState {
  const nextState: ResourceDatabaseState = {};

  for (const [locale] of resourceDatabaseCache.entries()) {
    nextState[locale] = createEmptyResourceDatabaseLocaleState(locale);
  }

  return nextState;
}

function getResourceDatabaseLocaleState(
  state: ResourceDatabaseState,
  locale: ResourceLocale
): ResourceDatabaseLocaleState {
  return state[locale] ?? createEmptyResourceDatabaseLocaleState(locale);
}

function resourceDatabaseReducer(
  state: ResourceDatabaseState,
  action: ResourceDatabaseAction
): ResourceDatabaseState {
  const currentLocaleState = getResourceDatabaseLocaleState(state, action.locale);
  const current = currentLocaleState[action.kind];

  if (action.type === 'request') {
    if (current.status === 'loading' || current.status === 'ready') {
      return state;
    }

    return {
      ...state,
      [action.locale]: {
        ...currentLocaleState,
        [action.kind]: {
          status: 'loading',
          database: null,
          error: ''
        }
      }
    };
  }

  if (action.type === 'success') {
    if (current.status === 'ready' && current.database === action.database && current.error === '') {
      return state;
    }

    return {
      ...state,
      [action.locale]: {
        ...currentLocaleState,
        [action.kind]: {
          status: 'ready',
          database: action.database,
          error: ''
        }
      }
    };
  }

  if (current.status === 'error' && current.error === action.error) {
    return state;
  }

  return {
    ...state,
    [action.locale]: {
      ...currentLocaleState,
      [action.kind]: {
        status: 'error',
        database: null,
        error: action.error
      }
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

  const ensureDatabase = useCallback((kind: ResourceKind, locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE) => {
    const normalizedLocale = normalizeResourceLocale(locale);
    const cacheEntry = getResourceDatabaseCacheEntry(kind, normalizedLocale);

    if (cacheEntry.snapshot) {
      dispatchIfMounted({ type: 'success', locale: normalizedLocale, kind, database: cacheEntry.snapshot });
      return Promise.resolve(cacheEntry.snapshot);
    }

    dispatchIfMounted({ type: 'request', locale: normalizedLocale, kind });

    return getResourceDatabasePromise(kind, normalizedLocale)
      .then((database) => {
        dispatchIfMounted({ type: 'success', locale: normalizedLocale, kind, database });
        return database;
      })
      .catch((error: unknown) => {
        dispatchIfMounted({
          type: 'failure',
          locale: normalizedLocale,
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

export function useResourceDatabase(
  kind: ResourceKind,
  locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE
): ResourceDatabaseSliceState {
  return useResourceDatabaseWithLocale(kind, locale);
}

function useResourceDatabaseWithLocale(kind: ResourceKind, locale: ResourceLocale): ResourceDatabaseSliceState {
  const context = useContext(ResourceDatabaseContext);

  if (!context) {
    throw new Error('useResourceDatabase must be used within ResourceDatabaseProvider');
  }

  const { state, ensureDatabase } = context;
  const normalizedLocale = normalizeResourceLocale(locale);
  const slice = state[normalizedLocale]?.[kind] ?? createEmptyResourceDatabaseLocaleState(normalizedLocale)[kind];

  useEffect(() => {
    void ensureDatabase(kind, normalizedLocale);
  }, [ensureDatabase, kind, normalizedLocale]);

  return slice;
}

export function usePreloadResourceDatabase(
  kind: ResourceKind,
  locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE
): void {
  usePreloadResourceDatabaseWithLocale(kind, locale);
}

function usePreloadResourceDatabaseWithLocale(kind: ResourceKind, locale: ResourceLocale): void {
  const context = useContext(ResourceDatabaseContext);

  if (!context) {
    throw new Error('usePreloadResourceDatabase must be used within ResourceDatabaseProvider');
  }

  const { ensureDatabase } = context;
  const normalizedLocale = normalizeResourceLocale(locale);

  useEffect(() => {
    void ensureDatabase(kind, normalizedLocale);
  }, [ensureDatabase, kind, normalizedLocale]);
}

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    return '/';
  }

  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getResourceFileUrl(kind: ResourceKind, locale: ResourceLocale): string {
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL || '/');
  return `${baseUrl}static/database/${locale}/${RESOURCE_FILE_NAMES[kind]}`;
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

async function fetchResourceDatabase(kind: ResourceKind, locale: ResourceLocale): Promise<ResourceRecord[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const response = await fetch(getResourceFileUrl(kind, locale), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(
      `加载${RESOURCE_LOCALE_LABELS[locale]} ${RESOURCE_KIND_LABELS[kind]}数据库失败: ${response.status} ${response.statusText}`
    );
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

function getLocaleResourceDatabaseCache(locale: ResourceLocale): Map<ResourceKind, ResourceDatabaseCacheEntry> {
  let localeCache = resourceDatabaseCache.get(locale);
  if (!localeCache) {
    localeCache = new Map<ResourceKind, ResourceDatabaseCacheEntry>();
    resourceDatabaseCache.set(locale, localeCache);
  }

  return localeCache;
}

function getResourceDatabaseCacheEntry(kind: ResourceKind, locale: ResourceLocale): ResourceDatabaseCacheEntry {
  const localeCache = getLocaleResourceDatabaseCache(locale);
  let cacheEntry = localeCache.get(kind);
  if (!cacheEntry) {
    cacheEntry = {
      pending: null,
      snapshot: null
    };
    localeCache.set(kind, cacheEntry);
  }

  return cacheEntry;
}

function createResourceDatabaseSnapshot(records: ResourceRecord[]): ResourceDatabaseEntry {
  return {
    records,
    index: createResourceIndex(records)
  };
}

function getResourceDatabasePromise(kind: ResourceKind, locale: ResourceLocale): Promise<ResourceDatabaseEntry> {
  const cacheEntry = getResourceDatabaseCacheEntry(kind, locale);

  if (cacheEntry.snapshot) {
    return Promise.resolve(cacheEntry.snapshot);
  }

  if (!cacheEntry.pending) {
    cacheEntry.pending = fetchResourceDatabase(kind, locale)
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

export async function loadResourceDatabase(
  kind: ResourceKind,
  locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE
): Promise<ResourceDatabaseEntry> {
  return getResourceDatabasePromise(kind, normalizeResourceLocale(locale));
}

export function peekResourceDatabase(
  kind: ResourceKind,
  locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE
): ResourceDatabaseEntry | null {
  return getResourceDatabaseCacheEntry(kind, normalizeResourceLocale(locale)).snapshot;
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

function isResourceDatabaseEntry(
  value: readonly ResourceRecord[] | ResourceDatabaseEntry
): value is ResourceDatabaseEntry {
  return !Array.isArray(value);
}

export function findResourceRecord(
  records: readonly ResourceRecord[] | ResourceDatabaseEntry,
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

export async function loadResourceRecords(
  kind: ResourceKind,
  locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE
): Promise<ResourceRecord[]> {
  return loadResourceDatabase(kind, locale).then((database) => database.records);
}

export function peekResourceRecords(
  kind: ResourceKind,
  locale: ResourceLocale = DEFAULT_RESOURCE_LOCALE
): ResourceRecord[] | null {
  return peekResourceDatabase(kind, locale)?.records ?? null;
}
