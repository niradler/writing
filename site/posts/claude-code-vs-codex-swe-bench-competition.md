---
title: 'I Told Coding Agents They Were in a Competition: Claude Code vs Codex on Real Django Bugs'
description: 'Two rounds, 33 runs. Claude Code with Sonnet 5 and Codex with GPT-6.1 Terra, each told or not told they were competing, on one memorized SWE-bench task and three Django bugs fixed after both models were trained. Hidden tests, blind review, wall time and cost from the session logs.'
publishedAt: '2026-11-16T12:00:00.000Z'
updatedAt: '2026-11-16T18:00:00.000Z'
tags:
  - ai-coding-agents
  - claude-code
  - codex
  - swe-bench
  - llm-benchmarks
sourceUrl: 'https://blog.niradler.com/claude-code-vs-codex-swe-bench-competition'
originalUrl: 'https://blog.niradler.com/claude-code-vs-codex-swe-bench-competition'
cover: /media/claude-code-vs-codex-swe-bench-competition/fresh-time-vs-cost.png
coverAlt: 'Scatter of wall-clock minutes against cost per run for 24 runs on three fresh Django tickets: eight Codex runs clustered near 1 minute and 3 to 6 cents, sixteen Claude Code runs spread from 2 to 13 minutes and 32 cents to 1.62 dollars'
---
# I Told Coding Agents They Were in a Competition: Claude Code vs Codex on Real Django Bugs

In the [harness × model field guide](/harness-x-model-field-guide-coding-agents) I collected other people's benchmarks. This time I wanted my own numbers, from runs small enough that I could read every log.

The question was simple: if you tell a coding agent it is competing against other agents, does it do better work? And while it's at it, how do Claude Code and Codex compare on the same bug, with the same instructions, at the same reasoning effort?

I ran it twice. The first round used a well-known SWE-bench task, and it turned out both models already knew the answer. The second round used three Django bugs that were fixed after both models finished training, so nobody could have memorized them.

## What I found

- **Codex is much faster and much cheaper, and on fresh bugs it was also more correct.** It finished in about 1.2 minutes for about 4 cents a run. Claude Code took 5.6 to 6.5 minutes on average and cost about 90 cents. On the three fresh tickets, Codex passed 86% of the hidden tests the issues describe; Claude Code passed 50%.
- **Claude Code writes tests, Codex doesn't.** Claude added tests to the repository in 9 of 12 fresh runs. Codex added tests in 0 of 12. The blind reviewers scored the two about the same overall (6.3 and 5.9 out of 10).
- **"It's a competition" did not change anything I could measure.** In round one it made Claude slower and more expensive. In round two it made no difference to time or cost for either agent. Pass rates moved by one run in either direction, which is noise at this sample size.
- **SWE-bench answers are memorized.** On the SWE-bench task, 55 to 85% of the upstream fix's lines appeared word for word in each agent's patch. On the fresh tickets it was 0 to 15%.

![Time against cost for the 24 runs on fresh Django tickets](/media/claude-code-vs-codex-swe-bench-competition/fresh-time-vs-cost.png)

## Round one: a SWE-bench task both models had memorized

