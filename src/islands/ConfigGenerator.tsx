import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BROWSERS,
  DEFAULT_OPTIONS,
  DEVICES,
  MAX_RETRIES,
  REPORTERS,
  TRACES,
  configNotes,
  generateConfig,
  installCommand,
  projectCount,
  type ConfigOptions,
} from '../lib/config-generator';
import CodeText from './CodeText';

const FILE_NAME = 'playwright.config.ts';
const BUTTON =
  'min-h-11 cursor-pointer rounded-term border border-line-strong px-3 py-1.5 text-xs text-pass hover:border-pass disabled:cursor-not-allowed disabled:border-line disabled:text-muted';
const GROUP = 'grid min-w-0 gap-2 rounded-term border border-line bg-surface p-4';
const LEGEND = 'px-1 text-xs text-muted';
const CHOICES = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2';
const SELECT = 'min-h-11 rounded-term border border-line-strong bg-raised px-2 text-sm text-bright';
const RETRY_VALUES = Array.from({ length: MAX_RETRIES + 1 }, (_, value) => value);

interface ChoiceProps {
  type: 'checkbox' | 'radio';
  group: string;
  name: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function Choice({ type, group, name, hint, checked, disabled, onChange }: ChoiceProps) {
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

interface RetrySelectProps {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

function RetrySelect({ label, value, disabled, onChange }: RetrySelectProps) {
  return (
    <label className="flex items-center gap-3 text-sm text-text">
      {label}
      <select
        className={SELECT}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {RETRY_VALUES.map((retries) => (
          <option key={retries}>{retries}</option>
        ))}
      </select>
    </label>
  );
}

/** Colors strings and keywords. The input is always our own generated config. */
function Highlighted({ code }: { code: string }) {
  return code.split(/('[^']*'|\b(?:import|from|export|default)\b)/).map((part, index) => {
    if (index % 2 === 0) return part;
    return (
      <span key={index} className={part.startsWith("'") ? 'text-pass' : 'text-purple'}>
        {part}
      </span>
    );
  });
}

function summarize(options: ConfigOptions) {
  const projects = projectCount(options);
  const reporters = options.reporters.length;
  return [
    `${projects} ${projects === 1 ? 'project' : 'projects'}`,
    `${reporters} ${reporters === 1 ? 'reporter' : 'reporters'}`,
    `trace ${options.trace}`,
  ].join(' · ');
}

const toggled = (list: string[], name: string, on: boolean) =>
  on ? [...list, name] : list.filter((item) => item !== name);

export default function ConfigGenerator() {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [hydrated, setHydrated] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setHydrated(true);
    return () => clearTimeout(copyTimer.current);
  }, []);

  const code = useMemo(() => generateConfig(options), [options]);
  const notes = useMemo(() => configNotes(options), [options]);

  const update = (change: Partial<ConfigOptions>) => {
    clearTimeout(copyTimer.current);
    setCopyState('idle');
    setOptions((current) => ({ ...current, ...change }));
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
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(href);
  };

  const status =
    copyState === 'copied'
      ? 'config copied to clipboard'
      : copyState === 'failed'
        ? 'could not copy the config'
        : summarize(options);

  return (
    <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form className="grid min-w-0 gap-5" onSubmit={(event) => event.preventDefault()}>
        <fieldset className={GROUP}>
          <legend className={LEGEND}># browsers</legend>
          <div className={CHOICES}>
            {BROWSERS.map(({ name, hint }) => (
              <Choice
                key={name}
                type="checkbox"
                group="browsers"
                name={name}
                hint={hint}
                checked={options.browsers.includes(name)}
                disabled={!hydrated}
                onChange={(on) => update({ browsers: toggled(options.browsers, name, on) })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># devices</legend>
          <div className={CHOICES}>
            {DEVICES.map(({ name, hint }) => (
              <Choice
                key={name}
                type="checkbox"
                group="devices"
                name={name}
                hint={hint}
                checked={options.devices.includes(name)}
                disabled={!hydrated}
                onChange={(on) => update({ devices: toggled(options.devices, name, on) })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># retries</legend>
          <div className="flex flex-wrap gap-6">
            <RetrySelect
              label="on CI"
              value={options.retriesCI}
              disabled={!hydrated}
              onChange={(retriesCI) => update({ retriesCI })}
            />
            <RetrySelect
              label="locally"
              value={options.retriesLocal}
              disabled={!hydrated}
              onChange={(retriesLocal) => update({ retriesLocal })}
            />
          </div>
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># reporters</legend>
          <div className={CHOICES}>
            {REPORTERS.map(({ name, hint }) => (
              <Choice
                key={name}
                type="checkbox"
                group="reporters"
                name={name}
                hint={hint}
                checked={options.reporters.includes(name)}
                disabled={!hydrated}
                onChange={(on) => update({ reporters: toggled(options.reporters, name, on) })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># trace</legend>
          <div className={CHOICES}>
            {TRACES.map(({ name, hint }) => (
              <Choice
                key={name}
                type="radio"
                group="trace"
                name={name}
                hint={hint}
                checked={options.trace === name}
                disabled={!hydrated}
                onChange={() => update({ trace: name })}
              />
            ))}
          </div>
        </fieldset>
      </form>

      <section
        aria-label="Generated config"
        className="grid min-w-0 gap-4 xl:sticky xl:top-[calc(var(--header-h)+1.5rem)]"
      >
        <div className="overflow-hidden rounded-term border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2">
            <h2 className="truncate text-xs text-muted">{FILE_NAME}</h2>
            <div className="flex gap-2">
              <button type="button" className={BUTTON} disabled={!hydrated} onClick={copy}>
                {copyState === 'copied' ? 'copied' : copyState === 'failed' ? 'failed' : 'copy'}
              </button>
              <button type="button" className={BUTTON} disabled={!hydrated} onClick={download}>
                download
              </button>
            </div>
          </div>
          <pre
            tabIndex={0}
            role="region"
            aria-label={FILE_NAME}
            className="overflow-auto bg-raised p-4 text-xs leading-relaxed text-text xl:max-h-[calc(100vh-22rem)]"
          >
            <code>
              <Highlighted code={code} />
            </code>
          </pre>
        </div>

        <p role="status" className="text-xs text-muted">
          {status}
        </p>

        <p className="min-w-0 text-xs break-words text-muted">
          <span className="text-pass">$</span> <code className="text-text">{installCommand(options)}</code>
        </p>

        {notes.length > 0 && (
          <ul aria-label="Notes on this config" className="grid gap-2">
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
        )}
      </section>
    </div>
  );
}
