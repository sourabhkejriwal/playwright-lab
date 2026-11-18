/** CodeMirror setup for the locator input. Loaded on demand, because it is by far the heaviest part of the page. */
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState, StateEffect, StateField, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view';
import { tags } from '@lezer/highlight';

export interface LocatorEditorHandle {
  setValue(value: string): void;
  setError(range: { start: number; end: number } | null): void;
  destroy(): void;
}

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--astro-code-token-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--astro-code-token-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--astro-code-token-constant)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--astro-code-token-function)',
  },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName)],
    color: 'var(--astro-code-token-parameter)',
  },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: 'var(--astro-code-token-punctuation)' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--term-raised)', color: 'var(--term-text)', fontSize: '0.875rem' },
  '&.cm-focused': { outline: '2px solid var(--term-info)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { padding: '0.75rem', caretColor: 'var(--term-pass)' },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--term-pass)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--term-pass) 30%, transparent)',
  },
  '.cm-locator-error': { textDecoration: 'underline wavy var(--term-fail)' },
});

const setErrorRange = StateEffect.define<{ start: number; end: number } | null>();
const errorMark = Decoration.mark({ class: 'cm-locator-error' });

const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorRange)) continue;
      const ranges: Range<Decoration>[] = [];
      const length = transaction.newDoc.length;
      if (effect.value && length > 0) {
        const start = Math.min(effect.value.start, length - 1);
        const end = Math.min(Math.max(effect.value.end, start + 1), length);
        ranges.push(errorMark.range(start, end));
      }
      next = Decoration.set(ranges);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function createLocatorEditor(
  parent: HTMLElement,
  options: { value: string; label: string; onChange: (value: string) => void },
): LocatorEditorHandle {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.value,
      extensions: [
        history(),
        // No Tab binding, so keyboard users can still tab out of the editor.
        keymap.of([...defaultKeymap, ...historyKeymap]),
        javascript({ typescript: true }),
        syntaxHighlighting(highlight),
        errorField,
        theme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': options.label,
          spellcheck: 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    setValue(value) {
      const current = view.state.doc.toString();
      if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    },
    setError(range) {
      view.dispatch({ effects: setErrorRange.of(range) });
    },
    destroy() {
      view.destroy();
    },
  };
}
