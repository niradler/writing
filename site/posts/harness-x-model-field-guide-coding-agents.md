---
title: 'Harness × Model: A Field Guide to Mixing Coding Agents in Late 2026'
description: 'Claude Code, Codex, OpenCode, Pi and vendor CLIs × Claude, GPT, DeepSeek, Qwen, Kimi and Grok: what the evidence says, where it runs out, and how to find the combination that fits your work.'
publishedAt: '2026-11-10T12:00:00.000Z'
updatedAt: '2026-11-10T12:00:00.000Z'
tags:
  - ai-coding-agents
  - claude-code
  - codex
  - opencode
  - llm-benchmarks
sourceUrl: 'https://blog.niradler.com/harness-x-model-field-guide-coding-agents'
originalUrl: 'https://blog.niradler.com/harness-x-model-field-guide-coding-agents'
cover: /media/harness-x-model-field-guide-coding-agents/pareto-score-vs-cost.png
coverAlt: 'Scatter of coding agent index vs cost per task across harness and model combinations, with the Pareto frontier from DeepSeek V4.1 Flash to Claude Code with Opus 5.5'
---
# Harness × Model: A Field Guide to Mixing Coding Agents in Late 2026

A year ago, choosing a coding agent meant choosing a vendor. Today you can run DeepSeek inside Claude Code, Qwen inside OpenCode, have Opus plan while a model that costs a fraction of the price does the typing, or build your own harness in an afternoon. The design space has exploded, and most teams are still using whatever they installed first.

This piece is a map, not a verdict. A coding agent has two parts:

- **The model** is the brain: Claude Opus, GPT-6.1, DeepSeek V4.1, Qwen3.8, Kimi K3, Grok 4.7.
- **The harness** is the body: Claude Code, Codex CLI, OpenCode, Pi, or the vendor's own CLI (DeepSeek Harness, Qwen Code, Kimi Code, Grok Build). It decides the system prompt, the tools, how context is compacted, and when to stop.

Most harnesses now accept any model with a compatible API, which raises two questions:

1. **Same model, which harness?** For example, is DeepSeek better in Codex or in DeepSeek's own CLI?
2. **Same harness, which model?** For example, if your team lives in Claude Code, which brain should you put in it?

No single benchmark answers either question, so **we cross-check against multiple independent sources** and say how strong the evidence is. Where it's thin, we say so, and that's often where the most interesting experiments are.

> **One thing up front:** there is no combination that's best for everyone. A combo that's clearly better on a benchmark can be worse for *your* codebase, budget, subscription or workflow. The differences between good options are often a few points, and the right call depends on what you're optimizing for. Treat what follows as starting hypotheses to test, not rules.

---

## TL;DR: where the evidence currently points

**Same model, which harness?**

| Model | Strongest showing so far | Also good | Rough edges | Evidence |
|---|---|---|---|---|
| **DeepSeek V4.1 Flash** | **DeepSeek's own CLI** (most accurate, fastest) or **Pi** (cheapest) | Claude Code | Codex CLI (slow, times out) | 🟢 Strong: 5 sources |
| **Qwen3.8 Max** | **Claude Code** (Alibaba benchmarks in it) | — | — | 🔴 Weak: no independent Qwen Code numbers exist |
| **Kimi K3** | **Kimi Code CLI ≈ Claude Code** (tie) | — | OpenCode via OpenRouter (schema errors) | 🟡 Medium: 4 sources, small samples |
| **Grok 4.7** | **Grok Build** (the only option) | — | Claude Code (not possible) | 🟢 Clear-cut |
| **GPT-6.x** | **Codex** | OpenCode / Pi (statistical tie) | — | 🟡 Medium: 3 sources |
| **Claude Opus / Sonnet 5.5** | **Claude Code** | Pi / OpenCode (API key only) | — | 🟡 Medium |

**Same harness, which model?**

| If you live in… | Top scorer | Best value so far | Weaker spot |
|---|---|---|---|
| **Claude Code** | Opus 5.5 | **DeepSeek V4.1 Flash** (Sonnet-level in long sessions at about 1/9 of the cost) | Qwen3.8 Max on long terminal tasks (coding itself is fine) |
| **Codex CLI** | GPT-6 Astra / GPT-6.1 Sol | GPT-6.1 Terra or DeepSeek V4.1 Flash | — |
| **OpenCode** | No clean data; GPT and DeepSeek both score in the middle of the pack | DeepSeek V4.1 Flash | Kimi via OpenRouter (compatibility issues) |
| **Pi** | Opus (strong on Terminal-Bench since 2025) | **DeepSeek V4.1 Flash** (best cost per point in 2 of 2 tests) | — |

**Harnesses by what they're good at:** Claude Code for top quality with Claude models · Codex for value with GPT · Pi for low cost and full control · OpenCode for openness and provider breadth. Each is a reasonable home base; none is "the" answer.

**Combining models:** escalating on failure and using cheap subagents are low-risk ways to start. Planner → executor and advisor setups can work, but the gains are situational (Part 4).

**The big pattern:** a model is often strongest in **its own vendor's harness**, but the gap is usually **2–4 points, often within run-to-run noise**. What changes a lot between harnesses is **cost and time**. DeepSeek V4.1 Flash is currently the stand-out *value* model across harnesses. That makes harness choice much more about workflow and economics than raw quality, which is good news: you have room to experiment.

---

## Our sources

