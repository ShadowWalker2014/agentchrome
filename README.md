<p align="center">
  <img src="brand/logo.svg" width="96" height="96" alt="Agent Chrome MCP logo">
</p>

<h1 align="center">agent-chrome-mcp</h1>

<p align="center"><b>Your real Chrome, for every coding agent.</b><br>
A Chrome extension and a remote MCP server that let Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode and Windsurf drive your signed-in Chrome profiles.</p>

<p align="center">
  <a href="https://agent-chrome-mcp.circo.workers.dev">Website</a> ·
  <a href="#install">Install</a> ·
  <a href="#tools">Tools</a> ·
  <a href="#self-host-on-cloudflare">Self-host</a> ·
  <a href="#security">Security</a>
</p>

---

Each agent session works in **its own Chrome tab group**, named after the agent. While it acts, the page gets a **pulsing blue border** and a status pill with a **Stop** button. The tool set matches Claude in Chrome name for name, and adds two things the first-party extensions lack: **all your Chrome profiles connected at once** and **MP4 video clips**.

```
Claude Code ─┐                    ┌──────────────────────────────┐        ┌─ Chrome "Work" profile
Codex ───────┤  MCP over HTTPS    │ Cloudflare Worker            │  WSS   │   (extension, paired)
Gemini ──────┼──────────────────► │  /mcp  OAuth 2.1 or API key  │ ◄────► ├─ Chrome "Personal" profile
Grok, Muse … ┘                    │  Durable Object per account  │        └─ …
                                  └──────────────────────────────┘
```

## Install

You need Node.js 18 or newer and Google Chrome.

### 1. Run the installer

```sh
curl -fsSL https://agent-chrome-mcp.circo.workers.dev/install | sh
```

In one pass, the installer:

1. Creates your account and saves the key to `~/.config/agent-chrome-mcp/config.json` with `chmod 600`.
2. Adds an MCP server named `agent-chrome` to every agent it finds, in that agent's **user-level** config (table below).
3. Writes the `agent-chrome` skill once, to `~/.agents/skills/agent-chrome`, and **symlinks** it into each agent's skills folder.
4. Unpacks the extension to `~/.agent-chrome-mcp/extension`.
5. Prints a pairing code and copies it to your clipboard.

