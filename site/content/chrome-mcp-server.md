---
title: Chrome MCP Server: What It Is and How to Choose the Right One
description: A Chrome MCP server lets an AI agent control Chrome through MCP. Compare extension, CDP and Playwright approaches and pick the right one for your agent.
slug: chrome-mcp-server
type: guide
nav: Chrome MCP server
updated: 2026-11-04
---

# Chrome MCP server: what it is and how to choose one

A Chrome MCP server is a program that exposes browser actions, such as open a page, click, type, read the page and take a screenshot, as tools that an AI agent can call over the Model Context Protocol (MCP). You pick one by deciding whose browser the agent should use: your own signed-in Chrome, a separate Chrome it launches, or a fresh Playwright-controlled browser.

This page explains the three main approaches, where each one fits, and how Agent Chrome fits in.

## What an MCP server does for a browser

MCP is the standard way coding agents such as Claude Code, Codex, Gemini CLI and Cursor call outside tools. A Chrome MCP server publishes a list of browser tools. The agent reads the list, calls `navigate` or `read_page`, and gets structured results back. The server turns those calls into real browser actions.

The differences between servers come down to one question: which browser does the action happen in?

## The three main approaches

| Approach | Which browser | Logins and cookies | Typical use |
|---|---|---|---|
| Extension in your real Chrome | The Chrome profile you already use | Yours, already signed in | Testing your app behind login, working in dashboards, recording demos |
| Separate Chrome launched or attached over the debugging port | A Chrome started for the agent, or one you started with debugging on | Whatever that instance has | Performance traces, DevTools-style debugging |
| Playwright-style automation | A browser the tool launches and controls | A clean or persistent automation profile | Repeatable test runs and scripted flows |

### 1. An extension in your real Chrome

An extension runs inside the browser you use every day, and a server relays tool calls to it. The agent works with the sessions you already have, so it can open your staging dashboard without a new login. The trade-offs: you install an extension once per Chrome profile, and an agent with your logged-in browser can do what you can.

Agent Chrome, Browser MCP, Claude in Chrome and the Codex Chrome extension all take this route. They differ in which agents they support.

### 2. A separate Chrome over the debugging port

Google's [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) starts a Chrome when the agent first needs one, and it can also connect to a running Chrome (its advanced usage guide covers that). Its headline feature is performance analysis: it records traces through DevTools and returns insights, and it reads console messages and network requests with source-mapped stack traces. If you want performance work, it is a strong choice.

The usual limit is that a launched Chrome starts without your logins, and attaching to an existing one means setting up remote debugging. See [Agent Chrome vs Chrome DevTools MCP](/compare/chrome-devtools-mcp).

### 3. Playwright-style automation

Microsoft's [Playwright MCP](https://github.com/microsoft/playwright-mcp) drives its own browser through accessibility snapshots. By default it runs headed with a persistent profile, so logins you make inside it are kept for that workspace. It also has an extension mode (`--extension`) for connecting to existing Chrome or Edge tabs. If you already test with Playwright, it fits naturally and gives you repeatable runs. See [Agent Chrome vs Playwright MCP](/compare/playwright-mcp).

## Which should you pick?

- **Use Agent Chrome or another extension-based server** when the agent should act in your signed-in Chrome: checking a dashboard, reproducing a bug behind login, filling a form, or recording a demo.
- **Use Chrome DevTools MCP** when the job is performance traces or deep DevTools debugging.
- **Use Playwright MCP** when you want a controlled, repeatable browser for tests, or you already have a Playwright setup.
- **Use more than one.** The servers do not conflict. Many people keep a DevTools or Playwright server for tests and an extension server for logged-in work.

For a wider survey, read the [roundup of the best Chrome MCP servers](/compare/best-chrome-mcp-servers) and the comparisons with [Browser MCP](/compare/browser-mcp), [Claude in Chrome](/compare/claude-in-chrome) and the [Codex Chrome extension](/compare/codex-chrome-extension).

## How Agent Chrome works

