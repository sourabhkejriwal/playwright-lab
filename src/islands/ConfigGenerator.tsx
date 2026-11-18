import { useEffect, useMemo, useState } from 'react';
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
import { CHOICES, Choice, FilePanel, GROUP, LEGEND, Notes, SELECT, useFileActions } from './GeneratorParts';

const FILE_NAME = 'playwright.config.ts';
const RETRY_VALUES = Array.from({ length: MAX_RETRIES + 1 }, (_, value) => value);

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

  useEffect(() => setHydrated(true), []);

  const code = useMemo(() => generateConfig(options), [options]);
  const notes = useMemo(() => configNotes(options), [options]);
  const { copyState, resetCopy, copy, download } = useFileActions(code, FILE_NAME);

  const update = (change: Partial<ConfigOptions>) => {
    resetCopy();
    setOptions((current) => ({ ...current, ...change }));
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
        <FilePanel
          title={FILE_NAME}
          label={FILE_NAME}
          copyState={copyState}
          disabled={!hydrated}
          onCopy={copy}
          onDownload={download}
        >
          <Highlighted code={code} />
        </FilePanel>

        <p role="status" className="text-xs text-muted">
          {status}
        </p>

        <p className="min-w-0 text-xs break-words text-muted">
          <span className="text-pass">$</span> <code className="text-text">{installCommand(options)}</code>
        </p>

        <Notes label="Notes on this config" notes={notes} />
      </section>
    </div>
  );
}
