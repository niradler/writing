---
title: 'Agent Collaboration Across Coding Agents'
description: 'How coding agents from different tools and subscriptions can work one task together: the messages, the shared state, and the rules that keep a long run alive.'
publishedAt: '2026-11-24T12:00:00.000Z'
updatedAt: '2026-11-24T12:00:00.000Z'
tags:
  - ai-agents
  - ai-coding-agents
  - multi-agent
  - llm
  - orc
sourceUrl: 'https://blog.niradler.com/agent-collaboration-across-coding-agents'
originalUrl: 'https://blog.niradler.com/agent-collaboration-across-coding-agents'
cover: /media/agent-collaboration-across-coding-agents/cover.jpg
coverAlt: 'Four glowing coding-agent workstations in teal, blue, violet, and coral connected by illuminated message tracks through a central emerald orchestration hub, with a coral checkpoint gate along the front track'
---
# Agent Collaboration Across Coding Agents

Many developers now pay for more than one coding agent: Claude Code, Cursor, Codex, Gemini CLI. They usually sit side by side and never talk, and each subscription only pays off when you happen to open that tool.

Making them collaborate gets more out of every subscription and lets each model do the part it is best at. The examples use two roles: a supervisor that plans, answers questions and approves, and an executor that does the work.

## Why several agents beat one

| Benefit | What it means |
|---|---|
| **The right model for each role** | a strong model plans, reviews and approves while a cheaper or faster one does the grind |
| **Every subscription pulls its weight** | long, token-heavy work runs on one plan and the other plan is spent on judgement |
| **No single point of quota** | when one plan hits its limit, another keeps the work moving |
| **Built-in review** | a different model checks the plan and the diff before anything expensive runs |
| **Cheap supervision** | the supervisor reads only questions and alerts, not every report |
| **A fresh context per step** | each executor run starts clean from the brief and the state, so it does not drift on a long context |

