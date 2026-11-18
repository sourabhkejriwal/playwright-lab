/**
 * Parses the locator a visitor types into a small AST. Nothing they type is ever executed: this is a
 * hand-written reader for the subset of the Playwright API the playground understands.
 */

export interface OptionsValue {
  type: 'options';
  entries: Record<string, Value>;
}
export type Value = string | number | boolean | RegExp | LocatorExpr | OptionsValue;

export interface Call {
  method: string;
  args: Value[];
  start: number;
  end: number;
}

export interface LocatorExpr {
  type: 'locator';
  calls: Call[];
  start: number;
  end: number;
}

/** A problem with the visitor's input; start and end are offsets into the source, for the editor to underline. */
export class LocatorError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
    this.name = 'LocatorError';
  }
}

type Kind = 'string' | 'regex' | 'number' | 'boolean' | 'locator';

interface Signature {
  /** Accepted kinds for each positional argument. */
  args: Kind[][];
  options?: Record<string, Kind[]>;
  /** Only valid on a locator, not directly on `page`. */
  locatorOnly?: boolean;
}

const TEXT: Kind[] = ['string', 'regex'];
const EXACT = { exact: ['boolean'] } satisfies Record<string, Kind[]>;
const FILTER_OPTIONS: Record<string, Kind[]> = {
  has: ['locator'],
  hasNot: ['locator'],
  hasText: TEXT,
  hasNotText: TEXT,
};

const SIGNATURES: Record<string, Signature> = {
  getByRole: {
    args: [['string']],
    options: {
      name: TEXT,
      exact: ['boolean'],
      checked: ['boolean'],
      disabled: ['boolean'],
      expanded: ['boolean'],
      includeHidden: ['boolean'],
      level: ['number'],
      pressed: ['boolean'],
      selected: ['boolean'],
    },
  },
  getByText: { args: [TEXT], options: EXACT },
  getByLabel: { args: [TEXT], options: EXACT },
  getByPlaceholder: { args: [TEXT], options: EXACT },
  getByAltText: { args: [TEXT], options: EXACT },
  getByTitle: { args: [TEXT], options: EXACT },
  getByTestId: { args: [TEXT] },
  locator: { args: [['string', 'locator']], options: FILTER_OPTIONS },
  filter: { args: [], options: { ...FILTER_OPTIONS, visible: ['boolean'] }, locatorOnly: true },
  nth: { args: [['number']], locatorOnly: true },
  first: { args: [], locatorOnly: true },
  last: { args: [], locatorOnly: true },
  and: { args: [['locator']], locatorOnly: true },
  or: { args: [['locator']], locatorOnly: true },
};

const ACTIONS = new Set([
  'all',
  'blur',
  'check',
  'clear',
  'click',
  'count',
  'dblclick',
  'dragTo',
  'fill',
  'focus',
  'hover',
  'innerText',
  'inputValue',
  'isVisible',
  'press',
  'pressSequentially',
  'selectOption',
  'setChecked',
  'setInputFiles',
  'tap',
  'textContent',
  'type',
  'uncheck',
  'waitFor',
]);

export const ARIA_ROLES = new Set(
  `alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox
  complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid
  gridcell group heading img insertion link list listbox listitem log main mark marquee math menu menubar menuitem
  menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup
  region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript
  superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem`.split(
    /\s+/,
  ),
);

