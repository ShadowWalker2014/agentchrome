---
title: Chrome DevTools MCP vs Agent Chrome: Which Should You Use?
description: Chrome DevTools MCP vs Agent Chrome: which should you use? Compare performance tools, logged-in profiles, setup, recording, security and license in one table.
slug: compare/chrome-devtools-mcp
type: compare
nav: vs Chrome DevTools MCP
updated: 2026-11-04
---

# Chrome DevTools MCP vs Agent Chrome: Which Should You Use?

Use Chrome DevTools MCP if you need performance traces, Lighthouse audits or deep DevTools debugging, and a separate browser is fine. Use Agent Chrome if you want the agent to work in the Chrome you already use, with your logged-in profiles, a visible "agent at work" overlay and no debugging flags.

They solve different problems. Google's server gives an agent the DevTools toolbox. Agent Chrome gives an agent your everyday browser.

## Side-by-side

| | Chrome DevTools MCP | Agent Chrome |
|---|---|---|
| Made by | Google (ChromeDevTools on GitHub) | Open source, operated by Circo, Inc. |
| License | Apache-2.0 | MIT |
| Default browser | Launches its own Chrome | Your own Chrome, through an extension |
| Using your signed-in profile | `--autoConnect` (Chrome 144+, remote debugging switched on in `chrome://inspect`), or `--browser-url` with a non-default profile directory | Yes, by pairing the profile |
| Install | `npx -y chrome-devtools-mcp@latest` in your MCP config | `curl -fsSL https://agentchrome.dev/install \| sh`, then load the unpacked extension |
| Performance traces and insights | Yes, with CrUX field data | Not offered |
| Lighthouse audits | Yes (`lighthouse_audit`) | Not offered |
| Console and network | Yes | Yes |
| Screenshots | Yes | Yes, including full page and zoom |
| Video | `screencast_start` and `screencast_stop` save an MP4 | `record` saves MP4 or WebM, plus GIF |
| Several profiles | `--autoConnect` connects to the default profile | All paired profiles at once |

## Setup

Chrome DevTools MCP needs Node.js LTS, npm and a current stable Chrome. You add one block to your client's config:

```json
{"mcpServers":{"chrome-devtools":{"command":"npx","args":["-y","chrome-devtools-mcp@latest"]}}}
```

The browser starts when a tool first needs it. Google lists Antigravity, Claude, Claude Code, Cursor, Copilot, VS Code and Gemini CLI as supported clients.

Agent Chrome installs into every agent it finds with one command and then needs the extension loaded once per profile:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

See [install](/docs/install).

## Which agents it works with

Both are standard MCP servers. Chrome DevTools MCP runs as a local process started by your client. Agent Chrome is a remote MCP server over Streamable HTTP, with a local mode too, so it also works for Claude.ai and ChatGPT connectors. See [Gemini CLI](/gemini-cli-chrome) and [Cursor](/cursor-chrome) setups for examples.

## Real browser and logins

By default Chrome DevTools MCP uses its own profile at `$HOME/.cache/chrome-devtools-mcp/chrome-profile`, which persists between runs. To use your everyday Chrome you have two routes. `--autoConnect` needs Chrome 144 or newer, remote debugging turned on at `chrome://inspect/#remote-debugging`, and you start Chrome yourself. Chrome asks for permission, and the server can see all open windows of the profile. The `--browser-url` route needs Chrome started with `--remote-debugging-port` and, per the docs, a non-default user data directory. Google warns that any application on your machine can connect to that port.

Agent Chrome needs none of that. The extension is loaded in your normal profile and paired with a single-use code.

## Multiple profiles

With `--autoConnect`, if several profiles are open, the docs say the server connects to the default profile. Agent Chrome pairs each profile, and `list_browsers` shows Work and Personal side by side. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

## Visibility and control

Chrome DevTools MCP documents `--headless` and runs headed by default. Its docs do not describe an on-page overlay or a stop control.

Agent Chrome adds a pulsing blue border, a status pill with a Stop button, an animated agent cursor and a named tab group per session. The popup has Pause, Resume and Stop all, and pressing Cancel on Chrome's debugging bar stops every agent.

## Recording

Chrome DevTools MCP can record a screencast to an `.mp4` and take PNG, JPEG or WebP screenshots. It also records performance traces, which are data, not video.

Agent Chrome records MP4 or WebM clips of up to 10 minutes. By default the clip shows a natural cursor and no overlay. See [recording](/docs/recording).

## Security

Google's disclaimer says MCP clients can inspect, debug and modify any data in the browser or DevTools, so avoid sharing sensitive information. It collects usage statistics unless you pass `--no-usage-statistics`, and `--no-performance-crux` stops trace URLs from going to the CrUX API.

Agent Chrome stores keys only as SHA-256 hashes, expires pairing codes after 15 minutes and lets you revoke each profile. An agent with your logged-in browser can do what you can, and pages can contain prompt injection. See [security](/docs/security).

## Pricing and license

Chrome DevTools MCP is Apache-2.0. Agent Chrome is MIT. Both are open source, and I found no price for either server in their repositories.

## When to choose each

Choose Chrome DevTools MCP if:

- You are tuning Core Web Vitals and want traces, insights and Lighthouse reports.
- You test in a clean, disposable browser and do not need your logins.
- You want Google's maintained, source-mapped console output and emulation tools.

Choose Agent Chrome if:

- The task sits behind your logins: dashboards, admin panels, internal tools.
- You want to watch the agent work and stop it with one click.
- You need several Chrome profiles, or one setup for every agent.

Many people install both. See [the pillar guide](/chrome-mcp-server) and [debugging console and network errors](/use-cases/debug-console-network).

## Sources

- https://github.com/ChromeDevTools/chrome-devtools-mcp
- https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
- https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md
- https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md
- https://github.com/ShadowWalker2014/agentchrome

## Frequently asked questions

### Does Chrome DevTools MCP use my logged-in Chrome?
Not by default, because it launches its own browser with its own profile. You can connect to a running Chrome with `--autoConnect` on Chrome 144 or newer, or with `--browser-url` and a debugging port. Agent Chrome uses your normal profile through an extension.

### Can Agent Chrome run performance traces?
No. Agent Chrome offers console, network, JavaScript and screenshot tools, but no performance traces or Lighthouse audits. Use Chrome DevTools MCP for those.

### Which is better for testing my web app?
For a clean-slate test with traces, use Chrome DevTools MCP. For a flow behind login, such as a signed-in dashboard, use Agent Chrome. See [testing web apps with AI](/use-cases/test-web-apps-with-ai).

### Do they need remote debugging flags?
Chrome DevTools MCP needs remote debugging switched on only when you attach to a running Chrome. Agent Chrome needs no flags, but Chrome shows a "started debugging this browser" bar while the agent is attached.

### Can I use both?
Yes. Add both MCP servers and tell the agent which to use for each task.
