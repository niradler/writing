import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { publishedPosts } from "./content.mjs";
import {
  REDIRECTS,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_TITLE,
  joinUrl,
} from "./site.mjs";
import { escapeXml } from "./text.mjs";

export function sitePaths(posts) {
  const published = publishedPosts(posts);
  const paths = new Set([
    "/",
    "/archive",
    "/search",
    "/tags",
    "/series",
    "/page/about",
  ]);
  for (const post of published) paths.add(`/${post.slug}`);
  for (const post of published) {
    for (const tag of post.data.tags) paths.add(`/tag/${encodeURIComponent(tag)}`);
    if (post.data.seriesSlug)
      paths.add(`/series/${encodeURIComponent(post.data.seriesSlug)}`);
  }
  return [...paths];
}

export function renderSitemap(site, paths) {
  const urls = paths
    .map(
      (pagePath) =>
        `  <url><loc>${escapeXml(joinUrl(site.origin, site.base, pagePath))}</loc></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(site) {
  if (site.target === "preview") {
    return "User-agent: *\nDisallow: /\n";
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${joinUrl(site.origin, site.base, "/sitemap.xml")}\n`;
}

export function renderRss(site, posts) {
  const home = joinUrl(site.origin, site.base, "/");
  const self = joinUrl(site.origin, site.base, "/rss.xml");
  const items = publishedPosts(posts)
    .map((post) => {
      const link = joinUrl(site.origin, site.base, `/${post.slug}`);
      const categories = post.data.tags
        .map((tag) => `      <category>${escapeXml(tag)}</category>`)
        .join("\n");
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(post.data.sourceUrl || post.data.originalUrl || link)}</guid>
      <pubDate>${escapeXml(new Date(post.data.publishedAt).toUTCString())}</pubDate>
      <description>${escapeXml(post.data.description)}</description>
${categories}
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <link>${escapeXml(home)}</link>
    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <managingEditor>${escapeXml(SITE_AUTHOR)}</managingEditor>
${items}
  </channel>
</rss>
`;
}

export function renderRedirect(site, from, to) {
  const target = joinUrl(site.origin, site.base, to);
  const canonical =
    site.target === "production"
      ? target
      : joinUrl("https://blog.niradler.com", "/", to);
  const href = site.base === "/" ? to : `${site.base.replace(/\/$/, "")}${to}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirect</title>
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="refresh" content="0; url=${href}">
</head>
<body>
  <p><a href="${href}">Continue to ${to}</a></p>
</body>
</html>
`;
}

export async function generateBuildFiles({ outDir, site, posts }) {
  await mkdir(outDir, { recursive: true });
  const paths = sitePaths(posts);
  await writeFile(path.join(outDir, "sitemap.xml"), renderSitemap(site, paths));
  await writeFile(path.join(outDir, "robots.txt"), renderRobots(site));
  await writeFile(path.join(outDir, "rss.xml"), renderRss(site, posts));
  for (const [from, to] of REDIRECTS) {
    const file = path.join(outDir, `${from.replace(/^\//, "")}.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, renderRedirect(site, from, to));
  }
  return { paths: paths.length, redirects: REDIRECTS.length };
}
