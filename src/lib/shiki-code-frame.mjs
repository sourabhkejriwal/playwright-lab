// Shiki transformer: frames every fenced code block like a TerminalWindow.
// Fence syntax: ```ts title="login.spec.ts" {1,3-5}
// The copy button stays hidden until CodeCopy.astro's script is running.

/** @param {string} meta */
function parseMeta(meta) {
  const titleMatch = meta.match(/title=(?:"([^"]*)"|'([^']*)')/);
  const rest = titleMatch ? meta.replace(titleMatch[0], '') : meta;
  const ranges = rest.match(/\{([\d,\s-]+)\}/)?.[1] ?? '';

  /** @type {Set<number>} */
  const highlighted = new Set();
  for (const range of ranges.split(',')) {
    const [start, end = start] = range.split('-').map(Number);
    if (!start) continue;
    for (let line = start; line <= end; line++) highlighted.add(line);
  }
  return { title: titleMatch?.[1] ?? titleMatch?.[2], highlighted };
}

/**
 * @param {string} tagName
 * @param {Record<string, unknown>} properties
 * @param {unknown[]} [children]
 */
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
/** @param {string} value */
const text = (value) => ({ type: 'text', value });

const dot = (/** @type {string} */ color) =>
  el('span', { class: `size-2.5 shrink-0 rounded-full ${color}`, 'aria-hidden': 'true' });

/** @returns {import('shiki').ShikiTransformer} */
export function codeFrame() {
  return {
    name: 'code-frame',
    line(node, line) {
      if (parseMeta(this.options.meta?.__raw ?? '').highlighted.has(line)) {
        node.properties['data-highlighted'] = '';
      }
    },
    root(root) {
      const { title } = parseMeta(this.options.meta?.__raw ?? '');
      const label = title ?? this.options.lang;
      const bar = el('div', { class: 'flex items-center gap-2 border-b border-line bg-raised px-3 py-1.5' }, [
        dot('bg-fail/70'),
        dot('bg-pending/70'),
        dot('bg-pass/70'),
        el('span', { class: 'ml-2 min-w-0 truncate font-mono text-xs text-dim' }, [text(label)]),
        el(
          'button',
          {
            type: 'button',
            hidden: true,
            'data-code-copy': '',
            class:
              'ml-auto min-h-6 shrink-0 cursor-pointer rounded-term border border-line px-2 font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-bright',
          },
          [
            el('span', { 'data-code-copy-label': '' }, [text('copy')]),
            el('span', { class: 'sr-only' }, [text(' code')]),
          ],
        ),
      ]);
      // @ts-expect-error plain hast nodes; Shiki's types want its own Element shape
      root.children = [
        el('div', { class: 'code-frame', role: 'group', 'aria-label': label }, [bar, ...root.children]),
      ];
    },
  };
}
