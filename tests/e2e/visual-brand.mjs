// Screenshots of the branded surfaces: landing page, popup (unpaired + paired), in-page overlay.
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { api, EXT_DIR, mcpClient, pageFor, signup, startFixture, SERVER } from "./harness.mjs";
const out = process.argv[2];
const b = await chromium.launch();
const land = await b.newPage({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 1 });
await land.route("**/logo.svg", (r) => r.fulfill({ path: join(process.cwd(), "brand/logo.svg") })); await land.goto(`file://${join(process.cwd(), "packages/server/public/index.html")}`);
await land.waitForTimeout(800);
await land.screenshot({ path: `${out}/landing.png` });
await b.close();

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "acm-v-")), {
  headless: false, channel: "chromium", viewport: null,
  args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, "--window-size=1280,860"],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const extId = sw.url().split("/")[2];
const pop = await ctx.newPage();
await pop.setViewportSize({ width: 344, height: 560 });
await pop.goto(`chrome-extension://${extId}/popup.html`);
await pop.waitForTimeout(500);
await pop.screenshot({ path: `${out}/popup-unpaired.png`, fullPage: true });
const acct = await signup();
const { code } = await api("/api/pair/new", { key: acct.apiKey, method: "POST" });
await sw.evaluate(([s, c]) => globalThis.__acmPair(s, c, "Work"), [SERVER, code]);
const fixture = await startFixture();
const mcp = await mcpClient(acct.apiKey, "claude-code");
await mcp.call("navigate", { url: fixture.url });
await pop.reload();
await pop.waitForTimeout(700);
await pop.screenshot({ path: `${out}/popup-paired.png`, fullPage: true });
await pop.close();
const page = pageFor(ctx, fixture.url);
await page.bringToFront();
const slow = mcp.call("computer", { action: "wait", duration: 3 });
await new Promise((r) => setTimeout(r, 1300));
await page.screenshot({ path: `${out}/overlay.png` });
await slow;
await mcp.close();
await ctx.close();
fixture.close();
