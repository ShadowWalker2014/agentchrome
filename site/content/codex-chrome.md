---
title: Codex CLI Chrome: Let Codex Control Your Real Chrome Browser
description: Let Codex control your real Chrome from the CLI, codex exec or a proxy setup. One install command, exact config.toml entry, prompts and safety controls.
slug: codex-chrome
type: guide
nav: Codex
updated: 2026-11-04
---

# Codex CLI Chrome: let Codex control your real browser

To let Codex control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh`, load the Agent Chrome extension once, and start Codex. The installer adds an `[mcp_servers.agentchrome]` block to your Codex `config.toml`, so the browser tools work in the Codex CLI and in `codex exec`, not only in a desktop app.

Agent Chrome works from the CLI because it is a plain remote MCP server. Codex only needs a URL and a header. Nothing depends on a Codex plugin or on a particular Codex front end.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

You need Node.js 18 or newer and Chrome 120 or newer. The installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Writes the MCP server into `~/.codex/config.toml` (or `$CODEX_HOME/config.toml` when `CODEX_HOME` is set). It backs the file up as `config.toml.bak-agentchrome`.
3. Links the `agentchrome` skill into `~/.codex/skills`.
4. Unpacks the extension to `~/Documents/Agent Chrome` and prints a pairing code.

To install for Codex only, run `agentchrome install codex`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Drag the **Agent Chrome** folder from Documents onto the page, or click **Load unpacked** and choose it.
3. Press **Sign in to connect** in the extension popup, or paste the pairing code.

The extension is not on the Chrome Web Store yet. A zip is at https://agentchrome.dev/agentchrome-extension.zip if you need to unpack it yourself.

## Manual configuration

Edit `~/.codex/config.toml` and add this block. It is exactly what the installer writes:

```toml
[mcp_servers.agentchrome]
url = "https://agentchrome.dev/mcp"
tool_timeout_sec = 180

[mcp_servers.agentchrome.http_headers]
Authorization = "Bearer <key from agentchrome key>"
```

`tool_timeout_sec = 180` gives slow tools such as page loads and recordings room to finish.

You can also add it with the Codex CLI and keep the key out of the file:

```sh
export AGENT_CHROME_MCP_KEY="$(agentchrome key)"
codex mcp add agentchrome --url https://agentchrome.dev/mcp --bearer-token-env-var AGENT_CHROME_MCP_KEY
```

### Use OAuth instead of a key

```sh
agentchrome install codex --oauth
```

This writes the `url` without any header. Codex opens a sign-in page the first time it uses the server. Paste your account key once, or press **Create an account** if you do not have one. If you cannot run the shell installer, for example on a machine where `curl ... | sh` is not available, this is also the shortest path: add the URL, sign in, load the extension from the zip, and ask Codex to call `pairing_code`.

## Use it in codex exec and the CLI

Because the server is a regular MCP server, a one-shot run works the same as an interactive session:

```sh
codex exec "Use agentchrome to open localhost:3000, log in with my saved session, and screenshot the dashboard."
```

Your Chrome profile has to be open and paired, since the browser is the one you already use.

## Proxy setups and CODEX_HOME

Some people run Codex through a local proxy with its own config folder, such as `CODEX_HOME=~/.codex-proxy`. The installer handles this:

- If `CODEX_HOME` is set when you run the installer, it writes to `$CODEX_HOME/config.toml`.
- It also finds extra folders named `~/.codex-*` that contain a `config.toml` (for example `~/.codex-proxy`), adds the same block, and links the skill into that folder's `skills` directory.

If you add a Codex home later, run `agentchrome install codex` again. The step is idempotent: it replaces the old `agentchrome` block instead of adding a second one.

## Example prompts for Codex

- `Use agentchrome to open our staging app, reproduce the failing checkout, and tell me which network request returns the 500.`
- `Read the console errors on localhost:5173 with read_console_messages, then patch the component that throws.`
- `Open the Stripe test dashboard in my Work profile and list the last five failed payments. Do not change anything.`
- `Record an MP4 of the new onboarding flow at localhost:3000 and return the link.`
- `Upload ./fixtures/invoice.pdf into the import form on the admin page and report the result message.`

## What you see while Codex works

- **A tab group for each session**, named and colored, holding every tab Codex opens.
- **A pulsing blue border and a status pill** with the Codex logo and a **Stop** button.
- **An animated Codex cursor.** Your own mouse is never moved.
- **A popup** that lists each session with Pause and Resume, plus Stop all.

Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent. Optional settings add a prompt before each new site and a block list. History access is off unless you turn it on.

## Notes for Codex users

- **Several agents, one browser.** Claude Code and Codex can use the same paired Chrome at the same time, each in its own tab group.
- **Windows and the desktop app.** The extension and the MCP entry do not depend on the Codex desktop app. If you do not have a POSIX shell, add the TOML block by hand and load the extension from the zip.
- **Recording.** `record` writes an MP4 or WebM without the border or name tag, which suits demo clips. See [recording](/docs/recording).

## Related pages

- [Agent Chrome vs the Codex Chrome extension](/compare/codex-chrome-extension)
- [Install Agent Chrome for every agent](/docs/install)
- [Run Agent Chrome fully local](/docs/local-mode)
- [Record a browser video or demo with AI](/use-cases/record-browser-videos)
- [Troubleshooting and FAQ](/docs/troubleshooting)

## Frequently asked questions

### How do I use Chrome from the Codex CLI?
Install Agent Chrome with `curl -fsSL https://agentchrome.dev/install | sh`, load the extension, and start Codex. The installer adds `[mcp_servers.agentchrome]` to `~/.codex/config.toml`, and Codex can then call tools such as `navigate`, `computer` and `read_page` in your real Chrome.

### Does Agent Chrome work with codex exec?
Yes. It is a remote MCP server configured in `config.toml`, so `codex exec` loads it like any other MCP server. Keep Chrome open with the paired profile.

### Where is the Codex config written?
In `~/.codex/config.toml`, or `$CODEX_HOME/config.toml` if you set `CODEX_HOME`. The installer saves a backup as `config.toml.bak-agentchrome` and replaces any earlier `agentchrome` block instead of duplicating it.

### Does it work if I run Codex with CODEX_HOME=~/.codex-proxy?
Yes. The installer writes to the folder `CODEX_HOME` points at, and it also detects `~/.codex-*` folders that already have a `config.toml`. It links the skill into each one.

### Do I need the Codex Chrome extension or plugin?
No. Agent Chrome has its own extension, and Codex reaches it through MCP. Both can be installed if you want to compare them.

### How do I stop Codex from controlling my browser?
Press **Stop** on the page, use Pause or Stop all in the popup, or press Cancel on Chrome's debugging bar. To remove the setup, run `agentchrome uninstall codex`.
