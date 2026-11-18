/**
 * The parts of ARIA that getByRole depends on: roles, accessible names, states, and visibility.
 * Elements live in the sample page's iframe, so nothing here may use `instanceof` against this window's classes.
 */
import { ARIA_ROLES } from './parser';

export const normalizeSpace = (text: string) => text.replace(/\s+/g, ' ').trim();

const tagOf = (el: Element) => el.tagName.toUpperCase();
const styleOf = (el: Element) => el.ownerDocument.defaultView!.getComputedStyle(el);

function hasExplicitName(el: Element): boolean {
  return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.hasAttribute('title');
}

const INPUT_ROLES: Record<string, string> = {
  button: 'button',
  checkbox: 'checkbox',
  file: 'button',
  image: 'button',
  number: 'spinbutton',
  radio: 'radio',
  range: 'slider',
  reset: 'button',
  submit: 'button',
};

const SECTIONING = 'article, aside, main, nav, section';

const IMPLICIT_ROLES: Record<string, string | ((el: Element) => string | null)> = {
  A: (el) => (el.hasAttribute('href') ? 'link' : null),
  AREA: (el) => (el.hasAttribute('href') ? 'link' : null),
  ARTICLE: 'article',
  ASIDE: 'complementary',
  BLOCKQUOTE: 'blockquote',
  BUTTON: 'button',
  CAPTION: 'caption',
  CODE: 'code',
  DATALIST: 'listbox',
  DD: 'definition',
  DEL: 'deletion',
  DETAILS: 'group',
  DFN: 'term',
  DIALOG: 'dialog',
  DT: 'term',
  EM: 'emphasis',
  FIELDSET: 'group',
  FIGURE: 'figure',
  FOOTER: (el) => (el.closest(SECTIONING) ? null : 'contentinfo'),
  FORM: (el) => (hasExplicitName(el) ? 'form' : null),
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  HEADER: (el) => (el.closest(SECTIONING) ? null : 'banner'),
  HR: 'separator',
  HTML: 'document',
  IMG: (el) => (el.getAttribute('alt') === '' && !hasExplicitName(el) ? 'presentation' : 'img'),
  INPUT: (el) => {
    const input = el as HTMLInputElement;
    const type = input.type.toLowerCase();
    if (type === 'hidden') return null;
    if (input.hasAttribute('list') && ['email', 'search', 'tel', 'text', 'url'].includes(type))
      return 'combobox';
    if (type === 'search') return 'searchbox';
    return INPUT_ROLES[type] ?? 'textbox';
  },
  INS: 'insertion',
  LI: 'listitem',
  MAIN: 'main',
  MARK: 'mark',
  MATH: 'math',
  MENU: 'list',
  METER: 'meter',
  NAV: 'navigation',
  OL: 'list',
  OPTGROUP: 'group',
  OPTION: 'option',
  OUTPUT: 'status',
  P: 'paragraph',
  PROGRESS: 'progressbar',
  SEARCH: 'search',
  SECTION: (el) => (hasExplicitName(el) ? 'region' : null),
  SELECT: (el) => {
    const select = el as HTMLSelectElement;
    return select.multiple || select.size > 1 ? 'listbox' : 'combobox';
  },
  STRONG: 'strong',
  SUB: 'subscript',
  SUP: 'superscript',
  SVG: 'img',
  TABLE: 'table',
  TBODY: 'rowgroup',
  TD: (el) => (el.closest('table')?.getAttribute('role') === 'grid' ? 'gridcell' : 'cell'),
  TEXTAREA: 'textbox',
  TFOOT: 'rowgroup',
  TH: (el) => (['row', 'rowgroup'].includes(el.getAttribute('scope') ?? '') ? 'rowheader' : 'columnheader'),
  THEAD: 'rowgroup',
  TIME: 'time',
  TR: 'row',
  UL: 'list',
};

export function roleOf(el: Element): string | null {
  for (const token of (el.getAttribute('role') ?? '').toLowerCase().split(/\s+/)) {
    if (ARIA_ROLES.has(token)) return token;
  }
  const implicit = IMPLICIT_ROLES[tagOf(el)];
  return typeof implicit === 'function' ? implicit(el) : (implicit ?? null);
}

function styleVisible(el: Element): boolean {
  return el.checkVisibility() && styleOf(el).visibility === 'visible';
}

