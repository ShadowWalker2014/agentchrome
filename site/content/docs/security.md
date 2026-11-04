---
title: Agent Chrome Security and Privacy Model Explained
description: How Agent Chrome protects your browser: hashed keys, single-use pairing codes, per-profile revocation, OAuth 2.1, what is stored, and the limits you accept.
slug: docs/security
type: docs
nav: Security
updated: 2026-11-04
---

# Agent Chrome Security and Privacy Model Explained

Agent Chrome stores only hashes of your keys and tokens, pairs a browser only with a single-use code, and does not store page contents on its server. An agent that controls your signed-in browser can still do what you can, so you also get visible controls to watch and stop it.

## Keys and pairing

- **Keys:** account keys (`acm_sk_`) and device tokens (`acm_dt_`) are 256-bit random values. The server stores only their SHA-256 hashes. The local config file is `chmod 600`.
- **Pairing:** a browser joins your account only with a single-use 10-character code that expires after 15 minutes, created by someone who already holds the account key.
- **Per-profile revocation:** each Chrome profile gets its own device token. `agentchrome revoke <browser-id>` removes one profile, and it disconnects immediately.
- **Rotation:** `agentchrome rotate-key` replaces your account key and rewrites every agent config.

## Sign-in and isolation

- **OAuth 2.1** with PKCE (S256), dynamic client registration, refresh-token rotation and RFC 9728 discovery, using `@cloudflare/workers-oauth-provider`.
- **Account isolation:** each account has its own Durable Object. MCP session ids are signed with HMAC and bound to the account, so one account cannot use another's session.
- **Rate limits:** sign-up, pairing and the sign-in page are rate-limited per IP address.

## What the server stores

| Data | Why | How long |
|---|---|---|
| Account ID and a hash of each account key | Sign-in | Until you delete your account |
| Connected browsers: profile name, extension version, last online, and the Google account email if you allow Chrome to share it | Route actions to the right browser | Until you remove the browser or delete your account |
| Connected apps: app name, redirect address, hashed tokens | Let apps reach your browsers | Access tokens 1 hour, refresh tokens up to 90 days |
| Screenshots and recordings an agent explicitly saves | Download links | Deleted after 7 days |
| Request logs: time, path, status, response time, IP address | Security and debugging | Up to 30 days |
| One sign-in cookie | Stay signed in on agentchrome.dev | 30 days |

Saved files sit in R2 behind unguessable 144-bit links. The server does not store page contents, screenshots or typed text apart from files an agent explicitly saves. It does not collect passwords, payment details or browsing history. The full text is in the privacy policy at https://agentchrome.dev/privacy.

## Controls in your browser

- A pulsing blue border and a status pill with a **Stop** button show when an agent is at work.
- The popup pauses any agent or stops all of them.
- Optional settings ask before each new site and keep a block list.
- History access is off by default.
- Pressing Cancel on Chrome's "started debugging this browser" bar stops every agent.

## Prompt injection and other limits

- Web pages are untrusted. The skill and the server instructions tell agents never to follow instructions found inside web pages. That reduces the risk but cannot remove it.
- An agent with your logged-in browser can do what you can. Ask it to confirm before it buys, sends or deletes anything.
- Use a separate Chrome profile for sensitive accounts and pair only the profiles you need.
- Chrome shows a debugging bar while the extension is attached. Do not hide it.
- If you want no cloud at all, use [local mode](/docs/local-mode), where the server listens only on `127.0.0.1:47823` and rejects requests from web pages. Or [self-host](/docs/self-host).

Report vulnerabilities through a private GitHub security advisory at https://github.com/ShadowWalker2014/agentchrome/security/advisories/new.

## Related pages

- [Docs overview](/docs)
- [Local mode](/docs/local-mode)
- [Self-host on Cloudflare](/docs/self-host)
- [Multiple Chrome profiles](/docs/multiple-chrome-profiles)
- [Let an AI agent work on logged-in sites](/use-cases/logged-in-websites)

## Frequently asked questions

### Is Agent Chrome safe to use with my logged-in accounts?
It has several protections: hashed keys, single-use pairing, per-profile revocation and visible Stop controls. The remaining risk is that an agent can do what you can, and pages can try to inject instructions. Review sensitive actions and use a separate profile for high-risk accounts.

### Does Agent Chrome store my passwords or page contents?
No. The server relays tool calls and results but does not store page contents, screenshots or typed text, except files an agent explicitly saves. Those are deleted after 7 days. It does not collect passwords or payment details.

### Who can see what the agent sees?
The app that made the request, such as Claude, ChatGPT or a coding agent, receives what its agent reads from your browser, and its own privacy policy applies. Cloudflare hosts the service. The privacy policy says Circo does not sell personal data or use it to train AI models.

### How do I revoke access?
Run `agentchrome revoke <browser-id>` to remove one Chrome profile, or `agentchrome rotate-key` to replace your account key. You can also press Disconnect in the extension. To delete your account, email privacy@agentchrome.dev.

### What is prompt injection and does Agent Chrome stop it?
Prompt injection is text on a web page written to trick an agent into following it. Agent Chrome tells agents not to follow instructions found in pages, but no tool can fully stop it. Keep a person in the loop for irreversible actions.
