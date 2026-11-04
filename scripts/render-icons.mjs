// Renders brand SVGs to PNG icons and a social card with headless Chromium.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const logo = readFileSync(new URL("../brand/logo.svg", import.meta.url), "utf8");
const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C82FF"/><stop offset="1" stop-color="#1F55F0"/></linearGradient></defs><rect width="128" height="128" rx="30" fill="url(#t)"/><path d="M24 50V38a14 14 0 0 1 14-14h12M78 24h12a14 14 0 0 1 14 14v12M104 78v12a14 14 0 0 1-14 14H78M50 104H38a14 14 0 0 1-14-14V78" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M52 44v42l12-11 8 18 10-4.5-8-17h16z" fill="#fff"/></svg>`;
const tiny = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C82FF"/><stop offset="1" stop-color="#1F55F0"/></linearGradient></defs><rect width="128" height="128" rx="30" fill="url(#t)"/><path d="M44 30v62l17-16 12 27 14-6.5-12-26h24z" fill="#fff"/></svg>`;
const word = readFileSync(new URL("../brand/wordmark.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128, 256, 512]) {
  const src = size <= 16 ? tiny : size <= 32 ? small : logo.replace(/ width="128" height="128"/, "");
  const svg = src.replace(/<svg /, `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: `brand/icons/icon${size}.png`, omitBackground: true });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;display:grid;place-items:center;background:radial-gradient(900px 520px at 50% 115%,rgba(47,107,255,.22),#0A0A0B 62%)">${word.replace('width="660" height="128"', 'width="990" height="192"')}</body></html>`);
await page.screenshot({ path: "brand/social-card.png" });
await browser.close();
console.log("icons rendered");
