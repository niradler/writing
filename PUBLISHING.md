# Publishing

The preview and the production site are two builds of the same sources. Only the preview is wired to GitHub Pages. The production build is there so canonical URLs, the root base, and indexing can be checked before anyone changes DNS.

## Preview

- Build command: `npm run build`
- `SITE_TARGET` defaults to preview.
- Origin: `https://niradler.github.io`
- Base: `/writing/`
- Every page, including articles, sends `noindex, nofollow`.
- Article canonicals point at the current live URL on `https://blog.niradler.com/...` so a leaked preview does not become the canonical copy.
- RSS and sitemap URLs use the preview host, because they describe the site that was just built. `robots.txt` disallows crawling.
- There is no `CNAME` file. Do not add one.

GitHub Pages serves this project at <https://niradler.github.io/writing/>. The workflow `.github/workflows/deploy.yml` is manual (`workflow_dispatch` only). It uploads `dist/` and deploys with the GitHub Pages action. The build job has `contents: read`. Only the deploy job has `pages: write` and `id-token: write`.

### Remaining admin steps

These are not done from this change:

1. Open the repository **Settings → Pages**.
2. Set **Source** to **GitHub Actions**. Do not enter a custom domain.
3. Confirm the custom domain field is empty and that no `CNAME` is committed.
4. From the **Actions** tab, run **Deploy GitHub Pages** on the branch you intend to preview.
5. Open <https://niradler.github.io/writing/> and check the home page, one article, an image, RSS at `/writing/rss.xml`, and that the page does not redirect to `blog.niradler.com`.

HTTPS for the `github.io` host is provided by GitHub. No DNS change is required for the preview.

## Production build

`npm run build:production` writes `dist-production/` with:

- Origin `https://blog.niradler.com`
- Base `/`
- `index, follow`, except the media fixture, which stays `noindex`
- Self canonicals on `https://blog.niradler.com`
- Sitemap at `https://blog.niradler.com/sitemap.xml`

Do not upload this directory, and do not point the deploy workflow at it, until the gates below are finished.

## Cutover

Do this only after a complete backup and an explicit decision to move `blog.niradler.com`. The Hashnode support export was still pending when this site was assembled. `migration/inventory.json` is marked unverified until that export is compared with `site/posts`.

1. Compare the support export with the sitemap count, slugs, dates, tags, series, and `migration/media-sources.json`. Repair anything the public `.md` export missed. Do not overwrite a post silently.
2. Build the preview and read it at <https://niradler.github.io/writing/>. Check articles, images, code blocks, the YouTube and Slides embeds, archive, tags, series, search, and the about page on a phone-width window and a desktop window.
3. Run `npm run build:production` and `SITE_TARGET=production npm run check:built`. Confirm there is still no `CNAME` in the preview deploy.
4. Choose the hosting change. GitHub Pages can serve the custom domain, but adding the domain in **Settings → Pages**, or committing `CNAME` containing `blog.niradler.com`, attaches the domain. Do not do that until the checks above pass.
5. Lower the DNS TTL for `blog.niradler.com` ahead of the change.
6. When ready, set the Pages custom domain to `blog.niradler.com` and add the `CNAME` file in the published site only for that cutover. Create the DNS records GitHub shows for the domain. Wait until the Pages certificate is active.
7. Switch the deploy workflow's build to `npm run build:production` and its artifact to `dist-production` in the same change as the domain, so the host that owns `blog.niradler.com` is serving root URLs and indexable pages.
8. Request HTTPS and confirm `https://blog.niradler.com/<slug>` matches the old slug, returns 200, and uses a self canonical. Confirm `https://niradler.github.io/writing/` is either left as a noindex preview or retired on purpose. This repository does not redirect the preview to the live domain.
9. Old Hashnode paths listed in `lib/site.mjs` are HTML refresh pages. GitHub Pages will not send an HTTP 301 for them. If a 301 is required, add it at the DNS or proxy layer.
10. After traffic is stable, remove the Hashnode publication's claim on the domain so it does not recapture it. Keep the source backups.

## Rollback

1. Point `blog.niradler.com` DNS back to Hashnode's records.
2. Remove the custom domain from GitHub Pages and delete `CNAME` so Pages stops answering for that host.
3. Put the deploy workflow back on `npm run build` and `dist/`, with preview `noindex`.
4. Confirm <https://blog.niradler.com/> is the Hashnode site again and <https://niradler.github.io/writing/> still does not redirect.

No paid host, analytics property, or secret is required to build or preview the site.
