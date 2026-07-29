/**
 * Progress rules shared by the server queries and the client components.
 *
 * Lives in `lib` rather than `domain/metrics` because the client needs it too,
 * and `domain/metrics` imports the database client — pulling that into a client
 * component would drag server code into the browser bundle.
 */

/** Share of a topic's weight credited while it sits in `praticando`. */
export const PRACTICING_CREDIT = 0.5;
