import {
  canUseConfiguredWebSearchProvider,
  hasSelfHostSearchKey,
  selfHostWebSearch,
} from "./selfHostServices";

// --- Mocks ---

const mockGetSettings = jest.fn();
jest.mock("@/settings/model", () => ({
  getSettings: () => mockGetSettings(),
}));

jest.mock("@/encryptionService", () => ({
  getDecryptedKey: (key: string) => Promise.resolve(key),
}));

jest.mock("@/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const mockSafeFetch = jest.fn();
jest.mock("@/utils", () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default settings: firecrawl provider
  mockGetSettings.mockReturnValue({
    selfHostSearchProvider: "firecrawl",
    firecrawlApiKey: "fc-test-key",
    perplexityApiKey: "",
    braveApiKey: "",
    supadataApiKey: "",
  });
});

// --- hasSelfHostSearchKey ---

describe("hasSelfHostSearchKey", () => {
  it("returns true when firecrawl provider has a key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "firecrawl",
      firecrawlApiKey: "fc-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });
    expect(hasSelfHostSearchKey()).toBe(true);
  });

  it("returns false when firecrawl provider has no key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "firecrawl",
      firecrawlApiKey: "",
      perplexityApiKey: "pplx-key",
      braveApiKey: "",
    });
    expect(hasSelfHostSearchKey()).toBe(false);
  });

  it("returns true when perplexity provider has a key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "perplexity",
      firecrawlApiKey: "",
      perplexityApiKey: "pplx-key",
      braveApiKey: "",
    });
    expect(hasSelfHostSearchKey()).toBe(true);
  });

  it("returns false when perplexity provider has no key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "perplexity",
      firecrawlApiKey: "fc-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });
    expect(hasSelfHostSearchKey()).toBe(false);
  });

  it("returns true when brave provider has a key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "brave",
      firecrawlApiKey: "",
      perplexityApiKey: "",
      braveApiKey: "bsa-key",
    });
    expect(hasSelfHostSearchKey()).toBe(true);
  });

  it("returns false when brave provider has no key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "brave",
      firecrawlApiKey: "",
      perplexityApiKey: "",
      braveApiKey: "",
    });
    expect(hasSelfHostSearchKey()).toBe(false);
  });

  it("defaults to firecrawl for unknown provider", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "unknown",
      firecrawlApiKey: "fc-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });
    expect(hasSelfHostSearchKey()).toBe(true);
  });
});

describe("canUseConfiguredWebSearchProvider", () => {
  it("returns true when brave is selected and has a configured key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "brave",
      firecrawlApiKey: "",
      perplexityApiKey: "",
      braveApiKey: "bsa-key",
    });

    expect(canUseConfiguredWebSearchProvider()).toBe(true);
  });

  it("returns false when the selected provider has no configured key", () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "brave",
      firecrawlApiKey: "fc-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });

    expect(canUseConfiguredWebSearchProvider()).toBe(false);
  });
});

// --- Firecrawl search ---

describe("selfHostWebSearch — Firecrawl", () => {
  beforeEach(() => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "firecrawl",
      firecrawlApiKey: "fc-test-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });
  });

  it("parses v2 data.web format", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          web: [
            { title: "Result 1", description: "Desc 1", url: "https://example.com/1" },
            { title: "Result 2", description: "Desc 2", url: "https://example.com/2" },
          ],
        },
      }),
    });

    const result = await selfHostWebSearch("test query");

    expect(result.citations).toEqual(["https://example.com/1", "https://example.com/2"]);
    expect(result.content).toContain("### Result 1");
    expect(result.content).toContain("### Result 2");
  });

  it("falls back to data array for older responses", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ title: "Old", description: "Old desc", url: "https://old.com" }],
      }),
    });

    const result = await selfHostWebSearch("test query");

    expect(result.citations).toEqual(["https://old.com"]);
    expect(result.content).toContain("### Old");
  });

  it("returns empty results for malformed data", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: "not an array or object" }),
    });

    const result = await selfHostWebSearch("test query");

    expect(result.content).toBe("");
    expect(result.citations).toEqual([]);
  });

  it("throws on HTTP errors", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(selfHostWebSearch("test query")).rejects.toThrow(
      "Firecrawl search failed (401): Unauthorized"
    );
  });

  it("handles empty results array", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { web: [] } }),
    });

    const result = await selfHostWebSearch("test query");

    expect(result.content).toBe("");
    expect(result.citations).toEqual([]);
  });

  it("sends correct request format", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { web: [] } }),
    });

    await selfHostWebSearch("my query");

    expect(mockSafeFetch).toHaveBeenCalledWith("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: "Bearer fc-test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "my query", limit: 5 }),
    });
  });
});

