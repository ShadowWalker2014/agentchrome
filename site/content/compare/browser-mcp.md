---
title: Browser MCP vs Agent Chrome: Which Should You Use in 2026?
description: Browser MCP vs Agent Chrome: which should you use? Compare Web Store install, local vs remote server, profiles, recording, security and license.
slug: compare/browser-mcp
type: compare
nav: vs Browser MCP
updated: 2026-11-04
---

# Browser MCP vs Agent Chrome: Which Should You Use in 2026?

Use Browser MCP if you want a Chrome Web Store install, a server that runs only on your computer, and support for Chromium browsers such as Edge and Brave. Use Agent Chrome if you want MP4 recordings, a hosted or self-hosted remote MCP server, Claude.ai and ChatGPT connectors, or a visible Stop button with an animated agent cursor.

The two are close in spirit. Both pair a Chrome extension with an MCP server so an agent can use your signed-in browser in its own tab group.

## Side-by-side

| | Browser MCP | Agent Chrome |
|---|---|---|
| Made by | Namu (browsermcp.io) | Open source, operated by Circo, Inc. |
| License | Apache-2.0 | MIT |
| Install | Chrome Web Store, plus `npx @browsermcp/mcp@latest` in your MCP config | `curl -fsSL https://agentchrome.dev/install \| sh`, then load the unpacked extension |
| Where the server runs | A background process on your computer, listening on 127.0.0.1 | Cloudflare Workers, local mode on 127.0.0.1:47823, or self-hosted |
| Browsers | Chrome and Chromium browsers such as Edge and Brave | Chrome 120 or newer |
| Uses your logins | Yes | Yes |
| Tab group per agent | Yes, color-coded | Yes, named and colored |
| Several profiles | Yes, each profile connects | Yes, all at once, chosen per call |
| Stop control | Stop in the popup, or Cancel on Chrome's debugging bar | Stop on the page and in the popup, plus Cancel on the debugging bar |
| Video recording | Not documented | MP4, WebM and GIF |
| Claude.ai or ChatGPT connector | Not documented | Yes, OAuth 2.1 |

## Setup

Browser MCP has two steps. Install the extension from the Chrome Web Store and pin it, then add the server to your AI app. For Claude Code:

```sh
claude mcp add --scope user browsermcp -- npx @browsermcp/mcp@latest
```

On first use the agent shows a six-digit code. You confirm the same code in the popup and click Allow. It needs Node.js 20 or newer.

Agent Chrome uses one installer and a one-time extension load:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It writes the MCP config for every agent it finds, then you load the unpacked extension and paste a pairing code. Agent Chrome is not on the Chrome Web Store yet, so Browser MCP has the simpler extension install. See [install](/docs/install).

## Which agents it works with

Browser MCP lists Claude Code, Cursor, VS Code, Codex and Claude Desktop, plus other MCP apps. Each app runs its own `npx` server process, and a shared background process talks to the extension.

Agent Chrome is a remote MCP server, so one account serves every agent, including headless runs such as `codex exec` and `claude -p`, and the Claude.ai and ChatGPT connectors. See [Claude and ChatGPT](/docs/claude-and-chatgpt).

## Real browser and logins

Both use your own Chrome profile with your signed-in sites. Browser MCP's page says agents work in background tabs, grouped and named after the AI app, and you can drag a tab in or out of a group to give it to an agent or take it back. Agent Chrome's `tabs_select` with `adopt` pulls a user tab into the agent's group.

## Multiple profiles

Browser MCP says other Chrome profiles with the extension connect too, and agents can use tabs in each. It warns against running the Web Store and self-built extensions in the same profile.

Agent Chrome pairs each profile with its own device token. `list_browsers` shows them online or offline, and a call can choose one with `browser: "Work"`. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

## Visibility and control

Browser MCP's safety controls are the pairing code, a Stop button that pauses all agents and releases their tabs, no access to incognito unless you allow it, and no access to browser pages. Agents see other tabs' titles only when they list tabs.

Agent Chrome adds a pulsing blue border, a status pill with the agent's logo and a Stop button, and an animated cursor with the agent's name. It never moves your real mouse. The popup lists sessions with Pause and Resume.

## Recording

Browser MCP's pages do not mention video recording. Agent Chrome's `record` tool saves MP4 or WebM clips up to 10 minutes with no overlays by default, and `gif_creator` saves GIFs. See [recording](/docs/recording).

## Security

Browser MCP says everything runs on your computer and page content goes to your AI app, "never to Browser MCP's servers." The extension talks only to the local daemon, and the site states it cannot protect you from malware running as your user.

Agent Chrome's hosted server relays tool calls between your agent and your browser, and stores no page content except files an agent explicitly saves, which are kept for 7 days. If you want nothing to leave your machine, use [local mode](/docs/local-mode). Keys are stored only as SHA-256 hashes, and pairing codes are single use. See [security](/docs/security).

## Pricing and license

Browser MCP is Apache-2.0, and the Chrome Web Store listing shows about 100,000 users and a 4.7 rating at the time I checked. I found no price on its site. Agent Chrome is MIT licensed, with a hosted server, a local mode and a self-host script.

## When to choose each

Choose Browser MCP if:

- You want the Chrome Web Store install and automatic extension updates.
- You want everything to stay on your computer by default.
- You use Edge or Brave.

Choose Agent Chrome if:

- You want to record MP4 clips of what the agent does.
- You use Claude.ai or ChatGPT as well as coding agents.
- You want to run the same setup from scripts and several machines, or self-host.

See also [the pillar guide](/chrome-mcp-server), [logged-in websites](/use-cases/logged-in-websites) and [Playwright MCP](/compare/playwright-mcp).

## Sources

- https://github.com/BrowserMCP/mcp
- https://browsermcp.io
- https://chromewebstore.google.com/detail/browser-mcp/bjfgambnhccakkhmkepdoekmckoijdlc
- https://github.com/ShadowWalker2014/agentchrome

## Frequently asked questions

### Is Browser MCP the same as Agent Chrome?
No. They are separate projects with a similar idea. Browser MCP runs a local daemon and installs from the Chrome Web Store. Agent Chrome runs a remote MCP server on Cloudflare, or locally, and loads as an unpacked extension.

### Does Browser MCP work with my logged-in sessions?
Yes. Its page says agents use your signed-in sites in tabs of their own. Agent Chrome does the same.

### Can Browser MCP record video?
The pages I checked do not document recording. Agent Chrome records MP4, WebM and GIF.

### Which is more private?
Browser MCP runs entirely on your computer. Agent Chrome offers a local mode that does the same, and the hosted mode stores no page content except files an agent saves, kept 7 days.

### Does Agent Chrome work in Edge or Brave?
Agent Chrome supports Chrome for now. Browser MCP lists Edge and Brave as supported.
