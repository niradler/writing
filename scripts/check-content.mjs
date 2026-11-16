import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarkdownDir } from "../lib/content.mjs";
import { collectMediaRefs } from "../lib/media.mjs";
import { REDIRECTS, RESERVED_PATHS } from "../lib/site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const posts = await loadMarkdownDir(path.join(root, "site/posts"));
const errors = [];
const warnings = [];

if (!posts.length) errors.push("no posts were imported");

for (const post of posts) {
  const { data, slug, body } = post;
  if (!data.title) errors.push(`${slug}: missing title`);
  if (!data.publishedAt) errors.push(`${slug}: missing publishedAt`);
  if (!data.originalUrl) errors.push(`${slug}: missing originalUrl`);
  if (data.fixture) errors.push(`${slug}: fixture filed as a post`);
  if (RESERVED_PATHS.has(slug)) errors.push(`${slug}: reserved path`);
  if (data.sourceUrl !== `https://blog.niradler.com/${slug}`) {
    errors.push(`${slug}: sourceUrl does not match the live slug`);
  }
  if (data.originalUrl) {
    try {
      new URL(data.originalUrl);
    } catch {
      errors.push(`${slug}: originalUrl is not a URL`);
    }
  }
  if (data.publishedAt && Number.isNaN(Date.parse(data.publishedAt))) {
    errors.push(`${slug}: invalid publishedAt`);
  }
  for (const tag of data.tags) {
    if (!tag.trim()) errors.push(`${slug}: empty tag`);
  }
  const refs = collectMediaRefs(
    `${body}\n<img src="${data.cover || ""}" alt="${data.coverAlt || ""}">`,
  );
  for (const local of new Set(
    refs.local.filter((item) => item.startsWith("/media/")),
  )) {
    const file = path.join(root, "site/public", local.replace(/^\//, ""));
    try {
      await access(file);
    } catch {
      errors.push(`${slug}: missing media ${local}`);
    }
  }
  if (!data.coverAlt && data.cover) errors.push(`${slug}: cover has no alt text`);
  for (const src of refs.missingAlt) {
    if (src.startsWith("/media/") || /^https?:\/\//i.test(src)) {
      errors.push(`${slug}: image missing alt (${src})`);
    }
  }
  for (const src of refs.remote) errors.push(`${slug}: remote image ${src}`);
}

for (const [, target] of REDIRECTS) {
  const slug = target.replace(/^\//, "");
  if (!posts.some((post) => post.slug === slug))
    errors.push(`redirect target missing: ${target}`);
}

const inventory = JSON.parse(
  await readFile(path.join(root, "migration/inventory.json"), "utf8"),
);
if (inventory.completeness !== "unverified")
  errors.push("inventory completeness was changed");
if (inventory.failed?.length) errors.push("inventory contains failed imports");
const inventorySlugs = new Set((inventory.written || []).map((item) => item.slug));
const imported = posts.filter((post) => inventorySlugs.has(post.slug));
if (inventory.liveSitemapPosts !== imported.length) {
  errors.push(
    `imported ${imported.length} posts but the sitemap inventory lists ${inventory.liveSitemapPosts}`,
  );
}

const about = await readFile(path.join(root, "site/page/about.md"), "utf8");
if (!about.includes("Nir Adler"))
  errors.push("about page is missing the source byline");

console.log(`posts ${posts.length}`);
console.log(`warnings ${warnings.length}`);
for (const warning of warnings) console.log(`warn ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`error ${error}`);
  process.exit(1);
}
