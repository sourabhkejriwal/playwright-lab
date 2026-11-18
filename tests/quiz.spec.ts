import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { shuffleOptions, type QuizQuestion } from '../src/lib/quiz';
import { PROGRESS_STORAGE_KEY as KEY, type QuizProgress } from '../src/stores/progress';

const { questions }: { questions: QuizQuestion[] } = JSON.parse(
  readFileSync(new URL('../src/content/quizzes/02-selectors.json', import.meta.url), 'utf8'),
);
const total = questions.length;
const plain = (text: string) => text.replaceAll('`', '');
const rightOption = (question: QuizQuestion) => plain(question.options[question.answer]);
const wrongOption = (question: QuizQuestion) => plain(question.options[question.answer === 0 ? 1 : 0]);

test.describe('option shuffling', () => {
  test.skip(({ isMobile }) => isMobile, 'no browser involved, so one project is enough');

  test('the answer follows its option wherever it lands', () => {
    for (const value of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      for (const question of questions) {
        const shuffled = shuffleOptions(question, () => value);
        expect(shuffled.options.toSorted()).toEqual(question.options.toSorted());
        expect(shuffled.options[shuffled.answer]).toBe(question.options[question.answer]);
      }
    }
  });

  test('the original question is left alone', () => {
    const before = structuredClone(questions[0]);
    shuffleOptions(questions[0], () => 0);
    expect(questions[0]).toEqual(before);
  });
});

