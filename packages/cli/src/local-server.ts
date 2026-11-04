// Local "studio" server: the same MCP + extension relay as the Cloudflare Worker, on 127.0.0.1.
// Nothing leaves the machine; recordings and screenshots are written to ~/.agent-chrome-mcp/artifacts.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, createWriteStream } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { WebSocketServer, type WebSocket } from "ws";
import {
  handleMcpRequest,
  SERVER_INSTRUCTIONS,
  TOOL_BY_NAME,
  WS_SUBPROTOCOL,
  WS_TOKEN_PREFIX,
  type CallToolResult,
  type SessionInfo,
} from "@agent-chrome-mcp/protocol";

export const LOCAL_PORT = 47823;
export const HOME_DIR = process.env.ACM_HOME ?? join(homedir(), ".agent-chrome-mcp");
const STATE = join(HOME_DIR, "local.json");
const ARTIFACTS = join(HOME_DIR, "artifacts");

interface LocalState {
  apiKeyHash: string;
  secret: string;
  devices: { id: string; tokenHash: string; name: string; createdAt: number }[];
  codes: { hash: string; expiresAt: number }[];
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const rand = (n = 32) => randomBytes(n).toString("base64url");

function loadState(): LocalState | null {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    return null;
  }
}
function saveState(s: LocalState) {
  mkdirSync(HOME_DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify(s, null, 2), { mode: 0o600 });
}

/** Create the local account on first run; returns the key only when newly created or rotated. */
export function ensureLocalAccount(rotate = false): { apiKey?: string } {
  let s = loadState();
  if (s && !rotate) return {};
  const apiKey = `acm_sk_local_${rand()}`;
  s = { apiKeyHash: sha(apiKey), secret: s?.secret ?? rand(), devices: s?.devices ?? [], codes: [] };
  saveState(s);
  return { apiKey };
}

export function localPairCode(): { code: string; expiresAt: number } {
  const s = loadState();
  if (!s) throw new Error("Run `agent-chrome-mcp setup --local` first.");
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = [...randomBytes(10)].map((b) => A[b % 32]).join("");
  const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
  const expiresAt = Date.now() + 15 * 60_000;
  s.codes = s.codes.filter((c) => c.expiresAt > Date.now());
  s.codes.push({ hash: sha(code), expiresAt });
  saveState(s);
  return { code, expiresAt };
}

const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

interface Conn {
  ws: WebSocket;
  deviceId: string;
  name: string;
  email?: string;
  connectedAt: number;
}

