# SEO and AEO log

## 2026-11-04

- Published 31 content pages at https://agentchrome.dev, from `site/content/**/*.md` (brief: `docs/marketing/content-brief.md`). There are 10 docs pages, 9 agent guides, 6 comparisons and 6 use cases.
- Each page has a canonical URL, OG tags, Article and BreadcrumbList JSON-LD, and FAQPage JSON-LD built from its FAQ section. The landing page has SoftwareApplication, Organization and WebSite JSON-LD.
- Added `sitemap.xml` (37 URLs), `robots.txt`, `llms.txt` and `llms-full.txt`.
- Canonical URLs now answer 200 directly (`html_handling: drop-trailing-slash`); before this they redirected to a trailing slash.
- Google Search Console: verified the Domain property `sc-domain:agentchrome.dev` with a DNS TXT record (in Kai's personal Google account), and submitted the sitemap.
- Bing and Yandex: submitted all 37 URLs through IndexNow (HTTP 202). The key file is at https://agentchrome.dev/870f5d5d7ce7ed871592ef85eba9bd43.txt.
- Official MCP Registry: published `dev.agentchrome/agentchrome` v0.1.0 with DNS auth (`server.json`). PulseMCP and other directories import from that registry.
- awesome-mcp-servers: the entry is committed on `/tmp/ams` branch `add-agentchrome`. The push is blocked because the `gh` token lacks the `workflow` scope, and the fork's main is behind upstream.

## To do

- Bing Webmaster Tools: import the site from Search Console. The page is blocked until the extension is reloaded, because of the 1Password frame.
- Every week, check Search Console queries and pages, and check the AI Overview with `google_serp` for "chrome mcp server", "claude code chrome", "codex chrome extension" and "playwright mcp vs chrome devtools mcp".
- List on Smithery, Glama, mcp.so and mcpservers.org.
