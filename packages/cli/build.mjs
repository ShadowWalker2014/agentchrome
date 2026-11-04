import { build } from "esbuild";
import { cpSync, existsSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
const defaultServer = process.env.ACM_DEFAULT_SERVER ?? readFileSync(join(root, "DEFAULT_SERVER"), "utf8").trim();
rmSync(join(here, "dist"), { recursive: true, force: true });
await build({
  entryPoints: [join(here, "src/cli.ts")],
  outfile: join(here, "dist/cli.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  loader: { ".md": "text" },
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  define: { __VERSION__: JSON.stringify(pkg.version), __DEFAULT_SERVER__: JSON.stringify(defaultServer) },
  external: ["bufferutil", "utf-8-validate"],
});
chmodSync(join(here, "dist/cli.mjs"), 0o755);
const ext = join(root, "packages/extension/dist");
if (existsSync(join(ext, "manifest.json"))) cpSync(ext, join(here, "dist/extension"), { recursive: true });
cpSync(join(root, "README.md"), join(here, "README.md"));
console.log(`cli ${pkg.version} built (default server ${defaultServer})`);
