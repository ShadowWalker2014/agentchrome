// Captures what the user sees: the glowing border + pill, and a frame from a recorded video.
import { launchBrowser, mcpClient, pageFor, signup, startFixture } from "./harness.mjs";
import { writeFileSync } from "node:fs";
const out = process.argv[2] ?? ".";
const fixture = await startFixture();
const acct = await signup();
const b = await launchBrowser(acct.apiKey, "Visual");
const mcp = await mcpClient(acct.apiKey, "claude-code");
await mcp.call("navigate", { url: fixture.url });
const page = pageFor(b.context, fixture.url);
await page.bringToFront();
// Keep the overlay in "working" state while we capture.
const slow = mcp.call("computer", { action: "wait", duration: 3 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${out}/overlay-working.png` });
await slow;
await mcp.call("record", { action: "start" });
await mcp.call("computer", { action: "left_click", ref: (await mcp.call("find", { query: "Click me" })).text.match(/\[(ref_\d+)\]/)[1] });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${out}/overlay-recording.png` });
const stop = await mcp.call("record", { action: "stop" });
const url = stop.text.match(/URL: (\S+)/)[1];
writeFileSync(`${out}/recording.${url.endsWith(".webm") ? "webm" : "mp4"}`, Buffer.from(await (await fetch(url)).arrayBuffer()));
console.log(stop.text);
await mcp.close();
await b.close();
fixture.close();
