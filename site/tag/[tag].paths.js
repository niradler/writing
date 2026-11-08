import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarkdownDir } from "../../lib/content.mjs";

export default {
  async paths() {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../posts");
    const posts = await loadMarkdownDir(dir);
    const tags = new Set();
    for (const post of posts) {
      if (post.data.fixture || post.data.draft) continue;
      for (const tag of post.data.tags) tags.add(tag);
    }
    return [...tags].map((tag) => ({ params: { tag } }));
  },
};
