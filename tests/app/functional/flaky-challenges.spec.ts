import { execFile } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { TestInfo } from '@playwright/test';
import { timeouts } from '../../../config/app';
import { test, expect } from '../../../fixtures/pom/test-options';
import { CHALLENGES, fixedLines, grade, type FlakyChallenge } from '../../../src/lib/flaky-challenges';

const run = promisify(execFile);
const cli = join(dirname(createRequire(import.meta.url).resolve('@playwright/test/package.json')), 'cli.js');
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^(PW_|PLAYWRIGHT_|TEST_|CI$|FORCE_COLOR$)/.test(key)),
);

// A retry starts a new worker, so the unlucky run of this challenge is its second test on its own.
const unluckyArgs: Record<string, string[]> = { 'order-details': ['-g', 'shows the order'] };

function writeProject(challenge: FlakyChallenge, testInfo: TestInfo): string {
  const root = testInfo.outputPath('project');
  mkdirSync(root, { recursive: true });
  // Playwright puts test-results/ beside the nearest package.json and empties it, which must not be this repo's.
  writeFileSync(join(root, 'package.json'), '{}');
  copyFileSync(join(import.meta.dirname, '../../../helpers/app/flaky-world.ts'), join(root, 'world.ts'));
  writeFileSync(
    join(root, 'playwright.config.ts'),
    `export default { timeout: 20000, expect: { timeout: 1500 }, workers: 1, use: { baseURL: 'http://shop.test', actionTimeout: 2000 } };\n`,
  );
  const header = `import { test, expect, type Page } from './world';\n\n`;
  writeFileSync(join(root, 'flaky.spec.ts'), header + challenge.flaky);
  writeFileSync(join(root, 'fixed.spec.ts'), header + challenge.fixed);
  return root;
}

async function execute(
  root: string,
  file: string,
  timing: 'kind' | 'hostile',
  args: string[] = [],
): Promise<{ passed: boolean; log: string }> {
  // These runs share a project and overlap, so each needs its own output folder.
  const output = `results-${file}-${timing}`;
  try {
    const { stdout } = await run(
      process.execPath,
      [cli, 'test', file, '--reporter=line', `--output=${output}`, ...args],
      { cwd: root, env: { ...env, FLAKY_TIMING: timing, FORCE_COLOR: '0' } },
    );
    return { passed: true, log: stdout };
  } catch (error) {
    const { stdout, stderr } = error as { stdout: string; stderr: string };
    return { passed: false, log: `${stdout}\n${stderr}` };
  }
}

test.describe('every challenge behaves that way on real Playwright', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'the nested runs are the same on every project',
  );
  test.setTimeout(timeouts.nestedRun);

  for (const challenge of CHALLENGES) {
    test(
      `"${challenge.title}" is flaky, and its fix is not`,
      { tag: '@regression' },
      async ({}, testInfo) => {
        const root = writeProject(challenge, testInfo);
        const args = unluckyArgs[challenge.id] ?? [];
        const [lucky, unlucky, fixedLucky, fixedUnlucky] = await Promise.all([
          execute(root, 'flaky.spec.ts', 'kind'),
          execute(root, 'flaky.spec.ts', 'hostile', args),
          execute(root, 'fixed.spec.ts', 'kind'),
          execute(root, 'fixed.spec.ts', 'hostile', args),
        ]);

        expect(lucky.passed, `flaky code should pass when timing is kind:\n${lucky.log}`).toBe(true);
        expect(unlucky.passed, 'flaky code should fail when timing is hostile').toBe(false);
        for (const line of challenge.log) expect(unlucky.log).toContain(line);
        expect(fixedLucky.passed, `fix should pass when timing is kind:\n${fixedLucky.log}`).toBe(true);
        expect(fixedUnlucky.passed, `fix should pass when timing is hostile:\n${fixedUnlucky.log}`).toBe(
          true,
        );
      },
    );
  }
});

