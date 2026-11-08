import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarkdownDir } from "../lib/content.mjs";
import { collectMediaRefs } from "../lib/media.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const posts = await loadMarkdownDir(path.join(root, "site/posts"));
const report = { remote: [], missingAlt: [], embeds: [] };
for (const post of posts) {
  const refs = collectMediaRefs(post.body);
  for (const src of refs.remote) report.remote.push({ slug: post.slug, src });
  for (const src of refs.missingAlt) report.missingAlt.push({ slug: post.slug, src });
  for (const src of refs.embeds) report.embeds.push({ slug: post.slug, src });
  if (post.data.cover && !post.data.coverAlt) {
    report.missingAlt.push({ slug: post.slug, src: post.data.cover });
  }
}
const dir = path.join(root, "migration");
await mkdir(dir, { recursive: true });
await writeFile(
  path.join(dir, "media-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `remote ${report.remote.length}, missing alt ${report.missingAlt.length}, embeds ${report.embeds.length}`,
);
