// The auto-waiting explainer's data. Pure, and tests/auto-waiting.spec.ts replays it on real Playwright:
// every call log line below `expectedCallLog` and every row of ACTIONS is checked against the real thing.

export type CheckName = 'visible' | 'stable' | 'enabled' | 'editable' | 'receives events';
export type CheckState = 'idle' | 'blocked' | 'passed';
export type PageState =
  'absent' | 'hidden' | 'moving' | 'disabled' | 'covered' | 'readonly' | 'ready' | 'done';
export type Outcome = 'running' | 'passed' | 'failed';

export const CHECKS: { name: CheckName; meaning: string }[] = [
  { name: 'visible', meaning: 'It has a non-empty box and is not `visibility: hidden`.' },
  { name: 'stable', meaning: 'Its box stayed the same across two animation frames in a row.' },
  { name: 'enabled', meaning: 'It is not disabled, directly or through a disabled `fieldset`.' },
  { name: 'editable', meaning: 'It is enabled and not `readonly`.' },
  { name: 'receives events', meaning: 'It is the element a real pointer would hit at the action point.' },
];

const POINTER: CheckName[] = ['visible', 'stable', 'enabled', 'receives events'];

/** Which checks each action waits for. Actions that wait for nothing still wait for the element to exist. */
export const ACTIONS: { name: string; checks: CheckName[] }[] = [
  { name: 'click()', checks: POINTER },
  { name: 'dblclick()', checks: POINTER },
  { name: 'check()', checks: POINTER },
  { name: 'uncheck()', checks: POINTER },
  { name: 'hover()', checks: ['visible', 'stable', 'receives events'] },
  { name: 'screenshot()', checks: ['visible', 'stable'] },
  { name: 'fill()', checks: ['visible', 'enabled', 'editable'] },
  { name: 'clear()', checks: ['visible', 'enabled', 'editable'] },
  { name: 'selectOption()', checks: ['visible', 'enabled'] },
  { name: 'selectText()', checks: ['visible'] },
  { name: 'scrollIntoViewIfNeeded()', checks: ['visible', 'stable'] },
  { name: 'focus()', checks: [] },
  { name: 'press()', checks: [] },
  { name: 'dispatchEvent()', checks: [] },
];

export interface Scenario {
  id: string;
  label: string;
  action: 'click' | 'fill';
  selector: string;
  code: string;
  /** What is wrong at the start. `attached` means no element matches yet. */
  blocker: CheckName | 'attached' | null;
  /** When the app fixes the problem, in ms. `null` means it never does. */
  releaseAt: number | null;
  startPage: PageState;
  /** How Playwright prints the element once the locator resolves. */
  resolvedTag: string;
  /** What the app does when the problem clears. */
  change: string;
  /** The page to replay on real Playwright, and the script that clears the problem. */
  html: string;
  release: string;
}

const SAVE = `page.locator('#save')`;
const BUTTON = '<button id="save">Save</button>';
const save = "document.getElementById('save')";

