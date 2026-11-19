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

In the [harness × model field guide](/harness-x-model-field-guide-coding-agents) I collected other people's benchmarks. This time I ran my own, small enough to read every log. I wanted to know two things: whether telling a coding agent it is competing changes its work, and how Claude Code and Codex compare on the same bug with the same instructions at high reasoning effort.

To test the first question, some runs got one extra paragraph in the prompt saying other AI agents were working on the same issue and that everyone would be scored against each other. I call those runs "told" and the rest "not told." Correctness comes from hidden tests: the tests from Django's own fix, which the agent never sees. Quality comes from a blind review: two models scoring the patches with the agent's name removed.

I ran it twice. The first round used a well-known SWE-bench task, and it turned out both models already knew the answer. The second round used three Django bugs that were fixed after both models finished training, so nobody could have memorized them.

## On fresh bugs, Codex passed 35 of 40 specified tests at 4 cents a run, Claude Code 22 of 40 at about 90 cents

- On the three fresh tickets, Codex finished in about 1.2 minutes for about 4 cents a run and passed 35 of 40 (88%) of the hidden tests the issues specify. Claude Code took 5.6 to 6.5 minutes on average, cost about 90 cents and passed 22 of 40 (55%).
- Claude Code usually writes tests: it added them to the repository in 9 of 12 fresh runs. Codex added tests in 0 of 12. Even so, the blind review scored the two about the same overall (6.3 and 5.9 out of 10).
- Telling an agent it was competing had no consistent effect. In round one, told Claude runs took 24% longer and cost 35% more. In round two, cost was flat for both agents, told Claude runs were 14% faster (the reverse of round one), and pass rates moved by one run in opposite directions.
- The SWE-bench task's answer was memorized. On that task, 55 to 85% of the upstream fix's lines appeared word for word in each agent's patch. On the fresh tickets it was 0 to 15%.

![Time against cost for the 24 runs on fresh Django tickets](/media/claude-code-vs-codex-swe-bench-competition/fresh-time-vs-cost.png)

## Round one: a SWE-bench task both models had memorized

