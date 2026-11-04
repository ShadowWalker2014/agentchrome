---
title: Install Agent Chrome for Every Coding Agent With One Command
description: Install Agent Chrome with one curl command. It adds an MCP server to Claude Code, Codex, Gemini CLI, Cursor and more, then you load the Chrome extension.
slug: docs/install
type: docs
nav: Install
updated: 2026-11-04
---

# Install Agent Chrome for Every Coding Agent With One Command

Run `curl -fsSL https://agentchrome.dev/install | sh`, then load the extension in Chrome and paste the pairing code. You need Node.js 18 or newer and Chrome 120 or newer.

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

## What the installer does

In one pass, the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json` with `chmod 600`.
2. Adds an MCP server named `agentchrome` to every agent it finds, in that agent's user-level config.
3. Writes the `agentchrome` skill once to `~/.agents/skills/agentchrome` and symlinks it into each agent's skills folder.
4. Unpacks the extension to `~/.agentchrome/extension`.
5. Opens `chrome://extensions` and prints a pairing code, which it copies to your clipboard.

It also installs the CLI to `~/.local/bin/agentchrome`. If that folder is not on your `PATH`, call it by full path or add it to your shell profile. The installer backs up every JSON or TOML file it edits as `<file>.bak-agentchrome`.

## Load the extension once per Chrome profile

The extension is not on the Chrome Web Store yet, so you load it unpacked.

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `~/.agentchrome/extension`. Run `agentchrome extension --path` to print the path.
3. Pin **Agent Chrome**, click it, and press **Sign in to connect**, or paste the pairing code and press **Connect**.

A zip of the extension is also at https://agentchrome.dev/agentchrome-extension.zip. For another profile, switch to it, load the same folder, and run `agentchrome pair` for a new code.

## Check that it works

```sh
agentchrome status
```

You should see the browser with a green dot and a check mark next to each agent. Agents load MCP servers when they start, so open a new session. Then ask:

> Use agentchrome to open news.ycombinator.com, screenshot it, and record a short clip scrolling the front page.

## Where each agent is configured

| Agent | Config written (user level) |
|---|---|
| Claude Code | `claude mcp add --scope user` (`~/.claude.json`) |
| Codex | `~/.codex/config.toml` |
| Gemini CLI | `~/.gemini/settings.json` |
| Antigravity | `agy mcp add` and `~/.gemini/antigravity/mcp_config.json` |
| Grok | `grok mcp add --scope user` (`~/.grok/config.toml`) |
| Muse | `~/.config/muse/settings.json` |
| Cursor | `~/.cursor/mcp.json` |
| opencode | `~/.config/opencode/opencode.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

## Pick agents, or use OAuth instead of a key

```sh
agentchrome install claude codex grok   # only these agents
agentchrome install --oauth             # no secret in config files; each agent signs in through the browser
```

The agent ids are `claude`, `codex`, `gemini`, `antigravity`, `grok`, `muse`, `cursor`, `opencode` and `windsurf`. With OAuth, paste your account key once on the sign-in page. `agentchrome key` prints it.

## Add it by hand

```sh
claude mcp add --scope user --transport http agentchrome https://agentchrome.dev/mcp \
  --header "Authorization: Bearer $(agentchrome key)"

codex mcp add agentchrome --url https://agentchrome.dev/mcp --bearer-token-env-var AGENT_CHROME_MCP_KEY
```

## Let your agent install it

Paste this into Claude Code, Codex or another coding agent:

> Install agentchrome for me by following https://github.com/ShadowWalker2014/agentchrome/blob/main/AGENT_INSTALL.md

The agent runs the installer and then tells you the one step only you can do: loading the extension and pasting the code.

## Uninstall

```sh
agentchrome uninstall
rm -rf ~/.agentchrome ~/.config/agentchrome ~/.local/bin/agentchrome
```

Then remove the extension in `chrome://extensions`.

## Related pages

- [Docs overview](/docs)
- [Connect several Chrome profiles](/docs/multiple-chrome-profiles)
- [Run it fully local](/docs/local-mode)
- [Troubleshooting](/docs/troubleshooting)
- [Use Claude Code with Chrome](/claude-code-chrome)

## Frequently asked questions

### What do I need before installing?
You need Node.js 18 or newer and Google Chrome 120 or newer. The installer detects the coding agents you have and configures each one.

### Why do I have to load the extension by hand?
Chrome only lets a person install extensions, and Agent Chrome is not on the Chrome Web Store yet. You turn on Developer mode, click Load unpacked and choose `~/.agentchrome/extension`. It takes about a minute per profile.

### Gemini CLI shows the server as Disabled. What do I do?
Gemini turns off MCP servers in folders you have not trusted. Trust the folder with `/permissions` inside Gemini and the server turns on.

### Can I install without a cloud account?
Yes. Add `--local` to the installer: `curl -fsSL https://agentchrome.dev/install | sh -s -- --local`. Then run `agentchrome serve --install`. See [local mode](/docs/local-mode).

### Does it work on Windows or Linux?
The installer script and CLI run on Node.js, and the CLI has code paths for macOS, Windows and Linux to open `chrome://extensions`. The launchd service from `agentchrome serve --install` is macOS only. On Linux you run `agentchrome serve` from a systemd user unit.
