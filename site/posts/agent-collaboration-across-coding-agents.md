---
title: 'Agent Collaboration Across Coding Agents'
description: 'How several coding agents, on different models and subscriptions, can work one task together: why it improves the process, how to build the communication and the shared state between them, and how to operate it, from a night Claude Code and the Cursor agent CLI ran a long job side by side.'
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

Most of us now pay for more than one coding agent. I have Claude Code and Cursor. Most days they sit side by side and never talk, and each subscription only pays off when I happen to open that tool.

I wanted them to collaborate: get more out of both subscriptions, and run a multi-model flow where each model does what it is best at. Claude plans, reviews and approves; the Cursor agent CLI running Gemini 4 Neon does the hands-on work. One evening Claude wrote a brief, handed execution to Cursor, and stayed on as supervisor for a long overnight job.

This post is what that taught me: why multi-model, multi-session work improves the process, and how to build and operate the communication and the state between the agents.

## Why several agents beat one

| Benefit | What it looked like that night |
|---|---|
| **The right model for each role** | Claude planned, reviewed and approved; Gemini did the grind: fetch logs, count, read transcripts, submit jobs |
| **Every subscription pulls its weight** | the long, token-heavy work ran on the Cursor plan; Claude's plan went to supervision only |
| **No single point of quota** | when one plan runs low, the other keeps the job moving |
| **Built-in review** | the executor's numbers were recounted by a different model before any money was spent |
| **Cheap supervision** | the supervisor read only questions and alerts, not every report |
| **A fresh head per step** | each executor run started clean from the brief and the state files, so it could not drift on a long context |

The price: the agents now need a way to talk and a place to keep state. Inside one tool that comes built in. Across tools you build it.

## Building the communication

Any channel between agents has to answer five questions.

