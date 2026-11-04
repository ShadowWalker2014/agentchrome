---
title: Codex Chrome Extension vs Agent Chrome: Which Should You Use?
description: Codex Chrome extension vs Agent Chrome: which should you use? Compare setup, agent support, profiles, recording, permissions and price, with a decision rule.
slug: compare/codex-chrome-extension
type: compare
nav: vs Codex Chrome
updated: 2026-11-04
---

# Codex Chrome Extension vs Agent Chrome: Which Should You Use?

Use OpenAI's browser extension if you work from the ChatGPT or Codex desktop app and want its @-mention flow and built-in website approvals. Use Agent Chrome if you want the same Chrome available to Codex CLI, Claude Code, Gemini CLI, Cursor and other agents, or if you want MP4 recordings.

OpenAI's docs now call this the ChatGPT browser extension, and the Codex Chrome extension page redirects to it. It starts tasks from a ChatGPT Work or Codex chat in the desktop app.

## Side-by-side

| | OpenAI browser extension (Codex) | Agent Chrome |
|---|---|---|
| Made by | OpenAI | Open source, operated by Circo, Inc. |
| Where you start a task | ChatGPT Work or Codex chat in the desktop app, by @-mentioning the browser | Any MCP client: Codex, Claude Code, Gemini CLI, Cursor, opencode and more |
| Requires desktop app | Yes, the ChatGPT desktop app | No |
| Browsers | Chrome, Edge, Brave, Opera, Vivaldi | Chrome 120 or newer |
| Uses your signed-in sites | Yes | Yes |
| Several profiles | Use the profile where the extension is installed | All paired profiles at once |
| Website approvals | Allow once, Allow for this site, Allow for all sites, or Decline | Optional ask before each new site, plus a block list |
| Video recording | Not documented | MP4, WebM and GIF |
| Works in Codex CLI | Not documented | Yes, as a remote MCP server |
| Price | Plans required: Not documented | MIT license, open source |

## Setup

For the OpenAI extension you open Settings > Computer Use in the desktop app, pick the browser, click Install on the store page, accept the permission prompts, and confirm the browser shows Manage. Then you @-mention the browser in a chat. Availability, the page says, can depend on rollout and workspace settings.

For Agent Chrome:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

The installer writes an `agentchrome` MCP server into `~/.codex/config.toml` and every other agent it finds. You then load the unpacked extension and paste the pairing code. It is not on the Chrome Web Store yet. See [install](/docs/install) and the [Codex guide](/codex-chrome).

## Which agents it works with

OpenAI's page describes tasks started from a ChatGPT Work or Codex chat in the desktop app. It does not document use from the Codex CLI or `codex exec`. GitHub users have filed issues about CLI browser access, for example [openai/codex#57641](https://github.com/openai/codex/issues/57641), titled "Terminal CLI @Browser fails with 'The browser access host is unavailable'". I did not verify whether those issues are resolved.

Agent Chrome is a remote MCP server over HTTP, so `codex exec`, `claude -p` and other scripted runs can call it the same way as an interactive session.

## Real browser and logins

OpenAI says ChatGPT can read or act on sites where you are already signed in, such as Salesforce or Gmail. A separate built-in `@Browser` stays inside ChatGPT, does not use your regular profile, and is the one to use for localhost.

Agent Chrome always uses your real Chrome profiles. It can open `localhost` too, since it is your own browser.

## Multiple profiles

OpenAI tells you to use the profile where the extension is installed, and to install and enable it in the active profile if you have several.

Agent Chrome pairs each profile on its own. `list_browsers` shows them, and any call can target one with `browser: "Work"`. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

## Visibility and control

OpenAI asks before interacting with each new website. You can allow once, for the site, or for all sites, and "Allow for all sites" is labeled Elevated Risk. Allowlists and blocklists live under Manage. Browser history access has no always-allow option.

Agent Chrome puts each session in a named, colored tab group, draws a pulsing blue border and a status pill with a Stop button, and shows an animated cursor with the agent's logo. The popup has Pause, Resume and Stop all. History access is off by default.

## Recording

OpenAI's page does not mention video recording. Agent Chrome's `record` tool saves MP4 or WebM clips of up to 10 minutes with a natural cursor and no overlays, and `gif_creator` saves GIFs. See [record browser videos](/use-cases/record-browser-videos).

## Security

OpenAI states that it "doesn't store a separate complete record of your browser actions from the extension," and that activity is stored only when it enters the chat context. It also asks you to treat page content as untrusted. The Chrome extension asks for page debugger access and permission to read and change data on all websites.

Agent Chrome also uses the debugger, stores keys only as SHA-256 hashes, expires pairing codes after 15 minutes, and lets you revoke each profile. Pages can still contain prompt injection. See [security](/docs/security).

## Pricing and license

OpenAI's page does not state a price or required plan, and I could not confirm the extension's source license. Agent Chrome is open source under the MIT license, and you can run it [locally](/docs/local-mode) or [self-host it](/docs/self-host).

## When to choose each

Choose the OpenAI extension if:

- You live in the ChatGPT or Codex desktop app.
- You want ChatGPT to switch between plugins, your browser and the built-in browser on its own.
- You use Opera or another supported Chromium browser.

Choose Agent Chrome if:

- You use Codex CLI, Claude Code, Gemini CLI or Cursor and want one browser setup.
- You want MP4 recordings without overlays.
- You want to inspect or self-host the server.

## Sources

- https://learn.chatgpt.com/docs/chrome-extension (redirect target of https://developers.openai.com/codex/app/chrome-extension)
- https://github.com/openai/codex/issues/57641
- https://github.com/ShadowWalker2014/agentchrome

## Frequently asked questions

### Can the Codex CLI control Chrome?
OpenAI's extension docs describe tasks started from the desktop app and do not document the CLI. Agent Chrome works from the Codex CLI because it is a standard MCP server added to `~/.codex/config.toml`.

### Does Agent Chrome replace the OpenAI extension?
It can, for MCP-based workflows. If you rely on the desktop app's @-mention flow and side chat, keep the OpenAI extension. The two can be installed side by side.

### Which one supports more browsers?
OpenAI documents Chrome, Edge, Brave, Opera and Vivaldi. Agent Chrome supports Chrome only for now.

### Can I record a video with Codex in Chrome?
With Agent Chrome, yes: call `record` for an MP4 or WebM clip. OpenAI's page does not document video recording.

### Is Agent Chrome open source?
Yes. It is MIT licensed at https://github.com/ShadowWalker2014/agentchrome. You can use the hosted server, run it locally or self-host it.
