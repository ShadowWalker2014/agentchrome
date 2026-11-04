---
title: Connect Multiple Chrome Profiles to Your AI Agents
description: Pair each Chrome profile (Work, Personal, a client's) with Agent Chrome and pick one per call with browser, or per session with select_browser.
slug: docs/multiple-chrome-profiles
type: docs
nav: Multiple profiles
updated: 2026-11-04
---

# Connect Multiple Chrome Profiles to Your AI Agents

Load the extension in each Chrome profile and pair each one with its own code. Every profile then shows up as a separate browser in `list_browsers`, and all of them can be online at once.

## Add a profile

1. Switch to the Chrome profile you want to add (Work, Personal, a client's).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `~/.agentchrome/extension`. Run `agentchrome extension --path` to print the path.
3. Get a new code in your terminal:

```sh
agentchrome pair
```

4. Open the Agent Chrome popup in that profile and paste the code, or press **Sign in to connect**.

A pairing code is single use and expires after 15 minutes. Each profile gets its own device token, which you can revoke on its own.

## See your profiles

```sh
agentchrome status
```

This prints each browser with its name, an online or offline dot, and its id. In an agent, call `list_browsers`.

```json
{ "name": "list_browsers", "arguments": {} }
```

## Choose a profile

There are two ways, and the first one wins when both are set:

- **Per call:** pass `browser` on any tool, as an id or a name.
- **Per session:** call `select_browser` once.

```json
{ "name": "navigate", "arguments": { "url": "https://example.com", "browser": "Work" } }
{ "name": "select_browser", "arguments": { "browser": "Personal" } }
```

If you do nothing, the server uses the browser selected for the session, then the most recently active one.

## Each session gets a tab group per profile

Each MCP session gets its own tab group in every paired profile. Tabs an agent opens stay inside that group, apart from your own tabs.

## Remove a profile

```sh
agentchrome revoke <browser-id>
```

The profile disconnects immediately. You can also press Disconnect in the extension.

## Related pages

- [Docs overview](/docs)
- [Install Agent Chrome](/docs/install)
- [QA across several accounts](/use-cases/multiple-accounts)
- [Tool reference](/docs/tools)
- [Troubleshooting](/docs/troubleshooting)

## Frequently asked questions

### Can more than one Chrome profile be connected at the same time?
Yes. Every paired profile stays connected, and `list_browsers` shows each as online or offline. Claude in Chrome connects one browser at a time, per the project README.

### How does the agent know which profile to use?
It uses the `browser` argument if you pass one, then the profile chosen with `select_browser`, then the most recently active one. Naming the profile in your prompt is the clearest way.

### Do I need a new account for each profile?
No. All profiles pair to the same account. You only need a new pairing code from `agentchrome pair` for each one.

### What if a profile shows as offline?
Chrome is probably closed for that profile, or the extension is disconnected. Open Chrome in that profile and check the popup. If needed, run `agentchrome pair` for a new code.

### Can I use different agents on different profiles?
Yes. Each agent session picks a browser per call or per session, so Claude Code can use Work while Codex uses Personal.