To keep everything on your machine with no cloud at all, add `--local`. See [Local mode](#local-mode).

### 2. Load the extension, once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `~/.agent-chrome-mcp/extension`. Run `agent-chrome-mcp extension --path` to print the full path.
3. Pin **Agent Chrome MCP**, click it, paste the pairing code and press **Connect**.

To add another profile (Work, Personal, a client's), switch to that profile, load the same folder, and run `agent-chrome-mcp pair` for a new code. Each profile appears as its own browser in `list_browsers`.

### 3. Use it

Ask any agent:

> Use agent-chrome to open news.ycombinator.com, screenshot it, and record a short clip scrolling the front page.

### Where each agent is configured

| Agent | Config written (user level) | Format |
|---|---|---|
| Claude Code | `claude mcp add --scope user` (`~/.claude.json`) | `http` with an `Authorization` header |
| Codex | `~/.codex/config.toml` | `[mcp_servers.agent-chrome]` with `url` and `http_headers` |
| Gemini CLI | `~/.gemini/settings.json` | `httpUrl` and `headers` |
| Antigravity | `agy mcp add` and `~/.gemini/antigravity/mcp_config.json` | `serverUrl` and `headers` |
| Grok | `grok mcp add --scope user` (`~/.grok/config.toml`) | http with a header |
| Muse | `~/.config/muse/settings.json` | `type: "streamable-http"` |
| Cursor | `~/.cursor/mcp.json` | `url` and `headers` |
| opencode | `~/.config/opencode/opencode.json` | `type: "remote"` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `serverUrl` and `headers` |

The installer backs up every JSON or TOML file it edits as `<file>.bak-agent-chrome`. The skill is linked into `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/skills`, `~/.gemini/antigravity/global_skills`, `~/.cursor/skills` and `~/.config/opencode/skills`.

> **Gemini CLI note:** Gemini turns off every MCP server in folders you haven't trusted, so `gemini mcp list` shows "Disabled" there. Trust the folder with `/permissions` inside Gemini, and the server turns on.

### Pick agents, or use OAuth instead of a key

```sh
agent-chrome-mcp install claude codex grok   # only these agents
agent-chrome-mcp install --oauth             # no secret in config files; each agent signs in through the browser
```

With OAuth, the agent opens a sign-in page on first use. Paste your account key once (`agent-chrome-mcp key` prints it) and the agent receives short-lived tokens, refreshed for 90 days.

### Add it by hand

```sh
claude mcp add --scope user --transport http agent-chrome https://agent-chrome-mcp.circo.workers.dev/mcp \
  --header "Authorization: Bearer $(agent-chrome-mcp key)"

codex mcp add agent-chrome --url https://agent-chrome-mcp.circo.workers.dev/mcp --bearer-token-env-var AGENT_CHROME_MCP_KEY
```

Any MCP client that speaks Streamable HTTP works. Use `https://<server>/mcp` with a bearer key, or point it at the URL and let OAuth discovery do the rest.

## CLI

| Command | What it does |
|---|---|
| `agent-chrome-mcp setup [--server URL] [--key KEY] [--local]` | Creates an account or signs in, installs into agents, links the skill, unpacks the extension, prints a pairing code |
| `agent-chrome-mcp pair` | Prints a new single-use pairing code, valid for 15 minutes |
| `agent-chrome-mcp status` | Shows the account, paired browsers with online state, and which agents are configured |
| `agent-chrome-mcp install [ids] [--oauth]` / `uninstall [ids]` | Adds or removes the MCP server and the skill |
| `agent-chrome-mcp revoke <browser-id>` | Removes a paired Chrome profile; it disconnects immediately |
| `agent-chrome-mcp rotate-key` | Replaces your account key and rewrites every agent config |
| `agent-chrome-mcp key` | Prints your account key |
| `agent-chrome-mcp serve [--install]` | Runs the local server; `--install` starts it at login with launchd |
| `agent-chrome-mcp extension [--path]` | Unpacks the extension and shows how to load it |

## Tools

The tool names match Claude in Chrome, so prompts and skills written for it work unchanged.

| Tool | What it does |
|---|---|
| `tabs_context` | Lists this session's tab group and tabs; creates a group with a tab if there is none. `all: true` lists every tab |
| `tabs_create` / `tabs_close` / `tabs_select` | Opens, closes or switches tabs inside the session group; `adopt` pulls a user tab into the group |
| `tab_groups` | Lists, creates, renames, recolors, collapses, moves or ungroups Chrome tab groups |
| `navigate` | Loads a URL and waits for it; also takes `back`, `forward` and `reload` |
| `computer` | `screenshot`, `left_click`, `right_click`, `middle_click`, `double_click`, `triple_click`, `hover`, `left_click_drag`, `type`, `key` (combos like `cmd+a`), `scroll`, `scroll_to`, `wait`, `zoom`. Accepts coordinates or element refs, plus `modifiers` |
| `screenshot` | Captures the viewport or the full page, JPEG or PNG; `save: true` returns a download link |
| `read_page` | Returns an accessibility tree with `ref_N` handles; `filter: "interactive"`, `ref_id` to read a subtree, `viewportOnly` |
| `find` | Finds elements from a plain-language description and returns refs with coordinates |
| `form_input` | Sets inputs, selects, checkboxes, radios and contenteditable fields by ref |
| `get_page_text` | Returns the readable text of the article or main content |
| `javascript_tool` | Runs JavaScript in the page and returns the last expression; supports `await` and works under strict CSP |
| `read_console_messages` / `read_network_requests` | Returns console logs and errors, and requests with status and timing; can include response bodies |
| `file_upload` / `upload_image` | Fills a file input from base64, a URL or a screenshot, without opening the native file picker |
| `record` | Records an **MP4 or WebM video clip** of the tab with click highlights and returns a link |
| `gif_creator` | Records an animated GIF and returns it inline |
| `wait_for` | Waits until text appears or disappears, a CSS selector matches, or the URL matches |
| `handle_dialog` | Accepts or dismisses `alert`, `confirm` and `prompt` dialogs |
| `resize_window` | Resizes the browser window |
| `history_search` | Searches browsing history, only when you turn it on in the popup |
| `list_browsers` / `select_browser` | Lists paired Chrome profiles and picks one; every tool also takes `browser: "<name or id>"` |

## Feature parity

| | Claude in Chrome | Codex Chrome extension | agent-chrome-mcp |
|---|---|---|---|
| Works with any MCP agent | Claude only | Codex only | **yes** |
| Tab group per agent session | yes | yes | **yes**, and the agent can rename and recolor it |
| Several Chrome profiles at once | one connected browser at a time | one profile | **yes, all at once** |
| Screenshots | yes | yes | **yes**, including full-page and zoom |
| Video recording | GIF | no | **MP4 or WebM, plus GIF** |
| Console, network, JavaScript | yes | yes | **yes** |
| Per-site permission prompt | yes | yes | **yes**, off by default; also a block list |
| Visible "agent at work" indicator | yes | not documented | **pulsing border, status pill and Stop button** |
| Runs headless from scripts (`codex exec`, `claude -p`) | no | no | **yes**, since it's a remote MCP server |
| Self-hostable | no | no | **yes**: Cloudflare or local |

## Local mode

```sh
curl -fsSL https://agent-chrome-mcp.circo.workers.dev/install | sh -s -- --local
agent-chrome-mcp serve --install    # starts the local server now and at every login (macOS)
```

The server listens only on `127.0.0.1:47823` and rejects requests from web pages. In the extension popup, open **Server** and set it to `http://127.0.0.1:47823` before connecting. Screenshots and recordings are saved to `~/.agent-chrome-mcp/artifacts`.

## Self-host on Cloudflare

```sh
git clone https://github.com/ShadowWalker2014/agent-chrome-mcp && cd agent-chrome-mcp
pnpm install
npx wrangler login
sh scripts/deploy-cloudflare.sh my-agent-chrome
```

The script creates a D1 database, a KV namespace and an R2 bucket, runs the migrations, deploys the Worker with its Durable Object, sets a session secret, and prints your own install line (`curl -fsSL https://my-agent-chrome.<you>.workers.dev/install | sh`). After you create your own account, set `SIGNUP_MODE` to `"closed"` so nobody else can sign up.

It runs comfortably on the Workers free tier for personal use. Durable Objects hibernate between calls, so an idle extension connection costs nothing.

## Security

- **Keys:** account keys (`acm_sk_…`) and device tokens (`acm_dt_…`) are 256-bit random values. The server stores only their SHA-256 hashes. The local config file is `chmod 600`.
- **Pairing:** a browser joins your account only with a single-use 10-character code that expires after 15 minutes, created by someone who already holds the account key. Each Chrome profile gets its own device token, which you can revoke on its own.
- **OAuth 2.1:** PKCE (S256), dynamic client registration, refresh-token rotation and RFC 9728 discovery, using [`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider).
- **Isolation:** each account has its own Durable Object. MCP session ids are signed with HMAC and bound to the account, so one account cannot use another's session.
- **Recordings:** screenshots and videos you choose to save go to R2 behind unguessable 144-bit links and are deleted after 7 days.
- **Control in the browser:** the Stop button on the page or in the popup pauses every agent at once. You can also ask before each new site, block sites, and keep history access off, which is the default.
- **Rate limits:** sign-up, pairing and the sign-in page are rate-limited per IP address.
- **Untrusted pages:** the skill and the server instructions tell agents never to follow instructions found inside web pages.

Please report vulnerabilities through a [private GitHub security advisory](https://github.com/ShadowWalker2014/agent-chrome-mcp/security/advisories/new).

## Development

```sh
pnpm install
pnpm --filter @agent-chrome-mcp/server exec wrangler d1 migrations apply agent-chrome-mcp --local
pnpm dev:server                         # Worker on http://127.0.0.1:8787
node scripts/build-all.mjs              # extension, CLI and public assets
pnpm test:e2e                           # 26 end-to-end tests: real Chromium, the extension and the MCP SDK client
ACM_SERVER=https://… pnpm test:e2e      # the same suite against a deployed server
sh tests/e2e/local.sh                   # the same suite against local mode
```

See [AGENTS.md](AGENTS.md) for the architecture and the rules for contributors.

## License

MIT
