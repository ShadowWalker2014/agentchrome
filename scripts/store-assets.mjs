// Renders Chrome Web Store assets into store/: five 1280x800 screenshots, the 440x280 promo tile and the 1400x560 marquee.
// node scripts/store-assets.mjs
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_ICONS } from "../packages/protocol/src/agent-icons.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "store");
mkdirSync(out, { recursive: true });
const img = (p, type = "image/png") => `data:${type};base64,${readFileSync(join(root, p)).toString("base64")}`;
const logo = readFileSync(join(root, "brand/logo.svg"), "utf8");
const hero = img("docs/media/hero.png");
const popup = img("docs/media/popup.png");
const clean = img("store/src/clean-frame.png");

const AGENTS = [
  ["claude", "Claude Code"],
  ["codex", "Codex"],
  ["gemini", "Gemini CLI"],
  ["cursor", "Cursor"],
  ["antigravity", "Antigravity"],
  ["grok", "Grok"],
  ["opencode", "opencode"],
  ["muse", "Muse"],
  ["windsurf", "Windsurf"],
];

const css = `
*{box-sizing:border-box;margin:0}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;color:#FAFAFA;background:#0A0A0B;overflow:hidden}
.stage{position:relative;width:100vw;height:100vh;background:radial-gradient(900px 520px at 78% -10%,rgba(47,107,255,.35),transparent 70%),radial-gradient(700px 400px at -10% 110%,rgba(47,107,255,.18),transparent 70%),#0A0A0B}
.brand{display:flex;align-items:center;gap:12px;font-weight:600;font-size:22px;letter-spacing:-.02em}
.brand svg{width:40px;height:40px}
h1{font-size:52px;line-height:1.06;letter-spacing:-.035em;font-weight:650}
p.sub{font-size:21px;line-height:1.5;color:#A1A1AA;letter-spacing:-.01em}
.win{border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}
.bar{height:44px;background:#DEE1E6;display:flex;align-items:flex-end;gap:6px;padding:0 12px}
.dots{display:flex;gap:7px;align-self:center;margin-right:8px}.dots i{width:12px;height:12px;border-radius:50%;background:#FF5F57}.dots i:nth-child(2){background:#FEBC2E}.dots i:nth-child(3){background:#28C840}
.chip{align-self:center;font:600 12px Inter,system-ui;color:#fff;background:#2F6BFF;border-radius:6px;padding:4px 9px}
.chip.g{background:#1E8E3E}.chip.o{background:#E8710A}
.tab{background:#fff;border-radius:9px 9px 0 0;height:34px;padding:0 14px;display:flex;align-items:center;gap:8px;font:500 13px Inter,system-ui;color:#3C4043;min-width:170px;border-top:3px solid #2F6BFF}
.tab.dim{background:transparent;border-top-color:transparent}
.tab.gr{border-top-color:#1E8E3E}
.url{height:38px;background:#fff;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;padding:0 14px}
.url span{flex:1;height:26px;border-radius:13px;background:#F1F3F4;font:13px Inter,system-ui;color:#5F6368;display:flex;align-items:center;padding:0 14px}
.shot{display:block;width:100%}
ul.points{list-style:none;padding:0;display:grid;gap:18px}
ul.points li{display:flex;gap:14px;align-items:flex-start;font-size:20px;line-height:1.4;color:#E4E4E7}
ul.points b{color:#fff;font-weight:600}
.tick{flex:none;width:28px;height:28px;border-radius:8px;background:rgba(47,107,255,.18);box-shadow:inset 0 0 0 1px rgba(122,162,255,.4);display:grid;place-items:center;color:#7AA2FF;font-weight:700;font-size:15px}
.cmd{font:500 19px "JetBrains Mono",ui-monospace,Menlo,monospace;background:#111113;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);border-radius:12px;padding:16px 20px;color:#E4E4E7}
.cmd b{color:#7AA2FF;font-weight:500}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.agent{display:flex;align-items:center;gap:14px;background:#111113;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);border-radius:14px;padding:16px 18px;font-size:19px;font-weight:550}
.agent .ic{width:40px;height:40px;border-radius:10px;background:#fff;display:grid;place-items:center;padding:7px}
.agent .ic svg{width:100%;height:100%}
`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"><style>${css}</style></head><body><div class="stage">${body}</div></body></html>`;
const brand = `<div class="brand">${logo}Agent Chrome</div>`;
const tick = `<span class="tick">✓</span>`;
const windowFrame = (shot, tabs) => `<div class="win"><div class="bar"><div class="dots"><i></i><i></i><i></i></div>${tabs}</div><div class="url"><span>en.wikipedia.org</span></div><img class="shot" src="${shot}"></div>`;

