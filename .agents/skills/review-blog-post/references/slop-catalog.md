# AI Slop & Editorial Tell Catalog

Reference catalog for `review-blog-post`. Signals are weighted by context: a single technical term used literally is fine; clusters and structural habits are the real tell.

## Severity Tiers

### P0: Credibility and Paste-Leak Killers

- **Chat citation leaks**: `citeturn0search0`, `contentReference[...]`, `oai_citation`, `[attached_file:1]`, `grok_card`.
- **AI tracking URL params**: `utm_source=chatgpt.com`, `utm_source=claude.ai`, `utm_source=perplexity.ai`, `utm_source=openai`, `referrer=grok.com`.
- **Unfilled placeholders**: `[confirm: ...]`, `[TODO]`, `[INSERT ...]`, `2026-XX-XX`, `TBD`.
- **Model cutoff disclaimers**: "As of my last update", "based on available information", "I don't have access to real-time data".
- **Chat scaffolding**: "I hope this helps!", "Great question!", "Let's dive in!", "In this article, we will explore...", "Happy coding!".
- **Fabricated or mismatched facts**: invented benchmark numbers, mixed baselines across tables, contradicted claims between sections.

### P1: High-Signal AI Smell & Structural Flaws

- **Em dashes (`—`, `--`)** in prose or titles. Replace with periods, commas, colons, or parentheses. (Standalone `—` as an empty markdown table cell `| — |` is acceptable.)
- **Prose semicolons (`;`)**. Split into two short sentences or connect with a comma/colon. (`TL;DR` and code/HTML entities are exempt.)
- **Bold-led list walls and label periods**: `- **Latency.** Drops under load.` Convert to prose or plain `- Latency: drops under load.`
- **Negative parallelism**: "It's not X, it's Y", "This isn't just about X, it's about Y", and split-sentence pivots ("The headline isn't speed. The real story is cost."). State the positive claim directly.
- **Infomercial hooks**: "The catch?", "The kicker?", "Here's the thing.", "Plot twist:", "The result?". Cut the hook and state the fact.
- **Formulaic / speculative openers**: "In today's fast-paced...", "In an era where...", "Imagine a world where...", "Let's break this down".
- **Hollow intensifiers**: `genuinely`, `truly`, `quite frankly`, `to be honest`, `let's be clear`, `it's worth noting that`, `the reality is that`.
- **Hedge stacks**: "could potentially", "may eventually", "might ultimately". Pick one modal or state the fact.
- **Vague attribution**: "Experts believe", "studies show", "many developers say", "independent testing confirms" without naming the source.
- **Self-labeling significance**: "That last move is the contrarian one", "Here's what's interesting", "This represents a broader shift". Let the evidence carry the weight.
- **Generic closers**: "The future looks bright", "Only time will tell", "One thing is certain", "This one is worth your time".
- **Superficial `-ing` tails**: "...ensuring reliability, reflecting deep investment, and showcasing scalability." Cut the tail or cite a fact.
- **Tier 1 vocabulary** (replace on sight): `delve`, `tapestry`, `realm`, `beacon`, `testament to`, `cutting-edge`, `pivotal`, `underscores`, `meticulous`, `seamless`, `game-changer`, `utilize`, `watershed moment`, `nestled`, `vibrant`, `thriving`, `showcasing`, `deep dive`, `unpack`, `bustling`, `intricate`, `ever-evolving`, `daunting`, `holistic`, `actionable`, `impactful`, `learnings`, `thought leader`, `at its core`, `synergy`, `interplay`, `in order to`, `due to the fact that`, `serves as`, `boasts`, `commence`, `ascertain`, `endeavor`, `supercharge`, `unlock`.
- **Tier 2 clusters** (flag when 2+ appear in the same paragraph): `navigate`, `foster`, `elevate`, `unleash`, `empower`, `bolster`, `spearhead`, `resonate`, `revolutionize`, `facilitate`, `underpin`, `nuanced`, `crucial`, `multifaceted`, `myriad`, `plethora`, `encompass`, `catalyze`, `reimagine`, `galvanize`, `augment`, `cultivate`, `illuminate`, `elucidate`, `juxtapose`, `transformative`, `cornerstone`, `paramount`, `poised`, `burgeoning`, `nascent`, `quintessential`, `overarching`, `quietly`, `robust`, `comprehensive`, `streamline`, `leverage`, `ecosystem`, `paradigm`.

### P2: Rhythm, Polish, and Stylometry

- **Transition crutches**: sentence-initial `Moreover`, `Furthermore`, `Additionally`, `Notably`, `Interestingly`, `Surprisingly`, `Importantly`, `Significantly`, `In conclusion`, `In summary`, `When it comes to`.
- **Minimizers**: `simply`, `easily`, `it's that simple`. If it were simple, the post would not need to explain it.
- **Curly quotes (`“”‘’`)**: normalize to straight ASCII quotes in Markdown prose.
- **Title Case subheadings**: use sentence case for `##` and `###` headings (proper nouns and product names stay capitalized).
- **Compulsive rule of three**: repeated "A, B, and C" adjective triads built for rhythm rather than meaning.
- **Synonym cycling**: rotating `developers -> engineers -> practitioners -> builders` in one paragraph to avoid repeating a noun. Repeat the clearest word.
- **Uniform rhythm**: 5+ consecutive sentences of 14-24 words, or 4+ consecutive paragraphs of nearly identical length. Mix 4-8 word sentences with longer explanations.
- **Low vocabulary diversity**: type-token ratio (TTR) under 0.36 on posts over 250 words often indicates repetitive abstractions. Replace abstract nouns with concrete names, metrics, or examples.

## Technical-Blog Carve-Outs

Do not blindly flag literal domain terminology:

- `harness`: literal noun for coding-agent runtimes (Claude Code, Codex, OpenCode, Pi) and test harnesses.
- `robust`, `comprehensive`, `ecosystem`, `streamline`, `leverage`, `facilitate`, `underpin`: acceptable in isolation when describing a concrete technical property; flag only when stacked in clusters (2+ in one paragraph) or used without proof.
- `load-bearing`: acceptable when literally describing structural load or explicitly naming what breaks if removed; flag when used as vague filler.
- Quoted material, code blocks, inline code, and `TL;DR` are always exempt from prose checks.