test.describe('chapter quiz', () => {
  const quiz = (page: Page) => page.getByRole('region', { name: 'Chapter quiz' });
  const button = (page: Page, name: string) => quiz(page).getByRole('button', { name, exact: true });
  const option = (page: Page, name: string) => quiz(page).getByRole('radio', { name, exact: true });
  const explanation = (page: Page) => quiz(page).getByRole('group', { name: 'Explanation' });

  /** The island hydrates when it scrolls into view, as it does for a visitor reaching the end of the notes. */
  async function visit(page: Page) {
    await page.goto('/chapters/02-selectors');
    await quiz(page).scrollIntoViewIfNeeded();
  }

  async function open(page: Page) {
    await visit(page);
    await button(page, 'start quiz').click();
  }

  async function answer(page: Page, name: string) {
    await option(page, name).check();
    await button(page, 'check answer').click();
  }

  /** Answers every question, getting the first `right` of them right, and stops on the last explanation. */
  async function answerAll(page: Page, right: number) {
    for (const [index, question] of questions.entries()) {
      await answer(page, index < right ? rightOption(question) : wrongOption(question));
      if (index < total - 1) await button(page, 'next question').click();
    }
  }

  const savedQuiz = (page: Page) =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').quizzes?.selectors, KEY);

  test('an answer must be chosen before it can be checked', async ({ page }) => {
    await open(page);
    await expect(quiz(page).getByText(`question 1 of ${total}`)).toBeVisible();
    await expect(quiz(page).getByRole('group', { name: plain(questions[0].question) })).toBeVisible();
    await expect(button(page, 'check answer')).toBeDisabled();
    await option(page, rightOption(questions[0])).check();
    await expect(button(page, 'check answer')).toBeEnabled();
    await expect(explanation(page)).toBeHidden();
  });

  test('a right answer is confirmed and explained', async ({ page }) => {
    await open(page);
    await answer(page, rightOption(questions[0]));
    await expect(explanation(page)).toContainText('correct');
    await expect(explanation(page)).toContainText(plain(questions[0].explanation));
    await expect(quiz(page).getByText('your answer')).toBeHidden();
  });

  test('a wrong answer shows the right one, and the choice is locked', async ({ page }) => {
    await open(page);
    await answer(page, wrongOption(questions[0]));
    await expect(explanation(page)).toContainText('not quite');
    await expect(quiz(page).getByRole('radio', { name: /your answer$/ })).toBeChecked();
    await expect(quiz(page).getByRole('radio', { name: /correct answer$/ })).not.toBeChecked();
    for (const radio of await quiz(page).getByRole('radio').all()) await expect(radio).toBeDisabled();
  });

  test('code in backticks renders as code', async ({ page }) => {
    await open(page);
    await expect(quiz(page).locator('label code', { hasText: "page.locator('.btn-primary')" })).toBeVisible();
  });

  test('finishing shows the score and saves it', async ({ page }) => {
    await open(page);
    await answerAll(page, 3);
    await button(page, 'see score').click();

    await expect(quiz(page).getByRole('heading', { name: `3/${total} correct` })).toBeFocused();
    await expect(quiz(page).getByText(`last 3/${total} · best 3/${total} · 1 attempt`)).toBeVisible();
    expect(await savedQuiz(page)).toMatchObject({
      last: { score: 3, total },
      best: { score: 3, total },
      attempts: 1,
    });

    await visit(page);
    await expect(quiz(page).getByText(`last 3/${total} · best 3/${total} · 1 attempt`)).toBeVisible();
    await expect(button(page, 'retake quiz')).toBeVisible();
  });

  test('the score counts once the last answer is checked', async ({ page }) => {
    await open(page);
    await answerAll(page, total);
    await expect(button(page, 'see score')).toBeVisible();
    expect(await savedQuiz(page)).toMatchObject({ last: { score: total, total } });
  });

  test('a lower retake keeps the best score', async ({ page }) => {
    const saved: QuizProgress = {
      last: { score: 4, total },
      best: { score: 4, total },
      attempts: 1,
      takenAt: '2026-11-01T00:00:00.000Z',
    };
    const raw = JSON.stringify({ version: 1, chapters: {}, flashcards: {}, quizzes: { selectors: saved } });
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('seeded')) localStorage.setItem(key, value);
        sessionStorage.setItem('seeded', 'yes');
      },
      [KEY, raw],
    );
    await visit(page);
    await expect(quiz(page).getByText(`last 4/${total} · best 4/${total} · 1 attempt`)).toBeVisible();

    await button(page, 'retake quiz').click();
    await answerAll(page, 1);
    await button(page, 'see score').click();
    await expect(quiz(page).getByText(`last 1/${total} · best 4/${total} · 2 attempts`)).toBeVisible();

    await button(page, 'retake quiz').click();
    await expect(quiz(page).getByText(`question 1 of ${total}`)).toBeVisible();
    await expect(button(page, 'check answer')).toBeDisabled();
  });

  test('long options wrap instead of widening a 375px page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await open(page);
    await answer(page, rightOption(questions[0]));
    await expect(explanation(page)).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('a keyboard user can work through a question', async ({ page, isMobile }) => {
    test.skip(isMobile, 'covers keyboard use only');
    await visit(page);
    await button(page, 'start quiz').focus();
    await page.keyboard.press('Enter');
    const heading = quiz(page).getByRole('heading', { name: plain(questions[0].question) });
    await expect(heading).toBeFocused();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(quiz(page).getByRole('radio', { checked: true })).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(explanation(page)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(button(page, 'next question')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(quiz(page).getByRole('heading', { name: plain(questions[1].question) })).toBeFocused();
  });

  test.describe('accessibility', () => {
    test.use({ reducedMotion: 'reduce' });

    const violations = async (page: Page) =>
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;

    for (const theme of ['dark', 'light']) {
      test(`no detectable a11y violations through a quiz in the ${theme} theme`, async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('playwright-lab:theme', value), theme);
        await open(page);
        await expect(button(page, 'check answer')).toBeVisible();
        expect(await violations(page)).toEqual([]);

        await answer(page, wrongOption(questions[0]));
        await expect(explanation(page)).toBeVisible();
        expect(await violations(page)).toEqual([]);

        await button(page, 'next question').click();
        for (const question of questions.slice(1)) {
          await answer(page, rightOption(question));
          if (question !== questions.at(-1)) await button(page, 'next question').click();
        }
        await button(page, 'see score').click();
        await expect(quiz(page).getByRole('heading', { name: /correct$/ })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
    }
  });
});
