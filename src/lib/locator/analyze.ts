/**
 * Turns a typed locator into what the playground shows: its matches, the strict-mode error Playwright would
 * raise, and a sturdier locator when there is one.
 */
import { accessibleName, isVisible, labelTexts, normalizeSpace, roleOf } from './aria';
import { elementText, resolveLocator } from './engine';
import { featuresOf, formatLocator, LocatorError, parseLocator, quote, type LocatorExpr } from './parser';

export interface Match {
  element: Element;
  preview: string;
  visible: boolean;
  /** A locator that finds only this element. */
  aka: string;
}

export interface Suggestion {
  code: string;
  why: string;
}

export type Analysis =
  | { kind: 'empty' }
  | { kind: 'error'; message: string; start: number; end: number }
  | {
      kind: 'resolved';
      expr: LocatorExpr;
      code: string;
      matches: Match[];
      strictError: string | null;
      suggestion: Suggestion | null;
      hint: string | null;
    };

const MAX_LISTED = 10;
const MAX_TEXT_LENGTH = 48;

function isUnique(code: string, element: Element, doc: Document): boolean {
  try {
    const found = resolveLocator(parseLocator(code), doc);
    return found.length === 1 && found[0] === element;
  } catch {
    return false;
  }
}

function uniqueVariant(build: (exact: boolean) => string, element: Element, doc: Document): string | null {
  for (const exact of [false, true]) {
    const code = build(exact);
    if (isUnique(code, element, doc)) return code;
  }
  return null;
}

const nameOption = (name: string, exact: boolean) =>
  `{ name: ${quote(name)}${exact ? ', exact: true' : ''} }`;
const exactOption = (exact: boolean) => (exact ? ', { exact: true }' : '');

interface Candidate {
  code: string;
  why: string;
}

/** Locators that find this element and nothing else, most resilient first. */
function directCandidate(element: Element, doc: Document): Candidate | null {
  const role = roleOf(element);
  const name = role ? accessibleName(element) : '';
  if (role && name && name.length <= MAX_TEXT_LENGTH) {
    const code = uniqueVariant(
      (exact) => `page.getByRole(${quote(role)}, ${nameOption(name, exact)})`,
      element,
      doc,
    );
    if (code) return { code, why: 'role and name are what a user perceives, so they survive refactors.' };
  }

  const label = labelTexts(element, elementText).map(normalizeSpace).find(Boolean);
  if (label) {
    const code = uniqueVariant(
      (exact) => `page.getByLabel(${quote(label)}${exactOption(exact)})`,
      element,
      doc,
    );
    if (code) return { code, why: 'form fields are best found by their label.' };
  }

  const attributes: [string, string, string][] = [
    ['placeholder', 'getByPlaceholder', 'the placeholder is the visible cue for this field.'],
    ['alt', 'getByAltText', 'alt text identifies an image the way a user would.'],
  ];
  for (const [attribute, method, why] of attributes) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const code = uniqueVariant(
      (exact) => `page.${method}(${quote(value)}${exactOption(exact)})`,
      element,
      doc,
    );
    if (code) return { code, why };
  }

  const text = normalizeSpace(elementText(element));
  if (text && text.length <= MAX_TEXT_LENGTH) {
    const code = uniqueVariant(
      (exact) => `page.getByText(${quote(text)}${exactOption(exact)})`,
      element,
      doc,
    );
    if (code) return { code, why: 'visible text is how a user finds non-interactive content.' };
  }

  const testId = element.getAttribute('data-testid');
  if (testId) {
    const code = `page.getByTestId(${quote(testId)})`;
    if (isUnique(code, element, doc)) {
      return { code, why: 'an explicit test id is a stable contract with the page.' };
    }
  }
  return null;
}

const CONTAINER_ROLES = ['listitem', 'row', 'article', 'form', 'group', 'region'];

/** Short text inside a container that could tell it apart from its siblings, headings first. */
function distinguishingTexts(container: Element): string[] {
  const preferred = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6, th, td, label, legend, p')];
  const texts = preferred.map((el) => normalizeSpace(elementText(el)));
  return [...new Set(texts)].filter((text) => text && text.length <= MAX_TEXT_LENGTH);
}

function selfLocator(element: Element): string | null {
  const role = roleOf(element);
  if (!role) return null;
  const name = accessibleName(element);
  if (name && name.length <= MAX_TEXT_LENGTH) return `.getByRole(${quote(role)}, { name: ${quote(name)} })`;
  return `.getByRole(${quote(role)})`;
}

/** For repeated elements: narrow to the surrounding card or row by its text, then step inside. */
function scopedCandidate(element: Element, doc: Document): Candidate | null {
  const why = 'the surrounding item tells this element apart from its identical siblings.';

  const ownRole = roleOf(element);
  if (ownRole && CONTAINER_ROLES.includes(ownRole)) {
    for (const text of distinguishingTexts(element)) {
      const code = `page.getByRole(${quote(ownRole)}).filter({ hasText: ${quote(text)} })`;
      if (isUnique(code, element, doc)) return { code, why };
    }
  }

  const inner = selfLocator(element);
  if (!inner) return null;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const role = roleOf(parent);
    if (!role || !CONTAINER_ROLES.includes(role)) continue;
    for (const text of distinguishingTexts(parent)) {
      const code = `page.getByRole(${quote(role)}).filter({ hasText: ${quote(text)} })${inner}`;
      if (isUnique(code, element, doc)) return { code, why };
    }
  }
  return null;
}

