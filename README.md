# Piece by Piece

Nir Adler's blog. The live site stays at <https://blog.niradler.com/> until a separate cutover. This repository is the writing, the preview build, and the future production source.

The preview address, after a manual GitHub Pages deploy, is <https://niradler.github.io/writing/>. Nothing here redirects that preview to the live domain.

## Read locally

Use Node.js 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

The dev server uses the GitHub project path: <http://127.0.0.1:5173/writing/>.

```sh
npm test
npm run check
npm run build
npm run build:production
```

`npm run build` is the preview site. `npm run build:production` is the root-domain site and is checked in CI. It is not deployed.

## Publishing and migration

- [Publishing, preview, and domain cutover](PUBLISHING.md)
- [Migration status](MIGRATION.md)

Article import is not complete. The Hashnode support export is still pending, and this checkout must not be treated as a full backup.

## For agents

Repository instructions for contributors and agents are in [AGENTS.md](AGENTS.md).
