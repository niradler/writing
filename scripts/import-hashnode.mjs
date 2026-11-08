import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import TurndownService from "turndown";
import { filenameFromUrl } from "../lib/media.mjs";
import {
  parsePostHtml,
  parseSitemap,
  postSlugFromUrl,
  proseHtml,
  rewriteArticle,
} from "../lib/hashnode.mjs";
import { RESERVED_PATHS } from "../lib/site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "site/posts");
const publicDir = path.join(root, "site/public");
const migrationDir = path.join(root, "migration");
const origin = "https://blog.niradler.com";
const update = process.argv.includes("--update");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

async function main() {
  const locs = await sitemapLocs();
  const slugs = locs.map(postSlugFromUrl).filter(Boolean);
  const selected = slugs.slice(0, limit);
  const allSources = {};
  const report = {
    retrieved: new Date().toISOString(),
    completeness: "unverified",
    liveSitemapPosts: slugs.length,
    considered: selected.length,
    written: [],
    skipped: [],
    failed: [],
    remoteImages: [],
    missingAlt: [],
    sources: {
      sitemap: `${origin}/sitemap.xml`,
      markdown: `${origin}/{slug}.md`,
      hashnodeRepo: "https://github.com/niradler/hashnode was not found on 2026-11-08",
      assetsBackup:
        "https://github.com/niradler/hashnode-assets-backup is the backup action, and it does not contain post assets",
      supportExport: "pending; Hashnode support was not contacted",
      graphql:
        "Hashnode's public GraphQL API now requires a paid plan and was not used",
    },
  };
  const series = new Map();
  await mapPool(selected, 4, async (slug) => {
    try {
      const result = await importPost(slug);
      if (result.seriesSlug)
        series.set(result.seriesSlug, result.series || result.seriesSlug);
      report[result.status].push(result.summary);
      report.remoteImages.push(...result.remoteImages);
      report.missingAlt.push(...result.missingAlt);
      Object.assign(allSources, result.sources);
    } catch (error) {
      report.failed.push({ slug, error: error.message });
      console.error("failed", slug, error.message);
    }
  });
  await writeAbout();
  await writeBrand();
  await writeSeries(series);
  await mkdir(migrationDir, { recursive: true });
  await writeFile(
    path.join(migrationDir, "media-sources.json"),
    `${JSON.stringify(allSources, null, 2)}\n`,
  );
  await mkdir(migrationDir, { recursive: true });
  await writeFile(
    path.join(migrationDir, "inventory.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        sitemap: report.liveSitemapPosts,
        written: report.written.length,
        skipped: report.skipped.length,
        failed: report.failed.length,
        remoteImages: report.remoteImages.length,
      },
      null,
      2,
    ),
  );
  if (report.failed.length) process.exitCode = 1;
}

async function sitemapLocs() {
  const index = await fetchText(`${origin}/sitemap.xml`);
  const locs = parseSitemap(index);
  const pages = locs.filter((loc) => loc.includes("sitemap.xml?page="));
  if (!pages.length) return locs;
  const nested = [];
  for (const page of pages) nested.push(...parseSitemap(await fetchText(page)));
  return nested;
}

