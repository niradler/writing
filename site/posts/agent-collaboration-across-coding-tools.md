---
title: 'Agent Collaboration Across Coding Tools: The Agents Were Fine, the Plumbing Failed'
description: 'Why coding agents from different tools should work on one task, how they can talk to each other (same tool, files and a loop, or a hub like ORC), and what broke the night Claude Code and the Cursor agent CLI, two subscriptions and two models, ran one training job through a folder of markdown files.'
publishedAt: '2026-11-24T12:00:00.000Z'
updatedAt: '2026-11-24T12:00:00.000Z'
tags:
  - ai-agents
  - coding-agents
  - multi-agent
  - llm
  - orc
sourceUrl: 'https://blog.niradler.com/agent-collaboration-across-coding-tools'
originalUrl: 'https://blog.niradler.com/agent-collaboration-across-coding-tools'
---
# Agent Collaboration Across Coding Tools: The Agents Were Fine, the Plumbing Failed

I pay for two coding-agent subscriptions: Claude Code and Cursor. Most days they sit side by side and never talk. For an overnight training run (60 RL steps, checks at fixed steps, a $2,000 budget) I wanted both working on the same job, each with a different model: Claude as the supervisor that plans, reviews and approves spend, and the Cursor agent CLI running Gemini 4 Neon as the executor that does the hands-on work.

So at 23:40 UTC on 2026-11-23 Claude wrote a brief, handed the execution to Cursor, and stayed on as supervisor. For eight hours two agents from two vendors, on two models and two subscriptions, ran one job together. They talked through a folder of markdown files and a bash loop. This post is about that collaboration: why you would want it, how agents from different tools can talk at all, what worked, what broke, and what a hub changes.

## Why make agents collaborate

| Reason | Example from that night |
|---|---|
| **Use every subscription you pay for** | the grind ran on the Cursor plan; Claude's plan was spent only on supervision |
| **Different models for different jobs** | Claude planned, reviewed and approved; Gemini did the grind: fetch logs, count, read transcripts, submit jobs |
| **No single point of quota** | when one plan runs low, the other keeps the job moving |
| **Second opinions** | gates were reviewed by a fresh-context model before spending money |
| **Supervision is cheaper than doing** | the supervisor read only questions and alerts, not every report |

The catch: collaboration inside one tool is a solved problem. Across tools, nothing is built in.

## How agents can talk to each other

Every channel has to answer the same five questions: what a message is, how it gets delivered, how a reply comes back, how a question pauses the work, and how you know the other agent is alive.

