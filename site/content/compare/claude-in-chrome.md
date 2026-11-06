---
title: Claude in Chrome vs Agent Chrome: Which Should You Use?
description: Claude in Chrome vs Agent Chrome: which should you use? Compare setup, supported agents, profiles, recording, security and price, with a clear rule.
slug: compare/claude-in-chrome
type: compare
nav: vs Claude in Chrome
updated: 2026-11-04
---

# Claude in Chrome vs Agent Chrome: Which Should You Use?

Use Claude in Chrome if you only work with Claude, you are on a paid Claude plan, and you want the extension from the Chrome Web Store. Use Agent Chrome if you also use Codex, Gemini CLI, Cursor or other MCP agents, or if you need MP4 recordings, several Chrome profiles at once, or a server you can self-host.

Both let an agent work in your real, signed-in Chrome. Agent Chrome uses the same tool names as Claude in Chrome, so prompts and skills written for one carry over to the other.

## Side-by-side

| | Claude in Chrome | Agent Chrome |
|---|---|---|
| Made by | Anthropic | Open source, operated by Circo, Inc. |
| Agents it works with | Claude apps, Claude Code, Cowork | Any MCP client: Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode, Windsurf, Claude.ai, ChatGPT |
| Install | Chrome Web Store, then sign in with Claude | `curl -fsSL https://agentchrome.dev/install \| sh`, then load the unpacked extension |
| Uses your logged-in sessions | Yes | Yes |
| Browsers | Support article: Google Chrome only. Claude Code docs: Chrome and Edge, plus detection in Brave, Arc, Vivaldi, Opera | Chrome 120 or newer |
| Tab group per session | Yes | Yes, named and colored |
| Choosing between browsers | Claude Code lets you pick a connected browser | All paired profiles at once; pick per call with `browser: "Work"` |
| Recording | GIF (Claude Code docs) | MP4, WebM and GIF |
| Per-site permissions | Yes, managed in the extension | Optional "ask before each new site" and a block list |
| Plan or price | Paid Claude plan required | MIT license, open source |
| Self-hosting | Not documented | Cloudflare or local |

## Setup

Claude in Chrome installs from the Chrome Web Store. You click Add to Chrome, sign in with your Claude account and grant the permissions. For Claude Code you need extension version 1.0.36 or later, then start with `claude --chrome` or run `/chrome` inside a session.

Agent Chrome takes one command and one manual step:

```sh
curl -fsSL https://agentchrome.dev/install | sh
```

The installer adds an MCP server named `agentchrome` to every agent it finds and unpacks the extension to `~/Documents/Agent Chrome`. Then you turn on Developer mode at `chrome://extensions`, click Load unpacked, and paste the pairing code. Agent Chrome is not on the Chrome Web Store yet. See [the install guide](/docs/install).

## Which agents it works with

Claude in Chrome works from the Chrome side panel, Claude Cowork and Claude Code. The Claude Code docs say Chrome integration needs `/login` with a claude.ai account. It stays off if you authenticate with an API key or a token from `claude setup-token`, and it is not available through Amazon Bedrock, Google Cloud or Microsoft Foundry. It is also not supported in WSL.

Agent Chrome is a remote MCP server, so any client that speaks Streamable HTTP can use it. That includes Codex, Gemini CLI, Cursor and opencode, and the Claude.ai and ChatGPT connectors. See [Claude and ChatGPT connectors](/docs/claude-and-chatgpt).

## Real browser and logins

Both drive your own Chrome with your cookies and sessions, so no API connectors are needed for sites you are already signed into. Claude Code's docs add that Claude pauses and asks you to handle login pages and CAPTCHAs.

## Multiple profiles

In Claude Code you choose which connected browser Claude uses, with `/chrome` and Select browser. The extension also has to be signed in to the same claude.ai account and organization as Claude Code.

Agent Chrome pairs each Chrome profile separately. `list_browsers` shows Work, Personal and any other profile as online or offline, and every tool takes a `browser` argument. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

## Visibility and control

Claude in Chrome groups the tabs Claude opens into a Chrome tab group tied to your session. Its side panel starts in "Automatically approve" mode, where Claude reviews each action and pauses when something needs your approval.

Agent Chrome shows a pulsing blue border, a status pill with a Stop button, and an animated cursor with the agent's name and logo. It never moves your real mouse. The popup lists every agent session with Pause and Resume, plus Stop all. Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent.

## Recording

Claude Code can record browser interactions as GIFs and save screenshots to disk. Anthropic notes that a recording captures everything visible, including account details.

Agent Chrome's `record` tool produces MP4 or WebM clips up to 10 minutes. By default the clip has a natural cursor and no border, pill or name tag, so it looks like a person using the page. `gif_creator` makes GIFs. See [recording](/docs/recording).

## Security

Claude in Chrome asks for Chrome's `debugger` permission, which is what lets it click, type and take screenshots. Anthropic describes it as "enhanced with our safety classifiers but is still risky," and admins can limit sites with allowlists and blocklists.

Agent Chrome uses the same debugger mechanism. It stores account keys and device tokens only as SHA-256 hashes, uses single-use pairing codes that expire after 15 minutes, and lets you revoke each profile separately. An agent with your logged-in browser can do what you can, and pages can contain prompt injection. See [security](/docs/security).

## Pricing and license

Claude in Chrome needs a paid Claude plan (Pro, Max, Ultra, Team or Enterprise). Its source license is not documented in the pages I checked.

Agent Chrome is open source under the MIT license. You can use the hosted server at `https://agentchrome.dev/mcp`, run it [locally](/docs/local-mode), or [self-host it](/docs/self-host).

## When to choose each

Choose Claude in Chrome if:

- You use Claude only and already pay for a Claude plan.
- You want a Chrome Web Store install with Anthropic maintaining it.
- You want features built into the Claude side panel, such as scheduled tasks.

Choose Agent Chrome if:

- You switch between Claude Code, Codex, Gemini CLI and Cursor and want one browser setup for all of them.
- You need MP4 recordings without overlays.
- You use several Chrome profiles and want them all available at once.
- You want to inspect the code or host the server yourself.

You can also run both. See [Claude Code with Chrome](/claude-code-chrome) and the [Codex comparison](/compare/codex-chrome-extension).

## Sources

- https://code.claude.com/docs/en/chrome
- https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome
- https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn
- https://github.com/ShadowWalker2014/agentchrome

## Frequently asked questions

### Is there an open-source alternative to Claude in Chrome?
Agent Chrome is open source under the MIT license, and it uses the same tool names, so prompts written for Claude in Chrome work unchanged. You do not need a Claude plan to use it. It works with any MCP agent.

### Can Claude Code use Agent Chrome instead of Claude in Chrome?
Yes. The installer runs `claude mcp add --scope user` for you and adds an MCP server named `agentchrome`. It does not rely on the claude.ai extension connection that Claude Code's Chrome integration requires.

### Does Agent Chrome work with Codex and Gemini CLI?
Yes. The same installer configures Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode and Windsurf. Claude in Chrome is documented for Claude apps and Claude Code only.

### Can I use both at the same time?
Yes. They are separate extensions with separate MCP servers. Keep the prompts explicit about which tool set to use, for example "use agentchrome to open the dashboard".

### Which one records better demos?
Agent Chrome records MP4 and WebM with no overlays by default. Claude in Chrome, through Claude Code, records GIFs.
