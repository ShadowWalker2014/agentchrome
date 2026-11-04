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

- Bing Webmaster Tools: added https://agentchrome.dev/ (DNS CNAME verification) and submitted the sitemap.
- Claude directory: connector submitted for review under Circo, Inc. Reviewer key is in ~/.agentchrome-registry/claude-reviewer-key.txt.
- ChatGPT plugin: uploaded 0.1.1 at https://platform.openai.com/plugins/manage/plugin_asdk_app_6aeb8096f22c8191979b97930ed83cf8 under Circo, Inc. (OpenAI's upload 404 was fixed on their side). Domain verified (token in KV config:openai_apps_challenge), OAuth connected with the reviewer account, scan done with no blocking findings, review information saved. Fixed two scan findings: handle_dialog is now destructive, and chat apps get a read-only screenshot without save. Submitted for review on 2026-11-04 (status: Version 0.1.1 · In review).

## To do

- Every week, check Search Console queries and pages, and check the AI Overview with `google_serp` for "chrome mcp server", "claude code chrome", "codex chrome extension" and "playwright mcp vs chrome devtools mcp".
- List on Smithery, Glama, mcp.so and mcpservers.org.
