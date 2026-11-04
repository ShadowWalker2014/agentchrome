// Maps an MCP clientInfo.name to a known agent (display name + icon key).
export interface AgentInfo {
  key: string;
  name: string;
}

const KNOWN: [RegExp, AgentInfo][] = [
  [/claude/i, { key: "claude", name: "Claude Code" }],
  [/codex|openai/i, { key: "codex", name: "Codex" }],
  [/antigravity|\bagy\b|jetski/i, { key: "antigravity", name: "Antigravity" }],
  [/gemini/i, { key: "gemini", name: "Gemini" }],
  [/grok|xai/i, { key: "grok", name: "Grok" }],
  [/muse|meta/i, { key: "muse", name: "Muse" }],
  [/cursor/i, { key: "cursor", name: "Cursor" }],
  [/opencode/i, { key: "opencode", name: "opencode" }],
  [/windsurf|cascade|codeium/i, { key: "windsurf", name: "Windsurf" }],
  [/copilot|vscode|visual studio code/i, { key: "copilot", name: "Copilot" }],
  [/kiro/i, { key: "kiro", name: "Kiro" }],
  [/cline|roo/i, { key: "cline", name: "Cline" }],
  [/qwen/i, { key: "qwen", name: "Qwen Code" }],
];

export function agentFor(client: string): AgentInfo {
  for (const [re, info] of KNOWN) if (re.test(client)) return info;
  const base = client.replace(/[-_ ]?(mcp)?[-_ ]?client$/i, "").replace(/[-_]+/g, " ").trim() || "Agent";
  return { key: "", name: base.replace(/\b\w/g, (c) => c.toUpperCase()) };
}