| Question | Same tool (Claude Code side sessions) | Different tools, by hand (that night) | Different tools, through a hub ([ORC](https://github.com/niradler/orc)) |
|---|---|---|---|
| **What is a message?** | a message to a session id | an entry appended to a markdown file | a row in a shared inbox |
| **How is it delivered?** | injected into the session by the tool | read by the other agent on its next run | hook mid-turn, next turn, or resume |
| **How does a reply come back?** | the parent is woken when the child finishes | another file, plus an `ack: <time>` line | the child's result is queued back to the parent |
| **How does a question pause work?** | built in | a `WAITING` file the loop respects | a human request; the flow waits |
| **How do you know the other side is alive?** | built in | whatever you build | dead-process detection and retry |

![Left: Claude Code and the Cursor agent CLI talk only through files in the repo and a bash loop. Right: Claude Code, Gemini CLI, Codex and Cursor agent CLI all connect to an ORC hub; Cursor gets start and result only](/media/agent-collaboration-across-coding-agents/with-and-without-a-hub.svg)

That night had no hub, so the channel was two files and a loop:

![Animated: the driver starts the executor, the executor appends a REPORT, then a QUESTION lights the WAITING flag and the driver pauses until the supervisor answers and clears it](/media/agent-collaboration-across-coding-agents/protocol-loop.svg)

- **Typed messages.** The executor appends `REPORT`, `QUESTION`, `BLOCKED` or `DONE` to `to_claude.md`. The supervisor appends `GUIDE` or `ANSWER` to `to_cursor.md`. Typed headers let the supervisor watch only the three types that need it, so routine reports cost it nothing.
- **Acks.** Each executor entry starts with `ack: <time>` of the last supervisor entry it read. You always know which instructions it acted on.
- **A pause that stops spend.** A `QUESTION` creates a `WAITING` file; the loop starts nothing until the supervisor answers and deletes it. Before the expensive part of the job the executor asked, Claude answered within minutes, and only then did the executor launch it.
- **One step per run.** A bash loop starts the executor once per iteration (1 h timeout, 10 minutes apart) and stops when the status file says `BLOCKED` or `DONE`.

## Building the state

Messages say what changed. State says where things are, so any agent, any new session or a human can pick up. Each piece needs exactly one writer.

| State | Holds | Writer | Why it matters |
|---|---|---|---|
| **Brief** | goal, hard rules (budget, banned models, evidence for every number), tools, ordered steps | supervisor | the executor starts every run with no memory |
| **Status** | line 1 is the state word (`BLOCKED`, `DONE`); then what is in flight and how to resume | executor | the loop and the supervisor read it without asking |
| **Decision log** | every call that is not in the plan, numbered | supervisor | the shared history both agents cite |
| **Evidence** | the command and its real output for every number | executor | the supervisor can recount instead of trusting |
| **Version control** | one commit per step, only the agent's own files | each agent, its own files | two agents in one folder never clobber each other |

What good state bought: the executor's test-run report matched the raw log count for count when Claude recounted it. It also read 20 real transcripts at each of three checkpoints with 0 mismatches. It found a hook that silently discarded transcripts, proposed a three-line fix with an alternative, waited for approval, and kept every constraint attached to it.

What bad state cost: two writers numbered decisions from the same sequence, and two different decisions ended up with the same number.

## Operating it

Inside each step the executor was careful and correct. Everything that broke was in the operation around the steps.

![Timeline: seven green executor runs, then thirteen red crosses while the job keeps running; a checkpoint review is marked never ran](/media/agent-collaboration-across-coding-agents/driver-timeline.svg)

**Liveness.** The Cursor agent CLI runs one instance at a time; a second process kills the first. Over two hours, thirteen runs in a row died at start-up with exit 137. The loop logged each exit code and slept. The job ran past a checkpoint review that was supposed to stop it if things went wrong. Claude noticed afterwards.

![Chart: the trainer's response length jumps above the +25 % stop line early and stays there; the length the executor reported stays flat](/media/agent-collaboration-across-coding-agents/response-length.svg)

**Shared meaning.** The stop rule said "response length +25 %". At the same checkpoint the executor reported +2.8 %; the trainer's own metric was +48 %. The two agents also disagreed on when a second limit was crossed. Same words, different numbers.

**Leftovers.** A batch script from an earlier session kept a builder running, and the loop waited on it: the first executor run started three and a half hours after the hand-off.

**One machine.** Executor, loop, model relay and credentials all lived on one laptop. When it went offline, everything stopped.

The rules that close these, whatever the channel:

| Rule | Closes |
|---|---|
| **Liveness is machinery.** Alert after N failed runs in a row; write a heartbeat on every good one | thirteen silent kills |
| **Lock single-instance tools.** A second caller waits instead of killing the first | the kills themselves |
| **A metric contract in the brief.** Every stop rule names the exact log key, baseline and threshold | +2.8 % versus +48 % |
| **One writer per piece of state.** Only the supervisor numbers decisions | duplicate decision numbers |
| **Must-not-miss gates run with the work.** Auto-stop on the cluster, not from a laptop loop | the missed checkpoint review |
| **Hand off clean.** List every background process and its owner before the first run | three and a half lost hours |
| **Budget per run.** Tokens and dollars in every report | spend visible without reading everything |

## Doing it with a hub

A hub turns most of the hand-built pieces into infrastructure. [ORC](https://github.com/niradler/orc) discovers sessions from Claude Code, Codex, Cursor and Gemini and gives them shared tasks, messages and memory over MCP. Links are to the code at commit [`eb22da7`](https://github.com/niradler/orc/tree/eb22da7ad6028d6dd20524c471754233b31b2f2a).

| Built by hand | With ORC |
|---|---|
| bash loop starts the executor | [`session_start`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L367-L370) runs any agent on any model; the result is [queued back to the parent](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/api/src/sessions/control.ts#L321-L326) |
| two markdown files | [`session_send`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L355-L359), a durable inbox with [delivery states](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L11-L20) and idempotent retries |
| status file and decision log | a task board with states and comments; memories every agent loads |
| `WAITING` file | human requests; flows wait for an answer |
| nothing, 13 silent kills | a dead worker is detected and [retried up to twice](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/config.ts#L331) |
| no guard against agents ping-ponging | [3 hops and 20 messages per pair per hour](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L4-L7) |

Not covered yet: mid-turn messages [reach only Claude, Codex and Gemini](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L161), so a running Cursor session cannot be steered. A child's question [goes to a human, never to the parent agent](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/api/src/sessions/control.ts#L314-L317), so an agent cannot answer its executor overnight. And there are no cost budgets.

Rerun today, I would start the executor as the Gemini CLI through ORC, so it can be messaged and resumed, put the job on the task board, and move the stop rules into the job itself. The markdown channel would shrink to one thing: the supervisor's answers.

## Which setup for which job

![Six setups placed by how long the work runs and how fast a decision must come back: call and return, direct session messages, hub sessions, files and a loop, git as the channel, task board](/media/agent-collaboration-across-coding-agents/pattern-map.svg)

| Setup | Use when | Cost |
|---|---|---|
| **Call and return** (`codex exec`, `cursor-agent -p`, a subagent) | a bounded task under ~10 minutes: a review, a second opinion | the caller waits and pays for its context |
| **Direct session messages** | two live agents of the same tool | same tool only |
| **Hub sessions** | several tools, models or subscriptions on one goal | the hub must run; per-tool gaps |
| **Files and a loop** | hours unattended, spend gates, no hub | liveness is yours to build |
| **Git as the channel** | code that must be reviewed and merged | slow round trips |
| **Task board** | several agents and people on one goal | coarse; pair it with one of the above |

Most real setups combine two or three.

Vendors have started shipping the call-and-return bridge themselves. OpenAI's [Codex plugin for Claude Code](https://community.openai.com/t/introducing-codex-plugin-for-claude-code/1378186) ([openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)) lets Claude hand Codex a review, an adversarial review or a second pass, through the local Codex CLI and your ChatGPT subscription. That turns two subscriptions into one flow for short tasks. Long-running work still needs the state, the liveness and the gates above, either built by hand or from a hub.

## Check your own setup

| Question | Your answer |
|---|---|
| Which agents, models and subscriptions, and which role does each play? | |
| What carries a message, and how does a reply come back? | |
| Where does the state live, and who writes each piece? | |
| How does a question stop spending, and how long does an answer take? | |
| How would you notice a dead agent, and how fast? | |
| Which metric could two agents read differently? | |
| What goes down if your laptop does? | |
