import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  articlePath,
  canonicalUrl,
  prefixRoot,
  resolveSiteTarget,
  robotsFor,
  pagePathFromRelative,
} from "../lib/site.mjs";
import { formatUtcDate } from "../lib/text.mjs";
import {
  collectMediaRefs,
  parseImageInner,
  rewriteMarkdown,
  youtubeId,
} from "../lib/media.mjs";
import { injectPostHeader, postHeaderHtml } from "../lib/header.mjs";
import { parsePostHtml } from "../lib/hashnode.mjs";
import { renderRedirect, renderRobots, renderRss } from "../lib/generate.mjs";

describe("site target", () => {
  it("serves the preview from its own domain and out of the index", () => {
    const site = resolveSiteTarget("preview");
    assert.equal(site.origin, "https://writing.niradler.com");
    assert.equal(site.base, "/");
    assert.equal(site.robots, "noindex, nofollow");
    assert.equal(robotsFor(site, {}), "noindex, nofollow");
    assert.equal(robotsFor(site, { fixture: true }), "noindex, nofollow");
  });

  it("uses the domain root in production and still hides fixtures", () => {
    const site = resolveSiteTarget("production");
    assert.equal(site.base, "/");
    assert.equal(site.robots, "index, follow");
    assert.equal(robotsFor(site, { fixture: true }), "noindex, nofollow");
  });

  it("points preview article canonicals at the live slug", () => {
    const preview = resolveSiteTarget("preview");
    const production = resolveSiteTarget("production");
    const frontmatter = {
      originalUrl: "https://blog.niradler.com/postgres-already-is-your-backend",
    };
    assert.equal(
      canonicalUrl({
        path: "/postgres-already-is-your-backend",
        frontmatter,
        site: preview,
      }),
      frontmatter.originalUrl,
    );
    assert.equal(
      canonicalUrl({
        path: "/postgres-already-is-your-backend",
        frontmatter,
        site: production,
      }),
      "https://blog.niradler.com/postgres-already-is-your-backend",
    );
    assert.equal(
      canonicalUrl({
        path: "/getting-started-with-elk-stack-by-building-uptime-monitor",
        frontmatter: {
          originalUrl: "https://niradler.com/getting-started-with-elk-stack/",
        },
        site: production,
      }),
      "https://niradler.com/getting-started-with-elk-stack/",
    );
  });

  it("does not give a fixture the live blog canonical", () => {
    const site = resolveSiteTarget("preview");
    assert.equal(
      canonicalUrl({ path: "/fixtures/media", frontmatter: { fixture: true }, site }),
      "https://writing.niradler.com/fixtures/media",
    );
  });
});

describe("paths and dates", () => {
  it("keeps article links on the active base", () => {
    assert.equal(
      articlePath("/writing/posts/postgres-already-is-your-backend.html", "/writing/"),
      "/writing/postgres-already-is-your-backend",
    );
    assert.equal(
      articlePath("/posts/postgres-already-is-your-backend", "/"),
      "/postgres-already-is-your-backend",
    );
  });

  it("rewrites post files onto root slugs", () => {
    assert.equal(pagePathFromRelative("posts/example-post.md"), "/example-post");
    assert.equal(pagePathFromRelative("page/about.md"), "/page/about");
    assert.equal(pagePathFromRelative("index.md"), "/");
  });

  it("formats the stored instant in UTC", () => {
    assert.equal(formatUtcDate("2026-05-04T20:56:57.324Z"), "May 4, 2026");
  });

  it("prefixes only root-relative urls", () => {
    assert.equal(prefixRoot("/writing/", "/media/a.png"), "/writing/media/a.png");
    assert.equal(prefixRoot("/", "/media/a.png"), "/media/a.png");
    assert.equal(
      prefixRoot("/writing/", "https://cdn.hashnode.com/a.png"),
      "https://cdn.hashnode.com/a.png",
    );
    assert.equal(
      prefixRoot("/writing/", "/writing/media/a.png"),
      "/writing/media/a.png",
    );
  });
});

