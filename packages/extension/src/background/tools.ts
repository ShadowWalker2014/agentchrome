import type { CallToolResult, ContentBlock, SessionInfo } from "@agent-chrome-mcp/protocol";
import * as cdp from "./cdp";
import { modifierBits } from "./keys";
import * as page from "./page";
import * as rec from "./recording";
import { gate, getConnection, getSettings } from "./settings";
import { allSessions, createTab, ensureInGroup, getSession, groupTabs, resolveTab, sessionsForTab, updateSession, type SessionState } from "./sessions";

const text = (t: string): ContentBlock => ({ type: "text", text: t });
const ok = (...blocks: ContentBlock[]): CallToolResult => ({ content: blocks });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Args = Record<string, any>;
type Ctx = { session: SessionState; info: SessionInfo; signal: AbortSignal };

// ---------------- overlay ----------------

const lingerTimers = new Map<number, ReturnType<typeof setTimeout>>();

async function overlayWorking(tabId: number, s: SessionState) {
  if (!(await getSettings()).showOverlay) return;
  clearTimeout(lingerTimers.get(tabId));
  const since = rec.recordingSince(tabId);
  await page.tryContent(tabId, "overlay", {
    state: s.paused ? "paused" : "working",
    label: s.paused ? `${s.title} is paused` : `${s.title} is working`,
    rec: since ? { since } : null,
  });
}

async function overlayIdle(tabId: number, s: SessionState) {
  const since = rec.recordingSince(tabId);
  await page.tryContent(tabId, "overlay", { state: "idle", label: `${s.title} is working`, rec: since ? { since } : null, linger: 2500 });
}

// ---------------- helpers ----------------

async function tabSummary(tabId: number) {
  const t = await chrome.tabs.get(tabId);
  return { tabId: t.id, title: t.title, url: t.url ?? t.pendingUrl, status: t.status };
}

async function waitForLoad(tabId: number, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  await sleep(150);
  while (Date.now() < deadline) {
    const t = await chrome.tabs.get(tabId);
    if (t.status === "complete") return true;
    await sleep(150);
  }
  return false;
}

function normalizeUrl(u: string) {
  if (/^(https?|file|chrome|about|data|blob|chrome-extension):/i.test(u)) return u;
  if (/^localhost(:\d+)?(\/|$)|^127\.0\.0\.1|^\[::1\]/.test(u)) return `http://${u}`;
  return `https://${u}`;
}

async function pointFor(tabId: number, a: Args): Promise<{ x: number; y: number; label: string }> {
  if (a.ref) {
    const r = await page.content<{ cx: number; cy: number; tag: string }>(tabId, "refRect", { ref: a.ref });
    return { x: r.cx, y: r.cy, label: `${a.ref} (${r.tag})` };
  }
  if (Array.isArray(a.coordinate) && a.coordinate.length === 2) {
    const [x, y] = page.toCss(tabId, a.coordinate[0], a.coordinate[1]);
    return { x, y, label: `(${a.coordinate[0]}, ${a.coordinate[1]})` };
  }
  throw new Error("Give coordinate [x, y] or ref.");
}

async function describeAt(tabId: number, x: number, y: number) {
  const el = await page.tryContent(tabId, "elementAt", { x, y });
  return el ? ` on ${el.role !== "generic" ? el.role : el.tag}${el.name ? ` "${el.name}"` : ""}` : "";
}

function dialogNote(tabId: number) {
  const d = cdp.dialogOf(tabId);
  return d ? `\nA ${d.type} dialog is open: ${JSON.stringify(d.message)}. Use handle_dialog to accept or dismiss it.` : "";
}

async function fileFrom(f: Args): Promise<{ name: string; mimeType?: string; base64: string }> {
  if (f.base64) return { name: f.name, mimeType: f.mimeType, base64: f.base64 };
  if (f.imageId) {
    const img = page.images.get(f.imageId);
    if (!img) throw new Error(`Unknown imageId ${f.imageId}`);
    return { name: f.name, mimeType: img.mimeType, base64: img.base64 };
  }
  if (f.url) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`Fetching ${f.url} failed: HTTP ${res.status}`);
    const blob = await res.blob();
    return { name: f.name, mimeType: f.mimeType ?? blob.type, base64: await page.blobToB64(blob) };
  }
  throw new Error(`File ${f.name} needs base64, url or imageId`);
}

