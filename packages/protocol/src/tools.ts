// Tool catalog shared by the Cloudflare server, the local server and the extension.
// Names follow Claude in Chrome where a counterpart exists so prompts and skills transfer.

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean | string>;
  /** Handled by the server itself instead of being relayed to a browser. */
  server?: boolean;
  /** Per-call timeout in ms when relayed to the browser. */
  timeoutMs?: number;
}

const browser = {
  type: "string",
  description:
    "Which connected Chrome profile to use (id or name from list_browsers). Optional: defaults to the browser selected with select_browser, else the most recently active one.",
};
const tabId = {
  type: "number",
  description:
    "Tab ID from tabs_context. Optional: defaults to this session's current tab (created inside the session tab group if none exists).",
};
const coord = {
  type: "array",
  items: { type: "number" },
  minItems: 2,
  maxItems: 2,
  description: "[x, y] in screenshot pixels (same space as the last screenshot of this tab).",
};

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: { ...properties, browser },
  required,
  additionalProperties: false,
});

export const TOOLS: ToolDef[] = [
  {
    name: "list_browsers",
    title: "List connected browsers",
    server: true,
    description:
      "List the Chrome profiles paired with this account, with online status. Each Chrome profile that installs the extension and pairs shows up as its own browser.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "select_browser",
    title: "Select browser",
    server: true,
    description:
      "Choose which paired Chrome profile this session controls by default. Pass the id or name from list_browsers.",
    inputSchema: {
      type: "object",
      properties: { browser: { type: "string", description: "Browser id or name." } },
      required: ["browser"],
      additionalProperties: false,
    },
  },
  {
    name: "tabs_context",
    title: "Get session tabs",
    description:
      "Get the tabs in this session's Chrome tab group (id, url, title, active). Call this first to get a valid tabId. Each agent session gets its own tab group so its work stays separate from the user's tabs. Set createIfEmpty to open a blank tab in a new group when there is none. Set all=true to list every open tab in the browser.",
    inputSchema: obj({
      createIfEmpty: { type: "boolean", description: "Create the group with a new tab if the session has none. Default true." },
      all: { type: "boolean", description: "List every tab in the browser, not only this session's group." },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "tabs_create",
    title: "Open tab",
    description:
      "Open a new tab inside this session's tab group and make it the session's current tab. Optionally load a URL.",
    inputSchema: obj({
      url: { type: "string", description: "URL to open. Default about:blank." },
      active: { type: "boolean", description: "Focus the tab in its window. Default false (work happens in the background)." },
    }),
  },
  {
    name: "tabs_close",
    title: "Close tab",
    description: "Close a tab. Only tabs in this session's group can be closed unless force is true.",
    inputSchema: obj({ tabId: { ...tabId, description: "Tab to close." }, force: { type: "boolean" } }, ["tabId"]),
    annotations: { destructiveHint: true },
  },
  {
    name: "tabs_select",
    title: "Switch tab",
    description:
      "Make a tab this session's current tab. Pass adopt=true to move a user's tab into the session group. Pass focus=true to also bring it to the front.",
    inputSchema: obj({ tabId: { ...tabId, description: "Tab to switch to." }, adopt: { type: "boolean" }, focus: { type: "boolean" } }, ["tabId"]),
  },
  {
    name: "tab_groups",
    title: "Manage tab groups",
    description:
      "List, create, rename, recolor, collapse or ungroup Chrome tab groups. action=list returns every group. action=update changes title/color/collapsed of a group (defaults to this session's group). action=create groups the given tabIds (or the current tab) into a new group. action=ungroup removes tabs from their group. action=move moves tabIds into a group.",
    inputSchema: obj(
      {
        action: { type: "string", enum: ["list", "create", "update", "ungroup", "move"] },
        groupId: { type: "number", description: "Target group. Default: this session's group." },
        tabIds: { type: "array", items: { type: "number" } },
        title: { type: "string", description: "New group name." },
        color: { type: "string", enum: ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] },
        collapsed: { type: "boolean" },
        makeSessionGroup: { type: "boolean", description: "With create/move: make this the session's group from now on." },
      },
      ["action"],
    ),
  },
  {
    name: "navigate",
    title: "Navigate",
    description:
      "Load a URL in a tab and wait for it to finish loading. Use 'back' or 'forward' for history navigation, 'reload' to reload.",
    inputSchema: obj({ url: { type: "string" }, tabId, timeoutMs: { type: "number", description: "Max wait for load. Default 30000." } }, ["url"]),
    timeoutMs: 60_000,
  },
  {
    name: "computer",
    title: "Mouse, keyboard and screenshots",
    description: [
      "Use a mouse and keyboard to interact with the page, and take screenshots.",
      "Coordinates are in the pixel space of the latest screenshot of that tab. Take a screenshot first.",
      "Prefer clicking with ref (from read_page or find) over coordinates when you have one.",
      "Actions: screenshot, left_click, right_click, middle_click, double_click, triple_click, hover or mouse_move (moves the pointer without clicking), left_click_drag (start_coordinate or start_ref -> coordinate or ref; native HTML5 drag and drop works), type (text), key (text like 'Enter', 'cmd+a', 'ctrl+shift+t'; space-separated for sequences), scroll (scroll_direction, scroll_amount), scroll_to (ref), wait (duration seconds), zoom (region screenshot at full resolution).",
    ].join(" "),
    inputSchema: obj(
      {
        action: {
          type: "string",
          enum: [
            "screenshot",
            "left_click",
            "right_click",
            "middle_click",
            "double_click",
            "triple_click",
            "hover",
            "mouse_move",
            "left_click_drag",
            "type",
            "key",
            "scroll",
            "scroll_to",
            "wait",
            "zoom",
          ],
        },
        coordinate: coord,
        start_coordinate: { ...coord, description: "[x, y] drag start for left_click_drag." },
        start_ref: { type: "string", description: "Element ref to start a drag from (alternative to start_coordinate)." },
        ref: { type: "string", description: "Element ref from read_page/find, e.g. 'ref_12'. Alternative to coordinate." },
        text: { type: "string", description: "Text to type (type) or keys to press (key)." },
        modifiers: { type: "string", description: "Modifier keys held during a click: ctrl, shift, alt, cmd; combine with '+'." },
        scroll_direction: { type: "string", enum: ["up", "down", "left", "right"] },
        scroll_amount: { type: "number", minimum: 1, maximum: 20, description: "Scroll ticks. Default 3." },
        duration: { type: "number", minimum: 0, maximum: 30, description: "Seconds to wait." },
        repeat: { type: "number", minimum: 1, maximum: 100, description: "Repeat count for key." },
        region: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4, description: "[x0, y0, x1, y1] for zoom." },
        tabId,
      },
      ["action"],
    ),
    timeoutMs: 60_000,
  },
  {
    name: "screenshot",
    title: "Screenshot",
    description:
      "Capture a screenshot of a tab. fullPage captures the whole scrollable page. Set save=true to also store it and get a download URL.",
    inputSchema: obj({
      tabId,
      fullPage: { type: "boolean" },
      format: { type: "string", enum: ["jpeg", "png"], description: "Default jpeg." },
      save: { type: "boolean", description: "Upload and return a download URL (cloud) or a file path (local)." },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_page",
    title: "Read accessibility tree",
    description:
      "Get an accessibility-tree view of the page: each element's role, name and a ref like 'ref_12' usable in computer, form_input, file_upload and scroll_to. filter='interactive' returns only buttons, links and inputs. Output is limited to max_chars (default 50000).",
    inputSchema: obj({
      tabId,
      filter: { type: "string", enum: ["interactive", "all"], description: "Default all." },
      depth: { type: "number", description: "Max tree depth. Default 25." },
      ref_id: { type: "string", description: "Scope to the subtree under this ref." },
      max_chars: { type: "number" },
      viewportOnly: { type: "boolean", description: "Only elements visible in the viewport." },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "find",
    title: "Find elements",
    description:
      "Find elements matching a description, e.g. 'search box', 'Sign in button', 'price of the first result'. Returns up to 20 matches with refs and screenshot coordinates.",
    inputSchema: obj({ query: { type: "string" }, tabId, limit: { type: "number" } }, ["query"]),
    annotations: { readOnlyHint: true },
  },
  {
    name: "form_input",
    title: "Set form value",
    description:
      "Set the value of a form control by ref: text inputs and textareas (string), checkboxes and radios (boolean), selects (option value or visible text), contenteditable (string). Fires input and change events like a user would.",
    inputSchema: obj(
      { ref: { type: "string" }, value: { type: ["string", "number", "boolean"] }, tabId },
      ["ref", "value"],
    ),
  },
  {
    name: "get_page_text",
    title: "Get page text",
    description: "Get the readable text of the page (article or main content when present), plus title and URL.",
    inputSchema: obj({ tabId, max_chars: { type: "number", description: "Default 50000." } }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "javascript_tool",
    title: "Run JavaScript",
    description:
      "Run JavaScript in the page's main world and return the value of the last expression (await is allowed). Runs even on pages with a strict CSP. Do not return huge objects.",
    inputSchema: obj(
      {
        text: { type: "string", description: "JavaScript code." },
        action: { type: "string", enum: ["javascript_exec"], description: "Optional, for Claude in Chrome compatibility." },
        tabId,
      },
      ["text"],
    ),
    timeoutMs: 60_000,
  },
  {
    name: "read_console_messages",
    title: "Read console",
    description:
      "Read console messages and uncaught errors from a tab, captured since the agent first touched it. Filter with a regex pattern.",
    inputSchema: obj({
      tabId,
      pattern: { type: "string" },
      onlyErrors: { type: "boolean" },
      clear: { type: "boolean" },
      limit: { type: "number", description: "Default 100." },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_network_requests",
    title: "Read network requests",
    description:
      "Read HTTP requests made by a tab (url, method, status, type, timing), captured since the agent first touched it. Filter by urlPattern (substring or regex).",
    inputSchema: obj({
      tabId,
      urlPattern: { type: "string" },
      clear: { type: "boolean" },
      limit: { type: "number", description: "Default 100." },
      includeBodies: { type: "boolean", description: "Include response bodies of up to 10 KB for XHR/fetch requests." },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "resize_window",
    title: "Resize window",
    description: "Resize the browser window that holds the tab.",
    inputSchema: obj({ width: { type: "number" }, height: { type: "number" }, tabId }, ["width", "height"]),
  },
  {
    name: "file_upload",
    title: "Upload files",
    description:
      "Put files into a file input or a drop zone without the native file picker. Give ref (the file input, its upload button or a drop zone from read_page), or leave ref out to fill a file picker the page just tried to open (click results tell you when). Pass paths (absolute paths on the computer running Chrome; the page gets real files) or files (each with base64, url or a screenshot imageId).",
    inputSchema: obj({
      ref: { type: "string", description: "File input, upload button or drop zone. Omit to fill a file picker that a click opened." },
      paths: { type: "array", items: { type: "string" }, description: "Absolute file paths on the computer running Chrome." },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            mimeType: { type: "string" },
            base64: { type: "string" },
            url: { type: "string" },
            imageId: { type: "string", description: "id returned by a screenshot." },
          },
          required: ["name"],
        },
      },
      tabId,
    }),
    timeoutMs: 60_000,
  },
  {
    name: "upload_image",
    title: "Upload screenshot",
    description:
      "Upload a captured screenshot (imageId) into a file input (ref) or drop it on a target (coordinate).",
    inputSchema: obj(
      { imageId: { type: "string" }, ref: { type: "string" }, coordinate: coord, filename: { type: "string" }, tabId },
      ["imageId"],
    ),
  },
  {
    name: "record",
    title: "Record video",
    description:
      "Record a video clip of a tab. action=start begins, action=stop finishes and returns a download URL (cloud) or file path (local) for an MP4 or WebM file, action=status reports progress. The clip looks like a person using the page: the blue border, status pill and the cursor's name tag are left out, and the cursor is a normal arrow that turns into a hand over links and an I-beam over text (cursor=natural, the default). Use cursor=agent to show the agent cursor and indicators, or cursor=hidden for no cursor. The toolbar icon shows REC meanwhile. Max length 10 minutes.",
    inputSchema: obj(
      {
        action: { type: "string", enum: ["start", "stop", "status"] },
        tabId,
        fps: { type: "number", description: "Frames per second, default 15." },
        format: { type: "string", enum: ["mp4", "webm"], description: "Default mp4 when Chrome supports it." },
        filename: { type: "string" },
        download: { type: "boolean", description: "Also save into the browser's Downloads folder." },
        cursor: { type: "string", enum: ["natural", "agent", "hidden"], description: "How the cursor looks in the clip. Default natural." },
        showClicks: { type: "boolean", description: "Draw a soft ripple where clicks land. Default false." },
      },
      ["action"],
    ),
    timeoutMs: 120_000,
  },
  {
    name: "gif_creator",
    title: "Record GIF",
    description:
      "Record browser actions and export an animated GIF. action=start_recording, stop_recording, export (returns the GIF), clear.",
    inputSchema: obj(
      {
        action: { type: "string", enum: ["start_recording", "stop_recording", "export", "clear"] },
        cursor: { type: "string", enum: ["natural", "agent", "hidden"], description: "How the cursor looks in the GIF. Default natural." },
        showClicks: { type: "boolean", description: "Draw click ripples. Default false." },
        tabId,
        filename: { type: "string" },
        download: { type: "boolean" },
      },
      ["action"],
    ),
    timeoutMs: 120_000,
  },
  {
    name: "wait_for",
    title: "Wait for page condition",
    description:
      "Wait until text appears, a CSS selector matches, text disappears, or the URL matches. Returns as soon as the condition holds or fails after timeoutMs.",
    inputSchema: obj({
      tabId,
      text: { type: "string" },
      textGone: { type: "string" },
      selector: { type: "string" },
      urlIncludes: { type: "string" },
      timeoutMs: { type: "number", description: "Default 10000, max 60000." },
    }),
    timeoutMs: 70_000,
    annotations: { readOnlyHint: true },
  },
  {
    name: "handle_dialog",
    title: "Handle dialog",
    description:
      "Accept or dismiss a JavaScript alert/confirm/prompt/beforeunload dialog on a tab. Dialogs block the page until handled; tool results mention an open dialog.",
    inputSchema: obj({ accept: { type: "boolean" }, promptText: { type: "string" }, tabId }, ["accept"]),
  },
  {
    name: "history_search",
    title: "Search browsing history",
    description:
      "Search this Chrome profile's browsing history. Works only when the user turned on history access in the extension popup.",
    inputSchema: obj({ query: { type: "string" }, maxResults: { type: "number" }, daysBack: { type: "number" } }, ["query"]),
    annotations: { readOnlyHint: true },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function publicTools() {
  return TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
  }));
}
