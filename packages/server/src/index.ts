import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import {
  handleMcpRequest,
  randomId,
  SERVER_INSTRUCTIONS,
  TOOL_BY_NAME,
  WS_SUBPROTOCOL,
  WS_TOKEN_PREFIX,
  type CallToolResult,
  type SessionInfo,
} from "@agent-chrome-mcp/protocol";
import {
  authenticate,
  createAccount,
  createApiKey,
  createPairCode,
  listDevices,
  redeemPairCode,
  verifyApiKey,
  verifyDeviceToken,
  type Principal,
} from "./auth";
import type { Env } from "./env";
import { authorizePage, page } from "./pages";

export { AccountHub } from "./hub";

const VERSION = "0.1.0";
const ARTIFACT_TTL_MS = 7 * 24 * 3600_000;
const MAX_ARTIFACT_BYTES = 95 * 1024 * 1024;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json", ...headers } });
const err = (status: number, message: string) => json({ error: message }, status);

async function sessionSecret(env: Env): Promise<string> {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  // Zero-config self-hosting: mint a secret once and keep it in KV.
  let s = await env.OAUTH_KV.get("config:session_secret");
  if (!s) {
    s = randomId(32);
    await env.OAUTH_KV.put("config:session_secret", s);
  }
  return s;
}

const hubFor = (env: Env, accountId: string) => env.HUB.get(env.HUB.idFromName(accountId));

async function limited(limiter: RateLimit | undefined, key: string) {
  if (!limiter) return false;
  const { success } = await limiter.limit({ key });
  return !success;
}

// ---------- MCP endpoint ----------

async function serverTool(env: Env, accountId: string, name: string, args: Record<string, unknown>, session: SessionInfo): Promise<CallToolResult> {
  const hub = hubFor(env, accountId);
  if (name === "list_browsers") {
    const [devices, online] = await Promise.all([listDevices(env, accountId), hub.online()]);
    const onlineIds = new Set(online.map((o) => o.deviceId));
    const lines = devices.map((d) => {
      const live = online.find((o) => o.deviceId === d.id);
      return {
        id: d.id,
        name: live?.name ?? d.name,
        email: live?.email ?? d.email,
        online: onlineIds.has(d.id),
        extensionVersion: live?.version ?? d.version,
        lastSeen: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
      };
    });
    const text =
      lines.length === 0
        ? "No Chrome profiles are paired yet. Install the extension, then run `agent-chrome-mcp pair` and enter the code in the extension popup."
        : JSON.stringify(lines, null, 2);
    return { content: [{ type: "text", text }], structuredContent: { browsers: lines } };
  }
  if (name === "select_browser") {
    const sel = String(args.browser ?? "");
    const online = await hub.online();
    const q = sel.toLowerCase();
    const m =
      online.find((o) => o.deviceId === sel) ??
      online.find((o) => o.name.toLowerCase() === q || o.email?.toLowerCase() === q) ??
      online.find((o) => o.name.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q));
    if (!m) return { content: [{ type: "text", text: `No connected browser matches "${sel}".` }], isError: true };
    await hub.selectBrowser(session.id, m.deviceId);
    return { content: [{ type: "text", text: `This session now uses ${m.name} (${m.deviceId}).` }] };
  }
  throw new Error(`Unknown server tool ${name}`);
}

const mcpApi: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const props = (ctx as any).props as Principal;
    if (!props?.accountId) return err(401, "unauthorized");
    return handleMcpRequest(request, {
      principal: props.accountId,
      secret: await sessionSecret(env),
      serverName: "agent-chrome-mcp",
      serverVersion: VERSION,
      instructions: SERVER_INSTRUCTIONS,
      async callTool(name, args, session) {
        const def = TOOL_BY_NAME.get(name)!;
        if (def.server) return serverTool(env, props.accountId, name, args, session);
        return hubFor(env, props.accountId).call(name, args, session, def.timeoutMs ?? 45_000);
      },
    });
  },
};