Agent Chrome is an open-source (MIT) Chrome extension plus a remote MCP server using Streamable HTTP. The hosted server runs on Cloudflare Workers at `https://agentchrome.dev/mcp`, with one Durable Object per account. You can also run it locally on `http://127.0.0.1:47823` or self-host it on Cloudflare.

Because it is a plain remote MCP server, any MCP client can use it, including in non-interactive runs such as `claude -p` and `codex exec`. It uses the same tool names as Claude in Chrome, so prompts written for that extension transfer.

Install it with one command:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

The installer needs Node.js 18 or newer and Chrome 120 or newer. It creates an account, adds an MCP server named `agentchrome` to every agent it detects, links a shared skill, unpacks the extension to `~/Documents/Agent Chrome` and prints a pairing code. You then load the extension unpacked in `chrome://extensions` and connect it. The extension is not on the Chrome Web Store yet.

### What the agent can do

- **Tabs and groups:** `tabs_context`, `tabs_create`, `tabs_close`, `tabs_select`, `tab_groups`
- **Navigation and input:** `navigate` and `computer` (clicks, drags, typing, keys, scrolling, zoom, screenshots)
- **Reading:** `read_page` (accessibility tree with `ref_N` handles), `find`, `get_page_text`
- **Forms and uploads:** `form_input`, `file_upload`, `upload_image`, `handle_dialog`, `wait_for`
- **Debugging:** `javascript_tool`, `read_console_messages`, `read_network_requests`
- **Capture:** `screenshot`, `record` (MP4 or WebM, up to 10 minutes) and `gif_creator`
- **Profiles:** `list_browsers` and `select_browser` for several Chrome profiles

The [tool reference](/docs/tools) has parameters and examples for each.

### How you stay in control

Each MCP session gets its own named, colored tab group. The page shows a pulsing blue border and a status pill with the agent's logo and a **Stop** button. The agent has its own animated cursor and never moves your real mouse. The popup lists sessions with Pause and Resume, plus Stop all. Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent.

## Honest limits

- Chrome only for now. There is no Firefox or Safari support.
- The extension is loaded unpacked. It is not on the Chrome Web Store yet.
- Chrome shows a debugging bar while the extension is attached.
- It cannot act on `chrome://` pages or the Web Store.
- An agent in your logged-in browser can do what you can, and pages can contain prompt injection.

## Setup guides by agent

- [Claude Code](/claude-code-chrome)
- [Codex](/codex-chrome)
- [Gemini CLI](/gemini-cli-chrome)
- [Cursor](/cursor-chrome)
- [Antigravity](/antigravity-chrome)
- [Grok](/grok-chrome)
- [opencode](/opencode-chrome)
- [Muse](/muse-chrome)

Or read the [install docs](/docs/install) for every agent at once.

## Frequently asked questions

### What is a Chrome MCP server?
It is a server that gives an AI agent browser tools over the Model Context Protocol. The agent calls tools such as `navigate`, `read_page` and `computer`, and the server carries them out in Chrome and returns the result.

### What is the difference between an extension-based and a Playwright-based browser MCP?
An extension-based server works in the Chrome you already use, with your logins. A Playwright-based server drives a browser it controls, which is better for repeatable test runs. Playwright MCP also offers an extension mode for connecting to existing tabs.

### Which Chrome MCP server works with Claude Code and Codex at the same time?
Agent Chrome does, because it is a standard remote MCP server and each agent session gets its own tab group in the same paired Chrome. Chrome DevTools MCP and Playwright MCP can also be added to both agents.

### Do I need to open a remote debugging port?
Not with Agent Chrome. The extension keeps its own connection to the server, and the agent talks to the server over HTTPS. Chrome does show a "started debugging this browser" bar while an agent is attached.

### Is a Chrome MCP server safe to use with my logged-in accounts?
It carries real risk, because the agent can do what you can in that profile. Agent Chrome adds a visible border, a Stop button, per-session pause, an optional prompt before each new site and a block list. Review sensitive actions and read the [security page](/docs/security).

### Can I run a Chrome MCP server without the cloud?
Yes. Agent Chrome has a local mode on `127.0.0.1:47823` and a self-host script for Cloudflare. See [local mode](/docs/local-mode) and [self-hosting](/docs/self-host).
