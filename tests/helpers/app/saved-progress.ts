import type { FlashcardProgress, QuizProgress } from '../../../src/stores/progress';

interface SavedParts {
  chapters?: Record<string, { readAt: string }>;
  flashcards?: Record<string, FlashcardProgress>;
  quizzes?: Record<string, QuizProgress>;
}

/**
 * Builds the text the progress store keeps in localStorage.
 *
 * @param parts - The parts of the progress to fill in; the rest stay empty.
 * @returns The JSON text to seed into localStorage.
 */
export function savedProgress(parts: SavedParts = {}): string {
  return JSON.stringify({ version: 1, chapters: {}, flashcards: {}, quizzes: {}, ...parts });
}
