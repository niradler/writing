<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useData, useRoute, useRouter, withBase } from "vitepress";
import { data as posts } from "./posts.data.js";
import series from "../series.json";

const { frontmatter, page, theme } = useData();
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const menuButton = ref(null);
const mode = ref("system");
let media;

const isPost = computed(
  () => Boolean(frontmatter.value.publishedAt) && !frontmatter.value.fixture,
);
const isFixture = computed(() => Boolean(frontmatter.value.fixture));
const isAbout = computed(() => route.path.includes("/page/about"));
const headers = computed(() =>
  (page.value.headers || []).filter((item) => item.level === 2 || item.level === 3),
);
const preview = computed(() => theme.value.siteTarget === "preview");
const modeLabel = computed(() =>
  mode.value === "dark" ? "Dark" : mode.value === "light" ? "Light" : "Auto",
);
const themeLabel = computed(
  () => `Color theme, ${modeLabel.value}. Activate to change.`,
);

function normalize(url) {
  return (url || "").replace(/\.html$/, "").replace(/\/$/, "") || "/";
}

function current(href) {
  const path = normalize(route.path);
  const target = normalize(withBase(href));
  if (href === "/") return path === target;
  return path === target || path.startsWith(`${target}/`);
}

const currentIndex = computed(() =>
  posts.findIndex((post) => normalize(post.url) === normalize(route.path)),
);
const newer = computed(() =>
  currentIndex.value > 0 ? posts[currentIndex.value - 1] : null,
);
const older = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < posts.length - 1
    ? posts[currentIndex.value + 1]
    : null,
);

const primary = [
  ["Writing", "/"],
  ["Archive", "/archive"],
  ["Tags", "/tags"],
  ["About", "/page/about"],
];

