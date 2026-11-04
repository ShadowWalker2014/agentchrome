declare const __DEFAULT_SERVER__: string;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T = any>(msg: Record<string, unknown>) => chrome.runtime.sendMessage<any, T>(msg);

const COLORS: Record<string, string> = {
  grey: "#9AA0A6", blue: "#4C8BF5", red: "#E5484D", yellow: "#F5A524", green: "#22C55E", pink: "#EC4899", purple: "#8B5CF6", cyan: "#22D3EE", orange: "#F97316",
};

async function render() {
  const s = await send<any>({ type: "acm:status" });
  if (!s) return;
  $("version").textContent = s.version;
  const st = $("status");
  st.className = `status ${s.status}`;
  st.textContent = { unpaired: "Not paired", connecting: "Connecting", connected: "Connected", disconnected: "Offline", revoked: "Removed" }[s.status as string] ?? s.status;
  const paired = s.status !== "unpaired" && s.status !== "revoked";
  $("unpaired").hidden = paired;
  $("paired").hidden = !paired;
  if (!paired) {
    const server = $<HTMLInputElement>("server");
    if (!server.value) server.value = s.server || __DEFAULT_SERVER__;
    const pname = $<HTMLInputElement>("pname");
    if (!pname.value) pname.value = s.name || "";
    if (s.status === "revoked" && s.lastError) {
      $("pairError").hidden = false;
      $("pairError").textContent = s.lastError;
    }
    return;
  }
  const name = $<HTMLInputElement>("name");
  if (document.activeElement !== name) name.value = s.name ?? "Chrome";
  $("serverLabel").textContent = (s.server ?? "").replace(/^https?:\/\//, "");
  $("deviceId").textContent = s.deviceId ?? "";
  $<HTMLInputElement>("showOverlay").checked = s.settings.showOverlay;
  $<HTMLInputElement>("askNewSites").checked = s.settings.askNewSites;
  $<HTMLInputElement>("history").checked = s.history;
  const blocked = $<HTMLTextAreaElement>("blocked");
  if (document.activeElement !== blocked) blocked.value = s.settings.blockedHosts.join("\n");
  const err = $("lastError");
  err.hidden = !(s.status !== "connected" && s.lastError);
  err.textContent = s.lastError;

  const box = $("sessions");
  const sessions = (s.sessions as any[]).sort((a, b) => b.lastActive - a.lastActive).slice(0, 8);
  if (sessions.length) {
    box.replaceChildren(
      ...sessions.map((x) => {
        const row = document.createElement("div");
        row.className = "session";
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = COLORS[x.color] ?? "#8B5CF6";
        const nm = document.createElement("span");
        nm.className = "name";
        nm.textContent = x.title;
        const meta = document.createElement("span");
        meta.className = "muted small";
        const mins = Math.round((Date.now() - x.lastActive) / 60000);
        meta.textContent = x.paused ? "paused" : mins < 1 ? "active now" : `${mins}m ago`;
        row.append(dot, nm, meta);
        if (x.paused) {
          const b = document.createElement("button");
          b.textContent = "Resume";
          b.onclick = async () => {
            await send({ type: "acm:resume-all" });
            render();
          };
          row.append(b);
        }
        return row;
      }),
    );
  }
}

$("pair").onclick = async () => {
  const btn = $<HTMLButtonElement>("pair");
  const err = $("pairError");
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Connecting…";
  try {
    // Optional: lets the extension label this profile with its Google account email.
    await chrome.permissions.request({ permissions: ["identity", "identity.email"] }).catch(() => false);
    const r = await send<any>({
      type: "acm:pair",
      server: $<HTMLInputElement>("server").value.trim() || __DEFAULT_SERVER__,
      code: $<HTMLInputElement>("code").value.trim(),
      name: $<HTMLInputElement>("pname").value.trim() || "Chrome",
    });
    if (r?.error) throw new Error(r.error);
  } catch (e) {
    err.hidden = false;
    err.textContent = String((e as Error).message ?? e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Connect";
    render();
  }
};

$<HTMLInputElement>("name").onchange = (e) => send({ type: "acm:rename", name: (e.target as HTMLInputElement).value.trim() || "Chrome" });
$("unpair").onclick = async () => {
  if (confirm("Disconnect this Chrome profile? Agents will no longer be able to use it.")) {
    await send({ type: "acm:unpair" });
    render();
  }
};
$("reconnect").onclick = async () => {
  await send({ type: "acm:reconnect" });
  setTimeout(render, 600);
};
$("stopAll").onclick = async () => {
  await send({ type: "acm:stop-all" });
  render();
};
$("resumeAll").onclick = async () => {
  await send({ type: "acm:resume-all" });
  render();
};
$<HTMLInputElement>("showOverlay").onchange = (e) => send({ type: "acm:settings", patch: { showOverlay: (e.target as HTMLInputElement).checked } });
$<HTMLInputElement>("askNewSites").onchange = (e) => send({ type: "acm:settings", patch: { askNewSites: (e.target as HTMLInputElement).checked } });
$<HTMLTextAreaElement>("blocked").onchange = (e) =>
  send({ type: "acm:settings", patch: { blockedHosts: (e.target as HTMLTextAreaElement).value.split(/\s+/).map((h) => h.trim().toLowerCase()).filter(Boolean) } });
$<HTMLInputElement>("history").onchange = async (e) => {
  const box = e.target as HTMLInputElement;
  if (box.checked) box.checked = await chrome.permissions.request({ permissions: ["history"] });
  else await chrome.permissions.remove({ permissions: ["history"] });
};
$<HTMLInputElement>("code").addEventListener("keydown", (e) => e.key === "Enter" && $("pair").click());

chrome.runtime.onMessage.addListener((m) => {
  if (m?.type === "acm:status-changed") render();
});
render();
setInterval(render, 3000);
