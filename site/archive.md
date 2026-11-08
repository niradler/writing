---
title: Archive
description: Every article on Piece by Piece, newest first.
---

<script setup>
import { computed } from "vue";
import { data as posts } from "./.vitepress/theme/posts.data.js";

const format = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

const groups = computed(() => {
  const map = new Map();
  for (const post of posts) {
    const year = new Date(post.publishedAt).getUTCFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year).push(post);
  }
  return [...map.entries()];
});
</script>

# Archive

<p>{{ posts.length }} articles in this import.</p>

<section v-for="[year, group] in groups" :key="year" :aria-labelledby="`year-${year}`">
  <h2 :id="`year-${year}`">{{ year }}</h2>
  <ol class="post-list">
    <li v-for="post in group" :key="post.url">
      <p class="meta"><time :datetime="post.publishedAt">{{ format(post.publishedAt) }}</time></p>
      <h3><a :href="post.url">{{ post.title }}</a></h3>
    </li>
  </ol>
</section>
