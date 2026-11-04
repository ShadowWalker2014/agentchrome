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

test("connector sign-in works in a real browser: existing key and new account", async () => {
  const { chromium } = await import("playwright");
  const { createServer } = await import("node:http");
  const hits = [];
  const cb = createServer((req, res) => { hits.push(req.url); res.end("ok"); });
  await new Promise((r) => cb.listen(0, "127.0.0.1", r));
  const redirect = `http://127.0.0.1:${cb.address().port}/callback`;
  const as = await (await fetch(`${SERVER}/.well-known/oauth-authorization-server`)).json();
  const root = await fetch(`${SERVER}/.well-known/oauth-protected-resource`);
  assert.equal(root.status, 200);
  const reg = await (await fetch(as.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [redirect], token_endpoint_auth_method: "none" }) })).json();
  const authUrl = () => {
    const u = new URL(as.authorization_endpoint);
    const challenge = b64u(createHash("sha256").update("v".repeat(43)).digest());
    Object.entries({ response_type: "code", client_id: reg.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256", state: "s1", resource: `${SERVER}/mcp` }).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // existing key
    const acct = await signup();
    await page.goto(authUrl());
    await page.fill("#key", acct.apiKey);
    await Promise.all([page.waitForURL(/\/callback\?/), page.click("button[value=allow]")]);
    assert.match(page.url(), /[?&]code=[^&]+/);
    assert.match(page.url(), /[?&]state=s1/);
    // signed in now: the page offers to continue as this account
    await page.goto(authUrl());
    await page.waitForSelector("text=Signed in as");
    // brand-new account from the sign-in page, in a fresh browser
    await page.context().clearCookies();
    await page.goto(authUrl());
    await page.click("button[value=create]");
    const key = await page.textContent("#k");
    assert.match(key, /^acm_sk_/);
    await Promise.all([page.waitForURL(/\/callback\?/), page.click("button[value=allow]")]);
    assert.match(page.url(), /code=/);
    const me = await (await fetch(`${SERVER}/api/me`, { headers: { authorization: `Bearer ${key}` } })).json();
    assert.ok(me.accountId);
  } finally {
    await browser.close();
    cb.close();
  }
});

test("pairing_code tool returns a working code", async () => {
  const acct = await signup();
  const h = { authorization: `Bearer ${acct.apiKey}`, "content-type": "application/json" };
  const init = await fetch(`${SERVER}/mcp`, { method: "POST", headers: h, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "chatgpt", version: "1" } } }) });
  const sid = init.headers.get("mcp-session-id");
  const r = await (await fetch(`${SERVER}/mcp`, { method: "POST", headers: { ...h, "mcp-session-id": sid }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "pairing_code", arguments: {} } }) })).json();
  const code = r.result.content[0].text.match(/Pairing code: ([A-Z0-9]{5}-[A-Z0-9]{5})/)[1];
  const redeem = await fetch(`${SERVER}/api/pair/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: "From chat" }) });
  assert.equal(redeem.status, 200);
  const tools = await (await fetch(`${SERVER}/mcp`, { method: "POST", headers: { ...h, "mcp-session-id": sid }, body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }) })).json();
  for (const t of tools.result.tools) assert.equal(typeof t.annotations?.readOnlyHint, "boolean", t.name);
});

test("chat apps (ChatGPT, Claude) get one tool per action; coding agents get full parity", async () => {
  const acct = await signup();
  const as = await (await fetch(`${SERVER}/.well-known/oauth-authorization-server`)).json();
  const toolsFor = async (clientName) => {
    const redirect = "https://chatgpt.com/connector_platform_oauth_redirect";
    const reg = await (await fetch(as.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: clientName, redirect_uris: [redirect], token_endpoint_auth_method: "none" }) })).json();
    const verifier = b64u(randomBytes(32));
    const u = new URL(as.authorization_endpoint);
    Object.entries({ response_type: "code", client_id: reg.client_id, redirect_uri: redirect, code_challenge: b64u(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", state: "x", resource: `${SERVER}/mcp` }).forEach(([k, v]) => u.searchParams.set(k, v));
    const res = await fetch(u, { method: "POST", body: new URLSearchParams({ api_key: acct.apiKey, decision: "allow" }), redirect: "manual" });
    const loc = new URL(res.headers.get("location"));
    assert.ok(loc.searchParams.get("iss"), "RFC 9207 iss parameter");
    const tok = await (await fetch(as.token_endpoint, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code: loc.searchParams.get("code"), redirect_uri: redirect, client_id: reg.client_id, code_verifier: verifier, resource: `${SERVER}/mcp` }) })).json();
    const r = await (await fetch(`${SERVER}/mcp`, { method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) })).json();
    return r.result.tools;
  };
  const chat = await toolsFor("ChatGPT");
  const names = chat.map((t) => t.name);
  for (const n of ["click", "type_text", "press_key", "scroll", "hover", "drag", "navigate", "screenshot", "read_page", "pairing_code"]) assert.ok(names.includes(n), `chat missing ${n}`);
  for (const n of ["computer", "javascript_tool", "history_search", "tab_groups"]) assert.ok(!names.includes(n), `chat should not have ${n}`);
  for (const t of chat) {
    for (const h of ["readOnlyHint", "destructiveHint", "openWorldHint"]) assert.equal(typeof t.annotations[h], "boolean", `${t.name}.${h}`);
    assert.ok(t.title && t.description, t.name);
    assert.ok(t.name.length <= 64);
  }
  assert.equal(chat.find((t) => t.name === "click").annotations.destructiveHint, true);
  assert.equal(chat.find((t) => t.name === "read_page").annotations.readOnlyHint, true);
  const agent = (await toolsFor("Claude Code")).map((t) => t.name);
  assert.ok(agent.includes("computer") && agent.includes("javascript_tool") && !agent.includes("click"));
});
