---
title: Agent Chrome Tool Reference: Every MCP Tool and Parameter
description: Reference for every Agent Chrome MCP tool for coding agents and chat apps, with parameters, examples and the read-only and destructive hints.
slug: docs/tools
type: docs
nav: Tools
updated: 2026-11-04
---

# Agent Chrome Tool Reference: Every MCP Tool and Parameter

Agent Chrome exposes two tool sets from the same server. Coding agents get the agent set, which matches Claude in Chrome and includes `computer` and `javascript_tool`. Chat apps such as Claude.ai and ChatGPT get the directory set, which has one tool per action (`click`, `type_text`, `scroll` and so on).

Tool names follow Claude in Chrome, so prompts and skills written for it work unchanged. Every tool also accepts an optional `browser` argument (a profile id or name from `list_browsers`) and most accept an optional `tabId`.

## Common parameters

| Parameter | Type | Meaning |
|---|---|---|
| `browser` | string | Which connected Chrome profile to use. Defaults to the browser chosen with `select_browser`, else the most recently active one. |
| `tabId` | number | Tab ID from `tabs_context`. Defaults to the session's current tab, created inside the session tab group if none exists. |
| `ref` | string | An element handle such as `ref_12`, returned by `read_page` or `find`. Preferred over coordinates. |
| `coordinate` | [x, y] | Pixels in the space of the latest screenshot of that tab. |

## Browsers and pairing

These tools run on the server and are in both tool sets.

| Tool | Parameters | What it does |
|---|---|---|
| `list_browsers` | none | Lists paired Chrome profiles with online status. |
| `select_browser` | `browser` (required) | Chooses which profile this session controls by default. |
| `pairing_code` | none | Returns a one-time code to connect a Chrome profile. |

```json
{ "name": "select_browser", "arguments": { "browser": "Work" } }
```

## Tabs and groups

| Tool | Parameters | What it does |
|---|---|---|
| `tabs_context` | `createIfEmpty`, `all` | Lists the tabs in this session's tab group (id, url, title, active). `createIfEmpty` defaults to true. `all: true` lists every open tab. |
| `tabs_create` | `url`, `active` | Opens a tab in the session group and makes it current. `url` defaults to `about:blank`. `active` defaults to false, so work stays in the background. |
| `tabs_close` | `tabId` (required), `force` | Closes a tab. Only tabs in the session group can be closed unless `force` is true. |
| `tabs_select` | `tabId` (required), `adopt`, `focus` | Makes a tab the current tab. `adopt` moves a user's tab into the session group. `focus` brings it to the front. |
| `tab_groups` | `action` (required), `groupId`, `tabIds`, `title`, `color`, `collapsed`, `makeSessionGroup`, `force` | Manages Chrome tab groups. Agent set only. |

`tab_groups` actions are `list`, `create`, `update`, `ungroup`, `move` and `close`. Colors are `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan` and `orange`.

```json
{ "name": "tab_groups", "arguments": { "action": "update", "title": "QA run", "color": "green" } }
```

## Navigation

| Tool | Parameters | What it does |
|---|---|---|
| `navigate` | `url` (required), `tabId`, `timeoutMs` | Loads a URL and waits for it to finish. Pass `back`, `forward` or `reload` as the `url` for history navigation. `timeoutMs` defaults to 30000. |

```json
{ "name": "navigate", "arguments": { "url": "https://news.ycombinator.com" } }
```

## Reading the page

| Tool | Parameters | What it does |
|---|---|---|
| `read_page` | `filter` (`interactive` or `all`), `depth`, `ref_id`, `max_chars`, `viewportOnly`, `tabId` | Returns an accessibility tree. Each element has a role, a name and a `ref_N` handle. `max_chars` defaults to 50000, `depth` to 25. |
| `find` | `query` (required), `limit`, `tabId` | Finds elements from a plain-language description and returns up to 20 matches with refs and coordinates. |
| `get_page_text` | `max_chars`, `tabId` | Returns the readable text of the article or main content, plus title and URL. |
| `screenshot` | `fullPage`, `format` (`jpeg` or `png`), `save`, `tabId` | Captures the viewport, or with `fullPage: true` one long image of the whole page. It scrolls through first so lazy images load, and stitches apps that scroll inside a panel, such as Gmail, Notion and dashboards. Pages are capped at 16,000 CSS px. `save: true` also stores it and returns a download URL (cloud) or a file path (local). |

```json
{ "name": "read_page", "arguments": { "filter": "interactive" } }
{ "name": "find", "arguments": { "query": "Sign in button" } }
```

## Mouse, keyboard and screenshots: `computer` (agent set)

`computer` is one tool with many actions. Coordinates use the pixel space of the latest screenshot, so take a screenshot first, or use a `ref`.