export const SCENARIOS: Scenario[] = [
  {
    id: 'ready',
    label: 'already ready',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click();`,
    blocker: null,
    releaseAt: 0,
    startPage: 'ready',
    resolvedTag: BUTTON,
    change: '',
    html: BUTTON,
    release: '',
  },
  {
    id: 'late',
    label: 'rendered late',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click();`,
    blocker: 'attached',
    releaseAt: 700,
    startPage: 'absent',
    resolvedTag: BUTTON,
    change: 'The framework finishes rendering and the button joins the DOM.',
    html: '<main id="app"></main>',
    release: `document.getElementById('app').innerHTML = '${BUTTON}';`,
  },
  {
    id: 'hidden',
    label: 'hidden at first',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click();`,
    blocker: 'visible',
    releaseAt: 700,
    startPage: 'hidden',
    resolvedTag: BUTTON,
    change: 'The app removes `display: none`, so the button now has a box.',
    html: '<button id="save" style="display: none">Save</button>',
    release: `${save}.style.display = '';`,
  },
  {
    id: 'moving',
    label: 'still animating',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click();`,
    blocker: 'stable',
    releaseAt: 700,
    startPage: 'moving',
    resolvedTag: BUTTON,
    change: 'The slide-in animation ends and the button stops moving.',
    html: `<style>@keyframes slide { from { margin-left: 0 } to { margin-left: 200px } }
#save { animation: slide 0.2s linear infinite alternate }</style>${BUTTON}`,
    release: `${save}.style.animation = 'none';`,
  },
  {
    id: 'disabled',
    label: 'disabled until valid',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click();`,
    blocker: 'enabled',
    releaseAt: 700,
    startPage: 'disabled',
    resolvedTag: '<button disabled id="save">Save</button>',
    change: 'Validation passes and the app removes the `disabled` attribute.',
    html: '<button id="save" disabled>Save</button>',
    release: `${save}.disabled = false;`,
  },
  {
    id: 'covered',
    label: 'covered by a spinner',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click();`,
    blocker: 'receives events',
    releaseAt: 700,
    startPage: 'covered',
    resolvedTag: BUTTON,
    change: 'Loading ends and the app removes the overlay.',
    html: `${BUTTON}<div id="veil" style="position: fixed; inset: 0"></div>`,
    release: `document.getElementById('veil').remove();`,
  },
  {
    id: 'readonly',
    label: 'read-only input',
    action: 'fill',
    selector: '#name',
    code: `await page.locator('#name').fill('Ada');`,
    blocker: 'editable',
    releaseAt: 700,
    startPage: 'readonly',
    resolvedTag: '<input readonly id="name"/>',
    change: 'The saved profile loads and the app removes `readonly`.',
    html: '<label>Name <input id="name" readonly></label>',
    release: `document.getElementById('name').readOnly = false;`,
  },
  {
    id: 'timeout',
    label: 'never enabled (timeout)',
    action: 'click',
    selector: '#save',
    code: `await ${SAVE}.click({ timeout: 5000 });`,
    blocker: 'enabled',
    releaseAt: null,
    startPage: 'disabled',
    resolvedTag: '<button disabled id="save">Save</button>',
    change: '',
    html: '<button id="save" disabled>Save</button>',
    release: '',
  },
];

export interface Step {
  title: string;
  time: string;
  detail: string;
  log: string[];
  page: PageState;
  checks: Partial<Record<CheckName, CheckState>>;
  outcome: Outcome;
}

/** The checks an action runs together, in the order Playwright reports them. */
const gatesFor = (action: Scenario['action']): CheckName[] =>
  action === 'click' ? ['visible', 'enabled', 'stable'] : ['visible', 'enabled', 'editable'];

const gateLine = (action: Scenario['action']) =>
  `waiting for element to be ${action === 'click' ? 'visible, enabled and stable' : 'visible, enabled and editable'}`;

const VEIL_LINE = '<div id="veil"></div> intercepts pointer events';

/** The lines real Playwright must print while this scenario is stuck. */
export function expectedCallLog(scenario: Scenario): string[] {
  const { action, blocker, selector, resolvedTag } = scenario;
  const waiting = `waiting for locator('${selector}')`;
  if (blocker === 'attached') return [waiting];
  const lines = [
    waiting,
    `locator resolved to ${resolvedTag}`,
    `attempting ${action} action`,
    gateLine(action),
  ];
  if (blocker === 'receives events') lines.push(VEIL_LINE);
  else if (blocker) lines.push(`element is not ${blocker}`);
  if (blocker) lines.push(`retrying ${action} action`);
  return lines;
}

