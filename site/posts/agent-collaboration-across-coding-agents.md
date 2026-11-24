---
title: 'Agent Collaboration Across Coding Agents'
description: 'How coding agents from different tools and subscriptions can work one task together: the messages, the shared state, and the rules that keep a long run alive.'
publishedAt: '2026-11-24T12:00:00.000Z'
updatedAt: '2026-11-24T12:00:00.000Z'
tags:
  - ai-agents
  - coding-agents
  - multi-agent
  - llm
  - orc
sourceUrl: 'https://blog.niradler.com/agent-collaboration-across-coding-agents'
originalUrl: 'https://blog.niradler.com/agent-collaboration-across-coding-agents'
---
# Agent Collaboration Across Coding Agents

Many developers now pay for more than one coding agent: Claude Code, Cursor, Codex, Gemini CLI. They usually sit side by side and never talk, and each subscription only pays off when you happen to open that tool.

Making them collaborate gets more out of every subscription and lets each model do the part it is best at. The examples use two roles: a supervisor that plans, answers questions and approves, and an executor that does the work.

## Why several agents beat one

| Benefit | What it means |
|---|---|
| **The right model for each role** | a strong model plans, reviews and approves; a cheaper or faster one does the grind |
| **Every subscription pulls its weight** | long, token-heavy work runs on one plan; the other plan is spent on judgement |
| **No single point of quota** | when one plan hits its limit, another keeps the work moving |
| **Built-in review** | a different model checks the plan and the diff before anything expensive runs |
| **Cheap supervision** | the supervisor reads only questions and alerts, not every report |
| **A fresh context per step** | each executor run starts clean from the brief and the state, so it does not drift on a long context |

The cost: the agents need a way to talk and a place to keep state. Inside one tool that comes built in. Across tools you build it, or you run a hub: a service that connects sessions from several tools.

## Building the communication

