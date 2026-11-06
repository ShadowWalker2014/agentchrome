# Agent Chrome plugin

Agent Chrome lets the assistant use the Chrome browser on your computer, in the profiles you are already signed in to. It works in its own tab group, so its tabs stay apart from yours, and the page shows a blue border, a status bar with a Stop button and a visible cursor while it works.

## What it connects to

The plugin connects to one remote server, `https://agentchrome.dev/mcp`, run by Circo, Inc. The server relays each tool call to the open-source Agent Chrome extension in your Chrome. You sign in with an Agent Chrome account (created in one click) and connect the extension once. You can disconnect a browser at any time from the extension or with `agentchrome revoke`.

## What it can do

- Open, switch and close tabs in its own tab group, and rename or recolor that group.
- Read page text and the accessibility tree, and find elements by description.
- Click, type, press keys, scroll, hover, drag and drop, fill forms and upload files.
- Handle alert, confirm and leave-page dialogs.
- Read console messages and network requests.
- Take screenshots, including long full-page images, and record MP4 or GIF clips.
- Use several Chrome profiles, such as Work and Personal.

The assistant asks you before actions that can't be undone, such as buying, sending or deleting. It never moves money.

## Requirements

Desktop Chrome 120 or newer with the Agent Chrome extension: https://agentchrome.dev/docs/install. Docs: https://agentchrome.dev/docs. Support: support@agentchrome.dev. Source (MIT): https://github.com/ShadowWalker2014/agentchrome.

Agent Chrome is an independent open-source project by Circo, Inc. It is not affiliated with, endorsed by or sponsored by Google. Chrome is a trademark of Google LLC.
