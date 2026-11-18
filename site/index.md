---
description: Nir Adler personal blog, tech related, and open source projects.
home: true
---

<script setup>
import { computed, onMounted, ref } from "vue";
import { data as posts } from "./.vitepress/theme/posts.data.js";

const PAGE = 12;
const visible = ref(PAGE);
const view = ref("grid");
const shown = computed(() => posts.slice(0, visible.value));
const coverSizes =
  "(min-width: 76rem) 34.75rem, (min-width: 720px) calc((100vw - 5rem) / 2), calc(100vw - 2.5rem)";

onMounted(() => {
  try {
    const stored = localStorage.getItem("piece-view");
    if (stored === "list" || stored === "grid") view.value = stored;
  } catch {}
});

function setView(next) {
  view.value = next;
  try {
    localStorage.setItem("piece-view", next);
  } catch {}
}

function loadMore() {
  visible.value = Math.min(posts.length, visible.value + PAGE);
}

const format = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
</script>

<h1 class="sr-only">Latest articles</h1>

<div class="home-toolbar">
  <p class="home-count">{{ posts.length }} posts</p>
  <div class="view-toggle" role="group" aria-label="Article layout">
    <button type="button" :aria-pressed="view === 'grid' ? 'true' : 'false'" @click="setView('grid')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>
      <span>Grid</span>
    </button>
    <button type="button" :aria-pressed="view === 'list' ? 'true' : 'false'" @click="setView('list')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      <span>List</span>
    </button>
  </div>
</div>

<ol v-if="view === 'grid'" class="post-grid">
  <li v-for="(post, index) in shown" :key="post.url">
    <a class="card" :href="post.url">
      <span v-if="post.cover" class="card-cover">
        <picture v-if="post.cover.srcset">
          <source type="image/webp" :srcset="post.cover.srcset" :sizes="coverSizes" />
          <img :src="post.cover.src" :alt="post.cover.alt" :width="post.cover.width || undefined" :height="post.cover.height || undefined" :loading="index < 2 ? 'eager' : 'lazy'" decoding="async" />
        </picture>
        <img v-else :src="post.cover.src" :alt="post.cover.alt" :loading="index < 2 ? 'eager' : 'lazy'" decoding="async" />
      </span>
      <span v-else class="card-cover card-cover-empty" aria-hidden="true"></span>
      <div class="card-body">
        <span class="card-date"><time :datetime="post.publishedAt">{{ format(post.publishedAt) }}</time></span>
        <h2 class="card-title">{{ post.title }}</h2>
        <p v-if="post.description" class="card-dek">{{ post.description }}</p>
      </div>
    </a>
  </li>
</ol>

<ol v-else class="post-list">
  <li v-for="post in shown" :key="post.url" class="entry">
    <p class="entry-date"><time :datetime="post.publishedAt">{{ format(post.publishedAt) }}</time></p>
    <div class="entry-main">
      <h2><a :href="post.url">{{ post.title }}</a></h2>
      <p v-if="post.description" class="dek">{{ post.description }}</p>
    </div>
  </li>
</ol>

<div v-if="visible < posts.length" class="load-more">
  <button type="button" @click="loadMore">Load more posts</button>
</div>
