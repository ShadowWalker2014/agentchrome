// Produces the README media with the real product: agent-view clip, clean (natural cursor) clip,
// a hero still, the popup with two agents, and the welcome page.
import { writeFileSync } from "node:fs";
import { launchBrowser, mcpClient, pageFor, signup } from "./harness.mjs";
const out = process.argv[2];
const acct = await signup();
const b = await launchBrowser(acct.apiKey, "Work");
const claude = await mcpClient(acct.apiKey, "claude-code");
const codex = await mcpClient(acct.apiKey, "codex-mcp-client");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ref = (t, re) => t.match(re)?.[1];

async function flow(m, { still } = {}) {
  await m.call("navigate", { url: "https://en.wikipedia.org/wiki/Main_Page" });
  await sleep(900);
  const box = ref((await m.call("find", { query: "Search Wikipedia input" })).text, /(?:searchbox|textbox|combobox) "Search Wikipedia" \[(ref_\d+)\]/);
  await m.call("computer", { action: "left_click", ref: box });
  await sleep(300);
  await m.call("computer", { action: "type", text: "Model Context Protocol" });
  await sleep(500);
  if (still) await still();
  await m.call("computer", { action: "key", text: "Enter" });
  await m.call("wait_for", { selector: "#firstHeading", timeoutMs: 15000 });
  await sleep(1200);
  for (let i = 0; i < 3; i++) {
    await m.call("computer", { action: "scroll", scroll_direction: "down", scroll_amount: 4 });
    await sleep(700);
  }
  const link = ref((await m.call("find", { query: "Anthropic link" })).text, /link "Anthropic[^"]*" \[(ref_\d+)\]/);
  if (link) {
    await m.call("computer", { action: "hover", ref: link });
    await sleep(900);
  }
  await m.call("computer", { action: "scroll", scroll_direction: "up", scroll_amount: 12 });
  await sleep(800);
}

// Codex works in parallel in its own group.
await codex.call("navigate", { url: "https://news.ycombinator.com" });

// 1) What you see while an agent works: border, pill, agent cursor with its logo.
await claude.call("tabs_context");
const page = () => b.context.pages().find((p) => p.url().includes("wikipedia"));
await claude.call("record", { action: "start", cursor: "agent", fps: 24 });
await flow(claude, {
  still: async () => {
    await page()?.bringToFront();
    await page()?.screenshot({ path: `${out}/hero.png` });
  },
});
let stop = await claude.call("record", { action: "stop", filename: "agent-view" });
writeFileSync(`${out}/agent-view.mp4`, Buffer.from(await (await fetch(stop.text.match(/URL: (\S+)/)[1])).arrayBuffer()));

// 2) A clean POV recording for sharing: natural cursor, no indicators.
await claude.call("record", { action: "start", cursor: "natural", fps: 24 });
await flow(claude);
stop = await claude.call("record", { action: "stop", filename: "clean-recording" });
writeFileSync(`${out}/clean-recording.mp4`, Buffer.from(await (await fetch(stop.text.match(/URL: (\S+)/)[1])).arrayBuffer()));

// 3) The popup with both agents.
const extId = b.sw.url().split("/")[2];
const pop = await b.context.newPage();
await pop.setViewportSize({ width: 360, height: 700 });
await pop.goto(`chrome-extension://${extId}/popup.html`);
await sleep(900);
await pop.screenshot({ path: `${out}/popup.png`, fullPage: true });
await pop.emulateMedia({ colorScheme: "dark" });
await sleep(300);
await pop.screenshot({ path: `${out}/popup-dark.png`, fullPage: true });
await pop.goto(`chrome-extension://${extId}/welcome.html`);
await pop.setViewportSize({ width: 1100, height: 900 });
await pop.emulateMedia({ colorScheme: "light" });
await sleep(900);
await pop.screenshot({ path: `${out}/welcome.png` });
await claude.close();
await codex.close();
await b.close();
console.log("demo media written");