I started with the SWE-bench Verified task `django__django-15957` ([Django ticket #26780](https://code.djangoproject.com/ticket/26780)): *Prefetch objects don't work with slices.* Three competitors, three runs each:

| | Claude Code, told | Claude Code, not told | Codex, told |
| --- | --- | --- | --- |
| Runs that pass every hidden test | 2 of 3 | 2 of 3 | **3 of 3** |
| Wall-clock time, mean | 15.0 min | 12.1 min | **1.8 min** |
| Cost per run, mean | $3.46 | $2.56 | **$0.08** |
| Tool calls, mean | 124 | 94 | 17 |
| Blind review, mean (1–10) | 6.3 | 4.2 | 6.7 |

![Time against cost for the nine round-one runs on django__django-15957](/media/claude-code-vs-codex-swe-bench-competition/time-vs-cost.png)

The first hint of memorization: Codex solved a task SWE-bench rates "1–4 hours" in under two minutes, using about 500 reasoning tokens.

The second hint was a name. Every patch that contained a fix, 8 of 8 from both vendors, added a private helper called `_filter_prefetch_queryset`. That is the exact name Django's own fix introduced in August 2022, and it does not appear anywhere in the starting code. Counting lines makes it plainer: 55 to 85% of the upstream fix's added lines appear word for word in each patch.

So round one measured how fast each agent reproduces a fix it has already seen. The speed and cost gap is still real, but the correctness and design scores say little about bugs the models haven't seen. SWE-bench Verified is public and its fixes are on GitHub, so other tasks in it may be memorized too. I tested only this one.

## Round two: three bugs nobody could have memorized

Sonnet 5's training data ends in January 2026 and GPT-6.1 Terra's in June 2026. I took three Django tickets fixed between late August and early November 2026, months after both cutoffs, and rebuilt each one in the SWE-bench format: the commit before the fix is the starting point, and the tests from the fix are the hidden tests.

| Ticket | What's broken | Fixed upstream | Hidden tests (specified) |
| --- | --- | --- | --- |
| [#37330](https://code.djangoproject.com/ticket/37330) | `values("published__year")` on an `ExpressionWrapper` annotation crashes with `AttributeError` | Nov 5, 2026 | 5 (3) |
| [#37361](https://code.djangoproject.com/ticket/37361) | Permission renames fail for a chain of `RenameModel` operations (A → B → C) | Oct 2, 2026 | 3 (3) |
| [#37263](https://code.djangoproject.com/ticket/37263) | Admin search crashes (HTTP 500) on `__exact` fields with choices, and over-matches on booleans | Aug 31, 2026 | 6 (4) |

This time I added a fourth competitor, Codex not told, so the competition effect could be measured for both agents. That's four competitors × three tickets × two runs, 24 runs in total, for $11.53.

One more adjustment. SWE-bench Verified exists because human annotators found that many original SWE-bench tests check things the issue never mentions. These fresh tickets haven't had that review, so I asked a separate model to read each issue next to each hidden test and mark whether the issue specifies the tested behavior. It marked 4 of the 14 tests as unspecified. One of them asks how the literal search term `None` should behave on a boolean field, which the issue never discusses. The numbers below count only the 10 specified tests. Counting all 14, no run passed every test.

## Codex won two tickets, and admin search was a tie

| | Claude Code, told | Claude Code, not told | Codex, told | Codex, not told |
| --- | --- | --- | --- | --- |
| Runs that pass every specified test | 3 of 6 | 2 of 6 | 3 of 6 | **4 of 6** |
| Specified hidden tests passed (of 20) | 12 | 10 | 17 | **18** |
| Wall-clock time, mean | 5.6 min | 6.5 min | **1.2 min** | **1.2 min** |
| Cost per run, mean | $0.91 | $0.92 | **$0.04** | **$0.04** |
| Tool calls, mean | 41 | 40 | 12 | 12 |
| Output tokens, mean | 21.1K | 22.3K | 2.5K | 2.5K |
| Runs that added tests | 4 of 6 | 5 of 6 | 0 of 6 | 0 of 6 |
| Blind review, mean (1–10) | 6.0 | 6.5 | 6.0 | 5.8 |

![Share of specified hidden tests passed, per ticket and competitor](/media/claude-code-vs-codex-swe-bench-competition/fresh-tests-by-ticket.png)

All eight admin-search (#37263) runs passed every specified test, and all eight failed the same unspecified one, the `None` search term.

Chained permission renames (#37361) split cleanly by vendor. All four Claude runs failed all three tests. They applied the chain step by step but left the intermediate `*_newmodel` permissions behind. All four Codex runs passed two of three. They collapsed the chain correctly but lost a permission when two content types share a codename. Nobody solved it fully. The upstream fix collapses the chain and handles that case.

Annotation transforms (#37330) went to Codex. Both Codex not-told runs passed all three specified tests, and so did one of the two Codex told runs. Claude did that in one run of four. The other three Claude runs fixed the crash from the issue but failed the two cases next to it: the error message for an unsupported transform, and a transform on an annotation of a related field.

Codex runs were also consistent: every one finished in 1.0 to 1.5 minutes. Claude ranged from 2.1 to 13.0 minutes, mostly depending on how much of Django's test suite it decided to run.

### The competition framing had no consistent effect

| | Round one (Claude only) | Round two, Claude | Round two, Codex |
| --- | --- | --- | --- |
| Runs that pass every (specified) test, told vs not told | 2 vs 2 of 3 | 3 vs 2 of 6 | 3 vs 4 of 6 |
| Time, told vs not told | 15.0 vs 12.1 min | 5.6 vs 6.5 min | 1.2 vs 1.2 min |
| Cost, told vs not told | $3.46 vs $2.56 | $0.91 vs $0.92 | $0.04 vs $0.04 |
| Blind review, told vs not told | 6.3 vs 4.2 | 6.0 vs 6.5 | 6.0 vs 5.8 |

In round one, told Claude runs took 24% longer, made 32% more tool calls and cost 35% more. In round two, told Claude runs were 14% faster at the same cost, Codex's time and cost did not move, and pass rates moved by one run in opposite directions for the two agents.

## Claude explores and verifies, Codex goes straight to the fix

In the command logs, Claude made about 40 tool calls per fresh run. It typically wrote a reproduction script, checked out the original code with `git stash` to confirm the failure, fixed the code, wrote tests, then ran large parts of Django's suite. Codex made about 12 calls: read the relevant files, edit, run the module's tests, stop.

Most of Claude's cost is resent context. Each Claude run read about 2.4 million cached input tokens, because every turn resends the growing conversation. A Codex run used about 220 thousand input tokens in total.

Claude's habit of running long test suites in the background is a hazard in headless mode. In round one, one run stashed its finished fix, started the full test suite in the background, scheduled a wake-up for ten minutes later and ended. Nothing woke it, so `git stash pop` never ran and the run scored zero. In round two, two runs scheduled wake-ups again (one of them six times); this time both restored their work before exiting.

The same urge to explore took Claude outside its repository in round one: two runs searched the whole disk for other Django installs, and one tried `pip install` despite "do not access the internet." None of the 12 fresh Claude runs did either. Codex never touched anything outside its repository except scratch scripts in `/tmp`, in any of its 15 runs.

## Scoring traps I hit

Building a fair scorer took more work than running the agents, and I got it wrong at first.

- An agent's own tests can break the hidden tests. On the permission ticket, three Claude runs added a test migration named `0003_…`. The hidden tests add a different `0003_…` migration in the same folder, so Django refused to run with `Conflicting migrations detected`, and five existing tests failed with it. The SWE-bench harness would hit the same collision. Since the prompt asked for changes to non-test files, I re-scored all 24 runs with the agents' test edits removed. That cleared the five broken tests. Claude's fix still failed all three hidden tests on its own merits.
- `git diff HEAD` skips new files. My scorer captured each patch with `git diff`, which leaves out untracked files, so those three test migrations were missing from the patches the judges saw. Both judges then marked the tests down for "pointing at a migration the patch never adds." I added the files and ran both judges again on that ticket. Those runs' tests scores rose from 4–5 to 6–7 out of 10.
- My own session died mid-round. The Claude Code session I used to run round two was killed during the last batch, taking two in-flight Claude runs with it. I discarded them and ran both again from a fresh checkout. The reruns ran as a pair, without the two Codex runs that originally ran beside them.

## What this experiment can't tell you

- Small sample: two runs per competitor per ticket and three tickets. The time and cost gap between agents held on every ticket, and the correctness gap on two of three. The told vs not told differences are one run either way.
- One project: Django has an unusually large and well-organized test suite, which suits an agent that runs tests often.
- Model judges: a model decided which tests are specified, and models judged quality. Each judge reviewed both vendors' patches and their overall scores differed by 0.4 points on average and never by more than 1, but no Django maintainer reviewed them.
- Price tiers: Sonnet 5 lists at $2/$10 per million input/output tokens and GPT-6.1 Terra at $1/$5. Price explains a factor of 2 in the cost gap; Claude using about 11 times more tokens explains the rest.
- List prices: as of November 16, 2026. A subscription changes what you actually pay.

## How it was measured

Each run got a fresh copy of Django at the ticket's base commit and its own virtualenv. All competitors on a ticket ran at the same time. The prompt was the issue text plus:

> The repository in the current directory is Django. Resolve the issue above by changing non-test files. A Python virtualenv with this Django checkout installed in editable mode is at .venv. Run tests from the tests/ directory with: ../.venv/bin/python runtests.py \<test_module\>. Do not access the internet. Work autonomously until you consider the issue resolved; nobody is available to answer questions.

Told runs added a paragraph naming the scoring criteria: correctness (a hidden test suite), code quality (blind review), time and token cost.

Both CLIs load your personal configuration by default. I turned off instructions, skills, hooks, plugins, MCP servers, app connectors and web search for both, and ran both with permission prompts disabled.

Both CLIs' session files record timing: every line of Claude Code's `~/.claude/projects/<dir>/<session>.jsonl` and of Codex's rollout file has a `timestamp`. Claude's also carries per-message `usage`; Codex's has a running token total and no cost.
