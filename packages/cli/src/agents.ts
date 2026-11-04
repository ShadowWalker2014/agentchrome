// Writes the MCP server entry into each coding agent's user-level config.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

export const SERVER_NAME = "agent-chrome";
const H = homedir();

export interface InstallTarget {
  url: string;
  /** Bearer token; omit to let the agent use OAuth. */
  token?: string;
}

export interface AgentDef {
  id: string;
  name: string;
  detect(): boolean;
  install(t: InstallTarget): string;
  uninstall(): string;
  installed(): boolean;
}

const has = (bin: string) => spawnSync(process.platform === "win32" ? "where" : "which", [bin], { stdio: "ignore" }).status === 0;
const run = (bin: string, args: string[]) => {
  const r = spawnSync(bin, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${bin} ${args.slice(0, 3).join(" ")} failed: ${(r.stderr || r.stdout || "").trim().slice(0, 300)}`);
  return r.stdout;
};
const runQuiet = (bin: string, args: string[]) => spawnSync(bin, args, { encoding: "utf8" });

function readJson(path: string): any {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Tolerate JSONC (comments and trailing commas) by stripping them.
    return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"));
  }
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) cpSync(path, `${path}.bak-agent-chrome`);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function jsonAgent(opts: {
  id: string;
  name: string;
  path: string;
  key?: string;
  detect: () => boolean;
  entry: (t: InstallTarget) => Record<string, unknown>;
}): AgentDef {
  const key = opts.key ?? "mcpServers";
  return {
    id: opts.id,
    name: opts.name,
    detect: opts.detect,
    install(t) {
      const d = readJson(opts.path);
      d[key] = { ...(d[key] ?? {}), [SERVER_NAME]: opts.entry(t) };
      writeJson(opts.path, d);
      return opts.path;
    },
    uninstall() {
      const d = readJson(opts.path);
      if (d[key]?.[SERVER_NAME]) {
        delete d[key][SERVER_NAME];
        writeJson(opts.path, d);
      }
      return opts.path;
    },
    installed: () => Boolean(readJson(opts.path)?.[key]?.[SERVER_NAME]),
  };
}

const auth = (t: InstallTarget) => (t.token ? { headers: { Authorization: `Bearer ${t.token}` } } : {});

// ---------- Codex (TOML) ----------
const CODEX_CONFIG = join(process.env.CODEX_HOME ?? join(H, ".codex"), "config.toml");

function stripCodexBlock(toml: string): string {
  const lines = toml.split("\n");
  const out: string[] = [];
  let skipping = false;
  const header = new RegExp(`^\\s*\\[mcp_servers\\.(?:"${SERVER_NAME}"|${SERVER_NAME})(\\.|\\])`);
  for (const line of lines) {
    if (/^\s*\[/.test(line)) skipping = header.test(line);
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

const codex: AgentDef = {
  id: "codex",
  name: "Codex",
  detect: () => has("codex") || existsSync(dirname(CODEX_CONFIG)),
  install(t) {
    const cur = existsSync(CODEX_CONFIG) ? readFileSync(CODEX_CONFIG, "utf8") : "";
    if (cur) cpSync(CODEX_CONFIG, `${CODEX_CONFIG}.bak-agent-chrome`);
    let block = `\n[mcp_servers.${SERVER_NAME}]\nurl = "${t.url}"\ntool_timeout_sec = 180\n`;
    if (t.token) block += `\n[mcp_servers.${SERVER_NAME}.http_headers]\nAuthorization = "Bearer ${t.token}"\n`;
    mkdirSync(dirname(CODEX_CONFIG), { recursive: true });
    writeFileSync(CODEX_CONFIG, `${stripCodexBlock(cur).trimEnd()}\n${block}`);
    return CODEX_CONFIG;
  },
  uninstall() {
    if (existsSync(CODEX_CONFIG)) writeFileSync(CODEX_CONFIG, `${stripCodexBlock(readFileSync(CODEX_CONFIG, "utf8")).trimEnd()}\n`);
    return CODEX_CONFIG;
  },
  installed: () => existsSync(CODEX_CONFIG) && readFileSync(CODEX_CONFIG, "utf8").includes(`[mcp_servers.${SERVER_NAME}]`),
};

// ---------- Claude Code (CLI) ----------
const claude: AgentDef = {
  id: "claude",
  name: "Claude Code",
  detect: () => has("claude"),
  install(t) {
    runQuiet("claude", ["mcp", "remove", SERVER_NAME, "--scope", "user"]);
    const args = ["mcp", "add", "--scope", "user", "--transport", "http", SERVER_NAME, t.url];
    if (t.token) args.push("--header", `Authorization: Bearer ${t.token}`);
    run("claude", args);
    return "claude mcp (user scope, ~/.claude.json)";
  },
  uninstall() {
    runQuiet("claude", ["mcp", "remove", SERVER_NAME, "--scope", "user"]);
    return "claude mcp";
  },
  installed() {
    const p = join(H, ".claude.json");
    return existsSync(p) && Boolean(readJson(p)?.mcpServers?.[SERVER_NAME]);
  },
};

// ---------- Grok (CLI) ----------
const grok: AgentDef = {
  id: "grok",
  name: "Grok",
  detect: () => has("grok"),
  install(t) {
    runQuiet("grok", ["mcp", "remove", SERVER_NAME]);
    const args = ["mcp", "add", "--scope", "user", "--transport", "http"];
    if (t.token) args.push("--header", `Authorization: Bearer ${t.token}`);
    args.push(SERVER_NAME, t.url);
    run("grok", args);
    return "~/.grok/config.toml";
  },
  uninstall() {
    runQuiet("grok", ["mcp", "remove", SERVER_NAME]);
    return "~/.grok/config.toml";
  },
  installed() {
    const p = join(H, ".grok", "config.toml");
    return existsSync(p) && readFileSync(p, "utf8").includes(SERVER_NAME);
  },
};

// ---------- Antigravity CLI (agy) + IDE ----------
const AGY_IDE = join(H, ".gemini", "antigravity", "mcp_config.json");
const antigravity: AgentDef = {
  id: "antigravity",
  name: "Antigravity",
  detect: () => has("agy") || existsSync(join(H, ".gemini", "antigravity")),
  install(t) {
    const where: string[] = [];
    if (has("agy")) {
      runQuiet("agy", ["mcp", "remove", SERVER_NAME]);
      const args = ["mcp", "add", "--type", "http"];
      if (t.token) args.push("--header", `Authorization: Bearer ${t.token}`);
      args.push(SERVER_NAME, t.url);
      run("agy", args);
      where.push("agy mcp");
    }
    const d = readJson(AGY_IDE);
    d.mcpServers = { ...(d.mcpServers ?? {}), [SERVER_NAME]: { serverUrl: t.url, ...auth(t) } };
    writeJson(AGY_IDE, d);
    where.push(AGY_IDE);
    return where.join(" + ");
  },
  uninstall() {
    if (has("agy")) runQuiet("agy", ["mcp", "remove", SERVER_NAME]);
    const d = readJson(AGY_IDE);
    if (d.mcpServers?.[SERVER_NAME]) {
      delete d.mcpServers[SERVER_NAME];
      writeJson(AGY_IDE, d);
    }
    return AGY_IDE;
  },
  installed: () => Boolean(readJson(AGY_IDE)?.mcpServers?.[SERVER_NAME]),
};

const MUSE = join(process.env.XDG_CONFIG_HOME ?? join(H, ".config"), "muse", "settings.json");

export const AGENTS: AgentDef[] = [
  claude,
  codex,
  jsonAgent({
    id: "gemini",
    name: "Gemini CLI",
    path: join(H, ".gemini", "settings.json"),
    detect: () => has("gemini") || existsSync(join(H, ".gemini", "settings.json")),
    entry: (t) => ({ httpUrl: t.url, timeout: 180_000, ...auth(t) }),
  }),
  antigravity,
  grok,
  jsonAgent({
    id: "muse",
    name: "Muse",
    path: MUSE,
    detect: () => has("muse") || existsSync(dirname(MUSE)),
    entry: (t) => ({ type: "streamable-http", url: t.url, ...auth(t) }),
  }),
  jsonAgent({
    id: "cursor",
    name: "Cursor",
    path: join(H, ".cursor", "mcp.json"),
    detect: () => has("cursor-agent") || has("cursor") || existsSync(join(H, ".cursor")),
    entry: (t) => ({ url: t.url, ...auth(t) }),
  }),
  jsonAgent({
    id: "opencode",
    name: "opencode",
    path: join(H, ".config", "opencode", "opencode.json"),
    key: "mcp",
    detect: () => has("opencode") || existsSync(join(H, ".config", "opencode")),
    entry: (t) => ({ type: "remote", url: t.url, enabled: true, ...auth(t) }),
  }),
  jsonAgent({
    id: "windsurf",
    name: "Windsurf",
    path: join(H, ".codeium", "windsurf", "mcp_config.json"),
    detect: () => existsSync(join(H, ".codeium", "windsurf")),
    entry: (t) => ({ serverUrl: t.url, ...auth(t) }),
  }),
];

// ---------- skill: one canonical copy, symlinked into every agent ----------

export const SKILL_NAME = "agent-chrome";
const CANONICAL_SKILLS = join(H, ".agents", "skills");
const SKILL_DIRS: { agent: string; dir: string }[] = [
  { agent: "Claude Code", dir: join(H, ".claude", "skills") },
  { agent: "Codex", dir: join(process.env.CODEX_HOME ?? join(H, ".codex"), "skills") },
  { agent: "Gemini CLI", dir: join(H, ".gemini", "skills") },
  { agent: "Antigravity", dir: join(H, ".gemini", "antigravity", "global_skills") },
  { agent: "Cursor", dir: join(H, ".cursor", "skills") },
  { agent: "opencode", dir: join(H, ".config", "opencode", "skills") },
];

export function installSkill(skillMd: string): string[] {
  const canonical = join(CANONICAL_SKILLS, SKILL_NAME);
  mkdirSync(canonical, { recursive: true });
  writeFileSync(join(canonical, "SKILL.md"), skillMd);
  const done = [`canonical: ${canonical}`];
  for (const { agent, dir } of SKILL_DIRS) {
    if (!existsSync(dirname(dir))) continue;
    mkdirSync(dir, { recursive: true });
    const link = join(dir, SKILL_NAME);
    try {
      const st = lstatSync(link);
      if (st.isSymbolicLink() && readlinkSync(link).includes(join(".agents", "skills", SKILL_NAME))) {
        done.push(`${agent}: ${link} (linked)`);
        continue;
      }
      rmSync(link, { recursive: true, force: true });
    } catch {}
    symlinkSync(relative(dir, canonical), link);
    done.push(`${agent}: ${link} -> ${canonical}`);
  }
  return done;
}

export function uninstallSkill() {
  for (const { dir } of SKILL_DIRS) {
    const link = join(dir, SKILL_NAME);
    try {
      if (lstatSync(link).isSymbolicLink()) rmSync(link);
    } catch {}
  }
  rmSync(join(CANONICAL_SKILLS, SKILL_NAME), { recursive: true, force: true });
}

export function openUrl(url: string) {
  try {
    if (process.platform === "darwin") execFileSync("open", [url]);
    else if (process.platform === "win32") execFileSync("cmd", ["/c", "start", "", url]);
    else execFileSync("xdg-open", [url]);
  } catch {}
}

export function copyToClipboard(s: string) {
  try {
    if (process.platform === "darwin") spawnSync("pbcopy", { input: s });
    else if (process.platform === "win32") spawnSync("clip", { input: s });
    else spawnSync("xclip", ["-selection", "clipboard"], { input: s });
    return true;
  } catch {
    return false;
  }
}
