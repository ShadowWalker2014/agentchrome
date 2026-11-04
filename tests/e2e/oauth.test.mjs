// OAuth 2.1: discovery, dynamic client registration, authorize page with account key, PKCE token exchange, MCP call, refresh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { SERVER, signup } from "./harness.mjs";

const b64u = (b) => Buffer.from(b).toString("base64url");

test("OAuth flow issues tokens that work on /mcp", async () => {
  const acct = await signup();
  const unauth = await fetch(`${SERVER}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(unauth.status, 401);
  const prm = await (await fetch(`${SERVER}/.well-known/oauth-protected-resource/mcp`)).json();
  const as = await (await fetch(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json();
  assert.ok(as.registration_endpoint && as.authorization_endpoint && as.token_endpoint);
  assert.ok(as.code_challenge_methods_supported.includes("S256"));

  const redirect = "http://127.0.0.1:33418/callback";
  const reg = await (await fetch(as.registration_endpoint, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "E2E OAuth Client", redirect_uris: [redirect], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  })).json();
  assert.ok(reg.client_id);

  const verifier = b64u(randomBytes(32));
  const challenge = b64u(createHash("sha256").update(verifier).digest());
  const authUrl = new URL(as.authorization_endpoint);
  Object.entries({ response_type: "code", client_id: reg.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256", state: "xyz", scope: "browser", resource: `${SERVER}/mcp` }).forEach(([k, v]) => authUrl.searchParams.set(k, v));

  const page = await fetch(authUrl);
  const html = await page.text();
  assert.match(html, /Connect E2E OAuth Client/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");

  const bad = await fetch(authUrl, { method: "POST", body: new URLSearchParams({ api_key: "acm_sk_wrong", decision: "allow" }), redirect: "manual" });
  assert.match(await bad.text(), /not valid/);

  const ok = await fetch(authUrl, { method: "POST", body: new URLSearchParams({ api_key: acct.apiKey, decision: "allow" }), redirect: "manual" });
  assert.equal(ok.status, 302);
  const loc = new URL(ok.headers.get("location"));
  assert.equal(loc.searchParams.get("state"), "xyz");
  const code = loc.searchParams.get("code");

  const tok = await (await fetch(as.token_endpoint, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: reg.client_id, code_verifier: verifier, resource: `${SERVER}/mcp` }),
  })).json();
  assert.ok(tok.access_token, JSON.stringify(tok));
  assert.ok(tok.refresh_token);

  const init = await fetch(`${SERVER}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "oauth-e2e", version: "1" } } }),
  });
  assert.equal(init.status, 200);
  const sid = init.headers.get("mcp-session-id");
  const lb = await (await fetch(`${SERVER}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json", "mcp-session-id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_browsers", arguments: {} } }),
  })).json();
  assert.match(lb.result.content[0].text, /No Chrome profiles are paired/);

  const refreshed = await (await fetch(as.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }) })).json();
  assert.ok(refreshed.access_token);

  const denied = await fetch(authUrl, { method: "POST", body: new URLSearchParams({ decision: "deny" }), redirect: "manual" });
  assert.equal(new URL(denied.headers.get("location")).searchParams.get("error"), "access_denied");
});

test("session ids are bound to the account", async () => {
  const a = await signup();
  const b = await signup();
  const h = (k, extra = {}) => ({ authorization: `Bearer ${k}`, "content-type": "application/json", ...extra });
  const init = await fetch(`${SERVER}/mcp`, { method: "POST", headers: h(a.apiKey), body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } }) });
  const sid = init.headers.get("mcp-session-id");
  const cross = await fetch(`${SERVER}/mcp`, { method: "POST", headers: h(b.apiKey, { "mcp-session-id": sid }), body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) });
  assert.equal(cross.status, 404);
});
