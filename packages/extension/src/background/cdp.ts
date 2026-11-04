// chrome.debugger wrapper: attaches once per tab, buffers console and network events, tracks dialogs.

export interface ConsoleEntry {
  level: string;
  text: string;
  url?: string;
  ts: number;
}

export interface NetEntry {
  requestId: string;
  url: string;
  method: string;
  type?: string;
  status?: number;
  mimeType?: string;
  failed?: string;
  ts: number;
  durationMs?: number;
}

interface TabState {
  console: ConsoleEntry[];
  network: Map<string, NetEntry>;
  dialog?: { type: string; message: string; defaultPrompt?: string };
  /** Native file picker the page tried to open while interception was on. */
  chooser?: { backendNodeId: number; mode: string; ts: number };
  mainFrameId?: string;
  /** Last top-level document load: HTTP status or network error. */
  doc?: { url: string; status?: number; error?: string; ts: number };
  crashed?: boolean;
  downloads: { name: string; ts: number }[];
  opened: { url: string; ts: number }[];
}

const attached = new Set<number>();
const attaching = new Map<number, Promise<void>>();
const tabs = new Map<number, TabState>();
type Listener = (tabId: number, method: string, params: any) => void;
const listeners = new Set<Listener>();

const MAX_ENTRIES = 1000;

function state(tabId: number): TabState {
  let s = tabs.get(tabId);
  if (!s) {
    s = { console: [], network: new Map(), downloads: [], opened: [] };
    tabs.set(tabId, s);
  }
  return s;
}

const fmtArg = (a: any): string => {
  if (!a) return "";
  if (a.type === "string") return a.value;
  if ("value" in a) return JSON.stringify(a.value);
  if (a.unserializableValue) return a.unserializableValue;
  if (a.preview?.properties) {
    const props = a.preview.properties.map((p: any) => `${p.name}: ${p.value}`).join(", ");
    return a.subtype === "array" ? `[${props}]` : `{${props}}`;
  }
  return a.description ?? a.className ?? a.type;
};

chrome.debugger.onEvent.addListener((source, method, params: any) => {
  const tabId = source.tabId;
  if (tabId === undefined) return;
  const s = state(tabId);
  switch (method) {
    case "Runtime.consoleAPICalled":
      s.console.push({
        level: params.type === "warning" ? "warn" : params.type,
        text: (params.args ?? []).map(fmtArg).join(" "),
        url: params.stackTrace?.callFrames?.[0]?.url,
        ts: Date.now(),
      });
      break;
    case "Runtime.exceptionThrown": {
      const d = params.exceptionDetails;
      s.console.push({ level: "error", text: `Uncaught ${d.exception?.description ?? d.text}`, url: d.url, ts: Date.now() });
      break;
    }
    case "Log.entryAdded":
      s.console.push({ level: params.entry.level === "warning" ? "warn" : params.entry.level, text: params.entry.text, url: params.entry.url, ts: Date.now() });
      break;
    case "Page.frameNavigated":
      if (!params.frame.parentId) {
        s.mainFrameId = params.frame.id;
        s.crashed = false;
      }
      break;
    case "Page.fileChooserOpened":
      s.chooser = { backendNodeId: params.backendNodeId, mode: params.mode, ts: Date.now() };
      break;
    case "Page.windowOpen":
      s.opened.push({ url: params.url, ts: Date.now() });
      if (s.opened.length > 20) s.opened.shift();
      break;
    case "Page.downloadWillBegin":
      s.downloads.push({ name: params.suggestedFilename, ts: Date.now() });
      if (s.downloads.length > 20) s.downloads.shift();
      break;
    case "Inspector.targetCrashed":
      s.crashed = true;
      break;
    case "Network.requestWillBeSent":
      if (params.type === "Document" && (!s.mainFrameId || params.frameId === s.mainFrameId)) {
        s.doc = { url: params.request.url, ts: Date.now() };
      }
      s.network.set(params.requestId, {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        type: params.type,
        ts: Date.now(),
      });
      break;
    case "Network.responseReceived": {
      const e = s.network.get(params.requestId);
      if (params.type === "Document" && s.doc && (!s.mainFrameId || params.frameId === s.mainFrameId)) s.doc.status = params.response.status;
      if (e) {
        e.status = params.response.status;
        e.mimeType = params.response.mimeType;
        e.type = params.type ?? e.type;
      }
      break;
    }
    case "Network.loadingFinished": {
      const e = s.network.get(params.requestId);
      if (e) e.durationMs = Date.now() - e.ts;
      break;
    }
    case "Network.loadingFailed": {
      const e = s.network.get(params.requestId);
      if (e) e.failed = params.errorText;
      if (params.type === "Document" && s.doc && e && e.url === s.doc.url && !params.canceled) s.doc.error = params.errorText;
      break;
    }
    case "Page.javascriptDialogOpening":
      s.dialog = { type: params.type, message: params.message, defaultPrompt: params.defaultPrompt };
      break;
    case "Page.javascriptDialogClosed":
      s.dialog = undefined;
      break;
  }
  if (s.console.length > MAX_ENTRIES) s.console.splice(0, s.console.length - MAX_ENTRIES);
  if (s.network.size > MAX_ENTRIES) {
    const first = s.network.keys().next().value;
    if (first) s.network.delete(first);
  }
  for (const l of listeners) l(tabId, method, params);
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId !== undefined) {
    attached.delete(source.tabId);
    if (reason === "canceled_by_user") {
      userDetached.add(source.tabId);
      for (const cb of cancelListeners) cb(source.tabId);
    }
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  attached.delete(tabId);
  tabs.delete(tabId);
});