Any channel between agents has to answer five questions. Claude Code sessions answer them inside one tool; across tools you answer them by hand or through a hub such as [ORC](https://github.com/niradler/orc).

| Question | Same tool | Different tools, by hand | Different tools, through a hub |
|---|---|---|---|
| **What is a message?** | a message to a session id | an entry appended to a file | a row in a shared inbox |
| **How is it delivered?** | injected into the session by the tool | read by the other agent on its next run | mid-turn through a hook, on the next turn, or on resume |
| **How does a reply come back?** | the parent is woken when the child finishes | another file, plus an ack line | the child's result is queued back to the parent |
| **How does a question pause work?** | built in | a pause file the loop respects | a human request; the flow waits |
| **How do you know the other side is alive?** | built in | whatever you build | dead-process detection and retry |

![Left: a supervisor agent and an executor agent from different tools talk only through files in the repo and a driver loop. Right: Claude Code, Gemini CLI, Codex and Cursor agent CLI all connect to an ORC hub](/media/agent-collaboration-across-coding-agents/with-and-without-a-hub.svg)

Without a hub, the simplest channel is two files and a loop:

![Animated: the driver starts the executor, the executor appends a REPORT, then a QUESTION lights the WAITING flag and the driver pauses until the supervisor answers and clears it](/media/agent-collaboration-across-coding-agents/protocol-loop.svg)

- **Typed messages.** The executor appends `REPORT`, `QUESTION`, `BLOCKED` or `DONE` to `to_supervisor.md`. The supervisor appends `GUIDE` or `ANSWER` to `to_executor.md`. Typed headers let the supervisor watch only the types that need it, so routine reports stay out of its context.
- **Acks.** Each executor entry starts with `ack: <time>` of the last supervisor entry it read, so you always know which instructions it acted on.
- **A pause that stops spend.** A `QUESTION` creates a `WAITING` file, and the loop starts nothing until the supervisor answers and deletes it.
- **One step per run.** A driver loop starts the executor once per iteration, with a timeout, and stops when the first line of the status file reads `BLOCKED` or `DONE`.

## Building the state

Messages say what changed. State says where things are, so any agent, a new session or a human can pick up the work. Each piece needs exactly one writer.

| State | Holds | Writer | Why it matters |
|---|---|---|---|
| **Brief** | goal, hard rules (budget, allowed models, evidence for every number), tools, ordered steps | supervisor | the executor starts every run with no memory |
| **Status** | first line is the state word (`BLOCKED`, `DONE`); then what is in flight and how to resume | executor | the loop and the supervisor read it without asking |
| **Decision log** | every call that is not in the plan, numbered | supervisor | the shared history both agents cite |
| **Evidence** | the command and its real output for every number | executor | the supervisor can rerun the command instead of trusting the report |
| **Version control** | one commit per step, only the agent's own files | each agent, its own files | agents sharing one checkout do not overwrite each other's work |

Two agents writing to one sequence (decision numbers, ids, a shared table) will collide, so the agent that does not own a piece proposes changes through a message.

## Operating it

With messages and state in place, the failures that remain are in the operation around the steps, not in the steps.

| Failure mode | What happens | Rule that closes it |
|---|---|---|
| **Silent deaths** | an executor run exits with an error; the loop logs the exit code and keeps sleeping | alert after N failed runs in a row; write a heartbeat on every good one |
| **Single-instance tools** | a helper script or a manual run starts the same CLI and kills the executor | a lock: a second caller waits instead of killing the first |
| **Same words, different numbers** | two agents compute "cost up 20%" from two different counters, and a stop rule never fires | a metric contract in the brief: exact log key, baseline and threshold |
| **Gates on a laptop** | a check that must stop the job lives in a loop on one machine; the machine sleeps or the loop dies | run must-not-miss gates with the work (auto-stop in the job itself) |
| **Leftover processes** | a background script from an earlier session holds a resource the loop waits on | list every background process and its owner before the first run |
| **Invisible spend** | the supervisor cannot see cost without reading every report | tokens and dollars in every report; a budget per run |

## Doing it with a hub

A hub turns most of the hand-built pieces into infrastructure. [ORC](https://github.com/niradler/orc) (an open-source hub I maintain) discovers sessions from Claude Code, Codex, Cursor and Gemini CLI and gives them shared tasks, messages and memory over MCP.

| Built by hand | With ORC |
|---|---|
| driver loop starts the executor | [`session_start`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L367-L370) starts a session in any supported tool on a chosen model; the result is [queued back to the parent](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/api/src/sessions/control.ts#L321-L326) |
| two message files | [`session_send`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L355-L359), a durable inbox with [delivery states](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L11-L20) and idempotent retries |
| status file and decision log | a task board with states and comments; memories every agent loads |
| pause file | human requests; flows wait for an answer |
| liveness check | a dead worker is detected and [retried up to twice](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/config.ts#L331) |
| loop guard (rarely built) | [3 hops and 20 messages per pair per hour](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L4-L7) |

## Vendor bridges

Vendors have started shipping bridges themselves. OpenAI's [Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc) ([announcement](https://community.openai.com/t/introducing-codex-plugin-for-claude-code/1378186)) runs on a ChatGPT subscription and answers most of the five questions for one direction, Claude to Codex:

| Piece | Codex plugin |
|---|---|
| **Message** | `/codex:review`, `/codex:adversarial-review` with focus text, or `/codex:rescue` to hand Codex a task through a subagent |
| **Reply** | `/codex:result`, with the Codex session id to reopen the run in Codex |
| **Liveness** | `/codex:status` and `/codex:cancel` for background jobs |
| **State** | `--resume` continues the latest Codex thread for the repo; `/codex:transfer` turns the whole Claude session into a Codex thread |
| **Gate** | an optional review gate, set up with `/codex:setup` |

It is one-way and call-and-return at heart: Claude asks, Codex answers, nothing flows back on its own. For short reviews and second passes across two subscriptions, that is enough. Long unattended work still needs the state, liveness and gates above.

## Which setup for which job

![Six setups placed by how long the work runs and how fast a decision must come back: call and return, direct session messages, hub sessions, files and a loop, git as the channel, task board](/media/agent-collaboration-across-coding-agents/pattern-map.svg)

| Setup | Use when | Limit |
|---|---|---|
| **Call and return** (`codex exec`, `cursor-agent -p`, a subagent, the Codex plugin) | a bounded task under ten minutes: a review, a second opinion | the caller waits and pays for its context |
| **Direct session messages** | two live agents of the same tool | same tool only |
| **Hub sessions** | several tools, models or subscriptions on one goal | the hub must be running |
| **Files and a loop** | hours unattended, spend gates, no hub | liveness is yours to build |
| **Git as the channel** | code that must be reviewed and merged | slow round trips |
| **Task board** | several agents and people on one goal | coarse; pair it with one of the above |

Most setups combine two or three: call and return for reviews, hub sessions or files and a loop for long work, and a task board where people follow along. Start with the smallest setup that answers the five questions for your job, and add state and gates once the work runs unattended.


## Summary

One model working alone shares its own blind spots with every check it runs on itself. A multi-model, multi-agent flow breaks that:

- **Different opinions.** A second model reads the plan or the diff with different training and different habits, and questions choices the first one took for granted.
- **Issues caught earlier.** A reviewer that did not write the code finds the wrong assumption, the missed edge case or the number that does not add up before it ships or before money is spent.
- **Each model on its best work.** Planning and judgement go to the strongest model; long, repetitive execution goes to a faster or cheaper one.
- **More from every subscription.** Work spreads across the plans you already pay for, and one plan hitting its limit no longer stops the job.
- **Clear accountability.** Roles, typed messages and one owner per piece of state leave a record of who decided what and why.

The models are ready to work together. What makes it work is the plumbing between them: a channel that answers the five questions, state with one writer per piece, and operation rules that catch failures before they cost you.