const screens = {
  "1-hero": page(`
    <div style="position:absolute;left:72px;top:64px;width:460px">${brand}
      <h1 style="margin-top:40px">Let your AI agent use your real Chrome</h1>
      <p class="sub" style="margin-top:22px">Claude Code, Codex, Gemini CLI and other agents work in the Chrome profiles you're already signed in to, with no separate browser and no shared passwords.</p>
    </div>
    <div style="position:absolute;left:580px;top:96px;width:900px">${windowFrame(hero, `<span class="chip">Claude Code</span><div class="tab">Wikipedia</div><div class="tab dim">Your tabs</div>`)}</div>`),
  "2-control": page(`
    <div style="position:absolute;left:72px;top:64px;width:600px">${brand}
      <h1 style="margin-top:40px">You can see it work, and stop it any time</h1>
      <ul class="points" style="margin-top:36px">
        <li>${tick}<span><b>Its own tab group.</b> Each agent session gets a named, colored group, apart from your tabs.</span></li>
        <li>${tick}<span><b>A visible cursor and a Stop button</b> on the page while it works.</span></li>
        <li>${tick}<span><b>Pause or stop every agent</b> from the toolbar, block sites, or approve each new site.</span></li>
        <li>${tick}<span><b>It asks first</b> before buying, sending or deleting anything.</span></li>
      </ul>
    </div>
    <img src="${popup}" style="position:absolute;right:110px;top:44px;height:712px;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.1)">`),
  "3-capture": page(`
    <div style="position:absolute;left:72px;top:64px;width:470px">${brand}
      <h1 style="margin-top:40px">Screenshots and clean video clips</h1>
      <ul class="points" style="margin-top:36px">
        <li>${tick}<span><b>MP4 or GIF recordings</b> with a natural cursor, and no border or name tag in the clip.</span></li>
        <li>${tick}<span><b>Smooth scrolling videos</b> of a whole page in one step.</span></li>
        <li>${tick}<span><b>Long full-page screenshots</b>, even of apps that scroll inside a panel.</span></li>
      </ul>
    </div>
    <div style="position:absolute;left:590px;top:150px;width:880px">${windowFrame(clean, `<div class="tab">Recording</div>`)}</div>
    <div style="position:absolute;left:620px;top:110px" class="chip o">● REC 00:07</div>`),
  "4-agents": page(`
    <div style="position:absolute;left:72px;top:64px;right:72px">${brand}
      <h1 style="margin-top:40px">Works with the agents you already use</h1>
      <p class="sub" style="margin-top:16px;max-width:880px">One command connects every agent on your computer. Several Chrome profiles, such as Work and Personal, can be connected at once.</p>
      <div class="grid" style="margin-top:36px">${AGENTS.map(([k, n]) => `<div class="agent"><span class="ic">${AGENT_ICONS[k]}</span>${n}</div>`).join("")}</div>
      <div class="cmd" style="margin-top:28px"><b>$</b> curl -fsSL https://agentchrome.dev/install | sh</div>
    </div>`),
  "5-connectors": page(`
    <div style="position:absolute;left:72px;top:64px;width:620px">${brand}
      <h1 style="margin-top:40px">Use it from Claude and ChatGPT too</h1>
      <p class="sub" style="margin-top:22px">Add Agent Chrome as a connector, sign in, then say "connect my Chrome".</p>
      <div class="cmd" style="margin-top:32px">https://agentchrome.dev/mcp</div>
      <ul class="points" style="margin-top:36px">
        <li>${tick}<span><b>Open source</b> under the MIT license.</span></li>
        <li>${tick}<span><b>Private by design:</b> page content isn't stored, and keys are kept only as hashes.</span></li>
        <li>${tick}<span><b>Hosted or fully local,</b> your choice.</span></li>
      </ul>
    </div>
    <div style="position:absolute;right:80px;top:150px;width:470px;display:grid;gap:18px">
      ${[["claude", "Claude", "Customize › Connectors › Add custom connector"], ["codex", "ChatGPT", "Settings › Apps &amp; Connectors › Developer mode"]].map(([k, n, s]) => `<div class="agent" style="padding:26px 24px;align-items:flex-start"><span class="ic" style="width:56px;height:56px">${AGENT_ICONS[k]}</span><div><div style="font-size:24px">${n}</div><div style="font-size:16px;color:#A1A1AA;font-weight:400;margin-top:6px">${s}</div></div></div>`).join("")}
    </div>`),
};

const tile = (w, h, big) =>
  `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;650&display=swap" rel="stylesheet"><style>*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,system-ui;-webkit-font-smoothing:antialiased;color:#fff;background:radial-gradient(${w}px ${h}px at 85% 0%,rgba(76,130,255,.55),transparent 70%),linear-gradient(135deg,#0B1530,#0A0A0B);display:flex;align-items:center;padding:0 ${big ? 110 : 34}px;gap:${big ? 48 : 22}px}svg{width:${big ? 200 : 96}px;height:${big ? 200 : 96}px;flex:none;filter:drop-shadow(0 12px 30px rgba(47,107,255,.45))}h1{font-size:${big ? 76 : 36}px;font-weight:650;letter-spacing:-.04em;line-height:1}p{font-size:${big ? 30 : 16}px;color:#C7D2FE;margin-top:${big ? 20 : 10}px;line-height:1.3;font-weight:500;letter-spacing:-.01em}</style></head><body>${logo}<div><h1>Agent Chrome</h1><p>Let AI agents use your real Chrome${big ? ", in their own tab group" : ""}</p></div></body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const [name, html] of Object.entries(screens)) {
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.screenshot({ path: join(out, `screenshot-${name}.png`) });
}
for (const [name, w, h, big] of [["promo-small-440x280", 440, 280, false], ["marquee-1400x560", 1400, 560, true]]) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(tile(w, h, big), { waitUntil: "networkidle" });
  await p.screenshot({ path: join(out, `${name}.png`) });
}
await browser.close();
console.log("store assets written to", out);
