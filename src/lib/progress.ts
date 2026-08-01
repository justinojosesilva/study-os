/**
 * Progress rules shared by the server queries and the client components.
 *
 * Lives in `lib` rather than `domain/metrics` because the client needs it too,
 * and `domain/metrics` imports the database client — pulling that into a client
 * component would drag server code into the browser bundle.
 */

/** Share of a topic's weight credited while it sits in `praticando`. */
export const PRACTICING_CREDIT = 0.5;

/**
 * Score a topic must reach, within one exam or quiz, to be promoted to
 * `mastered`. The same number decides the other direction: below it the topic
 * loses a step. One threshold rather than two rules, so an attempt can never
 * both pass and demote the same topic.
 *
 * Shared by the goal exam and the topic quiz so `mastered` means the same thing
 * whichever road it came from.
 */
export const PASS_PCT = 80;
