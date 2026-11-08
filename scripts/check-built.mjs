import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REDIRECTS, resolveSiteTarget } from "../lib/site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = resolveSiteTarget(process.env.SITE_TARGET);
const dist = path.resolve(
  root,
  process.env.DIST || (site.target === "production" ? "dist-production" : "dist"),
);
const errors = [];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function stripBase(urlPath) {
  const base = site.base === "/" ? "" : site.base.replace(/\/$/, "");
  if (base && (urlPath === base || urlPath.startsWith(`${base}/`))) {
    return urlPath.slice(base.length) || "/";
  }
  return urlPath;
}

function localFile(href) {
  const raw = href.split("#")[0].split("?")[0];
  if (!raw || raw.startsWith("mailto:") || raw.startsWith("data:")) return null;
  let pathname = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const url = new URL(raw);
    if (url.host !== new URL(site.origin).host) return null;
    pathname = url.pathname;
    const basePath = site.base === "/" ? "" : site.base.replace(/\/$/, "");
    if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`))
      return null;
  }
  if (!pathname.startsWith("/")) return null;
  pathname = stripBase(pathname);
  const relative = pathname.replace(/^\//, "");
  if (pathname.endsWith("/")) return [path.join(dist, relative, "index.html")];
  if (path.extname(pathname)) return [path.join(dist, relative)];
  return [path.join(dist, `${relative}.html`), path.join(dist, relative, "index.html")];
}

const htmlFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
await walk(dist);

if (!(await exists(path.join(dist, "index.html")))) errors.push("missing index.html");
if (await exists(path.join(dist, "CNAME"))) errors.push("CNAME must not be published");

const home = await readFile(path.join(dist, "index.html"), "utf8");
if (!home.includes("Piece by Piece"))
  errors.push("home page is missing the site title");
if (!home.includes(site.robots)) errors.push(`home robots should be ${site.robots}`);
const canonicalHome = home.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if (site.target === "preview" && canonicalHome !== "https://blog.niradler.com/") {
  errors.push(`preview home canonical is ${canonicalHome}`);
}
if (site.target === "production" && canonicalHome !== "https://blog.niradler.com/") {
  errors.push(`production home canonical is ${canonicalHome}`);
}

if (site.target === "preview") {
  const assetDir = path.join(dist, "assets");
  let bundled = "";
  for (const name of await readdir(assetDir)) {
    if (name.endsWith(".js"))
      bundled += await readFile(path.join(assetDir, name), "utf8");
  }
  if (bundled.includes('"/post-training-when-a-specialist-beats-a-bigger-model"')) {
    errors.push("client article links are missing the /writing base");
  }
}

const postFile = path.join(dist, "postgres-already-is-your-backend.html");
if (!(await exists(postFile))) errors.push("missing postgres article");
else {
  const post = await readFile(postFile, "utf8");
  if (!post.includes("Postgres Already Is Your Backend"))
    errors.push("article title missing");
  if (
    !post.includes(
      'rel="canonical" href="https://blog.niradler.com/postgres-already-is-your-backend"',
    )
  ) {
    errors.push("article canonical is not the live slug");
  }
  if (site.target === "preview" && !post.includes("noindex"))
    errors.push("preview article is indexable");
  if (site.target === "production" && post.includes("noindex"))
    errors.push("production article is noindex");
}

const fixture = path.join(dist, "fixtures/media.html");
if (!(await exists(fixture))) errors.push("missing media fixture");
else {
  const html = await readFile(fixture, "utf8");
  for (const needle of [
    "<video",
    "<audio",
    "<iframe",
    "figcaption",
    "Nonpublished rendering fixture",
  ]) {
    if (!html.includes(needle)) errors.push(`fixture missing ${needle}`);
  }
  if (!html.includes("noindex")) errors.push("fixture is indexable");
  const prefix = site.base === "/" ? "/fixtures/" : "/writing/fixtures/";
  if (!html.includes(`${prefix}diagram.svg`))
    errors.push(`fixture image base is wrong for ${site.target}`);
}

let internal = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (site.target === "production" && html.includes('="/writing/')) {
    errors.push(`${path.relative(dist, file)} contains the preview base`);
  }
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const targets = localFile(match[1]);
    if (!targets) continue;
    internal += 1;
    const found = [];
    for (const candidate of targets) found.push(await exists(candidate));
    if (!found.some(Boolean))
      errors.push(`${path.relative(dist, file)} -> missing ${match[1]}`);
  }
}

const rss = await readFile(path.join(dist, "rss.xml"), "utf8");
const items = rss.match(/<item>/g)?.length || 0;
if (items < 50) errors.push(`rss has ${items} items`);
if (rss.includes("fixtures/media")) errors.push("fixture leaked into rss");
if (!rss.includes(site.origin)) errors.push("rss is missing the build origin");
if (site.target === "preview" && !rss.includes("/writing/"))
  errors.push("preview rss is missing the base");

const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
if (site.target === "preview" && !robots.includes("Disallow: /"))
  errors.push("preview robots allow crawling");
if (site.target === "production" && robots.includes("Disallow: /"))
  errors.push("production robots block crawling");

const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
if (
  !sitemap.includes(
    `${site.origin}${site.base === "/" ? "" : "/writing"}/postgres-already-is-your-backend`,
  )
) {
  errors.push("sitemap is missing the sample article");
}
if (sitemap.includes("fixtures/media")) errors.push("fixture leaked into the sitemap");

for (const [from, to] of REDIRECTS) {
  const file = path.join(dist, `${from.slice(1)}.html`);
  if (!(await exists(file))) {
    errors.push(`missing redirect ${from}`);
    continue;
  }
  const html = await readFile(file, "utf8");
  const expected = `${site.base === "/" ? "" : "/writing"}${to}`;
  if (!html.includes(`url=${expected}`))
    errors.push(`redirect ${from} does not point at ${expected}`);
}

console.log(
  `checked ${htmlFiles.length} html files, ${internal} internal links, ${site.target}`,
);
if (errors.length) {
  for (const error of errors) console.error(`error ${error}`);
  process.exit(1);
}
