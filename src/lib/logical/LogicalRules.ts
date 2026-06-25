import type { ReactNode } from 'react';
import { LOGICAL_COMMAND_DEFINITIONS } from './commands';
import { peekAndFindResourceRecord, ResourceKind } from '../resourceDatabase';
import { Config, LanguageConfig, loadConfig } from '../../config';

export const LOGICAL_COMMAND_NAME_PATTERN = /^[a-zA-Z0-9_%\-]+$/;

export type LogicalOperator = '&&' | '||' | '!';
export type LogicalParen = '(' | ')';

export interface LogicalCommandArgsFieldProps {
  value: string;
  onChange: (nextValue: string) => void;
  userConfig: Config;
}

export interface LogicalCommandDefinition {
  name: string;
  label: string;
  aliases: string[];
  category: string;
  description: string;
  argsLabel: string;
  argsPlaceholder: string;
  argsHint: string;
  renderArgsField: (props: LogicalCommandArgsFieldProps) => ReactNode;
}

export interface LogicalCommandSnapshot {
  name: string;
  args: string;
}

export interface LogicalExpressionCommandToken extends LogicalCommandSnapshot {
  id: string;
  type: 'command';
  cacheId?: string;
}

export interface LogicalExpressionOperatorToken {
  id: string;
  type: 'operator';
  value: LogicalOperator;
}

export interface LogicalExpressionParenToken {
  id: string;
  type: 'paren';
  value: LogicalParen;
}

export type LogicalExpressionToken =
  | LogicalExpressionCommandToken
  | LogicalExpressionOperatorToken
  | LogicalExpressionParenToken;

export type LogicalExpressionLexToken =
  | { type: 'command'; name: string; args: string }
  | { type: 'operator'; value: LogicalOperator }
  | { type: 'paren'; value: LogicalParen };

