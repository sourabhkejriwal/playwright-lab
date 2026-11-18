import { readFileSync } from 'node:fs';
import { test, expect } from '../../../fixtures/pom/test-options';
import type { ChapterPage } from '../../../pages/app/chapter.page';
import type { QuizPanelComponent as QuizPanel } from '../../../pages/components/quiz-panel.component';
import { savedProgress } from '../../../helpers/app/saved-progress';
import { shuffleOptions, type QuizQuestion } from '../../../src/lib/quiz';
import type { QuizProgress } from '../../../src/stores/progress';

const { questions }: { questions: QuizQuestion[] } = JSON.parse(
  readFileSync(new URL('../../../src/content/quizzes/02-selectors.json', import.meta.url), 'utf8'),
);
const total = questions.length;
const plain = (text: string): string => text.replaceAll('`', '');
const rightOption = (question: QuizQuestion): string => plain(question.options[question.answer]);
const wrongOption = (question: QuizQuestion): string =>
  plain(question.options[question.answer === 0 ? 1 : 0]);

test.describe('option shuffling', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  test('the answer follows its option wherever it lands', { tag: '@regression' }, () => {
    for (const value of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      for (const question of questions) {
        const shuffled = shuffleOptions(question, () => value);
        expect(shuffled.options.toSorted()).toEqual(question.options.toSorted());
        expect(shuffled.options[shuffled.answer]).toBe(question.options[question.answer]);
      }
    }
  });

  test('the original question is left alone', { tag: '@regression' }, () => {
    const before = structuredClone(questions[0]);
    shuffleOptions(questions[0], () => 0);
    expect(questions[0]).toEqual(before);
  });
});

