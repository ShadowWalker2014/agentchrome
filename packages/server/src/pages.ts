export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="32" height="32" aria-hidden="true"><defs><linearGradient id="p-tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C82FF"/><stop offset="1" stop-color="#1F55F0"/></linearGradient><linearGradient id="p-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".06"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><filter id="p-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0B2A8A" flood-opacity=".35"/></filter></defs><rect width="128" height="128" rx="30" fill="url(#p-tile)"/><rect x=".75" y=".75" width="126.5" height="126.5" rx="29.25" fill="none" stroke="url(#p-edge)" stroke-width="1.5"/><g filter="url(#p-shadow)"><path d="M28 46V38a10 10 0 0 1 10-10h8M82 28h8a10 10 0 0 1 10 10v8M100 82v8a10 10 0 0 1-10 10h-8M46 100h-8a10 10 0 0 1-10-10v-8" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/><path d="M56 50.5v30.2c0 1.3 1.6 1.9 2.5 1l6.9-6.8 5.2 11.6c.4.8 1.3 1.2 2.1.8l3.8-1.7c.8-.4 1.2-1.3.8-2.1l-5.2-11.5h10c1.3 0 2-1.6 1-2.5L58.5 49.5c-.9-.9-2.5-.3-2.5 1z" fill="#FFFFFF"/></g></svg>`;

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Agent Chrome</title>
<style>
:root{color-scheme:light dark;--bg:#FAFAFA;--card:#FFFFFF;--fg:#09090B;--muted:#71717A;--line:rgba(9,9,11,.08);--primary:#2F6BFF;--on-primary:#FFFFFF;--hover:rgba(9,9,11,.04)}
@media (prefers-color-scheme:dark){:root{--bg:#0A0A0B;--card:#131315;--fg:#FAFAFA;--muted:#A1A1AA;--line:rgba(255,255,255,.08);--primary:#3D77FF;--on-primary:#FFFFFF;--hover:rgba(255,255,255,.05)}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:14.5px/1.5 Inter,"SF Pro Text",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased;padding:24px}
.card{width:100%;max-width:420px;background:var(--card);border-radius:16px;padding:28px;box-shadow:0 0 0 1px var(--line),0 24px 48px -24px rgba(0,0,0,.25)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px;font-weight:600;font-size:15px;letter-spacing:-.02em}.brand svg{border-radius:8px}
h1{font-size:20px;font-weight:600;letter-spacing:-.025em;margin:0 0 6px}p{color:var(--muted);margin:0 0 16px}
label{display:block;font-weight:500;font-size:13px;margin:16px 0 6px}
input{width:100%;padding:10px 12px;border-radius:9px;border:0;box-shadow:inset 0 0 0 1px var(--line);background:var(--bg);color:var(--fg);font:13px ui-monospace,"SF Mono",SFMono-Regular,Menlo,monospace}
input:focus{outline:none;box-shadow:inset 0 0 0 1px var(--muted),0 0 0 3px var(--hover)}
.row{display:flex;gap:8px;margin-top:20px}
button{flex:1;height:38px;border-radius:9px;border:0;box-shadow:inset 0 0 0 1px var(--line);background:transparent;color:var(--fg);font:inherit;font-weight:500;cursor:pointer}
button:hover{background:var(--hover)}
button.primary{background:var(--primary);color:var(--on-primary);box-shadow:none}button.primary:hover{opacity:.88}
.client{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line);margin:16px 0}
.scopes{margin:12px 0 0;padding-left:18px;color:var(--muted);font-size:13.5px}.scopes li{margin:3px 0}
.err{color:#E5484D;font-size:13px;margin-top:10px}
button.wide{width:100%;flex:none;height:42px}
.fine{font-size:12.5px;text-align:center;margin:8px 0 0}
button.link{flex:none;height:auto;padding:0;border:0;box-shadow:none;background:none;color:var(--muted);font-size:13px;font-weight:500;margin-left:auto}
button.link:hover{color:var(--fg);background:none}
.who{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line);font-size:14px}
.who .dot{width:8px;height:8px;border-radius:50%;background:#30A46C;box-shadow:0 0 0 3px rgba(48,164,108,.18)}
.done{text-align:center;padding:12px 0}
.done .check{width:52px;height:52px;margin:0 auto 18px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(180deg,#4C82FF,#1F55F0);box-shadow:0 10px 30px -8px rgba(47,107,255,.6)}
.divider{display:flex;align-items:center;gap:12px;margin:22px 0 12px;color:var(--muted);font-size:12.5px}.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--line)}
button.ghost{width:100%;flex:none}
.keybox{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 14px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line);background:var(--bg);margin:6px 0 16px}
.keybox code{flex:1;background:none;box-shadow:none;padding:0;word-break:break-all;font-size:12.5px}
.keybox .copy{flex:none;height:30px;padding:0 12px}
code{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--hover);box-shadow:inset 0 0 0 1px var(--line);padding:1px 6px;border-radius:5px}
</style></head><body><main class="card"><div class="brand">${LOGO_SVG}<span>Agent Chrome</span></div>${body}</main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'sha256-TJ7ojLxLIPg7MM8NkXC0xR2sFEDO14tQr7rJ6wuXK7o='; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
    },
  });
}

