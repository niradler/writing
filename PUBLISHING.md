# Publishing

One public origin: `https://writing.niradler.com`, served by GitHub Pages (the custom domain is already set in **Settings → Pages**). Two builds of the same sources:

- **Production** (`npm run build:production`, `dist-production/`): `index, follow`, self canonicals, sitemap and RSS on the public origin. This is what the deploy workflow publishes from `main`.
- **Preview** (`npm run build`, `dist/`): `noindex, nofollow`, `robots.txt` disallows crawling, canonicals point at the production URLs. A staging build for local review and CI; it is not deployed.

`blog.niradler.com` is not attached to this project's Pages. After the cutover it permanently 301-redirects to `https://writing.niradler.com` at the Cloudflare layer, path-preserving. GitHub Pages supports one custom domain per site, so the redirect lives in Cloudflare, not here.

Do not add a `CNAME` file. Pages deployed by a workflow ignores it, and the custom domain is managed in Settings → Pages.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`: it builds the production target, runs `SITE_TARGET=production npm run check:built`, uploads `dist-production/`, and deploys with the GitHub Pages action. The build job has `contents: read`; only the deploy job has `pages: write` and `id-token: write`.

## Cutover from Hashnode

The backup is complete: Nir compared <https://github.com/niradler/hashnode> with `site/posts` on 19 November 2026, and `migration/inventory.json` is marked `verified` with that record.

1. Merge the production-readiness PR, then the domain-flip PR (the flip switches the deploy workflow to the production build in the same change as the origin).
2. Wait for the deploy, then confirm `https://writing.niradler.com/` serves `index, follow`, a self canonical, the sitemap at `/sitemap.xml`, and an article at its old slug with a 200.
3. In Cloudflare DNS for `niradler.com`, point `blog` at a proxied record and add a redirect rule: `blog.niradler.com/*` → `https://writing.niradler.com/$1`, status **301**, preserve path and query. Lower the TTL ahead of the change if the record is DNS-only today.
4. In Hashnode, remove the publication's custom-domain claim on `blog.niradler.com` so it cannot recapture the host. Keep the Hashnode publication and the backup repositories as archives.
5. Confirm `https://blog.niradler.com/<slug>` returns a 301 to the same slug on `writing`, and that Google Search Console can fetch the production sitemap. Submit the sitemap there if the property is new.
6. The three old Hashnode paths in `lib/site.mjs` are HTML refresh pages because GitHub Pages cannot emit an HTTP 301 from this repo. If exact 301s matter for them, add three more Cloudflare redirect rules for those paths.

While Hashnode still answers on `blog` and the production build is live on `writing`, both hosts briefly serve indexable copies. That window closes when the redirect and the claim release land; keep it short.

## Rollback

1. Revert the deploy workflow to `npm run build` and `dist/` (the noindex preview) and push, so `writing` stops serving indexable pages.
2. Remove the Cloudflare redirect rule and point `blog` DNS back at Hashnode's records.
3. Restore the Hashnode custom-domain claim if it was released.
4. Confirm `https://blog.niradler.com/` is the Hashnode site again and `https://writing.niradler.com/` is the noindex staging build.

No paid host, analytics property, or secret is required to build or preview the site. GA4 and Hotjar load on built pages only (see `MIGRATION.md`).
