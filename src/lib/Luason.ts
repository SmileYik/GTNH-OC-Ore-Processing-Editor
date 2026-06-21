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

function isLuaTable(value: LuaValue): value is LuaTable {
  return typeof value === 'object' && value !== null && 'fields' in value;
}

function isSafeIdentifier(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !LUA_KEYWORDS.has(key);
}

function isIdentifierStart(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z_]/.test(char));
}

function isIdentifierPart(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z0-9_]/.test(char));
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

function escapeLuaStringValue(value: LuaValue): string {
  if (typeof value === 'string') {
    return escapeLuaString(value)
  }
  return stringValue(value)
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

export class LuaParser {
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

export class LuaSerializer {

  private toLuaValue(input: any): LuaValue {
    if (input == null) {
      return null
    }
    if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'string') {
      return input
    }
    if (input instanceof Array) {
      return this.arrayToLuaTable(input)
    }
    if (typeof input == 'object') {
      return this.objectToLuaTable(input)
    }
    throw new Error('Expected a scalar Lua value');
  }

  private arrayToLuaTable(input: any[]): LuaTable {
    const table = { fields: [] } as LuaTable
    for (let elem of input) {
      table.fields.push({
        kind: "array",
        value: this.toLuaValue(elem)
      } as LuaArrayField)
    }
    return table
  }

  private objectToLuaTable(input: {}): LuaTable {
    console.log("objectToLuaTable", input)
    const table = { fields: [] } as LuaTable
    Object.entries(input).forEach(([key, value]) => {
      table.fields.push({
        kind: "keyed",
        key: stringValue(this.toLuaValue(key)),
        value: this.toLuaValue(value)
      } as LuaKeyedField)
    })
    return table
  }

  public serialization(input: {}, deep: number = 0, spaceChar: string = ' ', tabWide: number = 2, newLineChar: string = '\n'): string {
    return this.doStringify(this.objectToLuaTable(input), deep, spaceChar, tabWide, newLineChar)
  }

  private doStringify(input: LuaTable, deep: number, spaceChar: string, tabWide: number, newLineChar: string): string {
    deep += 1

    const lines = [] as string[]
    input.fields.forEach(field => {
      const val = field.value
      let valstr = undefined
      if (isLuaTable(val)) {
        valstr = `${this.doStringify(val, deep, spaceChar, tabWide, newLineChar)}`
      } else {
        valstr = `${escapeLuaStringValue(val)}`
      }

      let line = `${spaceChar.repeat(deep * tabWide)}`
      if (field.kind === 'array') {
        line += `${valstr}`
      } else if (field.kind === 'keyed') {
        line += `${formatLuaKey(field.key)}${spaceChar}=${spaceChar}${valstr}`
      }
      lines.push(line)
    })
    if (lines.length === 0) {
      return `{}`
    } else {
      return `{${newLineChar}${lines.join("," + newLineChar)}${newLineChar}${spaceChar.repeat((deep - 1) * tabWide)}}`
    }
  }

  public unserialization<T>(input: string, targetType: new () => T): T {
    const parser = new LuaParser(input.replace(/^\uFEFF/, ''));
    const table = parser.parse();

    let defaultInstance: any = null;
    if (typeof targetType === 'function') {
      try {
        defaultInstance = new targetType();
      } catch (e) {
        defaultInstance = Object.create(targetType.prototype);
      }
    }

    return this.luaValueToJS(table, defaultInstance) as T;
  }

  private luaValueToJS(luaValue: LuaValue, defaultVal: any): any {
    if (!isLuaTable(luaValue)) {
      return luaValue;
    }

    const fields = luaValue.fields;
    let isArray = false;

    if (fields.length > 0) {
      isArray = fields[0].kind === 'array';
    } else {
      isArray = Array.isArray(defaultVal);
    }

    if (isArray) {
      const arr: any[] = [];
      fields.forEach((field, index) => {
        const nextDefault = Array.isArray(defaultVal) ? defaultVal[index] : undefined;
        arr.push(this.luaValueToJS(field.value, nextDefault));
      });
      return arr;
    } else {
      let obj: any;
      if (defaultVal && typeof defaultVal === 'object' && !Array.isArray(defaultVal)) {
        const proto = Object.getPrototypeOf(defaultVal);
        if (proto && proto.constructor && proto.constructor !== Object) {
          try {
            obj = new proto.constructor();
          } catch {
            obj = Object.create(proto);
          }
        } else {
          obj = {};
        }
      } else {
        obj = {};
      }

      fields.forEach(field => {
        if (field.kind === 'keyed') {
          const key = field.key;

          let nextDefault = defaultVal ? defaultVal[key] : undefined;
          if (!nextDefault && defaultVal?.constructor?.__indexType__) {
            const TCls = defaultVal.constructor.__indexType__;
            nextDefault = new TCls();
          }

          const resolvedValue = this.luaValueToJS(field.value, nextDefault);

          const ParentClass = defaultVal?.constructor as any;
          if (ParentClass && typeof ParentClass.__validateIndex__ === 'function') {
            ParentClass.__validateIndex__(key, resolvedValue);
          }
          obj[key] = resolvedValue;
        }
      });

      // fill default vals
      if (defaultVal && typeof defaultVal === 'object' && !Array.isArray(defaultVal)) {
        Object.keys(defaultVal).forEach(key => {
          if (!(key in obj) && defaultVal[key] !== undefined) {
            obj[key] = defaultVal[key];
          }
        });
      }

      return obj;
    }
  }
}