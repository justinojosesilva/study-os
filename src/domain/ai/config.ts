/** Shared AI config. One place for the model id and the mock switch. */

export const MODEL = "claude-opus-4-8";

/** Mock when explicitly enabled (dev/demo) or when there's no API key. */
export function isMockMode(): boolean {
  return process.env.AI_MOCK === "true" || !process.env.ANTHROPIC_API_KEY;
}
