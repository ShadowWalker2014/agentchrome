---
title: Muse Code Browser: Let Muse Control Your Real Chrome Browser
description: Let Muse Code control your real, signed-in Chrome with Agent Chrome. One install command, the settings.json streamable-http entry, prompts and safety controls.
slug: muse-chrome
type: guide
nav: Muse
updated: 2026-11-04
---

# Muse Code browser: let Muse control your real Chrome

To let Muse control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh` and load the Agent Chrome extension once. The installer adds an `agentchrome` server with `"type": "streamable-http"` to `~/.config/muse/settings.json`, and Muse can then use your signed-in browser through MCP tools.

Agent Chrome is a remote MCP server at `https://agentchrome.dev/mcp`. Muse connects to it with a URL and an `Authorization` header, and the server relays each call to the extension in your Chrome.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It needs Node.js 18 or newer and Chrome 120 or newer. When it finds Muse (the `muse` command or a `~/.config/muse` folder), the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Adds `agentchrome` under `mcpServers` in `~/.config/muse/settings.json`, after saving `settings.json.bak-agentchrome`. If `XDG_CONFIG_HOME` is set, the file is `$XDG_CONFIG_HOME/muse/settings.json`.
3. Unpacks the extension to `~/Documents/Agent Chrome` and prints a pairing code.

To install for Muse only, run `agentchrome install muse`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Drag the **Agent Chrome** folder from Documents onto the page, or click **Load unpacked** and choose it.
3. Press **Sign in to connect** in the popup, or paste the pairing code.

## Manual configuration

Add this to `~/.config/muse/settings.json`:

```json
{
  "mcpServers": {
    "agentchrome": {
      "type": "streamable-http",
      "url": "https://agentchrome.dev/mcp",
      "headers": {
        "Authorization": "Bearer <key from agentchrome key>"
      }
    }
  }
}
```

Keep any other servers already listed in `mcpServers`. Restart Muse afterwards so it reloads its settings.

### Use OAuth instead of a key

```sh
agentchrome install muse --oauth
```

This writes the entry without `headers`, so no key sits in `settings.json`. Whether Muse shows a sign-in prompt depends on its version. If it does not, use the key form.

## Proxy setups

If you run Muse behind a CLI proxy with its own config home, for example `XDG_CONFIG_HOME=~/.muse-proxy/config`, the installer looks for `~/.muse-*/config/muse/settings.json` and adds the same entry to each file it finds. Run `agentchrome install muse` again after you create a new one.

## Example prompts for Muse

- `Use agentchrome to open localhost:3000, sign up with a test email, and tell me whether the welcome screen appears.`
- `Open the dashboard I am signed into, read the page text, and give me a summary of today's numbers.`
- `Take a full-page screenshot of our docs home page, then zoom into the sidebar.`
- `Look at the network requests on this page and tell me which API call is slowest.`
- `Record an MP4 of the checkout flow with click ripples on.`

## What you see while Muse works

- **A named, colored tab group** for each Muse session, holding every tab it opens.
- **A pulsing blue border and a status pill** with a **Stop** button.
- **An animated cursor** with the agent's name. Your own mouse is never moved.
- **The popup**, listing sessions with Pause and Resume, plus Stop all.

Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent and tells it why. You can ask before each new site, keep a block list, and leave history access off, which is the default.

## Notes for Muse users

- **Muse is not in the skill link list.** The installer links the `agentchrome` skill for Claude Code, Codex, Gemini CLI, Antigravity, Cursor and opencode. For Muse, the MCP server's own instructions tell the agent how to start: call `tabs_context`, read the page, then act on element refs.
- **Same server for every agent.** Muse can share one paired Chrome with the other agents. See [multiple Chrome profiles](/docs/multiple-chrome-profiles) for Work and Personal setups.
- **Prompt injection.** Pages can contain text aimed at agents. The server tells agents not to follow it, and you can limit exposure with the block list. See [security](/docs/security).

## Check that it works

After you load the extension, confirm the whole chain before you rely on it:

```sh
agentchrome status
```

You should see your Chrome profile with a green dot and a check mark next to Muse. Then start a new Muse session and ask it to call `list_browsers`. It should report your profile as `"online": true`. Next ask it to call `tabs_context` and `navigate` to `https://example.com`. A tab group appears in Chrome with a blue border around the page.

If the agent says `No browser is connected`, Chrome is closed or the profile is not paired. Open Chrome, check that the popup says **Connected**, or run `agentchrome pair` for a new code. If a tool says the session is paused, someone pressed **Stop** or Cancel on the debugging bar, and you can resume from the popup. Opening `file://` pages needs **Allow access to file URLs** in the extension's details page. More fixes are in [troubleshooting](/docs/troubleshooting).

## Related pages

- [Install Agent Chrome for every agent](/docs/install)
- [Security and privacy model](/docs/security)
- [Multiple Chrome profiles](/docs/multiple-chrome-profiles)
- [Tool reference](/docs/tools)
- [Troubleshooting and FAQ](/docs/troubleshooting)

## Frequently asked questions

### How do I let Muse Code use my browser?
Run the Agent Chrome installer, load the extension in Chrome and pair it. The installer adds an `agentchrome` streamable-http server to `~/.config/muse/settings.json`, and Muse can then call browser tools in your real Chrome.

### Where is the Muse MCP config?
In `~/.config/muse/settings.json` under `mcpServers`, or `$XDG_CONFIG_HOME/muse/settings.json` when that variable is set. The entry uses `type: "streamable-http"`, a `url` and `headers`.

### Does it work with a Muse proxy config?
Yes. The installer finds `~/.muse-*/config/muse/settings.json` files and adds the same entry to each.

### Do I need to restart Muse after installing?
Yes. Start a new Muse session so it loads the new MCP server.

### How do I remove it?
Run `agentchrome uninstall muse`. It removes the `agentchrome` entry from the settings file.
