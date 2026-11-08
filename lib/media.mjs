import { escapeHtml, outsideFences } from "./text.mjs";
import { prefixRoot } from "./site.mjs";

export function parseImageInner(inner) {
  let text = String(inner).trim();
  let align;
  const alignMatch = text.match(/\s+align="(left|center|right)"\s*$/);
  if (alignMatch) {
    align = alignMatch[1];
    text = text.slice(0, alignMatch.index).trim();
  }
  let title;
  const titleMatch = text.match(/\s+"([^"]*)"\s*$/);
  if (titleMatch) {
    title = titleMatch[1];
    text = text.slice(0, titleMatch.index).trim();
  }
  const url = text.replace(/^<|>$/g, "");
  return { url, align, title };
}

export function youtubeId(input) {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] || "";
    }
    if (/^[a-zA-Z0-9_-]{6,}$/.test(id)) return id;
  } catch {
    return null;
  }
  return null;
}

export function embedForUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return `<p><a href="${escapeHtml(input)}">${escapeHtml(input)}</a></p>`;
  }
  const host = url.hostname.replace(/^www\./, "");
  const id = youtubeId(url.href);
  if (
    (host === "youtube.com" ||
      host === "youtu.be" ||
      host === "youtube-nocookie.com") &&
    id
  ) {
    return embedFrame(`https://www.youtube-nocookie.com/embed/${id}`, "YouTube video");
  }
  if (host === "docs.google.com" && url.pathname.startsWith("/presentation/")) {
    return embedFrame(url.href, "Embedded presentation");
  }
  if (host === "player.vimeo.com" && url.pathname.startsWith("/video/")) {
    return embedFrame(url.href, "Vimeo video");
  }
  return `<p><a href="${escapeHtml(url.href)}">${escapeHtml(url.href)}</a></p>`;
}

function embedFrame(src, title) {
  return `<figure class="embed"><iframe src="${escapeHtml(src)}" title="${escapeHtml(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></figure>`;
}

function imageHtml(src, alt, align, title) {
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt || "")}" loading="lazy" decoding="async"${
    align ? ` data-align="${align}"` : ""
  }>`;
  if ((title && title !== alt) || align) {
    const caption =
      title && title !== alt ? `\n<figcaption>${escapeHtml(title)}</figcaption>` : "";
    return `<figure class="media"${align ? ` data-align="${align}"` : ""}>\n${img}${caption}\n</figure>`;
  }
  return img;
}

function rewriteImgTag(tag, resolveUrl) {
  const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch) return tag;
  const resolved = resolveUrl(srcMatch[1]) || srcMatch[1];
  let next = tag.replace(srcMatch[0], `src="${escapeHtml(resolved)}"`);
  if (!/\bloading\s*=/.test(next)) {
    next = next.replace(/<img/i, '<img loading="lazy" decoding="async"');
  }
  return next;
}

export function rewriteMarkdown(markdown, resolveUrl = (url) => url) {
  return outsideFences(markdown, (part) => {
    let next = part.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (tag) => {
      const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      return src ? embedForUrl(src[1]) : tag;
    });
    next = next.replace(/%\[(https?:\/\/[^\]]+)\]/g, (_, url) =>
      embedForUrl(url.trim()),
    );
    next = next.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_, alt, inner) => {
      const parsed = parseImageInner(inner);
      const src = resolveUrl(parsed.url) || parsed.url;
      return imageHtml(src, alt, parsed.align, parsed.title);
    });
    next = next.replace(/<img\b[^>]*>/gi, (tag) => rewriteImgTag(tag, resolveUrl));
    return next;
  });
}

export function prefixHtmlMedia(html, base) {
  return String(html).replace(
    /(\s(?:src|href)\s*=\s*["'])(\/[^"']*)(["'])/gi,
    (_, start, url, end) => `${start}${prefixRoot(base, url)}${end}`,
  );
}

export function collectMediaRefs(markdown) {
  const local = [];
  const remote = [];
  const missingAlt = [];
  const embeds = [];
  outsideFences(markdown, (part) => {
    for (const match of part.matchAll(/<img\b[^>]*>/gi)) {
      const tag = match[0];
      const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? null;
      if (alt === null || alt.trim() === "") missingAlt.push(src);
      if (src.startsWith("/")) local.push(src);
      else if (/^https?:\/\//i.test(src)) remote.push(src);
    }
    for (const match of part.matchAll(/<(?:video|audio|source)\b[^>]*>/gi)) {
      const src = match[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!src) continue;
      if (src.startsWith("/")) local.push(src);
      else if (/^https?:\/\//i.test(src)) remote.push(src);
    }
    for (const match of part.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      embeds.push(match[1]);
    }
    return part;
  });
  return { local, remote, missingAlt, embeds };
}

export function filenameFromUrl(input, index) {
  let base = `asset-${index}`;
  try {
    const url = new URL(input);
    const leaf = decodeURIComponent(
      url.pathname.split("/").filter(Boolean).pop() || "",
    );
    const cleaned = leaf.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "");
    if (cleaned && cleaned.length <= 120) base = cleaned;
  } catch {
    base = `asset-${index}`;
  }
  return base;
}
