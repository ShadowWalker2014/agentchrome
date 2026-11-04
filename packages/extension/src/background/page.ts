// Helpers that talk to a tab: content-script calls, screenshots, coordinate mapping and input events.

import * as cdp from "./cdp";
import { editingCommands, modifierBits, MOD, parseCombo } from "./keys";

export async function content<T = any>(tabId: number, name: string, args: unknown = {}): Promise<T> {
  const call = () =>
    chrome.scripting.executeScript({
      target: { tabId },
      func: async (n: string, a: unknown) => {
        const api = (window as any).__acm;
        if (!api) return { missing: true };
        try {
          return { ok: true, value: await api.run(n, a) };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      },
      args: [name, args],
    });
  let res: any;
  try {
    [res] = await call();
    if (res?.result?.missing) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      [res] = await call();
    }
  } catch (e) {
    throw new Error(`Cannot access this page (${(e as Error).message}).`);
  }
  const r = res?.result;
  if (!r) throw new Error("The page did not respond (it may be loading or blocked).");
  if (!r.ok) throw new Error(r.error);
  return r.value as T;
}

/** Fire-and-forget content call for UI (overlay) that must never fail a tool. */
export async function tryContent(tabId: number, name: string, args: unknown = {}) {
  try {
    return await content(tabId, name, args);
  } catch {
    return undefined;
  }
}

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
  scrollX: number;
  scrollY: number;
}

export async function viewport(tabId: number): Promise<Viewport> {
  const r = await cdp.send(tabId, "Runtime.evaluate", {
    expression: "({width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollX, scrollY})",
    returnByValue: true,
  });
  return r.result.value as Viewport;
}

interface ShotInfo {
  /** screenshot pixels per CSS pixel */
  scale: number;
  width: number;
  height: number;
}
const shots = new Map<number, ShotInfo>();

/** Recently captured images, so upload_image / file_upload can reuse them by id. */
export const images = new Map<string, { base64: string; mimeType: string }>();
let imageSeq = 0;

function targetScale(w: number, h: number) {
  return Math.min(1, 1568 / Math.max(w, h), Math.sqrt(1_150_000 / (w * h)));
}

export function toCss(tabId: number, x: number, y: number): [number, number] {
  const s = shots.get(tabId)?.scale ?? 1;
  return [x / s, y / s];
}

export function toShot(tabId: number, x: number, y: number): [number, number] {
  const s = shots.get(tabId)?.scale ?? 1;
  return [Math.round(x * s), Math.round(y * s)];
}

function b64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function blobToB64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function resize(b64: string, inType: string, width: number, height: number, outType: string, quality: number) {
  const bmp = await createImageBitmap(b64ToBlob(b64, inType));
  if (bmp.width === width && bmp.height === height && inType === outType) {
    bmp.close();
    return b64;
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  return blobToB64(await canvas.convertToBlob({ type: outType, quality: quality / 100 }));
}

async function ensureRendered(tabId: number) {
  // Background tabs are not painted; captureScreenshot then hangs. Bring the tab to front of its window only if needed.
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) {
    try {
      await cdp.send(tabId, "Emulation.setFocusEmulationEnabled", { enabled: true });
    } catch {}
  }
  return tab;
}

async function captureRaw(tabId: number, params: Record<string, unknown>): Promise<string> {
  const attempt = () =>
    Promise.race([
      cdp.send<{ data: string }>(tabId, "Page.captureScreenshot", params).then((r) => r.data),
      new Promise<null>((r) => setTimeout(() => r(null), 4000)),
    ]);
  let data = await attempt();
  if (data === null) {
    // The tab is hidden and not painting: activate it in its window, then retry.
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((r) => setTimeout(r, 300));
    data = await attempt();
  }
  if (data === null) throw new Error("Screenshot timed out: the tab is not rendering. Make sure its window is not minimized.");
  return data;
}

export async function screenshot(
  tabId: number,
  opts: { format?: "jpeg" | "png"; quality?: number; fullPage?: boolean; hideOverlay?: boolean } = {},
): Promise<{ base64: string; mimeType: string; width: number; height: number; imageId: string; cssWidth: number; cssHeight: number }> {
  const format = opts.format ?? "jpeg";
  const quality = opts.quality ?? 80;
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  await ensureRendered(tabId);
  const vp = await viewport(tabId);
  if (opts.hideOverlay !== false) await tryContent(tabId, "setOverlayVisible", { visible: false });
  let raw: string;
  let cssW = vp.width;
  let cssH = vp.height;
  try {
    if (opts.fullPage) {
      const m = await cdp.send(tabId, "Page.getLayoutMetrics");
      const cs = m.cssContentSize ?? m.contentSize;
      cssW = Math.ceil(cs.width);
      cssH = Math.min(Math.ceil(cs.height), 16_000);
      raw = await captureRaw(tabId, { format, quality, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssW, height: cssH, scale: 1 } });
    } else {
      raw = await captureRaw(tabId, { format, quality });
    }
  } finally {
    if (opts.hideOverlay !== false) await tryContent(tabId, "setOverlayVisible", { visible: true });
  }
  let scale = targetScale(cssW, cssH);
  if (opts.fullPage) scale = Math.min(1, 1280 / cssW);
  const width = Math.max(1, Math.round(cssW * scale));
  const height = Math.max(1, Math.round(cssH * scale));
  const base64 = await resize(raw, mimeType, width, height, mimeType, quality);
  if (!opts.fullPage) shots.set(tabId, { scale, width, height });
  const imageId = `img_${++imageSeq}`;
  images.set(imageId, { base64, mimeType });
  if (images.size > 20) images.delete(images.keys().next().value!);
  return { base64, mimeType, width, height, imageId, cssWidth: cssW, cssHeight: cssH };
}

