# Copilot for Obsidian — Personal Fork

This is a personal fork of [logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot).

The upstream plugin has a paid **Copilot Plus** tier that gates several features behind a Brevilabs license key. This fork removes those gates and replaces the Brevilabs-hosted services with your own API keys — so you get the full feature set for free (you just pay for whatever APIs you use directly).

---

## What's different from upstream

### 1. Copilot Plus without a Copilot Plus subscription

The upstream plugin locks features like the autonomous agent, URL processing in chat, PDF/DOCX/EPUB context, and web search behind a paid Brevilabs license. This fork bypasses that by routing everything through your own API keys instead of their hosted backend.

You still need to bring your own keys — this isn't a free lunch, just a different billing relationship.

### 2. Web search with your own Brave API key

The upstream plugin routes web search through Brevilabs' servers. This fork adds a **Brave Search** provider so you can point web search directly at Brave's API.

**How to get a Brave Search API key:**

1. Go to [brave.com/search/api](https://brave.com/search/api/)
2. Sign up for the free tier (2,000 queries/month free)
3. Create an API key in the dashboard
4. In Obsidian: **Settings → Copilot → Copilot Plus Settings** → paste your Brave API key and set the search provider to **Brave**

Firecrawl and Perplexity are also supported as alternative providers — same settings section.

### 3. Web search in normal chat mode

The `@web` command now works in standard chat mode (not just Copilot Plus mode). Type `@web your question` and it will run a web search inline.

> **Note:** This is still rough around the edges. There's a known bug where very long prompts (e.g. pasting a system prompt before `@web`) exceed the 400-character search query limit and throw an error. Working on it.

### 4. Agentic web search in Copilot Plus mode

When using **Copilot Plus (Autonomous Agent)** mode, the agent can now research the web on its own. You don't tell it what to search — it decides when to search, what to search for, and whether to follow up on results it finds interesting.

How it works:

- Agent calls `webSearch` to get snippets and URLs
- Agent decides which URLs are worth reading in full
- Agent calls `fetchWebPages([url1, url2, ...])` to fetch up to N pages in parallel
- Pages are extracted with [Mozilla Readability](https://github.com/mozilla/readability) (the same engine Firefox uses for Reader Mode), then converted to Markdown
- If Readability extracts too little content (< 500 chars), it falls back to [Jina Reader](https://jina.ai/reader/) automatically
- Agent can follow links recursively across multiple iterations

**Stopping a research loop:** While the agent is fetching pages, a **"Researching... Stop & Synthesize"** pill appears above the input bar showing which pages it's reading. Click **Stop & Synthesize** to tell it to stop fetching and write up what it has so far.

**Settings** (Settings → Copilot → Agent):

- **Max Iterations** — how many reasoning steps the agent gets (default 4)
- **Max Parallel Web Fetches** — how many pages it can fetch per call (default 3)

**Current status:** Tested personally with Mozilla Readability + Jina fallback. Seems to work well. Firecrawl as a fetch provider hasn't been tested yet. YMMV.

---

## Setup

### Prerequisites

- Obsidian with the Copilot plugin installed from this fork
- An LLM API key (OpenAI, Anthropic, Google, etc.) — configure in **Settings → Copilot → Model Settings**
- A search API key (Brave recommended) — configure in **Settings → Copilot → Copilot Plus Settings**

### Build from source

```bash
git clone https://github.com/aaryan-rampal/obsidian-copilot
cd obsidian-copilot
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/copilot/` directory, then enable the plugin in Obsidian settings.

---

## Upstream

All credit for the original plugin goes to [Logan Yang](https://github.com/logancyang) and contributors. This fork exists purely for personal use and experimentation.

Original repo: [github.com/logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot)
Original docs: [obsidiancopilot.com/en/docs](https://www.obsidiancopilot.com/en/docs)