async function importPost(slug) {
  if (RESERVED_PATHS.has(slug)) throw new Error(`reserved slug ${slug}`);
  const target = path.join(postsDir, `${slug}.md`);
  const exists = await fileExists(target);
  if (exists && !update) {
    const current = matter(await readFile(target, "utf8")).data;
    return {
      status: "skipped",
      series: current.series || "",
      seriesSlug: current.seriesSlug || "",
      remoteImages: [],
      missingAlt: [],
      sources: {},
      summary: { slug, reason: "exists" },
    };
  }
  const [html, markdown] = await Promise.all([
    fetchText(`${origin}/${slug}`),
    fetchText(`${origin}/${slug}.md`),
  ]);
  const meta = parsePostHtml(html);
  if (!meta.title) throw new Error("missing title");
  if (!meta.publishedAt) throw new Error("missing publishedAt");
  const mediaDir = path.join(publicDir, "media", slug);
  const sources = {};
  const remoteImages = [];
  const missingAlt = [];
  let imageIndex = 0;
  const resolveUrl = (url) => {
    if (!/^https?:\/\//i.test(url)) return null;
    imageIndex += 1;
    const name = uniqueName(mediaDir, filenameFromUrl(url, imageIndex), sources);
    const local = `/media/${slug}/${name}`;
    sources[local] = url;
    return local;
  };
  const body = rewriteArticle(markdown, resolveUrl);
  await mkdir(mediaDir, { recursive: true });
  for (const [local, source] of Object.entries(sources)) {
    const dest = path.join(publicDir, local.replace(/^\//, ""));
    const saved = await downloadFile(source, dest);
    if (!saved) remoteImages.push({ slug, local, source });
  }
  let cover = "";
  let coverAlt = meta.coverAlt;
  if (meta.cover) {
    const name = `cover${extensionFromUrl(meta.cover)}`;
    const dest = path.join(mediaDir, name);
    const saved = await downloadFile(meta.cover, dest);
    if (saved) {
      cover = `/media/${slug}/${name}`;
      sources[cover] = meta.cover;
    } else {
      cover = meta.cover;
      remoteImages.push({ slug, local: cover, source: meta.cover, cover: true });
    }
  }
  if (!coverAlt) missingAlt.push({ slug, src: cover || meta.cover || "" });
  const stored = restoreFailedDownloads(body, sources, remoteImages);
  const data = {
    title: meta.title,
    description: meta.description,
    publishedAt: meta.publishedAt,
    updatedAt: meta.updatedAt || meta.publishedAt,
    tags: meta.tags,
    sourceUrl: `${origin}/${slug}`,
    originalUrl: meta.canonical || `${origin}/${slug}`,
    sourceMarkdown: `${origin}/${slug}.md`,
  };
  if (meta.seriesSlug) {
    data.series = meta.series || meta.seriesSlug;
    data.seriesSlug = meta.seriesSlug;
  }
  if (cover) data.cover = cover;
  if (coverAlt) data.coverAlt = coverAlt;
  await mkdir(postsDir, { recursive: true });
  await writeFile(target, matter.stringify(stored, data, { lineWidth: 1000 }));
  return {
    status: "written",
    series: data.series || "",
    seriesSlug: data.seriesSlug || "",
    remoteImages,
    missingAlt: missingAlt.filter((item) => item.src),
    sources,
    summary: { slug, title: meta.title, publishedAt: meta.publishedAt },
  };
}

function uniqueName(dir, name, sources) {
  const used = new Set(Object.keys(sources).map((key) => path.basename(key)));
  if (!used.has(name)) return name;
  const ext = path.extname(name);
  const stem = name.slice(0, -ext.length || undefined);
  let index = 2;
  while (used.has(`${stem}-${index}${ext}`)) index += 1;
  return `${stem}-${index}${ext}`;
}

function extensionFromUrl(input) {
  try {
    const ext = path.extname(new URL(input).pathname).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"].includes(ext))
      return ext;
  } catch {
    return ".img";
  }
  return ".img";
}

function restoreFailedDownloads(body, sources, remoteImages) {
  let next = body;
  for (const item of remoteImages) {
    if (!item.local?.startsWith("/media/")) continue;
    const source = sources[item.local];
    if (source) next = next.replaceAll(item.local, source);
  }
  return next;
}

async function writeAbout() {
  const target = path.join(root, "site/page/about.md");
  if ((await fileExists(target)) && !update) return;
  const html = await fetchText(`${origin}/page/about`);
  const meta = parsePostHtml(html);
  const prose = proseHtml(html);
  if (!prose) throw new Error("about page prose was not found");
  const body = `${turndown.turndown(prose).trim()}\n`;
  const data = {
    title: meta.title || "About",
    description: meta.description,
    originalUrl: `${origin}/page/about`,
  };
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, matter.stringify(body, data, { lineWidth: 1000 }));
}

async function writeBrand() {
  const assets = {
    "site/public/brand/logo-light.png":
      "https://cdn.hashnode.com/uploads/logos/5fa47dee3e634314b5179767/efe24754-e1b4-423a-bde7-91b47a2be6e7.png",
    "site/public/brand/logo-dark.png":
      "https://cdn.hashnode.com/uploads/logos/5fa47dee3e634314b5179767/148280d0-c6f5-45f4-bbd6-7fa7b00b29f5.png",
    "site/public/favicon.png":
      "https://cdn.hashnode.com/uploads/favicons/5fa47dee3e634314b5179767/88c182ba-b55c-4c4d-a62c-701ddaa75e00.png",
    "site/public/brand/avatar.png":
      "https://cdn.hashnode.com/res/hashnode/image/upload/v1669934545783/845HzZilk.png",
  };
  for (const [rel, url] of Object.entries(assets)) {
    const saved = await downloadFile(url, path.join(root, rel));
    if (!saved) console.error("brand asset missing", rel);
  }
}

async function writeSeries(series) {
  const order = ["open-source", "diy", "hackathons", "chat-first", "your-next-startup"];
  const entries = [...series.entries()]
    .filter(([slug, name]) => slug && name)
    .sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a[0].localeCompare(b[0]);
    })
    .map(([slug, name]) => ({ slug, name }));
  const file = path.join(root, "site/.vitepress/series.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`);
}

function sniffExtension(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return ".png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return ".jpg";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString() === "GIF87a") return ".gif";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString() === "GIF89a") return ".gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === "RIFF") return ".webp";
  return "";
}

async function downloadFile(url, dest) {
  if (await fileExists(dest)) return path.basename(dest);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "writing-migration/1.0" },
      redirect: "follow",
    });
    if (!response.ok) return false;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 15_000_000) return false;
    await mkdir(path.dirname(dest), { recursive: true });
    const sniffed = sniffExtension(bytes);
    const current = path.extname(dest);
    const finalDest =
      sniffed && (current === ".img" || current === "")
        ? dest.slice(0, -current.length) + sniffed
        : dest;
    await writeFile(finalDest, bytes);
    if (finalDest !== dest) {
      dest = finalDest;
    }
    return path.basename(finalDest);
  } catch {
    return false;
  }
}

async function fetchText(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": "writing-migration/1.0", accept: "*/*" },
      redirect: "follow",
    });
    if (response.status === 429 || response.status >= 500) {
      await delay(400 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.text();
  }
  throw new Error(`failed ${url}`);
}

async function fileExists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool(items, size, worker) {
  const queue = [...items];
  const runners = Array.from({ length: size }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

main();