export async function zoom(tabId: number, region: number[]) {
  const [x0, y0] = toCss(tabId, region[0]!, region[1]!);
  const [x1, y1] = toCss(tabId, region[2]!, region[3]!);
  const vp = await viewport(tabId);
  await tryContent(tabId, "setOverlayVisible", { visible: false });
  try {
    const raw = await captureRaw(tabId, {
      format: "png",
      clip: { x: Math.min(x0, x1) + vp.scrollX, y: Math.min(y0, y1) + vp.scrollY, width: Math.abs(x1 - x0), height: Math.abs(y1 - y0), scale: 1 },
    });
    return raw;
  } finally {
    await tryContent(tabId, "setOverlayVisible", { visible: true });
  }
}

// ---------------- input ----------------

type Button = "left" | "right" | "middle";

export async function mouseMove(tabId: number, x: number, y: number, modifiers = 0) {
  await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, modifiers });
}

export async function click(tabId: number, x: number, y: number, opts: { button?: Button; count?: number; modifiers?: number } = {}) {
  const button = opts.button ?? "left";
  const count = opts.count ?? 1;
  const modifiers = opts.modifiers ?? 0;
  // Catch the native file picker this click might open: the agent can't see or use it.
  await cdp.send(tabId, "Page.setInterceptFileChooserDialog", { enabled: true }).catch(() => {});
  try {
    await mouseMove(tabId, x, y, modifiers);
    for (let i = 1; i <= count; i++) {
      await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: i, modifiers, buttons: button === "left" ? 1 : button === "right" ? 2 : 4 });
      // A click that opens alert/confirm blocks the renderer, so the release never acknowledges.
      const opened = await untilDialog(tabId, cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: i, modifiers, buttons: 0 }));
      if (opened) return;
    }
    await new Promise((r) => setTimeout(r, 120));
  } finally {
    if (!cdp.dialogOf(tabId)) await cdp.send(tabId, "Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
  }
}

/** Resolve false when `p` settles, true if a JavaScript dialog opens first. */
export function untilDialog(tabId: number, p: Promise<unknown>): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (cdp.dialogOf(tabId)) return resolve(true);
    const off = cdp.onCdpEvent((tid, method) => {
      if (tid === tabId && method === "Page.javascriptDialogOpening") {
        off();
        resolve(true);
      }
    });
    p.then(
      () => {
        off();
        resolve(false);
      },
      (e) => {
        off();
        reject(e);
      },
    );
  });
}

/** Drag with the mouse. Works for pointer-event libraries and for native HTML5 drag-and-drop (dragstart/drop). */
export async function drag(tabId: number, from: [number, number], to: [number, number], onStep?: (x: number, y: number) => void): Promise<"html5" | "mouse"> {
  let data: any = null;
  const off = cdp.onCdpEvent((tid, method, params) => {
    if (tid === tabId && method === "Input.dragIntercepted") data = params.data;
  });
  await cdp.send(tabId, "Input.setInterceptDrags", { enabled: true }).catch(() => {});
  try {
    await mouseMove(tabId, from[0], from[1]);
    await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: from[0], y: from[1], button: "left", clickCount: 1, buttons: 1 });
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const x = from[0] + ((to[0] - from[0]) * i) / steps;
      const y = from[1] + ((to[1] - from[1]) * i) / steps;
      if (data) break;
      await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
      onStep?.(x, y);
      await new Promise((r) => setTimeout(r, 18));
    }
    if (data) {
      // The page started a native drag: finish it with real drag events at the target.
      for (const type of ["dragEnter", "dragOver"] as const) await cdp.send(tabId, "Input.dispatchDragEvent", { type, x: to[0], y: to[1], data });
      await cdp.send(tabId, "Input.dispatchDragEvent", { type: "drop", x: to[0], y: to[1], data });
      await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: to[0], y: to[1], button: "left", clickCount: 1, buttons: 0 });
      return "html5";
    }
    await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: to[0], y: to[1], button: "left", clickCount: 1, buttons: 0 });
    return "mouse";
  } finally {
    off();
    await cdp.send(tabId, "Input.setInterceptDrags", { enabled: false }).catch(() => {});
  }
}

export async function wheel(tabId: number, x: number, y: number, dx: number, dy: number) {
  await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: dx, deltaY: dy });
}

