<script setup>
import { computed } from "vue";
import { useData } from "vitepress";
import { data as posts } from "../.vitepress/theme/posts.data.js";

const { params } = useData();
const tag = computed(() => String(params.value.tag || ""));
const matches = computed(() => posts.filter((post) => post.tags.includes(tag.value)));
const format = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
</script>

# #{{ tag }}

<p>{{ matches.length }} articles.</p>

<ol class="post-list">
  <li v-for="post in matches" :key="post.url" class="entry">
    <p class="entry-date"><time :datetime="post.publishedAt">{{ format(post.publishedAt) }}</time></p>
    <div class="entry-main">
      <h2><a :href="post.url">{{ post.title }}</a></h2>
    </div>
  </li>
</ol>
