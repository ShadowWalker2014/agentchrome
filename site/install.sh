#!/bin/sh
# agent-chrome-mcp installer: puts the CLI in ~/.local/bin, then runs `agent-chrome-mcp setup`.
# Usage: curl -fsSL https://agent-chrome-mcp.circo.workers.dev/install | sh
#        curl -fsSL https://agent-chrome-mcp.circo.workers.dev/install | sh -s -- --local
set -e
SERVER="${AGENT_CHROME_MCP_SERVER:-__SERVER__}"
if ! command -v node >/dev/null 2>&1; then
  echo "agent-chrome-mcp needs Node.js 18 or newer: https://nodejs.org" >&2; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 18 ]; then echo "Node.js 18+ required (found $(node -v))" >&2; exit 1; fi
DIR="$HOME/.agent-chrome-mcp"
BIN="$HOME/.local/bin"
mkdir -p "$DIR/bin" "$BIN"
curl -fsSL "$SERVER/cli.mjs" -o "$DIR/bin/agent-chrome-mcp.mjs"
chmod +x "$DIR/bin/agent-chrome-mcp.mjs"
ln -sf "$DIR/bin/agent-chrome-mcp.mjs" "$BIN/agent-chrome-mcp"
echo "✓ Installed agent-chrome-mcp -> $BIN/agent-chrome-mcp"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "! Add $BIN to your PATH:  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc";; esac
AGENT_CHROME_MCP_SERVER="$SERVER" "$BIN/agent-chrome-mcp" setup --server "$SERVER" "$@"
