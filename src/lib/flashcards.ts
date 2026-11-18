import type { FlashcardGrade, FlashcardProgress, FlashcardReview } from '../stores/progress';

/**
 * Spaced repetition for the flashcards page. Everything here is pure, so the maths can be tested without a browser.
 *
 * "again" keeps a card due right away. "good" and "easy" grow its interval, and cards fall due at local midnight, so a
 * card reviewed late in the evening with a one-day interval is ready the next morning.
 */

export const MAX_INTERVAL_DAYS = 365;
export const ALL_CHAPTERS = 'all';

const DAY_MS = 86_400_000;
const FIRST_INTERVAL: Record<Exclude<FlashcardGrade, 'again'>, number> = { good: 1, easy: 4 };
const GROWTH: Record<Exclude<FlashcardGrade, 'again'>, number> = { good: 2.5, easy: 4 };

export interface Card {
  id: string;
  front: string;
  back: string;
}

export interface Deck {
  slug: string;
  label: string;
  cards: Card[];
}

type SavedCards = Record<string, FlashcardProgress>;

const savedCard = (saved: SavedCards, id: string) => (Object.hasOwn(saved, id) ? saved[id] : undefined);

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** The next interval in days. A card with no interval yet (new, or just failed) starts over. */
export function nextInterval(grade: FlashcardGrade, previousDays = 0): number {
  if (grade === 'again') return 0;
  if (previousDays <= 0) return FIRST_INTERVAL[grade];
  const grown = Math.max(previousDays + 1, Math.round(previousDays * GROWTH[grade]));
  return Math.min(grown, MAX_INTERVAL_DAYS);
}

export function scheduleReview(
  grade: FlashcardGrade,
  previous: FlashcardProgress | undefined,
  now: Date,
): FlashcardReview {
  const intervalDays = nextInterval(grade, previous?.intervalDays);
  if (intervalDays === 0) return { grade, intervalDays, dueAt: now.toISOString() };
  const due = startOfDay(now);
  // Calendar days rather than 24-hour blocks, so daylight saving can't shift the due date.
  due.setDate(due.getDate() + intervalDays);
  return { grade, intervalDays, dueAt: due.toISOString() };
}

export function cardsForChapter(decks: Deck[], chapter: string): Card[] {
  return decks
    .filter((deck) => chapter === ALL_CHAPTERS || deck.slug === chapter)
    .flatMap((deck) => deck.cards);
}

/** Card ids to study now: overdue cards first, oldest first, then new cards in deck order. */
export function buildQueue(cards: Card[], saved: SavedCards, now: Date): string[] {
  const seen: { id: string; dueAt: number }[] = [];
  const fresh: string[] = [];
  for (const { id } of cards) {
    const card = savedCard(saved, id);
    if (!card) fresh.push(id);
    else if (Date.parse(card.dueAt) <= now.getTime()) seen.push({ id, dueAt: Date.parse(card.dueAt) });
  }
  seen.sort((a, b) => a.dueAt - b.dueAt);
  return [...seen.map(({ id }) => id), ...fresh];
}

/** How many cards are waiting for a later day, and when the first of them falls due. */
export function upcoming(cards: Card[], saved: SavedCards, now: Date) {
  const dueTimes = cards
    .map(({ id }) => savedCard(saved, id))
    .flatMap((card) => (card ? [Date.parse(card.dueAt)] : []))
    .filter((dueAt) => dueAt > now.getTime());
  return { scheduled: dueTimes.length, nextDueAt: dueTimes.length ? new Date(Math.min(...dueTimes)) : null };
}

export function formatInterval(days: number): string {
  if (days === 0) return 'now';
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatDueDate(dueAt: Date, now: Date): string {
  // Rounded because a day with a daylight saving change isn't exactly 24 hours long.
  const days = Math.round((startOfDay(dueAt).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (days <= 0) return 'later today';
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}