export interface SignInOpts {
  heading: string;
  intro: string;
  /** Shown as the app being connected (OAuth clients). */
  client?: { name: string; host: string };
  bullets?: string[];
  signedInAs?: string;
  continueLabel: string;
  canSignUp: boolean;
  error?: string;
}

const shortId = (id: string) => `${id.slice(0, 9)}…${id.slice(-4)}`;

/** One sign-in screen for both the extension's Connect flow and OAuth clients (Claude, ChatGPT, Codex…). */
export function signInPage(o: SignInOpts) {
  const client = o.client
    ? `<div class="client"><strong>${esc(o.client.name)}</strong><span style="color:var(--muted);font-size:13px">${esc(o.client.host)}</span></div>`
    : "";
  const bullets = o.bullets?.length ? `<ul class="scopes">${o.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
  const err = o.error ? `<div class="err">${esc(o.error)}</div>` : "";
  const body = o.signedInAs
    ? `<form method="POST">
<div class="who"><span class="dot"></span><span>Signed in as <b>${esc(shortId(o.signedInAs))}</b></span><button class="link" type="submit" name="decision" value="signout" formnovalidate>Switch account</button></div>
${err}
<div class="row">${o.client ? `<button type="submit" name="decision" value="deny" formnovalidate>Cancel</button>` : ""}<button class="primary" type="submit" name="decision" value="allow">${esc(o.continueLabel)}</button></div>
</form>`
    : `<form method="POST">
${o.canSignUp ? `<button class="primary wide" type="submit" name="decision" value="create" formnovalidate>Create a free account</button>
<p class="fine">No email or password needed. You get an account key to save.</p>
<div class="divider"><span>or sign in with your account key</span></div>` : ""}
<input id="key" name="api_key" type="password" autocomplete="current-password" placeholder="acm_sk_…" aria-label="Account key">
${err}
<div class="row">${o.client ? `<button type="submit" name="decision" value="deny" formnovalidate>Cancel</button>` : ""}<button class="${o.canSignUp ? "" : "primary"}" type="submit" name="decision" value="allow">Sign in</button></div>
</form>`;
  return page(o.heading, `<h1>${esc(o.heading)}</h1><p>${esc(o.intro)}</p>${client}${bullets}${body}`);
}

export function newKeyPage(apiKey: string, continueLabel: string) {
  return page(
    "Your account key",
    `<h1>Your account is ready</h1>
<p>This is your account key. Save it in your password manager: it signs you in on other computers, and it is shown only once.</p>
<div class="keybox"><code id="k">${esc(apiKey)}</code><button type="button" class="copy">Copy</button></div>
<form method="POST"><div class="row"><button class="primary" type="submit" name="decision" value="allow">${esc(continueLabel)}</button></div></form><script>document.querySelectorAll('.copy').forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(document.getElementById('k').textContent);b.textContent='Copied'}})</script>`,
  );
}

export function doneConnectPage(name: string) {
  return page(
    "Connected",
    `<div class="done"><div class="check"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
<h1>${esc(name)} is connected</h1><p>You can close this tab. The extension finishes on its own.</p></div>`,
  );
}
