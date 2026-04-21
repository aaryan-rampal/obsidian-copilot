/**
 * Unit tests for fetchAndExtract and the webRetrievalState integration.
 *
 * These tests mock the network layer (safeFetch) and HTML conversion
 * utilities so no real HTTP requests or DOM-heavy imports are needed.
 */

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any imports
// ---------------------------------------------------------------------------

const mockSafeFetch = jest.fn();
const mockHtmlToMarkdown = jest.fn((html: string) => html);
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();
const mockGetSettings = jest.fn(() => ({ webRetrievalParallelFetchLimit: 3 }));

jest.mock("@/utils", () => ({
  safeFetch: mockSafeFetch,
  getDomainFromUrl: (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  },
}));

jest.mock("@/services/webViewerService/webViewerServiceHelpers", () => ({
  htmlToMarkdown: mockHtmlToMarkdown,
}));

jest.mock("@/logger", () => ({
  logInfo: mockLogInfo,
  logError: mockLogError,
}));

jest.mock("@/settings/model", () => ({
  getSettings: mockGetSettings,
}));

// Mock @mozilla/readability so we control what it returns
const mockReadabilityParse = jest.fn();
jest.mock("@mozilla/readability", () => ({
  Readability: jest.fn().mockImplementation(() => ({
    parse: mockReadabilityParse,
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { webRetrievalState } from "@/tools/webRetrievalState";
import { fetchAndExtract } from "./fetchWebPages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object returned by safeFetch. */
function makeResponse(textBody: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(textBody),
    json: jest.fn().mockResolvedValue({}),
  };
}

/** A long string exceeding 2000 chars to trigger "good" quality. */
const LONG_CONTENT = "x".repeat(2500);
/** A medium string (500–2000) to trigger "ok" quality. */
const MEDIUM_CONTENT = "x".repeat(800);
/** A short string to trigger "low" quality / fallback. */
const SHORT_CONTENT = "x".repeat(100);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("fetchAndExtract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webRetrievalState.reset();
    // Default: DOMParser returns a basic document
    global.DOMParser = jest.fn().mockImplementation(() => ({
      parseFromString: jest.fn().mockReturnValue({}),
    })) as any;
  });

  describe("successful Readability extraction", () => {
    it("returns quality 'good' when content is >= 2000 chars", async () => {
      mockSafeFetch.mockResolvedValue(makeResponse("<html><body>content</body></html>"));
      mockHtmlToMarkdown.mockReturnValue(LONG_CONTENT);
      mockReadabilityParse.mockReturnValue({
        title: "Test Page",
        content: "<p>content</p>",
        textContent: LONG_CONTENT,
      });

      const result = await fetchAndExtract("https://example.com");

      expect(result).not.toBeNull();
      expect(result!.quality).toBe("good");
      expect(result!.usedFallback).toBe(false);
      expect(result!.url).toBe("https://example.com");
      expect(result!.title).toBe("Test Page");
    });

    it("returns quality 'ok' when content is 500–1999 chars", async () => {
      mockSafeFetch.mockResolvedValue(makeResponse("<html><body>content</body></html>"));
      mockHtmlToMarkdown.mockReturnValue(MEDIUM_CONTENT);
      mockReadabilityParse.mockReturnValue({
        title: "Medium Page",
        content: "<p>content</p>",
        textContent: MEDIUM_CONTENT,
      });

      const result = await fetchAndExtract("https://example.com/medium");

      expect(result).not.toBeNull();
      expect(result!.quality).toBe("ok");
      expect(result!.usedFallback).toBe(false);
    });

    it("truncates content to maxChars", async () => {
      const veryLong = "a".repeat(10000);
      mockSafeFetch.mockResolvedValue(makeResponse("<html/>"));
      mockHtmlToMarkdown.mockReturnValue(veryLong);
      mockReadabilityParse.mockReturnValue({
        title: "Long Page",
        content: "<p>long</p>",
        textContent: veryLong,
      });

      const result = await fetchAndExtract("https://example.com/long", 500);

      expect(result).not.toBeNull();
      expect(result!.content.length).toBe(500);
    });

    it("sets usedFallback to false when Readability succeeds", async () => {
      mockSafeFetch.mockResolvedValue(makeResponse("<html/>"));
      mockHtmlToMarkdown.mockReturnValue(LONG_CONTENT);
      mockReadabilityParse.mockReturnValue({
        title: "Page",
        content: "<p>body</p>",
        textContent: LONG_CONTENT,
      });

      const result = await fetchAndExtract("https://example.com");

      expect(result!.usedFallback).toBe(false);
    });
  });

  describe("Jina fallback", () => {
    it("uses Jina when Readability returns < 500 chars, sets usedFallback=true", async () => {
      // First call: page HTML fetch; second call: Jina fetch
      mockSafeFetch
        .mockResolvedValueOnce(makeResponse("<html><body>tiny</body></html>"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(""),
          json: jest.fn().mockResolvedValue({ data: { content: LONG_CONTENT } }),
        });

      mockReadabilityParse.mockReturnValue({
        title: "",
        content: "<p>tiny</p>",
        textContent: SHORT_CONTENT,
      });

      const result = await fetchAndExtract("https://example.com/sparse");

      expect(result).not.toBeNull();
      expect(result!.usedFallback).toBe(true);
      expect(result!.content).toBe(LONG_CONTENT);
      // safeFetch should have been called twice: original URL + Jina
      expect(mockSafeFetch).toHaveBeenCalledTimes(2);
      expect(mockSafeFetch).toHaveBeenNthCalledWith(
        2,
        "https://r.jina.ai/https://example.com/sparse",
        expect.objectContaining({ headers: { Accept: "application/json" } })
      );
    });

    it("returns null when both Readability and Jina fail", async () => {
      mockSafeFetch
        .mockResolvedValueOnce(makeResponse("<html/>"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(""),
          json: jest.fn().mockResolvedValue({ data: { content: "" } }),
        });

      mockReadabilityParse.mockReturnValue({
        title: "",
        content: "",
        textContent: SHORT_CONTENT,
      });

      const result = await fetchAndExtract("https://example.com/empty");

      expect(result).toBeNull();
    });

    it("returns null when Readability returns null", async () => {
      mockSafeFetch
        .mockResolvedValueOnce(makeResponse("<html/>"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(""),
          json: jest.fn().mockResolvedValue({ data: { content: "" } }),
        });

      mockReadabilityParse.mockReturnValue(null);

      const result = await fetchAndExtract("https://example.com/null");

      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("returns null when safeFetch throws", async () => {
      mockSafeFetch.mockRejectedValue(new Error("Network error"));

      const result = await fetchAndExtract("https://example.com/broken");

      expect(result).toBeNull();
      expect(mockLogError).toHaveBeenCalled();
    });
  });
});

describe("webRetrievalState integration via fetchAndExtract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webRetrievalState.reset();
    global.DOMParser = jest.fn().mockImplementation(() => ({
      parseFromString: jest.fn().mockReturnValue({}),
    })) as any;
  });

  it("terminateRequested=true causes early return with terminated:true (no fetches)", async () => {
    webRetrievalState.terminateRequested = true;

    // We test the tool's early-return via the tool function itself. Since we
    // want to avoid importing the full LangChain tool, we verify the state
    // directly: fetchAndExtract itself doesn't check terminateRequested —
    // that check lives in the tool wrapper. Here we just confirm safeFetch
    // is not called when terminateRequested is true by invoking the tool.

    // Import the tool lazily so mocks are in place
    const { fetchWebPagesTool } = await import("./fetchWebPages");
    const raw = await (fetchWebPagesTool as any).invoke({
      urls: ["https://example.com"],
      reason: "test",
    });
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;

    expect(result.terminated).toBe(true);
    expect(result.pages).toHaveLength(0);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it("activeFetchCount is 0 after fetchAndExtract resolves", async () => {
    mockSafeFetch.mockResolvedValue(makeResponse("<html/>"));
    mockReadabilityParse.mockReturnValue({ title: "T", content: "<p>c</p>", textContent: LONG_CONTENT });
    mockHtmlToMarkdown.mockReturnValue(LONG_CONTENT);

    await fetchAndExtract("https://example.com");

    // fetchAndExtract itself doesn't manage activeFetchCount — the tool does.
    // Verify the tool resets it after completion.
    const { fetchWebPagesTool } = await import("./fetchWebPages");
    const raw = await (fetchWebPagesTool as any).invoke({ urls: ["https://example.com"] });
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;

    expect(webRetrievalState.activeFetchCount).toBe(0);
    expect(result.terminated).toBe(false);
  });

  it("appends entries to webRetrievalState.fetchLog", async () => {
    mockSafeFetch.mockResolvedValue(makeResponse("<html/>"));
    mockReadabilityParse.mockReturnValue({
      title: "T",
      content: "<p>c</p>",
      textContent: LONG_CONTENT,
    });
    mockHtmlToMarkdown.mockReturnValue(LONG_CONTENT);

    const { fetchWebPagesTool } = await import("./fetchWebPages");
    await (fetchWebPagesTool as any).invoke({ urls: ["https://example.com/page"] });

    expect(webRetrievalState.fetchLog.length).toBeGreaterThan(0);
    expect(webRetrievalState.fetchLog[0]).toMatch(/example\.com/);
  });

  it("adds 'Failed ...' entry for rejected fetch", async () => {
    mockSafeFetch.mockRejectedValue(new Error("timeout"));

    const { fetchWebPagesTool } = await import("./fetchWebPages");
    const raw = await (fetchWebPagesTool as any).invoke({
      urls: ["https://broken.example.com/page"],
    });
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;

    expect(result.pages).toHaveLength(0);
    const failedEntry = webRetrievalState.fetchLog.find((e) =>
      e.startsWith("Failed")
    );
    expect(failedEntry).toBeDefined();
    expect(failedEntry).toContain("broken.example.com");
  });
});
