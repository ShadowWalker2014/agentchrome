export interface Settings {
  /** Ask before the agent touches a site it has not used before. */
  askNewSites: boolean;
  allowedHosts: string[];
  blockedHosts: string[];
  /** Show the pulsing border and status pill while the agent works. */
  showOverlay: boolean;
}

export interface Connection {
  server?: string;
  deviceToken?: string;
  deviceId?: string;
  accountId?: string;
  name?: string;
}

const DEFAULTS: Settings = { askNewSites: false, allowedHosts: [], blockedHosts: [], showOverlay: true };

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>) {
  const s = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: s });
  return s;
}

export async function getConnection(): Promise<Connection> {
  const { connection } = await chrome.storage.local.get("connection");
  return (connection as Connection) ?? {};
}

export async function setConnection(c: Connection) {
  await chrome.storage.local.set({ connection: c });
}

export const hostOf = (url?: string) => {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : "";
  } catch {
    return "";
  }
};

const matches = (host: string, pattern: string) => host === pattern || host.endsWith(`.${pattern.replace(/^\*\./, "")}`);

const pendingPrompts = new Map<string, (v: "once" | "always" | "deny") => void>();

export function resolvePrompt(id: string, v: "once" | "always" | "deny") {
  pendingPrompts.get(id)?.(v);
  pendingPrompts.delete(id);
}

const allowedOnce = new Set<string>();

/** Enforce the block list and, when enabled, ask the user before visiting a new site. */
export async function gate(url: string | undefined, client: string) {
  const host = hostOf(url);
  if (!host) return;
  const s = await getSettings();
  if (s.blockedHosts.some((p) => matches(host, p))) throw new Error(`${host} is blocked in the Agent Chrome MCP extension settings.`);
  if (!s.askNewSites || s.allowedHosts.some((p) => matches(host, p)) || allowedOnce.has(host)) return;
  const id = crypto.randomUUID();
  const answer = await new Promise<"once" | "always" | "deny">((resolve) => {
    pendingPrompts.set(id, resolve);
    chrome.windows.create({
      url: chrome.runtime.getURL(`prompt.html?id=${id}&host=${encodeURIComponent(host)}&client=${encodeURIComponent(client)}`),
      type: "popup",
      width: 420,
      height: 300,
      focused: true,
    });
    setTimeout(() => {
      if (pendingPrompts.has(id)) resolvePrompt(id, "deny");
    }, 120_000);
  });
  if (answer === "deny") throw new Error(`The user declined access to ${host}.`);
  if (answer === "always") await setSettings({ allowedHosts: [...s.allowedHosts, host] });
  else allowedOnce.add(host);
}
