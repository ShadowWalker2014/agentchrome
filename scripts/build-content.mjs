// Renders site/content/**/*.md into SEO pages, plus sitemap.xml, robots.txt, llms.txt and llms-full.txt.
// Front matter (between --- lines): title, description, slug (path without leading slash), type (guide|compare|docs|use-case), updated.
// A "## Frequently asked questions" section with "### Question" headings becomes FAQPage structured data.
import { marked } from "marked";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

function parse(file) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  for (const k of ["title", "description", "slug"]) if (!meta[k]) throw new Error(`${file}: missing ${k}`);
  return { meta, body: m[2].trim(), file };
}

function faqs(md) {
  const sec = md.split(/^## Frequently asked questions\s*$/m)[1];
  if (!sec) return [];
  const part = sec.split(/^## /m)[0];
  return [...part.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)].map((x) => ({ q: x[1].trim(), a: x[2].trim() }));
}

const SECTION = { guide: "Guides", compare: "Comparisons", docs: "Docs", "use-case": "Use cases" };

export function buildContent({ root, pub, server, layout }) {
  const dir = join(root, "site/content");
  const pages = walk(dir).map(parse).sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));
  const nav = Object.entries(SECTION)
    .map(([type, label]) => {
      const items = pages.filter((p) => (p.meta.type ?? "guide") === type);
      if (!items.length) return "";
      return `<div class="navsec"><h4>${label}</h4>${items.map((p) => `<a href="/${p.meta.slug}">${esc(p.meta.nav ?? p.meta.title)}</a>`).join("")}</div>`;
    })
    .join("");

  for (const p of pages) {
    const url = `${server}/${p.meta.slug}`;
    const html = marked.parse(p.body, { gfm: true });
    const q = faqs(p.body);
    const ld = [
      {
        "@context": "https://schema.org",
        "@type": p.meta.type === "docs" ? "TechArticle" : "Article",
        headline: p.meta.title,
        description: p.meta.description,
        url,
        dateModified: p.meta.updated ?? "2026-11-04",
        author: { "@type": "Organization", name: "Circo, Inc.", url: "https://circo.so" },
        publisher: { "@type": "Organization", name: "Agent Chrome", logo: { "@type": "ImageObject", url: `${server}/icon-512.png` } },
        about: { "@type": "SoftwareApplication", name: "Agent Chrome", url: server },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Agent Chrome", item: server },
          { "@type": "ListItem", position: 2, name: SECTION[p.meta.type ?? "guide"], item: `${server}/${p.meta.slug.split("/")[0]}` },
          { "@type": "ListItem", position: 3, name: p.meta.title, item: url },
        ],
      },
      ...(q.length
        ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: q.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a.replace(/[*`_\[\]]/g, "").replace(/\(https?:[^)]+\)/g, "") } })) }]
        : []),
    ];
    const out = layout
      .replaceAll("__TITLE__", esc(p.meta.title))
      .replaceAll("__DESCRIPTION__", esc(p.meta.description))
      .replaceAll("__CANONICAL__", url)
      .replace("__JSONLD__", ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join(""))
      .replace("__NAV__", nav)
      .replace("__BODY__", html)
      .replace("__UPDATED__", esc(p.meta.updated ?? "2026-11-04"))
      .replaceAll("__SERVER__", server);
    const target = join(pub, p.meta.slug, "index.html");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, out);
  }

  // Section index pages: /guides, /compare, /docs, /use-cases
  for (const [type, label] of Object.entries(SECTION)) {
    const items = pages.filter((p) => (p.meta.type ?? "guide") === type);
    if (!items.length) continue;
    const base = items[0].meta.slug.split("/")[0];
    if (pages.some((p) => p.meta.slug === base)) continue;
    const body = `<h1>${label}</h1><ul class="index">${items.map((p) => `<li><a href="/${p.meta.slug}">${esc(p.meta.title)}</a><p>${esc(p.meta.description)}</p></li>`).join("")}</ul>`;
    const out = layout
      .replaceAll("__TITLE__", label)
      .replaceAll("__DESCRIPTION__", `${label} for Agent Chrome, the open-source Chrome extension and MCP server for AI agents.`)
      .replaceAll("__CANONICAL__", `${server}/${base}`)
      .replace("__JSONLD__", "")
      .replace("__NAV__", nav)
      .replace("__BODY__", body)
      .replace("__UPDATED__", "2026-11-04")
      .replaceAll("__SERVER__", server);
    mkdirSync(join(pub, base), { recursive: true });
    writeFileSync(join(pub, base, "index.html"), out);
  }

  // sitemap + robots
  const urls = ["", "privacy", "terms", "support", ...new Set(pages.map((p) => p.meta.slug.split("/")[0])), ...pages.map((p) => p.meta.slug)];
  const uniq = [...new Set(urls)];
  writeFileSync(
    join(pub, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniq
      .map((u) => `  <url><loc>${server}/${u}</loc><lastmod>${pages.find((p) => p.meta.slug === u)?.meta.updated ?? "2026-11-04"}</lastmod></url>`)
      .join("\n")}\n</urlset>\n`,
  );
  writeFileSync(join(pub, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /authorize\nDisallow: /connect\nDisallow: /api/\nDisallow: /a/\n\nSitemap: ${server}/sitemap.xml\n`);

  // IndexNow key file (Bing, Yandex, others)
  writeFileSync(join(pub, "870f5d5d7ce7ed871592ef85eba9bd43.txt"), "870f5d5d7ce7ed871592ef85eba9bd43");

  // llms.txt (index) and llms-full.txt (all content) for AI answer engines
  const group = (type) => pages.filter((p) => (p.meta.type ?? "guide") === type).map((p) => `- [${p.meta.title}](${server}/${p.meta.slug}): ${p.meta.description}`).join("\n");
  writeFileSync(
    join(pub, "llms.txt"),
    `# Agent Chrome\n\n> Agent Chrome is an open-source Chrome extension and remote MCP server that lets AI agents (Claude Code, Codex, Gemini CLI, Antigravity, Grok, Muse, Cursor, opencode, Claude.ai, ChatGPT) use the user's real, signed-in Chrome profiles. Each agent works in its own tab group; it can click, type, read pages, upload files, handle dialogs, take screenshots and record video. MCP endpoint: ${server}/mcp (OAuth 2.1 or API key). Install: curl -fsSL ${server}/install | sh. Source: https://github.com/ShadowWalker2014/agentchrome (MIT). Operated by Circo, Inc.\n\n## Docs\n${group("docs")}\n\n## Guides\n${group("guide")}\n\n## Comparisons\n${group("compare")}\n\n## Use cases\n${group("use-case")}\n\n## Optional\n- [Full text of all pages](${server}/llms-full.txt)\n- [Privacy policy](${server}/privacy)\n- [Terms of service](${server}/terms)\n`,
  );
  writeFileSync(join(pub, "llms-full.txt"), pages.map((p) => `# ${p.meta.title}\nURL: ${server}/${p.meta.slug}\n\n${p.body}\n`).join("\n---\n\n"));
  return pages.length;
}
