---
description: Nir Adler personal blog, tech related, and open source projects.
---

<script setup>
import { data as posts } from "./.vitepress/theme/posts.data.js";
import { withBase } from "vitepress";

const latest = posts.slice(0, 12);
const format = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
</script>

# Piece by Piece

Nir Adler personal blog, tech related, and open source projects.

<ol class="post-list">
  <li v-for="post in latest" :key="post.url">
    <p class="meta"><time :datetime="post.publishedAt">{{ format(post.publishedAt) }}</time></p>
    <h2><a :href="post.url">{{ post.title }}</a></h2>
    <p v-if="post.description" class="dek">{{ post.description }}</p>
  </li>
</ol>

<p><a :href="withBase('/archive')">All articles</a></p>
