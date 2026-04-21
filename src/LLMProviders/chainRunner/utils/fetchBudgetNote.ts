/**
 * Pure helpers for building the fetch-budget annotation that is prepended
 * to every successful `fetchWebPages` tool result.
 *
 * Keeping this logic in a separate, dependency-free file makes it easy to
 * unit-test without mocking the full chain runner or Obsidian environment.
 */

/**
 * Builds the budget annotation string shown to the LLM after each
 * `fetchWebPages` call.
 *
 * @param remaining - Number of fetch attempts still available after the
 *   most-recent call has been charged against the budget.
 * @param maxParallel - The `webRetrievalParallelFetchLimit` setting value,
 *   i.e. how many URLs the agent may request per call.
 * @returns A single-line string describing the remaining budget.
 */
export function buildBudgetNote(remaining: number, maxParallel: number): string {
  if (remaining === 1) {
    return (
      `[Web Research Budget: ${remaining} fetch attempt remaining. ` +
      `This is your last fetch. Synthesize after this.]`
    );
  }
  return (
    `[Web Research Budget: ${remaining} fetch attempt(s) remaining. ` +
    `You may request up to ${maxParallel} URLs per call.]`
  );
}
