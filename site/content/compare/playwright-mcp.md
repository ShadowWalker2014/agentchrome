---
title: Playwright MCP vs Agent Chrome: Which Should You Use in 2026?
description: Playwright MCP vs Agent Chrome: which should you use? Compare browsers, your logged-in profile, video, setup, security and license, with a rule.
slug: compare/playwright-mcp
type: compare
nav: vs Playwright MCP
updated: 2026-11-04
---

# Playwright MCP vs Agent Chrome: Which Should You Use in 2026?

Use Playwright MCP if you want repeatable automation in Chromium, Firefox or WebKit, in Docker or CI, and a clean browser is what you want. Use Agent Chrome if the agent should work in your real, signed-in Chrome profiles and you want to see what it is doing.

Playwright MCP opens a browser of its own by default, so it starts without your logins. It also has an extension mode that connects to a running browser.

## Side-by-side

| | Playwright MCP | Agent Chrome |
|---|---|---|
| Made by | Microsoft | Open source, operated by Circo, Inc. |
| License | Apache-2.0 | MIT |
| Browsers | Chrome, Firefox, WebKit, Edge | Chrome 120 or newer |
| Default profile | Its own persistent profile per workspace | Your own Chrome profile |
| Your existing tabs and logins | `--extension` mode, which needs the Playwright Extension | Yes, by default |
| How the agent sees a page | Accessibility snapshots | Accessibility tree with `ref_N` handles, plus screenshots |
| Install | `npx @playwright/mcp@latest` in your MCP config | `curl -fsSL https://agentchrome.dev/install \| sh`, then load the unpacked extension |
| Video | WebM through opt-in `devtools` tools, with chapters and action overlays | MP4, WebM and GIF |
| Docker and headless | Yes (headless Chromium in Docker) | Not documented |
| Several profiles at once | `--profile-dir-name` picks one profile in extension mode | All paired profiles at once |

## Setup

Playwright MCP needs Node.js 18 or newer. Add this to your client's config:

```json
{ "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } } }
```

For Claude Code: `claude mcp add playwright npx @playwright/mcp@latest`. The browser is headed by default, and `--headless` switches it off. You can also run it as a standalone HTTP server with `--port 8931`.

Agent Chrome:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

Then load the extension once per profile. See [install](/docs/install).

## Which agents it works with

Playwright documents Amp, Antigravity, Claude Code, Claude Desktop, Cline, Codex, Copilot, Cursor, Factory, Gemini CLI, Goose, Grok, Junie, Kiro, LM Studio, opencode, Qodo Gen, VS Code, Warp and Windsurf. Agent Chrome works with any MCP client, and the installer configures Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode and Windsurf.

## Real browser and logins

Playwright MCP keeps a persistent profile for each workspace, for example `~/Library/Caches/ms-playwright/mcp-{channel}-{workspace-hash}` on macOS. Logins you make there persist, but it is not your daily profile. Only one browser instance can use a profile at a time, so parallel clients need `--isolated` or a separate `--user-data-dir`. `--isolated` keeps the profile in memory only.

With `--extension`, Playwright MCP connects to a running Edge or Chrome and reuses existing tabs and logged-in state. It needs the Playwright Extension.

Agent Chrome works in your real profile from the start. See [logged-in websites](/use-cases/logged-in-websites).

## Multiple profiles

In extension mode `--profile-dir-name` picks the profile, and it defaults to the last used profile that has the extension. Agent Chrome keeps every paired profile online together and lets each call choose with `browser: "Work"`. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

## Visibility and control

Playwright's video tools can show an animated cursor and action overlays in recordings. The pages I checked do not describe an on-page overlay or a stop control.

Agent Chrome shows a pulsing blue border, a status pill with a Stop button and a named tab group per session. The popup has Pause, Resume and Stop all.

## Recording

Playwright MCP's `devtools` capability adds `browser_start_video` and `browser_stop_video`. Files default to `video-{timestamp}.webm` at 25 fps. There are also `browser_video_chapter` cards and action overlays. Agent Chrome's `record` saves MP4 or WebM (default 15 fps) up to 10 minutes, with a natural cursor and no overlay unless you ask for `cursor: "agent"`. See [recording](/docs/recording).

## Security

Microsoft states "Playwright MCP is not a security boundary." Origin lists do not apply to redirects, file access is limited to workspace roots by default, and `browser_run_code_unsafe` is described as RCE-equivalent.

Agent Chrome stores keys only as SHA-256 hashes, expires pairing codes after 15 minutes and lets you revoke each profile. Because it controls your real sessions, pages can contain prompt injection. See [security](/docs/security).

## Pricing and license

Playwright MCP is Apache-2.0 and Agent Chrome is MIT. I found no price for either.

## When to choose each

Choose Playwright MCP if:

- You need Firefox or WebKit.
- You run in Docker or CI and want a throwaway browser.
- You like snapshot-based automation and Playwright's test-generation tools.

Choose Agent Chrome if:

- The work is behind your logins and you do not want to set up a separate profile.
- You want to watch the agent, pause it and stop it.
- You want one setup for Claude Code, Codex and Gemini CLI.

See also [the pillar guide](/chrome-mcp-server), [Chrome DevTools MCP](/compare/chrome-devtools-mcp) and [testing web apps with AI](/use-cases/test-web-apps-with-ai).

## Sources

- https://github.com/microsoft/playwright-mcp
- https://github.com/ShadowWalker2014/agentchrome

## Frequently asked questions

### Does Playwright MCP use my real Chrome?
Not by default. It opens a persistent profile of its own. The `--extension` option connects to a running Chrome or Edge and reuses its tabs and logins, and it needs the Playwright Extension.

### Can Playwright MCP record video?
Yes, with the `devtools` capability enabled it can start and stop a WebM recording and add chapters. Agent Chrome records MP4, WebM and GIF without enabling an extra capability.

### Is Agent Chrome a Playwright replacement?
No. Playwright MCP covers more browsers and runs in containers. Agent Chrome covers your real, logged-in Chrome. Many teams use both.

### Which one is faster to set up?
Playwright MCP is one `npx` entry in your config. Agent Chrome is one command plus loading an unpacked extension once per profile.

### Which has more tools?
Playwright documents opt-in groups for network routing, storage, PDF and test assertions. Agent Chrome focuses on tabs, input, reading, forms, debugging and recording. See [the tool reference](/docs/tools).
