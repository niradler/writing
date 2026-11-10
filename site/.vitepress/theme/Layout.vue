<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useData, useRoute, useRouter, withBase } from "vitepress";
import { data as posts } from "./posts.data.js";
import series from "../series.json";

const { frontmatter, theme } = useData();
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
const sections = ref([]);
const activeId = ref("");
let ignoreOutline = false;
let outlineFrame = 0;

function collectOutline() {
  sections.value = [
    ...document.querySelectorAll(".post-main h2[id], .post-main h3[id]"),
  ].map((node) => ({
    id: node.id,
    title: node.textContent.replace(/\u200b/g, "").trim(),
    level: node.tagName === "H2" ? 2 : 3,
  }));
}

function headerOffset() {
  const bar = document.querySelector(".site-header");
  return (bar?.getBoundingClientRect().height || 72) + 16;
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  ignoreOutline = true;
  const top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  activeId.value = id;
  window.setTimeout(() => {
    ignoreOutline = false;
  }, 350);
}

function onOutlineClick(event, section) {
  if (!section.id) return;
  event.preventDefault();
  const next = `#${section.id}`;
  if (location.hash !== next) history.pushState(null, "", next);
  scrollToSection(section.id);
}

function updateActiveSection() {
  if (ignoreOutline) return;
  const line = headerOffset() + 2;
  let current = "";
  document.querySelectorAll(".post-main h2[id], .post-main h3[id]").forEach((node) => {
    if (node.getBoundingClientRect().top <= line) current = node.id;
  });
  if (!current) {
    current = document.querySelector(".post-main h2[id], .post-main h3[id]")?.id || "";
  }
  if (current) activeId.value = current;
}

function onOutlineScroll() {
  if (outlineFrame) return;
  outlineFrame = requestAnimationFrame(() => {
    outlineFrame = 0;
    updateActiveSection();
  });
}

function syncHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!id || !document.getElementById(id)) {
    updateActiveSection();
    return;
  }
  scrollToSection(id);
}
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
  window.addEventListener("scroll", onOutlineScroll, { passive: true });
  window.addEventListener("hashchange", syncHash);
  window.addEventListener("popstate", syncHash);
  nextTick(() => {
    collectOutline();
    syncHash();
  });
});

onUnmounted(() => {
  media?.removeEventListener?.("change", onMedia);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("scroll", onOutlineScroll);
  window.removeEventListener("hashchange", syncHash);
  window.removeEventListener("popstate", syncHash);
  if (outlineFrame) cancelAnimationFrame(outlineFrame);
});

watch(
  () => route.path,
  async () => {
    activeId.value = "";
    await nextTick();
    collectOutline();
    syncHash();
  },
);

function onMedia() {
  if (mode.value === "system") applyTheme("system");
}

const year = new Date().getUTCFullYear();
</script>

<template>
  <div class="shell">
    <a class="skip" href="#content">Skip to content</a>
    <header class="site-header">
      <div class="frame header-bar">
        <a class="brand" :href="withBase('/')" @click="closeMenu(false)">
          <picture class="logo light">
            <source
              :srcset="withBase('/media-opt/brand/logo-light-64.webp')"
              type="image/webp"
              sizes="32px"
            />
            <img
              :src="withBase('/media-opt/brand/logo-light-160.png')"
              alt=""
              width="32"
              height="32"
            />
          </picture>
          <picture class="logo dark">
            <source
              :srcset="withBase('/media-opt/brand/logo-dark-64.webp')"
              type="image/webp"
              sizes="32px"
            />
            <img
              :src="withBase('/media-opt/brand/logo-dark-160.png')"
              alt=""
              width="32"
              height="32"
            />
          </picture>
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
      <div v-if="isPost || isFixture" class="post-stage">
        <article class="post-main">
          <p v-if="isFixture" class="fixture-note" role="note">
            Nonpublished rendering fixture. This is not an article.
          </p>
          <details v-if="sections.length" class="outline-mobile">
            <summary>On this page</summary>
            <nav aria-label="On this page">
              <a
                v-for="section in sections"
                :key="section.id"
                :href="`#${section.id}`"
                :class="`level-${section.level}`"
                :aria-current="activeId === section.id ? 'location' : undefined"
                @click="onOutlineClick($event, section)"
                >{{ section.title }}</a
              >
            </nav>
          </details>
          <Content />
          <footer v-if="isPost" class="post-end">
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
        <aside v-if="sections.length" class="outline-rail">
          <div class="outline-desktop">
            <p>On this page</p>
            <nav aria-label="On this page">
              <a
                v-for="section in sections"
                :key="`${section.id}-desktop`"
                :href="`#${section.id}`"
                :class="`level-${section.level}`"
                :aria-current="activeId === section.id ? 'location' : undefined"
                @click="onOutlineClick($event, section)"
                >{{ section.title }}</a
              >
            </nav>
          </div>
        </aside>
      </div>
      <div v-else class="frame">
        <div class="page">
          <picture v-if="isAbout">
            <source
              :srcset="withBase('/media-opt/brand/avatar-160.webp')"
              type="image/webp"
              sizes="4.5rem"
            />
            <img
              class="avatar"
              :src="withBase('/media-opt/brand/avatar-160.png')"
              alt="Nir Adler"
              width="144"
              height="144"
            />
          </picture>
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