export const userDetached = new Set<number>();
const cancelListeners = new Set<(tabId: number) => void>();
/** Called when the user presses Cancel on Chrome's "started debugging this browser" bar. */
export function onUserCancel(cb: (tabId: number) => void) {
  cancelListeners.add(cb);
}

export function onCdpEvent(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function attach(tabId: number): Promise<void> {
  if (attached.has(tabId)) return;
  const inflight = attaching.get(tabId);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      try {
        await chrome.debugger.attach({ tabId }, "1.3");
      } catch (first) {
        // Another extension's frame (password managers, etc.) blocks attaching; it usually goes away
        // when the focused field loses focus. Blur and try once more.
        if (!/chrome-extension/i.test(String((first as Error).message))) throw first;
        await chrome.scripting.executeScript({ target: { tabId }, func: () => (document.activeElement as HTMLElement | null)?.blur?.() }).catch(() => {});
        await new Promise((r) => setTimeout(r, 250));
        await chrome.debugger.attach({ tabId }, "1.3");
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (!/already attached/i.test(msg)) {
        throw new Error(`Cannot control this tab (${msg}). Chrome blocks extensions on chrome:// pages, the Chrome Web Store and other extensions.`);
      }
    }
    attached.add(tabId);
    userDetached.delete(tabId);
    await Promise.all([
      chrome.debugger.sendCommand({ tabId }, "Runtime.enable"),
      chrome.debugger.sendCommand({ tabId }, "Log.enable"),
      chrome.debugger.sendCommand({ tabId }, "Network.enable", { maxTotalBufferSize: 10_000_000 }),
      chrome.debugger.sendCommand({ tabId }, "Page.enable"),
      chrome.debugger.sendCommand({ tabId }, "Inspector.enable"),
    ]).catch(() => {});
    const tree: any = await chrome.debugger.sendCommand({ tabId }, "Page.getFrameTree").catch(() => null);
    if (tree?.frameTree?.frame?.id) state(tabId).mainFrameId = tree.frameTree.frame.id;
  })();
  attaching.set(tabId, p);
  try {
    await p;
  } finally {
    attaching.delete(tabId);
  }
}

export async function send<T = any>(tabId: number, method: string, params?: Record<string, unknown>): Promise<T> {
  await attach(tabId);
  try {
    return (await chrome.debugger.sendCommand({ tabId }, method, params)) as T;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/not attached|detached/i.test(msg)) {
      attached.delete(tabId);
      await attach(tabId);
      return (await chrome.debugger.sendCommand({ tabId }, method, params)) as T;
    }
    throw new Error(`${method}: ${msg}`);
  }
}

export async function detach(tabId: number) {
  if (!attached.has(tabId)) return;
  attached.delete(tabId);
  await chrome.debugger.detach({ tabId }).catch(() => {});
}

export const consoleOf = (tabId: number) => state(tabId).console;
export const networkOf = (tabId: number) => state(tabId).network;
export const dialogOf = (tabId: number) => state(tabId).dialog;
export const clearDialog = (tabId: number) => (state(tabId).dialog = undefined);
export const isAttached = (tabId: number) => attached.has(tabId);

export const chooserOf = (tabId: number) => state(tabId).chooser;
export const clearChooser = (tabId: number) => (state(tabId).chooser = undefined);
export const docOf = (tabId: number) => state(tabId).doc;
export const crashedOf = (tabId: number) => Boolean(state(tabId).crashed);
export const downloadsOf = (tabId: number) => state(tabId).downloads;
export const openedOf = (tabId: number) => state(tabId).opened;
