/** Writes a playwright.config.ts from a visitor's choices. Pure, so it can be tested against real Playwright. */

export interface BrowserChoice {
  name: string;
  device: string;
  channel?: string;
  install: string;
  hint: string;
}

export interface DeviceChoice {
  name: string;
  install: string;
  hint: string;
}

export interface ReporterChoice {
  name: string;
  code: string;
  hint: string;
}

export interface TraceChoice {
  name: string;
  hint: string;
}

export const BROWSERS: BrowserChoice[] = [
  { name: 'chromium', device: 'Desktop Chrome', install: 'chromium', hint: 'bundled Chromium' },
  { name: 'firefox', device: 'Desktop Firefox', install: 'firefox', hint: 'patched Firefox' },
  { name: 'webkit', device: 'Desktop Safari', install: 'webkit', hint: 'the engine behind Safari' },
  {
    name: 'Google Chrome',
    device: 'Desktop Chrome',
    channel: 'chrome',
    install: 'chrome',
    hint: 'branded Chrome',
  },
  {
    name: 'Microsoft Edge',
    device: 'Desktop Edge',
    channel: 'msedge',
    install: 'msedge',
    hint: 'branded Edge',
  },
];

export const DEVICES: DeviceChoice[] = [
  { name: 'Pixel 7', install: 'chromium', hint: 'Android phone, Chromium' },
  { name: 'Galaxy S24', install: 'chromium', hint: 'Android phone, Chromium' },
  { name: 'iPhone 15', install: 'webkit', hint: 'iOS phone, WebKit' },
  { name: 'iPhone 15 Pro Max', install: 'webkit', hint: 'large iOS phone, WebKit' },
  { name: 'Galaxy Tab S9', install: 'chromium', hint: 'Android tablet, Chromium' },
  { name: 'iPad Pro 11', install: 'webkit', hint: 'iOS tablet, WebKit' },
];

export const REPORTERS: ReporterChoice[] = [
  { name: 'list', code: "['list']", hint: 'one line per test' },
  { name: 'line', code: "['line']", hint: 'one updating line' },
  { name: 'dot', code: "['dot']", hint: 'one character per test' },
  { name: 'html', code: "['html', { open: 'never' }]", hint: 'browsable report with traces' },
  { name: 'json', code: "['json', { outputFile: 'reports/results.json' }]", hint: 'for your own tooling' },
  { name: 'junit', code: "['junit', { outputFile: 'reports/junit.xml' }]", hint: 'for CI test dashboards' },
  { name: 'github', code: "['github']", hint: 'failure annotations, added on CI only' },
  { name: 'blob', code: "['blob']", hint: 'merge the reports of CI shards' },
];

export const TRACES: TraceChoice[] = [
  { name: 'off', hint: 'never record' },
  { name: 'on', hint: 'record every test, the slowest choice' },
  { name: 'retain-on-failure', hint: 'record every test, keep failures' },
  { name: 'retain-on-first-failure', hint: 'record first runs, keep failures' },
  { name: 'on-first-retry', hint: 'record the first retry only' },
  { name: 'on-all-retries', hint: 'record every retry' },
];

export const MAX_RETRIES = 5;

export interface ConfigOptions {
  browsers: string[];
  devices: string[];
  retriesCI: number;
  retriesLocal: number;
  reporters: string[];
  trace: string;
}

export const DEFAULT_OPTIONS: ConfigOptions = {
  browsers: ['chromium', 'firefox', 'webkit'],
  devices: [],
  retriesCI: 2,
  retriesLocal: 0,
  reporters: ['html'],
  trace: 'on-first-retry',
};

export interface ConfigNote {
  level: 'warn' | 'info';
  text: string;
}

const PRINT_WIDTH = 110;

/** Prettier always breaks a list of two or more tuples that each hold several values. */
const mustBreak = (items: string[]) => items.length > 1 && items.every((item) => item.includes(', '));

/** Prints a list on one line when it fits, otherwise one item per line. */
function list(prefix: string, items: string[], suffix: string, indent: string, closeIndent = indent) {
  const inline = `${indent}${prefix}[${items.join(', ')}]${suffix}`;
  if (inline.length <= PRINT_WIDTH && !mustBreak(items)) return inline;
  const body = items.map((item) => `${closeIndent}  ${item},`).join('\n');
  return `${indent}${prefix}[\n${body}\n${closeIndent}]${suffix}`;
}

