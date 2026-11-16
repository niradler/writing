---
title: 'I Told a Coding Agent It Was in a Competition: Claude Code vs Codex on a SWE-bench Task'
description: 'Three agents, one SWE-bench Verified issue, three runs each. Claude Code with Sonnet 5 told it was competing, the same setup not told, and Codex with GPT-6.1 Terra told. Hidden tests, blind review, wall time, tokens and cost, all measured from the session logs.'
publishedAt: '2026-11-16T12:00:00.000Z'
updatedAt: '2026-11-16T12:00:00.000Z'
tags:
  - ai-coding-agents
  - claude-code
  - codex
  - swe-bench
  - llm-benchmarks
sourceUrl: 'https://blog.niradler.com/claude-code-vs-codex-swe-bench-competition'
originalUrl: 'https://blog.niradler.com/claude-code-vs-codex-swe-bench-competition'
cover: /media/claude-code-vs-codex-swe-bench-competition/time-vs-cost.png
coverAlt: 'Scatter of wall-clock minutes against cost per run for nine runs: three Codex runs near 2 minutes and 6 to 10 cents, six Claude Code runs between 11 and 18 minutes and 2.45 to 4.68 dollars, with one hollow marker in each Claude group for the unresolved runs'
---
# I Told a Coding Agent It Was in a Competition: Claude Code vs Codex on a SWE-bench Task

In the [harness × model field guide](/harness-x-model-field-guide-coding-agents) I collected other people's benchmarks. This time I ran my own, small enough to read every log:

1. **Claude Code + Sonnet 5, told** it is competing against two other agents.
2. **Claude Code + Sonnet 5, not told.** Identical setup and prompt, minus the competition paragraph.
3. **Codex + GPT-6.1 Terra, told.**

All three got the same issue from SWE-bench Verified, at high reasoning effort, three runs each, nine runs in total.

## TL;DR

| | Claude Code, told | Claude Code, not told | Codex, told |
| --- | --- | --- | --- |
| Resolved (all hidden tests pass) | 2 of 3 | 2 of 3 | **3 of 3** |
| Wall-clock time, mean | 15.0 min | 12.1 min | **1.8 min** |
| Cost per run, mean | $3.46 | $2.56 | **$0.08** |
| Tool calls, mean | 124 | 94 | 17 |
| Output tokens, mean | 55.6K | 44.8K | 4.4K |
| Blind review, mean of two judges (1–10) | 6.3 | 4.2 | 6.7 |
| Runs that added tests | 2 of 3 | 1 of 3 | 0 of 3 |

- **Codex won on every axis I measured except tests.** It was 7–8× faster and 30–40× cheaper per run, and it resolved all three runs. It never added a test to the repository; it ran Django's existing tests and, in two runs, a throwaway script in `/tmp`.
- **Telling Claude it was a competition made it work harder, not better.** The told runs used 32% more tool calls, took 24% longer and cost 35% more. They resolved the same 2 of 3, wrote tests more often, and scored higher in review mostly because one not-told run shipped nothing.
- **Both models know this fix by heart.** Every patch that contained a fix (8 of 8) introduced a private helper named `_filter_prefetch_queryset`, the exact name Django's own 2022 fix uses. It does not exist anywhere in the starting code. Read every result here as "how fast does each agent reproduce a fix it has seen," not "how well does it design one."

![Scatter of wall-clock minutes against cost per run for the nine runs](/media/claude-code-vs-codex-swe-bench-competition/time-vs-cost.png)

## The task