// ---------- everything else ----------

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId);
  if (!client) return page("Error", `<h1>Unknown app</h1><p>This client is not registered.</p>`);
  const clientName = client.clientName || "An MCP client";
  const redirectHost = (() => {
    try {
      return new URL(oauthReq.redirectUri).host;
    } catch {
      return oauthReq.redirectUri;
    }
  })();
  if (request.method === "GET") return authorizePage(clientName, redirectHost);

  const form = await request.formData();
  if (form.get("decision") !== "allow") {
    const u = new URL(oauthReq.redirectUri);
    u.searchParams.set("error", "access_denied");
    if (oauthReq.state) u.searchParams.set("state", oauthReq.state);
    return Response.redirect(u.toString(), 302);
  }
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (await limited(env.PAIR_LIMITER, `auth:${ip}`)) return authorizePage(clientName, redirectHost, "Too many attempts. Wait a minute and try again.");
  const principal = await verifyApiKey(env, String(form.get("api_key") ?? "").trim());
  if (!principal) return authorizePage(clientName, redirectHost, "That account key is not valid.");
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId: principal.accountId,
    metadata: { client: clientName },
    scope: oauthReq.scope,
    props: { accountId: principal.accountId, via: "oauth" } satisfies Principal,
  });
  return Response.redirect(redirectTo, 302);
}

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return err(426, "Expected a WebSocket upgrade");
  const protocols = (request.headers.get("sec-websocket-protocol") ?? "").split(",").map((p) => p.trim());
  const tokenProto = protocols.find((p) => p.startsWith(WS_TOKEN_PREFIX));
  if (!protocols.includes(WS_SUBPROTOCOL) || !tokenProto) return err(400, "Missing subprotocol");
  const device = await verifyDeviceToken(env, tokenProto.slice(WS_TOKEN_PREFIX.length));
  if (!device) return err(401, "Device token is invalid or revoked. Pair this browser again.");
  const headers = new Headers(request.headers);
  headers.set("x-device-id", device.id);
  headers.set("x-device-name", device.name);
  return hubFor(env, device.account_id).fetch(new Request(request.url, { headers }));
}

async function handleArtifactUpload(request: Request, env: Env, origin: string): Promise<Response> {
  const p = await authenticate(env, request);
  if (!p) return err(401, "unauthorized");
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "artifact.bin").replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_ARTIFACT_BYTES) return err(413, "Artifact too large");
  const id = randomId(18);
  const expiresAt = Date.now() + ARTIFACT_TTL_MS;
  await env.ARTIFACTS.put(`a/${id}`, request.body, {
    httpMetadata: { contentType: request.headers.get("content-type") ?? "application/octet-stream", contentDisposition: `inline; filename="${name}"` },
    customMetadata: { accountId: p.accountId, name, expiresAt: String(expiresAt) },
  });
  return json({ id, url: `${origin}/a/${id}/${encodeURIComponent(name)}`, expiresAt: new Date(expiresAt).toISOString() });
}

async function handleArtifactGet(id: string, env: Env): Promise<Response> {
  const obj = await env.ARTIFACTS.get(`a/${id}`);
  if (!obj) return err(404, "Not found or expired");
  if (Number(obj.customMetadata?.expiresAt ?? 0) < Date.now()) return err(410, "Expired");
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  return new Response(obj.body, { headers });
}

