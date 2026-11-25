import assert from "node:assert/strict";
import { describe, it } from "node:test";
import matter from "gray-matter";
import { analyzeMarkdown, cleanMarkdown, formatReport } from "../lib/slop.mjs";

describe("slop detector", () => {
  it("flags prose em dashes and semicolons while ignoring code, entities, TL;DR, and table blanks", () => {
    const doc = [
      "---",
      "title: 'A post — with a dash'",
      "description: 'Clean summary; split this.'",
      "---",
      "# Clean heading",
      "",
      "## TL;DR: summary",
      "",
      "Prose with an em dash — right here; and a semicolon too.",
      "Double hyphen -- also caught.",
      "Safe HTML entity &amp; and inline `const a = 1; // —` stay ignored.",
      "",
      "| Model | Score |",
      "| --- | --- |",
      "| Example | — |",
      "",
      "```js",
      "const msg = 'em dash — and semicolon; inside code';",
      "```",
      "",
      "> Quoted text — with a semicolon; stays ignored.",
    ].join("\n");

    const result = analyzeMarkdown(doc);
    const rules = result.issues.map((item) => `${item.rule}@L${item.line}`);
    assert.ok(rules.includes("em-dash@L2"));
    assert.ok(rules.includes("semicolon@L3"));
    assert.ok(rules.includes("em-dash@L9"));
    assert.ok(rules.includes("semicolon@L9"));
    assert.ok(rules.includes("em-dash@L10"));
    assert.ok(!rules.some((entry) => entry.endsWith("@L7")));
    assert.ok(!rules.some((entry) => entry.endsWith("@L11")));
    assert.ok(!rules.some((entry) => entry.endsWith("@L15")));
    assert.ok(!rules.some((entry) => entry.endsWith("@L18")));
    assert.ok(!rules.some((entry) => entry.endsWith("@L21")));
  });

  it("flags P0 paste leaks, AI URL params, placeholders, and cutoff disclaimers", () => {
    const doc = [
      "# Draft",
      "",
      "See [the report](https://example.com/post?utm_source=chatgpt.com&id=1) citeturn0search1.",
      "Latency dropped by [confirm: exact ms] as of my last update.",
      "Let's dive in!",
    ].join("\n");

    const result = analyzeMarkdown(doc, { minSeverity: "P0" });
    const ruleSet = new Set(result.issues.map((item) => item.rule));
    assert.ok(ruleSet.has("ai-url-param"));
    assert.ok(ruleSet.has("chatbot-leak"));
    assert.ok(ruleSet.has("placeholder-leak"));
    assert.ok(ruleSet.has("cutoff-disclaimer"));
    assert.ok(ruleSet.has("chatbot-artifact"));
    assert.equal(result.counts.P1, 0);
  });

  it("flags AI vocabulary, Tier 2 clusters, bold-led lists, and negative parallelism", () => {
    const doc = [
      "# Engineering Notes",
      "",
      "In today's fast-paced landscape, we delve into a seamless game-changer.",
      "",
      "It's not just about speed, it's about reliability. The catch? It could potentially fail.",
      "",
      "We need to navigate a myriad of crucial constraints to foster a robust ecosystem.",
      "",
      "- **Latency.** Drops under load.",
      "- **Cost.** Falls by half.",
      "- **Memory.** Stays flat.",
    ].join("\n");

    const result = analyzeMarkdown(doc);
    const ruleSet = new Set(result.issues.map((item) => item.rule));
    assert.ok(ruleSet.has("filler-opener"));
    assert.ok(ruleSet.has("word-tier1"));
    assert.ok(ruleSet.has("negative-parallelism"));
    assert.ok(ruleSet.has("infomercial-hook"));
    assert.ok(ruleSet.has("hedge-stack"));
    assert.ok(ruleSet.has("tier2-cluster"));
    assert.ok(ruleSet.has("bold-list-period"));
    assert.ok(ruleSet.has("bold-list-streak"));
  });

  it("does not trigger exclamation warnings on markdown images or product-name headings", () => {
    const doc = [
      "# Benchmark",
      "",
      "### Qwen3.8 Max: Claude Code vs Qwen Code",
      "",
      "![Chart one](/media/post/a.png)",
      "![Chart two](/media/post/b.png)",
      "![Chart three](/media/post/c.png)",
    ].join("\n");

    const result = analyzeMarkdown(doc);
    assert.equal(result.issues.length, 0);
  });

  it("detects stylometric tells like uniform sentence lengths and uniform paragraphs", () => {
    const s =
      "This exact test sentence has sixteen plain words written to measure uniform rhythm well.";
    const para = `${s} ${s} ${s}`;
    const doc = ["# Rhythm", "", para, "", para, "", para, "", para].join("\n");
    const result = analyzeMarkdown(doc);
    const ruleSet = new Set(result.issues.map((item) => item.rule));
    assert.ok(ruleSet.has("uniform-sentences"));
    assert.ok(ruleSet.has("uniform-paragraphs"));
  });

  it("passes clean technical prose with zero P0 or P1 findings", () => {
    const doc = [
      "---",
      "title: 'Measuring SQLite write throughput under WAL mode'",
      "description: 'Benchmarked 10,000 batched inserts on NVMe with SQLite 3.47 and WAL enabled.'",
      "---",
      "# Measuring SQLite write throughput under WAL mode",
      "",
      "We tested 10,000 batched writes on a single NVMe drive with SQLite 3.47.",
      "",
      "Enabling WAL cut p99 write latency from 42 ms to 6 ms. Disk usage grew by 18 MB during checkpoints.",
      "",
      "## What broke",
      "",
      "A second writer process still hit `SQLITE_BUSY` after 5 seconds when a checkpoint lagged.",
    ].join("\n");

    const result = analyzeMarkdown(doc);
    assert.equal(result.counts.P0, 0);
    assert.equal(result.counts.P1, 0);
    assert.match(formatReport([{ file: "sample.md", ...result }]), /clean/);
  });
});

