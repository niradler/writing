# Piece by Piece

Nir Adler's blog, <https://blog.niradler.com/>. This repository is the source for every post, the about page, and the site that serves them.

## Read locally

Use Node.js 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

The dev server runs at <http://127.0.0.1:5173/>.

```sh
npm test
npm run check
npm run build
npm run build:production
```

`npm run build` writes the GitHub Pages site at <https://writing.niradler.com/>. `npm run build:production` writes the root-domain site for `blog.niradler.com`. CI checks both.

## Publishing and migration

- [Publishing and domain cutover](PUBLISHING.md)
- [Migration status](MIGRATION.md)

All 54 public posts on the Hashnode sitemap are in `site/posts`, slug for slug.

## For agents

Repository instructions for contributors and agents are in [AGENTS.md](AGENTS.md).
