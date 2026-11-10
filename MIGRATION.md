# Migration status

Completeness is **unverified**.

The public sitemap lists 54 posts. On 10 November 2026 its slugs matched `site/posts` exactly (54 of 54). Drafts and history are not in the public sitemap, so this is not a full backup until the support export is compared.

## What was available

- Live site: <https://blog.niradler.com/>, including `sitemap.xml`, each article's HTML metadata, and the public `{slug}.md` export.
- About page: <https://blog.niradler.com/page/about>.
- Publication links used in the footer and resume nav: GitHub `https://github.com/niradler`, website `https://niradler.com/`, Hashnode `https://hashnode.com/@niradler`, LinkedIn and resume `https://www.linkedin.com/in/niradler/`.
- Series names and the three redirects in `lib/site.mjs` come from the public publication payload.
- Logos, favicon, and avatar are the files currently published by the Hashnode site.

## What was not available

- <https://github.com/niradler/hashnode> was not found. The README in the first commit listed it as the content backup.
- <https://github.com/niradler/hashnode-assets-backup> is a GitHub Action that rewrites Hashnode CDN links. The repository does not contain this blog's images.
- Hashnode's GraphQL API now requires a paid publication plan. It was not called.
- The full export requested from Hashnode support is still pending. Support was not contacted again.

## What the importer does

`npm run import:hashnode` reads the sitemap, fetches each public markdown export and HTML page, and writes `site/posts/<slug>.md`. It keeps the slug, title, meta description, published time, updated time, tags, series, canonical URL, and source markdown URL. Images are downloaded to `site/public/media/<slug>/` when the host returns them. Original image URLs are listed in `migration/media-sources.json`.

Existing posts are left in place unless `--update` is passed. The script does not delete posts that disappear from a later fetch.

Descriptions that end in an ellipsis are Hashnode's truncated meta descriptions. They are stored as published, not rewritten.

`migration/inventory.json` records the run and must keep `"completeness": "unverified"` until the support export is compared with this tree: post count, slugs, dates, edits, series, pages, and missing assets.

## Not migrated

Drafts, revision history, comments, reactions, the newsletter, view counts, and Hashnode analytics IDs are not copied. Analytics identifiers from the live page were intentionally left out.

A post whose image download fails keeps the remote URL and is listed in the inventory. Empty alt text is reported by `npm run audit:media` and is not replaced with generated text.