/** Which roles Playwright accepts each state option on; it throws for any other combination. */
const ROLE_OPTION_SUPPORT: Record<string, string[]> = {
  checked: ['checkbox', 'menuitemcheckbox', 'menuitemradio', 'radio', 'switch', 'treeitem'],
  level: ['heading', 'listitem', 'row', 'treeitem'],
  pressed: ['button'],
  selected: ['columnheader', 'gridcell', 'option', 'row', 'rowheader', 'tab', 'treeitem'],
};

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function closest(word: string, candidates: Iterable<string>): string | null {
  let best: string | null = null;
  let bestDistance = 3; // Further away than this is a different word, not a typo.
  for (const candidate of candidates) {
    const distance = editDistance(word, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function kindOf(value: Value): Kind | 'options' {
  if (value instanceof RegExp) return 'regex';
  if (typeof value === 'object') return value.type === 'locator' ? 'locator' : 'options';
  return typeof value as Kind;
}

function describeKinds(kinds: Kind[]): string {
  return kinds.map((kind) => (kind === 'regex' ? 'a regex' : `a ${kind}`)).join(' or ');
}

class Parser {
  private pos = 0;

  constructor(private readonly source: string) {}

  parse(): LocatorExpr {
    this.skipSpace();
    if (this.source.startsWith('await', this.pos) && !/[\w$]/.test(this.source[this.pos + 5] ?? '')) {
      this.pos += 5;
      this.skipSpace();
    }
    const expr = this.parseLocator();
    this.skipSpace();
    if (this.peek() === ';') this.pos++;
    this.skipSpace();
    if (this.pos < this.source.length) {
      throw this.error(`Unexpected "${this.peek()}" after the locator.`, this.pos, this.pos + 1);
    }
    return expr;
  }

  private peek(): string {
    return this.source[this.pos] ?? '';
  }

  private error(message: string, start = this.pos, end = Math.max(start + 1, this.pos)): LocatorError {
    const last = Math.max(this.source.length, 1);
    return new LocatorError(message, Math.min(start, last - 1), Math.min(end, last));
  }

  private skipSpace() {
    while (/\s/.test(this.peek()) && this.pos < this.source.length) this.pos++;
  }

  private readIdentifier(): string {
    const match = /^[A-Za-z_$][\w$]*/.exec(this.source.slice(this.pos));
    if (!match) return '';
    this.pos += match[0].length;
    return match[0];
  }

  private expect(char: string, context: string) {
    this.skipSpace();
    if (this.peek() !== char) throw this.error(`Expected "${char}" ${context}.`);
    this.pos++;
  }

  private parseLocator(): LocatorExpr {
    const start = this.pos;
    const calls: Call[] = [];
    const head = this.readIdentifier();

    if (!head) {
      throw this.error("A locator starts with page, for example page.getByRole('button').");
    }
    if (head !== 'page') {
      if (!(head in SIGNATURES)) {
        const hint = head === 'expect' ? ' Assertions are not run here: type only the locator.' : '';
        throw this.error(`A locator starts with page, not "${head}".${hint}`, start, this.pos);
      }
      calls.push(this.parseCall(head, start, true));
    }

    for (;;) {
      const beforeDot = this.pos;
      this.skipSpace();
      if (this.peek() !== '.') {
        this.pos = beforeDot;
        break;
      }
      this.pos++;
      this.skipSpace();
      const nameStart = this.pos;
      const name = this.readIdentifier();
      if (!name) throw this.error('Expected a method name after the dot.');
      calls.push(this.parseCall(name, nameStart, calls.length === 0));
    }

    if (calls.length === 0) {
      throw this.error(
        "page alone is not a locator. Add a method, such as .getByRole('button').",
        start,
        this.pos,
      );
    }
    return { type: 'locator', calls, start, end: this.pos };
  }

  private parseCall(method: string, start: number, onPage: boolean): Call {
    const nameEnd = this.pos;
    const signature = SIGNATURES[method];
    if (!signature) {
      if (ACTIONS.has(method)) {
        throw this.error(
          `.${method}() is an action. The playground only resolves locators, so remove it.`,
          start,
          nameEnd,
        );
      }
      const guess = closest(method, Object.keys(SIGNATURES));
      throw this.error(
        `Unknown method .${method}().${guess ? ` Did you mean .${guess}()?` : ''}`,
        start,
        nameEnd,
      );
    }
    if (onPage && signature.locatorOnly) {
      throw this.error(`.${method}() works on a locator, so find something first.`, start, nameEnd);
    }

    this.skipSpace();
    if (this.peek() !== '(') throw this.error(`.${method} is a method: add parentheses.`, start, nameEnd);
    this.pos++;

    const args: { value: Value; start: number; end: number }[] = [];
    this.skipSpace();
    while (this.peek() !== ')') {
      if (this.pos >= this.source.length) throw this.error(`Missing ")" to close .${method}().`, start);
      const argStart = this.pos;
      const value = this.parseValue();
      args.push({ value, start: argStart, end: this.pos });
      this.skipSpace();
      if (this.peek() === ',') {
        this.pos++;
        this.skipSpace();
      } else if (this.peek() !== ')') {
        throw this.error(`Expected "," or ")" in .${method}().`);
      }
    }
    this.pos++;

    this.validateArgs(method, signature, args, start);
    return { method, args: args.map((arg) => arg.value), start, end: this.pos };
  }

  private validateArgs(
    method: string,
    signature: Signature,
    args: { value: Value; start: number; end: number }[],
    start: number,
  ) {
    const positional = signature.args;
    positional.forEach((kinds, index) => {
      const arg = args[index];
      if (!arg) throw this.error(`.${method}() needs ${describeKinds(kinds)}.`, start, this.pos);
      if (!kinds.includes(kindOf(arg.value) as Kind)) {
        throw this.error(`.${method}() expects ${describeKinds(kinds)} here.`, arg.start, arg.end);
      }
    });

    const rest = args.slice(positional.length);
    const [options, extra] = rest;
    if (extra || (options && (!signature.options || kindOf(options.value) !== 'options'))) {
      const surplus = extra ?? options;
      throw this.error(`.${method}() has too many arguments.`, surplus.start, surplus.end);
    }

    if (options) {
      const allowed = signature.options ?? {};
      for (const [key, value] of Object.entries((options.value as OptionsValue).entries)) {
        const kinds = allowed[key];
        if (!kinds) {
          const guess = closest(key, Object.keys(allowed));
          throw this.error(
            `.${method}() has no "${key}" option.${guess ? ` Did you mean "${guess}"?` : ''}`,
            options.start,
            options.end,
          );
        }
        if (!kinds.includes(kindOf(value) as Kind)) {
          throw this.error(`"${key}" expects ${describeKinds(kinds)}.`, options.start, options.end);
        }
      }
    }

    if (method === 'nth' && !Number.isInteger(args[0].value)) {
      throw this.error('.nth() needs a whole number.', args[0].start, args[0].end);
    }
    if (method === 'getByRole') this.validateRole(args, start);
  }

  private validateRole(args: { value: Value; start: number; end: number }[], start: number) {
    const role = args[0].value as string;
    if (!ARIA_ROLES.has(role)) {
      const guess = closest(role, ARIA_ROLES);
      throw this.error(
        `"${role}" is not an ARIA role.${guess ? ` Did you mean "${guess}"?` : ''}`,
        args[0].start,
        args[0].end,
      );
    }
    const options = args[1]?.value as OptionsValue | undefined;
    for (const key of Object.keys(options?.entries ?? {})) {
      const roles = ROLE_OPTION_SUPPORT[key];
      if (roles && !roles.includes(role)) {
        throw this.error(`Role "${role}" does not support the "${key}" option.`, start, this.pos);
      }
    }
  }

  private parseValue(): Value {
    this.skipSpace();
    const char = this.peek();
    if (char === "'" || char === '"' || char === '`') return this.parseString(char);
    if (char === '/') return this.parseRegex();
    if (char === '{') return this.parseOptions();
    if (char === '-' || /\d/.test(char)) return this.parseNumber();

    const start = this.pos;
    const word = this.readIdentifier();
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'page' || word in SIGNATURES) {
      this.pos = start;
      return this.parseLocator();
    }
    if (word) throw this.error(`Unexpected "${word}". Variables are not available here.`, start, this.pos);
    throw this.error(char ? `Unexpected "${char}".` : 'The locator ends too early.');
  }

  private parseString(quote: string): string {
    const start = this.pos;
    this.pos++;
    let value = '';
    while (this.pos < this.source.length) {
      const char = this.source[this.pos++];
      if (char === quote) return value;
      if (quote === '`' && char === '$' && this.peek() === '{') {
        throw this.error('Template expressions are not available here.', this.pos - 1, this.pos + 1);
      }
      if (char === '\n' && quote !== '`') break;
      if (char !== '\\') {
        value += char;
        continue;
      }
      const escaped = this.source[this.pos++] ?? '';
      if (escaped === 'u') {
        const hex = this.source.slice(this.pos, this.pos + 4);
        if (!/^[\da-fA-F]{4}$/.test(hex)) throw this.error('Invalid \\u escape.', this.pos - 2, this.pos + 4);
        value += String.fromCharCode(Number.parseInt(hex, 16));
        this.pos += 4;
      } else {
        value += { n: '\n', t: '\t', r: '\r' }[escaped] ?? escaped;
      }
    }
    throw this.error('This string is missing its closing quote.', start, this.source.length);
  }

  private parseRegex(): RegExp {
    const start = this.pos;
    this.pos++;
    let body = '';
    let inClass = false;
    for (;;) {
      const char = this.source[this.pos];
      if (char === undefined || char === '\n') {
        throw this.error('This regex is missing its closing slash.', start, this.source.length);
      }
      this.pos++;
      if (char === '\\') {
        body += char + (this.source[this.pos++] ?? '');
        continue;
      }
      if (char === '/' && !inClass) break;
      if (char === '[') inClass = true;
      if (char === ']') inClass = false;
      body += char;
    }
    const flags = /^[a-z]*/.exec(this.source.slice(this.pos))?.[0] ?? '';
    this.pos += flags.length;
    try {
      return new RegExp(body, flags);
    } catch (error) {
      throw this.error(`Invalid regex: ${(error as Error).message}`, start, this.pos);
    }
  }

  private parseNumber(): number {
    const match = /^-?\d+(\.\d+)?/.exec(this.source.slice(this.pos));
    if (!match) throw this.error('Expected a number.');
    this.pos += match[0].length;
    return Number(match[0]);
  }

  private parseOptions(): OptionsValue {
    this.pos++;
    const entries: Record<string, Value> = Object.create(null);
    this.skipSpace();
    while (this.peek() !== '}') {
      if (this.pos >= this.source.length) throw this.error('Missing "}" to close the options.');
      const char = this.peek();
      const key = char === "'" || char === '"' ? this.parseString(char) : this.readIdentifier();
      if (!key) throw this.error('Expected an option name.');
      this.expect(':', `after "${key}"`);
      entries[key] = this.parseValue();
      this.skipSpace();
      if (this.peek() === ',') {
        this.pos++;
        this.skipSpace();
      } else if (this.peek() !== '}') {
        throw this.error('Expected "," or "}" in the options.');
      }
    }
    this.pos++;
    return { type: 'options', entries };
  }
}

/** Parse a locator expression. Throws LocatorError with the offending range. */
export function parseLocator(source: string): LocatorExpr {
  return new Parser(source).parse();
}

/** Split a call's arguments into its positional value and its options object. */
export function optionsOf(call: Call): Record<string, Value> {
  const last = call.args[call.args.length - 1];
  return typeof last === 'object' && !(last instanceof RegExp) && last.type === 'options' ? last.entries : {};
}

export function quote(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

function formatValue(value: Value): string {
  if (typeof value === 'string') return quote(value);
  if (value instanceof RegExp) return String(value);
  if (typeof value !== 'object') return String(value);
  if (value.type === 'locator') return formatLocator(value);
  const entries = Object.entries(value.entries).map(([key, entry]) => `${key}: ${formatValue(entry)}`);
  return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}

/** Canonical source for an expression, always starting at `page`. */
export function formatLocator(expr: LocatorExpr): string {
  const calls = expr.calls.map((call) => `.${call.method}(${call.args.map(formatValue).join(', ')})`);
  return `page${calls.join('')}`;
}

/**
 * Everything an expression uses: method names, option names, and `css` or `xpath` for raw selectors.
 * Challenges use this to require a technique, such as filter or exact.
 */
export function featuresOf(expr: LocatorExpr): Set<string> {
  const features = new Set<string>();
  const visit = (value: Value) => {
    if (typeof value !== 'object' || value instanceof RegExp) return;
    if (value.type === 'locator') {
      for (const call of value.calls) {
        features.add(call.method);
        if (call.method === 'locator' && typeof call.args[0] === 'string') {
          features.add(isXPathSelector(call.args[0]) ? 'xpath' : 'css');
        }
        call.args.forEach(visit);
      }
    } else {
      for (const [key, entry] of Object.entries(value.entries)) {
        features.add(key);
        visit(entry);
      }
    }
  };
  visit(expr);
  return features;
}

export function isXPathSelector(selector: string): boolean {
  const text = selector.trim();
  return text.startsWith('xpath=') || text.startsWith('//') || text.startsWith('..');
}
