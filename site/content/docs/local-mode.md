---
title: Run Agent Chrome Fully Local With No Cloud Server
description: Run the Agent Chrome MCP server on 127.0.0.1:47823 so nothing leaves your machine. Install with --local, start it at login and point the extension at it.
slug: docs/local-mode
type: docs
nav: Local mode
updated: 2026-11-04
---

# Run Agent Chrome Fully Local With No Cloud Server

Install with the `--local` flag and run `agentchrome serve`, and the MCP server runs on your own machine at `http://127.0.0.1:47823`. No cloud account is involved and nothing reaches the hosted service.

## Install in local mode

```sh
curl -fsSL https://agentchrome.dev/install | sh -s -- --local
agentchrome serve --install    # starts the local server now and at every login (macOS)
```

The installer sets up a local account, adds the `agentchrome` MCP server to your agents with the URL `http://127.0.0.1:47823/mcp`, links the skill and unpacks the extension, as it does for the hosted server.

## Point the extension at the local server

Load the extension as described in [install](/docs/install). Then, in the extension popup, open **Server** and set it to:

```
http://127.0.0.1:47823
```

Do this before you connect. Get a pairing code with `agentchrome pair`.

## Run the server yourself

```sh
agentchrome serve                 # run in the foreground
agentchrome serve --port 47900    # use another port
```

`agentchrome serve --install` writes a launchd agent named `dev.agentchrome.local` on macOS, with logs in `~/.agentchrome/local-server.log`. On Linux, the CLI tells you to run `agentchrome serve` from a systemd user unit.

## What stays local

- The server listens only on `127.0.0.1:47823` and rejects requests from web pages.
- Screenshots and recordings are saved to `~/.agentchrome/artifacts`. Tools return file paths instead of download links.
- Account data lives under `~/.agentchrome`, and the key is in `~/.config/agentchrome/config.json` with `chmod 600`.

## Differences from the hosted server

| | Hosted | Local |
|---|---|---|
| Server URL | `https://agentchrome.dev/mcp` | `http://127.0.0.1:47823/mcp` |
| Saved files | Download links, deleted after 7 days | Paths in `~/.agentchrome/artifacts` |
| Claude.ai and ChatGPT connectors | Supported | Not reachable, because chat apps run in the cloud and cannot call 127.0.0.1 |
| Runs when | Always | While your computer and the local server run |

## Related pages

- [Docs overview](/docs)
- [Install Agent Chrome](/docs/install)
- [Self-host on Cloudflare](/docs/self-host)
- [Security and privacy](/docs/security)
- [Troubleshooting](/docs/troubleshooting)

## Frequently asked questions

### Can I use Agent Chrome without any cloud service?
Yes. Local mode runs the MCP server on `127.0.0.1:47823`, and your agents and the extension connect to it directly. The privacy policy notes that none of the hosted-service data reaches Circo in local mode.

### Why does the extension say it cannot connect?
Check that `agentchrome serve` is running and that the popup's Server field is set to `http://127.0.0.1:47823`. Then run `agentchrome pair` for a fresh code.

### How do I keep the local server running after a restart?
On macOS, run `agentchrome serve --install`, which starts it at every login with launchd. On Linux, run `agentchrome serve` from a systemd user unit.

### Can Claude.ai or ChatGPT use local mode?
No. Those apps call connectors from the cloud, and a server on 127.0.0.1 is not reachable from there. Use the hosted server or [self-host](/docs/self-host) for chat apps.

### Can I switch between local and hosted?
Yes. Run the installer again with or without `--local`, or use `agentchrome setup`, and it rewrites the agent configs to the chosen server.
