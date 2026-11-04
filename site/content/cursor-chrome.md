---
title: Cursor Browser MCP: Let Cursor Control Your Real Chrome
description: Add a browser MCP server to Cursor that drives your real signed-in Chrome. One install command, the ~/.cursor/mcp.json entry, prompts and safety controls.
slug: cursor-chrome
type: guide
nav: Cursor
updated: 2026-11-04
---

# Cursor browser MCP: let Cursor control your real Chrome

To let Cursor control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh`, load the Agent Chrome extension once, and restart Cursor. The installer adds an `agentchrome` server to `~/.cursor/mcp.json`, and Cursor's agent can then open pages, click, read the console and record video in your signed-in browser.

Agent Chrome is a remote MCP server, so Cursor only needs a URL and an `Authorization` header. The browser it controls is the Chrome you already use, with your cookies and sessions.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It needs Node.js 18 or newer and Chrome 120 or newer. When it finds Cursor (the `cursor-agent` or `cursor` command, or a `~/.cursor` folder), the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Adds `agentchrome` to `~/.cursor/mcp.json`, after saving `mcp.json.bak-agentchrome`.
3. Links the `agentchrome` skill into `~/.cursor/skills`.
4. Unpacks the extension to `~/.agentchrome/extension` and prints a pairing code.

To install for Cursor only, run `agentchrome install cursor`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `~/.agentchrome/extension`.
3. Press **Sign in to connect** in the popup, or paste the pairing code.

## Manual configuration

Add this to `~/.cursor/mcp.json`. It is the entry the installer writes:

```json
{
  "mcpServers": {
    "agentchrome": {
      "url": "https://agentchrome.dev/mcp",
      "headers": {
        "Authorization": "Bearer <key from agentchrome key>"
      }
    }
  }
}
```

Keep any servers that are already in `mcpServers`. Restart Cursor or reload its MCP settings so it picks up the change.

### Use OAuth instead of a key

```sh
agentchrome install cursor --oauth
```

This writes the `url` with no `headers` block, so no secret sits in `mcp.json`. The server supports OAuth 2.1 sign-in for MCP clients that offer it. If your Cursor version does not show a sign-in prompt, use the key form above.

## Example prompts for Cursor

- `Use agentchrome to open localhost:3000, click the new Pricing button and check that the modal opens.`
- `Reload the page after my change, read the console with read_console_messages, and fix any errors in the component I just edited.`
- `Open the production site in my Personal profile and screenshot the checkout page at mobile width.`
- `Find the failing request on this page with read_network_requests and show me the response body.`
- `Record a short MP4 that shows the new settings page being used, then give me the link.`

## What you see while Cursor works

- **A tab group per session**, named and colored, holding every tab the agent opens.
- **A pulsing blue border and a status pill** with a **Stop** button.
- **An animated cursor** with the agent's name. Your own mouse does not move.
- **The popup**, which lists sessions with Pause and Resume, plus Stop all.

If you press Cancel on Chrome's "started debugging this browser" bar, every agent stops. The optional settings add a prompt before each new site and a block list. History access is off by default.

## Notes for Cursor users

- **Work in the editor, check in the browser.** Because the agent uses your normal Chrome, it can test the app you are building at `localhost` using the same logged-in session you use by hand.
- **Prompts from other agents transfer.** The tool names match Claude in Chrome, so a prompt that works in [Claude Code](/claude-code-chrome) works here.
- **Recordings.** `record` captures a clean clip without the border or name tag. See [recording](/docs/recording).
- **One server for every agent.** Cursor, Claude Code and Codex can share one paired Chrome, each in its own tab group.

## Check that it works

After you load the extension, confirm the whole chain before you rely on it:

```sh
agentchrome status
```

You should see your Chrome profile with a green dot and a check mark next to Cursor. Then start a new Cursor session and ask it to call `list_browsers`. It should report your profile as `"online": true`. Next ask it to call `tabs_context` and `navigate` to `https://example.com`. A tab group appears in Chrome with a blue border around the page.

If the agent says `No browser is connected`, Chrome is closed or the profile is not paired. Open Chrome, check that the popup says **Connected**, or run `agentchrome pair` for a new code. If a tool says the session is paused, someone pressed **Stop** or Cancel on the debugging bar, and you can resume from the popup. Opening `file://` pages needs **Allow access to file URLs** in the extension's details page. More fixes are in [troubleshooting](/docs/troubleshooting).

## Related pages

- [Test your web app with an AI agent](/use-cases/test-web-apps-with-ai)
- [Debug console and network errors with an AI agent](/use-cases/debug-console-network)
- [Tool reference](/docs/tools)
- [Install Agent Chrome for every agent](/docs/install)
- [Agent Chrome vs Playwright MCP](/compare/playwright-mcp)

## Frequently asked questions

### How do I add a browser to Cursor?
Run the Agent Chrome installer, load the extension in Chrome, and restart Cursor. The installer writes an `agentchrome` entry into `~/.cursor/mcp.json` that points at `https://agentchrome.dev/mcp`.

### Does Cursor use my real Chrome profile with this?
Yes. The extension runs inside the Chrome profile you paired, so Cursor's agent sees your logged-in sessions. Each agent session works in its own tab group.

### Where is the Cursor MCP config file?
At `~/.cursor/mcp.json`, in the `mcpServers` object. The entry has a `url` and an `Authorization` header. The installer saves a backup as `mcp.json.bak-agentchrome`.

### Do I need to open a debugging port for Cursor?
No. The extension connects to the server on its own, and Cursor reaches the server over HTTPS. Chrome only shows a "started debugging this browser" bar while an agent is attached.

### Can I use it with Cursor and Claude Code together?
Yes. Both connect to the same server and the same paired Chrome. Each session gets its own tab group, and the popup lists both.

### How do I remove it from Cursor?
Run `agentchrome uninstall cursor`. It deletes the `agentchrome` entry from `~/.cursor/mcp.json` and unlinks the skill.