/** Playwright's definition of visible: rendered, not visibility:hidden, and with a non-empty box. */
export function isVisible(el: Element): boolean {
  if (styleOf(el).display === 'contents') {
    return [...el.children].some(isVisible);
  }
  if (!styleVisible(el)) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Whether the element is left out of the accessibility tree, which is what getByRole skips by default. */
export function isHiddenForAria(el: Element): boolean {
  const select = tagOf(el) === 'OPTION' ? el.closest('select') : null;
  if (!styleVisible(select ?? el)) return true;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

const NAME_FROM_CONTENT = new Set(
  `button cell checkbox columnheader gridcell heading link menuitem menuitemcheckbox menuitemradio option radio row
  rowheader switch tab tooltip treeitem`.split(/\s+/),
);

interface NameContext {
  visited: Set<Element>;
  /** Inside a label, aria-labelledby target or name-from-content walk. */
  embedded: boolean;
  /** Following aria-labelledby, which may point at hidden content. */
  labelledBy: boolean;
}

function referencedElements(el: Element, attribute: string): Element[] {
  const ids = (el.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
  return ids.flatMap((id) => el.ownerDocument.getElementById(id) ?? []);
}

function labelsOf(el: Element): Element[] {
  return [...((el as HTMLInputElement).labels ?? [])];
}

function childrenName(el: Element, context: NameContext): string {
  let text = '';
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      text += child.nodeValue ?? '';
    } else if (child.nodeType === 1) {
      const element = child as Element;
      const inline = styleOf(element).display.startsWith('inline');
      const name = computeName(element, { ...context, embedded: true });
      text += inline ? name : ` ${name} `;
    }
  }
  return text;
}

function nativeName(el: Element, context: NameContext): string {
  const tag = tagOf(el);
  const inner = { ...context, embedded: true };
  const fromElements = (elements: Element[]) => elements.map((item) => computeName(item, inner)).join(' ');

  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    if (['button', 'submit', 'reset'].includes(input.type)) {
      return input.value || (input.type === 'submit' ? 'Submit' : input.type === 'reset' ? 'Reset' : '');
    }
    if (input.type === 'image') return input.alt || input.title || 'Submit';
    return (
      normalizeSpace(fromElements(labelsOf(el))) ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      ''
    );
  }
  if (tag === 'SELECT' || tag === 'TEXTAREA') {
    return (
      normalizeSpace(fromElements(labelsOf(el))) ||
      el.getAttribute('title') ||
      (tag === 'TEXTAREA' ? el.getAttribute('placeholder') : '') ||
      ''
    );
  }
  if (tag === 'IMG' || tag === 'AREA') return el.getAttribute('alt') || el.getAttribute('title') || '';
  if (tag === 'TABLE') {
    const caption = el.querySelector(':scope > caption');
    return caption ? computeName(caption, inner) : '';
  }
  if (tag === 'FIELDSET') {
    const legend = el.querySelector(':scope > legend');
    return legend ? computeName(legend, inner) : '';
  }
  if (tag === 'FIGURE') {
    const caption = el.querySelector(':scope > figcaption');
    return caption ? computeName(caption, inner) : '';
  }
  return '';
}

function embeddedControlValue(el: Element): string | null {
  const tag = tagOf(el);
  if (tag === 'TEXTAREA') return (el as HTMLTextAreaElement).value;
  if (tag === 'SELECT') return (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? '';
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    return ['checkbox', 'radio', 'file', 'hidden'].includes(input.type) ? '' : input.value;
  }
  return null;
}

function computeName(el: Element, context: NameContext): string {
  if (context.visited.has(el)) return '';
  context.visited.add(el);
  if (!context.labelledBy && isHiddenForAria(el)) return '';
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(tagOf(el))) return '';

  if (!context.labelledBy) {
    const targets = referencedElements(el, 'aria-labelledby');
    if (targets.length) {
      const labelled = targets.map((target) =>
        computeName(target, { visited: context.visited, embedded: true, labelledBy: true }),
      );
      const joined = normalizeSpace(labelled.join(' '));
      if (joined) return joined;
    }
  }

  const ariaLabel = normalizeSpace(el.getAttribute('aria-label') ?? '');
  if (ariaLabel) return ariaLabel;

  if (context.embedded) {
    const value = embeddedControlValue(el);
    if (value !== null) return value;
  }

  const native = normalizeSpace(nativeName(el, context));
  if (native) return native;

  const role = roleOf(el);
  if (context.embedded || context.labelledBy || (role && NAME_FROM_CONTENT.has(role))) {
    const content = normalizeSpace(childrenName(el, context));
    if (content) return content;
  }
  return normalizeSpace(el.getAttribute('title') ?? '');
}

export function accessibleName(el: Element): string {
  return computeName(el, { visited: new Set(), embedded: false, labelledBy: false });
}

/** The label texts getByLabel compares against, in Playwright's order of preference. */
export function labelTexts(el: Element, textOf: (el: Element) => string): string[] {
  const targets = referencedElements(el, 'aria-labelledby');
  if (targets.length) return targets.map(textOf);
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return [ariaLabel];
  const tag = tagOf(el);
  const labelable =
    ['BUTTON', 'METER', 'OUTPUT', 'PROGRESS', 'SELECT', 'TEXTAREA'].includes(tag) ||
    (tag === 'INPUT' && (el as HTMLInputElement).type !== 'hidden');
  return labelable ? labelsOf(el).map(textOf) : [];
}

function ariaBoolean(el: Element, attribute: string): boolean | null {
  const value = el.getAttribute(attribute);
  return value === 'true' ? true : value === 'false' ? false : null;
}

export function isChecked(el: Element): boolean {
  const tag = tagOf(el);
  if (tag === 'INPUT' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type)) {
    return (el as HTMLInputElement).checked;
  }
  return ariaBoolean(el, 'aria-checked') === true;
}

export function isDisabled(el: Element): boolean {
  const native = ['BUTTON', 'INPUT', 'OPTGROUP', 'OPTION', 'SELECT', 'TEXTAREA'].includes(tagOf(el));
  if (native && el.matches(':disabled')) return true;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.getAttribute('aria-disabled') === 'true') return true;
  }
  return false;
}

export function isExpanded(el: Element): boolean {
  if (tagOf(el) === 'DETAILS') return (el as HTMLDetailsElement).open;
  return ariaBoolean(el, 'aria-expanded') === true;
}

export function isPressed(el: Element): boolean {
  return ariaBoolean(el, 'aria-pressed') === true;
}

export function isSelected(el: Element): boolean {
  if (tagOf(el) === 'OPTION') return (el as HTMLOptionElement).selected;
  return ariaBoolean(el, 'aria-selected') === true;
}

export function levelOf(el: Element): number {
  const explicit = Number(el.getAttribute('aria-level'));
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  return /^H[1-6]$/.test(tagOf(el)) ? Number(tagOf(el)[1]) : 0;
}