test.describe('chapter quiz', () => {
  /** The island hydrates when it scrolls into view, as it does for a visitor reaching the end of the notes. */
  async function visit(chapter: ChapterPage): Promise<void> {
    await chapter.goto('02-selectors');
    await chapter.quiz.hydrate();
  }

  async function open(chapter: ChapterPage): Promise<void> {
    await visit(chapter);
    await chapter.quiz.startButton.click();
  }

  /** Answers every question, getting the first `right` of them right, and stops on the last explanation. */
  async function answerAll(quiz: QuizPanel, right: number): Promise<void> {
    for (const [index, question] of questions.entries()) {
      await quiz.answer(index < right ? rightOption(question) : wrongOption(question));
      if (index < total - 1) await quiz.nextButton.click();
    }
  }

  const savedQuiz = async (chapter: ChapterPage): Promise<QuizProgress | undefined> =>
    (await chapter.savedProgress()).quizzes?.selectors;

  test('an answer must be chosen before it can be checked', { tag: '@regression' }, async ({ chapter }) => {
    const { quiz } = chapter;
    await open(chapter);
    await expect(quiz.text(`question 1 of ${total}`)).toBeVisible();
    await expect(quiz.questionGroup(plain(questions[0].question))).toBeVisible();
    await expect(quiz.checkButton).toBeDisabled();
    await quiz.option(rightOption(questions[0])).check();
    await expect(quiz.checkButton).toBeEnabled();
    await expect(quiz.explanation).toBeHidden();
  });

  test('a right answer is confirmed and explained', { tag: '@regression' }, async ({ chapter }) => {
    const { quiz } = chapter;
    await open(chapter);
    await quiz.answer(rightOption(questions[0]));
    await expect(quiz.explanation).toContainText('correct');
    await expect(quiz.explanation).toContainText(plain(questions[0].explanation));
    await expect(quiz.text('your answer')).toBeHidden();
  });

  test(
    'a wrong answer shows the right one, and the choice is locked',
    { tag: '@regression' },
    async ({ chapter }) => {
      const { quiz } = chapter;
      await open(chapter);
      await quiz.answer(wrongOption(questions[0]));
      await expect(quiz.explanation).toContainText('not quite');
      await expect(quiz.option(/your answer$/)).toBeChecked();
      await expect(quiz.option(/correct answer$/)).not.toBeChecked();
      for (const radio of await quiz.options.all()) await expect(radio).toBeDisabled();
    },
  );

  test('code in backticks renders as code', { tag: '@regression' }, async ({ chapter }) => {
    await open(chapter);
    await expect(chapter.quiz.optionCode("page.locator('.btn-primary')")).toBeVisible();
  });

  test('finishing shows the score and saves it', { tag: '@regression' }, async ({ chapter }) => {
    const { quiz } = chapter;
    await open(chapter);
    await answerAll(quiz, 3);
    await quiz.scoreButton.click();

    await expect(quiz.heading(`3/${total} correct`)).toBeFocused();
    await expect(quiz.text(`last 3/${total} · best 3/${total} · 1 attempt`)).toBeVisible();
    expect(await savedQuiz(chapter)).toMatchObject({
      last: { score: 3, total },
      best: { score: 3, total },
      attempts: 1,
    });

    await visit(chapter);
    await expect(quiz.text(`last 3/${total} · best 3/${total} · 1 attempt`)).toBeVisible();
    await expect(quiz.retakeButton).toBeVisible();
  });

  test('the score counts once the last answer is checked', { tag: '@regression' }, async ({ chapter }) => {
    await open(chapter);
    await answerAll(chapter.quiz, total);
    await expect(chapter.quiz.scoreButton).toBeVisible();
    expect(await savedQuiz(chapter)).toMatchObject({ last: { score: total, total } });
  });

  test('a lower retake keeps the best score', { tag: '@regression' }, async ({ chapter }) => {
    const { quiz } = chapter;
    const saved: QuizProgress = {
      last: { score: 4, total },
      best: { score: 4, total },
      attempts: 1,
      takenAt: '2026-11-01T00:00:00.000Z',
    };
    await chapter.seedProgressOnce(savedProgress({ quizzes: { selectors: saved } }));
    await visit(chapter);
    await expect(quiz.text(`last 4/${total} · best 4/${total} · 1 attempt`)).toBeVisible();

    await quiz.retakeButton.click();
    await answerAll(quiz, 1);
    await quiz.scoreButton.click();
    await expect(quiz.text(`last 1/${total} · best 4/${total} · 2 attempts`)).toBeVisible();

    await quiz.retakeButton.click();
    await expect(quiz.text(`question 1 of ${total}`)).toBeVisible();
    await expect(quiz.checkButton).toBeDisabled();
  });

  test(
    'long options wrap instead of widening a 375px page',
    { tag: '@regression' },
    async ({ chapter, page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await open(chapter);
      await chapter.quiz.answer(rightOption(questions[0]));
      await expect(chapter.quiz.explanation).toBeVisible();
      expect(await chapter.horizontalOverflow()).toBeLessThanOrEqual(0);
    },
  );

  test(
    'a keyboard user can work through a question',
    { tag: '@regression' },
    async ({ chapter, page, isMobile }) => {
      test.skip(isMobile, 'covers keyboard use only');
      const { quiz } = chapter;
      await visit(chapter);
      await quiz.startButton.focus();
      await page.keyboard.press('Enter');
      await expect(quiz.heading(plain(questions[0].question))).toBeFocused();

      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect(quiz.checkedOptions).toHaveCount(1);
      await page.keyboard.press('Enter');
      await expect(quiz.explanation).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(quiz.nextButton).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(quiz.heading(plain(questions[1].question))).toBeFocused();
    },
  );

  test.describe('accessibility', () => {
    test.use({ reducedMotion: 'reduce' });

    for (const theme of ['dark', 'light']) {
      test(
        `no detectable a11y violations through a quiz in the ${theme} theme`,
        { tag: '@regression' },
        async ({ chapter }) => {
          const { quiz } = chapter;
          await chapter.presetTheme(theme);
          await open(chapter);
          await expect(quiz.checkButton).toBeVisible();
          expect(await chapter.a11yViolations()).toEqual([]);

          await quiz.answer(wrongOption(questions[0]));
          await expect(quiz.explanation).toBeVisible();
          expect(await chapter.a11yViolations()).toEqual([]);

          await quiz.nextButton.click();
          for (const question of questions.slice(1, -1)) {
            await quiz.answer(rightOption(question));
            await quiz.nextButton.click();
          }
          await quiz.answer(rightOption(questions[questions.length - 1]));
          await quiz.scoreButton.click();
          await expect(quiz.heading(/correct$/)).toBeVisible();
          expect(await chapter.a11yViolations()).toEqual([]);
        },
      );
    }
  });
});
