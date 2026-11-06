# Chrome Web Store listing: Agent Chrome

## Store listing

The Web Store rejected 0.1.1 on 2026-11-06 for keyword spam (violation "Yellow Argon") because the description listed eight agent names. Do not list agent or product names in the summary or description. Agent logos in the screenshots (screenshot-4-agents.png) stay; Kai approved them.

- **Name:** Agent Chrome
- **Summary (132 max):** Let your AI coding agent use your real, signed-in Chrome. It works in its own tab group while you watch.
- **Category:** Developer Tools
- **Language:** English
- **Homepage:** https://agentchrome.dev
- **Support:** https://agentchrome.dev/support
- **Privacy policy:** https://agentchrome.dev/privacy

### Description

Agent Chrome lets your AI coding agent use the Chrome you already have open, signed in to your accounts. Ask your agent to check a dashboard, test your web app behind a login, fill in a form or reproduce a bug, and it does it in your browser. It works with any agent that supports the Model Context Protocol (MCP).

How it works
Agent Chrome is a small extension plus an MCP server. Your agent connects to the server (hosted at agentchrome.dev, or fully local on your computer), and the server passes each step to this extension. One command sets up the agents on your computer:
curl -fsSL https://agentchrome.dev/install | sh
You can also add https://agentchrome.dev/mcp as a custom connector in any AI chat app that supports MCP.

You stay in control
- Each agent works in its own named, colored tab group, apart from your tabs.
- While it works, the page shows a blue border, a status bar with a Stop button and the agent's cursor.
- Pause or stop any agent from the toolbar, block sites, or approve each new site.
- Agents are told to ask you before buying, sending or deleting anything.

What agents can do
- Open, switch and close tabs, and read page text and structure.
- Click, type, press keys, scroll, hover, drag and drop, fill forms and upload files.
- Handle alert, confirm and leave-page dialogs.
- Read console messages and network requests while testing a site.
- Take screenshots, including long full-page images, and record MP4 or GIF clips.
- Work across several Chrome profiles, such as Work and Personal.

Privacy
Page content passes through to your agent and isn't stored on our servers. Files an agent saves on purpose (screenshots, clips) are kept for 7 days. Keys are stored only as hashes. Agent Chrome is open source under the MIT license: https://github.com/ShadowWalker2014/agentchrome

Made by Circo, Inc.

## Privacy practices

### Single purpose
Agent Chrome lets an AI agent that the user has connected operate the user's own Chrome browser: open and read pages and act on them in a separate tab group, while the user watches and can stop it.

### Permission justifications
- **debugger:** The agent's clicks, typing, key presses, scrolling, drag and drop, screenshots, dialog handling, file uploads and console/network reading are done through the Chrome DevTools Protocol on the tabs the agent works in. This is the only way to send real input events and capture the page the way a person sees it.
- **tabs:** To open, switch, read the URL and title of, and close the tabs the agent works in, and to report them back to the agent.
- **tabGroups:** Each agent session works in its own named, colored tab group, so the user can see which tabs it controls. The extension creates, renames and closes those groups.
- **scripting:** Injects the content script that draws the border, status bar and agent cursor, reads the page's text and accessibility tree, and finds elements the agent asks for.
- **storage:** Saves the user's settings (border, cursor, blocked sites, approved sites), the browser's connection token and the list of agent sessions, so they survive restarts.
- **offscreen:** Video and GIF recording run in an offscreen document, because a service worker can't encode media.
- **alarms:** Keeps the connection to the user's MCP server alive and reconnects after the browser sleeps or the network drops.
- **downloads:** Reports files that a page downloads while the agent works, and saves recordings to the Downloads folder when the user asks.
- **Host permission (<all_urls>):** The user decides which sites their agent works on, so the extension needs to act on any site the user sends it to. Users can block sites or require approval for each new site in the popup.
- **Optional history:** Off by default. Only when the user turns it on, agents can search the browsing history to find a page.
- **Optional identity / identity.email:** Only to label which Chrome profile is connected (for example "Work") in the user's list of browsers.
- **Remote code:** No. All code is in the package. The extension receives tool calls (data) from the user's MCP server over a WebSocket; it doesn't load or run remote code.

### Data usage
- Collected: **Website content** (page text, screenshots and recordings the agent requests, sent to the user's own agent), **Authentication information** (the device token that connects this browser to the user's account), **Web history** (only if the user turns on the optional history setting, and only when an agent searches it).
- Not sold, not used for unrelated purposes, not used for credit decisions.