describe("slop cleaner", () => {
  it("applies safe mechanical fixes without touching code fences or blockquotes", () => {
    const doc = [
      "---",
      "title: 'Don’t trust “smart” quotes'",
      "---",
      "# Clean me",
      "",
      "We utilize [this doc](https://example.com/a?utm_source=chatgpt.com&x=1) in order to test due to the fact that it works citeturn0search2.",
      "",
      "- **Typed messages.** Keep logs clean.",
      "- **The lines are fine.** Leave full sentences alone.",
      "",
      "```sh",
      "echo “keep curly in code” && echo 'in order to stay'",
      "```",
      "",
      "> Don’t touch quoted prose in order to preserve citations.",
    ].join("\n");

    const { content, changes } = cleanMarkdown(doc);
    assert.ok(changes.length >= 3);
    assert.match(content, /title: 'Don''t trust "smart" quotes'/);
    assert.equal(matter(content).data.title, 'Don\'t trust "smart" quotes');
    assert.match(
      content,
      /We use \[this doc\]\(https:\/\/example\.com\/a\?x=1\) to test because it works/,
    );
    assert.doesNotMatch(content, /citeturn0search2/);
    assert.match(content, /- \*\*Typed messages:\*\* Keep logs clean\./);
    assert.match(
      content,
      /- \*\*The lines are fine\.\*\* Leave full sentences alone\./,
    );
    assert.match(content, /echo “keep curly in code”/);
    assert.match(
      content,
      /> Don’t touch quoted prose in order to preserve citations\./,
    );
  });

  it("rewrites prose em dashes and semicolons when fixPunctuation is enabled", () => {
    const doc = [
      "# Post",
      "",
      "## TL;DR: summary",
      "",
      "Latency dropped — by half; memory stayed flat.",
      "",
      "| Model | Notes |",
      "| --- | --- |",
      "| A | — |",
    ].join("\n");

    const { content } = cleanMarkdown(doc, { fixPunctuation: true });
    assert.match(content, /## TL;DR: summary/);
    assert.match(content, /Latency dropped, by half\. Memory stayed flat\./);
    assert.match(content, /\| A \| — \|/);
  });

  it("preserves code-formatted links without placeholder leaks and resets sentence runs across headings", () => {
    const s =
      "This exact test sentence has sixteen plain words written to measure uniform rhythm well.";
    const doc = [
      "# Post",
      "",
      `${s} ${s} ${s} ${s}`,
      "",
      "## Next section",
      "",
      s,
      "",
      "| Col | Details |",
      "| --- | --- |",
      "| **Start** | [`session_start`](https://example.com/a) and [`session_send`](https://example.com/b); keeps links intact |",
      "",
      "- **Each model on its best work.** Planning stays separate.",
      "- **One step per run.** Restarts cleanly.",
    ].join("\n");

    const analysis = analyzeMarkdown(doc);
    assert.ok(!analysis.issues.some((i) => i.rule === "uniform-sentences"));
    assert.ok(
      analysis.issues.some((i) => i.rule === "table-semicolon" && i.severity === "P2"),
    );
    assert.equal(
      analysis.issues.filter((i) => i.rule === "bold-list-period").length,
      2,
    );

    const { content } = cleanMarkdown(doc, { fixPunctuation: true });
    assert.ok(!content.includes("\u0000HOLD"));
    assert.match(
      content,
      /\[`session_start`\]\(https:\/\/example\.com\/a\) and \[`session_send`\]\(https:\/\/example\.com\/b\); keeps links intact/,
    );
    assert.match(content, /- \*\*One step per run:\*\* Restarts cleanly\./);
  });
});
