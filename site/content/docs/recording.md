---
title: Record Screenshots, MP4 Clips and GIFs With Agent Chrome
description: Use the screenshot, record and gif_creator tools to capture a tab as PNG or JPEG, MP4 or WebM video, or an animated GIF, with a natural cursor.
slug: docs/recording
type: docs
nav: Recording
updated: 2026-11-04
---

# Record Screenshots, MP4 Clips and GIFs With Agent Chrome

Agent Chrome has three capture tools: `screenshot` for still images, `record` for MP4 or WebM video, and `gif_creator` for animated GIFs. Recordings look like a person using the page, with no blue border, status pill or name tag unless you ask for them.

## Screenshots

`screenshot` captures the viewport or the whole scrollable page, as JPEG (the default) or PNG.

```json
{ "name": "screenshot", "arguments": { "fullPage": true, "format": "png", "save": true } }
```

With `save: true` it stores the image and returns a download URL in the cloud, or a file path in local mode. The `computer` tool also has `screenshot` and `zoom`, which captures a region at full resolution.

## Video with `record`

`record` has three actions: `start`, `stop` and `status`.

```json
{ "name": "record", "arguments": { "action": "start", "format": "mp4", "fps": 15, "showClicks": true } }
{ "name": "record", "arguments": { "action": "stop" } }
```

| Parameter | Values | Default |
|---|---|---|
| `format` | `mp4`, `webm` | `mp4` when Chrome supports it |
| `fps` | number | 15 |
| `cursor` | `natural`, `agent`, `hidden` | `natural` |
| `showClicks` | true or false | false |
| `filename` | string | none |
| `download` | also save to the browser's Downloads folder | false |
| `tabId` | tab to record | the session tab |

The toolbar icon shows REC while recording. The maximum length is 10 minutes.

## What the cursor looks like

- `natural` draws a normal arrow that turns into a hand over links and an I-beam over text. The blue border, status pill and name tag are left out.
- `agent` keeps the agent cursor and indicators.
- `hidden` shows no cursor.
- `showClicks: true` draws a soft ripple where clicks land.

## GIFs with `gif_creator`

```json
{ "name": "gif_creator", "arguments": { "action": "start_recording" } }
{ "name": "gif_creator", "arguments": { "action": "stop_recording" } }
{ "name": "gif_creator", "arguments": { "action": "export", "filename": "demo.gif" } }
```

The actions are `start_recording`, `stop_recording`, `export` (returns the GIF) and `clear`. It accepts the same `cursor` and `showClicks` options.

## Where files go

In the cloud, saved screenshots and recordings go to R2 behind unguessable links and are deleted after 7 days. In local mode they are saved to `~/.agentchrome/artifacts`.

## A sample prompt

> Use agentchrome to open my staging app, start a recording, sign in, create a project, stop the recording and give me the MP4 link.

## Related pages

- [Docs overview](/docs)
- [Tool reference](/docs/tools)
- [Record browser videos with AI](/use-cases/record-browser-videos)
- [Local mode](/docs/local-mode)
- [Security and privacy](/docs/security)

## Frequently asked questions

### Can an AI agent record a video of my browser?
Yes. Call `record` with `action: "start"`, do the work, then call it with `action: "stop"` to get an MP4 or WebM link. The clip runs up to 10 minutes.

### Will the recording show the blue border and agent labels?
Not by default. `cursor: "natural"` leaves out the border, status pill and name tag. Use `cursor: "agent"` if you want them in the clip.

### How long are recordings kept?
Cloud files are deleted after 7 days. In local mode they stay in `~/.agentchrome/artifacts` until you remove them.

### What is the difference between record and gif_creator?
`record` produces MP4 or WebM video files. `gif_creator` records browser actions and exports an animated GIF that is returned inline.

### Can I take a full-page screenshot?
Yes. Pass `fullPage: true` to `screenshot`. Add `save: true` for a download link.
