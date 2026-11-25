---
name: review-blog-post
description: Audit and refine Piece by Piece blog drafts for AI writing slop, punctuation tells (em dashes, semicolons), factual and methodological gaps, internal contradictions, voice drift, and blog publishing requirements. Use when reviewing a blog post PR, auditing a draft in site/posts/, or running an editorial pass before publishing.
---

# Review a Blog Post

Review drafts like a skeptical senior engineer and sharp technical editor. Catch factual leaks, thin evidence, internal contradictions, and machine-generated phrasing without flattening the author's voice.

## Fresh Context Principle

Run reviews in a fresh context or a subagent that did not write the draft. Author context hides logical leaps, missing definitions, and repetitive phrasing.

## Modes

- **`detect`** (default): run the deterministic script, perform the four-lens audit, and return prioritized findings without editing the file. Prefer this mode first so the author keeps control of voice.
- **`edit`**: apply minimal, targeted in-place fixes to flagged spans, leaving strong human passages untouched. Never alter code blocks, direct quotes, or sourced numbers.
- **`rewrite`**: advise a structural rewrite only when 3+ slop categories fire together AND the argument itself lacks a through-line.

## Step 1: Run Deterministic Checks

Always start with the repo's scripts so mechanical prose tells and SVG bugs are caught objectively:

```bash
npm run check:slop -- site/posts/<slug>.md
npm run check:svg -- site/public/media/<slug>/*.svg
```

For machine-readable output:

```bash
npm run check:slop -- --json site/posts/<slug>.md
```

In `edit` mode only, safe mechanical cleanups (curly quotes, AI URL tracking parameters, chat citation leaks, bold noun-label periods, `in order to` / `due to the fact that` / `utilize`) can be previewed and applied:

```bash
npm run check:slop -- --fix --dry-run site/posts/<slug>.md
npm run check:slop -- --fix site/posts/<slug>.md
```

Note that `--fix` converts short bold noun-label periods (`**Label.**`) to colons (`**Label:**`) but intentionally leaves bold-led bullet streaks for manual editing into prose or unbolded items. Use `--fix-punctuation` only if the author wants automatic em-dash and prose semicolon replacement, and review every touched sentence afterward.

## Step 2: Four-Lens Editorial Audit

Inspect the post across four lenses. Consult [references/slop-catalog.md](references/slop-catalog.md) for detailed pattern definitions and technical-blog carve-outs.

### Lens 1: Evidence, Math, and Contradictions (Highest Priority)

- **Source verification**: does every number, benchmark, version, and quote trace to a linked source or observed run? Flag any `[confirm: ...]` or unsupported superlative.
- **Baseline consistency**: do all tables and prose compare against the same baseline and the same experiment version?
- **Sample size and variance**: if a test set is small, does the post say so explicitly? Are per-case movements, reverted rounds, and timeouts disclosed instead of hidden inside an average?
- **Internal contradictions**: check if two sections make conflicting claims (e.g., claiming an agent "never sees expected answers" while also discussing answer leakage without explaining the channel).
- **Load-bearing claims**: identify the 3-5 claims that would mislead a reader if wrong and verify them first.
- **Archive consistency**: check whether numbers or terms contradict earlier posts in `site/posts/`.

### Lens 2: Structure, Density, and Agent-Readiness

- **First-screen test**: do the first 3 sentences state the problem, scope, and core result with zero throat-clearing?
- **Paragraph-reshuffle test**: if you swap two body paragraphs and nothing breaks, the section is a loose list, not a building argument.
- **Treadmill test**: ask "what is actually new in this paragraph?" Flag paragraphs that restate the premise in new words.
- **Honest section**: is there a concrete section naming failures, tradeoffs, or limits?
- **Heading informativeness (GEO)**: read only the `#`/`##`/`###` headings and tables. Do they tell the story to both a skimming engineer and an AI answer engine reading `llms-full.txt`?
- **Ending**: does the post end on a concrete takeaway, repo link, or real question rather than a generic summary?

### Lens 3: AI-Slop and Voice Audit

- **Punctuation tells**: zero em dashes (`—`, `--`) and zero prose semicolons (`;`). Watch for stacked parenthetical hedges.
- **Rhetorical crutches**: flag "It's not X, it's Y" (including split-sentence versions like "The headline isn't X. The real story is Y."), compulsive rule-of-three adjectives, infomercial hooks ("The catch?"), rhetorical question transitions, and bold-led bullet walls (`- **Label.** ...`).
- **Vocabulary tells**: flag Tier 1 words on sight, Tier 2 words when 2+ cluster in a paragraph, and vague filler ("worth noting", "at its core", "significant"). Respect technical carve-outs in [references/slop-catalog.md](references/slop-catalog.md) (for example, `harness` is a literal domain noun in coding-agent posts).
- **Rhythm and voice**: check sentence and paragraph length variety. Do not over-polish natural contractions, direct opinions, or crisp fragments into sterile prose.

### Lens 4: Visuals and Blog Compliance

- **Visual opportunities**: flag dense multi-step flows, architectures, or numeric comparisons that would be much clearer as an SVG diagram (see `blog-diagrams`) or data chart.
- **SVG hygiene** (if SVGs exist): check `role="img"`, `<title>`, `prefers-reduced-motion: reduce`, valid `<defs>` marker references, monotonic SMIL `keyTimes` within `[0, 1]`, and legible contrast.
- **Frontmatter & links**: verify `sourceUrl`/`originalUrl` match the slug, `description` is concrete, `cover` and all inline images live under `/media/<slug>/` with descriptive alt text, and `npm run check` passes.

## Step 3: Report Format

Group findings by severity with exact line numbers, quoted text, error pattern name, and a concrete fix.

- **P0 (Must fix before merge)**: factual errors, math mismatches, internal contradictions, unverified invented claims, unresolved `[confirm: ...]`, chat/URL leaks, broken media/checks.
- **P1 (Fix before publishing)**: em dashes, prose semicolons, AI vocabulary tells, negative parallelism, bold-led bullet walls, missing honest section, thin evidence or hidden variance, throat-clearing intro.
- **P2 (Polish)**: uniform sentence/paragraph rhythm, wordy transitions, heading sentence case, tighter cuts, diagram suggestions.

End with a brief **What already works** note (2-3 bullets) so targeted edits preserve the strongest passages.
