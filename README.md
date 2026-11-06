# Piece by Piece

Nir Adler's independent blog, built with Astro and Markdown for GitHub Pages.

## Status

Repository setup only. Article migration has not started. The current blog stays
at <https://blog.niradler.com/> until the replacement is validated.

Migration sources:

- [Hashnode content backup](https://github.com/niradler/hashnode)
- [Hashnode asset backup](https://github.com/niradler/hashnode-assets-backup)

## Local development

Use Node.js 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

The starter uses the GitHub project path: <http://localhost:4321/writing/>.

```sh
npm run format:check
npm run check
npm run build
npm run preview
```

Run `npm run format` to format source files. Commit `package-lock.json` whenever
dependencies change.

## GitHub Pages

Checks run on pull requests and pushes to `main`. Deployment is intentionally
manual: enable **Settings → Pages → Source → GitHub Actions**, then run the
**Deploy GitHub Pages** workflow when a preview is wanted. The configured preview
address is <https://niradler.github.io/writing/>.

No custom domain or DNS cutover is configured. At launch, set Astro's `site` to
`https://blog.niradler.com`, change `base` to `/`, configure and verify the domain
in GitHub Pages, and plan the DNS cutover. Preserve the existing root-level
article slugs. Remove the temporary `noindex, nofollow` metadata only when the
site is ready to replace the current blog.

## Migration checklist

- Inventory the content and image backups; compare against the live blog for
  newer posts, edits, pages, series, and missing assets.
- Import Markdown with original slugs, titles, dates, tags, and images.
- Add article layouts, archive, RSS, sitemap, and canonical URLs.
- Validate links, code blocks, embeds, images, and mobile rendering.
- Keep unpublished drafts and private migration exports outside this public repo.
- Switch the domain only after validation; retain the source backups.
- Add optional DEV cross-posting with canonical links to this blog.

This site has no runtime API, credentials, or database. Keep publishing tokens
in GitHub Actions secrets if automation is added later.

## Agent skill

The official `withastro/astro@astro-developer` skill is installed under
`.agents/skills/astro-developer`, with its source recorded in `skills-lock.json`.
It primarily documents work on Astro's own monorepo; use the Astro website
documentation for application-specific setup and APIs.
