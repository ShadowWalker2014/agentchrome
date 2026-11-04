// Edge cases: native drag and drop, pointer drags, file pickers, local paths, drop zones, dialogs,
// new tabs, downloads, HTTP errors, restricted pages and file URLs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchBrowser, mcpClient, pageFor, signup, startFixture } from "./harness.mjs";

let fixture, browser, mcp, page;
const refOf = (text, re) => text.match(re)?.[1];
const b64 = (s) => Buffer.from(s).toString("base64");

before(async () => {
  fixture = await startFixture();
  const acct = await signup();
  browser = await launchBrowser(acct.apiKey, "Edge");
  mcp = await mcpClient(acct.apiKey, "claude-code");
  await mcp.call("navigate", { url: `${fixture.url}/edge` });
  page = pageFor(browser.context, "/edge");
  page.on("dialog", () => {}); // keep Playwright from auto-dismissing dialogs
});

after(async () => {
  await mcp?.close().catch(() => {});
  await browser?.close();
  fixture?.close();
});

test("native HTML5 drag and drop by ref", async () => {
  const tree = (await mcp.call("read_page", {})).text;
  const card = refOf(tree, /"Drag me" \[(ref_\d+)\]/) ?? refOf((await mcp.call("find", { query: "Drag me" })).text, /\[(ref_\d+)\]/);
  const zone = refOf((await mcp.call("find", { query: "Drop here" })).text, /\[(ref_\d+)\]/);
  const r = await mcp.call("computer", { action: "left_click_drag", start_ref: card, ref: zone });
  assert.match(r.text, /native drag and drop/, r.text);
  assert.equal(await page.textContent("#dndOut"), "dropped:card-1");
});