export function buildSteps(scenario: Scenario): Step[] {
  const { action, blocker, releaseAt, selector, resolvedTag, change } = scenario;
  const gates = gatesFor(action);
  const checks: Step['checks'] = {};
  for (const name of gates) checks[name] = 'idle';
  if (action === 'click') checks['receives events'] = 'idle';

  const steps: Step[] = [];
  let page = scenario.startPage;
  const push = (step: Pick<Step, 'title' | 'time' | 'detail' | 'log'> & { outcome?: Outcome }) =>
    steps.push({ outcome: 'running', ...step, page, checks: { ...checks } });

  const appCatchesUp = (log: string[] = []) => {
    page = 'ready';
    push({ title: 'The app catches up', time: `${releaseAt}ms`, detail: change, log });
  };
  const retry = (detail: string) =>
    push({
      title: 'Wait and retry',
      time: 'retrying',
      detail,
      log: [`retrying ${action} action`, 'waiting 20ms', 'waiting 100ms', 'waiting 500ms'],
    });
  const passLine = action === 'click' ? ['element is visible, enabled and stable'] : [];
  const backOff =
    'Playwright runs the checks again after 20ms, then 100ms, then every 500ms. Your test needs no sleep.';

  // 1. Find the element.
  const waiting = `waiting for locator('${selector}')`;
  if (blocker === 'attached') {
    push({
      title: 'Find the element',
      time: '0ms',
      detail: 'Nothing matches the locator yet. That is not an error: Playwright keeps looking.',
      log: [waiting],
    });
    appCatchesUp([`locator resolved to ${resolvedTag}`]);
  } else {
    push({
      title: 'Find the element',
      time: '0ms',
      detail: 'The locator matches exactly one element, so strict mode is satisfied.',
      log: [waiting, `locator resolved to ${resolvedTag}`, ...(action === 'fill' ? ['fill("Ada")'] : [])],
    });
  }

  // 2. Run the checks that look at the element alone.
  const attempt = [`attempting ${action} action`, gateLine(action)];
  const failedGate = gates.indexOf(blocker as CheckName);
  if (failedGate >= 0) {
    gates.slice(0, failedGate).forEach((name) => (checks[name] = 'passed'));
    checks[gates[failedGate]] = 'blocked';
    push({
      title: `Check: ${gates[failedGate]}`,
      time: '0ms',
      detail: `The element is not ${gates[failedGate]}, so Playwright holds the action back.`,
      log: [...attempt, `element is not ${gates[failedGate]}`],
    });
    retry(backOff);

    if (releaseAt === null) {
      push({
        title: 'Timeout',
        time: '5000ms',
        detail:
          'The element never became enabled, so the action fails. The error includes this call log, which names the check that blocked it.',
        log: [`locator.${action}: Timeout 5000ms exceeded.`],
        outcome: 'failed',
      });
      return steps;
    }
    appCatchesUp();
    for (const name of gates) checks[name] = 'passed';
    push({
      title: 'Checks pass',
      time: 'next retry',
      detail: 'The next retry finds every check satisfied.',
      log: [gateLine(action), ...passLine],
    });
  } else {
    for (const name of gates) checks[name] = 'passed';
    push({
      title: 'Run the checks',
      time: 'next',
      detail: `The element is ${gates.slice(0, -1).join(', ')} and ${gates.at(-1)}.`,
      log: [...attempt, ...passLine],
    });
  }

  // 3. Pointer actions also scroll to the element and confirm it would receive the event.
  if (action === 'click') {
    const scrolling = ['scrolling into view if needed', 'done scrolling'];
    if (blocker === 'receives events') {
      checks['receives events'] = 'blocked';
      push({
        title: 'Check: receives events',
        time: 'next',
        detail: 'Another element sits on top, so a real click would land on the overlay instead.',
        log: [...scrolling, VEIL_LINE],
      });
      retry(`${backOff} Each retry repeats every check from the start.`);
      appCatchesUp();
      checks['receives events'] = 'passed';
      push({
        title: 'Checks pass',
        time: 'next retry',
        detail: 'The button is now what a pointer would hit at its center.',
        log: [gateLine(action), ...passLine, ...scrolling],
      });
    } else {
      checks['receives events'] = 'passed';
      push({
        title: 'Scroll and hit test',
        time: 'next',
        detail: 'Playwright scrolls the element into view and confirms a pointer would hit it.',
        log: scrolling,
      });
    }
  }

  // 4. Act.
  page = 'done';
  push({
    title: `Perform the ${action}`,
    time: 'done',
    detail:
      action === 'click'
        ? 'Every check passed, so Playwright sends a real click.'
        : 'Every check passed, so Playwright focuses the input, sets its value and fires the `input` event.',
    log: action === 'click' ? ['performing click action', 'click action done'] : [],
    outcome: 'passed',
  });
  return steps;
}
