# Post Archetypes for Piece by Piece

Pick the archetype that matches your evidence. Do not bolt sections from another shape onto a post unless they add real information.

## 1. Experiment / Benchmark Report

Use when you ran your own tests, benchmarks, or A/B evaluations.

**Target length:** 1,000-1,800 words.

**Structure:**

1. **Lead (2-3 short paragraphs):** what you tested, why it mattered, the setup, and the headline outcome.
2. **Headline finding (`##` heading states the result):** 3-5 concrete bullets plus the primary scatter/bar chart.
3. **Baseline or Round 1:** establish the control or expose any contamination/memorization early.
4. **Main experiment:** full results table across every split/task (not cherry-picked), plus a per-case breakdown showing variance and regressions.
5. **Behavioral observations:** what the logs actually showed (tool counts, timeouts, token breakdown, unexpected failure modes).
6. **Scoring traps / what broke:** mistakes you hit while measuring and how you corrected them.
7. **What this experiment can't tell you:** sample size, single codebase bias, judge limits, pricing caveats.
8. **How it was measured:** exact prompts, flags, environment versions, and log paths so a reader can reproduce or critique it.

**Evidence gates:**

- Consistent baseline across every table.
- Report reverted/failed runs and timeouts rather than dropping them.
- State per-case movement, not only averages.
- Date every pricing or model claim.

## 2. Field Guide / Comparison

Use when synthesizing multiple public benchmarks, tools, or patterns into a decision guide.

**Target length:** 1,500-3,000 words.

**Structure:**

1. **Lead:** why the choice changed recently, the mental model (e.g., two axes), and the upfront caveat that no single option wins everywhere.
2. **TL;DR tables:** fast lookup by goal or constraint, with explicit evidence strength (e.g., strong / medium / weak).
3. **Sources table:** every external source, what it measures, sample size, and what comparisons it supports.
4. **Core comparisons:** grouped by question, cross-referencing independent sources vs vendor self-reports. Flag statistically insignificant gaps explicitly.
5. **Decision rules / workflow:** concrete routing rules, gotchas, and a compact diagram or ASCII flow.
6. **When NOT to use the complex option:** break-even math, overhead, and where the simple default wins.
7. **Caveats and dated Sources list:** sample sizes, version mismatches, vendor inflation, and every cited URL.

**Evidence gates:**

- Never mix benchmark versions inside one comparison table.
- Separate vendor self-reported scores from independent runs.
- Flag small samples and within-noise differences plainly.

## 3. How We Built X / Systems Architecture

Use when explaining a system, agent loop, or engineering architecture you built and ran.

**Target length:** 900-1,800 words.

**Structure:**

1. **Lead (2-3 paragraphs):** what the system does, why the naive approach stalls, and the core mechanism. Optional brief comparison to how other engineering teams approach the problem, with links.
2. **System overview (`##` + SVG diagram):** walk through the components in execution order. Use an animated SVG if timing, gating, or a loop is central.
3. **One real run, start to finish:** concrete task, real numbers before and after across train/validation/test or staging/prod, what the system got wrong, and what was rejected.
4. **Where humans fit / failure boundaries:** a clean table of when automation pauses and why, paired with a diagram if multiple agents or roles interact.
5. **What works (numbered practices):** 5-9 concrete lessons backed by your runs or cited outside engineering posts. Keep item lengths natural and uneven.
6. **What is still hard:** honest remaining limits (cost of rejected runs, replay limits, judge drift, generalization gaps).
7. **Close:** one sharp question or link to a minimal repo the reader can run.

**Evidence gates:**

- Do not mix metrics from two different iterations in one table.
- If a coach/optimizer or judge is involved, check for leakage and state how you verify the grader.
- Include at least one concrete reverted/failed attempt.

## 4. Build Log / Practical Tool Guide

Use when showing how to build, configure, or debug a specific tool, hardware project, or workflow.

**Target length:** 700-1,500 words.

**Structure:**

1. **Lead:** the exact pain and what the finished setup achieves.
2. **Prerequisites:** exact runtime versions, hardware, packages, and environment assumptions.
3. **Architecture or flow:** a concise SVG or diagram when more than two components interact.
4. **Step-by-step build:** numbered steps with complete, runnable code or commands and real terminal output. Explain why each step exists, not just what the syntax does.
5. **Edge cases and dead ends:** what failed during setup and how you fixed it. Mark broken snippets clearly so nobody copies them.
6. **Tradeoffs and limits:** when a simpler tool is better.
7. **Next step:** link to the repo, demo, or follow-up check.

**Evidence gates:**

- Every command and config snippet is verified against the actual tool.
- Realistic names in examples, never `foo`/`bar`.
- No undocumented flags or guessed default values.