| Source | What it measures | Same-model comparison? | Same-harness comparison? |
|---|---|---|---|
| [Artificial Analysis Coding Agent Index v2.0](https://artificialanalysis.ai/agents/coding-agents) | 290 tasks (FrontierCode, Terminal-Bench 4.0, SWE-QnA), ×3 attempts | DeepSeek: native vs Codex | Claude Code (6 models), Codex (4+ models) |
| [Official Terminal-Bench 4.0 board](https://aicost.tools/benchmarks/terminal-bench-4/) (via aicost / BenchLM) | 330 trials per entry | — | Claude Code: Opus, Sonnet, Qwen |
| [Bug Hunt Bench (Product Compass)](https://www.productcompass.pm/p/deepseek-harness-vs-claude-code) | 105 planted bugs, 5–7 runs each | DeepSeek: native, Claude Code, Codex, Pi | Claude Code: Sonnet vs DeepSeek; Codex: Astra vs DeepSeek |
| [Bito](https://bito.ai/blog/best-open-weight-model-for-coding-kimi-k3-1-pro-glm-5-3-deepseek/) | Long agent sessions + short questions | — | Claude Code: 7 models |
| [Tensorlake](https://www.tensorlake.ai/blog/best-ai-coding-agents-2026) | 30 hard tool-use tasks | DeepSeek V4: Pi, Claude Code, Codex, OpenCode | — |
| [OpenBench (via kingy.ai)](https://kingy.ai/blog/opencode-review/) | 37–42 tasks | GPT-5.6 Sol and DeepSeek V4 across 5 harnesses | — |
| [Owners Not Renters](https://newsletter.ownersnotrenters.com/p/putting-kimi-k3-to-the-claude-code) | 30 runs, 2 tasks | Kimi K3: Claude Code vs Kimi Code | — |
| [Akita on Rails](https://akitaonrails.com/en/2026/07/17/llm-benchmarks-kimi-k3/) | 1 Rails app build per model | Kimi: Kimi CLI vs OpenCode | — |
| [Efraín Garay](https://efraingaray.com/en/blog/arneses-agentes-minimax-terminal-bench/) | 39 Terminal-Bench 2.0 tasks | MiniMax-M3 across 7 harnesses | — |

---

## Part 1: Same model, which harness?

### DeepSeek V4.1 Flash: own CLI vs Codex vs Claude Code vs Pi vs OpenCode

This is the best-covered model, with five independent sources.

| Source | DeepSeek Harness | Claude Code | Codex CLI | Pi | OpenCode |
|---|---:|---:|---:|---:|---:|
| **Artificial Analysis** (index) | 46 · $0.30 · **21 min** | — | **47** · $0.39 · 38 min | — | — |
| **Bug Hunt**, max effort (bugs /105, 7 runs) | **42.7** · $1.84 · 62 min | 39.1 · **$1.01** · 58 min | — | 42.2 · $0.83 | — |
| **Bug Hunt**, high effort (5 runs) | **39.2** · $1.27 · 53 min | — | 33.2* · $3.97 · **232 min** | — | — |
| **Tensorlake** (V4 Flash, /30) | — | 16 · $3.12 | 16 · $1.29 | **20** · **$0.56** | 14 · $1.03 |
| **OpenBench** (V4 Flash) | — | **81.1%** | 64.9% | 75.7% | 70.3% |

\*4 of 5 Codex runs hit the 3-hour limit, so its score is a floor.

**Cross-referenced verdict:**

- **Accuracy:** the native DeepSeek Harness leads in both sources that include it, by 3–6 points. Product Compass calls it "a consistent lean, not a proven gap": the difference is inside run-to-run noise.
- **Speed:** Codex is the slowest in two of two sources (38 vs 21 min on AA; 232 vs 53 min with timeouts on Bug Hunt). DeepSeek in Codex works, but it works slowly.
- **Cost:** Pi is the cheapest in two of two sources, with accuracy about equal to the native CLI.
- **Codex's one advantage:** the highest *FrontierCode* score (53 vs 47 on AA), so it's slightly better at pure code-writing tasks and worse at terminal work.

**→ So far, DeepSeek's own CLI has shown the best results and Pi the lowest cost. Claude Code is a perfectly reasonable choice if your team already lives there; the gap is within noise. Codex is worth testing for code-writing tasks, but expect slower long runs.**

### Qwen3.8 Max: Claude Code vs Qwen Code

**The honest answer: nobody has independently benchmarked Qwen Code.** We checked Alibaba's launch materials, Artificial Analysis, Terminal-Bench, and three independent analyses ([Codersera](https://codersera.com/blog/qwen-3-8-max-complete-guide-2026/), [Apidog](https://apidog.com/blog/qwen-3-8-benchmarks/), [kingy.ai](https://kingy.ai/blog/qwen3-8-max-benchmarks-specs-kimi-k3-deepseek-v4-flash/)). Qwen Code added the model in July, but no one has published a score for it.

What we can cross-reference:

| Source | Harness | Benchmark | Score |
|---|---|---|---:|
| Alibaba (vendor) | Mostly **Claude Code** via Anthropic-compatible API | Terminal-Bench 2.1 | 86.6 |
| Artificial Analysis | Terminus 2 (neutral) | Terminal-Bench 2.1 | 81.3% |
| Artificial Analysis | Alibaba's Claude Code setup | Terminal-Bench 2.1 | 79.4% |
| Vals AI | not stated | Terminal-Bench 2.1 | 67.4% |
| Official board | **Claude Code**, max, 330 trials | Terminal-Bench 4.0 (harder) | 27.0% |
| Artificial Analysis | **Claude Code** | Coding Agent Index v2.0 | 39 (TB 4.0: 17) |

**Cross-referenced verdict:**

- Alibaba itself benchmarks Qwen in **Claude Code**, which makes it the vendor-blessed path. Qwen Code is not used in Alibaba's own benchmark table.
- Claude Code vs a neutral harness is only about 2 points apart (79.4 vs 81.3). **The weakness is the model on hard, long terminal tasks, not the harness.** It drops from about 80% on Terminal-Bench 2.1 to 17–27% on 4.0.
- Codersera flags that Alibaba's comparison mixes harnesses, and that a 5-hour timeout probably inflated vendor numbers.

**→ Qwen3.8 Max is a solid everyday coder at about a third of Opus's cost per task ($3.80 vs $11.42).** It's within reach of Claude on writing code (FrontierCode 45 vs Opus 56) and codebase Q&A (56 vs 66). Where it falls behind is long, autonomous terminal work (17 vs 63), so hand those tasks to a stronger model. On pure price-per-point, Codex + GPT-6.1 Sol and DeepSeek V4.1 Flash still come out ahead. Qwen Code hasn't been benchmarked yet.

### Kimi K3: Kimi Code CLI vs Claude Code vs OpenCode

| Source | Kimi Code CLI | Claude Code | OpenCode |
|---|---|---|---|
| Artificial Analysis | Index 41 · TB 21 · $5.17 · 1.0 h | not tested | not tested |
| Owners Not Renters (30 runs) | 100% solved | 100% solved, "no difference" | — |
| Bito | — | 70% long sessions · $2.46 | — |
| Akita on Rails | 89/100 | — | **Failed**: Moonshot rejected OpenCode's tool schema via OpenRouter |

**Verdict:** Kimi Code and Claude Code look **equivalent** in the only head-to-head (small sample). OpenCode has had real compatibility friction. **→ Use whichever CLI you prefer, Kimi Code or Claude Code.** Either way, Kimi scores below DeepSeek in Claude Code (70% vs 77% on Bito) at 17× the cost. The newer **Kimi K3.1 Pro** claims 65.7% on Terminal-Bench 4.0, but that's vendor-reported with no harness stated, and on Bito it scored the same as K3 at 1.7× the cost.

### Grok 4.7: Grok Build only

xAI deprecated its Anthropic-compatible endpoint, so **Grok 4.7 can't run in Claude Code** ([Lindy](https://www.lindy.ai/blog/grok-build-vs-claude-code)). In its native Grok Build it scores 37.6% on the official Terminal-Bench 4.0 and 47 on AA's index, at $9.48/task. No sources test it in OpenCode or Codex. **→ Grok Build is effectively the only option today. On these benchmarks it trails Codex + GPT-6 Astra (55, $7.04), though Grok's very fast output (about 188 tokens/s) may matter more than benchmark points for some workflows.**

### GPT-6.x and Claude: is the home harness best?

- **GPT in Codex vs others:** on Terminal-Bench 2.1, GPT-5.5 scored 83.4% in Codex vs 78.2% in the neutral Terminus 2 harness. On OpenBench, GPT-5.6 Sol scored OpenCode 81.0%, Pi 76.2%, Codex 73.8%, which is *not* statistically significant. **→ Codex has a slight edge on terminal work; elsewhere it's a tie.**
- **Claude in Claude Code vs others:** reports conflict. One secondary source claims Opus scored higher in Cursor than in Claude Code on Terminal-Bench 2.0 (93% vs 77%), while CORE-Bench shows Opus at 78% in Claude Code vs 42% in a minimal scaffold ([Vaughan](https://codex.danielvaughan.com/2026/04/19/the-harness-effect-same-model-different-tool-different-score/)). Pi's author placed Pi + Opus 4.5 8th on Terminal-Bench 2.0 with only four tools. **→ Claude Code is the safe default; Pi is a credible minimal alternative.**

### The pattern across all models

| Model | Native vs best alternative harness | Same-model sources |
|---|---|---|
| DeepSeek V4.1 Flash | +3 to +6 pts for native (within noise) | 5 |
| MiniMax-M3 | 51–74% spread across 7 harnesses, **no pair significant** | 1 |
| Qwen3.8 Max | ~2 pts (Claude Code vs Terminus) | 2 |
| Kimi K3 | ~0 (Claude Code vs Kimi Code) | 1 |
| GPT-5.5 / 5.6 | +5 pts native on Terminal-Bench; tie on OpenBench | 2 |

**Harness choice moves accuracy by a few points, often within noise. It moves cost and time by 2–4×.** Pick the harness for economics and workflow, not for a few benchmark points.

---

## Part 2: Same harness, which model?

![Two bar charts of AA Coding Agent Index v2.0 with the harness held fixed. Inside Claude Code: Opus 5.5 62, Sonnet 5.5 59, Fable 5.1 58, Step 5 Preview 43, Qwen3.8 Max 39, Haiku 5.5 37. Inside Codex: GPT-6 Astra 55, GPT-6.1 Sol 54, GPT-6.1 Terra 48, DeepSeek V4.1 Flash 47.](/media/harness-x-model-field-guide-coding-agents/same-harness-aa-index.png)

### Inside Claude Code

Three independent sources rank models in the same Claude Code setup:

| Model | AA index | Official TB 4.0 | Bito long sessions | Bug Hunt (/105) | Cost signal |
|---|---:|---:|---:|---:|---|
| Claude Opus 5.5 | **62** | **64.8%** | **87%** | — | $11.42/task (AA) |
| Claude Sonnet 5.5 | 59 | 61.8% | 77% | **51.3** | $13.30/task (AA) |
| Claude Fable 5.1 | 58 | — | — | — | $11.53/task |
| **DeepSeek V4.1 Flash** | — | — | **77%** | 39.1 | **$0.14/session (Bito), $1.01/run (Bug Hunt)** |
| Claude Haiku 5.5 | 37 | — | 76% | — | $0.69/session |
| GLM-5.3 | — | — | 71% | — | $2.86/session |
| Kimi K3.1 Pro | — | — | 71% | — | $4.28/session |
| Kimi K3 | — | — | 70% | — | $2.46/session |
| Step 5 Preview | 43 | — | — | — | $1.84/task |
| Qwen3.8 Max | 39 | 27.0% | — | — | $3.80/task |

![Scatter inside Claude Code of long-session score vs cost (Bito): Opus 87% at $5.42; Sonnet 77% at $1.28; Haiku 76% at $0.69; DeepSeek V4.1 Flash 77% at $0.14; GLM-5.3, Kimi K3 and Kimi K3.1 Pro at 70–71% for $2.46–$4.28.](/media/harness-x-model-field-guide-coding-agents/claude-code-model-swap-bito.png)

**Cross-referenced verdict:**

- **Opus 5.5 is the clear #1** in every source that tests it.
- **DeepSeek V4.1 Flash is the best non-Anthropic brain for Claude Code.** It ties Sonnet on Bito (77%) at about 1/9 the cost. On the harder Bug Hunt it reaches 76% of Sonnet's score (39.1 vs 51.3) at under 1% of the cost ($1.01 vs $154 per run at list prices).
- **Kimi K3 / K3.1 Pro and GLM-5.3** land 6–7 points below DeepSeek at 18–31× the cost.
- **Qwen3.8 Max is good at code and weak at autonomy.** Its FrontierCode (45) and Q&A (56) scores are respectable at a third of Opus's cost. Its Terminal-Bench 4.0 score is the lowest of any Claude Code entry, which pulls its overall index down to 39.
- **Grok 4.7:** not possible.

**Setup gotchas for non-Anthropic models in Claude Code:**

- Set every model slot explicitly (`ANTHROPIC_DEFAULT_HAIKU_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`), or background calls silently get remapped.
- Use `CLAUDE_CODE_EFFORT_LEVEL` rather than thinking budgets.
- Set `ENABLE_TOOL_SEARCH=false` behind custom base URLs.
- `/cost` shows Anthropic prices, so it's wrong for other models.
- Remote Control is disabled.

([Avinash Sangle](https://avinashsangle.com/blog/deepseek-v4-1-flash-multimodal-coding-guide), [CodeAgentSwarm](https://www.codeagentswarm.com/en/guides/kimi-k3-with-claude-code))

### Inside Codex CLI

| Model | AA index | FrontierCode | Terminal-Bench 4.0 | Cost | Time | Bug Hunt (/105) |
|---|---:|---:|---:|---:|---:|---:|
| GPT-6 Astra | **55** | 49 | **56** | $7.04 | 24.8 m | **45.0** ($33/run) |
| GPT-6.1 Sol | 54 | 49 | 53 | $1.50 | 23.7 m | — |
| GPT-6.1 Terra (xhigh) | 48 | 45 | 46 | $0.69 | **16.4 m** | — |
| DeepSeek V4.1 Flash | 47 | **53** | 28 | **$0.39** | 38.1 m | 33.2* ($3.97) |

**Verdict:** **GPT-6.1 Sol is the default brain for Codex.** It's essentially tied with Astra at about 1/5 the cost. DeepSeek is the best *coder* in Codex (FrontierCode 53) but the weakest at terminal autonomy and twice as slow. That makes it great for "write this function" work and poor for "go fix the build." No sources test Qwen, Kimi or Grok in Codex.

### Inside OpenCode

Clean same-harness data is thin. AA tests only GLM-5.3 (49, $5.23). OpenBench shows GPT-5.6 Sol (81.0%) ahead of DeepSeek V4 Flash (70.3%), but on different task bundles. Kimi via OpenRouter failed on schema validation. **→ The OpenCode verdict is unproven. Its strengths are openness and provider breadth, not benchmark leadership.**

### Inside Pi

Two independent DeepSeek tests both have Pi at or near the top for the lowest cost:

- Tensorlake: 20/30 for $0.56
- Bug Hunt: 42.2 for $0.83, vs 42.7 for the native CLI at $1.84

Its author's Opus 4.5 run placed it 8th on Terminal-Bench 2.0 with only four tools. **→ Pi + DeepSeek is the best cost-per-point combination we found. Pi + Opus is the build-your-own power option.**

---

## Starting points by goal

These are reasonable *first experiments* for each goal, based on current data, not final answers.

![Scatter of AA Coding Agent Index vs cost per task across all harness × model combos, with the Pareto frontier running from DeepSeek V4.1 Flash up through Codex GPT models to Claude Code + Opus 5.5.](/media/harness-x-model-field-guide-coding-agents/pareto-score-vs-cost.png)

| Goal | Combo | Why |
|---|---|---|
| **Maximum quality** | Claude Code + Opus 5.5 | #1 in every source |
| **Best value** | Codex + GPT-6.1 Sol | 87% of Opus's AA score at 13% of the cost |
| **Lowest cost** | DeepSeek CLI or Pi + DeepSeek V4.1 Flash | Sonnet-level on long sessions for cents; off-peak pricing halves it again |
| **Cheap brain, keep Claude Code** | Claude Code + DeepSeek V4.1 Flash | Best swap-in in 2 of 2 multi-model Claude Code tests |
| **Speed** | Codex + GPT-6.1 Terra | 16 min per task |
| **Build your own** | Pi | Minimal core, SDK, extensions; best cost per point |

**Things to keep an eye on when you experiment:**

- Qwen3.8 Max on long autonomous terminal tasks (it's fine for coding and Q&A at about a third of Opus's cost)
- Grok Build + Grok 4.7 (trails on score and price in these benchmarks)
- Codex + DeepSeek on long tasks (some runs timed out)
- Kimi in OpenCode via OpenRouter (reported compatibility errors; may be fixed by now)

---

## Part 3: Route by task, and rotate without losing your cache

### Choose the combination per task type

The sub-benchmarks show *where* each combo is strong, so you can route by the kind of work:

| Task type | Benchmark signal | Route to |
|---|---|---|
| **Architecture, hard debugging, security-sensitive changes** | Highest overall and FrontierCode (Opus 56) | Claude Code + **Opus 5.5** |
| **Long autonomous terminal / ops work** (fix the build, infra, CI) | Terminal-Bench 4.0: Sonnet 66, Opus 63; everything non-native ≤ 33 | Claude Code + **Sonnet 5.5** or Opus. *Don't* use cheap swap-ins here |
| **Everyday feature tickets** | Index 54 at $1.50, 24 min | Codex + **GPT-6.1 Sol** |
| **"Write this function / module"** (pure code generation) | FrontierCode: DeepSeek 53 in Codex, ahead of GPT-6.1 Sol's 49 | **DeepSeek V4.1 Flash** (Codex or its own CLI) |
| **Bulk mechanical work** (migrations, tests, lint, docs) | Sonnet-level long sessions at $0.14 (Bito) | DeepSeek CLI or **Pi + DeepSeek**, off-peak |
| **Codebase Q&A and exploration** | SWE-QnA: nearly every combo scores 54–66; DeepSeek 61–62 at $0.30 | Cheapest model available, ideally as a **subagent** |
| **Fast inner-loop iteration** | 16.4 min per task | Codex + **GPT-6.1 Terra** |

A simple policy: **start cheap, escalate on failure.** Run a ticket on Sol or DeepSeek first. If it fails or touches critical code, escalate to Opus with a handoff summary (see below).

### Why switching models can be expensive: caching

Agent sessions re-send the whole context on every turn, and **95–99% of input tokens are cache reads** in every harness measured: Claude Code and OpenCode 95% (AA), DeepSeek setups >99% and Codex 94% (Bug Hunt), Kimi 92–97% (Owners Not Renters). Cache hits are where the savings come from:

| Provider | Cache read vs uncached input | Notes |
|---|---|---|
| Anthropic (Opus / Sonnet 5.5) | **0.05×** (about 20× cheaper) | Writes cost 1.25× (5-min TTL) or 2× (1-hour TTL) |
| DeepSeek V4.1 Flash | $0.006 vs $0.30 (**about 50× cheaper**) | Automatic |
| Qwen3.8 Max | 0.10× | Explicit cache creation costs 1.25× |
| Grok 4.7 | $0.50 vs $2 (4× cheaper) | — |

The catch: **each model has its own cache.** Claude Code's docs say switching models "recomputes the entire request even when the content is identical" ([Claude Code docs](https://code.claude.com/docs/en/prompt-caching)). Switching providers or harnesses is a guaranteed cold start too. A `/model` swap in a 500k-token session means paying full input price on 500k tokens.

One analysis puts the break-even for switching Opus → Sonnet *in place* at **8 requests** (one-way) or **27 requests** (if you switch back), on list prices ([agentpatterns.ai](https://agentpatterns.ai/patterns/agent-design/cache-safe-routing-boundaries/)). Short detours are usually a net loss.

### Seven rules for cache-safe rotation

1. **Lock model, effort and tools at session start.** In Claude Code, these silently break the cache mid-session: `/model`, automatic model fallback, effort changes on some models, toggling fast mode, skills that pin a different `model`, and adding or removing MCP tools when tool search is off. Permission-mode changes and CLAUDE.md edits are cache-safe, though CLAUDE.md edits only apply after `/clear` or `/compact`.
2. **Switch only at cache-safe boundaries:**
   - a **new session**
   - a **subagent launch**
   - right after **`/compact`**
   - **when the cache has already expired.** Anthropic's TTL is 5 min on API billing, 1 hour for the main conversation on a subscription. agentpatterns calls an expired cache "a free re-choice."
3. **Use subagents as the cheap lane.** A subagent starts its own conversation and its own cache, so its model choice costs the parent nothing in cache terms. Run Opus as the main agent and set `CLAUDE_CODE_SUBAGENT_MODEL` to a cheaper model for search, reads and tests. One worked example: five subagents cost $4.88 when they inherited an expensive model vs $1.27 on a cheaper one.
4. **Hand off; don't hot-swap.** To move work to a different model or harness, have the current agent write a short handoff (`PLAN.md` or `HANDOFF.md`: goal, decisions, files touched, next steps). Start a fresh session on the new combo from that file. You pay one small cache write instead of re-reading a huge history. An 805k-token session costs $0.88 for a one-line change in place, vs $0.36 in a fresh lane seeded from a summary.
5. **Share one instruction file across harnesses.** Codex, OpenCode, Pi and Grok Build read `AGENTS.md`; Claude Code reads `CLAUDE.md`. Symlink them so every harness starts with the same stable prefix, and keep volatile content (dates, ticket text) out of it.
6. **Keep the tool list small and fixed.** Tool schemas were **63–81% of input tokens** in one Claude Code + Kimi test. Cutting from 28 tools to 11 reduced output tokens by 20% and thinking tokens by 42% ([Owners Not Renters](https://newsletter.ownersnotrenters.com/p/putting-kimi-k3-to-the-claude-code)). A smaller, stable prefix makes every cold start cheaper.
7. **Mixing providers inside one Claude Code session needs a proxy.** `ANTHROPIC_BASE_URL` is global, so "Opus main + DeepSeek subagents" means putting a routing proxy in front, such as [LiteLLM](https://docs.litellm.ai/docs/auto_router/prompt_caching). It's simpler to run separate sessions per provider and hand off between them.

### A practical rotation workflow

```
Ticket arrives
  │
  ├─ Plan (Claude Code + Opus 5.5, one session)
  │     └─ writes PLAN.md ── handoff ─────────────────────────────┐
  │                                                              ▼
  ├─ Implement (Codex + GPT-6.1 Sol  -or-  DeepSeek CLI/Pi + V4.1 Flash, off-peak)
  │     ├─ subagents on cheapest model for search/tests (own caches)
  │     └─ fails twice or touches critical code? → write HANDOFF.md
  │                                                              ▼
  ├─ Escalate (fresh Claude Code + Opus session, seeded from HANDOFF.md)
  │
  └─ Review (fresh session, a *different* model family than the author)
```

Every arrow is a **new session at a cache-safe boundary**. No session ever switches its model mid-stream.

---

## Part 4: Combining models (planner/executor, advisor, escalation)

You don't have to pick one model. There are four common ways to combine them, and the evidence for each is very different:

| Pattern | How it works | Evidence | Verdict |
|---|---|---|---|
| **Planner → executor** | A strong model writes the plan; a cheap model implements it | 🟡 One independent test (Akita, Apr 2026, older models, one app per setup) | Loses **3–7 points** vs the strong model alone; saves money only with a really cheap executor |
| **Advisor ("teacher–student")** | A cheap or mid model works and *asks* a stronger model on hard steps | 🟡 Anthropic self-reported; one independent paper (Gemini) | Helps **only if the executor actually asks**; gains about what "more effort" buys |
| **Escalate on failure** | Run cheap first; hand failed tasks to a strong model | 🟢 Follows directly from cost per *solved* task (below) | The safest way to save money |
| **Cheap subagents** | The strong main agent delegates search, reads and tests to a cheap model | 🟢 Cache-safe by design (Claude Code docs) | Free win; no quality risk on the main thread |

### Planner → executor

The only measured test held an Opus planner fixed and swapped the executor ([Akita on Rails, Apr 2026](https://akitaonrails.com/en/2026/04/25/llm-benchmarks-vale-a-pena-misturar-2-modelos/); one greenfield Rails app per setup, scored /100):

| Setup | Score | Cost |
|---|---:|---|
| Opus alone | **97** | ~$4 |
| Opus → Sonnet executor | 92 | $5.77 |
| Opus → Haiku executor | 90 | $3.49 |
| Opus → Qwen 3.6 Plus executor (OpenCode) | 92–94 | ~$0.50 for execution, plus planning |
| Opus → GLM 5.1 executor (OpenCode) | 93 | ~$0.50 + subscription |
| Opus → Kimi K2.6 executor, with Opus supervising | **97** | ~3× the cost of Opus alone |

Close supervision recovers quality but also brings back the cost. The author's conclusion: let the frontier model decide when to delegate, rather than forcing a fixed split. These are earlier model versions; nobody has yet tested Opus 5.5 with Qwen3.8 or DeepSeek V4.1 Flash executors.

**Why the savings are smaller than per-token prices suggest:** cheap models fail more, so look at cost per *solved* task. On Terminal-Bench 4.0, from AA data compiled in a [routing study](https://github.com/Wladefant/super-board/issues/211):

| Model | Solved | Cost per solved task |
|---|---:|---:|
| Opus 5.5 (high) | 56.6% | $9.05 |
| DeepSeek V4.1 Flash | 26.8% | $4.32 |
| Qwen3.8-Flash-Next | 25.3% | $3.48 |

That's about 30× cheaper per token but only about 2× cheaper per solved hard task. A good plan should close part of that gap by taking the long-horizon reasoning away from the executor.

**Best executor candidates, by skill profile** (not yet tested head-to-head):

1. **DeepSeek V4.1 Flash:** strongest code-from-spec score among cheap models (FrontierCode 53); its weak spot, autonomy, is what the plan covers.
2. **Qwen3.8 Max:** same profile (code 45, autonomy 17), at about a third of Opus's cost per task.
3. **Qwen3.8 Flash:** cheapest ($0.15 / $0.47 per M tokens). DeepSeek-level on Terminal-Bench, but very verbose, and its strong coding numbers are vendor-reported only.

**How to set it up:**

- **Claude Code `opusplan`** switches from Opus in plan mode to Sonnet for execution. Anthropic models only.
- **Cross-provider:** Opus writes a detailed `PLAN.md` (files, steps, acceptance tests), then a fresh OpenCode / Pi / Codex session executes it with Qwen or DeepSeek. This is also the cache-safe handoff from Part 3.
- **Test compatibility first.** In Akita's test, DeepSeek V4 Pro crashed in every configuration on a protocol error.

### Advisor (teacher–student)

The executor keeps the task and *consults* a stronger model only on hard steps.

- **Claude Code `/advisor opus`** (or `claude --advisor opus`) uses Anthropic's advisor tool. The advisor must be at least as capable as the executor. Claude models only; Anthropic API only.
- **Anthropic's own numbers** (370-task internal coding eval, via [DevelopersDigest](https://www.developersdigest.tech/blog/claude-advisor-tool-vs-bigger-model-2026)): Opus 5.5 (high) + Fable 5.1 advisor scored 90.1% at $2.92, vs Opus 5.5 alone at xhigh effort 91.1% at $4.11. In Anthropic's words, the advisor "buys about what more effort does."
- **The catch:** the advisor only helps if the executor asks. In Anthropic's tests, Haiku and Sonnet executors with an Opus advisor *never consulted it* on GPQA, and the tool definition still added 12–25% to cost.
- **Independent research** (ARIA paper, Gemini models, 50 SWE-bench tasks, via [Learn Agentic](https://learnagentic.substack.com/p/your-cheap-agent-doesnt-know-when)): executor alone 18% at $11.48, advisor alone 62% at $45.90, advisor pattern 48% at $22.09. The pattern recovered most of the quality at about half the price.

**Verdict:** a reasonable cost lever within the Claude family, but self-reported and young. For cross-provider setups (for example, a Qwen executor asking Opus), there's no built-in support and no published data.

### When combining isn't worth it

A multi-model setup has real overhead: a cold cache on every switch, handoff files, two configs, and compatibility testing. That overhead often outweighs the savings:

- **The price gap is small.** In Akita's test, Opus → Haiku saved about **13%** ($3.49 vs ~$4) for a **7-point** quality drop. Opus → Sonnet actually cost **more** than Opus alone ($5.77). Below about a 5× price gap, a single strong model is usually simpler and as cheap.
- **You're on a subscription.** If Opus usage is already covered by a flat plan, the marginal cost of "just use Opus" is zero, and any quality drop is pure loss.
- **The task is short.** Switching to a new model means paying full price to load the context again. On a 10-minute task, that alone can wipe out the savings; the break-even estimate in Part 3 is 8–27 requests.
- **The task needs long-horizon autonomy.** Cheap executors are weakest exactly here (Terminal-Bench 17–31 vs 63 for Opus), and failures cost more in engineer time than the API bill saves.
- **It needs supervision to work.** When Opus had to supervise the executor closely, quality matched Opus alone but cost about **3×** more.

**Combining pays off when** the price gap is large (≥10×, for example Opus vs DeepSeek or Qwen Flash), the work is well-specified or repetitive (bulk edits, tests, migrations, code from a clear spec), and you're paying per token. Otherwise, pick one good combo and keep it.

### Escalate on failure (the safe default)

Run the task on the cheap combo first. If it fails twice or touches critical code, write `HANDOFF.md` and start a fresh strong-model session from it. Because most everyday tasks don't *need* Opus, this captures most of the savings without risking quality on the hard ones.

### Cheap subagents

Keep the strong model as the main agent and push search, file reading and test runs to a cheap subagent model (`CLAUDE_CODE_SUBAGENT_MODEL` in Claude Code). Each subagent has its own cache, so this never disturbs the main session's cache. Mixing providers this way inside Claude Code needs a routing proxy (Part 3, rule 7).

---

## Which DeepSeek? (version guide)

| Version | Released | API ID | Status |
|---|---|---|---|
| **V4.1-Flash-1017** | Oct 17, 2026 | **`deepseek-flash`** | **Latest.** Same price as V4.1 Flash; shorter outputs and faster runtime |
| V4.1-Flash | Sep 10, 2026 | (now upgraded to 1017) | Superseded |
| V4-Pro | Apr 2026 (GA Aug 13) | `deepseek-v4-pro` | Still served; larger but older architecture; no independent agent benchmarks |
| V4-Flash | Apr 2026 | `deepseek-v4-flash` → *routed to V4.1* | Retired |

Source: [DeepSeek API changelog](https://api-docs.deepseek.com/updates/).

**Use `deepseek-flash`, which is V4.1-Flash-1017.** It's the best *value* model in this article, not the strongest: Opus 5.5 still leads on every independent benchmark. Vendor numbers also run high. DeepSeek reports 42.3% on Terminal-Bench 4.0 for 1017, while independent runs measured about 27–31%.

---

## There is no single right answer

If you take one thing from this piece, make it this: **the "best" coding agent is a moving, personal target.**

- **The lines are fine.** Many of the gaps in this article are 2–5 points, within the noise of a single benchmark run. Two teams can test the same two combos and reasonably reach opposite conclusions.
- **Your context changes the math.** A flat subscription makes "just use Opus" free at the margin. A strict data policy may rule out some providers entirely. A team fluent in one harness may lose more to switching than any benchmark gap would gain. A monorepo, a greenfield app and an ops-heavy infra repo all stress agents differently.
- **"Good enough" is a valid choice.** If Qwen in OpenCode or DeepSeek in Claude Code handles 90% of your tickets well at a fraction of the cost, that can beat a combo that scores higher on paper. The sensible question isn't "what's best?" but "where does the cheaper option stop being good enough for *my* work?"
- **Everything moves monthly.** New model versions (DeepSeek shipped two Flash updates in five weeks), harness updates and price changes can flip a conclusion overnight.

**What we'd actually suggest:** pick two or three combos from this guide that fit your constraints. Run them on 10–20 *real* tickets from your backlog. Track pass rate, cost and time, and how much you had to step in. A week of that will tell you more than any leaderboard, including ours. Then revisit every quarter.

The most interesting space right now is in the combinations: cheap models doing the bulk work, strong models stepping in where it counts, and harnesses you shape to your own workflow. There's plenty of room to find something that works better for you than any default.

---

## Caveats

- **Small samples.** Most cross-harness tests run 30–105 tasks. Several authors report their differences as *not statistically significant*, and we've flagged that wherever it applies.
- **Benchmark versions matter.** Terminal-Bench 2.1 vs 4.0 scores differ by 50+ points for the same model. AA index v1.x vs v2.0 differ too. We never mix versions within a comparison.
- **Vendor numbers run high.** Anthropic, Alibaba, Moonshot and DeepSeek self-reports are consistently above independent re-runs (for example, Sonnet 5.5's Terminal-Bench 4.0 is 70.6% self-reported vs 61.8% official).
- **API cost isn't what you pay.** Subscriptions change the math. DeepSeek also has peak and off-peak pricing.
- **Data and privacy.** Check retention and training terms before sending proprietary code to any third-party endpoint.
- **As of November 10, 2026.** This space changes monthly.

---

### Sources

- Artificial Analysis: [Coding Agents](https://artificialanalysis.ai/agents/coding-agents) · [Claude Code vs Codex](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex) · [Claude Code vs OpenCode](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-opencode) · [Claude Code vs Kimi Code CLI](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-kimi-code-cli) · [Benchmarking Grok 4.7](https://artificialanalysis.ai/articles/benchmarking-grok-4-7)
- Terminal-Bench 4.0 board: [aicost.tools](https://aicost.tools/benchmarks/terminal-bench-4/) · [BenchLM](https://benchlm.ai/benchmarks/terminal-bench-4)
- [Product Compass: DeepSeek Harness vs Claude Code, 89 runs](https://www.productcompass.pm/p/deepseek-harness-vs-claude-code)
- Bito: [DeepSeek vs Claude in Claude Code](https://bito.ai/blog/deepseek-vs-claude-for-coding-v4-1-flash-1017-against-opus-5-5-sonnet-5-5-and-haiku-5-5/) · [Best open-weight model for coding](https://bito.ai/blog/best-open-weight-model-for-coding-kimi-k3-1-pro-glm-5-3-deepseek/)
- [Tensorlake: Claude Code, Codex, OpenCode and Pi](https://www.tensorlake.ai/blog/best-ai-coding-agents-2026)
- [kingy.ai: OpenCode review (OpenBench)](https://kingy.ai/blog/opencode-review/) · [Qwen3.8 Max analysis](https://kingy.ai/blog/qwen3-8-max-benchmarks-specs-kimi-k3-deepseek-v4-flash/)
- [Codersera: Qwen 3.8 Max guide](https://codersera.com/blog/qwen-3-8-max-complete-guide-2026/) · [Apidog: Qwen 3.8 benchmarks](https://apidog.com/blog/qwen-3-8-benchmarks/)
- [Owners Not Renters: Kimi K3 in Claude Code](https://newsletter.ownersnotrenters.com/p/putting-kimi-k3-to-the-claude-code) · [Akita on Rails: Kimi K3 benchmark](https://akitaonrails.com/en/2026/07/17/llm-benchmarks-kimi-k3/)
- [Efraín Garay: MiniMax-M3 across 7 harnesses](https://efraingaray.com/en/blog/arneses-agentes-minimax-terminal-bench/)
- [Daniel Vaughan: The Harness Effect](https://codex.danielvaughan.com/2026/04/19/the-harness-effect-same-model-different-tool-different-score/)
- [Lindy: Grok Build vs Claude Code](https://www.lindy.ai/blog/grok-build-vs-claude-code)
- Setup: [Avinash Sangle: DeepSeek in Claude Code](https://avinashsangle.com/blog/deepseek-v4-1-flash-multimodal-coding-guide) · [CodeAgentSwarm: Kimi K3 with Claude Code](https://www.codeagentswarm.com/en/guides/kimi-k3-with-claude-code)
- Caching: [Claude Code prompt caching docs](https://code.claude.com/docs/en/prompt-caching) · [Anthropic prompt caching pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) · [agentpatterns: cache-safe routing boundaries](https://agentpatterns.ai/patterns/agent-design/cache-safe-routing-boundaries/) · [agentpatterns: mid-session cache invalidators](https://agentpatterns.ai/patterns/anti-patterns/mid-session-config-cache-invalidators/) · [JFrog: why model routing backfires](https://jfrog.com/blog/why-model-routing-backfires) · [Puter: DeepSeek pricing](https://developer.puter.com/tutorials/deepseek-api-pricing/) · [Alibaba Cloud pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
- Combining models: [Akita: planner + executor](https://akitaonrails.com/en/2026/04/25/llm-benchmarks-vale-a-pena-misturar-2-modelos/) · [DevelopersDigest: Claude advisor tool](https://www.developersdigest.tech/blog/claude-advisor-tool-vs-bigger-model-2026) · [Learn Agentic: ARIA advisor study](https://learnagentic.substack.com/p/your-cheap-agent-doesnt-know-when) · [Routing study (AA Terminal-Bench cost per solved task)](https://github.com/Wladefant/super-board/issues/211) · [Codersera: Qwen 3.8 Flash](https://codersera.com/blog/qwen-3-8-flash-complete-guide-2026/amp/)
- DeepSeek versions: [DeepSeek API changelog](https://api-docs.deepseek.com/updates/) · [SiliconANGLE: V4.1-Flash-1017](https://siliconangle.com/2026/10/18/deepseek-releases-updated-v4-1-flash-model-it-says-completes-tasks-faster/)
- Pi: [Mario Zechner](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) · [Zechner on Terminal-Bench](https://x.com/badlogicgames/status/1995295577907593690)
