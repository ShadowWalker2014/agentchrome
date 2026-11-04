// Each MCP session owns one Chrome tab group per browser profile. State lives in storage.session
// so it survives service-worker restarts but not a browser restart.

import type { SessionInfo } from "@agent-chrome-mcp/protocol";

export interface SessionState {
  id: string;
  client: string;
  title: string;
  color: `${chrome.tabGroups.Color}`;
  groupId?: number;
  windowId?: number;
  currentTabId?: number;
  paused?: boolean;
  lastActive: number;
}

const COLORS: `${chrome.tabGroups.Color}`[] = ["blue", "cyan", "purple", "green", "orange", "pink", "yellow", "red"];

const KNOWN_CLIENTS: [RegExp, string][] = [
  [/claude/i, "Claude Code"],
  [/codex/i, "Codex"],
  [/gemini/i, "Gemini"],
  [/antigravity|agy/i, "Antigravity"],
  [/grok/i, "Grok"],
  [/muse/i, "Muse"],
  [/cursor/i, "Cursor"],
  [/opencode/i, "opencode"],
  [/windsurf|cascade/i, "Windsurf"],
  [/vscode|copilot/i, "Copilot"],
  [/mcp-inspector|inspector/i, "Inspector"],
];

export function prettyClient(client: string): string {
  for (const [re, name] of KNOWN_CLIENTS) if (re.test(client)) return name;
  const base = client.replace(/[-_]?(mcp)?[-_]?client$/i, "").replace(/[-_]+/g, " ").trim() || "Agent";
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

let cache: Record<string, SessionState> | null = null;

async function load(): Promise<Record<string, SessionState>> {
  if (!cache) cache = ((await chrome.storage.session.get("sessions")).sessions as Record<string, SessionState>) ?? {};
  return cache;
}

async function save() {
  if (cache) await chrome.storage.session.set({ sessions: cache });
}

export async function getSession(info: SessionInfo): Promise<SessionState> {
  const all = await load();
  let s = all[info.id];
  if (!s) {
    const pretty = prettyClient(info.client);
    const sameClient = Object.values(all).filter((x) => x.client === info.client).length;
    s = {
      id: info.id,
      client: info.client,
      title: sameClient ? `${pretty} ${sameClient + 1}` : pretty,
      color: COLORS[Object.keys(all).length % COLORS.length]!,
      lastActive: Date.now(),
    };
    all[info.id] = s;
    // Forget sessions idle for more than a day.
    for (const [k, v] of Object.entries(all)) if (Date.now() - v.lastActive > 86_400_000) delete all[k];
  }
  s.lastActive = Date.now();
  await save();
  return s;
}

export async function updateSession(s: SessionState) {
  const all = await load();
  all[s.id] = s;
  await save();
}

export async function allSessions(): Promise<SessionState[]> {
  return Object.values(await load());
}

export async function sessionsForTab(tabId: number): Promise<SessionState[]> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  return (await allSessions()).filter((s) => s.currentTabId === tabId || (tab && s.groupId !== undefined && tab.groupId === s.groupId));
}

async function groupAlive(groupId?: number) {
  if (groupId === undefined || groupId < 0) return false;
  return chrome.tabGroups.get(groupId).then(() => true, () => false);
}

async function targetWindow(s: SessionState): Promise<number> {
  if (s.windowId !== undefined) {
    const w = await chrome.windows.get(s.windowId).catch(() => null);
    if (w && w.type === "normal") return w.id!;
  }
  const w = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
  if (w?.id !== undefined && w.type === "normal") return w.id;
  const all = await chrome.windows.getAll({ windowTypes: ["normal"] });
  if (all[0]?.id !== undefined) return all[0].id;
  const created = await chrome.windows.create({ focused: false, url: "about:blank" });
  return created!.id!;
}

/** Put a tab into the session's group, creating and naming the group when needed. */
export async function ensureInGroup(s: SessionState, tabId: number): Promise<number> {
  const tab = await chrome.tabs.get(tabId);
  if (await groupAlive(s.groupId)) {
    if (tab.groupId !== s.groupId) {
      const g = await chrome.tabGroups.get(s.groupId!);
      if (g.windowId !== tab.windowId) await chrome.tabs.move(tabId, { windowId: g.windowId, index: -1 });
      await chrome.tabs.group({ groupId: s.groupId!, tabIds: [tabId] });
    }
  } else {
    s.groupId = await chrome.tabs.group({ tabIds: [tabId], createProperties: { windowId: tab.windowId } });
    await chrome.tabGroups.update(s.groupId, { title: s.title, color: s.color, collapsed: false });
  }
  s.windowId = tab.windowId;
  await updateSession(s);
  return s.groupId!;
}

export async function createTab(s: SessionState, url = "about:blank", active = false): Promise<chrome.tabs.Tab> {
  let windowId = await targetWindow(s);
  if (await groupAlive(s.groupId)) windowId = (await chrome.tabGroups.get(s.groupId!)).windowId;
  const tab = await chrome.tabs.create({ url, active, windowId });
  await ensureInGroup(s, tab.id!);
  s.currentTabId = tab.id!;
  await updateSession(s);
  return tab;
}

export async function groupTabs(s: SessionState): Promise<chrome.tabs.Tab[]> {
  if (!(await groupAlive(s.groupId))) return [];
  return chrome.tabs.query({ groupId: s.groupId });
}

/** Resolve which tab a call targets. */
export async function resolveTab(s: SessionState, tabId: unknown, createIfEmpty = true): Promise<number> {
  if (typeof tabId === "number") {
    await chrome.tabs.get(tabId).catch(() => {
      throw new Error(`Tab ${tabId} does not exist. Call tabs_context for valid tab IDs.`);
    });
    return tabId;
  }
  if (s.currentTabId !== undefined) {
    const t = await chrome.tabs.get(s.currentTabId).catch(() => null);
    if (t) return t.id!;
  }
  const inGroup = await groupTabs(s);
  if (inGroup[0]) {
    s.currentTabId = inGroup[0].id!;
    await updateSession(s);
    return s.currentTabId;
  }
  if (!createIfEmpty) throw new Error("This session has no tabs yet. Call tabs_create or navigate first.");
  return (await createTab(s)).id!;
}
