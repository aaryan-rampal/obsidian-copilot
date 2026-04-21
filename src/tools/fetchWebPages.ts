/**
 * fetchWebPages — agentic web-retrieval tool.
 *
 * Fetches multiple URLs in parallel, extracts clean article text via
 * Mozilla Readability, and falls back to Jina Reader for pages that
 * Readability cannot parse effectively.
 */

import { logError, logInfo } from "@/logger";
import { htmlToMarkdown } from "@/services/webViewerService/webViewerServiceHelpers";
import { getSettings } from "@/settings/model";
import { getDomainFromUrl, safeFetch } from "@/utils";
import { Readability } from "@mozilla/readability";
import { z } from "zod";
import { createLangChainTool } from "@/tools/createLangChainTool";
import { webRetrievalState } from "@/tools/webRetrievalState";

// ============================================================================
// Types
// ============================================================================

/** Coarse quality bucket for a fetched web page. */
export type WebPageQuality = "low" | "ok" | "good";

/** A single successfully retrieved web page. */
export interface RetrievedWebPage {
  url: string;
  title: string;
  content: string;
  quality: WebPageQuality;
  usedFallback: boolean;
}

/** Return value of the fetchWebPagesTool. */
export interface FetchWebPagesResult {
  type: "web_retrieval";
  pages: RetrievedWebPage[];
  fetchLog: string[];
  terminated: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const DEFAULT_MAX_CHARS = 6000;
const MIN_READABILITY_CHARS = 500;

/**
 * Classify content length into a quality bucket.
 */
function classifyQuality(length: number): WebPageQuality {
  if (length >= 2000) return "good";
  if (length >= 500) return "ok";
  return "low";
}

/**
 * Attempt to fetch a URL via the Jina Reader API and return plain text.
 * Returns an empty string on any failure.
 * @param url - The URL to read via Jina.
 */
async function fetchViaJina(url: string): Promise<string> {
  try {
    const resp = await safeFetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const json = await resp.json();
    return (json as any)?.data?.content ?? "";
  } catch (err) {
    logError(`fetchViaJina failed for ${url}: ${err}`);
    return "";
  }
}

// ============================================================================
// Core extraction function
// ============================================================================

/**
 * Fetch a single URL and extract clean article text.
 *
 * Extraction strategy:
 * 1. Fetch HTML with safeFetch (CORS-safe via Obsidian requestUrl).
 * 2. Parse with Mozilla Readability to get article body.
 * 3. If Readability yields < 500 chars, fall back to Jina Reader.
 * 4. Convert article HTML to Markdown (or use Jina plain text directly).
 * 5. Truncate to `maxChars`.
 *
 * @param url - The URL to fetch.
 * @param maxChars - Maximum number of characters to return (default 6000).
 * @returns A `RetrievedWebPage` on success, or `null` on failure.
 */
export async function fetchAndExtract(
  url: string,
  maxChars = DEFAULT_MAX_CHARS
): Promise<RetrievedWebPage | null> {
  let html: string;
  try {
    const resp = await safeFetch(url, { method: "GET" });
    html = await resp.text();
  } catch (err) {
    logError(`fetchAndExtract: failed to fetch ${url}: ${err}`);
    return null;
  }

  // Parse with Readability
  const doc = new DOMParser().parseFromString(html, "text/html");
  const reader = new Readability(doc);
  const article = reader.parse();

  const readabilityText = article?.textContent ?? "";
  let title = article?.title ?? "";
  let content: string;
  let usedFallback = false;

  if (readabilityText.length >= MIN_READABILITY_CHARS && article?.content) {
    // Readability succeeded — convert HTML fragment to Markdown
    content = htmlToMarkdown(article.content, url);
  } else {
    // Fallback to Jina Reader
    logInfo(`fetchAndExtract: Readability too short (${readabilityText.length}), trying Jina`);
    const jinaText = await fetchViaJina(url);
    if (!jinaText) {
      logError(`fetchAndExtract: both Readability and Jina failed for ${url}`);
      return null;
    }
    content = jinaText;
    usedFallback = true;
    // If we didn't get a title from Readability, try to extract from the HTML <title> tag
    if (!title) {
      const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      title = match?.[1]?.trim() ?? "";
    }
  }

  if (!content) {
    logError(`fetchAndExtract: empty content for ${url}`);
    return null;
  }

  const truncated = content.slice(0, maxChars);
  const quality = classifyQuality(truncated.length);

  return { url, title, content: truncated, quality, usedFallback };
}

// ============================================================================
// LangChain Tool
// ============================================================================

const fetchWebPagesSchema = z.object({
  urls: z.array(z.string()).describe("URLs to fetch and read in parallel"),
  reason: z.string().optional().describe("Why these pages are relevant"),
});

/**
 * LangChain tool that fetches multiple web pages in parallel and extracts
 * clean article content. Respects the global `webRetrievalState` lifecycle:
 * - Returns early if `terminateRequested` is set.
 * - Updates `activeFetchCount` while fetches are in flight.
 * - Appends entries to `webRetrievalState.fetchLog`.
 */
export const fetchWebPagesTool = createLangChainTool({
  name: "fetchWebPages",
  description: "Fetch multiple web pages in parallel and extract their text content for analysis",
  schema: fetchWebPagesSchema,
  func: async ({ urls }): Promise<FetchWebPagesResult> => {
    if (webRetrievalState.terminateRequested) {
      logInfo("fetchWebPages: terminate requested, skipping");
      return { type: "web_retrieval", pages: [], fetchLog: [], terminated: true };
    }

    const maxParallel = (getSettings() as any).webRetrievalParallelFetchLimit ?? 3;
    const slicedUrls = urls.slice(0, maxParallel);

    webRetrievalState.activeFetchCount = slicedUrls.length;

    const settled = await Promise.allSettled(slicedUrls.map((url) => fetchAndExtract(url)));

    webRetrievalState.activeFetchCount = 0;

    const pages: RetrievedWebPage[] = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const url = slicedUrls[i] ?? "";
      const domain = getDomainFromUrl(url);

      if (result.status === "fulfilled" && result.value !== null) {
        pages.push(result.value);
        webRetrievalState.fetchLog.push(`Read ${domain} (${result.value.quality})`);
        logInfo(`fetchWebPages: Read ${domain} (${result.value.quality})`);
      } else {
        webRetrievalState.fetchLog.push(`Failed ${domain}`);
        if (result.status === "rejected") {
          logError(`fetchWebPages: fetch rejected for ${url}: ${result.reason}`);
        } else {
          logError(`fetchWebPages: null result for ${url}`);
        }
      }
    }

    return {
      type: "web_retrieval",
      pages,
      fetchLog: [...webRetrievalState.fetchLog],
      terminated: false,
    };
  },
});
