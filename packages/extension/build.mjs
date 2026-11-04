import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
const root = join(here, "../..");
const version = JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version;
const defaultServer = process.env.ACM_DEFAULT_SERVER ?? readFileSync(join(root, "DEFAULT_SERVER"), "utf8").trim();

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "icons"), { recursive: true });

const common = { bundle: true, target: "chrome120", format: "esm", minify: false, sourcemap: false, define: { __DEFAULT_SERVER__: JSON.stringify(defaultServer) } };
await build({ ...common, entryPoints: { background: join(here, "src/background/index.ts") }, outdir: out });
await build({ ...common, entryPoints: { offscreen: join(here, "src/offscreen/recorder.ts"), popup: join(here, "src/popup/popup.ts"), prompt: join(here, "src/popup/prompt.ts") }, outdir: out });
// Content script is injected with chrome.scripting.executeScript, so it must be a classic script.
await build({ ...common, format: "iife", entryPoints: { content: join(here, "src/content/agent.ts") }, outdir: out });

cpSync(join(here, "static"), out, { recursive: true });
cpSync(join(root, "brand/icons"), join(out, "icons"), { recursive: true });
cpSync(join(root, "brand/logo.svg"), join(out, "icons/logo.svg"));
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
manifest.version = version;
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

// Zip for releases and for the server to hand out.
const zip = join(here, "agent-chrome-mcp-extension.zip");
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, "."], { cwd: out });
console.log(`extension ${version} built -> ${out} (default server ${defaultServer})`);
