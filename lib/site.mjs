export const PRODUCTION_ORIGIN = "https://blog.niradler.com";
// The preview is the noindex staging build of the same public origin; it is not deployed.
export const PREVIEW_ORIGIN = PRODUCTION_ORIGIN;
export const PREVIEW_BASE = "/";

export const SITE_TITLE = "Piece by Piece";
export const SITE_AUTHOR = "Nir Adler";
export const SITE_DESCRIPTION =
  "Nir Adler personal blog, tech related, and open source projects.";

export const GA_MEASUREMENT_ID = "G-BQ26N8LNFQ";
// Public project API key — safe to embed client-side, like the GA measurement ID.
export const POSTHOG_API_KEY = "phc_ztenPfGreCNCMqu6FToH4ohDVLGDHoQdRtvKwhAr7Mhh";
export const POSTHOG_API_HOST = "https://us.i.posthog.com";

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
      `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${POSTHOG_API_KEY}',{api_host:'${POSTHOG_API_HOST}',person_profiles:'identified_only'});`,
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
  "llms.txt",
  "llms-full.txt",
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