| Parameter | Type | Used by |
|---|---|---|
| `action` (required) | string | One of `screenshot`, `left_click`, `right_click`, `middle_click`, `double_click`, `triple_click`, `hover`, `mouse_move`, `left_click_drag`, `type`, `key`, `scroll`, `scroll_to`, `wait`, `zoom` |
| `coordinate` | [x, y] | Clicks, hover, scroll, drag end |
| `ref` | string | Clicks, hover, `scroll_to`, drag end |
| `start_coordinate`, `start_ref` | [x, y], string | Drag start for `left_click_drag` |
| `text` | string | Text for `type`, or keys for `key` such as `Enter`, `cmd+a`, `ctrl+shift+t` (space-separated for sequences) |
| `modifiers` | string | Keys held during a click: `ctrl`, `shift`, `alt`, `cmd`, joined with `+` |
| `scroll_direction` | string | `up`, `down`, `left`, `right` |
| `scroll_amount` | number | Scroll ticks, 1 to 20, default 3 |
| `duration` | number | Seconds to wait, 0 to 30 |
| `repeat` | number | Repeat count for `key`, 1 to 100 |
| `region` | [x0, y0, x1, y1] | Region for `zoom`, a screenshot at full resolution |
| `tabId` | number | Target tab |

`hover` and `mouse_move` move the pointer without clicking. Native HTML5 drag and drop works with `left_click_drag`.

```json
{ "name": "computer", "arguments": { "action": "left_click", "ref": "ref_12" } }
{ "name": "computer", "arguments": { "action": "type", "text": "agent chrome" } }
{ "name": "computer", "arguments": { "action": "key", "text": "Enter" } }
{ "name": "computer", "arguments": { "action": "left_click_drag", "start_ref": "ref_4", "ref": "ref_9" } }
```

## Forms, files and dialogs

| Tool | Parameters | What it does |
|---|---|---|
| `form_input` | `ref` (required), `value` (required), `tabId` | Sets a control by ref: string for text inputs, textareas and contenteditable, boolean for checkboxes and radios, option value or visible text for selects. Fires input and change events. |
| `file_upload` | `ref`, `paths`, `files`, `tabId` | Puts files into a file input or drop zone without the native picker. `paths` are absolute paths on the computer running Chrome. `files` entries have `name` plus `base64`, `url` or a screenshot `imageId`. Leave out `ref` to fill a picker that a click just tried to open. |
| `upload_image` | `imageId` (required), `ref`, `coordinate`, `filename`, `tabId` | Uploads a captured screenshot into a file input, or drops it on a target. |
| `handle_dialog` | `accept` (required), `promptText`, `tabId` | Accepts or dismisses an `alert`, `confirm`, `prompt` or `beforeunload` dialog. Dialogs block the page until handled. |
| `wait_for` | `text`, `textGone`, `selector`, `urlIncludes`, `timeoutMs`, `tabId` | Waits until text appears, a CSS selector matches, text disappears or the URL matches. `timeoutMs` defaults to 10000 with a maximum of 60000. |

```json
{ "name": "form_input", "arguments": { "ref": "ref_7", "value": "kai@example.com" } }
{ "name": "file_upload", "arguments": { "ref": "ref_21", "paths": ["/Users/me/report.pdf"] } }
{ "name": "wait_for", "arguments": { "text": "Order confirmed", "timeoutMs": 15000 } }
```

## Debugging

| Tool | Parameters | What it does |
|---|---|---|
| `javascript_tool` | `text` (required), `action` (`javascript_exec`, optional), `tabId` | Runs JavaScript in the page's main world and returns the last expression. `await` is allowed and it works under a strict CSP. Agent set only. |
| `read_console_messages` | `pattern`, `onlyErrors`, `clear`, `limit`, `tabId` | Reads console messages and uncaught errors captured since the agent first touched the tab. `limit` defaults to 100. |
| `read_network_requests` | `urlPattern`, `clear`, `limit`, `includeBodies`, `tabId` | Reads requests with url, method, status, type and timing. `includeBodies` adds response bodies up to 10 KB for XHR and fetch. |

```json
{ "name": "javascript_tool", "arguments": { "text": "document.title" } }
{ "name": "read_console_messages", "arguments": { "onlyErrors": true } }
{ "name": "read_network_requests", "arguments": { "urlPattern": "/api/", "includeBodies": true } }
```

## Recording

| Tool | Parameters | What it does |
|---|---|---|
| `record` | `action` (`start`, `stop`, `status`, `scroll`), `to` (`bottom`, `top`), `speed` (px per second, default 700), `fps`, `format` (`mp4`, `webm`), `filename`, `download`, `cursor` (`natural`, `agent`, `hidden`), `showClicks`, `tabId` | Records an MP4 or WebM clip. `stop` returns a download URL (cloud) or file path (local). `fps` defaults to 15, `cursor` to `natural`. `scroll` records a smooth scroll through the whole page and returns the clip in one call. Maximum length is 10 minutes. |
| `gif_creator` | `action` (`start_recording`, `stop_recording`, `export`, `clear`), `cursor`, `showClicks`, `filename`, `download`, `tabId` | Records browser actions and exports an animated GIF. |

