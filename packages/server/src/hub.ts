import { DurableObject } from "cloudflare:workers";
import { randomId, WS_SUBPROTOCOL, type CallToolResult, type SessionInfo } from "@agent-chrome-mcp/protocol";
import type { Env } from "./env";

interface SocketAttachment {
  deviceId: string;
  name: string;
  email?: string;
  version?: string;
  connectedAt: number;
}

interface Pending {
  resolve: (r: CallToolResult) => void;
  reject: (e: Error) => void;
  deviceId: string;
  timer: ReturnType<typeof setTimeout>;
}

export interface OnlineDevice {
  deviceId: string;
  name: string;
  email?: string;
  version?: string;
  connectedAt: number;
}

/** One instance per account. Holds the WebSockets of every paired Chrome profile and relays tool calls to them. */
export class AccountHub extends DurableObject<Env> {
  private pending = new Map<string, Pending>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keepalive pings are answered without waking the object from hibernation.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const deviceId = request.headers.get("x-device-id")!;
    const name = request.headers.get("x-device-name") ?? "Chrome";
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // A profile that reconnects replaces its previous socket.
    for (const old of this.ctx.getWebSockets(deviceId)) {
      try {
        old.close(4000, "replaced by a newer connection");
      } catch {}
    }
    this.ctx.acceptWebSocket(server, [deviceId]);
    server.serializeAttachment({ deviceId, name, connectedAt: Date.now() } satisfies SocketAttachment);
    server.send(JSON.stringify({ t: "welcome", deviceId, deviceName: name }));
    return new Response(null, { status: 101, webSocket: client, headers: { "sec-websocket-protocol": WS_SUBPROTOCOL } });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let msg: any;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as SocketAttachment;
    if (msg.t === "hello") {
      const next: SocketAttachment = {
        ...att,
        name: String(msg.name || att.name).slice(0, 80),
        email: msg.email ? String(msg.email).slice(0, 200) : undefined,
        version: msg.version ? String(msg.version).slice(0, 20) : undefined,
      };
      ws.serializeAttachment(next);
      await this.env.DB.prepare("UPDATE devices SET name = ?, email = ?, version = ?, last_seen_at = ? WHERE id = ?")
        .bind(next.name, next.email ?? null, next.version ?? null, Date.now(), att.deviceId)
        .run();
    } else if (msg.t === "result") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      p.resolve(msg.result as CallToolResult);
    } else if (msg.t === "ping") {
      ws.send('{"t":"pong"}');
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    this.dropSocket(ws, `Browser disconnected (code ${code}).`);
  }

  async webSocketError(ws: WebSocket) {
    this.dropSocket(ws, "Browser connection failed.");
  }

  private dropSocket(ws: WebSocket, reason: string) {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att) return;
    if (this.ctx.getWebSockets(att.deviceId).some((s) => s !== ws && s.readyState === WebSocket.OPEN)) return;
    for (const [id, p] of this.pending) {
      if (p.deviceId === att.deviceId) {
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.reject(new Error(reason));
      }
    }
  }

  private sockets(): { ws: WebSocket; att: SocketAttachment }[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === WebSocket.OPEN)
      .map((ws) => ({ ws, att: ws.deserializeAttachment() as SocketAttachment }))
      .filter((s) => s.att);
  }

  async online(): Promise<OnlineDevice[]> {
    return this.sockets().map(({ att }) => ({ ...att }));
  }

  async selectBrowser(sessionId: string, deviceId: string) {
    await this.ctx.storage.put(`sel:${sessionId}`, deviceId);
  }

  async disconnect(deviceId: string) {
    for (const ws of this.ctx.getWebSockets(deviceId)) ws.close(4001, "device revoked");
  }

  /** Pick a browser: explicit selector (id/name/email) > session selection > most recently connected. */
  private async pick(selector: string | undefined, sessionId: string) {
    const live = this.sockets().sort((a, b) => b.att.connectedAt - a.att.connectedAt);
    if (live.length === 0) {
      throw new Error(
        "No browser is connected. Open Chrome with the Agent Chrome MCP extension installed and paired (click the toolbar icon to check it says Connected).",
      );
    }
    const match = (s: string) => {
      const q = s.toLowerCase();
      return (
        live.find((x) => x.att.deviceId === s) ??
        live.find((x) => x.att.name.toLowerCase() === q || x.att.email?.toLowerCase() === q) ??
        live.find((x) => x.att.name.toLowerCase().includes(q) || x.att.email?.toLowerCase().includes(q))
      );
    };
    if (selector) {
      const m = match(selector);
      if (!m) throw new Error(`Browser "${selector}" is not connected. Online: ${live.map((l) => `${l.att.name} (${l.att.deviceId})`).join(", ")}`);
      return m;
    }
    const sel = await this.ctx.storage.get<string>(`sel:${sessionId}`);
    if (sel) {
      const m = live.find((x) => x.att.deviceId === sel);
      if (m) return m;
    }
    return live[0]!;
  }

  async call(tool: string, args: Record<string, unknown>, session: SessionInfo, timeoutMs: number): Promise<CallToolResult> {
    const browser = typeof args.browser === "string" && args.browser ? args.browser : undefined;
    const target = await this.pick(browser, session.id);
    const id = randomId(9);
    const { browser: _omit, ...rest } = args;
    return new Promise<CallToolResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        try {
          target.ws.send(JSON.stringify({ t: "cancel", id }));
        } catch {}
        reject(new Error(`The browser did not answer within ${Math.round(timeoutMs / 1000)}s.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, deviceId: target.att.deviceId, timer });
      target.ws.send(JSON.stringify({ t: "call", id, tool, args: rest, session }));
    });
  }
}
