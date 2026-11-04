import { encodeGif, quantize } from "./gif";

interface Rec {
  recId: string;
  kind: "video" | "gif";
  fps: number;
  format?: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  recorder?: MediaRecorder;
  mimeType: string;
  chunks: Blob[];
  started: number;
  frames: number;
  last?: ImageBitmap;
  meta?: { deviceWidth: number; deviceHeight: number; offsetTop: number };
  clicks: { x: number; y: number; t: number }[];
  timer?: ReturnType<typeof setInterval>;
  gif: { indices: Uint8Array; delayMs: number }[];
  gifW: number;
  gifH: number;
  gifCanvas?: OffscreenCanvas;
  lastSig?: number;
}

const recs = new Map<string, Rec>();
const MAX_GIF_FRAMES = 400;

function pickMime(kind: string, format?: string) {
  if (kind === "gif") return "image/gif";
  const mp4 = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"];
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const order = format === "webm" ? [...webm, ...mp4] : [...mp4, ...webm];
  return order.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
}

function b64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function blobToB64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function draw(r: Rec) {
  if (!r.last) return;
  const { ctx, canvas } = r;
  ctx.drawImage(r.last, 0, 0, canvas.width, canvas.height);
  const now = performance.now();
  r.clicks = r.clicks.filter((c) => now - c.t < 700);
  const scale = r.meta ? canvas.width / r.meta.deviceWidth : 1;
  for (const c of r.clicks) {
    const k = (now - c.t) / 700;
    const x = c.x * scale;
    const y = c.y * scale;
    ctx.beginPath();
    ctx.arc(x, y, (10 + 22 * k) * Math.max(1, scale), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(47,107,255,${0.22 * (1 - k)})`;
    ctx.fill();
    ctx.lineWidth = 3 * Math.max(1, scale);
    ctx.strokeStyle = `rgba(47,107,255,${1 - k})`;
    ctx.stroke();
  }
}

function sampleGif(r: Rec) {
  if (!r.last || r.gif.length >= MAX_GIF_FRAMES) return;
  if (!r.gifCanvas) {
    const s = Math.min(1, 640 / r.canvas.width);
    r.gifW = Math.max(2, Math.round(r.canvas.width * s));
    r.gifH = Math.max(2, Math.round(r.canvas.height * s));
    r.gifCanvas = new OffscreenCanvas(r.gifW, r.gifH);
  }
  const g = r.gifCanvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(r.canvas, 0, 0, r.gifW, r.gifH);
  const data = g.getImageData(0, 0, r.gifW, r.gifH).data;
  // Cheap signature to merge identical frames into one longer frame.
  let sig = 0;
  for (let i = 0; i < data.length; i += 997) sig = (sig * 31 + data[i]!) | 0;
  const delay = 1000 / r.fps;
  const prev = r.gif[r.gif.length - 1];
  if (prev && sig === r.lastSig && r.clicks.length === 0) {
    prev.delayMs += delay;
    return;
  }
  r.lastSig = sig;
  r.gif.push({ indices: quantize(data, r.gifW, r.gifH), delayMs: delay });
}

function startEncoder(r: Rec) {
  if (r.kind === "video") {
    const stream = r.canvas.captureStream(r.fps);
    r.recorder = new MediaRecorder(stream, { mimeType: r.mimeType, videoBitsPerSecond: 5_000_000 });
    r.recorder.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
    r.recorder.start(1000);
  }
  r.started = performance.now();
  r.timer = setInterval(() => {
    draw(r);
    if (r.kind === "gif") sampleGif(r);
  }, 1000 / r.fps);
}

async function upload(blob: Blob, server: string, token: string, name: string) {
  const res = await fetch(`${server}/api/artifacts?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": blob.type },
    body: blob,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()) as { url?: string; path?: string };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen") return false;
  (async () => {
    if (msg.type === "rec:start") {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 800;
      document.body.appendChild(canvas);
      const mimeType = pickMime(msg.kind, msg.format);
      const r: Rec = {
        recId: msg.recId, kind: msg.kind, fps: msg.fps, format: msg.format, canvas, ctx: canvas.getContext("2d")!, mimeType,
        chunks: [], started: 0, frames: 0, clicks: [], gif: [], gifW: 0, gifH: 0,
      };
      recs.set(msg.recId, r);
      return { ok: true, mimeType };
    }
    const r = recs.get(msg.recId);
    if (!r) return { ok: false, error: "No such recording" };
    if (msg.type === "rec:frame") {
      const bmp = await createImageBitmap(b64ToBlob(msg.data, "image/jpeg"));
      r.last?.close();
      r.last = bmp;
      r.meta = msg.metadata;
      r.frames++;
      if (!r.timer) {
        r.canvas.width = bmp.width - (bmp.width % 2);
        r.canvas.height = bmp.height - (bmp.height % 2);
        draw(r);
        startEncoder(r);
      }
      return { ok: true };
    }
    if (msg.type === "rec:click") {
      r.clicks.push({ x: msg.x, y: msg.y, t: performance.now() });
      return { ok: true };
    }
    if (msg.type === "rec:stop") {
      recs.delete(msg.recId);
      clearInterval(r.timer);
      if (!r.timer) return { ok: false, error: "No frames were captured. Recording needs the tab to be visible in a window that is not minimized." };
      const durationMs = performance.now() - r.started;
      let blob: Blob;
      if (r.kind === "video") {
        draw(r);
        await new Promise((res) => setTimeout(res, 150));
        const stopped = new Promise((res) => (r.recorder!.onstop = res));
        r.recorder!.stop();
        await stopped;
        blob = new Blob(r.chunks, { type: r.mimeType.split(";")[0] });
      } else {
        sampleGif(r);
        blob = encodeGif(r.gif, r.gifW, r.gifH);
      }
      r.canvas.remove();
      r.last?.close();
      const ext = r.kind === "gif" ? "gif" : r.mimeType.includes("mp4") ? "mp4" : "webm";
      const base = (msg.filename || `agent-recording-${new Date().toISOString().replace(/[:.]/g, "-")}`).replace(/\.(mp4|webm|gif)$/i, "");
      let url: string | undefined;
      let path: string | undefined;
      let uploadError: string | undefined;
      if (msg.server && msg.token) {
        try {
          const up = await upload(blob, msg.server, msg.token, `${base}.${ext}`);
          url = up.url;
          path = up.path;
        } catch (e) {
          uploadError = String((e as Error).message ?? e);
        }
      }
      const base64 = msg.inline && blob.size < 3_000_000 ? await blobToB64(blob) : undefined;
      return {
        ok: true, url, path, uploadError, base64, bytes: blob.size, durationMs, mimeType: blob.type, ext,
        frames: r.kind === "gif" ? r.gif.length : r.frames, objectUrl: URL.createObjectURL(blob),
      };
    }
    return { ok: false, error: `Unknown message ${msg.type}` };
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e?.message ?? e) }));
  return true;
});