See [recording](/docs/recording) for details.

```json
{ "name": "record", "arguments": { "action": "start", "cursor": "natural", "showClicks": true } }
{ "name": "record", "arguments": { "action": "stop" } }
```

## Window and history

| Tool | Parameters | What it does |
|---|---|---|
| `resize_window` | `width` (required), `height` (required), `tabId` | Resizes the browser window that holds the tab. |
| `history_search` | `query` (required), `maxResults`, `daysBack` | Searches the profile's browsing history. Works only when you turn on history access in the extension popup. Agent set only. |

## Chat-app (directory) tool set

Claude.ai and ChatGPT get these tools instead of `computer`, `javascript_tool`, `history_search` and `tab_groups`. They also get every tool above that is not marked "agent set only": the browser tools, tabs, `navigate`, the reading tools, `form_input`, `file_upload`, `upload_image`, `handle_dialog`, `wait_for`, `record`, `gif_creator`, `resize_window` and `screenshot`.

| Tool | Parameters | Runs as |
|---|---|---|
| `click` | `ref`, `coordinate`, `button` (`left`, `right`, `middle`), `clicks` (1, 2 or 3), `tabId` | `computer` click actions. `clicks: 2` is a double click, `3` a triple click. |
| `type_text` | `text` (required), `ref`, `tabId` | `computer` type. Clicks `ref` first. Does not press Enter. |
| `press_key` | `keys` (required), `repeat` (1 to 20), `tabId` | `computer` key. Examples: `Enter`, `Escape`, `Tab`, `cmd+a`. |
| `scroll` | `direction`, `amount` (1 to 20, default 3), `ref`, `coordinate`, `scrollIntoView`, `tabId` | `computer` scroll, or `scroll_to` when `scrollIntoView` is true. |
| `hover` | `ref`, `coordinate`, `tabId` | `computer` hover. Does not click. |
| `drag` | `fromRef`, `from`, `toRef`, `to`, `tabId` | `computer` left_click_drag. Works for HTML5 drag and drop and sliders. |
| `wait` | `seconds` (required, 0 to 30), `tabId` | `computer` wait. Prefer `wait_for` for content. |
| `zoom` | `region` (required, [x0, y0, x1, y1]), `tabId` | `computer` zoom, a full-resolution screenshot of a region. |
| `list_tab_groups` | none | `tab_groups` list. |
| `update_tab_group` | `groupId`, `title`, `color`, `collapsed` | `tab_groups` update. Defaults to the session group. |
| `close_tab_group` | none | `tab_groups` close. Closes every tab in the session group, so unsaved work is lost. |

```json
{ "name": "click", "arguments": { "ref": "ref_12" } }
{ "name": "type_text", "arguments": { "ref": "ref_3", "text": "hello" } }
{ "name": "press_key", "arguments": { "keys": "Enter" } }
```

## Read-only and destructive hints

Every tool carries annotations so chat apps can ask before risky actions. These are read-only: `list_tab_groups`, `list_browsers`, `tabs_context`, `screenshot`, `read_page`, `find`, `get_page_text`, `read_console_messages`, `read_network_requests`, `wait_for`, `history_search`, `scroll`, `hover`, `wait` and `zoom`.

These are marked destructive because their effects may not be undoable: `tabs_close`, `tab_groups`, `close_tab_group`, `click`, `press_key`, `computer`, `javascript_tool`, `file_upload` and `upload_image`. Every tool that talks to a browser is marked open-world.

## Related pages

- [Docs overview](/docs)
- [Use Agent Chrome from Claude and ChatGPT](/docs/claude-and-chatgpt)
- [Record screenshots, MP4 clips and GIFs](/docs/recording)
- [Debug console and network errors](/use-cases/debug-console-network)
- [Fill forms and upload files](/use-cases/fill-forms-and-uploads)

## Frequently asked questions

### What is the difference between the agent and directory tool sets?
The agent set is for coding agents and includes the general `computer` and `javascript_tool` tools. The directory set is for chat apps in the Claude and ChatGPT directories and splits actions into separate tools such as `click` and `type_text`, each with honest read-only and destructive hints.

### Are the tool names the same as Claude in Chrome?
Yes. Where Claude in Chrome has a counterpart, Agent Chrome uses the same name, so prompts and skills written for it work unchanged.

### Should I use a ref or coordinates?
Use a `ref` when you have one. Refs come from `read_page` or `find` and survive layout changes better. Coordinates use the pixel space of the latest screenshot, so take a screenshot first.

### How do I choose between two Chrome profiles?
Pass `browser: "Work"` on any call, or call `select_browser` once for the session. `list_browsers` shows each profile and whether it is online. See [multiple Chrome profiles](/docs/multiple-chrome-profiles).

### Can an agent read my browsing history?
Only if you turn on history access in the extension popup. It is off by default, and `history_search` is available to coding agents only.
