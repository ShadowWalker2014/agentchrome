# Install agent-chrome-mcp (instructions for coding agents)

You are a coding agent installing **agent-chrome-mcp** for the user. When you finish, every coding agent on this machine (Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode, Windsurf) will have an MCP server named `agent-chrome` at **user level**, and the `agent-chrome` skill will be linked into each agent's skills folder. Follow the steps in order. Only step 3 needs the user's hands.

## 1. Check the requirements

```sh
node -v                       # needs v18 or newer
ls "/Applications/Google Chrome.app" 2>/dev/null || which google-chrome chrome chromium 2>/dev/null
```

If Node is missing or older than 18, stop and ask the user to install Node.js 18+ from https://nodejs.org.

## 2. Run the installer (one command)

Use the hosted server, which is the default:

```sh
curl -fsSL https://agent-chrome-mcp.circo.workers.dev/install | sh
```

Or, if the user wants nothing in the cloud, use local mode instead:

```sh
curl -fsSL https://agent-chrome-mcp.circo.workers.dev/install | sh -s -- --local
agent-chrome-mcp serve --install      # macOS: keeps the local server running at login
```

The installer does all of this without prompts:

- It installs the CLI to `~/.local/bin/agent-chrome-mcp`.
- It creates the user's account and saves the key in `~/.config/agent-chrome-mcp/config.json` with `chmod 600`.
- It adds the `agent-chrome` MCP server to every agent it detects, at user level. It backs up each file it edits as `<file>.bak-agent-chrome`.
- It writes the skill to `~/.agents/skills/agent-chrome/SKILL.md` and symlinks it into each agent's skills folder.
- It unpacks the Chrome extension to `~/.agent-chrome-mcp/extension`.
- It prints a **pairing code**, such as `ABCDE-FGHJK`, which is valid for 15 minutes.

If `~/.local/bin` is not on `PATH`, call the CLI as `~/.local/bin/agent-chrome-mcp` or add it to the user's shell profile.

To limit the install to some agents, run this after setup: `agent-chrome-mcp install claude codex grok`. The agent ids are `claude`, `codex`, `gemini`, `antigravity`, `grok`, `muse`, `cursor`, `opencode` and `windsurf`.

## 3. Ask the user to load the extension (once per Chrome profile)

You can't do this step yourself, because Chrome only lets a person install extensions. Tell the user exactly this, with the path and code filled in:

> 1. Open **chrome://extensions** in Chrome and turn on **Developer mode** (top right).
> 2. Click **Load unpacked** and choose `~/.agent-chrome-mcp/extension`.
> 3. Click the puzzle-piece icon, pin **Agent Chrome**, open it, paste the code **ABCDE-FGHJK** and press **Connect**.

If the code expired, run `agent-chrome-mcp pair` for a new one. Each extra Chrome profile needs the same three steps, with a fresh code from `agent-chrome-mcp pair`.

## 4. Verify

```sh
agent-chrome-mcp status
```

You should see the browser with a green dot (online) and a check mark next to each agent. Then check it from an agent. Agents load MCP servers when they start, so a new session may be needed:

- Call the `list_browsers` tool. It should list the profile as `"online": true`.
- Call `tabs_context`, then `navigate` with `https://example.com`. A tab group named after you appears in Chrome, with a blue border around the page.

## Configuration it writes (for reference or manual setup)

The server URL is `https://agent-chrome-mcp.circo.workers.dev/mcp` (`http://127.0.0.1:47823/mcp` in local mode). The key comes from `agent-chrome-mcp key`.

| Agent | File (user level) | Entry |
|---|---|---|
| Claude Code | `~/.claude.json` via `claude mcp add --scope user` | `{"type":"http","url":URL,"headers":{"Authorization":"Bearer KEY"}}` |
| Codex | `~/.codex/config.toml` | `[mcp_servers.agent-chrome]` `url = URL` and `[mcp_servers.agent-chrome.http_headers]` `Authorization = "Bearer KEY"` |
| Gemini CLI | `~/.gemini/settings.json` | `"mcpServers":{"agent-chrome":{"httpUrl":URL,"headers":{…}}}` |
| Antigravity | `agy mcp add` and `~/.gemini/antigravity/mcp_config.json` | `{"serverUrl":URL,"headers":{…}}` |
| Grok | `~/.grok/config.toml` via `grok mcp add --scope user` | http transport with header |
| Muse | `~/.config/muse/settings.json` | `{"type":"streamable-http","url":URL,"headers":{…}}` |
| Cursor | `~/.cursor/mcp.json` | `{"url":URL,"headers":{…}}` |
| opencode | `~/.config/opencode/opencode.json` | `"mcp":{"agent-chrome":{"type":"remote","url":URL,"headers":{…}}}` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `{"serverUrl":URL,"headers":{…}}` |

For OAuth instead of a key in config files, run `agent-chrome-mcp install --oauth`. Each agent then opens a sign-in page the first time; the user pastes the key from `agent-chrome-mcp key` there once.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No browser is connected` | Chrome is closed, or the profile isn't paired. Open Chrome and check that the toolbar popup says **Connected**. |
| Gemini CLI shows the server as **Disabled** | Gemini turns off MCP servers in untrusted folders. Trust the folder with `/permissions` inside Gemini. |
| A tool says the session is **paused** | The user pressed **Stop** on the page, or **Cancel** on Chrome's debugging bar. Ask them before you continue; they can resume from the popup. |
| Pairing says the code is wrong or expired | Run `agent-chrome-mcp pair` and use the new code within 15 minutes. |
| Opening `file://` pages fails | In `chrome://extensions`, open **Agent Chrome MCP** > **Details** and turn on **Allow access to file URLs**. |

To remove everything, run `agent-chrome-mcp uninstall`, then `rm -rf ~/.agent-chrome-mcp ~/.config/agent-chrome-mcp ~/.local/bin/agent-chrome-mcp`, and remove the extension in `chrome://extensions`.
