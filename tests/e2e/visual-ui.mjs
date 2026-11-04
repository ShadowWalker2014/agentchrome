// UI QA: pairs through the real welcome-page form, then captures every surface (light + dark) and the agent cursor.
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { api, EXT_DIR, mcpClient, pageFor, signup, startFixture, SERVER } from "./harness.mjs";
const out = process.argv[2];
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "acm-ui-")), {
  headless: false, channel: "chromium", viewport: null,
  args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, "--window-size=1280,900"],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const extId = sw.url().split("/")[2];
let welcome;
for (let i = 0; i < 30 && !welcome; i++) { welcome = ctx.pages().find((p) => p.url().includes("welcome.html")); if (!welcome) await new Promise((r) => setTimeout(r, 200)); }
if (!welcome) throw new Error("welcome page did not open on install");
await welcome.bringToFront();
await welcome.setViewportSize({ width: 1100, height: 1000 });
await welcome.waitForTimeout(600);
await welcome.screenshot({ path: `${out}/welcome-1.png`, fullPage: true });
const acct = await signup();
// wrong code shows an error
await welcome.fill("#code", "aaaaabbbbb");
if ((await welcome.inputValue("#code")) !== "AAAAA-BBBBB") throw new Error("code auto-format failed");
await welcome.click("#pair");
await welcome.waitForSelector("#pairError:not([hidden])");
await welcome.screenshot({ path: `${out}/welcome-error.png`, fullPage: true });
const { code } = await api("/api/pair/new", { key: acct.apiKey, method: "POST" });
await welcome.fill("#code", code.replace("-", "").toLowerCase());
await welcome.fill("#pname", "Work");
await welcome.click("#pair");
await welcome.waitForSelector("#done:not([hidden])", { timeout: 15000 });
await welcome.waitForTimeout(700);
await welcome.screenshot({ path: `${out}/welcome-done.png`, fullPage: true });
await welcome.emulateMedia({ colorScheme: "dark" });
await welcome.screenshot({ path: `${out}/welcome-done-dark.png`, fullPage: true });

const fixture = await startFixture();
const mcp = await mcpClient(acct.apiKey, "claude-code");
const codex = await mcpClient(acct.apiKey, "codex-mcp-client");
await mcp.call("navigate", { url: fixture.url });
await codex.call("navigate", { url: `${fixture.url}/second` });
const page = pageFor(ctx, `${fixture.url}/`) ?? pageFor(ctx, fixture.url);
await mcp.call("tabs_select", { tabId: JSON.parse((await mcp.call("tabs_context")).text).currentTabId, focus: true });
await page.bringToFront();
// cursor: arrow at start, then hand over a button, captured right after arriving
const f = await mcp.call("find", { query: "Sign up now" });
const ref = f.text.match(/\[(ref_\d+)\]/)[1];
await mcp.call("computer", { action: "hover", ref });
await page.screenshot({ path: `${out}/cursor-hand.png` });
const email = (await mcp.call("find", { query: "Email address" })).text.match(/textbox "Email address" \[(ref_\d+)\]/)[1];
const moving = mcp.call("computer", { action: "left_click", ref: email });
await new Promise((r) => setTimeout(r, 120));
await page.screenshot({ path: `${out}/cursor-moving.png` });
await moving;
await page.screenshot({ path: `${out}/cursor-text.png` });
const shot = await mcp.call("computer", { action: "screenshot" });
{
  // the agent's own screenshot must not contain the overlay; checked by eye from this file
  const fs = await import("node:fs");
  fs.writeFileSync(`${out}/agent-view.jpg`, Buffer.from(shot.images[0].data, "base64"));
}
const pop = await ctx.newPage();
await pop.setViewportSize({ width: 360, height: 640 });
await pop.goto(`chrome-extension://${extId}/popup.html`);
await pop.waitForTimeout(800);
await pop.screenshot({ path: `${out}/popup-paired.png`, fullPage: true });
await pop.click(".session .chip");
await pop.waitForTimeout(500);
await pop.screenshot({ path: `${out}/popup-paused.png`, fullPage: true });
const paused = await codex.call("get_page_text").catch((e) => ({ isError: true, text: String(e) }));
const claudeOk = await mcp.call("get_page_text");
console.log("one session paused:", paused.isError ? "codex blocked" : "codex NOT blocked", "| claude:", claudeOk.isError ? "blocked" : "ok");
await pop.click("#resumeAll");
await pop.emulateMedia({ colorScheme: "dark" });
await pop.waitForTimeout(400);
await pop.screenshot({ path: `${out}/popup-dark.png`, fullPage: true });
await pop.goto(`chrome-extension://${extId}/prompt.html?id=x&host=github.com&client=Claude%20Code`);
await pop.setViewportSize({ width: 420, height: 330 });
await pop.emulateMedia({ colorScheme: "light" });
await pop.waitForTimeout(500);
await pop.screenshot({ path: `${out}/prompt.png` });
await sw.evaluate(() => chrome.storage.local.remove("connection"));
await pop.goto(`chrome-extension://${extId}/popup.html`);
await pop.setViewportSize({ width: 360, height: 520 });
await pop.waitForTimeout(600);
await pop.screenshot({ path: `${out}/popup-unpaired.png`, fullPage: true });
await mcp.close(); await codex.close(); await ctx.close(); fixture.close();