export function startLocalServer(port = LOCAL_PORT, log = console.log) {
  mkdirSync(ARTIFACTS, { recursive: true });
  const conns = new Map<string, Conn>();
  const pending = new Map<string, { resolve: (r: CallToolResult) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; deviceId: string }>();
  const selection = new Map<string, string>();
  const origin = `http://127.0.0.1:${port}`;

  const state = () => {
    const s = loadState();
    if (!s) throw new Error("No local account. Run `agent-chrome-mcp setup --local`.");
    return s;
  };

  const authKey = (req: IncomingMessage) => {
    const t = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    return t ? eq(sha(t), state().apiKeyHash) : false;
  };
  const authDevice = (token: string) => state().devices.find((d) => eq(d.tokenHash, sha(token)));

  function pick(selector: string | undefined, sessionId: string): Conn {
    const live = [...conns.values()].sort((a, b) => b.connectedAt - a.connectedAt);
    if (!live.length) throw new Error("No browser is connected. Open Chrome with the Agent Chrome MCP extension paired to this local server.");
    if (selector) {
      const q = selector.toLowerCase();
      const m = live.find((c) => c.deviceId === selector) ?? live.find((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
      if (!m) throw new Error(`Browser "${selector}" is not connected.`);
      return m;
    }
    const sel = selection.get(sessionId);
    return live.find((c) => c.deviceId === sel) ?? live[0]!;
  }

  async function callTool(name: string, args: Record<string, unknown>, session: SessionInfo): Promise<CallToolResult> {
    const def = TOOL_BY_NAME.get(name)!;
    if (name === "list_browsers") {
      const s = state();
      const list = s.devices.map((d) => ({ id: d.id, name: conns.get(d.id)?.name ?? d.name, email: conns.get(d.id)?.email, online: conns.has(d.id) }));
      return { content: [{ type: "text", text: list.length ? JSON.stringify(list, null, 2) : "No browsers paired. Run `agent-chrome-mcp pair --local`." }] };
    }
    if (name === "pairing_code") {
      const { code, expiresAt } = localPairCode();
      return {
        content: [
          {
            type: "text",
            text: `Pairing code: ${code} (single use, valid until ${new Date(expiresAt).toISOString()}).\nIn the Agent Chrome extension popup, set Server to ${origin}, paste the code and press Connect.`,
          },
        ],
      };
    }
    if (name === "select_browser") {
      const c = pick(String(args.browser), session.id);
      selection.set(session.id, c.deviceId);
      return { content: [{ type: "text", text: `This session now uses ${c.name} (${c.deviceId}).` }] };
    }
    const target = pick(typeof args.browser === "string" ? args.browser : undefined, session.id);
    const { browser: _b, ...rest } = args;
    const id = rand(9);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        target.ws.send(JSON.stringify({ t: "cancel", id }));
        reject(new Error(`The browser did not answer within ${Math.round((def.timeoutMs ?? 45_000) / 1000)}s.`));
      }, def.timeoutMs ?? 45_000);
      pending.set(id, { resolve, reject, timer, deviceId: target.deviceId });
      target.ws.send(JSON.stringify({ t: "call", id, tool: name, args: rest, session }));
    });
  }

  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };

  const readBody = async (req: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", origin);
      // Browsers may only reach us from the extension; this blocks DNS-rebinding and drive-by pages.
      const o = req.headers.origin;
      if (o && !o.startsWith("chrome-extension://") && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o)) return send(res, 403, { error: "origin not allowed" });
      if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) return send(res, 403, { error: "host not allowed" });

      if (url.pathname === "/health") return send(res, 200, { ok: true, mode: "local", browsers: conns.size });
      if (url.pathname === "/api/info") return send(res, 200, { name: "agent-chrome-mcp", mode: "local", mcpUrl: `${origin}/mcp` });

      if (url.pathname === "/mcp") {
        if (!authKey(req)) return send(res, 401, { error: "unauthorized" }, { "www-authenticate": 'Bearer realm="agent-chrome-mcp"' });
        const body = req.method === "POST" ? await readBody(req) : undefined;
        const request = new Request(`${origin}${req.url}`, {
          method: req.method,
          headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === "string") as [string, string][]),
          body: body && body.length ? body : undefined,
        });
        const response = await handleMcpRequest(request, {
          principal: "local",
          secret: state().secret,
          serverName: "agent-chrome-mcp",
          serverVersion: "local",
          instructions: SERVER_INSTRUCTIONS,
          callTool,
        });
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
        return;
      }

      if (url.pathname === "/api/pair/new" && req.method === "POST") {
        if (!authKey(req)) return send(res, 401, { error: "unauthorized" });
        const { code, expiresAt } = localPairCode();
        return send(res, 200, { code, expiresAt: new Date(expiresAt).toISOString() });
      }
      if (url.pathname === "/api/pair/redeem" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        const s = state();
        const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{5})(.{5})$/, "$1-$2");
        const idx = s.codes.findIndex((c) => c.hash === sha(code) && c.expiresAt > Date.now());
        if (idx < 0) return send(res, 400, { error: "That pairing code is wrong or expired. Run `agent-chrome-mcp pair --local`." });
        s.codes.splice(idx, 1);
        const deviceToken = `acm_dt_${rand()}`;
        const deviceId = `dev_${rand(9)}`;
        s.devices.push({ id: deviceId, tokenHash: sha(deviceToken), name: String(body.name ?? "Chrome").slice(0, 80), createdAt: Date.now() });
        saveState(s);
        return send(res, 200, { deviceId, deviceToken, accountId: "local", server: origin });
      }
      if (url.pathname === "/api/me") {
        if (!authKey(req)) return send(res, 401, { error: "unauthorized" });
        const s = state();
        return send(res, 200, { accountId: "local", mcpUrl: `${origin}/mcp`, devices: s.devices.map((d) => ({ id: d.id, name: d.name, online: conns.has(d.id) })) });
      }
      if (url.pathname.startsWith("/api/devices/") && req.method === "DELETE") {
        if (!authKey(req)) return send(res, 401, { error: "unauthorized" });
        const id = decodeURIComponent(url.pathname.split("/")[3] ?? "");
        const s = state();
        const before = s.devices.length;
        s.devices = s.devices.filter((d) => d.id !== id);
        saveState(s);
        conns.get(id)?.ws.close(4001, "device revoked");
        conns.delete(id);
        return send(res, 200, { revoked: s.devices.length < before });
      }
      if (url.pathname === "/api/devices/rename" && req.method === "POST") {
        const t = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
        const dev = authDevice(t);
        if (!dev) return send(res, 401, { error: "unauthorized" });
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        const s = state();
        const d = s.devices.find((x) => x.id === dev.id);
        if (d) d.name = String(body.name ?? d.name).slice(0, 80);
        saveState(s);
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/artifacts" && req.method === "POST") {
        const t = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
        if (!authDevice(t) && !authKey(req)) return send(res, 401, { error: "unauthorized" });
        const name = (url.searchParams.get("name") || "artifact.bin").replace(/[^\w.\-]+/g, "_").slice(0, 120);
        const id = rand(9);
        const path = join(ARTIFACTS, `${id}-${name}`);
        await pipeline(req, createWriteStream(path));
        writeFileSync(`${path}.type`, String(req.headers["content-type"] ?? "application/octet-stream"));
        return send(res, 200, { id, path, url: `${origin}/a/${id}/${name}` });
      }
      if (url.pathname.startsWith("/a/")) {
        const [, , id, name] = url.pathname.split("/");
        const path = join(ARTIFACTS, `${id}-${decodeURIComponent(name ?? "")}`);
        if (!id || !existsSync(path)) return send(res, 404, { error: "not found" });
        const type = existsSync(`${path}.type`) ? readFileSync(`${path}.type`, "utf8") : "application/octet-stream";
        res.writeHead(200, { "content-length": statSync(path).size, "content-type": type });
        createReadStream(path).pipe(res);
        return;
      }
      send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 500, { error: String((e as Error).message ?? e) });
    }
  });

  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false),
  });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", origin);
    const protos = String(req.headers["sec-websocket-protocol"] ?? "").split(",").map((p) => p.trim());
    const tok = protos.find((p) => p.startsWith(WS_TOKEN_PREFIX));
    const dev = url.pathname === "/ws" && tok ? authDevice(tok.slice(WS_TOKEN_PREFIX.length)) : undefined;
    if (!dev) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      conns.get(dev.id)?.ws.close(4000, "replaced");
      const conn: Conn = { ws, deviceId: dev.id, name: dev.name, connectedAt: Date.now() };
      conns.set(dev.id, conn);
      log(`browser connected: ${dev.name} (${dev.id})`);
      ws.send(JSON.stringify({ t: "welcome", deviceId: dev.id, deviceName: dev.name }));
      ws.on("message", (data) => {
        let msg: any;
        try {
          msg = JSON.parse(String(data));
        } catch {
          return;
        }
        if (msg.t === "ping") ws.send('{"t":"pong"}');
        else if (msg.t === "hello") {
          conn.name = String(msg.name ?? conn.name);
          conn.email = msg.email;
        } else if (msg.t === "result") {
          const p = pending.get(msg.id);
          if (p) {
            clearTimeout(p.timer);
            pending.delete(msg.id);
            p.resolve(msg.result);
          }
        }
      });
      ws.on("close", () => {
        if (conns.get(dev.id)?.ws === ws) conns.delete(dev.id);
        for (const [id, p] of pending) {
          if (p.deviceId === dev.id) {
            clearTimeout(p.timer);
            pending.delete(id);
            p.reject(new Error("Browser disconnected."));
          }
        }
        log(`browser disconnected: ${conn.name}`);
      });
    });
  });

  return new Promise<{ close: () => void; url: string }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ close: () => server.close(), url: origin }));
  });
}
