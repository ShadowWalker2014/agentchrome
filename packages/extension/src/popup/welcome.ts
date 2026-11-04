declare const __DEFAULT_SERVER__: string;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T = any>(msg: Record<string, unknown>) => chrome.runtime.sendMessage<any, T>(msg);
const shortHost = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
const STATUS_TEXT: Record<string, string> = { unpaired: "Not connected", connecting: "Connecting", connected: "Connected", disconnected: "Offline", revoked: "Removed" };

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}
const formatCode = (v: string) => {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
};

async function render() {
  const s = await send<any>({ type: "acm:status" }).catch(() => null);
  if (!s) return;
  const paired = s.status !== "unpaired" && s.status !== "revoked";
  const st = $("status");
  st.className = `status ${s.status}`;
  $("statusText").textContent = STATUS_TEXT[s.status] ?? s.status;
  $("setup").hidden = paired;
  $("done").hidden = !paired;
  const server = s.server || __DEFAULT_SERVER__;
  $<HTMLAnchorElement>("docs").href = server;
  const sv = $<HTMLInputElement>("server");
  if (!sv.value) sv.value = server;
  $("serverShort").textContent = shortHost(sv.value);
  if (paired) $("doneName").textContent = s.name || "This profile";
  const code = $<HTMLInputElement>("code");
  for (const id of ["s1", "s2", "s3"]) $(id).classList.remove("active");
  $(code.value ? "s3" : "s2").classList.add("active");
}

const code = $<HTMLInputElement>("code");
code.addEventListener("input", () => {
  code.value = formatCode(code.value);
  code.classList.toggle("complete", code.value.length === 11);
  $("pairError").hidden = true;
  render();
});
$<HTMLInputElement>("server").addEventListener("input", (e) => ($("serverShort").textContent = shortHost((e.target as HTMLInputElement).value)));

$("pairForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("pairError");
  const btn = $<HTMLButtonElement>("pair");
  const c = formatCode(code.value);
  if (c.length !== 11) {
    err.hidden = false;
    err.textContent = "Pairing codes have 10 characters, like ABCDE-FGHJK.";
    return;
  }
  err.hidden = true;
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Connecting";
  try {
    await chrome.permissions.request({ permissions: ["identity", "identity.email"] }).catch(() => false);
    const r = await send<any>({
      type: "acm:pair",
      server: $<HTMLInputElement>("server").value.trim() || __DEFAULT_SERVER__,
      code: c,
      name: $<HTMLInputElement>("pname").value.trim() || "Chrome",
    });
    if (r?.error) throw new Error(r.error);
  } catch (x) {
    err.hidden = false;
    err.textContent = String((x as Error).message ?? x).replace(/^Error: /, "");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Connect";
    render();
  }
});

const copy = async (text: string, label?: HTMLElement) => {
  await navigator.clipboard.writeText(text);
  toast("Copied to clipboard");
  if (label) {
    label.textContent = "Copied";
    setTimeout(() => (label.textContent = "Copy"), 1500);
  }
};
$("copyCmd").onclick = () => copy("npx agent-chrome-mcp setup", $("copyLabel"));
$("copyPrompt").onclick = (e) => copy("Use agent-chrome to open news.ycombinator.com and take a screenshot", (e.currentTarget as HTMLElement).querySelector(".copy") as HTMLElement);

chrome.runtime.onMessage.addListener((m) => m?.type === "acm:status-changed" && render());
render();
setInterval(render, 2000);
code.focus();
export {};
