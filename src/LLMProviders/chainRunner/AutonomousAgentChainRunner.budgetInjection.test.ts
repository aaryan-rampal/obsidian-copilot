/**
 * Unit tests for the fetch-budget injection logic in the autonomous agent loop.
 *
 * These tests exercise `buildBudgetNote` directly — a pure function with no
 * external dependencies — so no mocking of the chain runner or Obsidian is
 * required.
 */

import { buildBudgetNote } from "@/LLMProviders/chainRunner/utils/fetchBudgetNote";

describe("buildBudgetNote", () => {
  const MAX_PARALLEL = 3;

  describe("initial budget equals maxIterations", () => {
    it("starts at maxIterations value passed in", () => {
      // When the loop starts, fetchBudgetRemaining = maxIterations.
      // After the first fetch call, remaining decrements by 1.
      // This test verifies the string reflects that remaining count correctly.
      const maxIterations = 4;
      const afterFirstFetch = maxIterations - 1; // 3
      const note = buildBudgetNote(afterFirstFetch, MAX_PARALLEL);
      expect(note).toContain("3 fetch attempt(s) remaining");
    });
  });

  describe("decrements by 1 per fetchWebPages call", () => {
    it("reflects each successive decrement", () => {
      // Simulate three successive fetches: 4 → 3 → 2 → 1
      const maxIterations = 4;
      const remainders = [maxIterations - 1, maxIterations - 2, maxIterations - 3];
      expect(buildBudgetNote(remainders[0], MAX_PARALLEL)).toContain(
        "3 fetch attempt(s) remaining"
      );
      expect(buildBudgetNote(remainders[1], MAX_PARALLEL)).toContain(
        "2 fetch attempt(s) remaining"
      );
      // remaining === 1 triggers the last-fetch message
      expect(buildBudgetNote(remainders[2], MAX_PARALLEL)).toContain("last fetch");
    });
  });

  describe("budget string when remaining === 1", () => {
    it("contains 'last fetch' phrase", () => {
      const note = buildBudgetNote(1, MAX_PARALLEL);
      expect(note).toContain("last fetch");
    });

    it("contains the remaining count '1'", () => {
      const note = buildBudgetNote(1, MAX_PARALLEL);
      expect(note).toContain("1 fetch attempt remaining");
    });

    it("does not contain 'attempt(s)' (uses singular form)", () => {
      const note = buildBudgetNote(1, MAX_PARALLEL);
      expect(note).not.toContain("attempt(s)");
    });
  });

  describe("budget string when remaining > 1", () => {
    it("contains 'fetch attempt(s) remaining' phrase", () => {
      const note = buildBudgetNote(5, MAX_PARALLEL);
      expect(note).toContain("fetch attempt(s) remaining");
    });

    it("contains the remaining count", () => {
      const note = buildBudgetNote(5, MAX_PARALLEL);
      expect(note).toContain("5 fetch attempt(s) remaining");
    });

    it("contains the maxParallel URLs-per-call hint", () => {
      const note = buildBudgetNote(5, MAX_PARALLEL);
      expect(note).toContain(`up to ${MAX_PARALLEL} URLs per call`);
    });

    it("does NOT contain 'last fetch' phrase", () => {
      const note = buildBudgetNote(2, MAX_PARALLEL);
      expect(note).not.toContain("last fetch");
    });
  });
});
