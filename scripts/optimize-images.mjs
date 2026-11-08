import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BRAND_WIDTHS, DISPLAY_WIDTHS, variantWidths } from "../lib/images.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "site/public");
const manifestPath = path.join(root, "site/.vitepress/image-manifest.json");
const raster = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

sharp.cache(false);
const decode = { limitInputPixels: false, animated: true };

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "media-opt" || entry.name === "fixtures") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else if (raster.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function publicPath(file) {
  return `/${path.relative(publicDir, file).split(path.sep).join("/")}`;
}

function variantPath(source, suffix, ext) {
  const relative = source.replace(/^\//, "");
  const directory = path.posix.dirname(relative);
  const base = path.posix.basename(relative, path.posix.extname(relative));
  return `/media-opt/${directory}/${base}-${suffix}.${ext}`;
}

async function writePublic(urlPath, buffer) {
  const file = path.join(publicDir, urlPath.replace(/^\//, ""));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  return urlPath;
}

function widthsFor(source, intrinsic) {
  const widths = source.startsWith("/brand/") ? BRAND_WIDTHS : DISPLAY_WIDTHS;
  return variantWidths(intrinsic, widths);
}

async function stillImage(file, source, info, bytes) {
  const widths = widthsFor(source, info.width);
  const png = info.format === "png";
  const variants = [];
  for (const width of widths) {
    const webp = await sharp(file, { limitInputPixels: false })
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: png ? 84 : 72, effort: 4, alphaQuality: 100 })
      .toBuffer();
    const meta = await sharp(webp).metadata();
    if (meta.width > info.width) throw new Error(`${source} webp was upscaled`);
    if (webp.length < bytes) {
      const src = await writePublic(variantPath(source, meta.width, "webp"), webp);
      variants.push({
        src,
        width: meta.width,
        type: "image/webp",
        role: "webp",
        bytes: webp.length,
      });
    }
  }
  const fallbackWidth = widths.at(-1);
  let fallbackBuffer;
  let fallbackType;
  let fallbackExt;
  if (png) {
    fallbackBuffer = await sharp(file, { limitInputPixels: false })
      .resize({ width: fallbackWidth, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fallbackType = "image/png";
    fallbackExt = "png";
  } else {
    fallbackBuffer = await sharp(file, { limitInputPixels: false })
      .resize({ width: fallbackWidth, withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();
    fallbackType = "image/jpeg";
    fallbackExt = "jpg";
  }
  const fallbackMeta = await sharp(fallbackBuffer).metadata();
  if (fallbackMeta.width > info.width)
    throw new Error(`${source} fallback was upscaled`);
  let fallbackSrc = source;
  let omitOriginal = false;
  if (fallbackBuffer.length < bytes) {
    fallbackSrc = await writePublic(
      variantPath(source, fallbackMeta.width, fallbackExt),
      fallbackBuffer,
    );
    omitOriginal = true;
  }
  variants.push({
    src: fallbackSrc,
    width: fallbackMeta.width,
    type: fallbackType,
    role: "fallback",
    bytes: fallbackSrc === source ? bytes : fallbackBuffer.length,
  });
  const socialWidth = Math.min(1200, info.width);
  const socialBuffer = await sharp(file, { limitInputPixels: false })
    .resize({ width: socialWidth, withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
  const socialMeta = await sharp(socialBuffer).metadata();
  const social =
    info.hasAlpha && png
      ? fallbackSrc
      : await writePublic(
          variantPath(source, `social-${socialMeta.width}`, "jpg"),
          socialBuffer,
        );
  return {
    width: info.width,
    height: info.height,
    animated: false,
    bytes,
    variants,
    social,
    omitOriginal,
  };
}

async function animatedImage(file, source, info, bytes) {
  const pages = info.pages || 1;
  const frameHeight = info.pageHeight || info.height;
  const target = Math.min(info.width, source.startsWith("/brand/") ? 160 : 1280);
  let gifBuffer = null;
  let gifSrc = source;
  let width = info.width;
  let height = frameHeight;
  if (target < info.width) {
    try {
      const resized = await sharp(file, { ...decode, pages: -1 })
        .resize({ width: target, withoutEnlargement: true })
        .gif()
        .toBuffer();
      const meta = await sharp(resized, decode).metadata();
      if (
        (meta.pages || 1) === pages &&
        meta.width <= info.width &&
        resized.length < bytes
      ) {
        gifBuffer = resized;
        width = meta.width;
        height = meta.pageHeight || meta.height;
        gifSrc = await writePublic(variantPath(source, width, "gif"), resized);
      }
    } catch (error) {
      console.warn(`${source} kept original animation (${error.message})`);
    }
  }
  const variants = [];
  const webp = await sharp(gifBuffer || file, { ...decode, pages: -1 })
    .webp({ quality: 70, effort: 3, loop: 0 })
    .toBuffer();
  const webpMeta = await sharp(webp, decode).metadata();
  if ((webpMeta.pages || 1) === pages && webp.length < (gifBuffer?.length || bytes)) {
    const src = await writePublic(variantPath(source, width, "webp"), webp);
    variants.push({
      src,
      width,
      type: "image/webp",
      role: "webp",
      bytes: webp.length,
      pages,
    });
  }
  variants.push({
    src: gifSrc,
    width,
    type: "image/gif",
    role: "fallback",
    bytes: gifBuffer?.length || bytes,
    pages,
  });
  return {
    width,
    height,
    animated: true,
    pages,
    bytes,
    variants,
    social: gifSrc,
    omitOriginal: gifSrc !== source,
  };
}

let previous = {};
try {
  previous = JSON.parse(await readFile(manifestPath, "utf8")).images || {};
} catch {}

const images = {};
const files = await walk(publicDir);
for (const file of files) {
  const source = publicPath(file);
  if (source === "/favicon.png") continue;
  const fileStat = await stat(file);
  const stamp = `${fileStat.mtimeMs}:${fileStat.size}`;
  const cached = previous[source];
  if (cached?.stamp === stamp && cached.variants?.every((item) => item.src)) {
    const present = await Promise.all(
      cached.variants.map((item) =>
        stat(path.join(publicDir, item.src.replace(/^\//, "")))
          .then(() => true)
          .catch(() => false),
      ),
    );
    if (present.every(Boolean)) {
      images[source] = cached;
      continue;
    }
  }
  const info = await sharp(file, decode).metadata();
  if (!info.width || !info.height) throw new Error(`${source} could not be decoded`);
  const entry =
    (info.pages || 1) > 1
      ? await animatedImage(file, source, info, fileStat.size)
      : await stillImage(file, source, info, fileStat.size);
  for (const variant of entry.variants) {
    if (variant.width > info.width)
      throw new Error(`${source} emitted a wider variant`);
  }
  entry.stamp = stamp;
  images[source] = entry;
  const shipped = entry.variants.reduce((sum, item) => sum + item.bytes, 0);
  console.log(
    `${source} ${Math.round(fileStat.size / 1024)}KB -> ${Math.round(shipped / 1024)}KB${entry.animated ? " animated" : ""}`,
  );
}

await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify({ images }, null, 2)}\n`);
console.log(`optimized ${Object.keys(images).length} images`);
