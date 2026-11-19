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
import { escapeXml, outsideFences } from "./text.mjs";

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

export function renderSitemap(site, paths, lastmods = {}) {
  const urls = paths
    .map((pagePath) => {
      const lastmod = lastmods[pagePath];
      return `  <url><loc>${escapeXml(joinUrl(site.origin, site.base, pagePath))}</loc>${
        lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
      }</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// AI answer engines that crawl for citations/search (not bulk training).
// Training crawlers (GPTBot, ClaudeBot, CCBot, ...) stay under the generic allow.
export const AI_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
];

export function renderRobots(site) {
  if (site.target === "preview") {
    return "User-agent: *\nDisallow: /\n";
  }
  const aiGroup = AI_SEARCH_BOTS.map((bot) => `User-agent: ${bot}`).join("\n");
  return `# AI answer engines may crawl and cite this site.\n${aiGroup}\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${joinUrl(site.origin, site.base, "/sitemap.xml")}\n`;
}

// llmstxt.org: a curated Markdown map of the site for LLMs and agents.
export function renderLlmsTxt(site, posts) {
  const url = (pagePath) => joinUrl(site.origin, site.base, pagePath);
  const items = publishedPosts(posts)
    .map((post) => {
      const description = post.data.description
        ? `: ${post.data.description.replace(/\s+/g, " ").trim()}`
        : "";
      return `- [${post.data.title}](${url(`/${post.slug}`)})${description}`;
    })
    .join("\n");
  return `# ${SITE_TITLE}

> ${SITE_DESCRIPTION}

Articles by ${SITE_AUTHOR}, published at ${url("/")} with original publication dates. Each link below is the canonical URL of a published article.

## Posts

${items}

## Pages

- [About](${url("/page/about")})
- [Archive](${url("/archive")})

## Optional

- [Full text of every article (Markdown)](${url("/llms-full.txt")})
- [RSS feed](${url("/rss.xml")})
- [Sitemap](${url("/sitemap.xml")})
`;
}

function absolutizeRootRelative(markdown, site) {
  return outsideFences(markdown, (part) =>
    part
      .replace(
        /(!?\[[^\]]*]\()(\/[^)\s]*)(\))/g,
        (_, open, pagePath, close) =>
          `${open}${joinUrl(site.origin, site.base, pagePath)}${close}`,
      )
      .replace(
        /(\b(?:src|href)\s*=\s*["'])(\/[^"']+)(["'])/gi,
        (_, open, pagePath, close) =>
          `${open}${joinUrl(site.origin, site.base, pagePath)}${close}`,
      ),
  );
}

// Full published text as one Markdown file agents can ingest in a single fetch.
export function renderLlmsFullTxt(site, posts) {
  const url = (pagePath) => joinUrl(site.origin, site.base, pagePath);
  const sections = publishedPosts(posts).map((post) => {
    const meta = [`- URL: ${url(`/${post.slug}`)}`];
    if (post.data.publishedAt) meta.push(`- Published: ${post.data.publishedAt}`);
    if (post.data.updatedAt) meta.push(`- Updated: ${post.data.updatedAt}`);
    if (post.data.tags.length) meta.push(`- Tags: ${post.data.tags.join(", ")}`);
    const body = absolutizeRootRelative(post.body, site).trim();
    return `# ${post.data.title}\n\n${meta.join("\n")}\n\n${body}`;
  });
  return `# ${SITE_TITLE} — full article text

> ${SITE_DESCRIPTION}

Published articles by ${SITE_AUTHOR}, newest first. Source: ${url("/")}
Media and links are absolute URLs on the canonical origin. Code samples are preserved verbatim.

---

${sections.join("\n\n---\n\n")}
`;
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
  const lastmods = {};
  let latest = "";
  for (const post of publishedPosts(posts)) {
    const stamp = String(post.data.updatedAt || post.data.publishedAt || "").slice(
      0,
      10,
    );
    if (stamp) lastmods[`/${post.slug}`] = stamp;
    const published = String(post.data.publishedAt || "").slice(0, 10);
    if (published > latest) latest = published;
  }
  if (latest) {
    lastmods["/"] = latest;
    lastmods["/archive"] = latest;
  }
  await writeFile(
    path.join(outDir, "sitemap.xml"),
    renderSitemap(site, paths, lastmods),
  );
  await writeFile(path.join(outDir, "robots.txt"), renderRobots(site));
  await writeFile(path.join(outDir, "rss.xml"), renderRss(site, posts));
  await writeFile(path.join(outDir, "llms.txt"), renderLlmsTxt(site, posts));
  await writeFile(path.join(outDir, "llms-full.txt"), renderLlmsFullTxt(site, posts));
  for (const [from, to] of REDIRECTS) {
    const file = path.join(outDir, `${from.replace(/^\//, "")}.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, renderRedirect(site, from, to));
  }
  return { paths: paths.length, redirects: REDIRECTS.length };
}
