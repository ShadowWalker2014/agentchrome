// Close-up captures of the agent badge in the status pill and the cursor tag, for each agent logo.
import { launchBrowser, mcpClient, pageFor, signup, startFixture } from "./harness.mjs";
const out = process.argv[2];
const fixture = await startFixture();
const acct = await signup();
const b = await launchBrowser(acct.apiKey, "Badges");
for (const client of ["claude-code", "codex-mcp-client", "gemini-cli-mcp-client", "antigravity", "grok-cli", "muse", "opencode"]) {
  const m = await mcpClient(acct.apiKey, client);
  await m.call("navigate", { url: `${fixture.url}/edge` });
  const page = b.context.pages().filter((p) => p.url().includes("/edge")).pop();
  await page.bringToFront();
  const ref = (await m.call("find", { query: "Ask name" })).text.match(/\[(ref_\d+)\]/)[1];
  const slow = (async () => { await m.call("computer", { action: "hover", ref }); await m.call("computer", { action: "wait", duration: 2 }); })();
  await new Promise((r) => setTimeout(r, 1200));
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const btn = await page.evaluate(() => { const r = document.getElementById("promptBtn").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.screenshot({ path: `${out}/${client}-pill.png`, clip: { x: vp.w / 2 - 170, y: vp.h - 70, width: 340, height: 64 } });
  await page.screenshot({ path: `${out}/${client}-cursor.png`, clip: { x: btn.x - 20, y: btn.y - 20, width: 200, height: 70 } });
  await slow;
  await m.close();
}
await b.close();
fixture.close();
