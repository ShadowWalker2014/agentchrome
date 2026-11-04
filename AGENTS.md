# AGENTS.md — agent-chrome-mcp

Open-source Chrome extension and remote MCP server. Any MCP agent drives the user's real, signed-in Chrome profiles. The server runs on Cloudflare (production: https://agent-chrome-mcp.circo.workers.dev, Circo account) or locally on 127.0.0.1.

## Layout

```
packages/
  protocol/   Shared, dependency-free: tool catalog (tools.ts), MCP Streamable-HTTP handler (mcp.ts), relay wire types (wire.ts)
  server/     Cloudflare Worker: OAuth 2.1 provider, /mcp, pairing and artifact APIs, AccountHub Durable Object (one per account)
  extension/  MV3 extension: background service worker, content script (refs, a11y tree, overlay), offscreen recorder
  cli/        `agent-chrome-mcp` CLI: setup, pairing, agent installers, skill symlinks, local server
skills/agent-chrome/SKILL.md   Skill installed into every agent (one canonical copy, symlinked)
site/        Landing page and install.sh template (build-all.mjs fills in __SERVER__)
brand/       logo.svg (source of truth), wordmark, rendered icons (scripts/render-icons.mjs)
tests/e2e/   End-to-end suites: real Chromium + extension + MCP SDK client
```

## How a tool call flows

1. The agent calls `POST /mcp` with a bearer token: an account API key, or an OAuth access token.
2. `OAuthProvider` checks the token. API keys are resolved through `resolveExternalToken`. The resulting `props.accountId` reaches `mcpApi`.
3. `handleMcpRequest` (protocol/mcp.ts) mints a signed session id on `initialize`. One MCP session maps to one Chrome tab group.
4. `list_browsers` and `select_browser` run on the server. Every other tool goes to `AccountHub.call`, which picks a browser (the explicit `browser` argument, then the session's selection, then the most recent connection) and sends `{t:"call"}` over that browser's WebSocket.
5. The extension's `runTool` (background/tools.ts) resolves the session's tab group and tab, shows the overlay, does the work through `chrome.debugger` (CDP) or the content script, and replies with `{t:"result"}`.

## Rules

- **Tool names follow Claude in Chrome.** Add new tools to `protocol/src/tools.ts`, handle them in `extension/src/background/tools.ts`, and add an end-to-end test.
- **Coordinates:** screenshots are downscaled (longest side up to 1568 px and about 1.15 MP). `computer` coordinates use the last screenshot's pixel space; convert with `page.toCss` and `page.toShot`.
- **Dialogs block the renderer.** Input that can open `alert` or `confirm` must go through `untilDialog`. Tools refuse to run while a dialog is open.
- **Never store raw secrets server-side.** Hash with `sha256`. Keys start with `acm_sk_`, device tokens with `acm_dt_`.
- **The local server (cli/local-server.ts) mirrors the Worker's HTTP API.** Change both together. `tests/e2e/local.sh` runs the full suite against it.
- **Branding:** electric blue `#2F6BFF` (tile gradient `#4C82FF` → `#1F55F0`), zinc neutrals, and no other accent colors. Edit `brand/logo.svg`, then run `node scripts/render-icons.mjs`.
- The agent installers in `cli/src/agents.ts` must stay idempotent and must back up any file they edit.

## Commands

```sh
pnpm install
node scripts/build-all.mjs                    # extension + CLI + server/public (uses DEFAULT_SERVER)
pnpm dev:server                               # wrangler dev on :8787 (apply D1 migrations with --local first)
pnpm test:e2e                                 # needs the server on :8787
ACM_SERVER=https://agent-chrome-mcp.circo.workers.dev pnpm test:e2e
sh tests/e2e/local.sh                         # local mode
node --test tests/e2e/oauth.test.mjs          # OAuth flow
cd packages/server && npx wrangler deploy     # production deploy (Circo account)
```

Production resources on the Circo account were created with the `cf` CLI: D1 `agent-chrome-mcp`, KV `agent-chrome-mcp-oauth`, R2 `agent-chrome-mcp-artifacts` (lifecycle rule deletes objects after 7 days), and the secret `SESSION_SECRET`.
