// Launch a test Chromium with the installed extension, pair it to the account in ~/.config/agentchrome,
// and keep it open so real agent CLIs can drive it. Usage: node tests/e2e/hold-browser.mjs [name] [extDir]
import { chromium } from "playwright";
import { readFileSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
const name = process.argv[2] ?? "Agent Test Chrome";
const ext = process.argv[3] ?? join(homedir(), ".agentchrome/extension");
const cfg = JSON.parse(readFileSync(join(homedir(), ".config/agentchrome/config.json"), "utf8"));
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "acm-hold-")), {
  headless: false, channel: "chromium", viewport: null,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--window-size=1280,900"],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const { code } = await (await fetch(`${cfg.server}/api/pair/new`, { method: "POST", headers: { authorization: `Bearer ${cfg.apiKey}` } })).json();
const id = await sw.evaluate(([s, c, n]) => globalThis.__acmPair(s, c, n), [cfg.server, code, name]);
console.log(`paired ${name} as ${id}`);
setInterval(() => {}, 1 << 30);
