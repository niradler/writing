import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync(
  new URL("../site/.vitepress/theme/blog.css", import.meta.url),
  "utf8",
);

describe("layout frame", () => {
  it("keeps a shared gutter on the centered frame", () => {
    assert.match(css, /--gutter:\s*clamp\(1\.25rem,/);
    assert.match(css, /\.frame\s*\{[^}]*padding-inline:\s*var\(--gutter\)/s);
    assert.match(css, /\.frame\s*\{[^}]*margin-inline:\s*auto/s);
  });

  it("centers the article on the viewport and parks the outline beside it", () => {
    assert.match(css, /\.post-stage\s*\{[^}]*width:\s*100%/s);
    assert.match(css, /\.post-main\s*\{[^}]*margin-inline:\s*auto/s);
    assert.match(css, /\.outline-rail\s*\{[^}]*display:\s*none/s);
    assert.match(css, /\.outline-rail\s*\{[^}]*position:\s*absolute/s);
    assert.match(
      css,
      /@media \(min-width:\s*1280px\)\s*\{[\s\S]*\.outline-mobile\s*\{[^}]*display:\s*none/,
    );
    assert.match(
      css,
      /@media \(min-width:\s*1280px\)\s*\{[\s\S]*\.outline-rail\s*\{[^}]*display:\s*block/,
    );
    assert.match(
      css,
      /left:\s*calc\(50%\s*\+\s*\(var\(--reading\)\s*\/\s*2\)\s*\+\s*2\.5rem\)/,
    );
    assert.doesNotMatch(
      css,
      /grid-template-columns:\s*minmax\(0,\s*var\(--reading\)\)/,
    );
  });

  it("does not stretch page columns to the viewport edge", () => {
    assert.doesNotMatch(css, /\.page\s*,[\s\S]{0,80}width:\s*auto/);
    assert.doesNotMatch(css, /\.page\s*\{[^}]*width:\s*auto/s);
    assert.doesNotMatch(css, /\.site-main\s*\{[^}]*padding:\s*[^;]*\s0(?:px)?\s/s);
  });
});

describe("home views", () => {
  it("lets the home page use the full frame while other pages keep the reading width", () => {
    assert.match(css, /\.page\s*\{[^}]*max-width:\s*48rem/s);
    assert.match(css, /\.page-home\s*\{[^}]*max-width:\s*none/s);
  });

  it("shows a two-column card grid with covers on wide screens", () => {
    assert.match(
      css,
      /\.post-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    assert.match(
      css,
      /@media \(min-width:\s*720px\)\s*\{[\s\S]*\.post-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    assert.match(css, /\.card-cover\s*\{[^}]*aspect-ratio:\s*800\s*\/\s*420/s);
    assert.match(css, /\.card-cover img\s*\{[^}]*object-fit:\s*cover/s);
    assert.match(css, /\.card-title\s*\{[^}]*-webkit-line-clamp:\s*2/s);
    assert.match(css, /\.card-dek\s*\{[^}]*-webkit-line-clamp:\s*2/s);
  });

  it("keeps dateless search entries full width instead of the date column", () => {
    assert.match(
      css,
      /@media \(min-width:\s*720px\)\s*\{[\s\S]*\.post-list\.plain \.entry\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });

  it("keeps the tag count inside the tag pill", () => {
    assert.match(css, /\.tag-count\s*\{[^}]*color:\s*var\(--muted\)/s);
  });
});
