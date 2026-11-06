---
title: Antigravity Browser: Connect agy and the IDE to Your Chrome
description: Let Antigravity (agy CLI and IDE) control your real signed-in Chrome with Agent Chrome. One command, the mcp_config.json entry, prompts and safety controls.
slug: antigravity-chrome
type: guide
nav: Antigravity
updated: 2026-11-04
---

# Antigravity browser: connect agy and the IDE to your real Chrome

To let Antigravity control your real Chrome, run `curl -fsSL https://agentchrome.dev/install | sh` and load the Agent Chrome extension once. The installer registers an `agentchrome` MCP server with the `agy` command and also writes it to the IDE's `~/.gemini/antigravity/mcp_config.json`, so both the CLI and the IDE can use your signed-in browser.

Agent Chrome is a remote MCP server. Antigravity needs only the URL `https://agentchrome.dev/mcp` and an `Authorization` header.

## Install with one command

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

It needs Node.js 18 or newer and Chrome 120 or newer. When it detects Antigravity (the `agy` command or a `~/.gemini/antigravity` folder), the installer:

1. Creates your account and saves the key to `~/.config/agentchrome/config.json`.
2. Runs `agy mcp add --type http` if `agy` is installed.
3. Adds `agentchrome` to `~/.gemini/antigravity/mcp_config.json`, after saving a `.bak-agentchrome` backup.
4. Links the `agentchrome` skill into `~/.gemini/antigravity/global_skills`.
5. Unpacks the extension to `~/Documents/Agent Chrome` and prints a pairing code.

To install for Antigravity only, run `agentchrome install antigravity`.

## Load the extension once per Chrome profile

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Drag the **Agent Chrome** folder from Documents onto the page, or click **Load unpacked** and choose it.
3. Press **Sign in to connect** in the popup, or paste the pairing code.

## Manual configuration

For the CLI, use `agy`:

```sh
agy mcp add --type http \
  --header "Authorization: Bearer $(agentchrome key)" \
  agentchrome https://agentchrome.dev/mcp
```

For the IDE, add this to `~/.gemini/antigravity/mcp_config.json`. Antigravity uses `serverUrl` rather than `url`:

```json
{
  "mcpServers": {
    "agentchrome": {
      "serverUrl": "https://agentchrome.dev/mcp",
      "headers": {
        "Authorization": "Bearer <key from agentchrome key>"
      }
    }
  }
}
```

### Use OAuth instead of a key

```sh
agentchrome install antigravity --oauth
```

The entry is then written without a header, so no secret sits in the config file. Whether the sign-in prompt appears depends on what your Antigravity version supports. If it does not, use the key form.

## Example prompts for Antigravity

- `Use agentchrome to open localhost:4200, run through the login flow and report anything that looks broken.`
- `Open our internal dashboard in my Work profile and copy the table of open incidents into a Markdown list.`
- `Resize the window to 390 by 844 with resize_window and screenshot the home page.`
- `Read the console errors on this page, then explain which source file likely throws them.`
- `Record an MP4 of the checkout flow with showClicks turned on.`

## What you see while Antigravity works

- **A tab group per session**, named and colored, containing the tabs the agent opens.
- **A pulsing blue border and a status pill** with a **Stop** button.
- **An animated cursor** carrying the agent's name. Your real mouse never moves.
- **The popup** lists each session with Pause and Resume, plus Stop all.

Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent. You can also turn on a prompt before each new site and a block list. History access stays off unless you enable it.

## Notes for Antigravity users

- **Two config locations.** The `agy` command and the IDE keep separate MCP settings, which is why the installer writes both. If you only use one, only that one matters.
- **It shares a folder with Gemini CLI.** Antigravity's files sit under `~/.gemini/antigravity`, but Gemini CLI reads `~/.gemini/settings.json`. See the [Gemini CLI guide](/gemini-cli-chrome) if you use both.
- **Idempotent installs.** Running the installer again replaces the old `agentchrome` entry instead of adding a second one.

## Check that it works

After you load the extension, confirm the whole chain before you rely on it:

```sh
agentchrome status
```

You should see your Chrome profile with a green dot and a check mark next to Antigravity. Then start a new Antigravity session and ask it to call `list_browsers`. It should report your profile as `"online": true`. Next ask it to call `tabs_context` and `navigate` to `https://example.com`. A tab group appears in Chrome with a blue border around the page.

If the agent says `No browser is connected`, Chrome is closed or the profile is not paired. Open Chrome, check that the popup says **Connected**, or run `agentchrome pair` for a new code. If a tool says the session is paused, someone pressed **Stop** or Cancel on the debugging bar, and you can resume from the popup. Opening `file://` pages needs **Allow access to file URLs** in the extension's details page. More fixes are in [troubleshooting](/docs/troubleshooting).

## Related pages

- [Gemini CLI browser guide](/gemini-cli-chrome)
- [Install Agent Chrome for every agent](/docs/install)
- [Multiple Chrome profiles](/docs/multiple-chrome-profiles)
- [Tool reference](/docs/tools)
- [Troubleshooting and FAQ](/docs/troubleshooting)

## Frequently asked questions

### How do I connect Antigravity to Chrome?
Run the Agent Chrome installer and load the extension in Chrome. It runs `agy mcp add` and writes the IDE config, and Antigravity can then use tools such as `navigate`, `computer` and `read_page` in your own browser.

### Where does Antigravity store MCP servers?
The IDE reads `~/.gemini/antigravity/mcp_config.json`, with `serverUrl` and `headers`. The CLI entry is created and removed with `agy mcp add` and `agy mcp remove`.

### Does the agy CLI work as well as the IDE?
Both are set up by the same installer. The CLI entry is created with `agy mcp add --type http`, and the IDE entry is written to `mcp_config.json`.

### Do I have to use Developer mode in Chrome?
Yes, once per Chrome profile, because the extension is loaded unpacked and is not on the Chrome Web Store yet. After you load it, pairing takes one code.

### How do I stop Antigravity from controlling Chrome?
Press **Stop** on the page, use Pause or Stop all in the popup, or press Cancel on Chrome's debugging bar. To remove the setup, run `agentchrome uninstall antigravity`.
