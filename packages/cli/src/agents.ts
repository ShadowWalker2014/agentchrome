// Writes the MCP server entry into each coding agent's user-level config.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

export const SERVER_NAME = "agentchrome";
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
  if (existsSync(path)) cpSync(path, `${path}.bak-agentchrome`);
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

function codexAgent(config: string, id: string, name: string): AgentDef {
  return {
    id,
    name,
    detect: () => (id === "codex" ? has("codex") : false) || existsSync(dirname(config)),
    install(t) {
      const cur = existsSync(config) ? readFileSync(config, "utf8") : "";
      if (cur) cpSync(config, `${config}.bak-agentchrome`);
      let block = `\n[mcp_servers.${SERVER_NAME}]\nurl = "${t.url}"\ntool_timeout_sec = 180\n`;
      if (t.token) block += `\n[mcp_servers.${SERVER_NAME}.http_headers]\nAuthorization = "Bearer ${t.token}"\n`;
      mkdirSync(dirname(config), { recursive: true });
      writeFileSync(config, `${stripCodexBlock(cur).trimEnd()}\n${block}`);
      return config;
    },
    uninstall() {
      if (existsSync(config)) writeFileSync(config, `${stripCodexBlock(readFileSync(config, "utf8")).trimEnd()}\n`);
      return config;
    },
    installed: () => existsSync(config) && readFileSync(config, "utf8").includes(`[mcp_servers.${SERVER_NAME}]`),
  };
}
const codex = codexAgent(CODEX_CONFIG, "codex", "Codex");

/**
 * Extra config homes, e.g. from a CLI proxy that runs agents with their own settings
 * (CODEX_HOME=~/.codex-proxy, XDG_CONFIG_HOME=~/.muse-proxy/config, OPENCODE_CONFIG=~/.opencode-proxy/opencode.json).
 */
function homeVariants(prefix: string): string[] {
  try {
    return readdirSync(H)
      .filter((d) => d.startsWith(`${prefix}-`) && statSync(join(H, d)).isDirectory())
      .map((d) => join(H, d));
  } catch {
    return [];
  }
}

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
function grokAgent(home: string | undefined, id: string, name: string): AgentDef {
  const env = home ? { ...process.env, GROK_HOME: home } : process.env;
  const cfg = join(home ?? join(H, ".grok"), "config.toml");
  const grokRun = (args: string[]) => spawnSync("grok", args, { encoding: "utf8", env });
  return {
    id,
    name,
    detect: () => has("grok") && (home ? existsSync(home) : true),
    install(t) {
      grokRun(["mcp", "remove", SERVER_NAME]);
      const args = ["mcp", "add", "--scope", "user", "--transport", "http"];
      if (t.token) args.push("--header", `Authorization: Bearer ${t.token}`);
      args.push(SERVER_NAME, t.url);
      const r = grokRun(args);
      if (r.status !== 0) throw new Error(`grok mcp add failed: ${(r.stderr || r.stdout || "").trim().slice(0, 300)}`);
      return cfg;
    },
    uninstall() {
      grokRun(["mcp", "remove", SERVER_NAME]);
      return cfg;
    },
    installed: () => existsSync(cfg) && readFileSync(cfg, "utf8").includes(SERVER_NAME),
  };
}
const grok = grokAgent(undefined, "grok", "Grok");

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

const variantAgents: AgentDef[] = [
  ...homeVariants(".grok").map((d) => grokAgent(d, `grok@${d.split("/").pop()}`, `Grok (${d.split("/").pop()})`)),
  ...homeVariants(".codex")
    .filter((d) => existsSync(join(d, "config.toml")))
    .map((d) => codexAgent(join(d, "config.toml"), `codex@${d.split("/").pop()}`, `Codex (${d.split("/").pop()})`)),
  ...homeVariants(".muse")
    .map((d) => join(d, "config", "muse", "settings.json"))
    .filter((f) => existsSync(f))
    .map((f) =>
      jsonAgent({ id: `muse@${f.split("/")[3]}`, name: `Muse (${f.split("/")[3]})`, path: f, detect: () => true, entry: (t) => ({ type: "streamable-http", url: t.url, ...auth(t) }) }),
    ),
  ...homeVariants(".opencode")
    .map((d) => join(d, "opencode.json"))
    .filter((f) => existsSync(f))
    .map((f) =>
      jsonAgent({ id: `opencode@${f.split("/")[3]}`, name: `opencode (${f.split("/")[3]})`, path: f, key: "mcp", detect: () => true, entry: (t) => ({ type: "remote", url: t.url, enabled: true, ...auth(t) }) }),
    ),
];

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
  ...variantAgents,
];

