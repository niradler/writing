import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeSvg } from "../lib/svg.mjs";

describe("svg checker", () => {
  it("catches dangling marker refs, invalid keyTimes, missing title, scripts, and dim strokes", () => {
    const broken = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" role="img">',
      '<defs><marker id="a666"/></defs>',
      '<line x1="0" y1="0" x2="10" y2="10" marker-end="url(#a555)"/>',
      '<circle cx="50" cy="50" r="20" fill="#5AA9E6" opacity="0.12" stroke="#5AA9E6"/>',
      '<rect width="10" height="10"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.5;1.02" dur="5s"/></rect>',
      "<script>alert(1)</script>",
      "</svg>",
    ].join("\n");

    const result = analyzeSvg(broken);
    const rules = new Set(result.issues.map((item) => item.rule));
    assert.ok(rules.has("dangling-url-ref"));
    assert.ok(rules.has("keytimes-out-of-range"));
    assert.ok(rules.has("missing-title"));
    assert.ok(rules.has("svg-script"));
    assert.ok(rules.has("low-shape-opacity-with-stroke"));
  });

  it("passes a clean accessible SVG", () => {
    const clean = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" role="img">',
      "<title>Example diagram showing a clean loop</title>",
      "<style>.flow{animation:flow 1s linear infinite}@keyframes flow{to{stroke-dashoffset:-16}}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>",
      '<defs><marker id="ok"/></defs>',
      '<circle cx="50" cy="50" r="20" fill="#14B88A" fill-opacity="0.12" stroke="#14B88A"/>',
      '<line x1="0" y1="0" x2="10" y2="10" marker-end="url(#ok)"/>',
      '<circle r="4"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.5;1" dur="4s"/></circle>',
      "</svg>",
    ].join("\n");

    const result = analyzeSvg(clean);
    assert.equal(result.issues.length, 0);
  });
});
