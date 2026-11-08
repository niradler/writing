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