export interface LogicalCommandCacheEntry extends LogicalCommandSnapshot {
  id: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LogicalCommandCacheState {
  maxItems: number;
  items: LogicalCommandCacheEntry[];
}

export interface LogicalCommandCacheOptions {
  id?: string;
  pinned?: boolean;
}

export const DEFAULT_LOGICAL_COMMAND_CACHE_LIMIT = 24;
export const LOGICAL_COMMAND_CACHE_STORAGE_KEY = 'oc-ore-processing-editor.logical-command-cache.v1';

export { LOGICAL_COMMAND_DEFINITIONS };

const LOGICAL_COMMAND_BY_NAME = new Map<string, LogicalCommandDefinition>();
const LOGICAL_COMMAND_OPTIONS: Array<{ value: string; label: string; description: string }> = [];

for (const definition of LOGICAL_COMMAND_DEFINITIONS) {
  LOGICAL_COMMAND_BY_NAME.set(definition.name, definition);
  LOGICAL_COMMAND_OPTIONS.push({
    value: definition.name,
    label: `${definition.label} (${definition.name})`,
    description: definition.description
  });

  for (const alias of definition.aliases) {
    LOGICAL_COMMAND_BY_NAME.set(alias, definition);
    LOGICAL_COMMAND_OPTIONS.push({
      value: alias,
      label: `${definition.label} (${alias})`,
      description: definition.description
    });
  }
}

function createTokenId(prefix: string = 'logical'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function toLogicalCommandName(name: string): string {
  const trimmed = name.trim();
  const resolved = LOGICAL_COMMAND_BY_NAME.get(trimmed);
  return resolved ? resolved.name : trimmed;
}

function compactArgs(args: string): string {
  return args.trim().replace(/\s+/g, ' ');
}

function isLogicalCommandToken(token: LogicalExpressionToken | LogicalExpressionLexToken): token is LogicalExpressionCommandToken {
  return token.type === 'command' && 'id' in token;
}

export function getLogicalCommandDefinition(name: string): LogicalCommandDefinition | null {
  const resolved = LOGICAL_COMMAND_BY_NAME.get(name.trim());
  return resolved ?? null;
}

export function getLogicalCommandDefinitionsByCategory(): Array<{ category: string; items: LogicalCommandDefinition[] }> {
  const categories = new Map<string, LogicalCommandDefinition[]>();

  for (const definition of LOGICAL_COMMAND_DEFINITIONS) {
    const list = categories.get(definition.category) ?? [];
    list.push(definition);
    categories.set(definition.category, list);
  }

  return Array.from(categories.entries()).map(([category, items]) => ({ category, items }));
}

export function getLogicalCommandOptions() {
  return [...LOGICAL_COMMAND_OPTIONS];
}

export function getLogicalCommandNameOptions(name: string): Array<{ value: string; label: string }> {
  const definition = getLogicalCommandDefinition(name);
  if (!definition) {
    const trimmed = name.trim();
    return trimmed ? [{ value: trimmed, label: trimmed }] : [];
  }

  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  for (const value of [definition.name, ...definition.aliases]) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    options.push({
      value: normalized,
      label: normalized === definition.name ? `${normalized}` : `${normalized}`
    });
  }

  return options;
}

export function normalizeLogicalCommandName(name: string): string {
  return toLogicalCommandName(name);
}

export function createLogicalCommandToken(name: string, args: string = '', cacheId?: string): LogicalExpressionCommandToken {
  return {
    id: createTokenId('cmd'),
    type: 'command',
    name: name.trim(),
    args,
    cacheId
  };
}

export function createLogicalOperatorToken(value: LogicalOperator): LogicalExpressionOperatorToken {
  return {
    id: createTokenId('op'),
    type: 'operator',
    value
  };
}

export function createLogicalParenToken(value: LogicalParen): LogicalExpressionParenToken {
  return {
    id: createTokenId('par'),
    type: 'paren',
    value
  };
}

export function cloneLogicalExpressionToken(token: LogicalExpressionToken): LogicalExpressionToken {
  if (token.type === 'command') {
    return {
      ...token
    };
  }

  return {
    ...token
  };
}

export function cloneLogicalExpressionTokens(tokens: LogicalExpressionToken[]): LogicalExpressionToken[] {
  return tokens.map((token) => cloneLogicalExpressionToken(token));
}

export function formatLogicalCommandSnapshot(snapshot: LogicalCommandSnapshot, langConfig: LanguageConfig): string {
  const definition = getLogicalCommandDefinition(snapshot.name);
  const label = definition?.label ?? snapshot.name;

  let queriedArgs = null;
  if (definition) {
    const name = snapshot.args.split(/>=|<=|==|~=|!=|>|</)[0].trim();
    let kind: ResourceKind = 'item';
    let isKey = true;
    if ('check-item|mark-item'.includes(definition.name)) {
      kind = 'item';
    } else if ('check-item-label'.includes(definition.name)) {
      kind = 'item';
      isKey = false;
    } else if ('check-fluid|mark-fluid'.includes(definition.name)) {
      kind = 'fluid'
    }
    const record = peekAndFindResourceRecord(kind, isKey, name, langConfig);
    if (record) {
      queriedArgs = snapshot.args.replace(name, record.localizedName)
    }
  }
  
  const args = queriedArgs || compactArgs(snapshot.args);
  if (!args) {
    return label;
  }

  return `${label} · ${args.length > 42 ? `${args.slice(0, 42)}…` : args}`;
}

export function formatLogicalCommandTooltip(snapshot: LogicalCommandSnapshot): string {
  const definition = getLogicalCommandDefinition(snapshot.name);
  const lines = [
    `命令: ${definition?.name ?? snapshot.name}`,
    definition ? `别名: ${definition.aliases.join(', ') || '无'}` : '别名: 无',
    `参数: ${snapshot.args || '（空）'}`
  ];
  if (definition) {
    lines.push(`说明: ${definition.description}`);
  }
  return lines.join('\n');
}

export function serializeLogicalExpressionToken(token: LogicalExpressionLexToken | LogicalExpressionToken): string {
  if (token.type === 'command') {
    return `{${token.name}: ${token.args.trim()}}`;
  }

  return token.value;
}

export function serializeLogicalExpression(tokens: Array<LogicalExpressionLexToken | LogicalExpressionToken>): string {
  return tokens.map((token) => serializeLogicalExpressionToken(token)).join(' ');
}

export function lexLogicalExpression(rule: string): LogicalExpressionLexToken[] {
  const tokens: LogicalExpressionLexToken[] = [];
  let index = 0;

  while (index < rule.length) {
    const char = rule[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(' || char === ')' || char === '!') {
      if (char === '!') {
        tokens.push({ type: 'operator', value: '!' });
      } else {
        tokens.push({ type: 'paren', value: char });
      }
      index += 1;
      continue;
    }

    if (rule.slice(index, index + 2) === '&&') {
      tokens.push({ type: 'operator', value: '&&' });
      index += 2;
      continue;
    }

    if (rule.slice(index, index + 2) === '||') {
      tokens.push({ type: 'operator', value: '||' });
      index += 2;
      continue;
    }

    if (char === '{') {
      const closeIndex = rule.indexOf('}', index + 1);
      if (closeIndex < 0) {
        throw new Error("语法错误：缺少闭合括号 '}'");
      }

      const content = rule.slice(index + 1, closeIndex);
      const match = content.match(/^\s*([a-zA-Z0-9_%\-]+)\s*:(.*)$/);
      if (!match) {
        throw new Error(`语法错误：命令项格式不正确 {${content}}`);
      }

      tokens.push({
        type: 'command',
        name: normalizeLogicalCommandName(match[1]),
        args: match[2]
      });
      index = closeIndex + 1;
      continue;
    }

    throw new Error(`语法错误：未知的字符 '${char}'`);
  }

  return tokens;
}

function validateLogicalExpressionTokens(tokens: LogicalExpressionLexToken[]): void {
  let index = 0;

  const peek = () => tokens[index];
  const consume = () => {
    const token = tokens[index];
    index += 1;
    return token;
  };

  const parseExpression = () => parseOr();

  const parseOr = () => {
    parseAnd();
    while (true) {
      const next = peek();
      if (!next || next.type !== 'operator' || next.value !== '||') {
        break;
      }

      consume();
      parseAnd();
    }
  };

  const parseAnd = () => {
    parseNot();
    while (true) {
      const next = peek();
      if (!next || next.type !== 'operator' || next.value !== '&&') {
        break;
      }

      consume();
      parseNot();
    }
  };

  const parseNot = () => {
    const next = peek();
    if (next && next.type === 'operator' && next.value === '!') {
      consume();
      parseNot();
      return;
    }

    parsePrimary();
  };

  const parsePrimary = () => {
    const token = peek();
    if (!token) {
      throw new Error('语法错误：表达式意外结束');
    }

    if (token.type === 'paren' && token.value === '(') {
      consume();
      parseExpression();
      const close = consume();
      if (!close || close.type !== 'paren' || close.value !== ')') {
        throw new Error("语法错误：缺少右括号 ')'");
      }
      return;
    }

    if (token.type === 'command') {
      consume();
      return;
    }

    throw new Error(`语法错误：不期望的 Token '${token.value}'`);
  };

  parseExpression();

  if (index < tokens.length) {
    throw new Error('语法错误：表达式尾部存在多余字符');
  }
}

export function validateLogicalExpression(rule: string): void {
  const tokens = lexLogicalExpression(rule);
  validateLogicalExpressionTokens(tokens);
}

export function materializeLogicalExpressionTokens(tokens: LogicalExpressionLexToken[]): LogicalExpressionToken[] {
  return tokens.map((token) => {
    if (token.type === 'command') {
      return createLogicalCommandToken(token.name, token.args);
    }

    if (token.type === 'operator') {
      return createLogicalOperatorToken(token.value);
    }

    return createLogicalParenToken(token.value);
  });
}

export function isLogicalCommandExpressionToken(token: LogicalExpressionToken): token is LogicalExpressionCommandToken {
  return isLogicalCommandToken(token);
}

export function createLogicalCommandCacheEntry(
  snapshot: LogicalCommandSnapshot,
  options: LogicalCommandCacheOptions = {}
): LogicalCommandCacheEntry {
  const now = Date.now();
  return {
    id: options.id ?? createTokenId('cache'),
    name: normalizeLogicalCommandName(snapshot.name),
    args: snapshot.args,
    pinned: Boolean(options.pinned),
    createdAt: now,
    updatedAt: now
  };
}

export function formatLogicalCommandCacheItem(entry: LogicalCommandCacheEntry, langConfig: LanguageConfig): string {
  return formatLogicalCommandSnapshot(entry, langConfig);
}

export function cloneLogicalCommandCacheEntry(entry: LogicalCommandCacheEntry): LogicalCommandCacheEntry {
  return {
    id: entry.id,
    name: normalizeLogicalCommandName(entry.name),
    args: entry.args,
    pinned: entry.pinned,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function sortLogicalCommandCacheItems(items: LogicalCommandCacheEntry[]): LogicalCommandCacheEntry[] {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return right.createdAt - left.createdAt;
  });
}

function trimLogicalCommandCacheItems(items: LogicalCommandCacheEntry[], maxItems: number): LogicalCommandCacheEntry[] {
  if (maxItems < 0) {
    maxItems = 0;
  }

  const pinned = items.filter((item) => item.pinned);
  const unpinned = items.filter((item) => !item.pinned);

  if (maxItems === 0) {
    return sortLogicalCommandCacheItems(pinned);
  }

  const sortedUnpinned = [...unpinned].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return right.createdAt - left.createdAt;
  });

  const keptUnpinned = sortedUnpinned.slice(0, maxItems);
  return sortLogicalCommandCacheItems([...pinned, ...keptUnpinned]);
}

