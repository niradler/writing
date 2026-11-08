import { escapeHtml } from "./text.mjs";

export const DISPLAY_WIDTHS = [64, 160, 480, 800, 1280, 1600];
export const BRAND_WIDTHS = [64, 160];
export const ARTICLE_SIZES = "(min-width: 960px) 42rem, calc(100vw - 2.5rem)";

export function variantWidths(intrinsic, widths = DISPLAY_WIDTHS) {
  const limit = Math.max(0, Math.round(Number(intrinsic) || 0));
  if (!limit) return [];
  const cap = Math.min(limit, widths[widths.length - 1]);
  const chosen = widths.filter((width) => width < cap);
  chosen.push(cap);
  return [...new Set(chosen)];
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[2] ?? match[3] ?? "") : "";
}

export function pictureHtml({
  alt = "",
  width,
  height,
  variants = [],
  sizes = ARTICLE_SIZES,
  loading,
  fetchPriority,
  className,
  align,
}) {
  const webp = variants.filter((item) => item.role === "webp");
  const fallback = variants.find((item) => item.role === "fallback") || webp.at(-1);
  if (!fallback) return "";
  const attrs = [
    `src="${escapeHtml(fallback.src)}"`,
    `alt="${escapeHtml(alt)}"`,
    width ? `width="${width}"` : "",
    height ? `height="${height}"` : "",
    className ? `class="${escapeHtml(className)}"` : "",
    align ? `data-align="${escapeHtml(align)}"` : "",
    loading ? `loading="${loading}"` : "",
    fetchPriority ? `fetchpriority="${fetchPriority}"` : "",
    'decoding="async"',
  ].filter(Boolean);
  const img = `<img ${attrs.join(" ")}>`;
  if (!webp.length) return img;
  const srcset = webp.map((item) => `${item.src} ${item.width}w`).join(", ");
  return `<picture><source type="image/webp" srcset="${escapeHtml(srcset)}" sizes="${escapeHtml(sizes)}">${img}</picture>`;
}

function replaceImages(html, images, priority) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attr(tag, "src");
    const entry = images[src];
    if (!entry?.variants?.length) return tag;
    const className = attr(tag, "class");
    const isLogo = /(^|\s)logo(\s|$)/.test(className);
    const isAvatar = /(^|\s)avatar(\s|$)/.test(className);
    const eager = priority || isLogo || isAvatar;
    return pictureHtml({
      alt: attr(tag, "alt"),
      width: entry.width,
      height: entry.height,
      variants: entry.variants,
      sizes: isLogo ? "32px" : isAvatar ? "4.5rem" : ARTICLE_SIZES,
      loading: eager ? "eager" : "lazy",
      fetchPriority: priority ? "high" : "",
      className,
      align: attr(tag, "data-align"),
    });
  });
}

export function rewriteContentImages(html, manifest) {
  const images = manifest?.images || {};
  let next = String(html).replace(
    /<figure class="cover">([\s\S]*?)<\/figure>/gi,
    (_, inner) =>
      `<figure class="cover">${replaceImages(inner, images, true)}</figure>`,
  );
  const held = [];
  next = next.replace(/<picture\b[\s\S]*?<\/picture>/gi, (block) => {
    held.push(block);
    return `\u0000PICTURE${held.length - 1}\u0000`;
  });
  next = replaceImages(next, images, false);
  return next.replace(/\u0000PICTURE(\d+)\u0000/g, (_, index) => held[Number(index)]);
}

export function socialSrc(manifest, src) {
  return manifest?.images?.[src]?.social || src;
}
