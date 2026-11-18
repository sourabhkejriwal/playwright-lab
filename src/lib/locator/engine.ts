/**
 * Resolves a parsed locator against a document, following the rules of Playwright's own selector engines.
 * tests/locator-engine.spec.ts compares the results with real Playwright on the sample page.
 */
import {
  accessibleName,
  isChecked,
  isDisabled,
  isExpanded,
  isHiddenForAria,
  isPressed,
  isSelected,
  isVisible,
  labelTexts,
  levelOf,
  normalizeSpace,
  roleOf,
} from './aria';
import { LocatorError, optionsOf, type Call, type LocatorExpr, type Value } from './parser';

/** Marks the highlight layer drawn into the sample page, which locators must never see. */
export const OVERLAY_ATTRIBUTE = 'data-pl-overlay';

type Scope = Document | Element;
type Needle = string | RegExp;

const isOverlay = (el: Element) => el.hasAttribute(OVERLAY_ATTRIBUTE);

function allIn(scope: Scope): Element[] {
  return [...scope.querySelectorAll('*')].filter((el) => !el.closest(`[${OVERLAY_ATTRIBUTE}]`));
}

function skipsText(el: Element): boolean {
  return ['SCRIPT', 'NOSCRIPT', 'STYLE'].includes(el.tagName.toUpperCase()) || !!el.closest('head');
}

/** Text as Playwright sees it: like textContent, minus scripts and styles, plus button-like input values. */
export function elementText(el: Element): string {
  if (skipsText(el) || isOverlay(el)) return '';
  if (el.tagName.toUpperCase() === 'INPUT') {
    const input = el as HTMLInputElement;
    return input.type === 'submit' || input.type === 'button' ? input.value : '';
  }
  let text = '';
  for (const child of el.childNodes) {
    if (child.nodeType === 3) text += child.nodeValue ?? '';
    else if (child.nodeType === 1) text += elementText(child as Element);
  }
  return text;
}

function testRegex(regex: RegExp, text: string): boolean {
  regex.lastIndex = 0;
  return regex.test(text);
}

function matchesText(text: string, needle: Needle, exact = false): boolean {
  if (typeof needle !== 'string') return testRegex(needle, text);
  const haystack = normalizeSpace(text);
  const wanted = normalizeSpace(needle);
  return exact ? haystack === wanted : haystack.toLowerCase().includes(wanted.toLowerCase());
}

