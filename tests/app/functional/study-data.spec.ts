import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '../../../fixtures/pom/test-options';
import { chapters, pad } from '../../../src/data/chapters';
import { flashcardDeckSchema, quizSchema } from '../../../src/lib/study-schema';

// These run in Node against the schemas and the committed JSON files.
test.skip(
  ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
  'no browser involved, so one project is enough',
);

const deck = {
  chapter: 2,
  cards: [{ id: 'selectors/strict-mode', front: 'Question?', back: 'Answer.' }],
};
const question = {
  question: 'Question?',
  options: ['Right', 'Wrong'],
  answer: 0,
  explanation: 'Because.',
};
const quiz = { chapter: 2, questions: [question] };

const issues = (result: { error?: { issues: { message: string }[] } }): string[] =>
  result.error?.issues.map((issue) => issue.message) ?? [];

test.describe('flashcard schema', () => {
  test('accepts a valid deck', { tag: '@regression' }, () => {
    expect(flashcardDeckSchema.safeParse(deck).success).toBe(true);
  });

  test('rejects a card id from another chapter', { tag: '@regression' }, () => {
    const cards = [{ ...deck.cards[0], id: 'fixtures/scopes' }];
    expect(issues(flashcardDeckSchema.safeParse({ ...deck, cards }))).toContain(
      'Card id must start with "selectors/"',
    );
  });

  test('rejects a duplicate card id', { tag: '@regression' }, () => {
    const cards = [deck.cards[0], deck.cards[0]];
    expect(issues(flashcardDeckSchema.safeParse({ ...deck, cards }))).toContain(
      'Duplicate card id "selectors/strict-mode"',
    );
  });

  test('rejects an unknown chapter, an empty deck, and misspelled fields', { tag: '@regression' }, () => {
    expect(flashcardDeckSchema.safeParse({ ...deck, chapter: 17 }).success).toBe(false);
    expect(flashcardDeckSchema.safeParse({ ...deck, cards: [] }).success).toBe(false);
    expect(flashcardDeckSchema.safeParse({ ...deck, card: deck.cards }).success).toBe(false);
  });
});

test.describe('quiz schema', () => {
  test('accepts a valid quiz', { tag: '@regression' }, () => {
    expect(quizSchema.safeParse(quiz).success).toBe(true);
  });

  test('rejects an answer outside the options', { tag: '@regression' }, () => {
    const questions = [{ ...question, answer: 2 }];
    expect(issues(quizSchema.safeParse({ ...quiz, questions }))).toContain(
      'Answer must be an index into options',
    );
  });

  test('rejects duplicate options and duplicate questions', { tag: '@regression' }, () => {
    const repeatedOption = [{ ...question, options: ['Same', 'Same'] }];
    expect(issues(quizSchema.safeParse({ ...quiz, questions: repeatedOption }))).toContain(
      'Duplicate option "Same"',
    );
    expect(issues(quizSchema.safeParse({ ...quiz, questions: [question, question] }))).toContain(
      'Duplicate question "Question?"',
    );
  });

  test('rejects a question without an explanation or with one option', { tag: '@regression' }, () => {
    const { explanation: _explanation, ...unexplained } = question;
    expect(quizSchema.safeParse({ ...quiz, questions: [unexplained] }).success).toBe(false);
    const oneOption = [{ ...question, options: ['Only'] }];
    expect(quizSchema.safeParse({ ...quiz, questions: oneOption }).success).toBe(false);
  });
});

test.describe('study data files', () => {
  for (const [folder, schema] of [
    ['flashcards', flashcardDeckSchema],
    ['quizzes', quizSchema],
  ] as const) {
    test(`${folder} files are valid and named after their chapter`, { tag: '@regression' }, () => {
      const dir = new URL(`../../../src/content/${folder}/`, import.meta.url);
      const files = readdirSync(dir);
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const data = schema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
        const chapter = chapters.find((meta) => meta.num === data.chapter);
        expect(file).toBe(`${pad(data.chapter)}-${chapter?.slug}.json`);
      }
    });
  }
});
