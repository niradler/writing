import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import matter from "gray-matter";
import { loadMarkdownDir } from "../../lib/content.mjs";
import { generateBuildFiles } from "../../lib/generate.mjs";
import { injectPostHeader, postHeaderHtml } from "../../lib/header.mjs";
import { socialSrc, rewriteContentImages } from "../../lib/images.mjs";
import { prefixHtmlMedia } from "../../lib/media.mjs";
import { readFileSync } from "node:fs";
import {
  IDENTITY_LINKS,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_TITLE,
  canonicalUrl,
  joinUrl,
  pagePathFromRelative,
  prefixRoot,
  resolveSiteTarget,
  robotsFor,
} from "../../lib/site.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const seriesList = JSON.parse(
  readFileSync(new URL("./series.json", import.meta.url), "utf8"),
);
const repoRoot = path.resolve(here, "../..");
const site = resolveSiteTarget(process.env.SITE_TARGET);
const outDir =
  site.target === "production"
    ? path.join(repoRoot, "dist-production")
    : path.join(repoRoot, "dist");

const themeBoot = `(() => {
  const key = "piece-theme";
  let stored = "system";
  try {
    stored = localStorage.getItem(key) || "system";
  } catch {}
  const dark = stored === "dark" || (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = stored;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();`;

export default defineConfig({
  title: SITE_TITLE,
  titleTemplate: ":title — Piece by Piece",
  description: SITE_DESCRIPTION,
  lang: "en",
  base: site.base,
  cleanUrls: true,
  appearance: false,
  lastUpdated: false,
  ignoreDeadLinks: true,
  outDir,
  srcExclude: ["**/README.md", "**/fixtures/README.md"],
  rewrites: (id) => {
    if (id.startsWith("posts/") && id.endsWith(".md")) return id.slice("posts/".length);
  },
  vite: {
    build: { target: "es2022" },
    server: { fs: { allow: [repoRoot] } },
    plugins: [
      {
        name: "prefix-responsive-srcset",
        transform(code, id) {
          if (!id.includes(".md") || !code.includes("srcset=")) return;
          const basePath = site.base === "/" ? "" : site.base.replace(/\/$/, "");
          if (!basePath) return;
          return code.replace(
            /(\ssrcset=)(["'])([\s\S]*?)\2/gi,
            (_, attr, quote, value) => {
              const next = value
                .split(",")
                .map((part) => {
                  const bits = part.trim().split(/\s+/);
                  if (bits[0]?.startsWith("/media-opt/"))
                    bits[0] = `${basePath}${bits[0]}`;
                  return bits.join(" ");
                })
                .join(", ");
              return `${attr}${quote}${next}${quote}`;
            },
          );
        },
      },
    ],
  },
  head: [
    [
      "link",
      { rel: "icon", href: prefixRoot(site.base, "/favicon.png"), type: "image/png" },
    ],
    [
      "link",
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: SITE_TITLE,
        href: prefixRoot(site.base, "/rss.xml"),
      },
    ],
    ["script", {}, themeBoot],
  ],
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    config(md) {
      const render = md.render.bind(md);
      md.render = (src, env = {}) => {
        const parsed = matter(src);
        const frontmatter = Object.keys(parsed.data).length
          ? parsed.data
          : env.frontmatter || {};
        let content = parsed.content;
        const startsWithFrontmatter = src.trimStart().startsWith("---");
        if (
          frontmatter.publishedAt &&
          !frontmatter.fixture &&
          !content.includes('class="post-meta"')
        ) {
          content = injectPostHeader(content, postHeaderHtml(frontmatter, "/"));
        }
        const next = startsWithFrontmatter
          ? matter.stringify(content, parsed.data, { lineWidth: 1000 })
          : content;
        return rewriteContentImages(render(next, env), loadImageManifest());
      };
    },
  },
  transformHtml(html) {
    return prefixHtmlMedia(html, site.base);
  },
  transformPageData(pageData) {
    const pagePath = pagePathFromRelative(pageData.relativePath);
    if (pageData.params?.tag) {
      const tag = String(pageData.params.tag);
      pageData.title = `#${tag}`;
      pageData.frontmatter.title = `#${tag}`;
      pageData.description = `Articles tagged ${tag}.`;
    }
    if (pageData.params?.series) {
      const slug = String(pageData.params.series);
      const name = seriesList.find((item) => item.slug === slug)?.name || slug;
      pageData.title = name;
      pageData.frontmatter.title = name;
    }
    if (pageData.relativePath === "index.md") {
      pageData.title = SITE_TITLE;
      pageData.titleTemplate = ":title — Nir Adler";
    }
    pageData.frontmatter.siteTarget = site.target;
  },
  transformHead({ pageData }) {
    const pagePath = pagePathFromRelative(pageData.relativePath);
    const frontmatter = pageData.frontmatter || {};
    const canonical = canonicalUrl({ path: pagePath, frontmatter, site });
    const description =
      pageData.description || frontmatter.description || SITE_DESCRIPTION;
    const image = absoluteImage(
      socialSrc(loadImageManifest(), frontmatter.cover || "/brand/logo-light.png"),
    );
    const heads = [
      ["meta", { name: "robots", content: robotsFor(site, frontmatter) }],
      ["link", { rel: "canonical", href: canonical }],
      ["meta", { property: "og:site_name", content: SITE_TITLE }],
      [
        "meta",
        {
          property: "og:title",
          content: frontmatter.title || pageData.title || SITE_TITLE,
        },
      ],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: canonical }],
      [
        "meta",
        {
          property: "og:type",
          content: frontmatter.publishedAt ? "article" : "website",
        },
      ],
      ["meta", { property: "og:image", content: image }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      [
        "meta",
        {
          name: "twitter:title",
          content: frontmatter.title || pageData.title || SITE_TITLE,
        },
      ],
      ["meta", { name: "twitter:description", content: description }],
      ["meta", { name: "twitter:image", content: image }],
    ];
    if (frontmatter.publishedAt) {
      heads.push([
        "meta",
        {
          property: "article:published_time",
          content: String(frontmatter.publishedAt),
        },
      ]);
      if (frontmatter.updatedAt) {
        heads.push([
          "meta",
          { property: "article:modified_time", content: String(frontmatter.updatedAt) },
        ]);
      }
      for (const tag of frontmatter.tags || []) {
        heads.push(["meta", { property: "article:tag", content: String(tag) }]);
      }
      heads.push([
        "script",
        { type: "application/ld+json" },
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: frontmatter.title,
          description,
          datePublished: frontmatter.publishedAt,
          dateModified: frontmatter.updatedAt || frontmatter.publishedAt,
          author: { "@type": "Person", name: SITE_AUTHOR, url: IDENTITY_LINKS.website },
          publisher: {
            "@type": "Organization",
            name: SITE_TITLE,
            url: PRODUCTION_HOME,
          },
          mainEntityOfPage: canonical,
          url: canonical,
          image,
        }),
      ]);
    }
    return heads;
  },
  themeConfig: {
    siteTarget: site.target,
    identity: IDENTITY_LINKS,
  },
  async buildEnd(siteConfig) {
    const posts = await loadMarkdownDir(path.join(here, "../posts"));
    await generateBuildFiles({ outDir: siteConfig.outDir, site, posts });
  },
});

const PRODUCTION_HOME = "https://blog.niradler.com/";

function loadImageManifest() {
  try {
    return JSON.parse(
      readFileSync(path.join(repoRoot, "site/.vitepress/image-manifest.json"), "utf8"),
    );
  } catch {
    return { images: {} };
  }
}

function absoluteImage(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return joinUrl(site.origin, "/", prefixRoot(site.base, url));
}
