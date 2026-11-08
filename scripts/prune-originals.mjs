import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSiteTarget } from "../lib/site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = resolveSiteTarget(process.env.SITE_TARGET);
const dist = path.join(root, site.target === "production" ? "dist-production" : "dist");
const manifest = JSON.parse(
  await readFile(path.join(root, "site/.vitepress/image-manifest.json"), "utf8"),
);

let removed = 0;
for (const [src, entry] of Object.entries(manifest.images || {})) {
  if (!entry.omitOriginal) continue;
  const file = path.join(dist, src.replace(/^\//, ""));
  try {
    await unlink(file);
    removed += 1;
  } catch {}
}
console.log(`removed ${removed} original images from ${path.basename(dist)}`);
