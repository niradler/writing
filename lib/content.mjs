import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { asIso } from "./text.mjs";

export async function loadMarkdownDir(dir) {
  let names = [];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const posts = [];
  for (const name of names.filter((entry) => entry.endsWith(".md")).sort()) {
    const slug = name.slice(0, -3);
    const raw = await readFile(path.join(dir, name), "utf8");
    const parsed = matter(raw);
    posts.push({
      slug,
      file: path.join(dir, name),
      body: parsed.content,
      data: normalizeFrontmatter(parsed.data, slug),
    });
  }
  return posts;
}

export function normalizeFrontmatter(data, slug) {
  const tags = Array.isArray(data.tags) ? data.tags.map((tag) => String(tag)) : [];
  return {
    ...data,
    title: data.title ? String(data.title) : "",
    description: data.description ? String(data.description) : "",
    publishedAt: asIso(data.publishedAt),
    updatedAt: asIso(data.updatedAt),
    tags,
    series: data.series ? String(data.series) : "",
    seriesSlug: data.seriesSlug ? String(data.seriesSlug) : "",
    cover: data.cover ? String(data.cover) : "",
    coverAlt: data.coverAlt ? String(data.coverAlt) : "",
    originalUrl: data.originalUrl ? String(data.originalUrl) : "",
    fixture: Boolean(data.fixture),
    draft: Boolean(data.draft),
    slug,
  };
}

export function publishedPosts(posts) {
  return posts
    .filter((post) => !post.data.fixture && !post.data.draft)
    .sort((a, b) => Date.parse(b.data.publishedAt) - Date.parse(a.data.publishedAt));
}
