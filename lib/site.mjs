export const PRODUCTION_ORIGIN = "https://blog.niradler.com";
export const PREVIEW_ORIGIN = "https://writing.niradler.com";
export const PREVIEW_BASE = "/";

export const SITE_TITLE = "Piece by Piece";
export const SITE_AUTHOR = "Nir Adler";
export const SITE_DESCRIPTION =
  "Nir Adler personal blog, tech related, and open source projects.";

export const GA_MEASUREMENT_ID = "G-BQ26N8LNFQ";
export const HOTJAR_SITE_ID = 3273013;

export function analyticsHead(frontmatter = {}) {
  if (frontmatter.fixture) return [];
  return [
    [
      "script",
      {
        async: "",
        src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
      },
    ],
    [
      "script",
      {},
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`,
    ],
    [
      "script",
      {},
      `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${HOTJAR_SITE_ID},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
    ],
  ];
}

export const IDENTITY_LINKS = {
  github: "https://github.com/niradler",
  website: "https://niradler.com/",
  hashnode: "https://hashnode.com/@niradler",
  linkedin: "https://www.linkedin.com/in/niradler/",
  resume: "https://www.linkedin.com/in/niradler/",
};

export const REDIRECTS = [
  [
    "/docker-homepage-to-organize-your-apps",
    "/docker-apps-organization-using-docker-homepage",
  ],
  [
    "/introducing-hotpod-fast-debugging-and-process-management-for-containers",
    "/introducing-hotpod-process-manager",
  ],
  ["/kubernetes-administrator-cka", "/preparing-for-the-cka-exam-a-practical-guide"],
];

export const RESERVED_PATHS = new Set([
  "archive",
  "search",
  "tags",
  "tag",
  "series",
  "page",
  "fixtures",
  "posts",
  "index",
  "404",
  "rss.xml",
  "sitemap.xml",
  "robots.txt",
]);

export function resolveSiteTarget(value = process.env.SITE_TARGET) {
  const target = value === "production" ? "production" : "preview";
  if (target === "production") {
    return {
      target,
      origin: PRODUCTION_ORIGIN,
      base: "/",
      robots: "index, follow",
    };
  }
  return {
    target,
    origin: PREVIEW_ORIGIN,
    base: PREVIEW_BASE,
    robots: "noindex, nofollow",
  };
}

export function prefixRoot(base, url) {
  if (typeof url !== "string" || url.length === 0) return url;
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(url) ||
    url.startsWith("//") ||
    url.startsWith("#") ||
    url.startsWith("?") ||
    url.startsWith("data:") ||
    url.startsWith("mailto:")
  ) {
    return url;
  }
  const normalizedBase = base === "/" ? "/" : base.endsWith("/") ? base : `${base}/`;
  if (!url.startsWith("/")) return url;
  if (normalizedBase === "/") return url;
  const basePath = normalizedBase.slice(0, -1);
  if (url === basePath || url.startsWith(`${basePath}/`)) return url;
  return `${basePath}${url}`;
}

export function joinUrl(origin, base, path) {
  const basePath = base === "/" ? "" : base.replace(/\/$/, "");
  const pagePath = path.startsWith("/") ? path : `/${path}`;
  if (pagePath === "/") return `${origin}${basePath}/`;
  return `${origin}${basePath}${pagePath}`;
}

export function articlePath(pageUrl, base = "/") {
  const clean = String(pageUrl)
    .split("#")[0]
    .split("?")[0]
    .replace(/\.html$/, "");
  const slug = clean.replace(/\/$/, "").split("/").filter(Boolean).pop();
  const prefix = !base || base === "/" ? "" : base.replace(/\/$/, "");
  return `${prefix}/${slug}`;
}

export function pagePathFromRelative(relativePath) {
  let rel = relativePath.replaceAll("\\", "/");
  if (rel.startsWith("posts/")) rel = rel.slice("posts/".length);
  if (rel.endsWith("/index.md")) rel = `${rel.slice(0, -"/index.md".length)}.md`;
  if (rel.endsWith(".md")) rel = rel.slice(0, -3);
  if (rel.endsWith("/index")) rel = rel.slice(0, -"/index".length);
  if (rel === "index" || rel === "") return "/";
  return `/${rel}`;
}

export function robotsFor(site, frontmatter = {}) {
  if (frontmatter.fixture || frontmatter.noindex) return "noindex, nofollow";
  return site.robots;
}

export function canonicalUrl({ path, frontmatter = {}, site }) {
  const self = joinUrl(site.origin, site.base, path);
  if (frontmatter.fixture) return self;
  if (site.target === "production") return self;
  if (typeof frontmatter.originalUrl === "string" && frontmatter.originalUrl) {
    return frontmatter.originalUrl;
  }
  if (
    path === "/" ||
    path === "/archive" ||
    path === "/page/about" ||
    path.startsWith("/tag/") ||
    (path.startsWith("/series/") && path !== "/series")
  ) {
    return joinUrl(PRODUCTION_ORIGIN, "/", path);
  }
  return self;
}