export async function pressCombo(tabId: number, combo: string) {
  const { modifiers, key } = parseCombo(combo);
  const bits = modifierBits(modifiers);
  const order = ["ctrl", "alt", "shift", "cmd"];
  const held = order.filter((m) => (m === "ctrl" ? bits & MOD.ctrl : m === "alt" ? bits & MOD.alt : m === "shift" ? bits & MOD.shift : bits & MOD.meta));
  let cur = 0;
  for (const m of held) {
    const d = parseCombo(m).key;
    cur |= modifierBits([m]);
    await cdp.send(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: d.key, code: d.code, windowsVirtualKeyCode: d.keyCode, modifiers: cur, location: d.location });
  }
  const printable = key.text && !(bits & (MOD.ctrl | MOD.meta | MOD.alt));
  const commands = editingCommands(bits, key.key);
  const down = cdp.send(tabId, "Input.dispatchKeyEvent", {
    type: printable ? "keyDown" : "rawKeyDown",
    key: key.key,
    code: key.code,
    windowsVirtualKeyCode: key.keyCode,
    text: printable ? key.text : undefined,
    unmodifiedText: printable ? key.text : undefined,
    modifiers: bits,
    location: key.location,
    ...(commands.length ? { commands } : {}),
  });
  if (await untilDialog(tabId, down)) return;
  await cdp.send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: key.key, code: key.code, windowsVirtualKeyCode: key.keyCode, modifiers: bits, location: key.location });
  for (const m of held.reverse()) {
    const d = parseCombo(m).key;
    cur &= ~modifierBits([m]);
    await cdp.send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: d.key, code: d.code, windowsVirtualKeyCode: d.keyCode, modifiers: cur, location: d.location });
  }
}

export async function typeText(tabId: number, text: string) {
  const parts = text.split(/(\n|\t)/);
  for (const p of parts) {
    if (p === "\n") await pressCombo(tabId, "Enter");
    else if (p === "\t") await pressCombo(tabId, "Tab");
    else if (p) await cdp.send(tabId, "Input.insertText", { text: p });
  }
}

export function b64ToBytes(b64: string) {
  return b64ToBlob(b64, "application/octet-stream");
}

export interface UploadFile {
  name: string;
  mimeType?: string;
  base64: string;
}

const SET_FILES_FN = `function (files) {
  const dt = new DataTransfer();
  for (const f of files) {
    const bin = atob(f.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    dt.items.add(new File([bytes], f.name, { type: f.mimeType || "application/octet-stream" }));
  }
  let el = this;
  if (!(el instanceof HTMLInputElement && el.type === "file")) {
    const inner = el.querySelector && el.querySelector('input[type="file"]');
    if (inner) el = inner;
  }
  if (el instanceof HTMLInputElement && el.type === "file") {
    if (!el.multiple && files.length > 1) throw new Error("This file input accepts one file; got " + files.length);
    el.files = dt.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return "input";
  }
  const r = el.getBoundingClientRect();
  for (const type of ["dragenter", "dragover", "drop"]) {
    el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }
  return "drop";
}`;

const DEEP_QUERY = (token: string) => `(() => {
  const sel = '[data-acm-up="${token}"]';
  const walk = (root) => {
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; }
    return null;
  };
  return walk(document);
})()`;

/**
 * Put files into a file input or drop target in the page's main world.
 * target: a backendNodeId (from an intercepted file chooser) or a token set by the content script on a ref.
 * Local paths go through DOM.setFileInputFiles, so the page gets real files read by Chrome.
 */
export async function setFilesCdp(tabId: number, target: { backendNodeId?: number; token?: string }, files: { paths?: string[]; data?: UploadFile[] }): Promise<string> {
  let objectId: string | undefined;
  if (target.backendNodeId !== undefined) {
    const r = await cdp.send(tabId, "DOM.resolveNode", { backendNodeId: target.backendNodeId });
    objectId = r.object?.objectId;
  } else if (target.token) {
    const r = await cdp.send(tabId, "Runtime.evaluate", { expression: DEEP_QUERY(target.token), returnByValue: false });
    objectId = r.result?.objectId;
  }
  if (!objectId) throw new Error("Could not find the file input in the page. Call read_page again.");
  if (files.paths?.length) {
    const info = await cdp.send(tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: "function(){ const el = this instanceof HTMLInputElement ? this : this.querySelector && this.querySelector('input[type=file]'); return el && el.type === 'file' ? { multiple: el.multiple } : null; }",
      returnByValue: true,
    });
    if (!info.result?.value) throw new Error("Local file paths can only go into an <input type=file>. Use files with base64 or url to drop onto other elements.");
    if (!info.result.value.multiple && files.paths.length > 1) throw new Error(`This file input accepts one file; got ${files.paths.length}`);
    await cdp.send(tabId, "DOM.setFileInputFiles", { files: files.paths, objectId });
    return `Attached ${files.paths.length} local file(s)`;
  }
  const r = await cdp.send(tabId, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: SET_FILES_FN,
    arguments: [{ value: files.data ?? [] }],
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split("\n")[0] ?? r.exceptionDetails.text);
  const how = r.result?.value === "drop" ? "Dropped" : "Attached";
  return `${how} ${files.data?.length ?? 0} file(s)`;
}
