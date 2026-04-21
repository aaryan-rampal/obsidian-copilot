/**
 * Singleton state object that tracks the lifecycle of an agentic web-retrieval
 * session. A single shared instance is used so that concurrent fetch workers,
 * the chain runner, and the UI pill component all observe the same values
 * without passing the object through every call-site.
 *
 * Call {@link webRetrievalState.reset} at the start of each new retrieval
 * session to clear stale values from the previous run.
 */
export const webRetrievalState = {
  /**
   * When `true`, all in-progress and pending fetches should abort as soon as
   * possible and the retrieval session should be considered cancelled.
   */
  terminateRequested: false,

  /**
   * Number of fetch operations that have been started but have not yet
   * resolved or rejected. Increment before starting a fetch; decrement in
   * the finally block.
   */
  activeFetchCount: 0,

  /**
   * Ordered list of human-readable log entries describing fetch activity
   * (e.g. "Fetching https://example.com", "Done https://example.com").
   * Append entries via `push`; the list is cleared by {@link reset}.
   */
  fetchLog: [] as string[],

  /**
   * Resets all fields to their default values. Must be called before starting
   * a new retrieval session so that state from a prior run does not bleed in.
   */
  reset() {
    this.terminateRequested = false;
    this.activeFetchCount = 0;
    this.fetchLog = [];
  },
};

/** Exported type for consumers that need to reference the shape of the state object. */
export type WebRetrievalState = typeof webRetrievalState;
