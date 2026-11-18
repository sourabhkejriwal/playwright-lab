import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { flashcardDeckSchema, quizSchema } from './lib/study-schema';

// One MDX file per chapter: src/content/chapters/<NN>-<slug>.mdx
const chapters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/chapters' }),
  schema: z.object({
    chapter: z.number().int().min(1).max(16),
    title: z.string(),
    summary: z.string(),
    readingMinutes: z.number().int().positive().optional(),
    draft: z.boolean().default(false),
  }),
});

// One JSON file per chapter, named like the chapter's MDX file.
const flashcards = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/flashcards' }),
  schema: flashcardDeckSchema,
});

const quizzes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/quizzes' }),
  schema: quizSchema,
});

export const collections = { chapters, flashcards, quizzes };
