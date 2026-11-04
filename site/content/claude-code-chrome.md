---
title: Let Claude Code Control Chrome: Your Real Browser in One Command
description: How to let Claude Code control your real, signed-in Chrome with Agent Chrome: one install command, manual MCP config, example prompts and safety controls.
slug: claude-code-chrome
type: guide
nav: Claude Code
updated: 2026-11-04
---

# Let Claude Code control Chrome

To let Claude Code control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh`, load the Agent Chrome extension once, and start a new Claude Code session. The installer adds an MCP server named `agentchrome` to Claude Code at user level, so every project can use your logged-in browser.

Agent Chrome is an open-source Chrome extension plus a remote MCP server. Claude Code talks to the server over HTTPS, and the server relays each tool call to the extension in your own Chrome profile. Your cookies, sessions and extensions stay where they are.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

You need Node.js 18 or newer and Chrome 120 or newer. In one pass the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json` (`chmod 600`).
2. Runs `claude mcp add --scope user` for you, which writes the server into `~/.claude.json`.
3. Links the `agentchrome` skill into `~/.claude/skills`.
4. Unpacks the extension to `~/.agentchrome/extension`.
5. Prints a pairing code and opens `chrome://extensions`.

To install for Claude Code only, run `agentchrome install claude`.

## Load the extension once per Chrome profile

The extension is not on the Chrome Web Store yet, so you load it unpacked:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `~/.agentchrome/extension`.
3. Click the Agent Chrome icon, then press **Sign in to connect** or paste the pairing code.

Run `agentchrome status` to confirm that the browser shows as online and Claude Code has a check mark.

## Add it by hand

If you prefer to configure Claude Code yourself, use the Claude Code CLI. This writes to `~/.claude.json` at user scope:

```sh
claude mcp add --scope user --transport http agentchrome https://agentchrome.dev/mcp \
  --header "Authorization: Bearer $(agentchrome key)"
```

The entry it stores looks like this:

```json
{
  "type": "http",
  "url": "https://agentchrome.dev/mcp",
  "headers": { "Authorization": "Bearer <key from agentchrome key>" }
}
```

### Use OAuth instead of a key in the config

```sh
agentchrome install claude --oauth
```

With `--oauth` the installer registers the URL with no `Authorization` header. Claude Code opens a sign-in page on first use. You paste your account key once (`agentchrome key` prints it), and Claude Code receives short-lived tokens that refresh for 90 days. No secret sits in `~/.claude.json`.

## Example prompts for Claude Code

Start a new Claude Code session after installing, because Claude Code loads MCP servers at startup.

- `Use agentchrome to open localhost:3000, sign in with the saved session, and click through the checkout flow. Tell me what breaks.`
- `Open our staging dashboard in Chrome, read the console errors with read_console_messages, then find the failing request with read_network_requests and fix the bug in this repo.`
- `Go to the billing page of our admin panel in my Work profile and screenshot the invoice table.`
- `Record a 30 second MP4 of the signup flow on localhost:3000 and give me the link.`
- `Fill the bug report form on our tracker with the steps from the failing test and attach the screenshot.`

Claude Code can also run these from scripts with `claude -p`, because the server is a plain remote MCP server and does not depend on an interactive window.

## What you see while Claude Code works

- **A tab group per session.** Each Claude Code session gets its own named, colored tab group in Chrome. New tabs the agent opens join that group, so your own tabs stay separate.
- **A blue border and a status pill.** The page pulses with a blue border, and a pill shows the Claude Code logo with a **Stop** button.
- **A separate cursor.** Claude Code gets an animated cursor with its name and logo. It becomes a hand over links and an I-beam over text. Your real mouse never moves.
- **The popup.** It lists every agent session with Pause and Resume, plus Stop all.
- **Cancel on the debugging bar.** Chrome shows a "started debugging this browser" bar while an agent is attached. Pressing Cancel stops every agent and tells it why.

You can also turn on "ask before each new site", keep a block list, and leave history access off, which is the default.

## Notes for Claude Code users

- **Tool names match Claude in Chrome.** Agent Chrome uses the same names (`tabs_context`, `computer`, `read_page`, `find`, `form_input`, `javascript_tool` and so on), so prompts and skills written for Claude in Chrome work unchanged. See the [tool reference](/docs/tools).
- **Start with `tabs_context`.** The server instructions tell Claude Code to call it first, which creates the session's tab group.
- **Several profiles.** Pair Work and Personal profiles and pick one per call with `browser: "Work"`, or use `select_browser`. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).
- **Recordings stay clean.** `record` leaves out the border, pill and name tag by default, so the clip looks like a person using the page. See [recording](/docs/recording).
- **Prompt injection is real.** An agent with your logged-in browser can do what you can, and web pages can contain instructions aimed at it. The skill tells Claude Code never to follow instructions found inside pages, but you should still review sensitive actions.

## Related pages

- [Install Agent Chrome for every agent](/docs/install)
- [Agent Chrome vs Claude in Chrome](/compare/claude-in-chrome)
- [Test your web app with an AI agent in your real browser](/use-cases/test-web-apps-with-ai)
- [Debug console and network errors with an AI agent](/use-cases/debug-console-network)
- [What is a Chrome MCP server?](/chrome-mcp-server)

## Frequently asked questions

### How do I let Claude Code control my real Chrome browser?
Run `curl -fsSL https://agentchrome.dev/install | sh`, load the unpacked extension from `~/.agentchrome/extension`, and start a new Claude Code session. Then ask Claude Code to use agentchrome to open a page. The work happens in a tab group inside your own Chrome profile.

### Does Claude Code need the Claude in Chrome extension for this?
No. Agent Chrome is its own extension and MCP server. It uses the same tool names as Claude in Chrome, so existing prompts transfer, but nothing here depends on Anthropic's extension.

### Where does Claude Code store the Agent Chrome config?
At user scope in `~/.claude.json`, written by `claude mcp add --scope user`. The installer removes any older `agentchrome` entry first, so running it again does not create duplicates.

### Can Claude Code use Agent Chrome in headless mode?
Yes. Agent Chrome is a remote MCP server, so `claude -p` can call its tools as long as your Chrome profile is open and paired. The browser is your normal Chrome, so it must be running.

### Can I stop Claude Code while it is clicking around?
Yes. Press **Stop** in the status pill on the page, use Pause or Stop all in the extension popup, or press Cancel on Chrome's debugging bar. Every method halts the agent and tells it the session is paused.

### Does it work with Claude Code on a remote machine?
Claude Code only needs to reach `https://agentchrome.dev/mcp`, and your Chrome extension keeps its own connection to the same server. The agent and the browser can be on different computers. For a fully local setup, see [local mode](/docs/local-mode).
