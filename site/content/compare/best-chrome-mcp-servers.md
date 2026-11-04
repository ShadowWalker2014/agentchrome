---
title: Best Chrome MCP Servers for AI Agents in 2026 (Compared)
description: The best MCP servers for controlling Chrome in 2026: Agent Chrome, Claude in Chrome, Chrome DevTools MCP, Playwright MCP, Browser MCP, compared.
slug: compare/best-chrome-mcp-servers
type: compare
nav: Best Chrome MCP servers
updated: 2026-11-04
---

# The Best MCP Servers for Controlling Chrome in 2026

The best option depends on one question: do you need your own logged-in Chrome, or a clean browser? For your real sessions across several agents, pick Agent Chrome or Browser MCP. For performance traces, pick Chrome DevTools MCP. For repeatable tests across browsers, pick Playwright MCP.

Agent Chrome is our project, so weigh that. Each entry below says what the other tools do better than we do.

## Pick by need

| You need | Pick | Why |
|---|---|---|
| One setup for Claude Code, Codex, Gemini CLI and Cursor in your real Chrome | Agent Chrome | Remote MCP server, installer writes every agent's config |
| MP4 recordings of what the agent did | Agent Chrome | `record` saves MP4 or WebM; Chrome DevTools MCP and Playwright MCP also record video |
| Web Store install, everything local | Browser MCP | Extension on the Chrome Web Store, server on 127.0.0.1 |
| Claude-only work with side panel features | Claude in Chrome | Built by Anthropic for the Claude apps and Claude Code |
| ChatGPT or Codex desktop app tasks in your browser | OpenAI browser extension | @-mention flow inside the desktop app |
| Performance traces and Lighthouse | Chrome DevTools MCP | Traces, insights and CrUX data |
| Firefox, WebKit, Docker or CI | Playwright MCP | Multiple browsers and headless containers |
| Console and network logs from an open DevTools tab | BrowserTools MCP | Extension plus audits, read-oriented |

## Agent Chrome

A Chrome extension plus a remote MCP server (MIT). It pairs each Chrome profile, gives each agent its own tab group, shows a blue border, status pill and Stop button, and records MP4, WebM and GIF. Install with `curl -fsSL https://agentchrome.dev/install | sh`.

Limits: Chrome only, the extension loads unpacked (not on the Web Store yet), and it has no performance traces. See [Agent Chrome docs](/docs) and [the pillar guide](/chrome-mcp-server).

## Claude in Chrome

Anthropic's extension works with the Claude apps and Claude Code. It requires a paid Claude plan, and the Claude Code docs say it needs `/login` with a claude.ai account, not an API key. It is better than ours at Claude-specific features such as the side panel, scheduled tasks and shortcuts. See [the full comparison](/compare/claude-in-chrome).

## OpenAI browser extension (Codex)

OpenAI's extension works from a ChatGPT Work or Codex chat in the desktop app and asks for approval per website. It supports Chrome, Edge, Brave, Opera and Vivaldi. See [the full comparison](/compare/codex-chrome-extension).

## Chrome DevTools MCP

Google's server (Apache-2.0) launches its own Chrome by default and can attach to a running one. It offers performance traces, Lighthouse audits, memory tools and `screencast_start` for MP4. It is the clear pick for performance work. See [the full comparison](/compare/chrome-devtools-mcp).

## Playwright MCP

Microsoft's server (Apache-2.0) drives Chrome, Firefox, WebKit or Edge with accessibility snapshots and a persistent profile of its own. It has an extension mode for existing tabs, Docker support and WebM recording with chapters. See [the full comparison](/compare/playwright-mcp).

## Browser MCP

An extension from the Chrome Web Store plus a local `npx` server (Apache-2.0). It uses your signed-in profile in per-app tab groups, supports several profiles and runs on 127.0.0.1. It is the simplest install of the real-browser options. See [the full comparison](/compare/browser-mcp).

## BrowserTools MCP

AgentDesk's MCP server and extension (MIT) send console logs, network activity, screenshots and Lighthouse audits from your existing Chrome. Capture starts once DevTools is open on the page. Its actions (navigate, soft click and type) are off unless you enable them. It is a good fit when you want an agent to read what DevTools shows, and less of one when you want it to drive the page.

## Quick comparison

| | Uses your logged-in Chrome | Video | Browsers | License |
|---|---|---|---|---|
| Agent Chrome | Yes | MP4, WebM, GIF | Chrome | MIT |
| Claude in Chrome | Yes | GIF (via Claude Code) | Chrome (Claude Code also detects Edge and others) | Not documented |
| OpenAI extension | Yes | Not documented | Chrome, Edge, Brave, Opera, Vivaldi | Not documented |
| Chrome DevTools MCP | With `--autoConnect` or `--browser-url` | MP4 screencast | Chrome | Apache-2.0 |
| Playwright MCP | With `--extension` | WebM | Chrome, Firefox, WebKit, Edge | Apache-2.0 |
| Browser MCP | Yes | Not documented | Chrome and Chromium browsers | Apache-2.0 |
| BrowserTools MCP | Yes | Not documented | Chrome and Chromium browsers | MIT |

## How to choose

1. If you use one vendor's app and it ships an extension, start there.
2. If you use several agents and want your logged-in Chrome, try Agent Chrome or Browser MCP.
3. If your task is performance or cross-browser testing, use Chrome DevTools MCP or Playwright MCP.
4. You can install more than one MCP server. Name the one you want in your prompt.

Then read [Chrome MCP server: what it is and how to pick](/chrome-mcp-server), [testing web apps with AI](/use-cases/test-web-apps-with-ai) and [Claude Code with Chrome](/claude-code-chrome).

## Sources

- https://github.com/ShadowWalker2014/agentchrome
- https://code.claude.com/docs/en/chrome
- https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome
- https://learn.chatgpt.com/docs/chrome-extension
- https://github.com/ChromeDevTools/chrome-devtools-mcp
- https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
- https://github.com/microsoft/playwright-mcp
- https://github.com/BrowserMCP/mcp
- https://browsermcp.io
- https://github.com/AgentDeskAI/browser-tools-mcp

## Frequently asked questions

### What is the best MCP server for controlling Chrome?
It depends on the job. For your logged-in Chrome across several agents, Agent Chrome and Browser MCP fit. Chrome DevTools MCP is best for performance, and Playwright MCP is best for repeatable cross-browser tests.

### Which Chrome MCP server uses my real logins?
Agent Chrome, Browser MCP, BrowserTools MCP, Claude in Chrome and the OpenAI extension work in your signed-in Chrome. Chrome DevTools MCP and Playwright MCP can attach to one, but launch their own browser by default.

### Which Chrome MCP server can record video?
Agent Chrome (MP4, WebM, GIF), Chrome DevTools MCP (MP4 screencast) and Playwright MCP (WebM) document video. Claude in Chrome documents GIF recording through Claude Code.

### Do I need remote debugging flags?
Chrome DevTools MCP needs remote debugging on to attach to a running Chrome. The extension-based options do not.

### Can I use more than one?
Yes. They are independent MCP servers. Tell the agent which to use in the prompt.