I started with [`django__django-15957`](https://code.djangoproject.com/ticket/26780) from SWE-bench Verified: *Prefetch objects don't work with slices.* Three competitors, three runs each:

| | Claude Code, told | Claude Code, not told | Codex, told |
| --- | --- | --- | --- |
| Resolved (all hidden tests pass) | 2 of 3 | 2 of 3 | **3 of 3** |
| Wall-clock time, mean | 15.0 min | 12.1 min | **1.8 min** |
| Cost per run, mean | $3.46 | $2.56 | **$0.08** |
| Tool calls, mean | 124 | 94 | 17 |
| Blind review, mean (1–10) | 6.3 | 4.2 | 6.7 |

![Time against cost for the nine round-one runs on django__django-15957](/media/claude-code-vs-codex-swe-bench-competition/time-vs-cost.png)

Codex solved a task SWE-bench rates "1–4 hours" in under two minutes, using about 500 reasoning tokens. That was the first hint something was off.

The second hint was a name. Every patch that contained a fix, 8 of 8 from both vendors, added a private helper called `_filter_prefetch_queryset`. That is the exact name Django's own fix introduced in August 2022, and it does not appear anywhere in the starting code. Counting lines makes it plainer: 55 to 85% of the upstream fix's added lines appear verbatim in each patch.

So round one measured how fast each agent reproduces a fix it has already seen. The speed and cost gap is still real, but the correctness and design scores say little about bugs the models haven't seen. SWE-bench Verified is public and its fixes are on GitHub, so this affects every vendor's score on it.

## Round two: three bugs nobody could have memorized

Sonnet 5's training data ends in January 2026 and GPT-6.1 Terra's in June 2026. I took three Django tickets fixed between late August and early November 2026, months after both cutoffs, and rebuilt each one in the SWE-bench format: the commit before the fix is the starting point, and the tests from the fix are the hidden tests.

| Ticket | What's broken | Fixed upstream | Hidden tests |
| --- | --- | --- | --- |
| [#37330](https://code.djangoproject.com/ticket/37330) | `values("published__year")` on an `ExpressionWrapper` annotation crashes with `AttributeError` | Nov 5, 2026 | 5 |
| [#37361](https://code.djangoproject.com/ticket/37361) | Permission renames fail for a chain of `RenameModel` operations (A → B → C) | Oct 2, 2026 | 3 |
| [#37263](https://code.djangoproject.com/ticket/37263) | Admin search crashes (HTTP 500) on `__exact` fields with choices, and over-matches on booleans | Aug 31, 2026 | 6 |

This time I added a fourth competitor, Codex not told, so the competition effect could be measured for both agents. That's four competitors × three tickets × two runs, 24 runs in total, for $11.53.

One more adjustment. SWE-bench Verified exists because human annotators found that many original SWE-bench tests check things the issue never mentions. These fresh tickets haven't had that review, so I asked a separate model to read each issue next to each hidden test and mark whether the issue specifies the tested behavior. It marked 4 of the 14 tests as unspecified. One of them asks how the literal search term `None` should behave on a boolean field, which the issue never discusses. All 24 runs failed at least one hidden test, so the headline numbers below count only the 10 specified tests. The strict numbers are in the results file.

## Results on the fresh tickets

| | Claude Code, told | Claude Code, not told | Codex, told | Codex, not told |
| --- | --- | --- | --- | --- |
| Runs that pass every specified test | 3 of 6 | 2 of 6 | 3 of 6 | **4 of 6** |
| Specified hidden tests passed | 56% | 44% | 83% | **89%** |
| Wall-clock time, mean | 5.6 min | 6.5 min | **1.2 min** | **1.2 min** |
| Cost per run, mean | $0.91 | $0.92 | **$0.04** | **$0.04** |
| Tool calls, mean | 41 | 40 | 12 | 12 |
| Output tokens, mean | 21.1K | 22.3K | 2.5K | 2.5K |
| Runs that added tests | 4 of 6 | 5 of 6 | 0 of 6 | 0 of 6 |
| Blind review, mean (1–10) | 6.0 | 6.5 | 6.0 | 5.8 |

The averages hide that each ticket told a different story:

![Share of specified hidden tests passed, per ticket and competitor](/media/claude-code-vs-codex-swe-bench-competition/fresh-tests-by-ticket.png)

**Admin search (#37263) was a tie.** All eight runs passed every specified test, and all eight failed the same unspecified one, the `None` search term.

**Chained permission renames (#37361) split cleanly by vendor.** All four Claude runs failed all three hidden tests. They applied the chain step by step but left the intermediate `*_newmodel` permissions behind. All four Codex runs passed two of three. They collapsed the chain correctly but lost a permission when two content types share a codename. Nobody solved it fully. The upstream fix collapses the chain and handles that case.

**Annotation transforms (#37330) went to Codex.** Both Codex not-told runs passed all three specified tests. Claude did that in one run of four. The other three Claude runs fixed the crash from the issue but failed the two cases next to it: the error message for an unsupported transform, and a transform on an annotation of a related field.

Codex runs were also remarkably consistent: every one finished in 1.0 to 1.5 minutes. Claude ranged from 2.1 to 13.0 minutes, mostly depending on how much of Django's test suite it decided to run.

### Does "it's a competition" change anything?

| | Round one (Claude only) | Round two, Claude | Round two, Codex |
| --- | --- | --- | --- |
| Pass rate, told vs not told | 2 vs 2 of 3 | 3 vs 2 of 6 | 3 vs 4 of 6 |
| Time, told vs not told | 15.0 vs 12.1 min | 5.6 vs 6.5 min | 1.2 vs 1.2 min |
| Cost, told vs not told | $3.46 vs $2.56 | $0.91 vs $0.92 | $0.04 vs $0.04 |

In round one, telling Claude it was competing bought 32% more tool calls and 35% more cost. In round two that effect disappeared, and the pass rates moved by one run in opposite directions for the two agents. I don't see a framing effect worth acting on. If you want a more thorough agent, say what thorough means (run the full suite, add tests, update docs) instead of telling it a story.

## What the logs showed

The scores don't capture how each agent behaves, but the command logs do.

- **Claude Code explores and verifies, and Codex goes straight to the fix.** Claude made about 40 tool calls per fresh run. It typically wrote a reproduction script, checked out the original code with `git stash` to confirm the failure, fixed the code, wrote tests, then ran large parts of Django's suite. Codex made about 12 calls: read the relevant files, edit, run the module's tests, stop.
- **Most of Claude's cost is resent context.** Each Claude run read about 2.4 million cached input tokens, because every turn resends the growing conversation. A Codex run used about 220 thousand input tokens in total.
- **Claude Code's background tasks and wake-ups are a hazard in headless mode.** In round one, one run stashed its finished fix, started the full test suite in the background, scheduled a wake-up for ten minutes later and ended. Nothing woke it, so `git stash pop` never ran and the run scored zero. In round two, two runs scheduled wake-ups again (one of them six times); this time both restored their work before exiting.
- **Claude looked outside its folder in round one, not in round two.** In round one, two runs searched the whole disk for other Django installs, and one tried `pip install` despite "do not access the internet." Across the 12 fresh Claude runs I found neither. Codex never touched anything outside its repository except scratch scripts in `/tmp`, in any of its 15 runs.

## Scoring traps I hit

Building a fair scorer took more work than running the agents, and I got it wrong at first.

- **An agent's own tests can break the hidden tests.** On the permission ticket, three Claude runs added a test migration named `0003_…`. The hidden tests add a different `0003_…` migration in the same folder, so Django refused to run with `Conflicting migrations detected`, and five existing tests failed with it. The SWE-bench harness would hit the same collision. Since the prompt asked for changes to non-test files, I re-scored all 24 runs with the agents' test edits removed. That cleared the five broken tests. Claude's fix still failed all three hidden tests on its own merits.
- **`git diff HEAD` skips new files.** My scorer captured each patch with `git diff`, which leaves out untracked files, so those three test migrations were missing from the patches the judges saw. Both judges then marked the tests down for "pointing at a migration the patch never adds." I added the files and ran both judges again on that ticket. Those runs' tests scores rose from 4–5 to 6–7 out of 10.
- **The first session died mid-round.** The session that started round two was killed during the last batch, taking two in-flight Claude runs with it. I discarded them and ran both again from a fresh checkout. The reruns ran as a pair, without the two Codex runs that originally ran beside them.

## Caveats

- **Small sample.** Two runs per competitor per ticket and three tickets. The differences between agents are large and consistent. The told vs not told differences are not.
- **Three tickets from one project.** Django has an unusually large and well-organized test suite, which suits an agent that runs tests often.
- **A model judged the specified tests, and models judged quality.** Each judge reviewed both vendors' patches and the two agreed closely, but no Django maintainer reviewed them.
- **Different price tiers.** Sonnet 5 lists at $2/$10 per million input/output tokens and GPT-6.1 Terra at $1/$5. Most of the cost gap comes from Claude using about 11 times more tokens, not from the price.
- **Prices are list prices** as of November 16, 2026. A subscription changes what you actually pay.

## How it was measured

Each run got a fresh copy of Django at the ticket's base commit and its own virtualenv. All competitors on a ticket ran at the same time. The prompt was the issue text plus:

> The repository in the current directory is Django. Resolve the issue above by changing non-test files. A Python virtualenv with this Django checkout installed in editable mode is at .venv. Run tests from the tests/ directory with: ../.venv/bin/python runtests.py \<test_module\>. Do not access the internet. Work autonomously until you consider the issue resolved; nobody is available to answer questions.

Told competitors also got a paragraph saying other AI coding agents were working on the same issue and that they would be scored against each other on correctness (a hidden test suite), code quality (blind review), time and token cost.

Both CLIs load your personal configuration by default, so I stripped it:

| | Claude Code 2.1.280 | Codex CLI 0.167.0 |
| --- | --- | --- |
| Command | `claude -p --model sonnet --effort high --output-format stream-json` | `codex exec -m gpt-6.1-terra -c model_reasoning_effort=high --json` |
| My instructions, skills, hooks, plugins | Off: `--setting-sources project` | Off: a separate empty `HOME` and `CODEX_HOME` holding only the login file |
| MCP servers and app connectors | Off: `--strict-mcp-config` | Off: `-c features.apps=false` (otherwise about 240 ChatGPT app tools load) |
| Web access | Off: `--disallowedTools WebFetch WebSearch` | Off: `-c web_search="disabled"` |
| Permissions | `--permission-mode bypassPermissions` | `--dangerously-bypass-approvals-and-sandbox` |

One gotcha: `codex exec` was killed with SIGKILL within 0.2 seconds when the round-one issue text was passed as a command-line argument. Passing the same prompt on stdin (`codex exec -`) works.

| Metric | Source |
| --- | --- |
| Correctness | The fix commit's tests, run after the agent finished. Before any agent ran, every unfixed checkout scored 0 on them and every upstream fix passed all of them. |
| Wall-clock time | The runner's clock around the agent process, cross-checked with Claude Code's `duration_ms` and the timestamps in Codex's session log. |
| Tokens and cost | Claude Code: the `usage` block and `total_cost_usd` from its `result` event. Codex: the `token_count` events in its session log, times OpenAI's list price. |
| Quality | Patches renamed to letters in random order and scored by Claude Opus 5.5 and by GPT-6.1 Sol in Codex (read-only sandbox) on design, robustness, scope, readability, tests, and an overall 1–10. The upstream fix was shown as a reference, not as the only acceptable design. |

To answer the question that started this: Claude Code's session file does record timing. Every line of `~/.claude/projects/<dir>/<session>.jsonl` has a `timestamp` and every assistant message carries its `usage`. Codex's rollout file has a timestamp on every line and a running token total, but no cost.

## Reproduce it

Both rounds are in the repository, each with its runner, scorer, collector, judge packets, both judges' raw scores, and every run's prompt, diff, hidden-test log and full agent event stream:

- Round one: [`experiments/agent-race`](https://github.com/niradler/writing/tree/main/experiments/agent-race)
- Round two: [`experiments/agent-race-fresh`](https://github.com/niradler/writing/tree/main/experiments/agent-race-fresh)
