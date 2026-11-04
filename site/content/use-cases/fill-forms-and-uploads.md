---
title: Fill Web Forms and Upload Files With AI in Your Chrome
description: Let Claude Code or Codex fill web forms, pick dropdowns, handle dialogs and upload local files in your signed-in Chrome with Agent Chrome. Real tool calls.
slug: use-cases/fill-forms-and-uploads
type: use-case
nav: Forms and uploads
updated: 2026-11-04
---

# Fill web forms and upload files with AI

An AI agent can fill a web form by reading the page's accessibility tree and setting each field by its element handle. With Agent Chrome, `form_input` sets text, selects, checkboxes and radios, and `file_upload` attaches real files from your computer without opening the native file picker.

It all happens in your own Chrome, so the form loads with your login.

## The problem: forms are where browser agents break

Forms look simple, and agents trip on the details. Custom dropdowns, hidden file inputs, drop zones, and confirm dialogs that freeze the page are the usual culprits. A native file picker is an operating system window, which most browser agents cannot touch, so uploads fail.

Agent Chrome handles these cases directly, and the end-to-end tests cover each one.

## Walkthrough: submit an application with a CV

Ask your agent:

> Use agentchrome to open https://jobs.example.com/apply. Fill in my name and email, choose "Remote" in the location dropdown, tick the terms box, attach /Users/me/Documents/cv.pdf, and show me the form before submitting. Do not submit.

The agent will call:

1. `tabs_context` and `navigate` with `url: "https://jobs.example.com/apply"`.
2. `read_page` with `filter: "interactive"`. The result lists each control with a ref, for example `textbox "Email address" [ref_4]`, `combobox "Location" [ref_6]` and `checkbox "I agree to the terms" [ref_9] unchecked`.
3. `form_input` for each field:
   - `ref: "ref_4"`, `value: "me@example.com"` for text
   - `ref: "ref_6"`, `value: "Remote"` for a select (option value or visible text)
   - `ref: "ref_9"`, `value: true` for a checkbox
   `form_input` also handles radios and contenteditable fields, and fires input and change events like a user would.
4. `file_upload` with `ref` of the file input and `paths: ["/Users/me/Documents/cv.pdf"]`. The page receives a real file.
5. `computer` with `action: "screenshot"` to show you the filled form.

The agent stops before the submit click because you said so. Ask it for that stop on anything with real effects, such as payments, sent messages or applications.

## File uploads in detail

`file_upload` works three ways:

| Situation | Call |
|---|---|
| A file input, an upload button or a drop zone is visible | `file_upload` with `ref` and `paths` (absolute paths on the computer running Chrome) |
| A click opened a native file picker | `file_upload` with no `ref`. The click result says the page "tried to open a file picker", and the files go into that picker |
| The file does not exist on disk | `file_upload` with `files`, each with `name` and one of `base64`, `url` or a screenshot `imageId` |

Details that matter:

- **Local paths must be absolute.** A relative path is rejected with an error that says so.
- **Single-file inputs accept one file.** Passing two paths to an input that takes one gives an error, so pass one.
- **Drop zones work.** `file_upload` on a drop zone ref drops the files onto it, for pages that use drag-and-drop uploads.
- **Upload a screenshot.** `upload_image` takes an `imageId` from an earlier screenshot and puts it in a file input (`ref`) or onto a target (`coordinate`), with an optional `filename`.

The native file picker is never opened. If a click would open one, it is held back, and the agent is told to fill it.

![Agent working in Chrome](/media/agent-view.gif)

## Other form details that are handled

- **Dialogs.** If submitting triggers `alert`, `confirm` or `prompt`, the result tells the agent, and `handle_dialog` answers with `accept: true` or `false` and `promptText` for prompts. Other tools refuse to run while a dialog is open, so the agent cannot skip it by mistake.
- **"Leave site?" prompts.** A navigation the agent requests leaves an unsaved page and says so.
- **Drag and drop widgets.** For pages that need a drag, `computer` with `action: "left_click_drag"`, `start_ref` and `ref` runs native HTML5 drag and drop, and coordinate drags handle sliders and sortable lists.
- **Waiting.** `wait_for` with `text: "Thank you"` or `selector: "#confirmation"` waits for the result after submit.
- **Keyboard.** `computer` with `action: "key"` and `text: "Enter"` submits a form, and `text: "cmd+a"` selects all.

## Tips and limits

- **Say what to leave alone.** "Do not click Submit" or "Stop before payment" is the simplest guard. The agent is also instructed to ask before irreversible actions, but state it anyway.
- **Use refs.** Fields found with `read_page` or `find` are more reliable than clicking coordinates.
- **Check the result.** Ask for a `screenshot` or `read_page` after filling, so the agent confirms the values landed.
- **Personal data goes to the model.** What the agent types and reads is part of its conversation. Do not ask it to fill forms with secrets you do not want in that context.
- **Pages can contain prompt injection.** Text on a page may try to steer the agent. Review what it did before submitting anything important.
- **Password-manager frames** can block the debugger. Agent Chrome has a fallback, but some login frames may need you.
- **Chrome only**, and it cannot act on `chrome://` pages or the Web Store.

Related reading: [Let an AI agent work on sites you are logged into](/use-cases/logged-in-websites), [Test your web app with an AI agent](/use-cases/test-web-apps-with-ai), and the [tool reference](/docs/tools).

## Frequently asked questions

### Can an AI agent fill out a web form for me?

Yes. With Agent Chrome, the agent reads the page with `read_page`, then uses `form_input` to set text fields, dropdowns, checkboxes and radios by ref. It works in your own Chrome, so forms behind login are available.

### Can it upload a file from my computer?

Yes. Call `file_upload` with the input's `ref` and `paths` set to absolute file paths on your machine. The page gets real files, and the native file picker never opens.

### What if the page opens a file picker when the agent clicks?

Agent Chrome holds the picker back and tells the agent that the click tried to open one. The agent then calls `file_upload` without a `ref` to fill it.

### Does it handle drag-and-drop upload areas?

Yes. `file_upload` on a drop zone ref drops the files onto it. For other drag interactions use `computer` with `action: "left_click_drag"`.

### Will it submit the form without asking?

Only if you tell it to. Say "do not submit" in your prompt, and the agent stops after filling. Its server instructions also tell it to ask before actions that cannot be undone.
