# Publishing

One public origin: `https://blog.niradler.com`, served by GitHub Pages. Two builds of the same sources:

- **Production** (`npm run build:production`, `dist-production/`): `index, follow`, self canonicals, sitemap and RSS on the public origin. This is what the deploy workflow publishes from `main`.
- **Preview** (`npm run build`, `dist/`): `noindex, nofollow`, `robots.txt` disallows crawling, canonicals point at the production URLs. A staging build for local review and CI; it is not deployed.

`writing.niradler.com` is retired. It was the migration preview; once the cutover below is done, remove its DNS record so only `blog` answers. Do not keep both hosts serving the site — one origin, no duplicate copies.

Do not add a `CNAME` file. Pages deployed by a workflow ignores it, and the custom domain is managed in **Settings → Pages**.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`: it builds the production target, runs `SITE_TARGET=production npm run check:built`, uploads `dist-production/`, and deploys with the GitHub Pages action. The build job has `contents: read`; only the deploy job has `pages: write` and `id-token: write`.

## AI discoverability (GEO)

The build also emits `llms.txt` (a curated map of the site for agents, llmstxt.org format) and `llms-full.txt` (every published article as one Markdown file, absolute media URLs, code fences verbatim). Production `robots.txt` explicitly welcomes AI answer-engine crawlers (OAI-SearchBot, ChatGPT-User, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Amazonbot); bulk training crawlers stay under the generic allow. Article JSON-LD carries the author's `sameAs` identity links so engines can attribute the text. ChatGPT search answers draw on Bing's index, so the sitemap belongs in Bing Webmaster Tools too; Perplexity and Claude crawl directly.

## Cutover from Hashnode

The backup is complete: Nir compared <https://github.com/niradler/hashnode> with `site/posts` on 19 November 2026, and `migration/inventory.json` is marked `verified` with that record.

Do the steps in order so `blog` never serves an indexable copy from two hosts at once:

1. In Hashnode, remove the publication's custom-domain claim on `blog.niradler.com`. Keep the publication and the backup repositories as archives.
2. Lower the DNS TTL for `blog` ahead of the change. In Cloudflare DNS for `niradler.com`, point `blog` at GitHub Pages (`CNAME` → `niradler.github.io`, **DNS only** so the Pages certificate can issue).
3. In **Settings → Pages**, set the custom domain to `blog.niradler.com` (replacing `writing.niradler.com`). Wait until the certificate is active, then **Enforce HTTPS**.
4. Merge the single-domain PR. The deploy publishes the production build; confirm `https://blog.niradler.com/` serves `index, follow`, a self canonical, the sitemap at `/sitemap.xml`, and an article at its old slug with a 200.
5. Remove the `writing` DNS record in Cloudflare and confirm `https://writing.niradler.com/` no longer resolves. If any links to `writing` exist worth preserving, add a Cloudflare 301 rule `writing.niradler.com/*` → `https://blog.niradler.com/$1` instead of deleting the record outright.
6. Submit `https://blog.niradler.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools (Bing's index feeds ChatGPT search).
7. The three old Hashnode paths in `lib/site.mjs` are HTML refresh pages because GitHub Pages cannot emit an HTTP 301 from this repo. If exact 301s matter for them, add three Cloudflare redirect rules for those paths.

## Rollback

1. Revert the deploy workflow to `npm run build` and `dist/` (the noindex preview) and push, so `blog` stops serving indexable pages.
2. Point `blog` DNS back at Hashnode's records and restore the Hashnode custom-domain claim.
3. Remove the Pages custom domain so Pages stops answering for `blog`.
4. Confirm `https://blog.niradler.com/` is the Hashnode site again.

No paid host, analytics property, or secret is required to build or preview the site. GA4 and PostHog load on built pages only (see `MIGRATION.md`).