// --- Perplexity Sonar search ---

describe("selfHostWebSearch — Perplexity Sonar", () => {
  beforeEach(() => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "perplexity",
      firecrawlApiKey: "",
      perplexityApiKey: "pplx-test-key",
      braveApiKey: "",
    });
  });

  it("parses standard Sonar response", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Here is the answer about AI." } }],
        citations: ["https://source1.com", "https://source2.com"],
      }),
    });

    const result = await selfHostWebSearch("what is AI");

    expect(result.content).toBe("Here is the answer about AI.");
    expect(result.citations).toEqual(["https://source1.com", "https://source2.com"]);
  });

  it("handles missing citations", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Some answer" } }],
      }),
    });

    const result = await selfHostWebSearch("test");

    expect(result.content).toBe("Some answer");
    expect(result.citations).toEqual([]);
  });

  it("handles empty choices", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [],
        citations: ["https://cite.com"],
      }),
    });

    const result = await selfHostWebSearch("test");

    expect(result.content).toBe("");
    expect(result.citations).toEqual(["https://cite.com"]);
  });

  it("throws on HTTP errors", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    await expect(selfHostWebSearch("test")).rejects.toThrow(
      "Perplexity Sonar search failed (429): Rate limited"
    );
  });

  it("sends correct request format with model=sonar", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }], citations: [] }),
    });

    await selfHostWebSearch("my query");

    expect(mockSafeFetch).toHaveBeenCalledWith("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer pplx-test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "my query" }],
      }),
    });
  });
});

// --- Brave Search ---

describe("selfHostWebSearch — Brave Search", () => {
  beforeEach(() => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "brave",
      firecrawlApiKey: "",
      perplexityApiKey: "",
      braveApiKey: "bsa-test-key",
    });
  });

  it("parses Brave web results and strips snippet markup", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: "Result 1",
              description: "Learn <strong>TypeScript</strong> basics",
              url: "https://example.com/1",
            },
            {
              title: "Result 2",
              description: "Advanced topics",
              url: "https://example.com/2",
            },
          ],
        },
      }),
    });

    const result = await selfHostWebSearch("typescript");

    expect(result.citations).toEqual(["https://example.com/1", "https://example.com/2"]);
    expect(result.content).toContain("### Result 1");
    expect(result.content).toContain("Learn TypeScript basics");
    expect(result.content).not.toContain("<strong>");
  });

  it("returns empty results for malformed Brave payloads", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: "not-an-array" } }),
    });

    const result = await selfHostWebSearch("typescript");

    expect(result.content).toBe("");
    expect(result.citations).toEqual([]);
  });

  it("throws on Brave HTTP errors", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    await expect(selfHostWebSearch("typescript")).rejects.toThrow(
      "Brave search failed (403): Forbidden"
    );
  });

  it("sends correct request format for Brave web search", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });

    await selfHostWebSearch("my query");

    expect(mockSafeFetch).toHaveBeenCalledWith(
      "https://api.search.brave.com/res/v1/web/search?q=my+query&count=5",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": "bsa-test-key",
        },
      }
    );
  });
});

// --- Provider dispatch ---

describe("selfHostWebSearch — provider dispatch", () => {
  it("routes to Firecrawl URL when provider is firecrawl", async () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "firecrawl",
      firecrawlApiKey: "fc-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { web: [] } }),
    });

    await selfHostWebSearch("test");

    expect(mockSafeFetch).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/search",
      expect.any(Object)
    );
  });

  it("routes to Perplexity URL when provider is perplexity", async () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "perplexity",
      firecrawlApiKey: "",
      perplexityApiKey: "pplx-key",
      braveApiKey: "",
    });
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }], citations: [] }),
    });

    await selfHostWebSearch("test");

    expect(mockSafeFetch).toHaveBeenCalledWith(
      "https://api.perplexity.ai/chat/completions",
      expect.any(Object)
    );
  });

  it("routes to Brave URL when provider is brave", async () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "brave",
      firecrawlApiKey: "",
      perplexityApiKey: "",
      braveApiKey: "bsa-key",
    });
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });

    await selfHostWebSearch("test");

    expect(mockSafeFetch).toHaveBeenCalledWith(
      "https://api.search.brave.com/res/v1/web/search?q=test&count=5",
      expect.any(Object)
    );
  });

  it("defaults to Firecrawl for unknown provider value", async () => {
    mockGetSettings.mockReturnValue({
      selfHostSearchProvider: "unknown-provider",
      firecrawlApiKey: "fc-key",
      perplexityApiKey: "",
      braveApiKey: "",
    });
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { web: [] } }),
    });

    await selfHostWebSearch("test");

    expect(mockSafeFetch).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/search",
      expect.any(Object)
    );
  });
});