export function normalizeLogicalCommandCacheState(
  state: Partial<LogicalCommandCacheState> | null | undefined
): LogicalCommandCacheState {
  const maxItemsRaw = state?.maxItems;
  const maxItems =
    typeof maxItemsRaw === 'number' && Number.isFinite(maxItemsRaw)
      ? Math.max(0, Math.floor(maxItemsRaw))
      : DEFAULT_LOGICAL_COMMAND_CACHE_LIMIT;
  const rawItems: Array<Partial<LogicalCommandCacheEntry>> = Array.isArray(state?.items)
    ? (state.items as Array<Partial<LogicalCommandCacheEntry>>)
    : [];
  const items = rawItems
    .filter((item) => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: String(item.id ?? createTokenId('cache')),
      name: normalizeLogicalCommandName(String(item.name ?? '')),
      args: String(item.args ?? ''),
      pinned: Boolean(item.pinned),
      createdAt:
        typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
      updatedAt:
        typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now()
    }))
    .filter((item) => Boolean(item.name));
  const dedupedItems: LogicalCommandCacheEntry[] = [];
  const seen = new Set<string>();

  for (const item of sortLogicalCommandCacheItems(items)) {
    const key = `${item.name}\u0000${item.args}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedItems.push(item);
  }

  return {
    maxItems,
    items: trimLogicalCommandCacheItems(dedupedItems, maxItems)
  };
}

export function loadLogicalCommandCacheState(): LogicalCommandCacheState {
  if (typeof window === 'undefined') {
    return normalizeLogicalCommandCacheState(null);
  }

  try {
    const raw = window.localStorage.getItem(LOGICAL_COMMAND_CACHE_STORAGE_KEY);
    if (!raw) {
      return normalizeLogicalCommandCacheState(null);
    }

    return normalizeLogicalCommandCacheState(JSON.parse(raw) as Partial<LogicalCommandCacheState>);
  } catch {
    return normalizeLogicalCommandCacheState(null);
  }
}

export function saveLogicalCommandCacheState(state: LogicalCommandCacheState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOGICAL_COMMAND_CACHE_STORAGE_KEY, JSON.stringify(normalizeLogicalCommandCacheState(state)));
}

export function setLogicalCommandCacheLimit(
  state: LogicalCommandCacheState,
  maxItems: number
): LogicalCommandCacheState {
  return normalizeLogicalCommandCacheState({
    ...state,
    maxItems
  });
}

export function findLogicalCommandCacheEntry(
  state: LogicalCommandCacheState,
  id: string
): LogicalCommandCacheEntry | null {
  return state.items.find((entry) => entry.id === id) ?? null;
}

export function findLogicalCommandCacheEntryBySnapshot(
  state: LogicalCommandCacheState,
  snapshot: LogicalCommandSnapshot
): LogicalCommandCacheEntry | null {
  const normalizedName = normalizeLogicalCommandName(snapshot.name);
  return (
    state.items.find((entry) => entry.name === normalizedName && entry.args === snapshot.args) ?? null
  );
}

export function upsertLogicalCommandCacheEntry(
  state: LogicalCommandCacheState,
  entry: LogicalCommandCacheEntry
): LogicalCommandCacheState {
  const now = Date.now();
  const normalizedName = normalizeLogicalCommandName(entry.name);
  const existingById = state.items.find((item) => item.id === entry.id) ?? null;
  const existingBySnapshot =
    state.items.find((item) => item.name === normalizedName && item.args === entry.args) ?? null;
  const target = existingBySnapshot ?? existingById;
  const targetId = target?.id ?? entry.id;
  const nextItems = state.items.filter(
    (item) =>
      item.id !== targetId &&
      !(item.name === normalizedName && item.args === entry.args)
  );

  nextItems.unshift({
    id: targetId,
    name: normalizedName,
    args: entry.args,
    pinned: target ? target.pinned : entry.pinned,
    createdAt: target?.createdAt ?? entry.createdAt ?? now,
    updatedAt: now
  });

  return normalizeLogicalCommandCacheState({
    ...state,
    items: nextItems
  });
}

export function upsertLogicalCommandCacheSnapshot(
  state: LogicalCommandCacheState,
  snapshot: LogicalCommandSnapshot,
  options: LogicalCommandCacheOptions = {}
): { state: LogicalCommandCacheState; id: string } {
  const normalizedName = normalizeLogicalCommandName(snapshot.name);
  const existingBySnapshot = findLogicalCommandCacheEntryBySnapshot(state, snapshot);
  const existingById = options.id ? findLogicalCommandCacheEntry(state, options.id) : null;
  const target = existingBySnapshot ?? existingById;
  const targetId = target?.id ?? options.id ?? createTokenId('cache');

  const nextState = upsertLogicalCommandCacheEntry(state, {
    id: targetId,
    name: normalizedName,
    args: snapshot.args,
    pinned: target?.pinned ?? Boolean(options.pinned),
    createdAt: target?.createdAt ?? Date.now(),
    updatedAt: target?.updatedAt ?? Date.now()
  });

  return {
    state: nextState,
    id: findLogicalCommandCacheEntryBySnapshot(nextState, snapshot)?.id ?? targetId
  };
}

export function deleteLogicalCommandCacheEntry(
  state: LogicalCommandCacheState,
  id: string
): LogicalCommandCacheState {
  return normalizeLogicalCommandCacheState({
    ...state,
    items: state.items.filter((entry) => entry.id !== id)
  });
}

export function toggleLogicalCommandCachePin(
  state: LogicalCommandCacheState,
  id: string
): LogicalCommandCacheState {
  const nextItems = state.items.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          pinned: !entry.pinned,
          updatedAt: Date.now()
        }
      : entry
  );

  return normalizeLogicalCommandCacheState({
    ...state,
    items: nextItems
  });
}

export function createLogicalCommandCacheFromToken(
  token: LogicalExpressionCommandToken,
  options: LogicalCommandCacheOptions = {}
): LogicalCommandCacheEntry {
  return createLogicalCommandCacheEntry(
    {
      name: token.name,
      args: token.args
    },
    options
  );
}

export function formatLogicalCommandCacheLabel(entry: LogicalCommandCacheEntry, langConfig: LanguageConfig): string {
  return formatLogicalCommandSnapshot(entry, langConfig);
}