// ---------- skill: one canonical copy, symlinked into every agent ----------

export const SKILL_NAME = "agentchrome";
const CANONICAL_SKILLS = join(H, ".agents", "skills");
const SKILL_DIRS: { agent: string; dir: string }[] = [
  { agent: "Claude Code", dir: join(H, ".claude", "skills") },
  { agent: "Codex", dir: join(process.env.CODEX_HOME ?? join(H, ".codex"), "skills") },
  { agent: "Gemini CLI", dir: join(H, ".gemini", "skills") },
  { agent: "Antigravity", dir: join(H, ".gemini", "antigravity", "global_skills") },
  { agent: "Cursor", dir: join(H, ".cursor", "skills") },
  { agent: "opencode", dir: join(H, ".config", "opencode", "skills") },
];

/** Earlier releases used these names; remove them so agents don't list the server twice. */
export const LEGACY_SERVER_NAMES = ["agent-chrome"];

export function removeLegacy(): string[] {
  const removed: string[] = [];
  for (const old of LEGACY_SERVER_NAMES) {
    for (const [bin, args] of [
      ["claude", ["mcp", "remove", old, "--scope", "user"]],
      ["grok", ["mcp", "remove", old]],
      ["agy", ["mcp", "remove", old]],
    ] as [string, string[]][]) {
      if (has(bin) && runQuiet(bin, args).status === 0) removed.push(`${bin}: ${old}`);
    }
    if (existsSync(CODEX_CONFIG)) {
      const cur = readFileSync(CODEX_CONFIG, "utf8");
      const header = new RegExp(`^\\s*\\[mcp_servers\\.(?:"${old}"|${old})(\\.|\\])`);
      if (cur.split("\n").some((l) => header.test(l))) {
        const out: string[] = [];
        let skip = false;
        for (const line of cur.split("\n")) {
          if (/^\s*\[/.test(line)) skip = header.test(line);
          if (!skip) out.push(line);
        }
        writeFileSync(CODEX_CONFIG, out.join("\n"));
        removed.push(`codex: ${old}`);
      }
    }
    const jsonFiles: [string, string][] = [
      [join(H, ".gemini", "settings.json"), "mcpServers"],
      [AGY_IDE, "mcpServers"],
      [MUSE, "mcpServers"],
      [join(H, ".cursor", "mcp.json"), "mcpServers"],
      [join(H, ".config", "opencode", "opencode.json"), "mcp"],
      [join(H, ".codeium", "windsurf", "mcp_config.json"), "mcpServers"],
    ];
    for (const [file, key] of jsonFiles) {
      if (!existsSync(file)) continue;
      const d = readJson(file);
      if (d[key]?.[old]) {
        delete d[key][old];
        writeJson(file, d);
        removed.push(`${file}: ${old}`);
      }
    }
    for (const { dir } of SKILL_DIRS) {
      const link = join(dir, old);
      try {
        if (lstatSync(link).isSymbolicLink()) rmSync(link);
      } catch {}
    }
    rmSync(join(CANONICAL_SKILLS, old), { recursive: true, force: true });
  }
  return removed;
}

// Proxied Codex homes (e.g. ~/.codex-proxy) read skills from their own folder.
for (const d of homeVariants(".codex")) SKILL_DIRS.push({ agent: `Codex (${d.split("/").pop()})`, dir: join(d, "skills") });

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
