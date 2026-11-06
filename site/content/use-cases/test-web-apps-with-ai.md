---
title: Test Your Web App With an AI Agent in Your Real Chrome
description: Let Claude Code, Codex or Gemini CLI test your web app in your own signed-in Chrome: click through flows, read errors, and record proof, with no test scripts.
slug: use-cases/test-web-apps-with-ai
type: use-case
nav: Test web apps
updated: 2026-11-04
---

# Test your web app with an AI agent in your real Chrome

To test a web app with an AI agent, connect the agent to your own Chrome with Agent Chrome and ask it to walk through the flow in plain English. The agent opens your app in its own tab group, clicks and types like a user, reads the console and network log, and reports what broke.

Because it uses the Chrome you already have, your dev login, your feature flags and your extensions are all there. You do not write selectors or a test script first.

## The problem: scripted tests and clean browsers do not match what you see

Most agent browser tools start a fresh browser. People describe the same frustrations again and again:

- "Playwright opens a clean browser, not mine."
- "Chrome DevTools MCP launches a separate Chrome without my logins, and I need remote debugging flags."
- "Claude in Chrome works maybe 1 out of 10 times."

When you want a quick check of a checkout flow or a new settings page, you do not want to rebuild your session in a blank browser. You want the agent to use the tab you would have used.

## Set up once

Run the installer, then load the extension in Chrome:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

The installer adds an MCP server named `agentchrome` to every agent it finds, unpacks the extension to `~/Documents/Agent Chrome`, and prints a pairing code. In `chrome://extensions`, turn on Developer mode, drag that folder onto the page, and paste the code in the popup. See [Install Agent Chrome](/docs/install) for the details.

![Agent working in Chrome](/media/agent-view.gif)

While the agent works you see a pulsing blue border, a status pill with a Stop button, and the agent's own animated cursor. Your real mouse is never moved.

## Walkthrough: test a signup flow

Say you just built a signup form and want it checked before you push. Ask your agent:

> Use agentchrome to open http://localhost:3000/signup. Fill the form with a new test user, submit it, and tell me if anything fails. Check the console and network too.

Here is what the agent will call, in order:

1. `tabs_context` creates or lists the agent's tab group. Each MCP session gets its own named, colored group, so your own tabs stay untouched.
2. `navigate` with `url: "http://localhost:3000/signup"` loads the page and waits for it. If the server returns a 404 or the host does not resolve, the result says so.
3. `read_page` with `filter: "interactive"` returns the accessibility tree. Every field and button has a handle such as `ref_12`.
4. `form_input` sets the email, plan and terms checkbox by `ref`. For example `form_input` with `ref: "ref_12"` and `value: "test@example.com"`. It fires the same input and change events a user would.
5. `computer` with `action: "left_click"` and `ref: "ref_20"` presses the submit button.
6. `wait_for` with `text: "Welcome"` waits until the success message appears, or fails after `timeoutMs`.
7. `read_console_messages` with `onlyErrors: true` returns uncaught errors and `console.error` output.
8. `read_network_requests` with `urlPattern: "/api/signup"` and `includeBodies: true` shows the status, timing and the response body (up to 10 KB) of the call.

The agent then summarizes: what worked, what returned a 500, and which console error fired at the same moment. See [Debug console and network errors](/use-cases/debug-console-network) for that part in depth.

## Test the awkward parts too

Real apps have more than text boxes. These all work today:

- **Drag and drop.** `computer` with `action: "left_click_drag"`, `start_ref` and `ref` runs native HTML5 drag and drop, so Trello-style boards work. Pointer-based sliders and sortable lists also work with `start_coordinate` and `coordinate`.
- **Dialogs.** If a click opens `alert`, `confirm` or `prompt`, the result tells the agent, and `handle_dialog` with `accept: true` (and `promptText` for prompts) answers it. The page never freezes the run.
- **New tabs and downloads.** A link that opens a new tab joins the agent's group, and a download is reported in the result of the click that caused it.
- **Responsive checks.** `resize_window` with `width: 390` and `height: 844` changes the window, and `screenshot` with `fullPage: true` captures the whole page.
- **File uploads.** See [Fill web forms and upload files](/use-cases/fill-forms-and-uploads).

## Keep proof of the run

Ask for a recording and you get an MP4 you can attach to the pull request:

> Start a recording, repeat the signup flow, then stop and give me the link.

The agent calls `record` with `action: "start"`, does the steps, then `record` with `action: "stop"`. The clip leaves out the border, status pill and name tag by default, so it looks like a person using the page. More in [Record a browser video or demo with AI](/use-cases/record-browser-videos).

![Clean recording](/media/clean-recording.gif)

## Tips and limits

- **Name the page and the pass condition.** "Submit the form and confirm the text 'Welcome' appears" gives the agent something to check.
- **Use refs, not pixels.** `read_page` and `find` return refs, and clicking by ref is steadier than clicking by coordinate.
- **Stop it any time.** The Stop button on the page or in the popup pauses every agent. Pressing Cancel on Chrome's "started debugging this browser" bar stops them too.
- **Chrome only.** There is no Firefox or Safari support yet, and the extension is loaded unpacked because it is not on the Chrome Web Store yet.
- **It cannot act on `chrome://` pages or the Web Store.** The agent is told why.
- **Use a test account.** An agent with your logged-in browser can do what you can, and pages can contain prompt injection. Do not point it at production data you cannot afford to change.
- **Agent Chrome complements your test suite.** It is good for exploratory checks and reproducing bugs. Keep your CI tests for regression.

If you are choosing between tools, see [Agent Chrome vs Playwright MCP](/compare/playwright-mcp) and the [Chrome MCP server guide](/chrome-mcp-server).

## Frequently asked questions

### Can an AI agent test my web app in my own Chrome?

Yes. Agent Chrome connects Claude Code, Codex, Gemini CLI, Cursor and other MCP agents to your signed-in Chrome profile. The agent works in its own tab group, so it can test your app with your real login and flags while your other tabs stay as they are.

### Do I need to write Playwright or Selenium scripts?

No. You describe the flow in plain English, and the agent picks the tools (`navigate`, `read_page`, `form_input`, `computer`). If you want a repeatable test afterwards, ask the agent to write one from what it just did.

### Can it test localhost?

Yes. The agent loads `http://localhost:3000` the same way you would type it in the address bar, because the browser is your own Chrome on your own machine.

### Can I watch what the agent is doing?

Yes. A pulsing blue border surrounds the page, a status pill shows which agent is working, and the agent has its own animated cursor. The popup lists each agent session with Pause and Resume buttons.

### Does it work with `codex exec` or `claude -p`?

Yes. Agent Chrome is a remote MCP server, so headless runs of agents can use it as long as your Chrome with the extension is open. See [Codex and Chrome](/codex-chrome) and [Claude Code and Chrome](/claude-code-chrome).
