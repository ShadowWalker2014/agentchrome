---
title: Grok CLI Browser: Let Grok Control Your Real Chrome Browser
description: Let the Grok CLI control your real, signed-in Chrome with Agent Chrome. One install command, grok mcp add, the config.toml location and example prompts.
slug: grok-chrome
type: guide
nav: Grok
updated: 2026-11-04
---

# Grok CLI browser: let Grok control your real Chrome

To let the Grok CLI control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh`, load the Agent Chrome extension once, and start a new Grok session. The installer runs `grok mcp add --scope user` for you, which stores an `agentchrome` HTTP server in `~/.grok/config.toml`.

Grok then gets browser tools such as `navigate`, `computer`, `read_page` and `record`, and they act on the Chrome profile you already use, with your logins intact.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It needs Node.js 18 or newer and Chrome 120 or newer. When it finds the `grok` command, the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Runs `grok mcp remove agentchrome` and then `grok mcp add --scope user --transport http` with your URL and `Authorization` header.
3. Unpacks the extension to `~/Documents/Agent Chrome` and prints a pairing code.

To install for Grok only, run `agentchrome install grok`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Drag the **Agent Chrome** folder from Documents onto the page, or click **Load unpacked** and choose it.
3. Press **Sign in to connect** in the popup, or paste the pairing code.

Run `agentchrome status` afterwards. You should see your browser online and a check mark next to Grok.

## Manual configuration

Add the server with the Grok CLI. It writes to `~/.grok/config.toml`:

```sh
grok mcp add --scope user --transport http \
  --header "Authorization: Bearer $(agentchrome key)" \
  agentchrome https://agentchrome.dev/mcp
```

Check that it registered:

```sh
grok mcp list
```

To remove it, run `grok mcp remove agentchrome`.

### Use OAuth instead of a key

```sh
agentchrome install grok --oauth
```

This runs the same `grok mcp add` command without the `--header` flag. Whether Grok then offers a browser sign-in depends on your Grok version. If it does not, use the key form above.

## Custom Grok homes

If you run Grok with its own home folder, for example `GROK_HOME=~/.grok-work`, the installer finds directories named `~/.grok-*` and runs `grok mcp add` with `GROK_HOME` pointed at each one. The entry lands in that folder's `config.toml`. Run `agentchrome install grok` again after you create a new Grok home.

## Example prompts for Grok

- `Use agentchrome to open news.ycombinator.com, screenshot it, and record a short clip scrolling the front page.`
- `Open localhost:3000, submit the signup form with an empty email and tell me what error the page shows.`
- `Look at the pricing page of three competitors in separate tabs and compare their plans in a table.`
- `Open the admin panel I am signed into and list the users created today. Do not change anything.`
- `Get the page text of this article and write a five line summary.`

## What you see while Grok works

- **A named, colored tab group** for the session. New tabs opened by links join it.
- **A pulsing blue border and a status pill** with a **Stop** button.
- **Grok's own animated cursor.** Your real mouse is never moved.
- **A popup** listing every agent session with Pause and Resume, plus Stop all.

If you press Cancel on Chrome's "started debugging this browser" bar, every agent stops and is told why. Optional settings let you approve each new site, block sites, and keep history access off, which is the default.

## Notes for Grok users

- **No skill link for Grok.** The installer links the `agentchrome` skill for Claude Code, Codex, Gemini CLI, Antigravity, Cursor and opencode. Grok relies on the server instructions, which tell the agent to call `tabs_context` first and read before acting.
- **Start a new session after installing.** CLI agents load their MCP servers when they start.
- **Same server for every agent.** Grok, Claude Code and Codex can share one paired Chrome. Each works in its own tab group.
- **Real-site handling.** Agent Chrome handles drag and drop, file pickers, `alert` and `confirm` dialogs, new tabs and downloads. See the [tool reference](/docs/tools).
- **Treat pages as untrusted.** An agent with your signed-in browser can do what you can. The skill tells agents not to follow instructions found inside pages, and you can read more on the [security page](/docs/security).

## Related pages

- [Install Agent Chrome for every agent](/docs/install)
- [Security and privacy model](/docs/security)
- [Record a browser video or demo with AI](/use-cases/record-browser-videos)
- [Let AI agents work on sites you are logged into](/use-cases/logged-in-websites)
- [What is a Chrome MCP server?](/chrome-mcp-server)

## Frequently asked questions

### How do I let the Grok CLI use my browser?
Install Agent Chrome, load the extension in Chrome and pair it with the code the installer prints. The installer adds an `agentchrome` HTTP MCP server to Grok, and your next Grok session can call browser tools in your real Chrome.

### Where does Grok store the Agent Chrome config?
In `~/.grok/config.toml`, written by `grok mcp add --scope user`. If you use a custom `GROK_HOME`, the config is in that folder instead.

### Does it work with GROK_HOME or several Grok profiles?
Yes. The installer detects `~/.grok-*` folders and registers the server in each of them.

### Can Grok see my passwords?
Grok works in the pages you point it at, with the same access you have in that profile. Agent Chrome does not store page content on the server, but an agent can read what is on a page. Keep the block list and the ask-before-new-site setting in mind for sensitive accounts.

### How do I remove it from Grok?
Run `agentchrome uninstall grok`, or run `grok mcp remove agentchrome` yourself.
