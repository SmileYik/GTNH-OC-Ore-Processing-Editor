export interface RoleEntry {
  name: string;
  machine: string;
}

export interface InterfaceEntry {
  id: string;
  role: string;
}

export interface MineralProcess {
  mineral: string;
  steps: string[];
}

export interface FilterGroup {
  role: string;
  ids: string[];
}

export interface ConfigModel {
  roles: RoleEntry[];
  interfaces: InterfaceEntry[];
  processes: MineralProcess[];
  idWhitelist: FilterGroup[];
  idBlacklist: FilterGroup[];
}

export interface ProcessReverseGroup {
  signature: string;
  steps: string[];
  minerals: string[];
}

export interface SerializeLuaConfigOptions {
  compact?: boolean;
}

type LuaScalar = string | number | boolean | null;

interface LuaTable {
  fields: LuaField[];
}

interface LuaKeyedField {
  kind: 'keyed';
  key: string;
  value: LuaValue;
}

interface LuaArrayField {
  kind: 'array';
  value: LuaValue;
}

type LuaField = LuaKeyedField | LuaArrayField;
type LuaValue = LuaScalar | LuaTable;

export const EMPTY_CONFIG: ConfigModel = {
  roles: [],
  interfaces: [],
  processes: [],
  idWhitelist: [],
  idBlacklist: []
};

const LUA_KEYWORDS = new Set([
  'and',
  'break',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'goto',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while'
]);

function isLuaTable(value: LuaValue): value is LuaTable {
  return typeof value === 'object' && value !== null && 'fields' in value;
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function isIdentifierStart(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z_]/.test(char));
}

function isIdentifierPart(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z0-9_]/.test(char));
}

function isSafeIdentifier(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !LUA_KEYWORDS.has(key);
}

function escapeLuaString(value: string): string {
  let output = '';

  for (const char of value) {
    switch (char) {
      case '\\':
        output += '\\\\';
        break;
      case '"':
        output += '\\"';
        break;
      case '\n':
        output += '\\n';
        break;
      case '\r':
        output += '\\r';
        break;
      case '\t':
        output += '\\t';
        break;
      case '\b':
        output += '\\b';
        break;
      case '\f':
        output += '\\f';
        break;
      case '\v':
        output += '\\v';
        break;
      case '\0':
        output += '\\0';
        break;
      default:
        output += char;
        break;
    }
  }

  return `"${output}"`;
}

function formatLuaKey(key: string): string {
  return isSafeIdentifier(key) ? key : `[${escapeLuaString(key)}]`;
}

function stringValue(value: LuaValue): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'nil';
  }

  throw new Error('Expected a scalar Lua value');
}

function collectKeyedEntries(table: LuaTable): Array<{ key: string; value: LuaValue }> {
  return table.fields.flatMap((field) => (field.kind === 'keyed' ? [{ key: field.key, value: field.value }] : []));
}

function collectArrayValues(table: LuaTable): LuaValue[] {
  const arrayValues = table.fields.flatMap((field) => (field.kind === 'array' ? [field.value] : []));
  if (arrayValues.length > 0) {
    return arrayValues;
  }

  const numericEntries = collectKeyedEntries(table)
    .filter(({ key }) => Number.isInteger(Number(key)))
    .sort((left, right) => Number(left.key) - Number(right.key))
    .map(({ value }) => value);

  return numericEntries;
}

function collectStringArray(table: LuaTable): string[] {
  return collectArrayValues(table).map((value) => stringValue(value));
}

function collectStringSet(table: LuaTable): string[] {
  const values: string[] = [];

  for (const field of table.fields) {
    if (field.kind === 'keyed') {
      values.push(field.key);
      continue;
    }

    values.push(stringValue(field.value));
  }

  return values;
}

function renderArrayBlock(values: string[], level: number): string {
  if (values.length === 0) {
    return '{}';
  }

  const lines = values.map((value) => `${indent(level + 1)}${escapeLuaString(value)},`);
  return `{\n${lines.join('\n')}\n${indent(level)}}`;
}

