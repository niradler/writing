<script setup>
import { computed } from "vue";
import { useData } from "vitepress";
import { data as posts } from "../.vitepress/theme/posts.data.js";
import series from "../.vitepress/series.json";

const { params } = useData();
const slug = computed(() => String(params.value.series || ""));
const name = computed(
  () => series.find((item) => item.slug === slug.value)?.name || slug.value,
);
const matches = computed(() => posts.filter((post) => post.seriesSlug === slug.value));
const format = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
</script>

# {{ name }}

<p v-if="matches.length">{{ matches.length }} articles.</p>
<p v-else>No articles in the current import are filed under this series.</p>

<ol class="post-list">
  <li v-for="post in matches" :key="post.url" class="entry">
    <p class="entry-date"><time :datetime="post.publishedAt">{{ format(post.publishedAt) }}</time></p>
    <div class="entry-main">
      <h2><a :href="post.url">{{ post.title }}</a></h2>
      <p v-if="post.description" class="dek">{{ post.description }}</p>
    </div>
  </li>
</ol>
