---
title: Agent Chrome Docs: What It Is and How It Works
description: Agent Chrome is a Chrome extension and remote MCP server that lets coding agents and chat apps use your real, signed-in Chrome. Start here for the overview.
slug: docs
type: docs
nav: Overview
updated: 2026-11-04
---

# Agent Chrome Docs: What It Is and How It Works

Agent Chrome is a Chrome extension plus a remote MCP server that lets AI agents use the Chrome profiles you already use, with your logins intact. It works with Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode, Windsurf and any other MCP client that speaks Streamable HTTP. It is open source under the MIT license and operated by Circo, Inc.

## How it works

The extension keeps one WebSocket open to the server. The server is a Cloudflare Worker at `https://agentchrome.dev/mcp`, with one Durable Object per account. When an agent calls a tool, the server picks a connected browser and sends the call to the extension, which does the work in your Chrome and replies.

```
Claude Code ─┐                    ┌──────────────────────────────┐        ┌─ Chrome "Work" profile
Codex ───────┤  MCP over HTTPS    │ Cloudflare Worker            │  WSS   │   (extension, paired)
Gemini ──────┼──────────────────► │  /mcp  OAuth 2.1 or API key  │ ◄────► ├─ Chrome "Personal" profile
Grok, Muse … ┘                    │  Durable Object per account  │        └─ …
                                  └──────────────────────────────┘
```

Tools that act on a page use the Chrome debugger protocol for input, screenshots, console logs and network logs. A small content script provides element refs, the accessibility tree, the overlay and the agent cursor.

## What you see while an agent works

- Each MCP session gets its own named, colored tab group, and new tabs it opens join that group.
- The page shows a pulsing blue border and a status pill with the agent's logo and a **Stop** button.
- The agent has its own animated cursor with its name and logo. It never moves your real mouse.
- The toolbar popup lists agent sessions, each with Pause and Resume, plus Stop all.

## Three ways to run it

| Mode | Server | Best for |
|---|---|---|
| Hosted | `https://agentchrome.dev/mcp` | The fastest start, and chat apps such as Claude.ai and ChatGPT |
| Local | `http://127.0.0.1:47823` | Keeping everything on your machine. See [local mode](/docs/local-mode) |
| Self-hosted | Your own Cloudflare account | Running your own copy. See [self-hosting](/docs/self-host) |

## Where to go next

- [Install Agent Chrome](/docs/install) for every agent with one command.
- [Tool reference](/docs/tools) for every tool, its parameters and examples.
- [Claude and ChatGPT connectors](/docs/claude-and-chatgpt) for chat apps.
- [Security and privacy](/docs/security) for how keys, pairing and data are handled.
- [What a Chrome MCP server is](/chrome-mcp-server) and how to choose one.

## Limits to know about

- Chrome only for now. There is no Firefox or Safari support.
- The extension is loaded unpacked. It is not on the Chrome Web Store yet.
- Chrome shows a "started debugging this browser" bar while the extension is attached.
- It cannot act on `chrome://` pages or the Web Store.
- An agent in your logged-in browser can do what you can, and web pages can contain prompt injection.

## Frequently asked questions

### What is Agent Chrome?
Agent Chrome is a Chrome extension and a remote MCP server. Together they let AI agents use your real, signed-in Chrome profiles instead of a clean browser. The code is MIT licensed on GitHub.

### Which agents does it work with?
The installer configures Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode and Windsurf. Any other MCP client that supports Streamable HTTP can connect with the URL and a bearer key. Claude.ai and ChatGPT connect as custom connectors.

### Does it run my browser in the cloud?
No. Your browser stays on your computer. The server only relays tool calls between the agent and your extension, and it does not store page contents. Local mode removes the cloud server entirely.

### Is it free?
The software is open source under the MIT license. You can self-host it on Cloudflare, which runs on the Workers free tier for personal use according to the README.

### Can I watch and stop the agent?
Yes. The page shows a blue border and a status pill with a Stop button, and the popup can pause one agent or stop all of them. Pressing Cancel on Chrome's debugging bar also stops every agent.
