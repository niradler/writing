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

  it("does not stretch page columns to the viewport edge", () => {
    assert.doesNotMatch(css, /\.page\s*,[\s\S]{0,80}width:\s*auto/);
    assert.doesNotMatch(css, /\.page\s*\{[^}]*width:\s*auto/s);
    assert.doesNotMatch(css, /\.site-main\s*\{[^}]*padding:\s*[^;]*\s0(?:px)?\s/s);
  });
});
