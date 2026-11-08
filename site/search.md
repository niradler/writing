---
title: Search
description: Search articles on Piece by Piece.
---

<script setup>
import { computed, ref } from "vue";
import { data as posts } from "./.vitepress/theme/posts.data.js";

const query = ref("");
const results = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return posts;
  return posts.filter((post) =>
    `${post.title} ${post.description} ${post.tags.join(" ")} ${post.series} ${post.text}`
      .toLowerCase()
      .includes(needle),
  );
});
</script>

# Search

<form class="search" role="search" @submit.prevent>
  <label for="q">Search articles</label>
  <input id="q" v-model="query" type="search" name="q" autocomplete="off" />
</form>

<p>{{ results.length }} of {{ posts.length }} articles.</p>

<ol class="post-list">
  <li v-for="post in results" :key="post.url" class="entry">
    <div class="entry-main">
      <h2><a :href="post.url">{{ post.title }}</a></h2>
      <p v-if="post.description" class="dek">{{ post.description }}</p>
    </div>
  </li>
</ol>

<p v-if="query && !results.length">No articles match that search.</p>
