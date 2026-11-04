# Agent Chrome SEO/AEO content brief

Every page is a Markdown file in `site/content/` that `scripts/build-content.mjs` renders at https://agentchrome.dev/<slug>.

## Who searches, and what they type

- **Developers who use AI coding agents:** Claude Code, Codex CLI or app, Gemini CLI, Cursor, Grok, opencode, Antigravity, Muse. They want the agent to use their **real, logged-in Chrome**: test their web app, check a dashboard, reproduce a bug behind login, or record a demo.
- **Typical queries:**
  - "let claude code control chrome", "claude code browser", "codex chrome extension", "chrome mcp server"
  - "mcp browser automation", "claude in chrome alternative", "chrome devtools mcp vs playwright"
  - "browser mcp", "gemini cli browser", "cursor browser mcp"
  - "record browser video with ai", "ai test web app logged in"
- **Pains they describe in their own words (Reddit and GitHub issues):**
  - "Claude in Chrome works maybe 1 out of 10 times."
  - "The Codex Chrome plugin isn't available in the CLI or headless `codex exec`," and "Chrome can't be controlled from the Codex app on Windows."
  - "Chrome DevTools MCP launches a separate Chrome without my logins," and "I need remote debugging flags."
  - "Playwright opens a clean browser, not mine."
  - "One extension per app; I want the same browser for Claude Code and Codex."
- **What they care about:** it works reliably, setup takes one command, it uses their real sessions, it's safe (they can see and stop it), it's open source, it works with every agent, and they can record proof.

## Product facts (only state these; never invent features)

- **What it is:** a Chrome extension plus a remote MCP server (Streamable HTTP). The hosted server is at `https://agentchrome.dev/mcp` on Cloudflare Workers, with one Durable Object per account. Local mode runs on `http://127.0.0.1:47823`. Self-host with `scripts/deploy-cloudflare.sh`. MIT licensed: https://github.com/ShadowWalker2014/agentchrome. Operated by Circo, Inc.
- **Install:** `curl -fsSL https://agentchrome.dev/install | sh`. It needs Node.js 18+ and Chrome 120+. In one pass it:
  - creates an account,
  - adds an MCP server named `agentchrome` at user level to every agent it detects (Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode, Windsurf, plus proxy config folders such as `~/.codex-proxy`),
  - links a shared skill,
  - unpacks the extension to `~/.agentchrome/extension`,
  - opens `chrome://extensions`, then prints a pairing code.
- **Load the extension:** at `chrome://extensions`, turn on Developer mode, click Load unpacked, choose the folder, then press **Sign in to connect** in the popup or paste the code. It is not on the Chrome Web Store yet; say "load unpacked". A zip is at https://agentchrome.dev/agentchrome-extension.zip.
- **CLI:** `agentchrome setup | pair | install [ids] [--oauth] | uninstall | status | revoke <id> | rotate-key | key | serve [--install] | extension`.
- **Claude.ai / ChatGPT:** add `https://agentchrome.dev/mcp` as a custom connector. Claude: Customize > Connectors > Add custom connector. ChatGPT: Developer mode, then create a connector with OAuth. Auth is OAuth 2.1 with PKCE, DCR and CIMD. You sign in with an account key or create an account in one click. In chat, "connect my Chrome" makes the assistant call `pairing_code`.
- **Tools for coding agents** (names match Claude in Chrome):
  - **Tabs and groups:** `tabs_context`, `tabs_create`, `tabs_close`, `tabs_select`, `tab_groups` (list/create/update/ungroup/move/close)
  - **Navigation and input:** `navigate` (`back`/`forward`/`reload`), and `computer`:
    - mouse: `left_click`/`right_click`/`middle_click`, `double_click`/`triple_click`, `hover`/`mouse_move`, `left_click_drag`
    - keyboard: `type`, `key`
    - viewport: `scroll`, `scroll_to`, `wait`, `zoom`, `screenshot`
  - **Reading:** `read_page` (accessibility tree with `ref_N` handles), `find`, `get_page_text`
  - **Forms and dialogs:** `form_input`, `file_upload` (local paths, base64, URL or screenshot id), `upload_image`, `handle_dialog`, `wait_for`
  - **Debugging:** `javascript_tool`, `read_console_messages`, `read_network_requests`
  - **Recording and capture:** `screenshot` (viewport, full page, or save for a download link), `record` (MP4/WebM), `gif_creator`
  - **Window and history:** `resize_window`, `history_search` (opt-in)
  - **Browsers and pairing:** `list_browsers`, `select_browser`, `pairing_code`
