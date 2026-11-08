---
title: Series
description: Article series on Piece by Piece.
---

<script setup>
import { withBase } from "vitepress";
import series from "./.vitepress/series.json";
</script>

# Series

<ul class="series-index">
  <li v-for="item in series" :key="item.slug">
    <a :href="withBase(`/series/${item.slug}`)">{{ item.name }}</a>
  </li>
</ul>
