/**
 * Check whether a user message contains an explicit web-search command token.
 *
 * @param message - Raw user message.
 * @returns True when the message contains `@web` or `@websearch`.
 */
export function hasWebCommand(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("@websearch") || normalizedMessage.includes("@web");
}

/**
 * Remove explicit web-search command tokens from a user message.
 *
 * @param message - Raw user message.
 * @returns Message with `@web` and `@websearch` tokens removed.
 */
export function removeWebCommands(message: string): string {
  return message
    .split(" ")
    .filter((word) => {
      const normalizedWord = word.toLowerCase();
      return normalizedWord !== "@web" && normalizedWord !== "@websearch";
    })
    .join(" ")
    .trim();
}

/**
 * Wrap formatted web search output into a plain-text prompt segment.
 *
 * @param formattedToolOutput - User-friendly formatted web search results.
 * @returns Prompt segment that instructs the model to use the retrieved results.
 */
export function buildWebSearchContextMessage(formattedToolOutput: string): string {
  return [
    "Use the following web search results to answer the user's request.",
    "Do not claim you lack web access if these results are present.",
    "",
    formattedToolOutput,
  ].join("\n");
}
