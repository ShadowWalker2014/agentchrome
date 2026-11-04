// Each MCP session owns one Chrome tab group per browser profile. State lives in storage.session
// so it survives service-worker restarts but not a browser restart.

import { agentFor, type SessionInfo } from "@agentchrome/protocol";

export interface SessionState {
  id: string;
  client: string;
  /** Icon key of the agent (claude, codex, gemini, …) or "" when unknown. */
  agent: string;
  title: string;
  color: `${chrome.tabGroups.Color}`;
  groupId?: number;
  windowId?: number;
  currentTabId?: number;
  paused?: boolean;
  /** "stop" (Stop button) or "debugger" (Cancel on Chrome's debugging bar). */
  pausedReason?: string;
  lastActive: number;
}

const COLORS: `${chrome.tabGroups.Color}`[] = ["blue", "cyan", "purple", "green", "orange", "pink", "yellow", "red"];

export function prettyClient(client: string): string {
  return agentFor(client).name;
}

let cache: Record<string, SessionState> | null = null;

// Sessions live in storage.local so they survive extension updates, reloads and Chrome restarts.
// Entries are removed when their tab group closes, when idle for a day, or when their group is gone at startup.
async function load(): Promise<Record<string, SessionState>> {
  if (!cache) {
    cache = ((await chrome.storage.local.get("sessions")).sessions as Record<string, SessionState>) ?? {};
    await reconcile(cache);
  }
  return cache;
}

async function save() {
  if (cache) await chrome.storage.local.set({ sessions: cache });
}

/** Drop stale entries and forget groups/tabs that no longer exist. */
async function reconcile(all: Record<string, SessionState>) {
  for (const [id, s] of Object.entries(all)) {
    if (Date.now() - s.lastActive > 86_400_000) {
      delete all[id];
      continue;
    }
    if (s.groupId !== undefined && !(await groupAlive(s.groupId))) s.groupId = undefined;
    if (s.currentTabId !== undefined && !(await chrome.tabs.get(s.currentTabId).catch(() => null))) s.currentTabId = undefined;
  }
  await chrome.storage.local.set({ sessions: all });
}

chrome.tabGroups.onRemoved.addListener(async (group) => {
  const all = await load();
  let changed = false;
  for (const s of Object.values(all)) {
    if (s.groupId === group.id) {
      s.groupId = undefined;
      s.currentTabId = undefined;
      changed = true;
    }
  }
  if (changed) await save();
});

export async function getSession(info: SessionInfo): Promise<SessionState> {
  const all = await load();
  let s = all[info.id];
  if (!s) {
    const pretty = prettyClient(info.client);
    const sameClient = Object.values(all).filter((x) => x.client === info.client).length;
    s = {
      id: info.id,
      client: info.client,
      agent: agentFor(info.client).key,
      title: sameClient ? `${pretty} ${sameClient + 1}` : pretty,
      color: COLORS[Object.keys(all).length % COLORS.length]!,
      lastActive: Date.now(),
    };
    all[info.id] = s;
    // After an update that lost state, reuse an unclaimed group with this agent's name instead of opening a duplicate.
    const claimed = new Set(Object.values(all).map((x) => x.groupId).filter((g) => g !== undefined));
    const orphan = (await chrome.tabGroups.query({ title: s.title })).find((g) => !claimed.has(g.id));
    if (orphan) {
      s.groupId = orphan.id;
      s.windowId = orphan.windowId;
      s.currentTabId = (await chrome.tabs.query({ groupId: orphan.id }))[0]?.id;
    }
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