describe("media", () => {
  it("keeps hashnode alignment out of the image url and out of code fences", () => {
    const source = [
      '![Diagram](https://cdn.hashnode.com/a.png align="left")',
      "",
      "```html",
      '<img src="public/image.jpg" alt="Minimal landscape" />',
      "```",
      "",
      "%[https://www.youtube.com/watch?v=W0LjhL5nalM&ab_channel=HackIDC]",
    ].join("\n");
    const rewritten = rewriteMarkdown(source, (url) =>
      url.startsWith("https://cdn.hashnode.com/") ? "/media/post/a.png" : null,
    );
    assert.match(rewritten, /src="\/media\/post\/a.png"/);
    assert.match(rewritten, /data-align="left"/);
    assert.match(rewritten, /public\/image\.jpg/);
    assert.doesNotMatch(rewritten, /align="left"\)/);
    assert.match(rewritten, /youtube-nocookie\.com\/embed\/W0LjhL5nalM/);
    assert.equal(rewritten.match(/<figure class="embed">/g).length, 1);
    assert.equal(youtubeId("https://youtu.be/W0LjhL5nalM"), "W0LjhL5nalM");
    assert.deepEqual(parseImageInner('https://cdn.hashnode.com/a.png align="center"'), {
      url: "https://cdn.hashnode.com/a.png",
      align: "center",
      title: undefined,
    });
  });

  it("turns an unknown iframe into a link and reports refs", () => {
    const rewritten = rewriteMarkdown(
      '<iframe src="https://evil.example/embed"></iframe>\n\n![caption](/media/post/a.png "A real caption")',
    );
    assert.match(rewritten, /<a href="https:\/\/evil\.example\/embed">/);
    assert.match(rewritten, /<figcaption>A real caption<\/figcaption>/);
    const refs = collectMediaRefs('<img src="/media/post/a.png" alt="">');
    assert.deepEqual(refs.local, ["/media/post/a.png"]);
    assert.deepEqual(refs.missingAlt, ["/media/post/a.png"]);
  });
});

describe("post header", () => {
  it("places metadata after the author heading", () => {
    const header = postHeaderHtml(
      {
        publishedAt: "2026-05-04T20:56:57.324Z",
        updatedAt: "2026-05-04T20:56:57.324Z",
        tags: ["ai"],
        series: "Open source",
        seriesSlug: "open-source",
        cover: "/media/post/cover.jpg",
        coverAlt: "Cover",
      },
      "/writing/",
    );
    const page = injectPostHeader(
      "# Postgres Already Is Your Backend\n\nBody\n",
      header,
    );
    assert.match(page, /^# Postgres Already Is Your Backend\n/);
    assert.match(page, /href="\/writing\/tag\/ai"/);
    assert.match(page, /href="\/writing\/series\/open-source"/);
    assert.match(page, /src="\/writing\/media\/post\/cover\.jpg"/);
    assert.doesNotMatch(header, /Updated/);
  });
});

describe("hashnode metadata", () => {
  it("reads the publication fields without inventing tags", () => {
    const parsed = parsePostHtml(`<!doctype html><html><head>
      <meta property="og:title" content="Postgres Already Is Your Backend">
      <meta name="description" content="AI agents are unreasonably good at writing SQL…">
      <meta property="article:published_time" content="2026-05-04T20:56:57.324Z">
      <meta property="article:modified_time" content="2026-05-04T20:56:57.324Z">
      <meta property="og:image" content="https://cdn.hashnode.com/cover.jpg">
      <link rel="canonical" href="https://blog.niradler.com/postgres-already-is-your-backend">
      </head><body><main>
      <img alt="Postgres Already Is Your Backend" src="https://cdn.hashnode.com/cover.jpg">
      <a href="/series/open-source"><span>Part of series</span><span class="truncate">Open source</span></a>
      <a href="/tag/ai">#ai</a>
      <a href="https://example.com/tag/nope">not a tag</a>
      </main></body></html>`);
    assert.equal(parsed.title, "Postgres Already Is Your Backend");
    assert.equal(parsed.publishedAt, "2026-05-04T20:56:57.324Z");
    assert.deepEqual(parsed.tags, ["ai"]);
    assert.equal(parsed.seriesSlug, "open-source");
    assert.equal(parsed.series, "Open source");
    assert.equal(parsed.coverAlt, "Postgres Already Is Your Backend");
  });
});

describe("generated files", () => {
  it("blocks preview crawling and keeps production open", () => {
    assert.match(renderRobots(resolveSiteTarget("preview")), /Disallow: \//);
    assert.match(
      renderRobots(resolveSiteTarget("production")),
      /Sitemap: https:\/\/blog\.niradler\.com\/sitemap\.xml/,
    );
    const rss = renderRss(resolveSiteTarget("preview"), [
      {
        slug: "example",
        data: {
          title: "Example & title",
          description: "A <description>",
          publishedAt: "2026-05-04T20:56:57.324Z",
          originalUrl: "https://blog.niradler.com/example",
          tags: ["ai"],
          fixture: false,
          draft: false,
        },
      },
    ]);
    assert.match(rss, /https:\/\/writing\.niradler\.com\/example/);
    assert.match(rss, /Example &amp; title/);
    assert.doesNotMatch(rss, /<description>A <description>/);
    const redirect = renderRedirect(
      resolveSiteTarget("preview"),
      "/kubernetes-administrator-cka",
      "/preparing-for-the-cka-exam-a-practical-guide",
    );
    assert.match(redirect, /url=\/preparing-for-the-cka-exam-a-practical-guide/);
    assert.match(
      redirect,
      /canonical" href="https:\/\/blog\.niradler\.com\/preparing-for-the-cka-exam-a-practical-guide"/,
    );
  });
});
