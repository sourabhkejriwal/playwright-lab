import type { Quiz } from './study-schema';

export type QuizQuestion = Quiz['questions'][number];

/** Reorders a question's options and moves `answer` with them, so a retake can't be passed by position alone. */
export function shuffleOptions(question: QuizQuestion, random: () => number = Math.random): QuizQuestion {
  const order = question.options.map((_, index) => index);
  for (let last = order.length - 1; last > 0; last--) {
    const swap = Math.floor(random() * (last + 1));
    [order[last], order[swap]] = [order[swap], order[last]];
  }
  return {
    ...question,
    options: order.map((index) => question.options[index]),
    answer: order.indexOf(question.answer),
  };
}
