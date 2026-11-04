---
title: Use Agent Chrome as a Claude.ai or ChatGPT Connector
description: Add https://agentchrome.dev/mcp as a custom connector in Claude.ai or ChatGPT so the assistant can use your Chrome. Steps, OAuth sign-in and pairing.
slug: docs/claude-and-chatgpt
type: docs
nav: Claude and ChatGPT
updated: 2026-11-04
---

# Use Agent Chrome as a Claude.ai or ChatGPT Connector

Add `https://agentchrome.dev/mcp` as a custom connector in Claude or ChatGPT, sign in with an account key or create an account, then say "Connect my Chrome". You do not need the command line tool for this.

## Claude

This covers claude.ai, Claude Desktop and Cowork.

1. Open **Customize > Connectors > Add custom connector**.
2. Enter `https://agentchrome.dev/mcp`.
3. Press **Connect**.

## ChatGPT

1. Turn on **Developer mode** under **Settings > Apps & Connectors > Advanced**.
2. Create a connector with the URL `https://agentchrome.dev/mcp`.
3. Choose **OAuth** as the authentication method.

## Sign in

A sign-in page opens. Paste your account key, or press **Create an account** if you do not have one. If you already ran the installer, `agentchrome key` prints your key. Auth is OAuth 2.1 with PKCE, with dynamic client registration and client ID metadata documents supported.

## Connect your Chrome

Ask in chat:

> Connect my Chrome.

The assistant calls the `pairing_code` tool and walks you through the steps: install the extension, click its toolbar icon, paste the code and press **Connect**. The extension is loaded unpacked. See [install](/docs/install) for the steps, or download the zip at https://agentchrome.dev/agentchrome-extension.zip.

Then try:

> Open my analytics dashboard in Chrome and tell me what changed this week.

## What tools chat apps get

Chat apps get the directory tool set: one tool per action (`click`, `type_text`, `press_key`, `scroll`, `hover`, `drag`, `wait`, `zoom`, `list_tab_groups`, `update_tab_group`, `close_tab_group`) instead of `computer` and `javascript_tool`. Each tool has read-only and destructive annotations so the app can ask before risky actions. The full list is in the [tool reference](/docs/tools).

## Safety in chat apps

- The assistant works in its own tab group, with a blue border and a Stop button on the page.
- Ask the assistant to confirm before it clicks anything that buys, sends or deletes.
- Pages can contain prompt injection. Keep sensitive profiles disconnected when you do not need them.
- You can revoke the connector in the app, and revoke a browser with `agentchrome revoke <id>`.

See [security](/docs/security) for how tokens are stored. Access tokens last 1 hour and refresh tokens up to 90 days, according to the privacy policy.

## Related pages

- [Docs overview](/docs)
- [Tool reference](/docs/tools)
- [Security and privacy](/docs/security)
- [Connect several Chrome profiles](/docs/multiple-chrome-profiles)
- [Troubleshooting](/docs/troubleshooting)

## Frequently asked questions

### How do I add Agent Chrome to Claude.ai?
Go to Customize > Connectors > Add custom connector, enter `https://agentchrome.dev/mcp` and press Connect. Sign in with your account key or create an account. Then ask Claude to connect your Chrome.

### How do I add Agent Chrome to ChatGPT?
Turn on Developer mode under Settings > Apps & Connectors > Advanced. Create a connector with the same URL and choose OAuth. Sign in the same way as in Claude.

### Do I need the command line tool?
No. The connector flow creates an account in one click, and the `pairing_code` tool gives you the code for the extension. You still load the extension in Chrome yourself.

### Why does the assistant say no browser is connected?
No Chrome profile is paired, or Chrome is closed. Ask it to connect your Chrome again, check that the extension popup says Connected, and see [troubleshooting](/docs/troubleshooting).

### Can the chat app control my mouse?
No. The agent has its own cursor inside the page, and it never moves your real mouse.