The cost: the agents need a way to talk and a place to keep state. Inside one tool that comes built in. Across tools you build it, or you run a hub: a service that connects sessions from several tools. It also costs tokens: Anthropic reports that its multi-agent research system uses about 15 times the tokens of a chat, and that multi-agent setups fit poorly when every agent needs the same context or the parts depend heavily on each other ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)). Split work only where the parts can run apart, and [start with the simplest setup that works](https://www.anthropic.com/engineering/building-effective-agents).

## Models reason, harnesses act

A coding agent is two things: a model that reasons, and a harness (Claude Code, Cursor, Codex, Gemini CLI) that owns the tools, the context, the state and the permissions. The pair is what you are really running. In a [2026 preprint](https://arxiv.org/html/2608.26218v1), keeping the model fixed under a tight 20k-token window and adding mechanical tool-output shortening plus stall detection lifted complete solutions on a 169-task SWE-bench Verified subset from 43 to 72 (wide-window arms stayed close). Across mature harnesses at normal context sizes, accuracy usually moves by only a few points, while cost, runtime and behavior under pressure vary widely ([harness × model field guide](/harness-x-model-field-guide-coding-agents)). So a mixed flow has two levers, not one.

| Lever | How to use it |
|---|---|
| **Route models by role** | the strongest model plans and reviews while faster, cheaper models handle routine edits and tool calls. In [Anthropic's parallel research system](https://www.anthropic.com/engineering/multi-agent-research-system), an Opus lead with Sonnet subagents beat a single Opus agent by 90.2% on an internal research eval. On coding tasks, fixed planner-to-executor splits have tighter margins unless the price gap is large ([field guide](/harness-x-model-field-guide-coding-agents#part-4-combining-models-planner-executor-advisor-escalation)) |
| **Match the harness to the work** | an open, sandboxed harness for exploring and debugging, and a constrained one with tight permissions and approval gates for bounded changes ([Interloom](https://interloom.com/en/blog/harness-engineering-matching-agents-to-work/)) |
| **Tune the harness to the model** | models expect different prompts, tools and context handling. Per-model harness profiles fix stalled loops ([LangChain](https://www.langchain.com/blog/tuning-deep-agents-different-models)), and for a pairing you run often, a small adapter can be trained for that exact harness ([Hugging Face](https://huggingface.co/blog/harness-adapters-at-scale)) |
| **Put controls in the harness, not the prompt** | budgets, approvals and audit trails belong in the layer that runs the agent. A meta-harness such as [Databricks Omnigent](https://www.databricks.com/blog/introducing-omnigent-meta-harness-combine-control-and-share-your-agents) sits above Claude Code and Codex and can pause a run after every $100 spent |

## Building the communication

Any channel between agents has to answer five questions. Claude Code sessions answer them inside one tool. Across tools you answer them by hand or through a hub such as [ORC](https://github.com/niradler/orc).

| Question | Same tool | Different tools, by hand | Different tools, through a hub |
|---|---|---|---|
| **What is a message?** | a message to a session id | an entry appended to a file | a row in a shared inbox |
| **How is it delivered?** | injected into the session by the tool | read by the other agent on its next run | mid-turn through a hook, on the next turn, or on resume |
| **How does a reply come back?** | the parent is woken when the child finishes | another file, plus an ack line | the child's result is queued back to the parent |
| **How does a question pause work?** | built in | a pause file the loop respects | a `session_send` wait for another agent, or a `human_request` when a person must decide |
| **How do you know the other side is alive?** | built in | whatever you build | dead-process detection and retry |

![Left: a supervisor agent and an executor agent from different tools talk only through files in the repo and a driver loop. Right: Claude Code, Gemini CLI, Codex and Cursor agent CLI all connect to an ORC hub](/media/agent-collaboration-across-coding-agents/with-and-without-a-hub.svg)

Without a hub, the simplest channel is two files and a loop:

![Animated: the driver starts the executor, the executor appends a REPORT, then a QUESTION lights the WAITING flag and the driver pauses until the supervisor answers and clears it](/media/agent-collaboration-across-coding-agents/protocol-loop.svg)

- Typed messages: the executor appends `REPORT`, `QUESTION`, `BLOCKED` or `DONE` to `to_supervisor.md`, and the supervisor appends `GUIDE` or `ANSWER` to `to_executor.md`. Typed headers let the supervisor watch only the types that need it, so routine reports stay out of its context.
- Acks: each executor entry starts with `ack: <time>` of the last supervisor entry it read, so you always know which instructions it acted on.
- A pause that stops spend: a `QUESTION` creates a `WAITING` file, and the loop starts nothing until the supervisor answers and deletes it.
- One step per run: a driver loop starts the executor once per iteration, with a timeout, and stops when the first line of the status file reads `BLOCKED` or `DONE`.

## Building the state

Messages say what changed. State says where things are, so any agent, a new session or a human can pick up the work. Each piece needs exactly one writer.

| State | Holds | Writer | Why it matters |
|---|---|---|---|
| **Brief** | goal, hard rules (budget, allowed models, evidence for every number), tools, ordered steps | supervisor | the executor starts every run with no memory |
| **Status** | first line is the state word (`BLOCKED`, `DONE`), followed by what is in flight and how to resume | executor | the loop and the supervisor read it without asking |
| **Decision log** | every call that is not in the plan, numbered | supervisor | the shared history both agents cite |
| **Evidence** | the command and its real output for every number | executor | the supervisor can rerun the command instead of trusting the report |
| **Version control** | one commit per step, only the agent's own files | each agent, its own files | agents sharing one checkout do not overwrite each other's work |

Two agents writing to one sequence (decision numbers, ids, a shared table) will collide, so the agent that does not own a piece proposes changes through a message.

## Operating unattended agent runs

With messages and state in place, the failures that remain are in the operation around the steps, not in the steps.

| Failure mode | What happens | Rule that closes it |
|---|---|---|
| **Silent deaths** | an executor run exits with an error while the loop logs the exit code and keeps sleeping | alert after N failed runs in a row and write a heartbeat on every good one |
| **Single-instance tools** | a helper script or a manual run starts the same CLI and kills the executor | a lock so a second caller waits instead of killing the first |
| **Same words, different numbers** | two agents compute "cost up 20%" from two different counters, and a stop rule never fires | a metric contract in the brief: exact log key, baseline and threshold |
| **Gates on a laptop** | a check that must stop the job lives in a loop on one machine that can sleep or drop the loop | run must-not-miss gates with the work (auto-stop in the job itself) |
| **Leftover processes** | a background script from an earlier session holds a resource the loop waits on | list every background process and its owner before the first run |
| **Invisible spend** | the supervisor cannot see cost without reading every report | tokens and dollars in every report, plus a budget per run |
| **Loops and context bloat** | an agent repeats a failing command or rereads files without editing, while old tool output fills the context | shorten old tool output as the window fills, detect repeated failures and stop early ([preprint](https://arxiv.org/html/2608.26218v1)) |

## Running multi-agent sessions through a hub

A hub turns most of the hand-built pieces into infrastructure. [ORC](https://github.com/niradler/orc) (an open-source hub I maintain) discovers sessions from Claude Code, Codex, Cursor and Gemini CLI and gives them shared tasks, messages and memory over MCP.

| Built by hand | With ORC |
|---|---|
| driver loop starts the executor | [`session_start`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L367-L370) starts a session in any supported tool on a chosen model, and the result is [queued back to the parent](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/api/src/sessions/control.ts#L321-L326) |
| two message files | [`session_send`](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/mcp/src/tools.ts#L355-L359), a durable inbox with [delivery states](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L11-L20) and idempotent retries |
| status file and decision log | a task board with states and comments, plus memories every agent loads |
| pause file | inbox waits for another agent, or human requests when a flow needs a person to answer |
| liveness check | a dead worker is detected and [retried up to twice](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/config.ts#L331) |
| loop guard (rarely built) | [3 hops and 20 messages per pair per hour](https://github.com/niradler/orc/blob/eb22da7ad6028d6dd20524c471754233b31b2f2a/packages/core/src/session-messages.ts#L4-L7) |

Two other layers are growing next to hubs. Meta-harnesses such as [Omnigent](https://www.databricks.com/blog/introducing-omnigent-meta-harness-combine-control-and-share-your-agents) wrap Claude Code, Codex and custom agents behind one control layer, so switching harnesses is a configuration change. The [A2A protocol](https://a2a-protocol.org/latest/) (Linux Foundation, v1.0) standardizes messages between agents on different platforms: MCP connects an agent to tools, A2A connects agents to each other.

## Vendor bridges

Vendors have started shipping bridges themselves. OpenAI's [Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc) ([announcement](https://community.openai.com/t/introducing-codex-plugin-for-claude-code/1378186)) runs on a ChatGPT subscription and answers most of the five questions for one direction, Claude to Codex:

| Piece | Codex plugin |
|---|---|
| **Message** | `/codex:review`, `/codex:adversarial-review` with focus text, or `/codex:rescue` to hand Codex a task through a subagent |
| **Reply** | `/codex:result`, with the Codex session id to reopen the run in Codex |
| **Liveness** | `/codex:status` and `/codex:cancel` for background jobs |
| **State** | `--resume` continues the latest Codex thread for the repo, and `/codex:transfer` turns the whole Claude session into a Codex thread |
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
| **Task board** | several agents and people on one goal | coarse, so pair it with one of the above |

Most setups combine two or three: call and return for reviews, hub sessions or files and a loop for long work, and a task board where people follow along. Start with the smallest setup that answers the five questions for your job, and add state and gates once the work runs unattended.

## When not to split the work

Multi-agent setups carry real overhead, and a single agent is still the better default for most day-to-day coding:

- Short tasks under ten minutes: handoffs, cold prompt caches and message plumbing cost more time and tokens than letting one session finish.
- Tightly coupled edits: when every step depends on the full context of the same files, splitting work across agents creates merge conflicts and stalls instead of parallelism.
- Flat single-plan volume: if one frontier subscription already covers your daily quota without hitting limits, adding a second harness buys a second opinion on reviews, not a faster inner loop.
- No clear verification gate: without commands or tests the supervisor can rerun, a second agent only adds another confident summary to read.

Where collaboration pays off is long unattended runs, cross-model reviews that break single-model blind spots, and work that benefits from spreading across multiple subscriptions and harnesses. The models and harnesses are ready to work together. What makes them hold up is the plumbing between them: a channel that answers the five questions, state with one writer per piece, and operation rules that catch failures before they cost you.
