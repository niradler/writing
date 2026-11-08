---
title: Tags
description: Article tags on Piece by Piece.
---

<script setup>
import { computed } from "vue";
import { withBase } from "vitepress";
import { data as posts } from "./.vitepress/theme/posts.data.js";

const tags = computed(() => {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
});
</script>

# Tags

<p v-if="!tags.length">This import has no tags yet.</p>

<ul class="tag-index">
  <li v-for="[tag, count] in tags" :key="tag">
    <a :href="withBase(`/tag/${encodeURIComponent(tag)}`)">#{{ tag }}</a>
    <span class="meta">{{ count }}</span>
  </li>
</ul>
