import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import CodeText from './CodeText';

/** The pieces the config generator and the CI pipeline builder share. */

const BUTTON =
  'min-h-11 cursor-pointer rounded-term border border-line-strong px-3 py-1.5 text-xs text-pass hover:border-pass disabled:cursor-not-allowed disabled:border-line disabled:text-muted';
export const GROUP = 'grid min-w-0 gap-2 rounded-term border border-line bg-surface p-4';
export const LEGEND = 'px-1 text-xs text-muted';
export const CHOICES = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2';
export const SELECT = 'min-h-11 rounded-term border border-line-strong bg-raised px-2 text-sm text-bright';

interface ChoiceProps {
  type: 'checkbox' | 'radio';
  group: string;
  name: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

export function Choice({ type, group, name, hint, checked, disabled, onChange }: ChoiceProps) {
  const id = useId();
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-term border border-line-strong bg-raised px-3 py-1.5 hover:border-info has-checked:border-info">
      <input
        type={type}
        name={group}
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-pass"
      />
      <span className="grid min-w-0">
        <span id={`${id}-name`} className="text-sm break-words text-bright">
          {name}
        </span>
        <span id={`${id}-hint`} className="font-prose text-xs break-words text-muted">
          {hint}
        </span>
      </span>
    </label>
  );
}

export type CopyState = 'idle' | 'copied' | 'failed';

/** Copy and download for a generated file. `resetCopy` clears the "copied" state when the file changes. */
export function useFileActions(code: string, fileName: string) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const resetCopy = () => {
    clearTimeout(copyTimer.current);
    setCopyState('idle');
  };

  const copy = async () => {
    let copied = true;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      copied = false;
    }
    setCopyState(copied ? 'copied' : 'failed');
    clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 2000);
  };

  const download = () => {
    const href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(href);
  };

  return { copyState, resetCopy, copy, download };
}

interface FilePanelProps {
  title: string;
  label: string;
  copyState: CopyState;
  disabled: boolean;
  onCopy: () => void;
  onDownload: () => void;
  children: ReactNode;
}

export function FilePanel({
  title,
  label,
  copyState,
  disabled,
  onCopy,
  onDownload,
  children,
}: FilePanelProps) {
  return (
    <div className="overflow-hidden rounded-term border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2">
        <h2 className="min-w-0 truncate text-xs text-muted">{title}</h2>
        <div className="flex gap-2">
          <button type="button" className={BUTTON} disabled={disabled} onClick={onCopy}>
            {copyState === 'copied' ? 'copied' : copyState === 'failed' ? 'failed' : 'copy'}
          </button>
          <button type="button" className={BUTTON} disabled={disabled} onClick={onDownload}>
            download
          </button>
        </div>
      </div>
      <pre
        tabIndex={0}
        role="region"
        aria-label={label}
        className="overflow-auto bg-raised p-4 text-xs leading-relaxed text-text xl:max-h-[calc(100vh-22rem)]"
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

interface NotesProps {
  label: string;
  notes: { level: 'warn' | 'info'; text: string }[];
}

export function Notes({ label, notes }: NotesProps) {
  if (notes.length === 0) return null;
  return (
    <ul aria-label={label} className="grid gap-2">
      {notes.map(({ level, text }) => (
        <li key={text} className="flex gap-2 font-prose text-sm text-text">
          <span aria-hidden="true" className={level === 'warn' ? 'text-pending' : 'text-info'}>
            {level === 'warn' ? '!' : 'i'}
          </span>
          <span className="min-w-0 break-words">
            <CodeText text={text} />
          </span>
        </li>
      ))}
    </ul>
  );
}
