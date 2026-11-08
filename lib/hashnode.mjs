import { parse } from "node-html-parser";
import { rewriteMarkdown } from "./media.mjs";

export function decodeHtml(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

export function parseSitemap(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    decodeHtml(match[1].trim()),
  );
}

export function postSlugFromUrl(input) {
  const url = new URL(input);
  const slug = url.pathname.replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/") || slug === "archive") return null;
  return slug;
}

export function parsePostHtml(html) {
  const root = parse(html);
  const title =
    attr(root, 'meta[property="og:title"]') || text(root.querySelector("h1"));
  const description = attr(root, 'meta[name="description"]');
  const publishedAt = attr(root, 'meta[property="article:published_time"]');
  const updatedAt = attr(root, 'meta[property="article:modified_time"]');
  const cover = attr(root, 'meta[property="og:image"]');
  const canonical = attr(root, 'link[rel="canonical"]', "href");
  const main = root.querySelector("main") || root;
  const coverImg = main.querySelector("img");
  const coverAlt = coverImg?.getAttribute("alt") || "";
  const tags = [];
  for (const link of main.querySelectorAll('a[href^="/tag/"]')) {
    const href = link.getAttribute("href") || "";
    const slug = href.match(/^\/tag\/([^/?#]+)$/)?.[1];
    if (!slug || tags.includes(slug)) continue;
    const label = link.text.replaceAll("#", "").trim();
    if (!label || label.length > 48) continue;
    tags.push(slug);
  }
  let series = "";
  let seriesSlug = "";
  for (const link of main.querySelectorAll('a[href^="/series/"]')) {
    if (!link.text.includes("Part of series")) continue;
    seriesSlug = (link.getAttribute("href") || "")
      .replace(/^\/series\//, "")
      .split(/[?#]/)[0];
    const named = link.querySelector(".truncate");
    series = (named?.text || "").trim();
    break;
  }
  return {
    title: title.trim(),
    description: description.trim(),
    publishedAt,
    updatedAt,
    cover,
    coverAlt: coverAlt.trim(),
    canonical,
    tags,
    series,
    seriesSlug,
  };
}

function attr(root, selector, name = "content") {
  return root.querySelector(selector)?.getAttribute(name) || "";
}

function text(node) {
  return node?.text?.trim() || "";
}

export function proseHtml(html) {
  const root = parse(html);
  const main = root.querySelector("main") || root;
  const prose = main.querySelector(".prose");
  return prose ? prose.innerHTML : "";
}

export function rewriteArticle(markdown, resolveUrl) {
  return (
    rewriteMarkdown(markdown, resolveUrl)
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}