test.describe('challenge data', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  test('ids are unique, and answers and culprit lines exist', { tag: '@regression' }, () => {
    expect(new Set(CHALLENGES.map(({ id }) => id)).size).toBe(CHALLENGES.length);
    for (const challenge of CHALLENGES) {
      const lines = challenge.flaky.split('\n');
      expect(challenge.causes[challenge.answer], challenge.id).toBeDefined();
      for (const line of challenge.culprit) expect(lines[line - 1]?.trim(), challenge.id).toBeTruthy();
    }
  });

  test(
    'a challenge is solved only when the line and the cause are both right',
    { tag: '@regression' },
    () => {
      const [challenge] = CHALLENGES;
      const wrongCause = (challenge.answer + 1) % challenge.causes.length;
      expect(grade(challenge, challenge.culprit[0], challenge.answer).solved).toBe(true);
      expect(grade(challenge, challenge.culprit[0], wrongCause)).toEqual({
        line: true,
        cause: false,
        solved: false,
      });
      expect(grade(challenge, 1, challenge.answer)).toEqual({ line: false, cause: true, solved: false });
      expect(grade(challenge, null, null).solved).toBe(false);
    },
  );

  test('every fix changes at least one line', { tag: '@regression' }, () => {
    for (const challenge of CHALLENGES) {
      expect(
        fixedLines(challenge).some(({ changed }) => changed),
        challenge.id,
      ).toBe(true);
    }
  });
});

test.describe('the challenges page', () => {
  const [first, second] = CHALLENGES;
  const rightCause = (challenge: FlakyChallenge): string => challenge.causes[challenge.answer];

  test.beforeEach(async ({ flakyChallenges }) => {
    await flakyChallenges.goto(first.title);
  });

  test(
    'solving a challenge shows the fix and counts it',
    { tag: '@regression' },
    async ({ flakyChallenges }) => {
      const { result } = flakyChallenges;
      await expect(flakyChallenges.checkButton).toBeDisabled();

      await flakyChallenges.submit(first.culprit[0], rightCause(first));

      await expect(result).toBeFocused();
      await expect(result).toContainText('solved');
      await expect(result).toContainText("await expect(page.getByRole('status')).toHaveText('Saved');");
      await expect(flakyChallenges.solvedCount(1, CHALLENGES.length)).toBeVisible();

      await flakyChallenges.resultButton('next challenge').click();
      await expect(flakyChallenges.h2(second.title)).toBeFocused();
      await expect(flakyChallenges.challenge('Challenge 1, solved')).toBeVisible();
    },
  );

  test(
    'a wrong answer says which part is wrong and can be retried',
    { tag: '@regression' },
    async ({ flakyChallenges }) => {
      const { result } = flakyChallenges;
      await flakyChallenges.submit(2, rightCause(first));

      await expect(result).toContainText('not quite');
      await expect(result).toContainText('The line is wrong.');
      await expect(result).toContainText('The cause is right.');
      await expect(result).not.toContainText('the fix');

      await flakyChallenges.resultButton('try again').click();
      await expect(flakyChallenges.line(2)).not.toBeChecked();
      await expect(flakyChallenges.checkButton).toBeDisabled();
    },
  );

  test(
    'revealing the answer shows the fix without counting as solved',
    { tag: '@regression' },
    async ({ flakyChallenges }) => {
      await flakyChallenges.submit(2, rightCause(first));

      await flakyChallenges.resultButton('show the answer').click();
      await expect(flakyChallenges.result).toContainText('the fix');
      await expect(flakyChallenges.solvedCount(0, CHALLENGES.length)).toBeVisible();
    },
  );

  test(
    'the numbered buttons open any challenge and keep its answer',
    { tag: '@regression' },
    async ({ flakyChallenges }) => {
      await flakyChallenges.line(3).check();
      await flakyChallenges.challenge('Challenge 3').click();
      await expect(flakyChallenges.h2(CHALLENGES[2].title)).toBeVisible();
      await expect(flakyChallenges.challenge('Challenge 3')).toHaveAttribute('aria-current', 'step');

      await flakyChallenges.challenge('Challenge 1').click();
      await expect(flakyChallenges.line(3)).toBeChecked();
    },
  );

  test(
    'no challenge or solution scrolls sideways at 375px',
    { tag: '@regression' },
    async ({ flakyChallenges, page }) => {
      await page.setViewportSize({ width: 375, height: 800 });

      for (const [at, challenge] of CHALLENGES.entries()) {
        await flakyChallenges.challenge(`Challenge ${at + 1}`, { exact: true }).click();
        await expect(flakyChallenges.h2(challenge.title)).toBeVisible();
        expect(await flakyChallenges.horizontalOverflow(), challenge.id).toBeLessThanOrEqual(0);

        await flakyChallenges.submit(challenge.culprit[0], rightCause(challenge));
        await expect(flakyChallenges.result).toContainText('the fix');
        expect(await flakyChallenges.horizontalOverflow(), `${challenge.id} solution`).toBeLessThanOrEqual(0);
      }
      await expect(flakyChallenges.solvedCount(CHALLENGES.length, CHALLENGES.length)).toBeVisible();
    },
  );
});
