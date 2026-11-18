#!/usr/bin/env node
// Works through ROADMAP.md unattended: one fresh Claude session per task, verified before moving on.
// Commits stay on local main. Pushing is disabled for every session this script starts.
//
//   pnpm roadmap              run until the roadmap is finished or a task fails
//   pnpm roadmap --max 3      run at most 3 tasks
//   pnpm roadmap --model sonnet   use another model (default: opus)
//   pnpm roadmap --dry-run    show the next task and exit
//
// To stop cleanly after the current task, create the stop file: touch .roadmap/stop
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_DIR = path.join(ROOT, '.roadmap');
const LOG_DIR = path.join(RUN_DIR, 'logs');
const STOP_FILE = path.join(RUN_DIR, 'stop');
const TEST_PORT = 4322; // Playwright reuses a server on this port, which could serve a stale build.
const CLAUDE_BIN = process.env.ROADMAP_CLAUDE_BIN ?? 'claude';
const DEFAULT_MODEL = 'opus'; // Set explicitly: the CLI's own default model may need usage credits.

const ALLOWED_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash(pnpm:*)',
  'Bash(node:*)',
  'Bash(ls:*)',
  'Bash(mkdir:*)',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'WebFetch(domain:playwright.dev)',
  'WebFetch(domain:docs.astro.build)',
];
const DISALLOWED_TOOLS = [
  'Bash(git push:*)',
  'Bash(git checkout:*)',
  'Bash(git switch:*)',
  'Bash(git reset:*)',
];

const VERIFY_STEPS = [
  ['pnpm', ['check']],
  ['pnpm', ['format:check']],
  ['pnpm', ['test']],
];

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** The first task still open in ROADMAP.md: `- [ ]` or partly done `- [~]`, with its wrapped lines. */
function nextTask() {
  const lines = readFileSync(path.join(ROOT, 'ROADMAP.md'), 'utf8').split('\n');
  const start = lines.findIndex((line) => /^- \[[ ~]\] /.test(line));
  if (start === -1) return null;
  const parts = [lines[start].replace(/^- \[[ ~]\] /, '')];
  for (let i = start + 1; /^\s+\S/.test(lines[i] ?? ''); i++) parts.push(lines[i].trim());
  return parts.join(' ');
}

function promptFor(task) {
  return `You are running unattended in a fresh session. Complete exactly one roadmap task, then stop.

Task: ${task}

Follow "How to work in this repo" in CLAUDE.md, including ticking the task in ROADMAP.md.
- Commit on the current main branch. Never push and never create a branch.
- Nobody can answer questions. Make the sensible decision and record it in the ROADMAP.md notes.
- Leave the working tree clean: every change committed, no stray files.
- If the task cannot be finished properly, do not tick it and do not commit. End your reply with
  a line starting "BLOCKED:" that gives the reason.`;
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: 'localhost' });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

/** Runs a command, copying its output to the terminal and the log. Resolves with the exit code. */
function run(command, args, { log, env = process.env }) {
  return new Promise((resolve) => {
    log.write(`\n$ ${command} ${args[0] ?? ''}\n`);
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => {
        process.stdout.write(chunk);
        log.write(chunk);
      });
    }
    child.once('error', (error) => {
      log.write(`${error.message}\n`);
      resolve(1);
    });
    child.once('close', (code) => resolve(code ?? 1));
  });
}

function sessionEnv() {
  const env = {
    ...process.env,
    // A hard stop on pushing: any push from these sessions goes to an address that can't exist.
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'remote.origin.pushurl',
    GIT_CONFIG_VALUE_0: 'file:///dev/null/pushing-is-disabled',
  };
  delete env.CLAUDECODE; // Lets the runner start from a terminal inside a Claude session.
  return env;
}

/** Returns why the repo isn't safe to work in, or null when it is. */
function repoProblem() {
  const branch = git('branch', '--show-current');
  if (branch !== 'main') return `expected to be on main, but on "${branch}"`;
  const dirty = git('status', '--porcelain');
  if (dirty) return `the working tree has uncommitted changes:\n${dirty}`;
  return null;
}

async function runTask(task, number, model) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(LOG_DIR, `${stamp}-task-${number}.log`);
  const log = createWriteStream(logPath);
  const fail = (reason) => ({ ok: false, reason, logPath });
  const before = git('rev-parse', 'HEAD');

  const code = await run(
    CLAUDE_BIN,
    [
      '-p',
      promptFor(task),
      '--model',
      model,
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      ALLOWED_TOOLS.join(','),
      '--disallowedTools',
      DISALLOWED_TOOLS.join(','),
    ],
    { log, env: sessionEnv() },
  );

  try {
    if (code !== 0) return fail(`the Claude session exited with code ${code}`);
    if (git('rev-parse', 'HEAD') === before) return fail('the session made no commit (it may be blocked)');
    const problem = repoProblem();
    if (problem) return fail(`after the session, ${problem}`);
    if (nextTask() === task) return fail('the task is still open in ROADMAP.md');

    for (const [command, args] of VERIFY_STEPS) {
      console.log(`\n[roadmap] verifying: ${command} ${args.join(' ')}`);
      const exit = await run(command, args, { log });
      if (exit !== 0) return fail(`"${command} ${args.join(' ')}" failed`);
    }
    return { ok: true, logPath };
  } finally {
    log.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      max: { type: 'string' },
      model: { type: 'string', default: DEFAULT_MODEL },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const max = values.max === undefined ? Infinity : Number(values.max);
  if (!(max >= 1) || (max !== Infinity && !Number.isInteger(max))) {
    console.error('[roadmap] --max must be a whole number of 1 or more');
    return 2;
  }

  if (values['dry-run']) {
    console.log(`[roadmap] next task: ${nextTask() ?? '(roadmap finished)'}`);
    return 0;
  }

  mkdirSync(LOG_DIR, { recursive: true });
  rmSync(STOP_FILE, { force: true });

  for (let done = 0; done < max; done++) {
    const task = nextTask();
    if (!task) {
      console.log('[roadmap] finished: no open tasks left.');
      return 0;
    }
    if (existsSync(STOP_FILE)) {
      rmSync(STOP_FILE);
      console.log(`[roadmap] stopped by request after ${done} task(s).`);
      return 0;
    }
    const problem = repoProblem();
    if (problem) {
      console.error(`[roadmap] not starting: ${problem}`);
      return 1;
    }
    if (await portInUse(TEST_PORT)) {
      console.error(`[roadmap] not starting: port ${TEST_PORT} is in use, so tests could hit a stale build.`);
      return 1;
    }

    console.log(`\n[roadmap] task ${done + 1} (${values.model}): ${task}`);
    const result = await runTask(task, done + 1, values.model);
    if (!result.ok) {
      console.error(`\n[roadmap] stopped: ${result.reason}\n[roadmap] log: ${result.logPath}`);
      return 1;
    }
    console.log(`[roadmap] passed: ${git('log', '-1', '--format=%h %s')}`);
  }

  console.log(`[roadmap] reached the limit of ${max} task(s).`);
  return 0;
}

process.exitCode = await main();
