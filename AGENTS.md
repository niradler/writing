# Working on Piece by Piece

This repository is Nir Adler's personal blog. It is not an Astro project, and it is not the Astro framework monorepo. The old `astro-developer` skill was removed because it documents Astro's own packages.

## Why VitePress

The first commit was an Astro placeholder: one page, no articles, and a manual GitHub Pages workflow. Astro's process was `npm run dev` / `astro build`, with `site` and `base` in `astro.config.mjs`, pages in `src/pages`, and the artifact in `dist`. No article had been migrated, so that scaffold was not carrying content.

ORC's documentation site already uses VitePress (`docs/.vitepress`, base `/orc/`, IBM Plex, the neutral light and dark tokens in `DESIGN.md`, and `vitepress build`). This blog follows that setup instead of keeping a second framework for an empty starter. VitePress lives in `site/` because this repository is the blog, not a product with a docs folder. Mermaid, the docs sidebar, and ORC's application chrome are not part of the blog.

Reading page tokens come from ORC's design guide: IBM Plex Sans and IBM Plex Mono, the neutral canvas (`#fafafa` / `#000000`), muted text, 2px focus, 44px touch targets, and a line height of 1.65. Article text is 18px so a long post is comfortable. UI labels stay at 14px. The blog does not copy ORC's workspace, sidebar, or task UI.

## Commands

Node.js 24 and `npm ci`. Commit `package-lock.json` when dependencies change.

- `npm run dev` serves the preview at `/`.
- `npm test` runs unit tests for URLs, canonicals, media rewriting, and feed generation.
- `npm run check` runs those tests and checks imported frontmatter, slugs, dates, and local media files.
- `npm run build` writes the preview site to `dist/`.
- `npm run build:production` writes the root-domain site to `dist-production/`.
- `npm run check:built` checks the site that `SITE_TARGET` selects. CI runs it for both builds.
- `npm run import:hashnode` refreshes public articles. It skips files that already exist unless you pass `--update`.

Do not add a `CNAME` file, change DNS, or point `blog.niradler.com` at this project. Preview pages are served at `writing.niradler.com` and send `noindex`.

## Content rules

Use the author's published text. Do not invent a biography, an article, a date, a tag, or alt text. The about page is converted from <https://blog.niradler.com/page/about>. Posts come from each public `{slug}.md` export plus metadata on the HTML page.

Keep the original slug, `publishedAt`, `updatedAt`, tags, series, and `originalUrl`. The Hashnode backup repository <https://github.com/niradler/hashnode> was not available. <https://github.com/niradler/hashnode-assets-backup> is the backup action, not an asset dump. The support export is still pending. `migration/inventory.json` stays `completeness: "unverified"` until that export is compared with this tree.

`--update` is the only import mode that overwrites a post. A skipped existing file is intentional.

## Media

Imported images are stored under `site/public/media/<slug>/`. Markdown keeps root-relative `/media/...` paths. The VitePress render prefixes them with the active base, so the same files work under any base.

Hashnode's `align="left"` suffix is rewritten out of the URL. Code fences are left alone, including sample markup such as `public/image.jpg`. YouTube embeds use `youtube-nocookie`. Google Slides embeds from the articles are kept. Other iframes become links.

`migration/media-sources.json` records the original URL for each downloaded file. Empty alt text is reported, not replaced. `npm run audit:media` writes `migration/media-audit.json`.

`site/fixtures/media.md` is a nonpublished rendering fixture. It is excluded from search, RSS, and the sitemap, and it always sends `noindex`.

## Theme and routes

`site/.vitepress/config.mjs` switches on `SITE_TARGET`:

|                   | Preview                        | Production                  |
| ----------------- | ------------------------------ | --------------------------- |
| Origin            | `https://writing.niradler.com` | `https://blog.niradler.com` |
| Base              | `/`                            | `/`                         |
| Robots            | `noindex, nofollow`            | `index, follow`             |
| Article canonical | the live `originalUrl`         | the same URL on this site   |

Root slugs are preserved with VitePress rewrites from `site/posts/*.md`. Series and tag URLs match the live site (`/series/<slug>`, `/tag/<slug>`). The about page stays at `/page/about`. Three old Hashnode paths redirect with HTML refresh pages because GitHub Pages cannot emit a custom HTTP 301 from this repo. See `REDIRECTS` in `lib/site.mjs`.

Search is a page over titles, descriptions, tags, series, and article text. It is sized for the current public archive, not a hosted search service.