function renderStringMap(
  entries: Array<{ key: string; value: string }> | Array<RoleEntry> | Array<InterfaceEntry>,
  level: number
): string {
  if (entries.length === 0) {
    return '{}';
  }

  const pairs = entries.map((entry) => {
    if ('key' in entry) {
      return { key: entry.key, value: entry.value };
    }

    if ('name' in entry) {
      return { key: entry.name, value: entry.machine };
    }

    return { key: entry.id, value: entry.role };
  });

  const lines = pairs.map((entry) => `${indent(level + 1)}${formatLuaKey(entry.key)} = ${escapeLuaString(entry.value)},`);
  return `{\n${lines.join('\n')}\n${indent(level)}}`;
}

function renderProcessMap(entries: MineralProcess[], level: number): string {
  if (entries.length === 0) {
    return '{}';
  }

  const lines: string[] = [];

  for (const entry of entries) {
    lines.push(
      `${indent(level + 1)}${formatLuaKey(entry.mineral)} = ${renderArrayBlock(entry.steps, level + 1)},`
    );
  }

  return `{\n${lines.join('\n')}\n${indent(level)}}`;
}

function renderFilterGroupMap(entries: FilterGroup[], level: number): string {
  if (entries.length === 0) {
    return '{}';
  }

  const lines: string[] = [];

  for (const entry of entries) {
    lines.push(
      `${indent(level + 1)}${formatLuaKey(entry.role)} = ${renderStringSetBlock(entry.ids, level + 1)},`
    );
  }

  return `{\n${lines.join('\n')}\n${indent(level)}}`;
}

function renderStringSetBlock(values: string[], level: number): string {
  if (values.length === 0) {
    return '{}';
  }

  const lines = values.map((value) => `${indent(level + 1)}${formatLuaKey(value)} = true,`);
  return `{\n${lines.join('\n')}\n${indent(level)}}`;
}

function renderProcessReverseMap(groups: ProcessReverseGroup[], level: number): string {
  if (groups.length === 0) {
    return '{}';
  }

  const lines: string[] = [];

  for (const group of groups) {
    lines.push(
      `${indent(level + 1)}${escapeLuaString(group.signature)} = ${renderArrayBlock(group.minerals, level + 1)},`
    );
  }

  return `{\n${lines.join('\n')}\n${indent(level)}}`;
}

function renderArrayInline(values: string[]): string {
  if (values.length === 0) {
    return '{}';
  }

  return `{${values.map((value) => escapeLuaString(value)).join(', ')}}`;
}

function renderStringMapInline(
  entries: Array<{ key: string; value: string }> | Array<RoleEntry> | Array<InterfaceEntry>
): string {
  if (entries.length === 0) {
    return '{}';
  }

  const pairs = entries.map((entry) => {
    if ('key' in entry) {
      return { key: entry.key, value: entry.value };
    }

    if ('name' in entry) {
      return { key: entry.name, value: entry.machine };
    }

    return { key: entry.id, value: entry.role };
  });

  return `{${pairs.map((entry) => `${formatLuaKey(entry.key)}=${escapeLuaString(entry.value)}`).join(', ')}}`;
}

function renderStringSetInline(values: string[]): string {
  if (values.length === 0) {
    return '{}';
  }

  return `{${values.map((value) => `${formatLuaKey(value)}=true`).join(', ')}}`;
}

function renderProcessMapInline(entries: MineralProcess[]): string {
  if (entries.length === 0) {
    return '{}';
  }

  return `{${entries
    .map((entry) => `${formatLuaKey(entry.mineral)}=${renderArrayInline(entry.steps)}`)
    .join(', ')}}`;
}

function renderFilterGroupMapInline(entries: FilterGroup[]): string {
  if (entries.length === 0) {
    return '{}';
  }

  return `{${entries
    .map((entry) => `${formatLuaKey(entry.role)}=${renderStringSetInline(entry.ids)}`)
    .join(', ')}}`;
}

function renderProcessReverseMapInline(groups: ProcessReverseGroup[]): string {
  if (groups.length === 0) {
    return '{}';
  }

  return `{${groups
    .map((group) => `${escapeLuaString(group.signature)}=${renderArrayInline(group.minerals)}`)
    .join(', ')}}`;
}

function tableFieldLookup(table: LuaTable): Map<string, LuaValue> {
  const lookup = new Map<string, LuaValue>();

  for (const field of table.fields) {
    if (field.kind === 'keyed') {
      lookup.set(field.key, field.value);
    }
  }

  return lookup;
}

