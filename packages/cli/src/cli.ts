import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { AGENTS, copyToClipboard, installSkill, openUrl, removeLegacy, SERVER_NAME, uninstallSkill } from "./agents";
import { ensureLocalAccount, HOME_DIR, LOCAL_PORT, localPairCode, startLocalServer } from "./local-server";
// @ts-ignore bundled as text by esbuild
import SKILL_MD from "../../../skills/agentchrome/SKILL.md";

declare const __VERSION__: string;
declare const __DEFAULT_SERVER__: string;

const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "dev";
const DEFAULT_SERVER = process.env.AGENT_CHROME_MCP_SERVER ?? (typeof __DEFAULT_SERVER__ === "string" ? __DEFAULT_SERVER__ : "http://127.0.0.1:8787");
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "agentchrome");
const CONFIG = join(CONFIG_DIR, "config.json");
const LOCAL_SERVER = `http://127.0.0.1:${LOCAL_PORT}`;

interface Config {
  server: string;
  apiKey: string;
  accountId?: string;
  mode?: "cloud" | "local";
}

// ---------- tiny UI helpers ----------
const tty = process.stdout.isTTY;
const c = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c("1");
const dim = c("2");
const green = c("32");
const red = c("31");
const violet = c("38;5;141");
const cyan = c("36");
const ok = (s: string) => console.log(`${green("✓")} ${s}`);
const warn = (s: string) => console.log(`${c("33")("!")} ${s}`);
const fail = (s: string): never => {
  console.error(`${red("✗")} ${s}`);
  process.exit(1);
};

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) flags[k!] = v;
      else if (argv[i + 1] && !argv[i + 1]!.startsWith("-") && ["server", "key", "agents", "port", "name"].includes(k!)) flags[k!] = argv[++i]!;
      else flags[k!] = true;
    } else if (a === "-y") flags.yes = true;
    else pos.push(a);
  }
  return { pos, flags };
}

