import { b64url, randomId } from "@agentchrome/protocol";
import type { Env } from "./env";

const enc = new TextEncoder();
const now = () => Date.now();

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const newApiKey = () => `acm_sk_${b64url(crypto.getRandomValues(new Uint8Array(32)))}`;
export const newDeviceToken = () => `acm_dt_${b64url(crypto.getRandomValues(new Uint8Array(32)))}`;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function newPairCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % 32]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}
export const normalizePairCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{5})(.{5})$/, "$1-$2");

export interface Principal {
  accountId: string;
  via: "key" | "oauth" | "device";
  keyId?: string;
  deviceId?: string;
}

export async function createAccount(env: Env, label = "default") {
  const accountId = `acct_${randomId(12)}`;
  const apiKey = newApiKey();
  const keyId = `key_${randomId(9)}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO accounts (id, created_at) VALUES (?, ?)").bind(accountId, now()),
    env.DB.prepare("INSERT INTO api_keys (id, account_id, key_hash, prefix, label, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      keyId,
      accountId,
      await sha256(apiKey),
      apiKey.slice(0, 12),
      label,
      now(),
    ),
  ]);
  return { accountId, apiKey, keyId };
}

export async function createApiKey(env: Env, accountId: string, label: string) {
  const apiKey = newApiKey();
  const keyId = `key_${randomId(9)}`;
  await env.DB.prepare("INSERT INTO api_keys (id, account_id, key_hash, prefix, label, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(keyId, accountId, await sha256(apiKey), apiKey.slice(0, 12), label, now())
    .run();
  return { apiKey, keyId };
}

export async function verifyApiKey(env: Env, key: string): Promise<Principal | null> {
  if (!key.startsWith("acm_sk_")) return null;
  const row = await env.DB.prepare("SELECT id, account_id, last_used_at FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL")
    .bind(await sha256(key))
    .first<{ id: string; account_id: string; last_used_at: number | null }>();
  if (!row) return null;
  if (!row.last_used_at || now() - row.last_used_at > 60_000) {
    await env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), row.id).run();
  }
  return { accountId: row.account_id, via: "key", keyId: row.id };
}

export async function verifyDeviceToken(env: Env, token: string) {
  if (!token.startsWith("acm_dt_")) return null;
  return env.DB.prepare("SELECT id, account_id, name FROM devices WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(await sha256(token))
    .first<{ id: string; account_id: string; name: string }>();
}

/** Accepts an account API key or a device token (devices may mint pairing codes and upload artifacts). */
export async function authenticate(env: Env, request: Request): Promise<Principal | null> {
  const h = request.headers.get("authorization") ?? "";
  const token = h.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const key = await verifyApiKey(env, token);
  if (key) return key;
  const dev = await verifyDeviceToken(env, token);
  if (dev) return { accountId: dev.account_id, via: "device", deviceId: dev.id };
  return null;
}

export async function createPairCode(env: Env, accountId: string) {
  const code = newPairCode();
  const expiresAt = now() + 15 * 60_000;
  await env.DB.prepare("INSERT INTO pair_codes (code_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(code), accountId, expiresAt)
    .run();
  return { code, expiresAt };
}

export async function redeemPairCode(env: Env, rawCode: string, name: string, email?: string, version?: string) {
  const code = normalizePairCode(rawCode);
  const hash = await sha256(code);
  // Single statement claim so a code can only be used once even under races.
  const claimed = await env.DB.prepare(
    "UPDATE pair_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING account_id",
  )
    .bind(now(), hash, now())
    .first<{ account_id: string }>();
  if (!claimed) return null;
  const deviceId = `dev_${randomId(9)}`;
  const deviceToken = newDeviceToken();
  await env.DB.prepare(
    "INSERT INTO devices (id, account_id, token_hash, name, email, version, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(deviceId, claimed.account_id, await sha256(deviceToken), name.slice(0, 80) || "Chrome", email ?? null, version ?? null, now(), now())
    .run();
  return { accountId: claimed.account_id, deviceId, deviceToken };
}

export async function createDevice(env: Env, accountId: string, name: string, email?: string, version?: string) {
  const deviceId = `dev_${randomId(9)}`;
  const deviceToken = newDeviceToken();
  await env.DB.prepare(
    "INSERT INTO devices (id, account_id, token_hash, name, email, version, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(deviceId, accountId, await sha256(deviceToken), name.slice(0, 80) || "Chrome", email ?? null, version ?? null, now(), now())
    .run();
  return { accountId, deviceId, deviceToken };
}

// ---------- browser sign-in session (cookie) ----------

const SESSION_COOKIE = "__Host-acm_session";
const SESSION_DAYS = 30;

async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionCookie(secret: string, accountId: string) {
  const exp = now() + SESSION_DAYS * 86_400_000;
  const value = `${accountId}.${exp}`;
  return `${SESSION_COOKIE}=${value}.${await hmacHex(secret, value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function sessionAccount(secret: string, request: Request): Promise<string | null> {
  const raw = (request.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) return null;
  const [accountId, exp, sig] = raw.slice(SESSION_COOKIE.length + 1).split(".");
  if (!accountId || !exp || !sig || Number(exp) < now()) return null;
  return (await hmacHex(secret, `${accountId}.${exp}`)) === sig ? accountId : null;
}

// ---------- extension connect requests ----------

export async function startConnect(env: Env, cid: string, name: string) {
  const h = await sha256(cid);
  await env.DB.prepare("INSERT OR IGNORE INTO connect_requests (id_hash, name, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(h, name.slice(0, 80) || "Chrome", now(), now() + 15 * 60_000)
    .run();
}

export async function completeConnect(env: Env, cid: string, accountId: string) {
  const h = await sha256(cid);
  const row = await env.DB.prepare("SELECT name, done_at, expires_at FROM connect_requests WHERE id_hash = ?").bind(h).first<{ name: string; done_at: number | null; expires_at: number }>();
  if (!row || row.done_at || row.expires_at < now()) return null;
  const dev = await createDevice(env, accountId, row.name);
  await env.DB.prepare("UPDATE connect_requests SET account_id = ?, device_id = ?, device_token = ?, done_at = ? WHERE id_hash = ?")
    .bind(accountId, dev.deviceId, dev.deviceToken, now(), h)
    .run();
  return { ...dev, name: row.name };
}

/** One-time pickup by the extension. The token is deleted as soon as it is read. */
export async function pollConnect(env: Env, cid: string) {
  const h = await sha256(cid);
  const row = await env.DB.prepare("DELETE FROM connect_requests WHERE id_hash = ? AND device_token IS NOT NULL RETURNING account_id, device_id, device_token")
    .bind(h)
    .first<{ account_id: string; device_id: string; device_token: string }>();
  if (row) return { accountId: row.account_id, deviceId: row.device_id, deviceToken: row.device_token };
  await env.DB.prepare("DELETE FROM connect_requests WHERE expires_at < ?").bind(now()).run();
  return null;
}

export interface DeviceRow {
  id: string;
  name: string;
  email: string | null;
  version: string | null;
  created_at: number;
  last_seen_at: number | null;
}

export async function listDevices(env: Env, accountId: string): Promise<DeviceRow[]> {
  const r = await env.DB.prepare(
    "SELECT id, name, email, version, created_at, last_seen_at FROM devices WHERE account_id = ? AND revoked_at IS NULL ORDER BY created_at",
  )
    .bind(accountId)
    .all<DeviceRow>();
  return r.results;
}
