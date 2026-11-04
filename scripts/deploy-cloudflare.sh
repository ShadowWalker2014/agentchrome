#!/bin/sh
# Deploy your own agentchrome server to Cloudflare (Workers + Durable Objects + D1 + KV + R2).
# Needs: Node 18+, pnpm, and `npx wrangler login` (or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID).
# Usage: sh scripts/deploy-cloudflare.sh [worker-name]
set -e
NAME="${1:-agentchrome}"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SERVER_DIR="$ROOT/packages/server"
cd "$ROOT"
pnpm install --frozen-lockfile >/dev/null
W="npx --prefix $SERVER_DIR wrangler"
cd "$SERVER_DIR"

CFG=wrangler.jsonc
LOCAL=wrangler.self.jsonc
cp "$CFG" "$LOCAL"
node -e '
const fs=require("fs");const f=process.argv[1];let s=fs.readFileSync(f,"utf8");
s=s.replace(/"account_id": "[^"]*",\n\s*/,"").replace(/"name": "agentchrome"/,`"name": "${process.argv[2]}"`)
 .replace(/"database_id": "[^"]*", /,"").replace(/, "id": "[^"]*" \}/," }").replace(/"bucket_name": "agentchrome-artifacts"/,`"bucket_name": "${process.argv[2]}-artifacts"`)
 .replace(/"database_name": "agentchrome"/,`"database_name": "${process.argv[2]}"`);
fs.writeFileSync(f,s)' "$LOCAL" "$NAME"

echo "→ Creating D1 database, KV namespace and R2 bucket (existing ones are reused)"
$W d1 create "$NAME" >/dev/null 2>&1 || true
DB_ID=$($W d1 list --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const x=JSON.parse(d).find(x=>x.name===process.argv[1]);console.log(x?x.uuid:"")})' "$NAME")
$W kv namespace create "$NAME-oauth" >/dev/null 2>&1 || true
KV_ID=$($W kv namespace list | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const x=JSON.parse(d).find(x=>x.title===process.argv[1]);console.log(x?x.id:"")})' "$NAME-oauth")
$W r2 bucket create "$NAME-artifacts" >/dev/null 2>&1 || true
[ -n "$DB_ID" ] && [ -n "$KV_ID" ] || { echo "Could not create or find D1/KV. Run 'npx wrangler login' first." >&2; exit 1; }
node -e '
const fs=require("fs");const [f,db,kv]=process.argv.slice(1);let s=fs.readFileSync(f,"utf8");
s=s.replace(/"database_name": "([^"]*)", /,`"database_name": "$1", "database_id": "${db}", `).replace(/\{ "binding": "OAUTH_KV" \}/,`{ "binding": "OAUTH_KV", "id": "${kv}" }`);
fs.writeFileSync(f,s)' "$LOCAL" "$DB_ID" "$KV_ID"

echo "→ Applying database migrations"
$W d1 migrations apply "$NAME" --remote -c "$LOCAL" >/dev/null

echo "→ Deploying"
URL=$($W deploy -c "$LOCAL" 2>&1 | grep -Eo 'https://[^ ]+workers\.dev' | head -1)
[ -n "$URL" ] || { echo "Deploy failed; run: npx wrangler deploy -c $SERVER_DIR/$LOCAL" >&2; exit 1; }
echo "→ Building the CLI and extension for $URL and redeploying with them"
ACM_DEFAULT_SERVER="$URL" node "$ROOT/scripts/build-all.mjs" >/dev/null
$W deploy -c "$LOCAL" >/dev/null
head -c 48 /dev/urandom | base64 | tr -d '\n' | $W secret put SESSION_SECRET -c "$LOCAL" >/dev/null
echo ""
echo "✓ Your server is live: $URL"
echo "  Install on any machine:  curl -fsSL $URL/install | sh"
echo "  Lock sign-ups after you have your account:  set SIGNUP_MODE=\"closed\" in $LOCAL and redeploy"