- **Chat apps (Claude.ai, ChatGPT)** get one tool per action instead of `computer`/`javascript_tool`: `click`, `type_text`, `press_key`, `scroll`, `hover`, `drag`, `wait`, `zoom`, `list_tab_groups`, `update_tab_group`, `close_tab_group`, with honest read-only and destructive annotations.
- **Visibility and control:**
  - Each MCP session gets its own named, colored tab group, and new tabs it opens join that group.
  - The page shows a pulsing blue border and a status pill with the agent's logo and a **Stop** button.
  - The agent has its own animated cursor (arrow, hand over links, I-beam over text) with its name and logo. It never moves your real mouse.
  - The popup lists agent sessions, each with Pause/Resume, plus Stop all.
  - Optional: ask before each new site, a block list, and history access (off by default).
  - Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent.
- **Recording:** `record` produces an MP4 with a natural cursor and **no** border, pill or name tag by default (`cursor: natural | agent | hidden`). Clicks are optional ripples. The toolbar shows REC. Limit: 10 minutes. Files are on R2 for 7 days (local mode: `~/.agentchrome/artifacts`).
- **Real-site handling:**
  - native HTML5 drag and drop, and pointer drags
  - file pickers caught and filled; local paths become real files
  - `alert`/`confirm`/`prompt` reported to the agent; "Leave site?" auto-accepted on agent navigation
  - new tabs from links join the group; downloads reported
  - HTTP errors and DNS failures reported
  - crashed tabs detected
  - `chrome://` and Web Store pages explained
  - a fallback when password-manager frames block the debugger
- **Multiple profiles:** pair each Chrome profile (Work, Personal…). `list_browsers` shows them online or offline. Pick one per call with `browser: "Work"` or per session with `select_browser`.
- **Security:**
  - account keys (`acm_sk_`) and device tokens (`acm_dt_`) are stored only as SHA-256 hashes
  - single-use 10-character pairing codes expire after 15 minutes
  - per-profile revocation
  - signed session ids bound to the account
  - rate limits
  - no page content stored server-side (except files an agent explicitly saves, kept 7 days)
- **Honest limits:**
  - Chrome only for now; no Firefox or Safari.
  - The extension is loaded unpacked; it isn't on the Web Store yet.
  - Chrome shows a "started debugging this browser" bar while it's attached.
  - It can't act on `chrome://` pages or the Web Store.
  - An agent with your logged-in browser can do what you can, and pages can contain prompt injection.

## Competitors (verify each claim at the source before you write it; if you can't verify it, leave it out)

- **Claude in Chrome (Anthropic):** an extension that works with the Claude apps and Claude Code. Check https://support.claude.com and https://www.anthropic.com. Agent Chrome uses the same tool names, so prompts transfer.
- **Codex Chrome extension (OpenAI):** works from the Codex/ChatGPT desktop app. Check https://developers.openai.com/codex and the GitHub issues on openai/codex about CLI and Windows.
- **Chrome DevTools MCP (Google):** https://github.com/ChromeDevTools/chrome-devtools-mcp. It is excellent for performance traces; it usually launches or attaches to a Chrome over the debugging port.
- **Playwright MCP (Microsoft):** https://github.com/microsoft/playwright-mcp. It drives its own browser through accessibility snapshots, and has an extension mode for connecting to existing tabs (verify the current state).
- **Browser MCP:** https://browsermcp.io, on the Chrome Web Store.
- **BrowserTools MCP (AgentDesk):** https://github.com/AgentDeskAI/browser-tools-mcp.

