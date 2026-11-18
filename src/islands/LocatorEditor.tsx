import { useEffect, useRef, useState } from 'react';
import type { LocatorEditorHandle } from './locator-codemirror';

interface Props {
  value: string;
  label: string;
  error: { start: number; end: number } | null;
  onChange: (value: string) => void;
}

/** A plain textarea that upgrades to CodeMirror once the editor code has loaded. */
export default function LocatorEditor({ value, label, error, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<LocatorEditorHandle | null>(null);
  const latest = useRef({ value, onChange });
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => {
    latest.current = { value, onChange };
  });

  useEffect(() => {
    let cancelled = false;
    import('./locator-codemirror')
      .then(({ createLocatorEditor }) => {
        if (cancelled || !hostRef.current) return;
        editorRef.current = createLocatorEditor(hostRef.current, {
          value: latest.current.value,
          label,
          onChange: (next) => latest.current.onChange(next),
        });
        setUpgraded(true);
      })
      .catch(() => {
        // The textarea keeps working if the editor code can't be fetched.
      });
    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [label]);

  useEffect(() => {
    editorRef.current?.setValue(value);
  }, [value, upgraded]);

  useEffect(() => {
    editorRef.current?.setError(error);
  }, [error, value, upgraded]);

  return (
    <div className="overflow-hidden rounded-term border border-line-strong bg-raised">
      <div ref={hostRef} hidden={!upgraded} />
      {!upgraded && (
        <textarea
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="block w-full resize-y bg-raised p-3 font-mono text-sm leading-relaxed text-text"
        />
      )}
    </div>
  );
}