| | Same tool | Different tools, no hub | Different tools, through a hub |
|---|---|---|---|
| **Example** | Claude Code side sessions | Claude ↔ Cursor through repo files | Claude, Codex, Gemini, Cursor on [ORC](https://github.com/niradler/orc) |
| **A message is** | a message to a session id | an entry appended to a markdown file | a row in a shared inbox |
| **Delivery** | the tool injects it into the session | the other agent reads the file on its next run | hook mid-turn, next turn, or by resuming the session |
| **Reply** | the parent is woken when the child finishes | another file, plus an `ack:` line | the child's result is queued back to the parent |
| **Pause on a question** | built in | a `WAITING` file the loop respects | a human request; the flow waits |
| **Liveness** | built in | whatever you build | dead-process detection and retry |

The same-tool column is free. The middle column is what you build by hand when you have nothing else. The right column is a hub.

![Left: Claude Code and the Cursor agent CLI talk only through files in the repo and a bash loop. Right: Claude Code, Gemini CLI, Codex and Cursor agent CLI all connect to an ORC hub; Cursor gets start and result only](/media/agent-collaboration-across-coding-tools/with-and-without-a-hub.svg)

## The night with no hub: files and a loop

![Animated: the driver starts the executor, the executor appends a REPORT, then a QUESTION lights the WAITING flag and the driver pauses until the supervisor answers and clears it](/media/agent-collaboration-across-coding-tools/protocol-loop.svg)

| Piece | What it was | Why |
|---|---|---|
| **Brief** | `HANDOFF.md`: goal, hard rules (budget, no GPT models, evidence for every number), tools, ordered steps | the executor starts every run with no memory |
| **Driver** | a bash loop: one `cursor-agent -p` run per iteration, 1 h timeout, 10 min sleep; stops when line 1 of `STATUS.md` says `BLOCKED` or `DONE` | one step per run keeps each run short and reviewable |
| **Executor → supervisor** | `to_claude.md`, append-only entries typed `REPORT`, `QUESTION`, `BLOCKED`, `DONE` | typed headers let the supervisor watch only what needs it |
| **Supervisor → executor** | `to_cursor.md`, entries typed `GUIDE` or `ANSWER`, overriding the brief; the executor replies `ack: <time>` | the ack proves which instructions were read |
| **Pause** | a QUESTION creates `WAITING`; the loop starts nothing until the supervisor answers and deletes it | no money is spent on a guess |
| **Audit trail** | status file, decisions log, one commit per step | anyone can resume from the repo |

Claude watched for QUESTION, BLOCKED and DONE only, so routine reports cost it nothing.

### What worked

- **Honest numbers.** The executor's smoke-test report (176 successes, 107 failures, 2 confirmation misses, 0 duplicate writes) matched the raw job log exactly when Claude recounted it.
- **Careful reading.** It read 20 real transcripts at each of three checkpoints and found 0 mismatches between what a run was paid and what it deserved.
- **Initiative with restraint.** It found that the training hook discarded transcripts, proposed a three-line fix with an alternative, waited, and applied it with every constraint Claude attached.
- **The spend gate held.** It asked before the 60-step run at 03:31; Claude answered at 03:32; it submitted at 03:46. Not a minute before.

### What broke

![Timeline: seven green executor runs, then thirteen red crosses from 05:13 to 07:13 UTC while RL steps 20 to 59 keep ticking; the step-30 check is marked never ran](/media/agent-collaboration-across-coding-tools/driver-timeline.svg)

**Silent kills.** The Cursor agent CLI runs one instance at a time; a second process kills the first. From 05:13 to 07:13 UTC, thirteen runs in a row died at start-up with exit 137. The loop logged the exit code and slept. Training continued past the step-30 check that was supposed to stop it if things went wrong. Claude noticed at 07:25.

![Chart: the trainer's response length jumps from 4,285 to above the +25 % stop line within the first steps and stays there; the executor's reported length stays near 4,000](/media/agent-collaboration-across-coding-tools/response-length.svg)

**Same words, different numbers.** The stop rule said "response length +25 %". At step 20 the executor reported +2.8 %. The trainer's own metric was +48 %. They also disagreed on when KL divergence crossed its limit (step 41 versus step 50), and both wrote a decision with the same number, because two writers shared one id sequence.

**Leftovers.** A batch script left by an earlier session kept the task builder running, and the loop waited on it: the executor's first run started three and a half hours after the hand-off.

**One laptop.** Executor, loop, model relay and credentials all lived on one Mac. When it went offline, everything stopped.

Inside each step the executor was careful and correct. Every failure was in the plumbing around the steps.

## What a hub changes

[ORC](https://github.com/niradler/orc) is a hub for coding agents: it discovers sessions from Claude Code, Codex, Cursor and Gemini, and gives them shared tasks, messages and memory over MCP. Mapped onto that night (links are to the code at commit [`eb22da7`](https://github.com/niradler/orc/tree/eb22da7ad6028d6dd20524c471754233b31b2f2a)):

| Built by hand | ORC |
|---|---|
| bash loop starts the executor | [`session_start`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L367-L370) runs any agent and model headlessly; the child's result or failure is [queued back to the parent](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/api/src/sessions/control.ts#L321-L326) |
| two markdown files | [`session_send`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L355-L359): a durable inbox with [delivery states](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L11-L20) and idempotent retries |
| `WAITING` file | human requests; flows wait for an answer |
| nothing, 13 silent kills | a dead worker is detected and [retried up to twice](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/config.ts#L331) with a task comment |
| no guard against agents ping-ponging | [3 hops, 20 messages per pair per hour](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L4-L7), and every message says delivery is not approval |

What a hub does not fix yet:

| Gap | Effect |
|---|---|
| Mid-turn delivery [only reaches Claude, Codex and Gemini](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L161); a running Cursor session is refused | you cannot steer a Cursor executor mid-step |
| A child's question [goes to a human, never to the parent agent](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/api/src/sessions/control.ts#L314-L317) | an agent cannot answer its executor overnight, which is exactly what that night needed |
| No cost budgets; a dead worker leaves a comment, not an alert | the budget stays in the brief |

Rerun today, I would run the executor as the Gemini CLI, which ORC can message and resume, put the task on the board, and move the training stop rules into the job itself. The markdown channel would shrink to one thing: the supervisor's answers.

## Which setup for which job

![Six patterns placed by how long the work runs and how fast a decision must come back: call and return, direct session messages, hub sessions, file channel with a loop, git as the channel, task board](/media/agent-collaboration-across-coding-tools/pattern-map.svg)

| Setup | Use when | Cost |
|---|---|---|
| **Call and return** (`codex exec`, `cursor-agent -p`, a subagent) | a bounded task under ~10 minutes: a review, a second opinion | the caller waits and pays for its own context |
| **Direct session messages** | two live agents of the same tool | same tool only |
| **Hub sessions** | mixed tools, models or subscriptions on one goal | the hub must run; per-tool gaps |
| **Files and a loop** | hours unattended, spend gates, no hub | liveness is yours to build |
| **Git as the channel** | code that must be reviewed and merged | slow round trips |
| **Task board** | several agents and people on one goal | coarse; pair it with one of the above |

Most real setups combine two or three.

## The plumbing every setup needs

| Rule | Why |
|---|---|
| **Liveness is machinery.** Alert after N failed runs in a row; write a heartbeat on every good one | thirteen silent kills |
| **Lock single-instance tools.** A second caller waits instead of killing the first | the kills themselves |
| **Name the metric.** Every stop rule gives the exact log key, baseline and threshold | +2.8 % versus +48 % |
| **One writer per id sequence.** Only the supervisor numbers decisions | two decisions with one number |
| **Must-not-miss gates run with the work.** Auto-stop training on the cluster, not from a laptop loop | the missed step-30 check |
| **Hand off clean.** List every background process and its owner before the first run | three and a half lost hours |
| **Budget per run.** Tokens and dollars in every report | the supervisor sees spend without reading everything |

## Check your own setup

| Question | Your answer |
|---|---|
| Which agents, tools, models and subscriptions, and why the split? | |
| What carries a message, and how does a reply come back? | |
| How does a question stop spending, and how long does an answer take? | |
| Which reported number did you recount from raw output? | |
| How would you notice a dead agent, and how fast? | |
| Which metric could two agents read differently? | |
| What goes down if your laptop does? | |
