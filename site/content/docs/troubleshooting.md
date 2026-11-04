---
title: Agent Chrome Troubleshooting: Fix Connection and Tool Errors
description: Fixes for Agent Chrome problems: no browser connected, paused sessions, expired pairing codes, Gemini Disabled, file URLs, chrome pages and more.
slug: docs/troubleshooting
type: docs
nav: Troubleshooting
updated: 2026-11-04
---

# Agent Chrome Troubleshooting: Fix Connection and Tool Errors

Start with `agentchrome status`. It shows your server, each paired browser with an online or offline dot, and which agents are configured, and that answers most connection questions.

```sh
agentchrome status
```

## Common problems

| Symptom | Fix |
|---|---|
| `No browser is connected` | Chrome is closed, or the profile is not paired. Open Chrome and check that the toolbar popup says **Connected**. |
| Gemini CLI shows the server as **Disabled** | Gemini turns off MCP servers in untrusted folders. Trust the folder with `/permissions` inside Gemini. |
| A tool says the session is **paused** | You pressed **Stop** on the page, or **Cancel** on Chrome's debugging bar. Resume from the popup. Agents should ask before continuing. |
| Pairing says the code is wrong or expired | Run `agentchrome pair` and use the new code within 15 minutes. Codes are single use. |
| Opening `file://` pages fails | In `chrome://extensions`, open **Agent Chrome** > **Details** and turn on **Allow access to file URLs**. |
| `agentchrome: command not found` | Add `~/.local/bin` to your `PATH`, or call `~/.local/bin/agentchrome`. |
| A new agent does not see the tools | Agents load MCP servers at startup. Open a new session. |
| Local mode will not connect | Run `agentchrome serve` and set **Server** in the popup to `http://127.0.0.1:47823`. |

## The agent cannot act on a page

- **`chrome://` pages and the Chrome Web Store:** extensions cannot touch these. The tool result explains this. Navigate to a normal page.
- **Password-manager frames:** if one blocks the debugger, Agent Chrome uses a fallback.
- **A dialog is open:** `alert`, `confirm` and `prompt` dialogs block the page. Tools report the open dialog, and `handle_dialog` accepts or dismisses it.
- **A file picker opened:** Agent Chrome holds it back and tells the agent. Call `file_upload` without `ref` to fill it.
- **HTTP errors, DNS failures and crashed tabs** are reported in the result so the agent can react.

## The debugging bar

Chrome shows "started debugging this browser" while the extension is attached. This is Chrome's own notice. If you press Cancel, every agent stops and is told why.

## Check the agent config

`agentchrome status` marks each agent with a check mark when the server is installed. To add the server to one agent, run:

```sh
agentchrome install claude
```

The installer backs up edited files as `<file>.bak-agentchrome`, so you can restore a previous version.

## Reset

```sh
agentchrome uninstall
rm -rf ~/.agentchrome ~/.config/agentchrome ~/.local/bin/agentchrome
curl -fsSL https://agentchrome.dev/install | sh
```

Remove the extension in `chrome://extensions` and load it again after the reinstall.

## Still stuck

Open an issue at https://github.com/ShadowWalker2014/agentchrome, or see https://agentchrome.dev/support.

## Related pages

- [Docs overview](/docs)
- [Install Agent Chrome](/docs/install)
- [Tool reference](/docs/tools)
- [Security and privacy](/docs/security)
- [Local mode](/docs/local-mode)

## Frequently asked questions

### Why does my agent say no browser is connected?
No paired Chrome profile is online. Open Chrome, click the Agent Chrome icon and confirm it says Connected. If it does not, run `agentchrome pair` and paste the new code.

### Why did my agent stop in the middle of a task?
Someone pressed Stop on the page or the popup, or pressed Cancel on Chrome's debugging bar. Resume the session from the popup when you are ready.

### Why can't the agent open a file:// page?
Chrome needs permission for file URLs. In `chrome://extensions`, open Agent Chrome, then Details, and turn on Allow access to file URLs.

### Why is Gemini CLI saying the server is Disabled?
Gemini disables MCP servers in folders you have not trusted. Trust the folder with `/permissions` inside Gemini and the server turns on.

### Does it work on chrome:// pages or the Chrome Web Store?
No. Chrome does not let extensions act on those pages. The tool tells the agent why, and the agent should navigate to a normal site.