Be fair: say what each one is better at. Never call a competitor bad. Give the reader a decision rule ("use X if…, use Agent Chrome if…").

## Voice and format

- Plain English with full sentences. Answer the page's question in the first two sentences, because AI answer engines quote the opening.
- No hype words (seamless, powerful, unleash, revolutionary, effortless, game-changer), no em dashes, no "In today's world".
- Use concrete commands and real tool names. Show code blocks for every command.
- Structure: H1 equals the title. Start with a short answer paragraph, then H2 sections, using tables where you compare. End with `## Frequently asked questions` with 4 to 6 `###` questions, answered in 2 to 4 sentences each, phrased as people search them.
- Internally link 3 to 6 related pages using root-relative links (`/docs/install`, `/compare/chrome-devtools-mcp`, `/claude-code-chrome`). Only link to slugs in the page plan below.
- Length: guides and comparisons 900 to 1,500 words; docs as long as needed; use cases 700 to 1,100 words.
- Front matter, exactly:

```
---
title: <55-65 chars, includes the main query>
description: <140-160 chars, plain, includes the query>
slug: <from the plan>
type: guide | compare | docs | use-case
nav: <short sidebar label, 1-4 words>
updated: 2026-11-04
---
```

## Page plan (slug: target query)

### Docs (type: docs)

| Slug | Topic |
|---|---|
| `docs` | Overview: what Agent Chrome is and how it works |
| `docs/install` | Install Agent Chrome for every agent with one command |
| `docs/tools` | Tool reference (every tool, its parameters, examples) |
| `docs/claude-and-chatgpt` | Use Agent Chrome as a Claude or ChatGPT connector |
| `docs/multiple-chrome-profiles` | Connect several Chrome profiles |
| `docs/recording` | Record screenshots, MP4 clips and GIFs |
| `docs/local-mode` | Run Agent Chrome fully local |
| `docs/self-host` | Self-host on Cloudflare |
| `docs/security` | Security and privacy model |
| `docs/troubleshooting` | Troubleshooting and FAQ |

### Guides (type: guide)

| Slug | Target query |
|---|---|
| `chrome-mcp-server` | Pillar: "Chrome MCP server": what it is, options, how to pick |
| `claude-code-chrome` | "let Claude Code control Chrome" / "Claude Code browser" |
| `codex-chrome` | "Codex CLI Chrome" / "Codex browser" (incl. `codex exec`, Windows) |
| `gemini-cli-chrome` | "Gemini CLI browser" |
| `cursor-chrome` | "Cursor browser MCP" |
| `antigravity-chrome` | "Antigravity browser" / "agy MCP Chrome" |
| `grok-chrome` | "Grok CLI browser" |
| `opencode-chrome` | "opencode browser MCP" |
| `muse-chrome` | "Muse Code browser" |

### Comparisons (type: compare)

| Slug | Comparison |
|---|---|
| `compare/claude-in-chrome` | Agent Chrome vs Claude in Chrome |
| `compare/codex-chrome-extension` | Agent Chrome vs the Codex Chrome extension |
| `compare/chrome-devtools-mcp` | Agent Chrome vs Chrome DevTools MCP |
| `compare/playwright-mcp` | Agent Chrome vs Playwright MCP |
| `compare/browser-mcp` | Agent Chrome vs Browser MCP |
| `compare/best-chrome-mcp-servers` | The best MCP servers for controlling Chrome in 2026 (fair roundup) |

### Use cases (type: use-case)

| Slug | Topic |
|---|---|
| `use-cases/test-web-apps-with-ai` | Test your web app with an AI agent in your real browser |
| `use-cases/record-browser-videos` | Record a browser video or demo with AI |
| `use-cases/logged-in-websites` | Let an AI agent work on sites you're logged into |
| `use-cases/debug-console-network` | Debug console and network errors with an AI agent |
| `use-cases/fill-forms-and-uploads` | Fill web forms and upload files with AI |
| `use-cases/multiple-accounts` | QA across several accounts and Chrome profiles |
