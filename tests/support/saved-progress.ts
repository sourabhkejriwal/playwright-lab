import type { FlashcardProgress, QuizProgress } from '../../src/stores/progress';

interface SavedParts {
  chapters?: Record<string, { readAt: string }>;
  flashcards?: Record<string, FlashcardProgress>;
  quizzes?: Record<string, QuizProgress>;
}

/** The text the progress store keeps in localStorage, with only the given parts filled in. */
export const savedProgress = (parts: SavedParts = {}) =>
  JSON.stringify({ version: 1, chapters: {}, flashcards: {}, quizzes: {}, ...parts });
