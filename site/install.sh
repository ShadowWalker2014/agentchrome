#!/bin/sh
# agentchrome installer: puts the CLI in ~/.local/bin, then runs `agentchrome setup`.
# Usage: curl -fsSL https://agentchrome.dev/install | sh
#        curl -fsSL https://agentchrome.dev/install | sh -s -- --local
set -e
SERVER="${AGENT_CHROME_MCP_SERVER:-__SERVER__}"
if ! command -v node >/dev/null 2>&1; then
  echo "agentchrome needs Node.js 18 or newer: https://nodejs.org" >&2; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 18 ]; then echo "Node.js 18+ required (found $(node -v))" >&2; exit 1; fi
DIR="$HOME/.agentchrome"
BIN="$HOME/.local/bin"
mkdir -p "$DIR/bin" "$BIN"
curl -fsSL "$SERVER/cli.mjs" -o "$DIR/bin/agentchrome.mjs"
chmod +x "$DIR/bin/agentchrome.mjs"
ln -sf "$DIR/bin/agentchrome.mjs" "$BIN/agentchrome"
echo "✓ Installed agentchrome -> $BIN/agentchrome"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "! Add $BIN to your PATH:  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc";; esac
AGENT_CHROME_MCP_SERVER="$SERVER" "$BIN/agentchrome" setup --server "$SERVER" "$@"