async function uploadArtifact(blob: Blob, name: string): Promise<{ url?: string; path?: string }> {
  const c = await getConnection();
  if (!c.server || !c.deviceToken) throw new Error("Not paired");
  const res = await fetch(`${c.server}/api/artifacts?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${c.deviceToken}`, "content-type": blob.type },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  return res.json();
}

// ---------------- tools ----------------

const handlers: Record<string, (a: Args, c: Ctx) => Promise<CallToolResult>> = {
  async tabs_context(a, { session }) {
    if (a.all) {
      const tabs = await chrome.tabs.query({});
      const groups = await chrome.tabGroups.query({});
      const gname = new Map(groups.map((g) => [g.id, g.title]));
      return ok(
        text(
          JSON.stringify(
            tabs.map((t) => ({ tabId: t.id, windowId: t.windowId, title: t.title, url: t.url, active: t.active, group: t.groupId >= 0 ? gname.get(t.groupId) ?? t.groupId : undefined, sessionTab: t.id === session.currentTabId })),
            null,
            1,
          ),
        ),
      );
    }
    let tabs = await groupTabs(session);
    if (tabs.length === 0 && a.createIfEmpty !== false) {
      await createTab(session);
      tabs = await groupTabs(session);
    }
    const group = session.groupId !== undefined && tabs.length ? await chrome.tabGroups.get(session.groupId).catch(() => null) : null;
    const conn = await getConnection();
    return ok(
      text(
        JSON.stringify(
          {
            browser: conn.name,
            group: group ? { groupId: group.id, title: group.title, color: group.color } : null,
            currentTabId: session.currentTabId,
            tabs: tabs.map((t) => ({ tabId: t.id, title: t.title, url: t.url ?? t.pendingUrl, current: t.id === session.currentTabId })),
          },
          null,
          1,
        ),
      ),
    );
  },

  async tabs_create(a, { session, info }) {
    const url = a.url ? normalizeUrl(String(a.url)) : "about:blank";
    if (a.url) await gate(url, session.title);
    // Open blank first and attach the debugger so console/network capture covers the first load.
    const tab = await createTab(session, "about:blank", Boolean(a.active));
    if (a.url) {
      await cdp.attach(tab.id!).catch(() => {});
      await chrome.tabs.update(tab.id!, { url });
      await waitForLoad(tab.id!);
    }
    return ok(text(JSON.stringify({ created: await tabSummary(tab.id!), groupId: session.groupId }, null, 1)));
  },

  async tabs_close(a, { session }) {
    const tab = await chrome.tabs.get(a.tabId);
    if (!a.force && tab.groupId !== session.groupId) throw new Error("That tab is not in this session's group. Pass force=true to close it anyway.");
    await chrome.tabs.remove(a.tabId);
    if (session.currentTabId === a.tabId) session.currentTabId = undefined;
    await updateSession(session);
    return ok(text(`Closed tab ${a.tabId}`));
  },

  async tabs_select(a, { session }) {
    const tab = await chrome.tabs.get(a.tabId);
    if (a.adopt) await ensureInGroup(session, a.tabId);
    session.currentTabId = a.tabId;
    await updateSession(session);
    if (a.focus) {
      await chrome.tabs.update(a.tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return ok(text(`Current tab is now ${a.tabId}: ${tab.title}`));
  },

  async tab_groups(a, { session }) {
    const action = a.action;
    if (action === "list") {
      const groups = await chrome.tabGroups.query({});
      const out = await Promise.all(
        groups.map(async (g) => ({
          groupId: g.id,
          title: g.title,
          color: g.color,
          collapsed: g.collapsed,
          windowId: g.windowId,
          session: g.id === session.groupId,
          tabs: (await chrome.tabs.query({ groupId: g.id })).map((t) => ({ tabId: t.id, title: t.title })),
        })),
      );
      return ok(text(JSON.stringify(out, null, 1)));
    }
    if (action === "update") {
      let gid = a.groupId ?? session.groupId;
      if (gid === undefined) {
        await resolveTab(session, undefined, true);
        const tabId = session.currentTabId!;
        gid = await ensureInGroup(session, tabId);
      }
      const patch: chrome.tabGroups.UpdateProperties = {};
      if (a.title !== undefined) patch.title = String(a.title);
      if (a.color) patch.color = a.color;
      if (a.collapsed !== undefined) patch.collapsed = Boolean(a.collapsed);
      const g = await chrome.tabGroups.update(gid, patch);
      if (g && gid === session.groupId) {
        if (a.title !== undefined) session.title = String(a.title);
        if (a.color) session.color = a.color;
        await updateSession(session);
      }
      return ok(text(`Group ${gid} is now "${g?.title}" (${g?.color})${g?.collapsed ? ", collapsed" : ""}`));
    }
    if (action === "create" || action === "move") {
      const tabIds: number[] = a.tabIds?.length ? a.tabIds : [await resolveTab(session, undefined, true)];
      const ids = tabIds as [number, ...number[]];
      const groupId: number = await chrome.tabs.group(action === "move" && a.groupId !== undefined ? { groupId: a.groupId, tabIds: ids } : { tabIds: ids });
      const patch: chrome.tabGroups.UpdateProperties = {};
      if (a.title !== undefined) patch.title = String(a.title);
      if (a.color) patch.color = a.color;
      if (Object.keys(patch).length) await chrome.tabGroups.update(groupId, patch);
      if (a.makeSessionGroup) {
        session.groupId = groupId;
        if (a.title) session.title = String(a.title);
        await updateSession(session);
      }
      return ok(text(`Tabs ${tabIds.join(", ")} are in group ${groupId}`));
    }
    if (action === "ungroup") {
      const tabIds: number[] = a.tabIds?.length ? a.tabIds : session.groupId !== undefined ? (await groupTabs(session)).map((t) => t.id!) : [];
      if (!tabIds.length) throw new Error("No tabs to ungroup");
      await chrome.tabs.ungroup(tabIds as [number, ...number[]]);
      return ok(text(`Ungrouped tabs ${tabIds.join(", ")}`));
    }
    throw new Error(`Unknown action ${action}`);
  },

  async navigate(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    await ensureInGroupIfOwned(session, tabId);
    const url = String(a.url);
    if (url === "back") await chrome.tabs.goBack(tabId).catch(() => {});
    else if (url === "forward") await chrome.tabs.goForward(tabId).catch(() => {});
    else if (url === "reload") await chrome.tabs.reload(tabId);
    else {
      const target = normalizeUrl(url);
      await gate(target, session.title);
      await cdp.attach(tabId).catch(() => {});
      await chrome.tabs.update(tabId, { url: target });
    }
    const loaded = await waitForLoad(tabId, Math.min(a.timeoutMs ?? 30_000, 55_000));
    await overlayWorking(tabId, session);
    const t = await tabSummary(tabId);
    return ok(text(`${loaded ? "Loaded" : "Still loading (timed out waiting)"}: ${t.title}\nURL: ${t.url}\ntabId: ${tabId}${dialogNote(tabId)}`));
  },

  async computer(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const tab = await chrome.tabs.get(tabId);
    await gate(tab.url, session.title);
    const mods = a.modifiers ? modifierBits(String(a.modifiers).split("+")) : 0;
    switch (a.action) {
      case "screenshot": {
        const s = await page.screenshot(tabId);
        return ok(
          { type: "image", data: s.base64, mimeType: s.mimeType },
          text(`Screenshot of tab ${tabId} (${s.width}x${s.height}, imageId ${s.imageId}). Coordinates for clicks use this image's pixels.${dialogNote(tabId)}`),
        );
      }
      case "zoom": {
        if (!Array.isArray(a.region) || a.region.length !== 4) throw new Error("zoom needs region [x0, y0, x1, y1]");
        const data = await page.zoom(tabId, a.region);
        return ok({ type: "image", data, mimeType: "image/png" }, text(`Zoomed region ${JSON.stringify(a.region)} at full resolution.`));
      }
      case "left_click":
      case "right_click":
      case "middle_click":
      case "double_click":
      case "triple_click": {
        const p = await pointFor(tabId, a);
        const what = await describeAt(tabId, p.x, p.y);
        const button = a.action === "right_click" ? "right" : a.action === "middle_click" ? "middle" : "left";
        const count = a.action === "double_click" ? 2 : a.action === "triple_click" ? 3 : 1;
        page.tryContent(tabId, "ripple", { x: p.x, y: p.y });
        rec.noteClick(tabId, p.x, p.y);
        await page.click(tabId, p.x, p.y, { button, count, modifiers: mods });
        // Give a dialog (alert/confirm) a moment to open so the result can mention it.
        for (let i = 0; i < 4 && !cdp.dialogOf(tabId); i++) await sleep(60);
        return ok(text(`${a.action.replace("_", " ")} at ${p.label}${what}${dialogNote(tabId)}`));
      }
      case "hover": {
        const p = await pointFor(tabId, a);
        await page.mouseMove(tabId, p.x, p.y, mods);
        return ok(text(`Hovering at ${p.label}${await describeAt(tabId, p.x, p.y)}`));
      }
      case "left_click_drag": {
        if (!a.start_coordinate) throw new Error("left_click_drag needs start_coordinate and coordinate");
        const from = page.toCss(tabId, a.start_coordinate[0], a.start_coordinate[1]);
        const to = await pointFor(tabId, a);
        rec.noteClick(tabId, from[0], from[1]);
        await page.drag(tabId, from, [to.x, to.y]);
        return ok(text(`Dragged from (${a.start_coordinate}) to ${to.label}`));
      }
      case "type": {
        if (typeof a.text !== "string") throw new Error("type needs text");
        if (a.ref) {
          const p = await pointFor(tabId, a);
          await page.click(tabId, p.x, p.y);
        }
        await page.typeText(tabId, a.text);
        return ok(text(`Typed ${a.text.length} characters`));
      }
      case "key": {
        if (!a.text) throw new Error("key needs text, e.g. 'Enter' or 'cmd+a'");
        const repeat = Math.min(Math.max(1, a.repeat ?? 1), 100);
        for (let i = 0; i < repeat; i++) for (const combo of String(a.text).split(/\s+/).filter(Boolean)) await page.pressCombo(tabId, combo);
        return ok(text(`Pressed ${a.text}${repeat > 1 ? ` ×${repeat}` : ""}${dialogNote(tabId)}`));
      }
      case "scroll": {
        const vp = await page.viewport(tabId);
        const p = a.coordinate || a.ref ? await pointFor(tabId, a) : { x: vp.width / 2, y: vp.height / 2, label: "center" };
        const amount = (a.scroll_amount ?? 3) * 100;
        const dir = a.scroll_direction ?? "down";
        const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
        const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
        await page.wheel(tabId, p.x, p.y, dx, dy);
        await sleep(250);
        const after = await page.viewport(tabId);
        return ok(text(`Scrolled ${dir} by ${amount}px at ${p.label}. Page scroll is now (${Math.round(after.scrollX)}, ${Math.round(after.scrollY)}).`));
      }
      case "scroll_to": {
        if (!a.ref) throw new Error("scroll_to needs ref");
        await page.content(tabId, "refRect", { ref: a.ref });
        return ok(text(`Scrolled ${a.ref} into view`));
      }
      case "wait": {
        const secs = Math.min(Math.max(0, a.duration ?? 1), 30);
        await sleep(secs * 1000);
        return ok(text(`Waited ${secs}s`));
      }
      default:
        throw new Error(`Unknown action ${a.action}`);
    }
  },

  async screenshot(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const s = await page.screenshot(tabId, { format: a.format, fullPage: a.fullPage });
    const blocks: ContentBlock[] = [{ type: "image", data: s.base64, mimeType: s.mimeType }];
    let note = `Screenshot of tab ${tabId} (${s.width}x${s.height}${a.fullPage ? ", full page" : ""}, imageId ${s.imageId}).`;
    if (a.save) {
      const saved = await uploadArtifact(page.b64ToBytes(s.base64).slice(0, undefined, s.mimeType), `screenshot-${Date.now()}.${a.format === "png" ? "png" : "jpg"}`);
      note += ` Saved: ${saved.url}${saved.path ? `\nFile: ${saved.path}` : ""}`;
    }
    blocks.push(text(note));
    return ok(...blocks);
  },

  async read_page(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    await gate((await chrome.tabs.get(tabId)).url, session.title);
    const out = await page.content<string>(tabId, "readPage", a);
    return ok(text(out + dialogNote(tabId)));
  },

  async find(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const found = await page.content<any[]>(tabId, "find", { query: a.query, limit: a.limit ?? 20 });
    if (!found.length) return ok(text(`Nothing matched "${a.query}". Try read_page with filter="interactive".`));
    const lines = found.map((f) => {
      const [x, y] = page.toShot(tabId, f.rect.x + f.rect.width / 2, f.rect.y + f.rect.height / 2);
      return `- ${f.role} ${JSON.stringify(f.name)} [${f.ref}] at (${x}, ${y})`;
    });
    return ok(text(`Matches for "${a.query}":\n${lines.join("\n")}`));
  },

  async form_input(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const r = await page.content<string>(tabId, "formInput", { ref: a.ref, value: a.value });
    return ok(text(`${a.ref}: ${r}`));
  },

  async get_page_text(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    await gate((await chrome.tabs.get(tabId)).url, session.title);
    return ok(text(await page.content<string>(tabId, "pageText", { max_chars: a.max_chars })));
  },

  async javascript_tool(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    await gate((await chrome.tabs.get(tabId)).url, session.title);
    const r = await cdp.send(tabId, "Runtime.evaluate", {
      expression: String(a.text),
      replMode: true,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      timeout: 50_000,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      return { content: [text(`JavaScript error: ${d.exception?.description ?? d.text}`)], isError: true };
    }
    const v = r.result;
    let out: string;
    if (v.type === "undefined") out = "undefined";
    else if ("value" in v) out = typeof v.value === "string" ? v.value : JSON.stringify(v.value, null, 1);
    else out = v.description ?? v.unserializableValue ?? v.type;
    if (out && out.length > 50_000) out = `${out.slice(0, 50_000)}\n… truncated`;
    return ok(text(out ?? "null"));
  },

  async read_console_messages(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    await cdp.attach(tabId);
    const all = cdp.consoleOf(tabId);
    let list = all.slice();
    if (a.onlyErrors) list = list.filter((m) => m.level === "error");
    if (a.pattern) {
      const re = new RegExp(a.pattern, "i");
      list = list.filter((m) => re.test(m.text));
    }
    list = list.slice(-(a.limit ?? 100));
    if (a.clear) all.length = 0;
    if (!list.length) return ok(text("No console messages captured yet (capture starts when the agent first uses the tab)."));
    return ok(text(list.map((m) => `[${m.level}] ${m.text}${m.url ? `  (${m.url})` : ""}`).join("\n")));
  },

  async read_network_requests(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    await cdp.attach(tabId);
    const map = cdp.networkOf(tabId);
    let list = [...map.values()];
    if (a.urlPattern) {
      let re: RegExp | null = null;
      try {
        re = new RegExp(a.urlPattern, "i");
      } catch {}
      list = list.filter((r) => (re ? re.test(r.url) : r.url.includes(a.urlPattern)));
    }
    list = list.slice(-(a.limit ?? 100));
    const out: string[] = [];
    for (const r of list) {
      let line = `${r.method} ${r.status ?? (r.failed ? "FAILED" : "pending")} ${r.type ?? ""} ${r.url}${r.durationMs !== undefined ? ` ${r.durationMs}ms` : ""}${r.failed ? ` (${r.failed})` : ""}`;
      if (a.includeBodies && (r.type === "XHR" || r.type === "Fetch") && r.status) {
        try {
          const b = await cdp.send(tabId, "Network.getResponseBody", { requestId: r.requestId });
          const body = b.base64Encoded ? "[binary]" : String(b.body);
          line += `\n    body: ${body.length > 10_000 ? `${body.slice(0, 10_000)}…` : body}`;
        } catch {}
      }
      out.push(line);
    }
    if (a.clear) map.clear();
    return ok(text(out.length ? out.join("\n") : "No requests captured yet (capture starts when the agent first uses the tab)."));
  },

  async resize_window(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const tab = await chrome.tabs.get(tabId);
    const w = await chrome.windows.update(tab.windowId, { state: "normal", width: Math.round(a.width), height: Math.round(a.height) });
    return ok(text(`Window ${w.id} resized to ${w.width}x${w.height}`));
  },

  async file_upload(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const files = await Promise.all((a.files ?? []).map(fileFrom));
    const r = await page.content<string>(tabId, "setFiles", { ref: a.ref, files });
    return ok(text(r));
  },

  async upload_image(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const img = page.images.get(a.imageId);
    if (!img) throw new Error(`Unknown imageId ${a.imageId}. Take a screenshot first.`);
    const name = a.filename ?? (img.mimeType === "image/png" ? "image.png" : "image.jpg");
    const files = [{ name, mimeType: img.mimeType, base64: img.base64 }];
    if (a.ref) return ok(text(await page.content<string>(tabId, "setFiles", { ref: a.ref, files })));
    if (a.coordinate) {
      const [x, y] = page.toCss(tabId, a.coordinate[0], a.coordinate[1]);
      return ok(text(await page.content<string>(tabId, "setFiles", { x, y, files })));
    }
    throw new Error("upload_image needs ref or coordinate");
  },

  async record(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    if (a.action === "status") {
      const since = rec.recordingSince(tabId);
      return ok(text(since ? `Recording tab ${tabId} for ${Math.round((Date.now() - since) / 1000)}s` : `Tab ${tabId} is not recording`));
    }
    if (a.action === "start") {
      const r = await rec.startRecording(tabId, { kind: "video", fps: a.fps, format: a.format, showClicks: a.showClicks });
      await overlayWorking(tabId, session);
      return ok(text(`Recording tab ${tabId} (${r.mimeType}, ${r.fps} fps). Do the steps, then call record with action=stop.`));
    }
    if (a.action === "stop") {
      const r = await rec.stopRecording(tabId, { filename: a.filename, download: a.download });
      await overlayIdle(tabId, session);
      return ok(
        text(
          [
            `Recorded ${(r.durationMs / 1000).toFixed(1)}s, ${r.frames} frames, ${(r.bytes / 1024 / 1024).toFixed(2)} MB (${r.mimeType}).`,
            r.url ? `URL: ${r.url}` : r.uploadError ? `Upload failed: ${r.uploadError}` : "",
            r.path ? `File: ${r.path}` : "",
            r.downloadId !== undefined ? "Also saved to the browser's Downloads folder." : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    }
    throw new Error(`Unknown action ${a.action}`);
  },

  async gif_creator(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    if (a.action === "start_recording") {
      await rec.startRecording(tabId, { kind: "gif", showClicks: true });
      await overlayWorking(tabId, session);
      return ok(text(`GIF recording started on tab ${tabId}. Call gif_creator with action=stop_recording, then export.`));
    }
    if (a.action === "stop_recording" || a.action === "export") {
      if (!rec.isRecording(tabId)) {
        if (a.action === "export" && lastGif.has(tabId)) {
          const g = lastGif.get(tabId)!;
          return ok(...g);
        }
        throw new Error("No GIF recording on this tab");
      }
      const r = await rec.stopRecording(tabId, { filename: a.filename, download: a.download, inline: true });
      await overlayIdle(tabId, session);
      const blocks: ContentBlock[] = [];
      if (r.base64) blocks.push({ type: "image", data: r.base64, mimeType: "image/gif" });
      blocks.push(text(`GIF: ${r.frames} frames, ${(r.bytes / 1024).toFixed(0)} KB. ${r.path ?? r.url ?? r.uploadError ?? ""}`));
      lastGif.set(tabId, blocks);
      return ok(...blocks);
    }
    if (a.action === "clear") {
      if (rec.isRecording(tabId)) await rec.stopRecording(tabId, {}).catch(() => {});
      lastGif.delete(tabId);
      return ok(text("Cleared"));
    }
    throw new Error(`Unknown action ${a.action}`);
  },

  async wait_for(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const timeout = Math.min(a.timeoutMs ?? 10_000, 60_000);
    const deadline = Date.now() + timeout;
    if (a.urlIncludes) {
      while (Date.now() < deadline) {
        if ((await chrome.tabs.get(tabId)).url?.includes(a.urlIncludes)) break;
        await sleep(200);
      }
      if (!(await chrome.tabs.get(tabId)).url?.includes(a.urlIncludes)) return { content: [text(`Timed out: URL does not include ${a.urlIncludes}`)], isError: true };
    }
    if (a.text || a.textGone || a.selector) {
      let res: { ok: boolean } | undefined;
      while (Date.now() < deadline) {
        try {
          res = await page.content(tabId, "waitFor", { ...a, timeoutMs: Math.max(0, deadline - Date.now()) });
          if (res?.ok) break;
        } catch {
          await sleep(300); // page navigating; retry
        }
      }
      if (!res?.ok) return { content: [text(`Timed out after ${timeout}ms waiting for ${JSON.stringify({ text: a.text, textGone: a.textGone, selector: a.selector })}`)], isError: true };
    }
    return ok(text("Condition met"));
  },

  async handle_dialog(a, { session }) {
    const tabId = await resolveTab(session, a.tabId);
    const d = cdp.dialogOf(tabId);
    await cdp.send(tabId, "Page.handleJavaScriptDialog", { accept: Boolean(a.accept), promptText: a.promptText });
    cdp.clearDialog(tabId);
    return ok(text(`${a.accept ? "Accepted" : "Dismissed"} ${d ? `${d.type} "${d.message}"` : "the dialog"}`));
  },

  async history_search(a) {
    const granted = await chrome.permissions.contains({ permissions: ["history"] });
    if (!granted) throw new Error("History access is off. The user can turn it on in the Agent Chrome MCP extension popup.");
    const items = await chrome.history.search({
      text: String(a.query),
      maxResults: Math.min(a.maxResults ?? 25, 100),
      startTime: Date.now() - (a.daysBack ?? 30) * 86_400_000,
    });
    return ok(text(JSON.stringify(items.map((i) => ({ title: i.title, url: i.url, lastVisit: i.lastVisitTime ? new Date(i.lastVisitTime).toISOString() : undefined, visits: i.visitCount })), null, 1)));
  },
};

const lastGif = new Map<number, ContentBlock[]>();

async function ensureInGroupIfOwned(session: SessionState, tabId: number) {
  // Tabs the session created or adopted stay grouped; user tabs passed explicitly are left where they are.
  if (session.currentTabId === tabId) {
    const t = await chrome.tabs.get(tabId);
    if (session.groupId === undefined || t.groupId !== session.groupId) {
      const inAnother = t.groupId >= 0 && t.groupId !== session.groupId;
      if (!inAnother) await ensureInGroup(session, tabId);
    }
  }
}

const TAB_TOOLS = new Set(["navigate", "computer", "screenshot", "read_page", "find", "form_input", "get_page_text", "javascript_tool", "file_upload", "upload_image", "wait_for", "record", "gif_creator"]);

export async function runTool(name: string, args: Args, info: SessionInfo, signal: AbortSignal): Promise<CallToolResult> {
  const session = await getSession(info);
  if (session.paused) {
    return {
      content: [text("The user pressed Stop in the browser, so this session is paused. Ask the user what to do; they can press Resume on the page or in the extension popup.")],
      isError: true,
    };
  }
  const h = handlers[name];
  if (!h) return { content: [text(`Unknown tool ${name}`)], isError: true };
  let tabId: number | undefined;
  if (TAB_TOOLS.has(name)) {
    try {
      tabId = await resolveTab(session, args.tabId);
      if (args.tabId === undefined) args.tabId = tabId;
    } catch {}
    if (tabId !== undefined && cdp.dialogOf(tabId)) {
      // The page is frozen until the dialog is handled; anything else would hang.
      return { content: [text(`Tab ${tabId} is blocked by a ${cdp.dialogOf(tabId)!.type} dialog: ${JSON.stringify(cdp.dialogOf(tabId)!.message)}. Call handle_dialog first.`)], isError: true };
    }
    if (tabId !== undefined) await overlayWorking(tabId, session).catch(() => {});
  }
  try {
    const result = await Promise.race([
      h(args, { session, info, signal }),
      new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(new Error("Cancelled")), { once: true })),
    ]);
    return result;
  } catch (e) {
    return { content: [text(`Error: ${(e as Error)?.message ?? String(e)}`)], isError: true };
  } finally {
    if (tabId !== undefined) overlayIdle(tabId, session).catch(() => {});
  }
}

export async function setPaused(tabId: number | undefined, paused: boolean) {
  const list = tabId !== undefined ? await sessionsForTab(tabId) : await allSessions();
  for (const s of list) {
    s.paused = paused;
    await updateSession(s);
    const tabs = await groupTabs(s);
    for (const t of tabs) {
      await page.tryContent(t.id!, "overlay", paused ? { state: "paused", label: `${s.title} is paused` } : { state: "idle", label: `${s.title}`, linger: 0 });
    }
  }
  return list.length;
}
