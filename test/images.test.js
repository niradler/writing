import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pictureHtml, rewriteContentImages, variantWidths } from "../lib/images.mjs";
import { prefixHtmlMedia } from "../lib/media.mjs";

describe("responsive images", () => {
  it("never invents pixels beyond the intrinsic width", () => {
    assert.deepEqual(variantWidths(4000), [64, 160, 480, 800, 1280, 1600]);
    assert.deepEqual(variantWidths(600), [64, 160, 480, 600]);
    assert.deepEqual(variantWidths(40), [40]);
  });

  it("builds a webp source and a same-width fallback", () => {
    const html = pictureHtml({
      alt: 'A "diagram"',
      width: 1200,
      height: 800,
      loading: "lazy",
      variants: [
        { src: "/media-opt/media/post/a-480.webp", width: 480, role: "webp" },
        { src: "/media-opt/media/post/a-1200.webp", width: 1200, role: "webp" },
        { src: "/media-opt/media/post/a-1200.jpg", width: 1200, role: "fallback" },
      ],
    });
    assert.match(html, /type="image\/webp"/);
    assert.match(html, /a-480\.webp 480w/);
    assert.match(html, /src="\/media-opt\/media\/post\/a-1200\.jpg"/);
    assert.match(html, /width="1200" height="800"/);
    assert.match(html, /alt="A &quot;diagram&quot;"/);
    assert.match(html, /loading="lazy"/);
  });

  it("prioritizes only the cover and leaves other images lazy", () => {
    const manifest = {
      images: {
        "/media/post/cover.jpg": {
          width: 800,
          height: 400,
          variants: [
            { src: "/media-opt/media/post/cover-800.webp", width: 800, role: "webp" },
            {
              src: "/media-opt/media/post/cover-800.jpg",
              width: 800,
              role: "fallback",
            },
          ],
        },
        "/media/post/diagram.png": {
          width: 900,
          height: 500,
          variants: [
            { src: "/media-opt/media/post/diagram-900.webp", width: 900, role: "webp" },
            {
              src: "/media-opt/media/post/diagram-900.png",
              width: 900,
              role: "fallback",
            },
          ],
        },
      },
    };
    const html = rewriteContentImages(
      `<figure class="cover"><img src="/media/post/cover.jpg" alt="Cover"></figure>
<figure class="media"><img src="/media/post/diagram.png" alt="Diagram"></figure>
<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>`,
      manifest,
    );
    assert.match(html, /<figure class="cover"><picture>[\s\S]*fetchpriority="high"/);
    assert.match(html, /loading="eager"/);
    assert.match(html, /diagram-900\.webp 900w[\s\S]*loading="lazy"/);
    assert.match(html, /youtube-nocookie.com\/embed\/abc/);
    assert.equal((html.match(/<picture>/g) || []).length, 2);
  });

  it("prefixes srcset candidates with the preview base", () => {
    const html = prefixHtmlMedia(
      `<picture><source type="image/webp" srcset="/media-opt/a.webp 480w, /media-opt/b.webp 800w"><img src="/media-opt/b.jpg" alt=""></picture>`,
      "/writing/",
    );
    assert.match(
      html,
      /srcset="\/writing\/media-opt\/a\.webp 480w, \/writing\/media-opt\/b\.webp 800w"/,
    );
    assert.match(html, /src="\/writing\/media-opt\/b\.jpg"/);
  });
});
