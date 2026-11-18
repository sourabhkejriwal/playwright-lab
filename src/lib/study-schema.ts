import { z } from 'astro/zod';
import { chapters } from '../data/chapters';

/**
 * Flashcards and quizzes, one JSON file per chapter:
 *   src/content/flashcards/<NN>-<slug>.json
 *   src/content/quizzes/<NN>-<slug>.json
 *
 * Text fields are plain text; wrap code in `backticks`.
 */

const text = z.string().trim().min(1);

const chapterNumber = z
  .number()
  .int()
  .refine((num) => chapters.some((chapter) => chapter.num === num), 'Unknown chapter number');

const slugOf = (num: number) => chapters.find((chapter) => chapter.num === num)?.slug;

const firstDuplicate = (values: string[]) => values.find((value, index) => values.indexOf(value) !== index);

const flashcard = z.strictObject({
  // The key for the visitor's saved schedule, so renaming a card resets its progress.
  id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'Use "<chapter-slug>/<kebab-case-name>"'),
  front: text,
  back: text,
});

export const flashcardDeckSchema = z
  .strictObject({
    chapter: chapterNumber,
    cards: z.array(flashcard).min(1),
  })
  .superRefine(({ chapter, cards }, ctx) => {
    const slug = slugOf(chapter);
    cards.forEach((card, index) => {
      if (slug && !card.id.startsWith(`${slug}/`)) {
        ctx.addIssue({
          code: 'custom',
          message: `Card id must start with "${slug}/"`,
          path: ['cards', index, 'id'],
        });
      }
    });
    const duplicate = firstDuplicate(cards.map((card) => card.id));
    if (duplicate) {
      ctx.addIssue({ code: 'custom', message: `Duplicate card id "${duplicate}"`, path: ['cards'] });
    }
  });

const quizQuestion = z
  .strictObject({
    question: text,
    options: z.array(text).min(2).max(6),
    answer: z.number().int().min(0), // index into options
    explanation: text, // shown after answering, whichever option was picked
  })
  .superRefine(({ options, answer }, ctx) => {
    if (answer >= options.length) {
      ctx.addIssue({ code: 'custom', message: 'Answer must be an index into options', path: ['answer'] });
    }
    const duplicate = firstDuplicate(options);
    if (duplicate) {
      ctx.addIssue({ code: 'custom', message: `Duplicate option "${duplicate}"`, path: ['options'] });
    }
  });

export const quizSchema = z
  .strictObject({
    chapter: chapterNumber,
    questions: z.array(quizQuestion).min(1),
  })
  .superRefine(({ questions }, ctx) => {
    const duplicate = firstDuplicate(questions.map((question) => question.question));
    if (duplicate) {
      ctx.addIssue({ code: 'custom', message: `Duplicate question "${duplicate}"`, path: ['questions'] });
    }
  });

export type FlashcardDeck = z.infer<typeof flashcardDeckSchema>;
export type Quiz = z.infer<typeof quizSchema>;