function applyTheme(next) {
  mode.value = next;
  try {
    localStorage.setItem("piece-theme", next);
  } catch {}
  const dark =
    next === "dark" ||
    (next !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function cycleTheme() {
  applyTheme(
    mode.value === "system" ? "light" : mode.value === "light" ? "dark" : "system",
  );
}

async function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (!menuOpen.value) return;
  await nextTick();
  document.querySelector("#site-menu a")?.focus();
}

function closeMenu(restore = false) {
  const wasOpen = menuOpen.value;
  menuOpen.value = false;
  if (restore && wasOpen) menuButton.value?.focus();
}

function onKey(event) {
  const target = event.target;
  const typing =
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
  if (event.key === "Escape" && menuOpen.value) {
    event.preventDefault();
    closeMenu(true);
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    closeMenu(false);
    router.go(withBase("/search"));
  } else if (event.key === "/" && !typing) {
    event.preventDefault();
    closeMenu(false);
    router.go(withBase("/search"));
  }
}

onMounted(() => {
  try {
    mode.value = localStorage.getItem("piece-theme") || "system";
  } catch {}
  media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener?.("change", onMedia);
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  media?.removeEventListener?.("change", onMedia);
  window.removeEventListener("keydown", onKey);
});

function onMedia() {
  if (mode.value === "system") applyTheme("system");
}

const year = new Date().getUTCFullYear();
</script>

<template>
  <div class="shell">
    <a class="skip" href="#content">Skip to content</a>
    <div v-if="preview" class="preview-note" role="note">
      <div class="frame">
        Preview build. The live blog stays at
        <a href="https://blog.niradler.com/">blog.niradler.com</a>.
      </div>
    </div>
    <header class="site-header">
      <div class="frame header-bar">
        <a class="brand" :href="withBase('/')" @click="closeMenu(false)">
          <img class="logo light" :src="withBase('/brand/logo-light.png')" alt="" />
          <img class="logo dark" :src="withBase('/brand/logo-dark.png')" alt="" />
          <span>Piece by Piece</span>
        </a>
        <nav class="nav-desktop" aria-label="Primary">
          <a
            v-for="[label, href] in primary"
            :key="href"
            class="nav-link"
            :href="withBase(href)"
            :aria-current="current(href) ? 'page' : undefined"
            >{{ label }}</a
          >
          <details class="series-menu">
            <summary class="nav-link">Series</summary>
            <div class="series-panel">
              <a
                v-for="item in series"
                :key="item.slug"
                :href="withBase(`/series/${item.slug}`)"
                :aria-current="current(`/series/${item.slug}`) ? 'page' : undefined"
                >{{ item.name }}</a
              >
            </div>
          </details>
        </nav>
        <div class="header-actions">
          <a
            class="search-link"
            :href="withBase('/search')"
            :aria-current="current('/search') ? 'page' : undefined"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16.5 20 20.5" />
            </svg>
            <span>Search</span>
          </a>
          <button
            type="button"
            class="theme theme-desktop"
            :aria-label="themeLabel"
            @click="cycleTheme"
          >
            {{ modeLabel }}
          </button>
          <button
            ref="menuButton"
            type="button"
            class="menu-button"
            :aria-expanded="menuOpen ? 'true' : 'false'"
            aria-controls="site-menu"
            @click="toggleMenu"
          >
            {{ menuOpen ? "Close" : "Menu" }}
          </button>
        </div>
      </div>
    </header>
    <div v-if="menuOpen" id="site-menu" class="mobile-menu">
      <div class="frame">
        <p class="menu-label">Pages</p>
        <a
          v-for="[label, href] in primary"
          :key="href"
          :href="withBase(href)"
          :aria-current="current(href) ? 'page' : undefined"
          @click="closeMenu(false)"
          >{{ label }}</a
        >
        <a
          :href="withBase('/search')"
          :aria-current="current('/search') ? 'page' : undefined"
          @click="closeMenu(false)"
          >Search</a
        >
        <p class="menu-label">Series</p>
        <a
          v-for="item in series"
          :key="item.slug"
          :href="withBase(`/series/${item.slug}`)"
          :aria-current="current(`/series/${item.slug}`) ? 'page' : undefined"
          @click="closeMenu(false)"
          >{{ item.name }}</a
        >
        <a :href="theme.identity.resume">Resume</a>
        <button
          type="button"
          class="theme theme-mobile"
          :aria-label="themeLabel"
          @click="cycleTheme"
        >
          Theme: {{ modeLabel }}
        </button>
      </div>
    </div>
    <main id="content" class="site-main">
      <div class="frame">
        <p v-if="isFixture" class="fixture-note" role="note">
          Nonpublished rendering fixture. This is not an article.
        </p>
        <div v-if="isPost || isFixture" class="post-grid">
          <article class="post-main">
            <Content />
            <footer v-if="isPost" class="post-end">
              <p v-if="preview && (frontmatter.sourceUrl || frontmatter.originalUrl)">
                Live article:
                <a :href="frontmatter.sourceUrl || frontmatter.originalUrl">{{
                  frontmatter.sourceUrl || frontmatter.originalUrl
                }}</a>
              </p>
              <p
                v-if="
                  frontmatter.originalUrl &&
                  frontmatter.originalUrl !== frontmatter.sourceUrl
                "
              >
                Original link:
                <a :href="frontmatter.originalUrl">{{ frontmatter.originalUrl }}</a>
              </p>
              <nav class="pager" aria-label="Adjacent articles">
                <a v-if="newer" :href="newer.url">Newer: {{ newer.title }}</a>
                <a v-if="older" :href="older.url">Older: {{ older.title }}</a>
              </nav>
            </footer>
          </article>
          <aside v-if="headers.length" class="outline">
            <details class="outline-mobile">
              <summary>On this page</summary>
              <nav aria-label="On this page">
                <a
                  v-for="header in headers"
                  :key="header.link"
                  :href="header.link"
                  :class="`level-${header.level}`"
                  >{{ header.title }}</a
                >
              </nav>
            </details>
            <nav class="outline-desktop" aria-label="On this page">
              <p>On this page</p>
              <a
                v-for="header in headers"
                :key="`${header.link}-desktop`"
                :href="header.link"
                :class="`level-${header.level}`"
                >{{ header.title }}</a
              >
            </nav>
          </aside>
        </div>
        <div v-else class="page">
          <img
            v-if="isAbout"
            class="avatar"
            :src="withBase('/brand/avatar.png')"
            alt="Nir Adler"
          />
          <Content />
        </div>
      </div>
    </main>
    <footer class="site-footer">
      <div class="frame footer-bar">
        <p>© {{ year }} Piece by Piece · Nir Adler</p>
        <nav aria-label="Footer">
          <a :href="withBase('/archive')">Archive</a>
          <a :href="withBase('/rss.xml')">RSS</a>
          <a :href="theme.identity.github">GitHub</a>
          <a :href="theme.identity.website">niradler.com</a>
          <a :href="theme.identity.hashnode">Hashnode</a>
        </nav>
      </div>
    </footer>
  </div>
</template>
