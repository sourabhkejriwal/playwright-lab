import { useEffect, useMemo, useState } from 'react';
import {
  BROWSERS,
  DEFAULT_OPTIONS,
  NODE_VERSIONS,
  PACKAGE_MANAGERS,
  RETENTIONS,
  SETUPS,
  SHARD_COUNTS,
  TIMEOUTS,
  TRIGGERS,
  generateWorkflow,
  needsMerge,
  testJobCount,
  workflowNotes,
  type CiOptions,
} from '../lib/ci-builder';
import { CHOICES, Choice, FilePanel, GROUP, LEGEND, Notes, SELECT, useFileActions } from './GeneratorParts';

const FILE_NAME = 'playwright.yml';
const FILE_PATH = `.github/workflows/${FILE_NAME}`;

interface PickerProps<T extends string | number> {
  label: string;
  value: T;
  values: T[];
  disabled: boolean;
  onChange: (value: T) => void;
}

function Picker<T extends string | number>({ label, value, values, disabled, onChange }: PickerProps<T>) {
  return (
    <label className="flex items-center gap-3 text-sm text-text">
      {label}
      <select
        className={SELECT}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(values[event.target.selectedIndex])}
      >
        {values.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

/** Colors keys, strings and expressions. The input is always our own generated workflow. */
function Highlighted({ code }: { code: string }) {
  return code.split(/(\$\{\{.*?\}\}|'[^']*'|^ *(?:- )?[\w-]+:)/m).map((part, index) => {
    if (index % 2 === 0) return part;
    const color = part.startsWith('$') ? 'text-pending' : part.startsWith("'") ? 'text-pass' : 'text-purple';
    return (
      <span key={index} className={color}>
        {part}
      </span>
    );
  });
}

function summarize(options: CiOptions) {
  const jobs = testJobCount(options);
  return [
    `${jobs} test ${jobs === 1 ? 'job' : 'jobs'}`,
    needsMerge(options) ? 'merged report' : 'single report',
    `kept ${options.retention} days`,
  ].join(' · ');
}

const toggled = (list: string[], name: string, on: boolean) =>
  on ? [...list, name] : list.filter((item) => item !== name);

export default function CiBuilder() {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const code = useMemo(() => generateWorkflow(options), [options]);
  const notes = useMemo(() => workflowNotes(options), [options]);
  const { copyState, resetCopy, copy, download } = useFileActions(code, FILE_NAME);

  const update = (change: Partial<CiOptions>) => {
    resetCopy();
    setOptions((current) => ({ ...current, ...change }));
  };

  const status =
    copyState === 'copied'
      ? 'workflow copied to clipboard'
      : copyState === 'failed'
        ? 'could not copy the workflow'
        : summarize(options);

  return (
    <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form className="grid min-w-0 gap-5" onSubmit={(event) => event.preventDefault()}>
        <fieldset className={GROUP}>
          <legend className={LEGEND}># triggers</legend>
          <div className={CHOICES}>
            {TRIGGERS.map(({ name, hint }) => (
              <Choice
                key={name}
                type="checkbox"
                group="triggers"
                name={name}
                hint={hint}
                checked={options.triggers.includes(name)}
                disabled={!hydrated}
                onChange={(on) => update({ triggers: toggled(options.triggers, name, on) })}
              />
            ))}
          </div>
        </fieldset>

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
          <legend className={LEGEND}># jobs</legend>
          <div className="flex flex-wrap gap-6">
            <Picker
              label="shards"
              value={options.shards}
              values={SHARD_COUNTS}
              disabled={!hydrated}
              onChange={(shards) => update({ shards })}
            />
            <Picker
              label="timeout (minutes)"
              value={options.timeout}
              values={TIMEOUTS}
              disabled={!hydrated}
              onChange={(timeout) => update({ timeout })}
            />
          </div>
          <div className={CHOICES}>
            <Choice
              type="checkbox"
              group="jobs"
              name="one job per browser"
              hint="see which browser failed at a glance"
              checked={options.splitBrowsers}
              disabled={!hydrated}
              onChange={(splitBrowsers) => update({ splitBrowsers })}
            />
            <Choice
              type="checkbox"
              group="jobs"
              name="cancel older runs"
              hint="a new push stops the run it replaces"
              checked={options.cancelOldRuns}
              disabled={!hydrated}
              onChange={(cancelOldRuns) => update({ cancelOldRuns })}
            />
          </div>
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># browser setup</legend>
          <div className={CHOICES}>
            {SETUPS.map(({ name, hint }) => (
              <Choice
                key={name}
                type="radio"
                group="setup"
                name={name}
                hint={hint}
                checked={options.setup === name}
                disabled={!hydrated}
                onChange={() => update({ setup: name })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># package manager</legend>
          <div className={CHOICES}>
            {PACKAGE_MANAGERS.map(({ name, hint }) => (
              <Choice
                key={name}
                type="radio"
                group="package-manager"
                name={name}
                hint={hint}
                checked={options.packageManager === name}
                disabled={!hydrated}
                onChange={() => update({ packageManager: name })}
              />
            ))}
          </div>
          <Picker
            label="node version"
            value={options.nodeVersion}
            values={NODE_VERSIONS}
            disabled={!hydrated}
            onChange={(nodeVersion) => update({ nodeVersion })}
          />
        </fieldset>

        <fieldset className={GROUP}>
          <legend className={LEGEND}># report</legend>
          <Picker
            label="keep for (days)"
            value={options.retention}
            values={RETENTIONS}
            disabled={!hydrated}
            onChange={(retention) => update({ retention })}
          />
        </fieldset>
      </form>

      <section
        aria-label="Generated workflow"
        className="grid min-w-0 gap-4 xl:sticky xl:top-[calc(var(--header-h)+1.5rem)]"
      >
        <FilePanel
          title={FILE_PATH}
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

        <Notes label="Notes on this workflow" notes={notes} />
      </section>
    </div>
  );
}