[`django__django-15957`](https://code.djangoproject.com/ticket/26780) from SWE-bench Verified: *Prefetch objects don't work with slices.* `Prefetch('post_set', queryset=Post.objects.all()[:3])` raises `Cannot filter a query once a slice has been taken.` The upstream fix rewrites the sliced prefetch as a window function (`ROW_NUMBER() OVER (PARTITION BY …)`) and filters on the row number.

I picked it from SWE-bench Verified's 22 Django issues marked "1–4 hours" because:

- It runs without Docker: Django at the base commit, a Python 3.11 virtualenv, SQLite.
- The hidden tests give more than pass/fail: 4 tests the fix must make pass (`FAIL_TO_PASS`) and 89 that must keep passing (`PASS_TO_PASS`).
- It needs real design work across the ORM, not a one-line change.

Before running any agent I checked the scorer against two controls: the unfixed checkout scores 0/4 and 89/89, and the upstream fix scores 4/4 and 89/89.

## The setup

Every run got a fresh copy of Django at the base commit (`f387d02`, cloned with `--depth 1` so later commits were not in `.git`) and its own virtualenv. All three competitors in a round ran at the same time.

The prompt was the SWE-bench issue text plus:

> The repository in the current directory is Django. Resolve the issue above by changing non-test files. A Python virtualenv with this Django checkout installed in editable mode is at .venv. Run tests from the tests/ directory with: ../.venv/bin/python runtests.py \<test_module\>. Do not access the internet. Work autonomously until you consider the issue resolved; nobody is available to answer questions.

The two "told" competitors also got:

> This is a competition. Two other AI coding agents are working on this exact issue at the same time, each in its own copy of the repository. When all of you finish, your result will be scored against theirs on correctness (a hidden test suite), code quality (blind review), time taken, and token cost.

"Identical setup" took more work than expected, because both CLIs load your personal configuration by default:

| | Claude Code 2.1.280 | Codex CLI 0.167.0 |
| --- | --- | --- |
| Command | `claude -p --model sonnet --effort high --output-format stream-json` | `codex exec -m gpt-6.1-terra -c model_reasoning_effort=high --json` |
| My instructions, skills, hooks, plugins | Off: `--setting-sources project` | Off: a separate empty `HOME` and `CODEX_HOME` holding only the login file |
| MCP servers and app connectors | Off: `--strict-mcp-config` | Off: `-c features.apps=false` (otherwise about 240 ChatGPT app tools load, including GitHub fetch) |
| Web access | Off: `--disallowedTools WebFetch WebSearch` | Off: `-c web_search="disabled"` |
| Permissions | `--permission-mode bypassPermissions` | `--dangerously-bypass-approvals-and-sandbox` |
| Git identity | Neutral `racer` via `GIT_CONFIG_GLOBAL` | Same |

Claude Code's `--bare` mode would have been simpler, but it only accepts an API key, and this machine authenticates with a subscription login. I checked the isolation by asking each stripped agent to list every instruction, skill and hook it could see. Only built-in skills remained.

One gotcha: `codex exec` was killed with SIGKILL within 0.2 seconds whenever this issue text was passed as a command-line argument. Removing the zero-width characters did not help. Passing the same prompt on stdin (`codex exec -`) works.

## How each metric was measured

| Metric | Source |
| --- | --- |
| Correctness | SWE-bench's hidden tests, run after the agent finished. Test files touched by the hidden test patch are reset first, as the SWE-bench harness does. |
| Wall-clock time | The runner's own clock around the agent process, the same for both CLIs. Cross-checked with Claude Code's `duration_ms` and the first-to-last timestamps in Codex's session log. They agree within 7 seconds. |
| Tokens | Claude Code: the `usage` block of each `result` event in `--output-format stream-json`. Codex: the cumulative `token_count` events in its session log (`~/.codex/sessions/…/rollout-*.jsonl`). |
| Cost | Claude Code reports `total_cost_usd`. I recomputed one run from Anthropic's Sonnet 5 list price ($2 input, $4 one-hour cache write, $0.20 cache read, $10 output per million tokens) and got $2.519 against the reported $2.521. Codex: tokens × OpenAI's `gpt-6.1-terra` list price ($1 input, $0.05 cached input, $5 output per million; no request crossed the 272K long-context tier). |
| Quality | A blind review. The nine diffs were renamed A–I in random order and scored by two judges: Claude Opus 5.5 and GPT-6.1 Sol in Codex (read-only sandbox). Rubric: design, robustness, scope, readability, tests, and an overall 1–10. Judges saw the upstream fix as a reference, not as the only acceptable design. |

To answer the question that started this: yes, Claude Code's session file records timing. Every line of `~/.claude/projects/<dir>/<session>.jsonl` has a `timestamp`, and every assistant message carries its `usage`. The headless `result` event adds `duration_ms`, `num_turns` and `total_cost_usd`. Codex's rollout file has a timestamp on every line and a running token total, but no cost.

## Results

![Mean wall-clock time, cost per run and blind review score for each competitor, with individual runs as dots](/media/claude-code-vs-codex-swe-bench-competition/means-by-competitor.png)

| Run | Hidden tests (fail-to-pass, pass-to-pass) | Wall time | Tool calls | Output tokens | Cost | Opus 5.5 | GPT-6.1 Sol |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code, told, round 1 | 3/4, 89/89 | 15m 16s | 112 | 57.4K | $3.25 | 6 | 7 |
| Claude Code, told, round 2 | **4/4, 89/89** | 11m 48s | 110 | 39.1K | $2.45 | 7 | 7 |
| Claude Code, told, round 3 | **4/4, 89/89** | 17m 57s | 151 | 70.4K | $4.68 | 5 | 6 |
| Claude Code, not told, round 1 | **4/4, 89/89** | 10m 42s | 101 | 40.6K | $2.52 | 8 | 8 |
| Claude Code, not told, round 2 | **4/4, 89/89** | 13m 50s | 85 | 53.5K | $2.64 | 3 | 4 |
| Claude Code, not told, round 3 | 0/4, 89/89 (empty diff) | 11m 53s | 95 | 40.4K | $2.52 | 1 | 1 |
| Codex, told, round 1 | **4/4, 89/89** | 1m 52s | 17 | 4.4K | $0.10 | 6 | 7 |
| Codex, told, round 2 | **4/4, 89/89** | 1m 48s | 14 | 4.4K | $0.06 | 6 | 7 |
| Codex, told, round 3 | **4/4, 89/89** | 1m 47s | 20 | 4.2K | $0.09 | 7 | 7 |

Claude Code's cost is mostly cache reads: 8–16 million cached input tokens per run, because each of its ~100 turns resends the growing conversation. Codex finished in 14–20 commands, so its whole run was 300–470K input tokens.

### Did "it's a competition" change anything?

For Claude Code, it changed effort more than outcome:

| Claude Code + Sonnet 5 | Told | Not told | Difference |
| --- | --- | --- | --- |
| Resolved | 2 of 3 | 2 of 3 | none |
| Wall time, mean | 15.0 min | 12.1 min | +24% |
| Tool calls, mean | 124 | 94 | +32% |
| Cost, mean | $3.46 | $2.56 | +35% |
| Runs that added tests | 2 of 3 | 1 of 3 | |
| Runs that updated docs and release notes | 3 of 3 | 1 of 3 | |
| Review, mean of runs that shipped a fix | 6.3 | 5.8 | +0.5 |

The told runs were more thorough: more test runs, more tests written, documentation updated every time. The review score barely moved once the empty run is set aside. Three runs per variant is too few to call any of this significant; the spread inside each variant (told: 11.8 to 18.0 minutes) is as large as the gap between them.

All three Codex runs were told, so this experiment does not show whether the framing changes Codex.

### How the failed runs failed

- **Claude Code, told, round 1** handled forward and reverse relations but got `.reverse()` combined with a slice wrong: `[Emily, Anne]` where the hidden test expects `[Anne, Charlotte]`.
- **Claude Code, not told, round 3** shipped an empty diff. Near the end it ran `git stash` to compare the full test suite with and without its change, started that run in the background, and scheduled a wake-up for 600 seconds later with `ScheduleWakeup`. In headless `-p` mode the session ended there, so `git stash pop` never ran and the fix stayed in `stash@{0}`. Scoring the stashed version separately makes no difference: it errors on all 4 hidden tests.

The second failure is a harness failure as much as a model failure: Claude Code offers background tasks and wake-ups even in headless mode, where nothing comes back to wake the session.

### What the reviewers said

Both judges ranked the patches almost identically. GPT-6.1 Sol scored about half a point higher across the board, including on Claude's patches, so I don't read its higher Codex scores as self-preference.

- The best single patch was Claude Code not told, round 1 (8 from both judges): upstream-style helper, an explicit `NotSupportedError` for databases without window functions, `GenericRelation` support, and focused tests.
- Codex's three patches were consistent (6–7): focused and readable, docs and release notes updated every time, and no tests.
- The weakest shipped patch was Claude Code not told, round 2 (3 and 4): it still hits the original error on databases without window functions and checks for slicing through `low_mark`/`high_mark` instead of `is_sliced`.

## The benchmark is memorized

`_filter_prefetch_queryset` is a private helper the upstream fix introduced in August 2022. `grep` finds no trace of it in the base checkout. Every patch with a fix in it, from both vendors, adds a function with exactly that name, and every one rebuilds the same `RowNumber` window with `GreaterThan` and `LessThanOrEqual` filters.

That fits with Codex solving a "1–4 hours" issue in under two minutes, with about 500 reasoning tokens. Claude Code knew the answer too; it spent its extra ten minutes exploring and testing around it.

SWE-bench Verified is public, and its fixes are on GitHub. Scores on it now measure recall as much as problem solving, for every vendor. That doesn't make this comparison useless: both agents had the same head start, and the time, cost and thoroughness differences are real. But a model's SWE-bench number is not evidence that it can fix *your* bug.

## Behavior worth knowing about

The runs' command logs showed two things the scores don't:

- **Claude Code looked outside its folder.** Two not-told runs searched the whole disk (`find / -iname "*django*"`) for other Django installs, and one opened what it found in my `uv` cache. It held only install metadata for the same checkout, so nothing leaked, but on a machine with other projects that is a real exposure.
- **Claude Code ignored "do not access the internet" once.** Told, round 2 tried `pip install tblib` three times. All three attempts failed because the virtualenv has no `pip`.
- **Codex stayed in its folder.** No run touched anything outside its repository except a scratch script in `/tmp`.

## Caveats

- **Three runs per competitor, one task.** Directional, not statistically significant.
- **The task is memorized** by both model families, as shown above.
- **Only Codex "told."** There is no not-told Codex arm, so I can't say how the framing affects GPT-6.1 Terra.
- **Different model tiers.** Sonnet 5 lists at $2/$10 per million input/output tokens and GPT-6.1 Terra at $1/$5. The cost gap is mostly turns and tokens, not price: Codex processed 20–30× fewer tokens.
- **Claude Code also called Haiku 4.5** for small housekeeping requests. Its cost is included in `total_cost_usd` and is negligible.
- **Judges are models.** Each judge reviewed both vendors' work, and they agreed on the ranking, but neither is a human Django maintainer.
- **Prices are list prices** as of November 16, 2026. A subscription changes what you actually pay.

## Reproduce it

Everything is in [`experiments/agent-race`](https://github.com/niradler/writing/tree/main/experiments/agent-race): the runner, the scorer, the metrics collector, the judge packet and both judges' raw scores, and each run's prompt, diff, hidden-test log and full agent event stream. The README there lists the setup steps.