function getTableValue(lookup: Map<string, LuaValue>, key: string): LuaTable | undefined {
  const value = lookup.get(key);
  if (isLuaTable(value)) {
    return value;
  }

  return undefined;
}

function parseTableToConfig(root: LuaTable): ConfigModel {
  const lookup = tableFieldLookup(root);

  const roleTable = getTableValue(lookup, 'role');
  const interfaceTable = getTableValue(lookup, 'interfaces');
  const processTable = getTableValue(lookup, 'process');
  const whitelistTable = getTableValue(lookup, 'idWhitelist');
  const blacklistTable = getTableValue(lookup, 'idBlacklist');

  const roles = roleTable
    ? collectKeyedEntries(roleTable).map(({ key, value }) => ({ name: key, machine: stringValue(value) }))
    : [];

  const interfaces = interfaceTable
    ? collectKeyedEntries(interfaceTable).map(({ key, value }) => ({ id: key, role: stringValue(value) }))
    : [];

  const processes = processTable
    ? collectKeyedEntries(processTable).map(({ key, value }) => ({
        mineral: key,
        steps: isLuaTable(value) ? collectStringArray(value) : [stringValue(value)]
      }))
    : [];

  const idWhitelist = whitelistTable
    ? collectKeyedEntries(whitelistTable).map(({ key, value }) => ({
        role: key,
        ids: isLuaTable(value) ? collectStringSet(value) : [stringValue(value)]
      }))
    : [];

  const idBlacklist = blacklistTable
    ? collectKeyedEntries(blacklistTable).map(({ key, value }) => ({
        role: key,
        ids: isLuaTable(value) ? collectStringSet(value) : [stringValue(value)]
      }))
    : [];

  return {
    roles,
    interfaces,
    processes,
    idWhitelist,
    idBlacklist
  };
}

class LuaParser {
  private index = 0;

  private line = 1;

  private column = 1;

  constructor(private readonly text: string) {}

  parse(): LuaTable {
    this.skipWhitespaceAndComments();

    if (this.matchKeyword('return')) {
      this.skipWhitespaceAndComments();
    }

    const value = this.parseValue();
    if (!isLuaTable(value)) {
      throw this.error('根节点必须是一个 Lua table');
    }

    this.skipWhitespaceAndComments();
    if (!this.isEOF()) {
      throw this.error('根节点后存在无法识别的内容');
    }

    return value;
  }

  private parseValue(): LuaValue {
    this.skipWhitespaceAndComments();

    const char = this.peek();
    if (!char) {
      throw this.error('意外结束');
    }

    if (char === '{') {
      return this.parseTable();
    }

    if (char === '"' || char === "'") {
      return this.parseString();
    }

    if (char === '-' || this.isDigit(char)) {
      return this.parseNumber();
    }

    if (isIdentifierStart(char)) {
      const identifier = this.parseIdentifier();
      if (identifier === 'true') {
        return true;
      }
      if (identifier === 'false') {
        return false;
      }
      if (identifier === 'nil') {
        return null;
      }
      return identifier;
    }

    throw this.error(`无法解析的字符: ${char}`);
  }

  private parseTable(): LuaTable {
    this.expect('{');
    const fields: LuaField[] = [];

    this.skipWhitespaceAndComments();

    while (!this.peekIs('}')) {
      this.skipWhitespaceAndComments();

      if (this.peekIs('}')) {
        break;
      }

      let field: LuaField;

      if (this.peekIs('[')) {
        this.advance();
        const keyValue = this.parseValue();
        if (isLuaTable(keyValue) || keyValue === null) {
          throw this.error('方括号键必须是字符串、数字或布尔值');
        }

        this.skipWhitespaceAndComments();
        this.expect(']');
        this.skipWhitespaceAndComments();
        this.expect('=');
        const value = this.parseValue();
        field = {
          kind: 'keyed',
          key: String(keyValue),
          value
        };
      } else if (isIdentifierStart(this.peek())) {
        const startState = {
          index: this.index,
          line: this.line,
          column: this.column
        };
        const identifier = this.parseIdentifier();
        this.skipWhitespaceAndComments();

        if (this.peekIs('=')) {
          this.advance();
          const value = this.parseValue();
          field = {
            kind: 'keyed',
            key: identifier,
            value
          };
        } else {
          this.index = startState.index;
          this.line = startState.line;
          this.column = startState.column;
          field = {
            kind: 'array',
            value: this.parseValue()
          };
        }
      } else {
        field = {
          kind: 'array',
          value: this.parseValue()
        };
      }

      fields.push(field);
      this.skipWhitespaceAndComments();

      if (this.peekIs(',') || this.peekIs(';')) {
        this.advance();
        this.skipWhitespaceAndComments();
        continue;
      }

      if (this.peekIs('}')) {
        break;
      }

      throw this.error('表字段之间缺少分隔符');
    }

    this.expect('}');
    return { fields };
  }

