import { buildWebSearchContextMessage, hasWebCommand, removeWebCommands } from "./webCommandUtils";

describe("webCommandUtils", () => {
  test("detects @web and @websearch commands", () => {
    expect(hasWebCommand("@web latest obsidian release")).toBe(true);
    expect(hasWebCommand("please @websearch latest obsidian release")).toBe(true);
    expect(hasWebCommand("latest obsidian release")).toBe(false);
  });

  test("removes @web and @websearch tokens from the query", () => {
    expect(removeWebCommands("@web latest obsidian release")).toBe("latest obsidian release");
    expect(removeWebCommands("please @websearch latest obsidian release")).toBe(
      "please latest obsidian release"
    );
  });

  test("wraps formatted tool output in a context message", () => {
    expect(buildWebSearchContextMessage("formatted results")).toContain("formatted results");
    expect(buildWebSearchContextMessage("formatted results")).toContain("Use the following");
  });
});
