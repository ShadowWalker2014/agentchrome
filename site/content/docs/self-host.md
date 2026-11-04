---
title: Self-Host Agent Chrome on Your Own Cloudflare Account
description: Deploy your own Agent Chrome MCP server to Cloudflare Workers with one script. It creates D1, KV and R2, deploys the Worker and prints your install line.
slug: docs/self-host
type: docs
nav: Self-host
updated: 2026-11-04
---

# Self-Host Agent Chrome on Your Own Cloudflare Account

Clone the repository and run `sh scripts/deploy-cloudflare.sh my-agentchrome` to deploy your own copy of the server to Cloudflare Workers. The script prints an install line for your own domain when it finishes.

## Deploy

```sh
git clone https://github.com/ShadowWalker2014/agentchrome && cd agentchrome
pnpm install
npx wrangler login
sh scripts/deploy-cloudflare.sh my-agentchrome
```

The script:

1. Creates a D1 database, a KV namespace and an R2 bucket.
2. Runs the migrations.
3. Deploys the Worker with its Durable Object.
4. Sets a session secret.
5. Prints your own install line, for example `curl -fsSL https://my-agentchrome.<you>.workers.dev/install | sh`.

## Install against your server

```sh
curl -fsSL https://my-agentchrome.<you>.workers.dev/install | sh
```

You can also point the CLI at your server with `agentchrome setup --server URL`. If your server is not the CLI's default, the pairing step tells you to set **Server** in the extension popup to your address.

## Close sign-ups

After you create your own account, set `SIGNUP_MODE` to `"closed"` so nobody else can sign up on your server.

## Cost

According to the README, it runs comfortably on the Workers free tier for personal use. Durable Objects hibernate between calls, so an idle extension connection costs nothing.

## What runs where

| Piece | Role |
|---|---|
| Worker | Serves `/mcp`, the OAuth 2.1 provider, pairing and file APIs |
| Durable Object | One per account, holds the browser connections |
| D1 | Account and device records |
| KV | OAuth state |
| R2 | Saved screenshots and recordings, deleted after 7 days |

## Develop locally

```sh
pnpm install
pnpm --filter @agentchrome/server exec wrangler d1 migrations apply agent-chrome-mcp --local
pnpm dev:server                         # Worker on http://127.0.0.1:8787
node scripts/build-all.mjs              # extension, CLI and public assets
```

## Related pages

- [Docs overview](/docs)
- [Run fully local](/docs/local-mode)
- [Security and privacy](/docs/security)
- [Use Claude and ChatGPT connectors](/docs/claude-and-chatgpt)
- [Install Agent Chrome](/docs/install)

## Frequently asked questions

### Why self-host instead of using agentchrome.dev?
Self-hosting puts the server, the database and the saved files in your own Cloudflare account. Use it if you want to control the data location or run an internal copy for a team.

### What do I need to self-host?
You need a Cloudflare account, Node.js, pnpm and the Wrangler CLI logged in with `npx wrangler login`. The script creates the D1 database, KV namespace and R2 bucket for you.

### Can Claude.ai and ChatGPT connect to my own server?
Yes, because it is a standard remote MCP server with OAuth. Add `https://<your-server>/mcp` as a custom connector, as described in [Claude and ChatGPT](/docs/claude-and-chatgpt).

### How do I stop other people from signing up?
After you create your account, set `SIGNUP_MODE` to `"closed"`. Without that, anyone who finds your server can create an account.

### Is the hosted service different code?
No. The hosted service at agentchrome.dev runs the same open source Worker, on Circo's Cloudflare account.