test("pointer-event drag moves a slider", async () => {
  const shot = await mcp.call("computer", { action: "screenshot" });
  assert.ok(shot.images.length);
  const box = await page.evaluate(() => {
    const k = document.getElementById("knob").getBoundingClientRect();
    const s = document.getElementById("slider").getBoundingClientRect();
    return { kx: k.x + k.width / 2, ky: k.y + k.height / 2, sx: s.x + s.width * 0.75 };
  });
  const scale = Number(shot.text.match(/\((\d+)x/)[1]) / (await page.evaluate(() => innerWidth));
  const r = await mcp.call("computer", {
    action: "left_click_drag",
    start_coordinate: [Math.round(box.kx * scale), Math.round(box.ky * scale)],
    coordinate: [Math.round(box.sx * scale), Math.round(box.ky * scale)],
  });
  assert.doesNotMatch(r.text, /native/);
  const v = Number(await page.textContent("#sliderOut"));
  assert.ok(v >= 70 && v <= 80, `slider at ${v}`);
});

test("clicking an upload button holds the native file picker; file_upload fills it", async () => {
  const btn = refOf((await mcp.call("find", { query: "Upload avatar" })).text, /\[(ref_\d+)\]/);
  const r = await mcp.call("computer", { action: "left_click", ref: btn });
  assert.match(r.text, /tried to open a file picker \(one file\)/, r.text);
  const u = await mcp.call("file_upload", { files: [{ name: "avatar.txt", mimeType: "text/plain", base64: b64("hello") }] });
  assert.ok(!u.isError, u.text);
  assert.equal(await page.textContent("#upOut"), "avatar.txt:5");
  const again = await mcp.call("file_upload", { files: [{ name: "x.txt", base64: b64("x") }] });
  assert.equal(again.isError, true);
  assert.match(again.text, /no file picker is waiting/);
});

test("local file paths become real files through the debugger", async () => {
  const dir = mkdtempSync(join(tmpdir(), "acm-up-"));
  const a = join(dir, "a.txt");
  const b = join(dir, "b.txt");
  writeFileSync(a, "aaaa");
  writeFileSync(b, "bb");
  const multi = refOf((await mcp.call("read_page", { filter: "interactive" })).text, /"Attachments" \[(ref_\d+)\]/);
  const r = await mcp.call("file_upload", { ref: multi, paths: [a, b] });
  assert.match(r.text, /Attached 2 local file/, r.text);
  assert.equal(await page.textContent("#multiOut"), "a.txt,b.txt");
  const hidden = refOf((await mcp.call("find", { query: "Upload avatar" })).text, /\[(ref_\d+)\]/);
  const single = await mcp.call("file_upload", { ref: hidden, paths: [a, b] });
  assert.equal(single.isError, true);
  assert.match(single.text, /accepts one file/);
  const rel = await mcp.call("file_upload", { ref: multi, paths: ["relative.txt"] });
  assert.match(rel.text, /absolute/);
});

test("files dropped onto a drop zone", async () => {
  const zone = refOf((await mcp.call("find", { query: "Drop files" })).text, /\[(ref_\d+)\]/);
  const r = await mcp.call("file_upload", { ref: zone, files: [{ name: "doc.pdf", mimeType: "application/pdf", base64: b64("%PDF-1") }] });
  assert.match(r.text, /Dropped 1 file/, r.text);
  assert.equal(await page.textContent("#dropOut"), "doc.pdf:6");
});

test("prompt() dialog: tools block, handle_dialog answers with text", async () => {
  const btn = refOf((await mcp.call("find", { query: "Ask name" })).text, /\[(ref_\d+)\]/);
  const r = await mcp.call("computer", { action: "left_click", ref: btn });
  assert.match(r.text, /prompt dialog is open: "Your name\?"/);
  const blocked = await mcp.call("get_page_text");
  assert.equal(blocked.isError, true);
  assert.match(blocked.text, /blocked by a prompt dialog/);
  await mcp.call("handle_dialog", { accept: true, promptText: "Kai" });
  assert.equal(await page.textContent("#promptOut"), "Kai");
  const none = await mcp.call("handle_dialog", { accept: true });
  assert.match(none.text, /No dialog is open/);
});

test("alert() from javascript_tool does not hang", async () => {
  const r = await mcp.call("javascript_tool", { text: "alert('hi there'); 1" });
  assert.match(r.text, /alert dialog is open: "hi there"/, r.text);
  await mcp.call("handle_dialog", { accept: true });
  assert.equal((await mcp.call("javascript_tool", { text: "2 + 2" })).text, "4");
});

test("links that open a new tab are reported and joined to the group", async () => {
  const link = refOf((await mcp.call("find", { query: "Open in new tab" })).text, /\[(ref_\d+)\]/);
  const r = await mcp.call("computer", { action: "left_click", ref: link });
  assert.match(r.text, /opened a new tab (\d+)/, r.text);
  const newTab = Number(r.text.match(/opened a new tab (\d+)/)[1]);
  await new Promise((res) => setTimeout(res, 500));
  const ctx = JSON.parse((await mcp.call("tabs_context")).text);
  assert.ok(ctx.tabs.some((t) => t.tabId === newTab), "new tab is in the session group");
  await mcp.call("tabs_close", { tabId: newTab });
});

test("downloads are reported", async () => {
  const link = refOf((await mcp.call("find", { query: "Download report" })).text, /\[(ref_\d+)\]/);
  const r = await mcp.call("computer", { action: "left_click", ref: link });
  assert.match(r.text, /A download started: report\.txt/, r.text);
});

test("HTTP errors and unreachable hosts are reported on navigate", async () => {
  const nf = await mcp.call("navigate", { url: `${fixture.url}/missing` });
  assert.match(nf.text, /HTTP 404/, nf.text);
  const bad = await mcp.call("navigate", { url: "http://does-not-exist.invalid/" });
  assert.match(bad.text, /failed to load: net::ERR_NAME_NOT_RESOLVED/, bad.text);
});

test("pages with a beforeunload prompt never block navigation", async () => {
  await mcp.call("navigate", { url: `${fixture.url}/leave` });
  const h1 = refOf((await mcp.call("find", { query: "Unsaved" })).text, /\[(ref_\d+)\]/);
  await mcp.call("computer", { action: "left_click", ref: h1 }); // a user gesture arms beforeunload
  const r = await mcp.call("navigate", { url: `${fixture.url}/second` });
  if (/beforeunload dialog is open/.test(r.text)) await mcp.call("handle_dialog", { accept: true });
  await new Promise((res) => setTimeout(res, 500));
  assert.match((await mcp.call("get_page_text")).text, /Hello from page two/, r.text);
  // back/forward also go through the debugger
  assert.match((await mcp.call("navigate", { url: "back" })).text, /Leave/);
  assert.match((await mcp.call("navigate", { url: "forward" })).text, /Second page/);
});

test("file URLs without permission and restricted pages explain themselves", async () => {
  const allowed = await browser.sw.evaluate(() => chrome.extension.isAllowedFileSchemeAccess());
  const f = await mcp.call("navigate", { url: "file:///etc/hosts" });
  if (allowed) assert.match(f.text, /URL: file:\/\/\/etc\/hosts/);
  else {
    assert.equal(f.isError, true);
    assert.match(f.text, /Allow access to file URLs/);
  }
  const c = await mcp.call("navigate", { url: "chrome://version" });
  assert.match(c.text, /does not let extensions read or click/, c.text);
  await mcp.call("navigate", { url: `${fixture.url}/edge` });
});

test("hover and mouse_move move the agent cursor without clicking", async () => {
  await mcp.call("navigate", { url: `${fixture.url}/edge` });
  const found = (await mcp.call("find", { query: "Ask name" })).text;
  const btn = refOf(found, /\[(ref_\d+)\]/);
  assert.ok(btn, found);
  const r = await mcp.call("computer", { action: "mouse_move", ref: btn });
  assert.match(r.text, /Hovering at .* on button "Ask name"/);
  assert.equal(await page.textContent("#promptOut"), "");
});

test("the status pill never blocks a click on a button underneath it", async () => {
  await mcp.call("navigate", { url: `${fixture.url}/edge` });
  const btn = refOf((await mcp.call("find", { query: "Register and pay" })).text, /button "Register and pay" \[(ref_\d+)\]/);
  const r = await mcp.call("computer", { action: "left_click", ref: btn });
  assert.match(r.text, /on button "Register and pay"/, r.text);
  assert.equal(await page.textContent("#payBtn"), "Paid");
  // and the pill is still there for the user afterwards
  const pass = await page.evaluate(() => document.getElementById("__acm_overlay_host")?.hasAttribute("data-pass"));
  assert.equal(pass, false);
});

