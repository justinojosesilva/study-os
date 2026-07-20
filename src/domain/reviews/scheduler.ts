import { fsrs, createEmptyCard, type Card, type Grade } from "ts-fsrs";

/**
 * Thin wrapper over ts-fsrs. This is framework-free domain logic: given a
 * topic's current memory card and a recall rating, it returns the next card
 * (with the new due date, stability and difficulty). Default FSRS parameters.
 */
const scheduler = fsrs();

/** The subset of a topic_reviews row that reconstitutes an FSRS Card. */
export type StoredCard = {
  state: number;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
};

export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

export function toCard(s: StoredCard): Card {
  return {
    due: s.due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.lastReview ?? undefined,
  } as Card;
}

/** Schedule the next review for `card` given a 1–4 rating. */
export function scheduleNext(card: Card, rating: Grade, now: Date = new Date()): Card {
  return scheduler.next(card, now, rating).card;
}

/** Flatten an FSRS Card into the columns persisted on a topic_reviews row. */
export function cardToColumns(card: Card) {
  return {
    state: card.state,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ?? null,
  };
}