  private parseString(): string {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      throw this.error('字符串必须以引号开头');
    }

    this.advance();
    let output = '';

    while (!this.isEOF()) {
      const char = this.advance();

      if (char === quote) {
        return output;
      }

      if (char === '\\') {
        if (this.isEOF()) {
          throw this.error('字符串转义未完成');
        }

        const escaped = this.advance();
        switch (escaped) {
          case '\\':
            output += '\\';
            break;
          case '"':
            output += '"';
            break;
          case "'":
            output += "'";
            break;
          case 'n':
            output += '\n';
            break;
          case 'r':
            output += '\r';
            break;
          case 't':
            output += '\t';
            break;
          case 'b':
            output += '\b';
            break;
          case 'f':
            output += '\f';
            break;
          case 'v':
            output += '\v';
            break;
          case '0':
            output += '\0';
            break;
          default:
            output += escaped;
            break;
        }
        continue;
      }

      output += char;
    }

    throw this.error('字符串缺少结束引号');
  }

  private parseNumber(): number {
    const start = this.index;

    if (this.peekIs('-')) {
      this.advance();
    }

    while (this.isDigit(this.peek())) {
      this.advance();
    }

    if (this.peekIs('.')) {
      this.advance();
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    if (this.peekIs('e') || this.peekIs('E')) {
      this.advance();
      if (this.peekIs('+') || this.peekIs('-')) {
        this.advance();
      }
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const raw = this.text.slice(start, this.index);
    const value = Number(raw);
    if (Number.isNaN(value)) {
      throw this.error(`无法解析数字: ${raw}`);
    }

    return value;
  }

  private parseIdentifier(): string {
    const start = this.index;

    if (!isIdentifierStart(this.peek())) {
      throw this.error('标识符必须以字母或下划线开头');
    }

    this.advance();
    while (isIdentifierPart(this.peek())) {
      this.advance();
    }

    return this.text.slice(start, this.index);
  }

  private matchKeyword(keyword: string): boolean {
    if (this.text.slice(this.index, this.index + keyword.length) !== keyword) {
      return false;
    }

    const nextChar = this.text[this.index + keyword.length];
    if (isIdentifierPart(nextChar)) {
      return false;
    }

    this.advance(keyword.length);
    return true;
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isEOF()) {
      const char = this.peek();

      if (char === undefined) {
        return;
      }

      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      if (char === '-' && this.peek(1) === '-') {
        this.advance(2);

        if (this.peekIs('[') && this.peek(1) === '[') {
          this.advance(2);
          while (!this.isEOF() && !(this.peekIs(']') && this.peek(1) === ']')) {
            this.advance();
          }
          if (this.peekIs(']') && this.peek(1) === ']') {
            this.advance(2);
          }
          continue;
        }

        while (!this.isEOF() && !/[\r\n]/.test(this.peek() ?? '')) {
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  private expect(expected: string): void {
    if (!this.peekIs(expected)) {
      throw this.error(`期望 "${expected}"`);
    }

    this.advance(expected.length);
  }

  private peek(offset = 0): string | undefined {
    return this.text[this.index + offset];
  }

  private peekIs(expected: string): boolean {
    return this.text.startsWith(expected, this.index);
  }

  private advance(count = 1): string {
    let consumed = '';

    for (let index = 0; index < count; index += 1) {
      const char = this.text[this.index];
      if (char === undefined) {
        break;
      }

      consumed += char;
      this.index += 1;

      if (char === '\n') {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
    }

    return consumed;
  }

  private isDigit(char: string | undefined): boolean {
    return Boolean(char && /[0-9]/.test(char));
  }

  private isEOF(): boolean {
    return this.index >= this.text.length;
  }

  private error(message: string): Error {
    const error = new Error(`${message} (第 ${this.line} 行，第 ${this.column} 列)`);
    error.name = 'LuaParseError';
    return error;
  }
}

export function parseLuaConfig(text: string): ConfigModel {
  const parser = new LuaParser(text.replace(/^\uFEFF/, ''));
  const root = parser.parse();
  return parseTableToConfig(root);
}

export function buildProcessReverse(processes: MineralProcess[]): ProcessReverseGroup[] {
  const groups = new Map<string, ProcessReverseGroup>();

  for (const process of processes) {
    const signature = process.steps.join('=>');
    const existing = groups.get(signature);

    if (existing) {
      existing.minerals.push(process.mineral);
      continue;
    }

    groups.set(signature, {
      signature,
      steps: [...process.steps],
      minerals: [process.mineral]
    });
  }

  return Array.from(groups.values());
}

export function serializeLuaConfig(config: ConfigModel, options: SerializeLuaConfigOptions = {}): string {
  if (options.compact) {
    const reverse = buildProcessReverse(config.processes);
    return `{role=${renderStringMapInline(config.roles)},interfaces=${renderStringMapInline(config.interfaces)},idBlacklist=${renderFilterGroupMapInline(config.idBlacklist)},process=${renderProcessMapInline(config.processes)},idWhitelist=${renderFilterGroupMapInline(config.idWhitelist)},processReverse=${renderProcessReverseMapInline(reverse)}}`;
  }

  const reverse = buildProcessReverse(config.processes);
  const lines = ['{'];
  lines.push(`${indent(1)}role = ${renderStringMap(config.roles, 1)},`);
  lines.push(`${indent(1)}interfaces = ${renderStringMap(config.interfaces, 1)},`);
  lines.push(`${indent(1)}idBlacklist = ${renderFilterGroupMap(config.idBlacklist, 1)},`);
  lines.push(`${indent(1)}process = ${renderProcessMap(config.processes, 1)},`);
  lines.push(`${indent(1)}idWhitelist = ${renderFilterGroupMap(config.idWhitelist, 1)},`);
  lines.push(`${indent(1)}processReverse = ${renderProcessReverseMap(reverse, 1)},`);
  lines.push('}');
  return lines.join('\n');
}

export function collectAvailableSteps(config: ConfigModel): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    steps.push(value);
  };

  for (const role of config.roles) {
    push(role.name);
  }

  for (const process of config.processes) {
    for (const step of process.steps) {
      push(step);
    }
  }

  for (const group of config.idWhitelist) {
    push(group.role);
  }

  for (const group of config.idBlacklist) {
    push(group.role);
  }

  return steps;
}

export function formatProcessSignature(steps: string[]): string {
  return steps.length === 0 ? '空流程' : steps.join(' → ');
}

export function renameStepEverywhere(config: ConfigModel, originalName: string, nextName: string): ConfigModel {
  if (originalName === nextName) {
    return config;
  }

  if (
    config.roles.some((role) => role.name === nextName) ||
    config.idWhitelist.some((group) => group.role === nextName) ||
    config.idBlacklist.some((group) => group.role === nextName)
  ) {
    throw new Error(`职责 "${nextName}" 已存在`);
  }

  return {
    roles: config.roles.map((role) => (role.name === originalName ? { ...role, name: nextName } : role)),
    interfaces: config.interfaces.map((entry) => (entry.role === originalName ? { ...entry, role: nextName } : entry)),
    processes: config.processes.map((process) => ({
      ...process,
      steps: process.steps.map((step) => (step === originalName ? nextName : step))
    })),
    idWhitelist: config.idWhitelist.map((group) =>
      group.role === originalName ? { ...group, role: nextName } : group
    ),
    idBlacklist: config.idBlacklist.map((group) =>
      group.role === originalName ? { ...group, role: nextName } : group
    )
  };
}

export function removeStepEverywhere(config: ConfigModel, name: string): ConfigModel {
  return {
    roles: config.roles.filter((role) => role.name !== name),
    interfaces: config.interfaces.filter((entry) => entry.role !== name),
    processes: config.processes.map((process) => ({
      ...process,
      steps: process.steps.filter((step) => step !== name)
    })),
    idWhitelist: config.idWhitelist.filter((group) => group.role !== name),
    idBlacklist: config.idBlacklist.filter((group) => group.role !== name)
  };
}

export function upsertRoleEntry(config: ConfigModel, originalName: string | null, next: RoleEntry): ConfigModel {
  const name = next.name.trim();
  const machine = next.machine.trim();

  if (!name) {
    throw new Error('职责名称不能为空');
  }

  if (!machine) {
    throw new Error('机器名称不能为空');
  }

  if (originalName && originalName !== name) {
    config = renameStepEverywhere(config, originalName, name);
  }

  const duplicate =
    config.roles.some((role) => role.name === name && role.name !== originalName) ||
    config.idWhitelist.some((group) => group.role === name && group.role !== originalName) ||
    config.idBlacklist.some((group) => group.role === name && group.role !== originalName);
  if (!originalName && duplicate) {
    throw new Error(`职责 "${name}" 已存在`);
  }

  const roles = [...config.roles];
  const existingIndex = roles.findIndex((role) => role.name === name);

  if (existingIndex >= 0) {
    roles[existingIndex] = { name, machine };
  } else {
    roles.push({ name, machine });
  }

  return {
    ...config,
    roles
  };
}

export function deleteRoleEntry(config: ConfigModel, name: string): ConfigModel {
  return removeStepEverywhere(config, name);
}

export function upsertInterfaceEntry(
  config: ConfigModel,
  originalId: string | null,
  next: InterfaceEntry
): ConfigModel {
  const id = next.id.trim();
  const role = next.role.trim();

  if (!id) {
    throw new Error('输出口 ID 不能为空');
  }

  if (!role) {
    throw new Error('职责不能为空');
  }

  if (!config.roles.some((entry) => entry.name === role) && !collectAvailableSteps(config).includes(role)) {
    throw new Error(`职责 "${role}" 不存在`);
  }

  if (originalId && originalId !== id && config.interfaces.some((entry) => entry.id === id)) {
    throw new Error(`输出口 "${id}" 已存在`);
  }

  const interfaces = [...config.interfaces];
  const existingIndex = interfaces.findIndex((entry) => entry.id === originalId);

  if (existingIndex >= 0) {
    interfaces[existingIndex] = { id, role };
  } else {
    if (interfaces.some((entry) => entry.id === id)) {
      throw new Error(`输出口 "${id}" 已存在`);
    }
    interfaces.push({ id, role });
  }

  return {
    ...config,
    interfaces
  };
}

export function deleteInterfaceEntry(config: ConfigModel, id: string): ConfigModel {
  return {
    ...config,
    interfaces: config.interfaces.filter((entry) => entry.id !== id)
  };
}

export function upsertProcessEntry(
  config: ConfigModel,
  originalMineral: string | null,
  next: MineralProcess,
  options: { forceReplace?: boolean } = {}
): ConfigModel {
  const mineral = next.mineral.trim();
  const steps = next.steps.map((step) => step.trim()).filter(Boolean);
  const forceReplace = Boolean(options.forceReplace);

  if (!mineral) {
    throw new Error('矿物名称不能为空');
  }

  const processes = [...config.processes];
  const existingIndex = processes.findIndex((entry) => entry.mineral === originalMineral);
  const duplicateIndex = processes.findIndex((entry) => entry.mineral === mineral && entry.mineral !== originalMineral);

  if (duplicateIndex >= 0 && !forceReplace) {
    throw new Error(`矿物 "${mineral}" 已存在`);
  }

  if (existingIndex >= 0) {
    processes[existingIndex] = { mineral, steps };

    if (duplicateIndex >= 0 && duplicateIndex !== existingIndex) {
      processes.splice(duplicateIndex, 1);
    }
  } else if (duplicateIndex >= 0) {
    processes[duplicateIndex] = { mineral, steps };
  } else {
    processes.push({ mineral, steps });
  }

  return {
    ...config,
    processes
  };
}

export function deleteProcessEntry(config: ConfigModel, mineral: string): ConfigModel {
  return {
    ...config,
    processes: config.processes.filter((entry) => entry.mineral !== mineral)
  };
}

export function cloneFilterGroups(groups: FilterGroup[]): FilterGroup[] {
  return groups.map((group) => ({
    role: group.role,
    ids: [...group.ids]
  }));
}

export function setFilterGroups(config: ConfigModel, key: 'idWhitelist' | 'idBlacklist', groups: FilterGroup[]): ConfigModel {
  return {
    ...config,
    [key]: cloneFilterGroups(groups)
  };
}
