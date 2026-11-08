import { createContentLoader } from "vitepress";
import { articlePath, resolveSiteTarget } from "../../../lib/site.mjs";

function plainText(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : "";
}

function articleUrl(pageUrl) {
  return articlePath(pageUrl, resolveSiteTarget(process.env.SITE_TARGET).base);
}

export default createContentLoader("posts/*.md", {
  includeSrc: true,
  transform(raw) {
    return raw
      .filter((page) => !page.frontmatter.fixture && !page.frontmatter.draft)
      .map((page) => ({
        title: String(page.frontmatter.title || ""),
        description: String(page.frontmatter.description || ""),
        url: articleUrl(page.url),
        publishedAt: iso(page.frontmatter.publishedAt),
        updatedAt: iso(page.frontmatter.updatedAt),
        tags: Array.isArray(page.frontmatter.tags)
          ? page.frontmatter.tags.map(String)
          : [],
        series: page.frontmatter.series ? String(page.frontmatter.series) : "",
        seriesSlug: page.frontmatter.seriesSlug
          ? String(page.frontmatter.seriesSlug)
          : "",
        text: plainText(page.src || "").slice(0, 5000),
      }))
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  },
});
