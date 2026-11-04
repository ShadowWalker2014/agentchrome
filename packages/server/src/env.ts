import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { AccountHub } from "./hub";

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  ARTIFACTS: R2Bucket;
  HUB: DurableObjectNamespace<AccountHub>;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
  /** OpenAI domain-verification token served at /.well-known/openai-apps-challenge. */
  OPENAI_APPS_CHALLENGE?: string;
  /** "open" (anyone can create an account) or "closed" (only with ADMIN_TOKEN). */
  SIGNUP_MODE?: string;
  ADMIN_TOKEN?: string;
  SIGNUP_LIMITER?: RateLimit;
  PAIR_LIMITER?: RateLimit;
  OAUTH_PROVIDER: OAuthHelpers;
}
