---
title: Gemini CLI Browser: Let Gemini Control Your Real Chrome
description: Give Gemini CLI a real browser: control your signed-in Chrome with Agent Chrome. One command, the settings.json entry, the Disabled fix and example prompts.
slug: gemini-cli-chrome
type: guide
nav: Gemini CLI
updated: 2026-11-04
---

# Gemini CLI browser: let Gemini control your real Chrome

To give Gemini CLI a browser, run `curl -fsSL https://agentchrome.dev/install | sh`, load the Agent Chrome extension once, and trust your project folder in Gemini. The installer adds an `agentchrome` entry to `~/.gemini/settings.json`, and Gemini can then drive your real, signed-in Chrome through MCP tools.

If `gemini mcp list` shows `agentchrome` as **Disabled**, the folder is not trusted yet. Trust it with `/permissions` inside Gemini and the server turns on.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It needs Node.js 18 or newer and Chrome 120 or newer. The installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Adds `agentchrome` under `mcpServers` in `~/.gemini/settings.json`, after saving `settings.json.bak-agentchrome`.
3. Links the `agentchrome` skill into `~/.gemini/skills`.
4. Unpacks the extension to `~/.agentchrome/extension` and prints a pairing code.

To install for Gemini CLI only, run `agentchrome install gemini`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `~/.agentchrome/extension`.
3. Click the Agent Chrome icon and press **Sign in to connect**, or paste the pairing code.

## Manual configuration

Add this to `~/.gemini/settings.json`. Gemini CLI uses `httpUrl` for Streamable HTTP servers, and this is the entry the installer writes:

```json
{
  "mcpServers": {
    "agentchrome": {
      "httpUrl": "https://agentchrome.dev/mcp",
      "timeout": 180000,
      "headers": {
        "Authorization": "Bearer <key from agentchrome key>"
      }
    }
  }
}
```

The 180000 ms timeout gives page loads and recordings enough time. Keep any other servers already in the `mcpServers` object.

### Use OAuth instead of a key

```sh
agentchrome install gemini --oauth
```

This writes the `httpUrl` without a header. Gemini CLI opens a sign-in page the first time it uses the server. Paste your account key once (`agentchrome key` prints it), and Gemini receives short-lived tokens that refresh for 90 days.

## Fix: the server shows as Disabled

Gemini CLI turns off every MCP server in folders you have not trusted. In an untrusted folder, `gemini mcp list` reports `agentchrome` as Disabled even though the config is correct.

1. Start `gemini` in your project folder.
2. Run `/permissions` and trust the folder.
3. Restart the session if the server does not appear, then run `gemini mcp list` again.

If it still does not connect, run `agentchrome status` to check that the Chrome profile is online.

## Example prompts for Gemini CLI

- `Use agentchrome to open localhost:3000, click through the signup form and tell me which field has no validation.`
- `Open the analytics dashboard I am logged into, get the page text, and summarise last week's numbers.`
- `Read the network requests on this page with read_network_requests and list every call that returned a 4xx.`
- `Take a full-page screenshot of our pricing page at 375 px wide using resize_window and screenshot.`
- `Fill the contact form on staging with test data and upload ./fixtures/logo.png.`

## What you see while Gemini works

- **A tab group for the session**, with a name and color, that holds every tab Gemini opens.
- **A pulsing blue border and a status pill** with the Gemini logo and a **Stop** button.
- **Its own animated cursor** that turns into a hand over links. Your real mouse stays where it is.
- **The popup**, which lists sessions with Pause and Resume and has Stop all.

Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent. You can also ask before each new site, block sites, and keep history access off.

## Notes for Gemini CLI users

- **Sessions load servers at start.** Start a new Gemini session after installing.
- **Antigravity shares the folder.** Antigravity keeps its own MCP file under `~/.gemini/antigravity`, so Gemini CLI and Antigravity are configured separately. See the [Antigravity guide](/antigravity-chrome).
- **It acts with your logins.** The agent works with the sessions your profile already has, so avoid pointing it at accounts you do not want it to touch. Pages can contain prompt injection.

## Related pages

- [Install Agent Chrome for every agent](/docs/install)
- [Antigravity browser guide](/antigravity-chrome)
- [Troubleshooting and FAQ](/docs/troubleshooting)
- [Let AI agents work on sites you are logged into](/use-cases/logged-in-websites)
- [What is a Chrome MCP server?](/chrome-mcp-server)

## Frequently asked questions

### How do I give Gemini CLI a browser?
Install Agent Chrome with `curl -fsSL https://agentchrome.dev/install | sh`, load the extension in Chrome, and start Gemini in a trusted folder. Gemini then has tools such as `navigate`, `computer` and `read_page` that act on your real Chrome.

### Why does gemini mcp list say agentchrome is Disabled?
Gemini CLI disables MCP servers in folders you have not trusted. Run `/permissions` inside Gemini to trust the folder, and the server turns on.

### Where is the Gemini CLI MCP config?
In `~/.gemini/settings.json` under `mcpServers.agentchrome`. It uses `httpUrl`, a `timeout` of 180000 and an `Authorization` header with your key. The installer saves a backup first.

### Does Gemini CLI support OAuth for this?
Yes. Run `agentchrome install gemini --oauth` and Gemini opens a sign-in page on first use. No key is stored in `settings.json`.

### Can Gemini see my other tabs?
By default it works in its own tab group. `tabs_context` with `all: true` lists every open tab, and `tabs_select` with `adopt` can pull a tab into the group. The Ask-before-new-site and block list settings add limits.

### Does it work with the free Gemini CLI tier?
Agent Chrome does not depend on your Gemini plan. It only adds an MCP server. What the model can do with the tools depends on the model you use.
