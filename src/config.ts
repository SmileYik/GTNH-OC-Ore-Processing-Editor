import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode
} from 'react';

export interface Config {
  lang: LanguageConfig;
  database: DatabaseConfig;
}

export interface LanguageConfig {
  /**
   * 游戏中使用的语言
   */
  game: string;

  /**
   * 你要展示的语言
   */
  display: string;
}

export interface DatabaseConfig {
  /**
   * 自动加载流体数据库
   */
  autoLoadFluids: boolean;

  /**
   * 自动加载物品数据库
   */
  autoLoadItems: boolean;
}

export const CONFIG_LANGUAGE_OPTIONS = [
  { value: 'zh_CN', label: '简体中文' },
  { value: 'en_US', label: 'English (US)' }
] as const;

export type ConfigLanguageValue = (typeof CONFIG_LANGUAGE_OPTIONS)[number]['value'];
const DEFAULT_LANGUAGE: ConfigLanguageValue = CONFIG_LANGUAGE_OPTIONS[0].value;

export const CONFIG_STORAGE_KEY = 'oc-ore-processing-editor.user-config.v1';

export const DEFAULT_CONFIG: Config = {
  lang: {
    game: DEFAULT_LANGUAGE,
    display: DEFAULT_LANGUAGE
  },
  database: {
    autoLoadFluids: false,
    autoLoadItems: false
  }
};

export type ConfigAction =
  | {
      type: 'replace';
      payload: Config;
    }
  | {
      type: 'reset';
    };

const ConfigStateContext = createContext<Config | null>(null);
const ConfigDispatchContext = createContext<Dispatch<ConfigAction> | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return fallback;
}

function normalizeLanguageValue(value: unknown, fallback: ConfigLanguageValue): ConfigLanguageValue {
  const normalized = normalizeString(value, fallback);
  return CONFIG_LANGUAGE_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as ConfigLanguageValue)
    : fallback;
}

export function cloneConfig(config: Config): Config {
  return {
    lang: {
      game: config.lang.game,
      display: config.lang.display
    },
    database: {
      autoLoadFluids: config.database.autoLoadFluids,
      autoLoadItems: config.database.autoLoadItems
    }
  };
}

export function createDefaultConfig(): Config {
  return cloneConfig(DEFAULT_CONFIG);
}

export function normalizeConfig(value: unknown): Config {
  const source = isRecord(value) ? value : {};
  const langSource = isRecord(source.lang) ? source.lang : {};
  const databaseSource = isRecord(source.database) ? source.database : {};

  return {
    lang: {
      game: normalizeLanguageValue(langSource.game, DEFAULT_LANGUAGE),
      display: normalizeLanguageValue(langSource.display, DEFAULT_LANGUAGE)
    },
    database: {
      autoLoadFluids: normalizeBoolean(databaseSource.autoLoadFluids, DEFAULT_CONFIG.database.autoLoadFluids),
      autoLoadItems: normalizeBoolean(databaseSource.autoLoadItems, DEFAULT_CONFIG.database.autoLoadItems)
    }
  };
}

export function serializeConfig(config: Config): string {
  return JSON.stringify(normalizeConfig(config), null, 2);
}

export function parseConfig(text: string): Config {
  return normalizeConfig(JSON.parse(text));
}

export function configReducer(state: Config, action: ConfigAction): Config {
  if (action.type === 'reset') {
    return createDefaultConfig();
  }

  return normalizeConfig(action.payload);
}

function loadStoredConfig(): Config {
  if (typeof window === 'undefined') {
    return createDefaultConfig();
  }

  const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!raw) {
    return createDefaultConfig();
  }

  try {
    return parseConfig(raw);
  } catch {
    try {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }

    return createDefaultConfig();
  }
}

function saveStoredConfig(config: Config): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, serializeConfig(config));
  } catch {
    // LocalStorage may be unavailable in some private modes.
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, dispatch] = useReducer(configReducer, undefined, loadStoredConfig);

  useEffect(() => {
    saveStoredConfig(config);
  }, [config]);

  return createElement(
    ConfigStateContext.Provider,
    { value: config },
    createElement(ConfigDispatchContext.Provider, { value: dispatch }, children)
  );
}

export function useConfig(): Config {
  const config = useContext(ConfigStateContext);

  if (!config) {
    throw new Error('useConfig must be used within ConfigProvider');
  }

  return config;
}

export function useConfigDispatch(): Dispatch<ConfigAction> {
  const dispatch = useContext(ConfigDispatchContext);

  if (!dispatch) {
    throw new Error('useConfigDispatch must be used within ConfigProvider');
  }

  return dispatch;
}