function reporterLines(names: string[]) {
  const chosen = REPORTERS.filter(({ name }) => names.includes(name));
  if (chosen.length === 0) return [];
  const all = chosen.map(({ code }) => code);
  if (!names.includes('github')) return [list('reporter: ', all, ',', '  ')];

  // The github reporter prints workflow commands, which are only noise outside GitHub Actions.
  const local = chosen.filter(({ name }) => name !== 'github').map(({ code }) => code);
  const otherwise = local.length > 0 ? local : ["['list']"];
  const inline = `  reporter: process.env.CI ? [${all.join(', ')}] : [${otherwise.join(', ')}],`;
  if (inline.length <= PRINT_WIDTH && !mustBreak(all) && !mustBreak(otherwise)) return [inline];
  // Prettier indents a list inside a ternary branch one level deeper than the branch.
  return [
    '  reporter: process.env.CI',
    list('? ', all, '', '    ', '      '),
    list(': ', otherwise, ',', '    ', '      '),
  ];
}

function projectLines(options: ConfigOptions) {
  const browsers = BROWSERS.filter(({ name }) => options.browsers.includes(name)).map(
    ({ name, device, channel }) => {
      const extra = channel ? `, channel: '${channel}'` : '';
      return `{ name: '${name}', use: { ...devices['${device}']${extra} } }`;
    },
  );
  const devices = DEVICES.filter(({ name }) => options.devices.includes(name)).map(
    ({ name }) => `{ name: '${name}', use: { ...devices['${name}'] } }`,
  );
  const projects = [...browsers, ...devices];
  if (projects.length === 0) return [];
  // Prettier always breaks a list of two or more objects.
  if (projects.length === 1) return [`  projects: [${projects[0]}],`];
  return ['  projects: [', ...projects.map((project) => `    ${project},`), '  ],'];
}

export function projectCount({ browsers, devices }: ConfigOptions) {
  return browsers.length + devices.length;
}

export function generateConfig(options: ConfigOptions) {
  const { retriesCI, retriesLocal, trace } = options;
  const retries =
    retriesCI === retriesLocal ? `${retriesCI}` : `process.env.CI ? ${retriesCI} : ${retriesLocal}`;
  const imports = projectCount(options) > 0 ? 'defineConfig, devices' : 'defineConfig';

  return [
    `import { ${imports} } from '@playwright/test';`,
    '',
    'export default defineConfig({',
    "  testDir: './tests',",
    '  fullyParallel: true,',
    '  forbidOnly: !!process.env.CI,',
    `  retries: ${retries},`,
    ...reporterLines(options.reporters),
    '  use: {',
    `    trace: '${trace}',`,
    '  },',
    ...projectLines(options),
    '});',
    '',
  ].join('\n');
}

/** The browsers this config needs, as the command that downloads them. */
export function installCommand(options: ConfigOptions) {
  const needed = new Set([
    ...BROWSERS.filter(({ name }) => options.browsers.includes(name)).map(({ install }) => install),
    ...DEVICES.filter(({ name }) => options.devices.includes(name)).map(({ install }) => install),
  ]);
  // With no projects, Playwright runs one default Chromium project.
  if (needed.size === 0) needed.add('chromium');
  const order = ['chromium', 'firefox', 'webkit', 'chrome', 'msedge'];
  return `npx playwright install ${order.filter((name) => needed.has(name)).join(' ')}`;
}

/** Choices that are valid but probably don't do what the visitor expects. Text uses `backticks` for code. */
export function configNotes(options: ConfigOptions): ConfigNote[] {
  const { trace, retriesCI, retriesLocal, reporters } = options;
  const notes: ConfigNote[] = [];

  if (trace === 'on-first-retry' || trace === 'on-all-retries') {
    if (retriesCI === 0 && retriesLocal === 0) {
      notes.push({
        level: 'warn',
        text: `\`${trace}\` only records during a retry, and retries are 0, so no trace is ever saved.`,
      });
    } else if (retriesCI === 0) {
      notes.push({
        level: 'warn',
        text: `\`${trace}\` only records during a retry, and CI has 0 retries, so CI failures have no trace.`,
      });
    }
  }

  const terminal = reporters.filter((name) => ['list', 'line', 'dot'].includes(name));
  if (terminal.length > 1) {
    const names = terminal.map((name) => `\`${name}\``).join(' and ');
    notes.push({
      level: 'warn',
      text: `${names} all write to the terminal, so their output gets mixed. Keep one.`,
    });
  }

  if (reporters.length === 0) {
    notes.push({
      level: 'info',
      text: 'No reporter chosen, so Playwright uses its default: `list` locally and `dot` on CI.',
    });
  }

  if (projectCount(options) === 0) {
    notes.push({
      level: 'info',
      text: 'No browser or device chosen, so Playwright runs one default Chromium project.',
    });
  }

  return notes;
}