const app: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

    if (path === "/authorize") return handleAuthorize(request, env);
    if (path === "/ws") return handleWebSocket(request, env);
    if (path === "/health") return json({ ok: true, version: VERSION });

    if (path === "/api/info") {
      return json({ name: "agent-chrome-mcp", version: VERSION, mcpUrl: `${origin}/mcp`, signup: env.SIGNUP_MODE === "closed" ? "closed" : "open" });
    }

    if (path === "/api/signup" && request.method === "POST") {
      if (env.SIGNUP_MODE === "closed" && request.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
        return err(403, "Sign-up is closed on this server. Ask the admin for an account key.");
      }
      if (await limited(env.SIGNUP_LIMITER, `signup:${ip}`)) return err(429, "Too many sign-ups from this address. Try again later.");
      const acct = await createAccount(env, "cli");
      return json({ accountId: acct.accountId, apiKey: acct.apiKey, mcpUrl: `${origin}/mcp` }, 201);
    }

    if (path === "/api/pair/redeem" && request.method === "POST") {
      if (await limited(env.PAIR_LIMITER, `pair:${ip}`)) return err(429, "Too many attempts. Wait a minute.");
      const body = (await request.json().catch(() => ({}))) as any;
      const r = await redeemPairCode(env, String(body.code ?? ""), String(body.name ?? "Chrome"), body.email, body.version);
      if (!r) return err(400, "That pairing code is wrong, used or expired. Run `agent-chrome-mcp pair` for a new one.");
      return json({ ...r, wsUrl: `${origin.replace(/^http/, "ws")}/ws`, server: origin });
    }

    if (path.startsWith("/a/") && request.method === "GET") return handleArtifactGet(path.split("/")[2] ?? "", env);
    if (path === "/api/artifacts" && request.method === "POST") return handleArtifactUpload(request, env, origin);

    if (path.startsWith("/api/")) {
      const p = await authenticate(env, request);
      if (!p) return err(401, "Missing or invalid credentials");

      if (path === "/api/me") {
        const [devices, online] = await Promise.all([listDevices(env, p.accountId), hubFor(env, p.accountId).online()]);
        const onlineIds = new Set(online.map((o) => o.deviceId));
        return json({
          accountId: p.accountId,
          via: p.via,
          mcpUrl: `${origin}/mcp`,
          devices: devices.map((d) => ({ ...d, online: onlineIds.has(d.id) })),
        });
      }
      if (path === "/api/pair/new" && request.method === "POST") {
        const { code, expiresAt } = await createPairCode(env, p.accountId);
        return json({ code, expiresAt: new Date(expiresAt).toISOString() });
      }
      if (path.startsWith("/api/devices/") && request.method === "DELETE") {
        if (p.via === "device") return err(403, "Use your account key to revoke devices");
        const id = decodeURIComponent(path.split("/")[3] ?? "");
        const r = await env.DB.prepare("UPDATE devices SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL")
          .bind(Date.now(), id, p.accountId)
          .run();
        await hubFor(env, p.accountId).disconnect(id);
        return json({ revoked: r.meta.changes > 0 });
      }
      if (path === "/api/devices/rename" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as any;
        await env.DB.prepare("UPDATE devices SET name = ? WHERE id = ? AND account_id = ?")
          .bind(String(body.name ?? "").slice(0, 80), String(body.id ?? p.deviceId ?? ""), p.accountId)
          .run();
        return json({ ok: true });
      }
      if (path === "/api/keys" && request.method === "POST") {
        if (p.via !== "key") return err(403, "Use your account key");
        const body = (await request.json().catch(() => ({}))) as any;
        const k = await createApiKey(env, p.accountId, String(body.label ?? "extra"));
        return json(k, 201);
      }
      if (path === "/api/keys/rotate" && request.method === "POST") {
        if (p.via !== "key") return err(403, "Use your account key");
        const k = await createApiKey(env, p.accountId, "rotated");
        await env.DB.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").bind(Date.now(), p.keyId).run();
        return json(k, 201);
      }
      return err(404, "Not found");
    }

    // Landing page, install script, CLI bundle and extension zip are static assets.
    return env.ASSETS.fetch(request);
  },
};

const providers = new Map<string, OAuthProvider<Env>>();
function providerFor(origin: string) {
  let p = providers.get(origin);
  if (!p) {
    p = new OAuthProvider<Env>({
      apiHandlers: { "/mcp": mcpApi as any },
      defaultHandler: app as any,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      scopesSupported: ["browser"],
      accessTokenTTL: 3600,
      refreshTokenTTL: 90 * 24 * 3600,
      resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin], bearer_methods_supported: ["header"], resource_name: "Agent Chrome MCP" },
      resolveExternalToken: async ({ token, env }) => {
        const principal = await verifyApiKey(env as Env, token);
        return principal ? { props: principal, audience: `${origin}/mcp` } : null;
      },
    });
    providers.set(origin, p);
  }
  return p;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return providerFor(new URL(request.url).origin).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
