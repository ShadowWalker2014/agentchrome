---
title: Debug Console and Network Errors With an AI Agent in Chrome
description: Let Claude Code or Codex read your Chrome console errors and network requests, run JavaScript in the page, and find the failing call, using Agent Chrome.
slug: use-cases/debug-console-network
type: use-case
nav: Debug console, network
updated: 2026-11-04
---

# Debug console and network errors with an AI agent

To debug a page with an AI agent, connect the agent to your Chrome with Agent Chrome and ask it to reproduce the bug and read the console and network log. It calls `read_console_messages` for errors and `read_network_requests` for failed calls, then reports which request or script broke.

The agent reads the same tab you would open DevTools on, with your login, so bugs that only show up for your account can be reproduced.

## The problem: you are the copy-paste layer

The usual loop is: reproduce the bug, open DevTools, copy the red error, paste it into the chat, then copy the failing request, paste that, and repeat when the agent asks for more. Agent browser tools that start a clean browser cannot reproduce bugs that need your session, your feature flags or your data.

With Agent Chrome the agent does the reproducing and the reading itself.

## Walkthrough: find why a save button does nothing

Ask your agent:

> Use agentchrome to open http://localhost:3000/settings, click "Save changes", and tell me why nothing happens. Check console errors and failed network requests.

The agent will call:

1. `tabs_context` to get its tab group.
2. `navigate` with `url: "http://localhost:3000/settings"`. The console and network capture starts from the first time the agent touches the tab.
3. `find` with `query: "Save changes button"` returns a ref and coordinates.
4. `computer` with `action: "left_click"` and the `ref`.
5. `wait_for` with `textGone: "Saving..."` and `timeoutMs: 5000` to let the request finish, or fail after the timeout.
6. `read_console_messages` with `onlyErrors: true` returns uncaught errors and `console.error` lines. Use `pattern` to filter by regex, `limit` to cap the count, and `clear: true` to reset the log between runs.
7. `read_network_requests` with `urlPattern: "/api/"` and `includeBodies: true` returns each request's URL, method, status, type and timing. With `includeBodies`, XHR and fetch responses include up to 10 KB of body, which is where an API error message usually sits.

A typical report from the agent: "The click sent `PATCH /api/settings` and got a 422. The response body says `email: must be unique`. The console shows `Uncaught TypeError: Cannot read properties of undefined` from the error handler, so the UI never shows the message."

![Agent working in Chrome](/media/agent-view.gif)

## Go further with `javascript_tool`

When logs are not enough, the agent can inspect the page itself. `javascript_tool` runs JavaScript in the page's main world and returns the value of the last expression. It supports `await`, works on pages with a strict Content Security Policy, and reports a thrown error as an error result.

Examples you can ask for:

> Check what `localStorage.getItem("token")` holds and whether the token has expired.

> Call `fetch('/api/me')` from the page and show me the JSON.

The tool call is `javascript_tool` with `text: "await fetch('/api/me').then(r => r.json())"`. Ask the agent to return small values. Huge objects are not a good return value.

## Check what the user would see

Console and network are half the picture. Add visual and state checks:

- `computer` with `action: "screenshot"` shows the error toast, or the lack of one.
- `screenshot` with `fullPage: true` captures the whole page.
- `read_page` returns the accessibility tree, so the agent can check whether an error message exists in the DOM but is hidden.
- `get_page_text` reads the main content.

If the bug depends on timing or on a dialog, note that `alert`, `confirm` and `prompt` are reported to the agent and `handle_dialog` answers them, and HTTP errors such as 404 and DNS failures are reported by `navigate`.

## Record the bug

Once the agent can reproduce it, ask for proof you can attach to the issue:

> Reproduce the bug again with a recording on, then stop and give me the link.

The agent uses `record` with `action: "start"` and `action: "stop"`. See [Record a browser video or demo with AI](/use-cases/record-browser-videos).

## Tips and limits

- **The log starts when the agent first touches a tab.** Errors that fired earlier, before the agent attached, are not there. Reload with `navigate` and `url: "reload"` to capture a page load from the start.
- **Filter early.** `pattern`, `onlyErrors` and `urlPattern` keep the result small, so the agent spends less context on noise.
- **Response bodies are capped.** `includeBodies` returns up to 10 KB per XHR or fetch response.
- **This is not a performance profiler.** For traces and Lighthouse-style audits, Chrome DevTools MCP is the better tool. See [Agent Chrome vs Chrome DevTools MCP](/compare/chrome-devtools-mcp).
- **Chrome shows a "started debugging this browser" bar** while the extension is attached. Cancelling it stops every agent.
- **Use a test account** if the bug involves writes. The agent can do what you can.

For a full end-to-end test around the bug, see [Test your web app with an AI agent](/use-cases/test-web-apps-with-ai). If the failing page needs your login, read [Let an AI agent work on sites you are logged into](/use-cases/logged-in-websites). The parameters of each tool are listed in the [tool reference](/docs/tools).

## Frequently asked questions

### Can an AI agent read my Chrome console?

Yes. With Agent Chrome, the agent calls `read_console_messages` and gets log, warning and error lines plus uncaught exceptions from the tab. You can filter by regex with `pattern` or ask for only errors with `onlyErrors: true`.

### Can it see failed network requests?

Yes. `read_network_requests` returns URL, method, status, type and timing for each request, and you can filter by `urlPattern`. Set `includeBodies: true` to include up to 10 KB of the response body for XHR and fetch calls.

### Can the agent run JavaScript on the page?

Yes. `javascript_tool` runs code in the page and returns the last expression. It supports `await` and works under a strict CSP.

### Why is the console empty?

Capture starts when the agent first touches the tab, so earlier messages are missing. Ask the agent to reload the page with `navigate` and `url: "reload"`, then read the console again.

### Does this replace Chrome DevTools MCP?

Not for performance work. Chrome DevTools MCP is strong at performance traces. Agent Chrome is the better fit when the bug needs your signed-in Chrome, or when you also want to click through the flow and record it.