function positionalCandidate(element: Element, doc: Document): Candidate {
  const role = roleOf(element);
  const byTag = `page.locator(${quote(element.localName)})`;
  // Hidden elements are left out of getByRole, which leaves only the tag name to count by.
  const bases = role ? [`page.getByRole(${quote(role)})`, byTag] : [byTag];
  const why = 'position is the last resort: it breaks when the order changes.';
  for (const base of bases) {
    const index = resolveLocator(parseLocator(base), doc).indexOf(element);
    if (index >= 0) return { code: `${base}.nth(${index})`, why };
  }
  return { code: byTag, why };
}

function bestLocator(element: Element, doc: Document): Candidate & { positional: boolean } {
  const found = directCandidate(element, doc) ?? scopedCandidate(element, doc);
  if (found) return { ...found, positional: false };
  return { ...positionalCandidate(element, doc), positional: true };
}

function previewOf(element: Element): string {
  const tag = element.localName;
  const attributes = [...element.attributes]
    .filter((attribute) => !attribute.name.startsWith('aria-labelledby') && attribute.name !== 'style')
    .slice(0, 3)
    .map((attribute) => {
      const value = attribute.value.length > 24 ? `${attribute.value.slice(0, 24)}…` : attribute.value;
      return attribute.value === '' ? attribute.name : `${attribute.name}="${value}"`;
    });
  const open = `<${[tag, ...attributes].join(' ')}>`;
  if (['img', 'input', 'br', 'hr'].includes(tag)) return open;
  const text = normalizeSpace(elementText(element));
  const shown = text.length > 32 ? `${text.slice(0, 32)}…` : text;
  return `${open}${shown}</${tag}>`;
}

function strictMessage(code: string, matches: Match[]): string {
  const shortCode = code.replace(/^page\./, '');
  const lines = matches
    .slice(0, MAX_LISTED)
    .map((match, index) => `    ${index + 1}) ${match.preview} aka ${match.aka.replace(/^page\./, '')}`);
  if (matches.length > MAX_LISTED) lines.push('    ...');
  return `Error: strict mode violation: ${shortCode} resolved to ${matches.length} elements:\n${lines.join('\n')}`;
}

const METHOD_RANK = [
  'getByRole',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByText',
  'getByTitle',
  'getByTestId',
];

function methodRank(method: string): number {
  const rank = METHOD_RANK.indexOf(method);
  return rank === -1 ? METHOD_RANK.length : rank;
}

/** Whether the visitor's locator depends on page structure, or on a weaker signal than the one available. */
function worthImproving(expr: LocatorExpr, best: Candidate): boolean {
  const features = featuresOf(expr);
  if (['css', 'xpath', 'nth', 'first', 'last'].some((feature) => features.has(feature))) return true;
  if (expr.calls.length > 1) return false;
  const bestMethod = /^page\.(\w+)/.exec(best.code)?.[1] ?? '';
  return methodRank(expr.calls[0].method) > methodRank(bestMethod);
}

function noMatchHint(expr: LocatorExpr, doc: Document): string {
  const last = expr.calls[expr.calls.length - 1];
  if (last.method === 'getByRole' && expr.calls.length === 1) {
    const role = last.args[0] as string;
    const names = resolveLocator(parseLocator(`page.getByRole(${quote(role)})`), doc)
      .map(accessibleName)
      .filter(Boolean);
    if (names.length) {
      const unique = [...new Set(names)].slice(0, 6).map((name) => `"${name}"`);
      return `The ${role} elements on this page are named ${unique.join(', ')}.`;
    }
    return `Nothing on this page has the role "${role}".`;
  }
  return 'Check the spelling, and remember that text matching ignores case unless exact is true.';
}

/** Everything the playground displays for one input. */
export function analyzeLocator(source: string, doc: Document): Analysis {
  if (!source.trim()) return { kind: 'empty' };
  try {
    const expr = parseLocator(source);
    const elements = resolveLocator(expr, doc);
    const code = formatLocator(expr);
    const bestByElement = elements.slice(0, MAX_LISTED).map((element) => bestLocator(element, doc));
    const matches: Match[] = elements.map((element, index) => ({
      element,
      preview: previewOf(element),
      visible: isVisible(element),
      aka: bestByElement[index]?.code ?? '',
    }));

    let suggestion: Suggestion | null = null;
    if (elements.length === 1) {
      const best = bestByElement[0];
      if (!best.positional && best.code !== code && worthImproving(expr, best)) {
        suggestion = { code: best.code, why: best.why };
      }
    }

    return {
      kind: 'resolved',
      expr,
      code,
      matches,
      strictError: elements.length > 1 ? strictMessage(code, matches) : null,
      suggestion,
      hint: elements.length === 0 ? noMatchHint(expr, doc) : null,
    };
  } catch (error) {
    if (error instanceof LocatorError) {
      return { kind: 'error', message: error.message, start: error.start, end: error.end };
    }
    throw error;
  }
}
