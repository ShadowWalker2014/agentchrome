---
title: opencode Browser MCP: Let opencode Control Your Real Chrome
description: Add a browser MCP server to opencode that controls your real signed-in Chrome with Agent Chrome. One command, the opencode.json remote entry and prompts.
slug: opencode-chrome
type: guide
nav: opencode
updated: 2026-11-04
---

# opencode browser MCP: let opencode control your real Chrome

To let opencode control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh` and load the Agent Chrome extension once. The installer adds a remote MCP server named `agentchrome` to `~/.config/opencode/opencode.json`, and opencode can then work in your signed-in browser with tools such as `navigate`, `computer` and `read_page`.

opencode supports remote MCP servers, and Agent Chrome is one: a URL, `https://agentchrome.dev/mcp`, and an `Authorization` header.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It needs Node.js 18 or newer and Chrome 120 or newer. When it finds opencode (the `opencode` command or a `~/.config/opencode` folder), the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Adds `agentchrome` under the `mcp` key of `~/.config/opencode/opencode.json`, after saving `opencode.json.bak-agentchrome`.
3. Links the `agentchrome` skill into `~/.config/opencode/skills`.
4. Unpacks the extension to `~/.agentchrome/extension` and prints a pairing code.

To install for opencode only, run `agentchrome install opencode`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `~/.agentchrome/extension`.
3. Press **Sign in to connect** in the popup, or paste the pairing code.

## Manual configuration

Add this to `~/.config/opencode/opencode.json`. opencode keeps MCP servers under `mcp`, not `mcpServers`, and marks remote ones with `"type": "remote"`:

```json
{
  "mcp": {
    "agentchrome": {
      "type": "remote",
      "url": "https://agentchrome.dev/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer <key from agentchrome key>"
      }
    }
  }
}
```

The installer reads the file even if it has comments or trailing commas, merges the entry in, and leaves your other settings alone.

### Use OAuth instead of a key

```sh
agentchrome install opencode --oauth
```

This writes the same entry without `headers`. Whether opencode shows a sign-in prompt depends on your opencode version. If it does not, use the key form above.

## Proxy and custom config folders

If you run opencode with a separate config, such as `OPENCODE_CONFIG=~/.opencode-proxy/opencode.json`, the installer also looks for folders named `~/.opencode-*` that contain an `opencode.json`. It adds the same entry to each one. Run `agentchrome install opencode` again when you create a new one.

## Example prompts for opencode

- `Use agentchrome to open localhost:3000 and check that the login redirect lands on the dashboard.`
- `Read the console on this page and give me every error with its stack trace.`
- `Open my GitHub notifications in my Personal profile and list the pull requests waiting on me.`
- `Find the "Export CSV" button with find, click it, and report the downloaded file name.`
- `Record a clean MP4 of the new onboarding flow and give me the link.`

## What you see while opencode works

- **A named, colored tab group** for the session, which also collects tabs opened by links.
- **A pulsing blue border and a status pill** with a **Stop** button.
- **A separate animated cursor** with the agent's name. Your mouse is never moved.
- **The popup**, with Pause and Resume for each session and Stop all.

Pressing Cancel on Chrome's "started debugging this browser" bar halts every agent. Optional settings add a prompt before each new site and a block list. History access is off by default.

## Notes for opencode users

- **Restart opencode after installing**, because it reads its config at startup.
- **One browser for every agent.** opencode can share a paired Chrome with Claude Code, Codex and others. Each session gets its own tab group.
- **Clean recordings.** `record` leaves out the border, pill and name tag by default, so clips look like a person using the page. Use `cursor: "agent"` if you want the indicators. See [recording](/docs/recording).
- **Several profiles.** Pass `browser: "Work"` on a call, or use `select_browser`. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

## Check that it works

After you load the extension, confirm the whole chain before you rely on it:

```sh
agentchrome status
```

You should see your Chrome profile with a green dot and a check mark next to opencode. Then start a new opencode session and ask it to call `list_browsers`. It should report your profile as `"online": true`. Next ask it to call `tabs_context` and `navigate` to `https://example.com`. A tab group appears in Chrome with a blue border around the page.

If the agent says `No browser is connected`, Chrome is closed or the profile is not paired. Open Chrome, check that the popup says **Connected**, or run `agentchrome pair` for a new code. If a tool says the session is paused, someone pressed **Stop** or Cancel on the debugging bar, and you can resume from the popup. Opening `file://` pages needs **Allow access to file URLs** in the extension's details page. More fixes are in [troubleshooting](/docs/troubleshooting).

## Related pages

- [Install Agent Chrome for every agent](/docs/install)
- [Tool reference](/docs/tools)
- [Multiple Chrome profiles](/docs/multiple-chrome-profiles)
- [Fill web forms and upload files with AI](/use-cases/fill-forms-and-uploads)
- [Agent Chrome vs Browser MCP](/compare/browser-mcp)

## Frequently asked questions

### How do I add a browser MCP server to opencode?
Run the Agent Chrome installer and load the extension. It adds a `"type": "remote"` entry named `agentchrome` to `~/.config/opencode/opencode.json`. After you restart opencode, the browser tools show up.

### Which file configures MCP servers in opencode?
`~/.config/opencode/opencode.json`, under the `mcp` key. Remote servers use `type`, `url`, `enabled` and optional `headers`.

### Can I use Agent Chrome with an opencode proxy config?
Yes. The installer detects `~/.opencode-*` folders that contain an `opencode.json` and writes the same entry there.

### Does opencode use my real signed-in Chrome?
Yes. The extension lives in your Chrome profile, so opencode sees the sessions you already have. It works in its own tab group and never moves your real mouse.

### How do I remove it?
Run `agentchrome uninstall opencode`. It deletes the `agentchrome` entry from `opencode.json` and unlinks the skill.
