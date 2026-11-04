// Video and GIF recording: CDP screencast frames are painted onto a canvas in an offscreen document,
// which encodes them with MediaRecorder (MP4/WebM) or a built-in GIF encoder.

import * as cdp from "./cdp";
import { getConnection } from "./settings";

interface Rec {
  recId: string;
  kind: "video" | "gif";
  since: number;
  showClicks: boolean;
  stopListen: () => void;
}

const recs = new Map<number, Rec>();

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: "Encode video and GIF recordings of tabs the agent controls.",
  });
}

const toOffscreen = <T = any>(msg: Record<string, unknown>) => chrome.runtime.sendMessage<any, T>({ target: "offscreen", ...msg });

export const recordingOf = (tabId: number) => recs.get(tabId);

export async function startRecording(tabId: number, opts: { kind: "video" | "gif"; fps?: number; format?: string; showClicks?: boolean }) {
  if (recs.has(tabId)) throw new Error("This tab is already recording. Stop it first.");
  await ensureOffscreen();
  const recId = crypto.randomUUID();
  const fps = Math.max(1, Math.min(opts.kind === "gif" ? 10 : 30, opts.fps ?? (opts.kind === "gif" ? 5 : 15)));
  const started = await toOffscreen<{ ok: boolean; error?: string; mimeType?: string }>({ type: "rec:start", recId, kind: opts.kind, fps, format: opts.format });
  if (!started?.ok) throw new Error(started?.error ?? "Recorder failed to start");
  // Screencast frames only arrive while the tab is painted, so recording needs it visible in its window.
  await chrome.tabs.update(tabId, { active: true });
  const stopListen = cdp.onCdpEvent((tid, method, params) => {
    if (tid !== tabId || method !== "Page.screencastFrame") return;
    cdp.send(tabId, "Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
    toOffscreen({ type: "rec:frame", recId, data: params.data, metadata: params.metadata }).catch(() => {});
  });
  await cdp.send(tabId, "Page.startScreencast", {
    format: "jpeg",
    quality: opts.kind === "gif" ? 60 : 75,
    maxWidth: opts.kind === "gif" ? 800 : 1600,
    maxHeight: opts.kind === "gif" ? 800 : 1600,
    everyNthFrame: 1,
  });
  // Nudge a first frame even on a static page.
  cdp.send(tabId, "Runtime.evaluate", { expression: "document.body && (document.body.style.outline = document.body.style.outline)" }).catch(() => {});
  const rec: Rec = { recId, kind: opts.kind, since: Date.now(), showClicks: opts.showClicks !== false, stopListen };
  recs.set(tabId, rec);
  // Hard cap: 10 minutes.
  setTimeout(() => {
    if (recs.get(tabId)?.recId === recId) stopRecording(tabId, {}).catch(() => {});
  }, 10 * 60_000);
  return { mimeType: started.mimeType, fps };
}

export function noteClick(tabId: number, cssX: number, cssY: number) {
  const rec = recs.get(tabId);
  if (rec?.showClicks) toOffscreen({ type: "rec:click", recId: rec.recId, x: cssX, y: cssY }).catch(() => {});
}

export interface StopResult {
  url?: string;
  path?: string;
  bytes: number;
  durationMs: number;
  mimeType: string;
  frames: number;
  base64?: string;
  downloadId?: number;
  uploadError?: string;
}

export async function stopRecording(tabId: number, opts: { filename?: string; download?: boolean; inline?: boolean }): Promise<StopResult> {
  const rec = recs.get(tabId);
  if (!rec) throw new Error("This tab is not recording.");
  recs.delete(tabId);
  rec.stopListen();
  await cdp.send(tabId, "Page.stopScreencast").catch(() => {});
  const conn = await getConnection();
  const ext = rec.kind === "gif" ? "gif" : undefined;
  const res = await toOffscreen<StopResult & { ok: boolean; error?: string; objectUrl?: string; ext: string }>({
    type: "rec:stop",
    recId: rec.recId,
    server: conn.server,
    token: conn.deviceToken,
    filename: opts.filename,
    ext,
    inline: opts.inline,
  });
  if (!res?.ok) throw new Error(res?.error ?? "Recorder failed");
  let downloadId: number | undefined;
  if (opts.download && res.objectUrl) {
    const name = (opts.filename || `agent-recording-${new Date().toISOString().replace(/[:.]/g, "-")}`).replace(/\.(mp4|webm|gif)$/i, "");
    downloadId = await chrome.downloads.download({ url: res.objectUrl, filename: `${name}.${res.ext}`, saveAs: false }).catch(() => undefined);
  }
  return { ...res, downloadId };
}

export function isRecording(tabId: number) {
  return recs.has(tabId);
}

export function recordingSince(tabId: number) {
  return recs.get(tabId)?.since;
}