function sortInDocumentOrder(elements: Iterable<Element>): Element[] {
  return [...new Set(elements)].sort((a, b) => {
    if (a === b) return 0;
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/**
 * The smallest elements holding the text: a parent is skipped when one of its children matches too.
 * Unlike the other engines, text matching also considers the element it is chained from.
 */
function queryByText(scope: Scope, matcher: (text: string) => boolean): Element[] {
  const candidates = scope.nodeType === 1 ? [scope as Element, ...allIn(scope)] : allIn(scope);
  return candidates.filter((el) => {
    if (skipsText(el) || !matcher(elementText(el))) return false;
    return ![...el.children].some((child) => matcher(elementText(child)));
  });
}

function queryByAttribute(scope: Scope, attribute: string, needle: Needle, exact: boolean): Element[] {
  return allIn(scope).filter((el) => {
    const value = el.getAttribute(attribute);
    return value !== null && matchesText(value, needle, exact);
  });
}

function queryByRole(scope: Scope, call: Call): Element[] {
  const role = call.args[0] as string;
  const options = optionsOf(call);
  const name = options.name as Needle | undefined;
  const exact = options.exact === true;
  const states: [string, (el: Element) => boolean | number][] = [
    ['checked', isChecked],
    ['disabled', isDisabled],
    ['expanded', isExpanded],
    ['pressed', isPressed],
    ['selected', isSelected],
    ['level', levelOf],
  ];

  return allIn(scope).filter((el) => {
    if (roleOf(el) !== role) return false;
    for (const [option, read] of states) {
      if (option in options && read(el) !== options[option]) return false;
    }
    if (options.includeHidden !== true && isHiddenForAria(el)) return false;
    return name === undefined || matchesText(accessibleName(el), name, exact);
  });
}

function queryCss(scope: Scope, selector: string, call: Call): Element[] {
  const extension =
    /:(has-text|text|text-is|text-matches|visible|nth-match|right-of|left-of|above|below|near)\b/.exec(
      selector,
    );
  if (extension) {
    throw new LocatorError(
      `:${extension[1]} is a Playwright CSS extension this playground doesn't support. Try .filter() instead.`,
      call.start,
      call.end,
    );
  }
  try {
    return [...scope.querySelectorAll(selector)].filter((el) => !el.closest(`[${OVERLAY_ATTRIBUTE}]`));
  } catch {
    throw new LocatorError(`"${selector}" is not a valid CSS selector.`, call.start, call.end);
  }
}

function queryXPath(scope: Scope, selector: string, call: Call): Element[] {
  const doc = scope.nodeType === 9 ? (scope as Document) : scope.ownerDocument!;
  // Like Playwright: inside a chain, an absolute path is relative to the current element.
  const path = selector.startsWith('/') && scope.nodeType !== 9 ? `.${selector}` : selector;
  try {
    const result = doc.evaluate(path, scope, null, 5 /* ORDERED_NODE_ITERATOR_TYPE */, null);
    const elements: Element[] = [];
    for (let node = result.iterateNext(); node; node = result.iterateNext()) {
      if (node.nodeType === 1 && !(node as Element).closest(`[${OVERLAY_ATTRIBUTE}]`)) {
        elements.push(node as Element);
      }
    }
    return elements;
  } catch {
    throw new LocatorError(`"${selector}" is not a valid XPath expression.`, call.start, call.end);
  }
}

function queryTextEngine(scope: Scope, body: string): Element[] {
  const regex = /^\/(.+)\/([a-z]*)$/.exec(body);
  if (regex) {
    const pattern = new RegExp(regex[1], regex[2]);
    return queryByText(scope, (text) => testRegex(pattern, text));
  }
  const quoted = /^(["'])(.*)\1$/.exec(body);
  if (!quoted) return queryByText(scope, (text) => matchesText(text, body));
  // A quoted text= selector is strict and compares each run of text directly inside the element.
  const wanted = normalizeSpace(quoted[2]);
  return allIn(scope).filter((el) => {
    if (skipsText(el)) return false;
    return [...el.childNodes].some(
      (node) => node.nodeType === 3 && normalizeSpace(node.nodeValue ?? '') === wanted,
    );
  });
}

/** Split a selector on `>>`, leaving quoted text and brackets alone. */
function splitSelector(selector: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoteChar = '';
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (quoteChar) {
      if (char === '\\') {
        current += char + (selector[++i] ?? '');
        continue;
      }
      if (char === quoteChar) quoteChar = '';
    } else if (char === '"' || char === "'") {
      quoteChar = char;
    } else if (selector.startsWith('>>', i)) {
      parts.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

function applySelectorPart(roots: Scope[], part: string, call: Call): Scope[] {
  const engine = /^([a-zA-Z_-]+)=(.*)$/s.exec(part);
  const name = engine?.[1];
  const body = engine?.[2] ?? part;

  if (name === 'nth') {
    const index = Number(body);
    if (!Number.isInteger(index)) throw new LocatorError('nth= needs a whole number.', call.start, call.end);
    const item = roots.at(index);
    return item ? [item] : [];
  }
  if (name === 'visible') {
    return (roots as Element[]).filter((el) => isVisible(el) === (body === 'true'));
  }

  const query = (scope: Scope): Element[] => {
    if (name === 'css') return queryCss(scope, body, call);
    if (name === 'xpath') return queryXPath(scope, body, call);
    if (name === 'text') return queryTextEngine(scope, body);
    if (name === 'id') return queryByAttribute(scope, 'id', body, true);
    if (name === 'data-testid') return queryByAttribute(scope, 'data-testid', body, true);
    if (name && ['role', 'internal', 'react', 'vue'].includes(name)) {
      throw new LocatorError(`The ${name}= engine isn't available here.`, call.start, call.end);
    }
    if (part.startsWith('//') || part.startsWith('..')) return queryXPath(scope, part, call);
    if (part.startsWith('"') || part.startsWith("'")) return queryTextEngine(scope, part);
    return queryCss(scope, part, call);
  };
  return sortInDocumentOrder(roots.flatMap(query));
}

function querySelector(roots: Scope[], selector: string, call: Call): Element[] {
  let current = roots;
  for (const part of splitSelector(selector)) current = applySelectorPart(current, part, call);
  return current as Element[];
}

function applyFilters(elements: Element[], options: Record<string, Value>): Element[] {
  return elements.filter((el) => {
    if ('hasText' in options && !matchesText(elementText(el), options.hasText as Needle)) return false;
    if ('hasNotText' in options && matchesText(elementText(el), options.hasNotText as Needle)) return false;
    if ('has' in options && run(options.has as LocatorExpr, el).length === 0) return false;
    if ('hasNot' in options && run(options.hasNot as LocatorExpr, el).length > 0) return false;
    if ('visible' in options && isVisible(el) !== options.visible) return false;
    return true;
  });
}

function queryEach(roots: Scope[], query: (scope: Scope) => Element[]): Element[] {
  return sortInDocumentOrder(roots.flatMap(query));
}

function applyCall(roots: Scope[], call: Call, outerScope: Scope): Scope[] {
  const [first] = call.args;
  const options = optionsOf(call);
  const exact = options.exact === true;

  switch (call.method) {
    case 'getByRole':
      return queryEach(roots, (scope) => queryByRole(scope, call));
    case 'getByText':
      return queryEach(roots, (scope) =>
        queryByText(scope, (text) => matchesText(text, first as Needle, exact)),
      );
    case 'getByLabel':
      return queryEach(roots, (scope) =>
        allIn(scope).filter((el) =>
          labelTexts(el, elementText).some((label) => matchesText(label, first as Needle, exact)),
        ),
      );
    case 'getByPlaceholder':
      return queryEach(roots, (scope) => queryByAttribute(scope, 'placeholder', first as Needle, exact));
    case 'getByAltText':
      return queryEach(roots, (scope) => queryByAttribute(scope, 'alt', first as Needle, exact));
    case 'getByTitle':
      return queryEach(roots, (scope) => queryByAttribute(scope, 'title', first as Needle, exact));
    case 'getByTestId':
      return queryEach(roots, (scope) => queryByAttribute(scope, 'data-testid', first as Needle, true));
    case 'locator': {
      const found =
        typeof first === 'string'
          ? querySelector(roots, first, call)
          : queryEach(roots, (scope) => run(first as LocatorExpr, scope));
      return applyFilters(found, options);
    }
    case 'filter':
      return applyFilters(roots as Element[], options);
    case 'nth': {
      const item = roots.at(first as number);
      return item ? [item] : [];
    }
    case 'first':
      return roots.slice(0, 1);
    case 'last':
      return roots.slice(-1);
    case 'and': {
      const other = new Set<Scope>(run(first as LocatorExpr, outerScope));
      return roots.filter((el) => other.has(el));
    }
    case 'or':
      return sortInDocumentOrder([...(roots as Element[]), ...run(first as LocatorExpr, outerScope)]);
    default:
      throw new LocatorError(`Unknown method .${call.method}().`, call.start, call.end);
  }
}

function run(expr: LocatorExpr, scope: Scope): Element[] {
  let roots: Scope[] = [scope];
  for (const call of expr.calls) roots = applyCall(roots, call, scope);
  return roots as Element[];
}

/** Every element the locator resolves to, in document order. */
export function resolveLocator(expr: LocatorExpr, doc: Document): Element[] {
  return run(expr, doc);
}
