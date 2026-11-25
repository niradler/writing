---
name: write-blog-post
description: Draft, structure, and prepare technical articles for Piece by Piece (blog.niradler.com) with sourced evidence, plain engineering voice, diagrams, GEO/SEO readiness, and automated checks. Use when drafting a new blog post, turning notes, logs, benchmarks, or a repository into an article, or substantially reworking a post in site/posts/.
---

# Write a Blog Post for Piece by Piece

Write engineering articles that earn a peer's time: lead with the concrete finding or problem, prove every claim with an artifact, include an honest limitations section, and strip machine-generated fluff before publishing.

## Mode: Transcribe vs Co-author

Decide the mode before writing.

- **Transcribe**: source artifacts exist (code, logs, benchmark runs, PRs, transcripts, primary sources). Write only what the source supports. Never invent numbers, flags, benchmark scores, defaults, or biographical details. Mark missing facts `[confirm: X]` and list them as open items.
- **Co-author**: drafting from a rough idea or outline with the author. Propose structure and angles, mark unconfirmed proposals clearly (`[confirm: ...]`), and confirm concrete facts before turning them into published claims.

## Core Standards

1. **One thesis, one reader.** State the single takeaway in one sentence before drafting. Write for a working software, infra, or AI engineer who skims, checks numbers, and detects hand-waving immediately.
2. **Concrete before abstract.** Open with the result, command, failure, or real case, then explain the mechanism. Never open with history or throat-clearing ("In today's fast-paced world...").
3. **Every claim carries an artifact.** Back claims with a number and unit, a command, a version string, a file path, a log output, a runnable snippet, or a link to a primary source. Keep sample sizes, baselines, and measurement conditions visible.
4. **One honest section is mandatory.** Name what failed, what was reverted, what the experiment cannot prove, or where the approach breaks (e.g., "What is still hard", "Scoring traps I hit", "What this experiment can't tell you", "Caveats").
5. **Write for humans and answer engines.** This blog publishes `llms.txt` and `llms-full.txt`. Make headings carry information ("On fresh bugs, Codex passed 35 of 40 tests" beats "Results"). Ensure key facts survive when an agent reads raw Markdown without visual layout.
6. **Check consistency across the archive.** Search `site/posts/` for prior posts on the same topic so numbers do not contradict earlier articles and related posts cross-link cleanly.

## Voice and Prose Rules

- **Register**: plain, direct senior-engineer voice. First person `I` for hands-on experiments and opinions, `we` for team work. Take a clear position where evidence supports it; state uncertainty plainly where evidence is thin.
- **Punctuation**: zero em dashes (`—` or `--`) in prose and titles. Zero semicolons (`;`) in prose. Use periods, commas, colons, or parentheses instead. Use straight ASCII quotes (`"` `'`).
- **Paragraphs and rhythm**: one idea per paragraph, usually 1-4 sentences. Mix short sentences (<10 words) with longer ones. Each paragraph must depend on the previous one.
- **Headings**: sentence case for `##` and `###` headings. No emojis in headings.
- **Lists**: use lists for genuinely enumerable steps, comparisons, or caveats. Avoid walls of bold-led bullets (`- **Label.** ...`); write prose or plain `Label: explanation` items instead.
- **No AI slop**: avoid banned vocabulary (`delve`, `seamless`, `game-changer`, `utilize`, `pivotal`, `in order to`, `serves as`), contrast-pivot aphorisms ("It's not X, it's Y"), infomercial hooks ("The catch?"), hollow intensifiers (`genuinely`, `truly`), and generic closers ("The future looks bright").

## Post Archetypes

Choose the shape that fits the material before outlining. Load [references/post-archetypes.md](references/post-archetypes.md) for section skeletons and frontmatter templates.

- **Experiment / Benchmark Report**: reproducible runs, explicit baseline, per-case breakdown, scoring traps, limits, methodology.
- **Field Guide / Comparison**: multi-source synthesis, evidence strength markers, comparison tables, decision rules, caveats, full source list.
- **How We Built X / Architecture**: concrete loop or system diagram, one real walkthrough end to end, human-in-the-loop boundaries, lessons with receipts, what is still hard.
- **Build Log / Tool Walkthrough**: concrete problem, minimal working setup, runnable code/commands, tradeoffs, next concrete step.

## Visuals and Diagrams

If the post explains a feedback loop, multi-component architecture, protocol, or quantitative comparison, add a purpose-built diagram or data chart instead of describing topology in prose. Use the `blog-diagrams` skill for SVG design tokens, dark-card layout, accessibility, and motion rules.

- Store all post media under `site/public/media/<slug>/`.
- Reference media with root-relative paths (`/media/<slug>/file.svg` or `.png`).
- Never leave remote image URLs in Markdown.
- Every image and `cover` must have specific, descriptive alt text (never empty, never a copy of the post title).

## Frontmatter and Repo Conventions

Create the post at `site/posts/<slug>.md`. Pick a short, descriptive, lowercase hyphenated slug that is not in `RESERVED_PATHS` (`lib/site.mjs`).

```yaml
---
title: "Specific title naming the topic and payoff"
description: "140-260 char summary with concrete numbers or scope for cards, OG tags, and llms.txt."
publishedAt: "YYYY-MM-DDT12:00:00.000Z"
updatedAt: "YYYY-MM-DDT12:00:00.000Z"
tags:
  - primary-topic
  - secondary-topic
sourceUrl: "https://blog.niradler.com/<slug>"
originalUrl: "https://blog.niradler.com/<slug>"
cover: /media/<slug>/cover.png
coverAlt: "Concrete description of what the cover image shows"
---
```

Notes:

- Keep `sourceUrl` and `originalUrl` equal to `https://blog.niradler.com/<slug>` (enforced by `scripts/check-content.mjs`).
- Follow frontmatter with `# <Title>` matching `title`.
- Do not invent dates, tags, or alt text. Use `draft: true` only if the post must stay excluded from RSS, sitemap, and `llms.txt`.

## Drafting Workflow

1. **Gather sources.** Read the logs, code, notes, or URLs first. Check `site/posts/` for related posts.
2. **Pick archetype and outline.** Confirm the thesis, section headings, planned diagrams/charts, and any `[confirm: ...]` gaps.
3. **Draft body, then title and description.** Write the title and `description` last so they reflect the actual evidence.
4. **Create visuals.** Build any SVGs (via `blog-diagrams`) or charts and save them under `site/public/media/<slug>/`.
5. **Run automated checks:**
   ```bash
   npm run check:slop -- site/posts/<slug>.md
   npm run check:svg -- site/public/media/<slug>/*.svg
   ```
   Fix every `P0` and `P1` issue, and review `P2` flags for rhythm and density.
6. **Run a fresh-context review.** Use the `review-blog-post` skill in `detect` mode in a separate session or subagent so the reviewer evaluates evidence, contradictions, and voice without author bias.
7. **Verify site build and checks:**
   ```bash
   npm run check
   npm run build && npm run check:built
   npm run build:production && SITE_TARGET=production npm run check:built
   npm run format:check
   ```

## Done When

- Every number, quote, and technical detail traces to a verified source (zero `[confirm: ...]` markers left).
- `npm run check:slop -- site/posts/<slug>.md` reports zero `P0` and `P1` issues.
- Fresh-context `review-blog-post` pass has been addressed.
- Every media asset is local under `site/public/media/<slug>/` with descriptive alt text.
- `npm run check`, both builds + `check:built`, and `npm run format:check` pass.