function readConfig(): Config | null {
  try {
    return JSON.parse(readFileSync(CONFIG, "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(cfg: Config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  chmodSync(CONFIG, 0o600);
}

function requireConfig(): Config {
  const cfg = readConfig();
  if (!cfg) fail(`Not set up yet. Run ${bold("agentchrome setup")} first.`);
  return cfg!;
}

async function api<T = any>(cfg: Pick<Config, "server" | "apiKey">, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${cfg.server}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

const mcpUrl = (server: string) => `${server.replace(/\/+$/, "")}/mcp`;

// ---------- extension ----------
// Chrome loads an unpacked extension from a folder it keeps reading, so the folder must be easy to find and must stay.
// It goes in Documents (not a hidden dot-folder, and not Downloads, which people clean out).
const EXT_FOLDER = "Agent Chrome";
const LEGACY_EXT_DIR = join(HOME_DIR, "extension");

function documentsDir(): string {
  const home = homedir();
  try {
    if (process.platform === "win32") {
      // Documents is often redirected to OneDrive.
      const p = execFileSync("powershell", ["-NoProfile", "-Command", "[Environment]::GetFolderPath('MyDocuments')"], { encoding: "utf8", timeout: 5000 }).trim();
      if (p) return p;
    } else if (process.platform === "linux") {
      const p = execFileSync("xdg-user-dir", ["DOCUMENTS"], { encoding: "utf8", timeout: 3000 }).trim();
      if (p && p !== home) return p;
    }
  } catch {}
  return join(home, "Documents");
}

function extensionDirCandidates(): string[] {
  if (process.env.ACM_EXTENSION_DIR) return [process.env.ACM_EXTENSION_DIR];
  return [join(documentsDir(), EXT_FOLDER), join(homedir(), EXT_FOLDER)];
}

/** True when the folder is free to (re)write: missing, empty, or a previous Agent Chrome extension. Never overwrite anything else. */
function isOurs(dir: string): boolean {
  if (!existsSync(dir)) return true;
  try {
    if (readdirSync(dir).filter((f) => !f.startsWith(".")).length === 0) return true;
    return JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")).name === "Agent Chrome";
  } catch {
    return false;
  }
}

function unzip(zip: string, dest: string) {
  // Windows 10+ ships bsdtar as tar.exe, which reads zip files; macOS and most Linux have unzip.
  if (process.platform === "win32") return execFileSync("tar", ["-xf", zip, "-C", dest]);
  try {
    execFileSync("unzip", ["-qo", zip, "-d", dest]);
  } catch {
    execFileSync("tar", ["-xf", zip, "-C", dest]);
  }
}

const README_TXT = `Google Chrome loads the Agent Chrome extension from this folder.
Keep it here. If you move or delete it, Chrome turns the extension off.

To load it: open chrome://extensions, turn on Developer mode (top right),
then drag this folder onto the page, or click Load unpacked and choose it.

Running the installer again updates this folder. To remove Agent Chrome,
remove it in chrome://extensions, then delete this folder.
https://agentchrome.dev/docs/install
`;

async function stageExtension(server: string, dest: string) {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = [join(here, "extension"), join(here, "../../extension/dist")].find((p) => existsSync(join(p, "manifest.json")));
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  if (bundled) {
    cpSync(bundled, dest, { recursive: true });
  } else {
    const res = await fetch(`${server}/agentchrome-extension.zip`);
    if (!res.ok) throw new Error(`Could not download the extension from ${server} (HTTP ${res.status})`);
    mkdirSync(HOME_DIR, { recursive: true });
    const zip = join(HOME_DIR, "extension.zip");
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    try {
      unzip(zip, dest);
    } finally {
      rmSync(zip, { force: true });
    }
  }
  writeFileSync(join(dest, "README.txt"), README_TXT);
}

async function ensureExtension(server: string): Promise<string> {
  let dest: string | undefined;
  let lastError: unknown;
  for (const dir of extensionDirCandidates()) {
    if (!isOurs(dir)) continue;
    try {
      await stageExtension(server, dir);
      dest = dir;
      break;
    } catch (e: any) {
      // macOS may refuse Documents to the terminal (privacy settings); fall back to the next visible folder.
      if (e?.code !== "EPERM" && e?.code !== "EACCES") throw e;
      lastError = e;
    }
  }
  if (!dest) throw lastError ?? new Error(`Could not find a free folder for the extension. Set ACM_EXTENSION_DIR to choose one.`);
  // Older versions unpacked to a hidden folder. Keep it current so a copy already loaded from there keeps working.
  if (existsSync(join(LEGACY_EXT_DIR, "manifest.json")) && LEGACY_EXT_DIR !== dest) {
    try {
      rmSync(LEGACY_EXT_DIR, { recursive: true, force: true });
      cpSync(dest, LEGACY_EXT_DIR, { recursive: true });
    } catch {}
  }
  return dest;
}

const tildify = (p: string) => (process.platform !== "win32" && p.startsWith(homedir()) ? `~${p.slice(homedir().length)}` : p);

/** Open chrome://extensions in Chrome and show the folder selected in the file manager, ready to drag in. */
function openExtensionPage(dir: string) {
  const quiet = { stdio: "ignore" as const, timeout: 5000 };
  try {
    if (process.platform === "darwin") {
      execFileSync("open", ["-a", "Google Chrome", "chrome://extensions"], quiet);
      execFileSync("open", ["-R", dir], quiet);
    } else if (process.platform === "win32") {
      execFileSync("cmd", ["/c", "start", "chrome", "chrome://extensions"], quiet);
      try {
        execFileSync("explorer", [`/select,${dir}`], quiet);
      } catch {} // explorer exits 1 even on success
    } else {
      for (const bin of ["google-chrome", "google-chrome-stable", "chromium"]) {
        try {
          execFileSync(bin, ["chrome://extensions"], quiet);
          break;
        } catch {}
      }
      execFileSync("xdg-open", [dirname(dir)], quiet);
    }
  } catch {}
}

function printExtensionSteps(dir: string) {
  const fm = process.platform === "darwin" ? "Finder" : process.platform === "win32" ? "File Explorer" : "your file manager";
  console.log(`
${bold("Load the Chrome extension")} ${dim("(once per Chrome profile)")}
  The extension is in the ${bold(`"${EXT_FOLDER}"`)} folder: ${violet(tildify(dir))}
  1. Open ${cyan("chrome://extensions")} and turn on ${bold("Developer mode")} (top right).
  2. Drag the ${bold(`"${EXT_FOLDER}"`)} folder from ${fm} onto that page.
     ${dim(`Or click Load unpacked and choose the "${EXT_FOLDER}" folder.`)}
  3. Pin ${bold("Agent Chrome")} from the puzzle-piece menu, click it, and paste the pairing code.
  ${dim("Keep the folder where it is: Chrome loads the extension from it.")}
`);
}

// ---------- commands ----------
async function cmdSetup(flags: Record<string, string | boolean>) {
  console.log(`\n${violet("◆")} ${bold("agentchrome")} ${dim(`v${VERSION}`)}\n`);
  const local = Boolean(flags.local);
  let cfg = readConfig();
  if (local) {
    const { apiKey } = ensureLocalAccount(Boolean(flags["rotate-key"]));
    if (apiKey) cfg = { server: LOCAL_SERVER, apiKey, accountId: "local", mode: "local" };
    else if (!cfg || cfg.mode !== "local") fail("A local account exists but its key is not in your config. Run `agentchrome setup --local --rotate-key`.");
    writeConfig(cfg!);
    ok(`Local server account ready ${dim(`(${HOME_DIR})`)}`);
  } else {
    const server = String(flags.server ?? cfg?.server ?? DEFAULT_SERVER).replace(/\/+$/, "");
    if (typeof flags.key === "string") {
      cfg = { server, apiKey: flags.key, mode: "cloud" };
      const me = await api(cfg, "/api/me").catch((e) => fail(`That key does not work on ${server}: ${e.message}`));
      cfg.accountId = me.accountId;
      ok(`Signed in to ${server}`);
    } else if (cfg && cfg.mode !== "local" && cfg.server !== server && (await api({ server, apiKey: cfg.apiKey }, "/api/me").catch(() => null))) {
      // Same account on a new address (for example after a domain move): keep it.
      cfg = { ...cfg, server };
      ok(`Moved your account to ${server}`);
    } else if (cfg && cfg.server === server && cfg.mode !== "local") {
      const me = await api(cfg, "/api/me").catch(() => null);
      if (!me) fail(`Your saved key no longer works on ${server}. Run setup with --key, or delete ${CONFIG}.`);
      ok(`Using your account on ${server} ${dim(`(${me.accountId})`)}`);
    } else {
      const res = await fetch(`${server}/api/signup`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) fail(`Could not create an account on ${server}: ${body.error ?? res.status}`);
      cfg = { server, apiKey: body.apiKey, accountId: body.accountId, mode: "cloud" };
      ok(`Created your account on ${server} ${dim(`(${body.accountId})`)}`);
    }
    writeConfig(cfg!);
  }
  ok(`Saved credentials to ${CONFIG} ${dim("(chmod 600)")}`);

  if (!flags["no-install"]) await cmdInstall([], { ...flags, all: flags.agents ? false : true });

  const dir = await ensureExtension(cfg!.server).catch((e) => {
    warn(String(e.message));
    return null;
  });
  if (dir) {
    printExtensionSteps(dir);
    if (!flags["no-open"] && process.stdout.isTTY) openExtensionPage(dir);
  }
  await cmdPair(flags);
  if (local) console.log(`\n${bold("Start the local server:")} ${cyan("agentchrome serve")} ${dim("(or `serve --install` to run it at login)")}`);
  console.log(`\n${bold("Try it:")} ask your agent ${cyan('"Use agentchrome to open news.ycombinator.com and screenshot it"')}\n`);
}

async function cmdLogin(flags: Record<string, string | boolean>) {
  if (typeof flags.key !== "string") fail("Usage: agentchrome login --key acm_sk_… [--server URL]");
  await cmdSetup({ ...flags, "no-install": flags.install ? false : true });
}

async function cmdPair(flags: Record<string, string | boolean>) {
  const cfg = requireConfig();
  let code: string;
  let expiresAt: string;
  if (cfg.mode === "local" || flags.local) {
    const r = localPairCode();
    code = r.code;
    expiresAt = new Date(r.expiresAt).toISOString();
  } else {
    const r = await api(cfg, "/api/pair/new", { method: "POST" });
    code = r.code;
    expiresAt = r.expiresAt;
  }
  const copied = copyToClipboard(code);
  const mins = Math.round((Date.parse(expiresAt) - Date.now()) / 60000);
  console.log(`
${bold("Pairing code")}  ${violet(bold(code))}  ${dim(`(${copied ? "copied, " : ""}valid ${mins} min, single use)`)}
Paste it in the Agent Chrome popup in the Chrome profile you want to connect.
${cfg.mode === "local" ? `Set ${bold("Server")} in the popup to ${cyan(LOCAL_SERVER)}.` : cfg.server !== DEFAULT_SERVER ? `Set ${bold("Server")} in the popup to ${cyan(cfg.server)}.` : ""}`);
}

async function cmdInstall(pos: string[], flags: Record<string, string | boolean>) {
  const cfg = requireConfig();
  const wanted = (typeof flags.agents === "string" ? flags.agents.split(",") : pos).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const targets = wanted.length ? AGENTS.filter((a) => wanted.includes(a.id)) : AGENTS.filter((a) => a.detect());
  if (wanted.length && targets.length !== wanted.length) {
    fail(`Unknown agent. Choose from: ${AGENTS.map((a) => a.id).join(", ")}`);
  }
  const t = { url: mcpUrl(cfg.server), token: flags.oauth ? undefined : cfg.apiKey };
  const legacy = removeLegacy();
  if (legacy.length) ok(`Removed the old "agent-chrome" entries ${dim(`(${legacy.length})`)}`);
  console.log(`\n${bold("Adding the MCP server")} ${dim(`"${SERVER_NAME}" → ${t.url}${flags.oauth ? " (OAuth)" : ""}`)}`);
  for (const a of targets) {
    try {
      ok(`${a.name.padEnd(12)} ${dim(a.install(t))}`);
    } catch (e) {
      warn(`${a.name.padEnd(12)} ${(e as Error).message}`);
    }
  }
  if (!targets.length) warn("No supported agents found. Pass agent ids, e.g. `agentchrome install claude codex`.");
  if (!flags["no-skill"]) {
    const links = installSkill(SKILL_MD);
    console.log(`\n${bold("Skill")} ${dim("agentchrome (one copy, symlinked)")}`);
    for (const l of links) console.log(`  ${dim("↳")} ${dim(l)}`);
  }
}

async function cmdUninstall(pos: string[]) {
  const targets = pos.length ? AGENTS.filter((a) => pos.includes(a.id)) : AGENTS;
  for (const a of targets) {
    try {
      if (a.detect() || a.installed()) ok(`${a.name.padEnd(12)} removed ${dim(a.uninstall())}`);
    } catch (e) {
      warn(`${a.name}: ${(e as Error).message}`);
    }
  }
  if (!pos.length) {
    uninstallSkill();
    ok("Removed the agentchrome skill links");
  }
}

async function cmdStatus() {
  const cfg = readConfig();
  console.log(`\n${violet("◆")} ${bold("agentchrome")} ${dim(`v${VERSION}`)}`);
  if (!cfg) return console.log(`  ${red("Not set up.")} Run ${bold("agentchrome setup")}`);
  console.log(`  Server   ${cfg.server} ${dim(cfg.mode === "local" ? "(local)" : "(cloud)")}`);
  console.log(`  MCP URL  ${mcpUrl(cfg.server)}`);
  try {
    const me = await api(cfg, "/api/me");
    console.log(`  Account  ${me.accountId}`);
    console.log(`\n${bold("Browsers")}`);
    if (!me.devices.length) console.log(`  ${dim("none paired — run")} agentchrome pair`);
    for (const d of me.devices) console.log(`  ${d.online ? green("●") : dim("○")} ${d.name}${d.email ? dim(` <${d.email}>`) : ""} ${dim(d.id)}`);
  } catch (e) {
    console.log(`  ${red("Server unreachable or key rejected:")} ${(e as Error).message}`);
  }
  console.log(`\n${bold("Agents")}`);
  for (const a of AGENTS) {
    if (!a.detect()) continue;
    console.log(`  ${a.installed() ? green("✓") : dim("·")} ${a.name}${a.installed() ? "" : dim("  (not installed — agentchrome install " + a.id + ")")}`);
  }
  console.log("");
}

async function cmdRevoke(pos: string[]) {
  const cfg = requireConfig();
  if (!pos[0]) fail("Usage: agentchrome revoke <browser-id>   (ids from `agentchrome status`)");
  const r = await api(cfg, `/api/devices/${encodeURIComponent(pos[0]!)}`, { method: "DELETE" });
  r.revoked ? ok(`Revoked ${pos[0]}`) : warn(`No active browser ${pos[0]}`);
}

async function cmdRotate(flags: Record<string, string | boolean>) {
  const cfg = requireConfig();
  if (cfg.mode === "local") {
    const { apiKey } = ensureLocalAccount(true);
    writeConfig({ ...cfg, apiKey: apiKey! });
  } else {
    const r = await api(cfg, "/api/keys/rotate", { method: "POST" });
    writeConfig({ ...cfg, apiKey: r.apiKey });
  }
  ok("Rotated your account key. Updating agent configs…");
  await cmdInstall([], { ...flags });
}

async function cmdServe(flags: Record<string, string | boolean>) {
  ensureLocalAccount(false);
  const port = Number(flags.port ?? LOCAL_PORT);
  if (flags.install) return installService(port);
  const s = await startLocalServer(port, (m) => console.log(`${dim(new Date().toISOString())} ${m}`)).catch((e) => fail(`Cannot listen on 127.0.0.1:${port}: ${e.message}`));
  console.log(`${violet("◆")} ${bold("agentchrome local server")} on ${cyan(s.url)}  ${dim("MCP:")} ${s.url}/mcp`);
}

function installService(port: number) {
  if (process.platform !== "darwin") fail("--install supports macOS launchd. On Linux, run `agentchrome serve` from a systemd user unit.");
  const label = "dev.agentchrome.local";
  const plist = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
  const script = fileURLToPath(import.meta.url);
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${process.execPath}</string><string>${script}</string><string>serve</string><string>--port</string><string>${port}</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${join(HOME_DIR, "local-server.log")}</string>
<key>StandardErrorPath</key><string>${join(HOME_DIR, "local-server.log")}</string>
</dict></plist>
`,
  );
  try {
    execFileSync("launchctl", ["unload", plist], { stdio: "ignore" });
  } catch {}
  execFileSync("launchctl", ["load", plist]);
  ok(`Local server runs at login (${plist}). Logs: ${join(HOME_DIR, "local-server.log")}`);
}

async function cmdExtension(flags: Record<string, string | boolean>) {
  const cfg = readConfig();
  const dir = await ensureExtension(cfg?.server ?? DEFAULT_SERVER);
  if (flags.path) return console.log(dir);
  ok(`Extension unpacked to ${dir}`);
  copyToClipboard(dir);
  printExtensionSteps(dir);
  if (!flags["no-open"]) openExtensionPage(dir);
  if (flags.open) openUrl("https://github.com/ShadowWalker2014/agentchrome#install-the-chrome-extension");
}

function help() {
  console.log(`${violet("◆")} ${bold("agentchrome")} ${dim(`v${VERSION}`)} — your real Chrome, for every coding agent

${bold("Usage")}
  agentchrome setup [--server URL] [--key KEY] [--local] [--agents claude,codex]
                                  Create/sign in to an account, add the MCP server to every
                                  agent found, link the skill, unpack the extension, print a pairing code
  agentchrome pair           New pairing code for another Chrome profile
  agentchrome install [ids]  Add the MCP server to agents (default: all detected)  [--oauth]
  agentchrome uninstall [ids]
  agentchrome status         Account, paired browsers (online/offline), agents
  agentchrome extension      Unpack the extension and show how to load it  [--path]
  agentchrome revoke <id>    Remove a paired browser
  agentchrome rotate-key     Replace your account key and update every agent
  agentchrome key            Print your account key (for OAuth sign-in pages)
  agentchrome login --key K  Use an existing account key on this machine
  agentchrome serve          Run the local server on 127.0.0.1:${LOCAL_PORT}  [--install]

${bold("Agents")}  ${AGENTS.map((a) => a.id).join(", ")}
${bold("Docs")}    https://github.com/ShadowWalker2014/agentchrome`);
}

/** Move files from the old agent-chrome-mcp name, once. */
function migrateLegacyPaths() {
  const oldConfig = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "agent-chrome-mcp");
  if (existsSync(oldConfig) && !existsSync(CONFIG_DIR)) {
    try {
      renameSync(oldConfig, CONFIG_DIR);
    } catch {}
  }
  const oldHome = join(homedir(), ".agent-chrome-mcp");
  if (existsSync(oldHome) && !existsSync(HOME_DIR)) {
    try {
      renameSync(oldHome, HOME_DIR);
    } catch {}
  }
}

async function main() {
  migrateLegacyPaths();
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseArgs(rest);
  switch (cmd) {
    case "setup":
    case "init":
      return cmdSetup(flags);
    case "login":
      return cmdLogin(flags);
    case "pair":
      return cmdPair(flags);
    case "install":
      return cmdInstall(pos, flags);
    case "uninstall":
      return cmdUninstall(pos);
    case "status":
    case "doctor":
      return cmdStatus();
    case "revoke":
      return cmdRevoke(pos);
    case "rotate-key":
      return cmdRotate(flags);
    case "key":
      return console.log(requireConfig().apiKey);
    case "serve":
      return cmdServe(flags);
    case "extension":
      return cmdExtension(flags);
    case "version":
    case "--version":
    case "-v":
      return console.log(VERSION);
    default:
      return help();
  }
}

main().catch((e) => fail(String(e?.message ?? e)));
