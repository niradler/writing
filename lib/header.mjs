import { prefixRoot } from "./site.mjs";
import { asIso, datesDiffer, escapeHtml, formatUtcDate } from "./text.mjs";

export function postHeaderHtml(frontmatter, base) {
  const published = asIso(frontmatter.publishedAt);
  const parts = [
    `<time datetime="${escapeHtml(published)}">${escapeHtml(formatUtcDate(published))}</time>`,
  ];
  const updated = asIso(frontmatter.updatedAt);
  if (datesDiffer(published, updated)) {
    parts.push(
      `Updated <time datetime="${escapeHtml(updated)}">${escapeHtml(formatUtcDate(updated))}</time>`,
    );
  }
  if (frontmatter.seriesSlug && frontmatter.series) {
    const href = prefixRoot(
      base,
      `/series/${encodeURIComponent(frontmatter.seriesSlug)}`,
    );
    parts.push(`Part of <a href="${href}">${escapeHtml(frontmatter.series)}</a>`);
  }
  let html = `<p class="post-meta">${parts.join('<span class="sep" aria-hidden="true"> · </span>')}</p>\n`;
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  if (tags.length) {
    const links = tags
      .map((tag) => {
        const href = prefixRoot(base, `/tag/${encodeURIComponent(tag)}`);
        return `<a href="${href}">#${escapeHtml(tag)}</a>`;
      })
      .join(" ");
    html += `<p class="post-tags">${links}</p>\n`;
  }
  if (frontmatter.cover) {
    const src = prefixRoot(base, frontmatter.cover);
    html += `<figure class="cover"><img src="${escapeHtml(src)}" alt="${escapeHtml(
      frontmatter.coverAlt || "",
    )}" loading="eager" fetchpriority="high" decoding="async"></figure>\n`;
  }
  return `${html}\n`;
}

export function injectPostHeader(markdown, header) {
  const match = String(markdown).match(/^#\s+[^\n]+\n+/);
  if (!match) return `${header}${markdown}`;
  return `${markdown.slice(0, match[0].length)}${header}${markdown.slice(match[0].length)}`;
}
