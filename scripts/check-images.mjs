import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSiteTarget } from "../lib/site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = resolveSiteTarget(process.env.SITE_TARGET);
const dist = path.resolve(
  root,
  process.env.DIST || (site.target === "production" ? "dist-production" : "dist"),
);
const errors = [];
const hosts =
  /(?:licdn\.com|cdn\.hashnode\.com|images\.unsplash\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/i;

const manifest = JSON.parse(
  await readFile(path.join(root, "site/.vitepress/image-manifest.json"), "utf8"),
);
const unavailable = JSON.parse(
  await readFile(path.join(root, "migration/unavailable-media.json"), "utf8"),
);
if (
  !unavailable.assets?.some(
    (item) => item.status === 403 && /text\/html/i.test(item.contentType),
  )
) {
  errors.push("unavailable media report is missing the blocked LinkedIn image");
}

for (const [src, entry] of Object.entries(manifest.images || {})) {
  if (!entry.width || !entry.height) errors.push(`${src} is missing dimensions`);
  for (const variant of entry.variants || []) {
    if (variant.width > entry.width && !entry.animated) {
      errors.push(`${src} variant ${variant.src} is wider than the original`);
    }
    const file = path.join(root, "site/public", variant.src.replace(/^\//, ""));
    const bytes = await readFile(file).catch(() => null);
    if (!bytes) {
      errors.push(`${variant.src} is missing`);
      continue;
    }
    const magic = bytes.subarray(0, 12).toString("latin1");
    const ok =
      (variant.type === "image/webp" &&
        magic.startsWith("RIFF") &&
        magic.includes("WEBP")) ||
      (variant.type === "image/png" && magic.startsWith("\x89PNG")) ||
      (variant.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
      (variant.type === "image/gif" && magic.startsWith("GIF8"));
    if (!ok) errors.push(`${variant.src} magic bytes do not match ${variant.type}`);
    if (variant.src !== src) {
      const shipped = path.join(dist, variant.src.replace(/^\//, ""));
      try {
        await access(shipped);
      } catch {
        errors.push(`${variant.src} was not published`);
      }
    }
  }
  if (entry.omitOriginal) {
    try {
      await access(path.join(dist, src.replace(/^\//, "")));
      errors.push(`${src} original was still published`);
    } catch {}
  }
}

const htmlFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".html") || entry.name.endsWith(".css"))
      htmlFiles.push(full);
  }
}
await walk(dist);

let youtube = false;
const base = site.base === "/" ? "" : site.base.replace(/\/$/, "");
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const urls = file.endsWith(".css")
    ? html.match(/url\([^)]*\)/g) || []
    : [
        ...(html.match(/\b(?:src|srcset)=["'][^"']+["']/gi) || []),
        ...(html.match(/property="og:image" content="[^"]+"/g) || []),
        ...(html.match(/name="twitter:image" content="[^"]+"/g) || []),
      ];
  if (urls.some((value) => hosts.test(value))) {
    errors.push(
      `${path.relative(dist, file)} references an external image or font host`,
    );
  }
  if (html.includes("youtube-nocookie.com/embed")) youtube = true;
  if (!file.endsWith(".html")) continue;
  const rel = path.relative(dist, file).replaceAll("\\", "/");
  const list = [
    "index.html",
    "archive.html",
    "archive/index.html",
    "tags.html",
    "tags/index.html",
    "series.html",
    "series/index.html",
    "search.html",
    "search/index.html",
  ].includes(rel);
  const imageTags = html.match(/<(?:img|source)\b[^>]*>/gi) || [];
  if (list) {
    for (const tag of imageTags) {
      if (
        /\/media-opt\/media\//.test(tag) ||
        /\/media\/[^"']+\.(?:png|jpe?g|gif|webp)/.test(tag)
      ) {
        errors.push(`${rel} loads an article image`);
      }
    }
  }
  if (rel === "post-training-when-a-specialist-beats-a-bigger-model.html") {
    const cover = html.match(/<figure class="cover">[\s\S]*?<\/figure>/)?.[0] || "";
    if (!cover.includes('fetchpriority="high"') || !cover.includes('loading="eager"')) {
      errors.push("article cover is not the eager priority image");
    }
    if (cover.includes('loading="lazy"') || !cover.includes("image/webp")) {
      errors.push("article cover is missing a prioritized webp source");
    }
    const origin = site.origin.replace(/\/$/, "");
    const og = html.match(/property="og:image" content="([^"]+)"/)?.[1] || "";
    if (!og.startsWith(`${origin}${base}/media-opt/`)) errors.push(`og:image is ${og}`);
    if (/\.(gif|webp)$/i.test(og)) errors.push("og:image is not a jpeg or png");
  }
  if (rel === "coding-agents-are-reshaping-the-sdlc.html") {
    if (!html.includes('loading="lazy"'))
      errors.push("diagram post has no lazy images");
    const cover = html.match(/<figure class="cover">[\s\S]*?<\/figure>/)?.[0] || "";
    if (!cover.includes("image/webp")) errors.push("diagram cover has no webp source");
  }
  if (rel === "lyve-cloud-hackathon-submission-1st-place.html") {
    if (imageTags.some((tag) => tag.includes("licdn.com"))) {
      errors.push("LinkedIn image is still requested");
    }
    if (!html.includes("docs.google.com/presentation")) {
      errors.push("the presentation embed was removed");
    }
  }
  if (rel.endsWith("about.html") && html.includes("/brand/avatar.png")) {
    errors.push("about page still uses the full avatar");
  }
}
if (!youtube) errors.push("YouTube embeds were removed");

const about = htmlFiles.find((file) => file.endsWith(`${path.sep}about.html`));
if (about) {
  const html = await readFile(about, "utf8");
  if (html.includes("/brand/avatar.png"))
    errors.push("about page still uses the full avatar");
  if (!html.includes("/media-opt/brand/avatar-160.")) {
    errors.push("about avatar is not the 160px derivative");
  }
}

if (errors.length) {
  for (const error of errors) console.error(`error ${error}`);
  process.exit(1);
}
console.log(`image checks passed for ${site.target}`);
