---
title: 'The Third Interface: Your Next User Doesn''t Have Hands'
description: 'For as long as software has existed, we''ve been building two doors into our systems. Door one: the UI, a carefully designed surface where humans point…'
publishedAt: '2026-05-02T20:54:27.627Z'
updatedAt: '2026-05-02T20:54:27.627Z'
tags:
  - agentic-ai
  - mcp
sourceUrl: 'https://blog.niradler.com/the-third-interface-your-next-user-doesn-t-have-hands'
originalUrl: 'https://blog.niradler.com/the-third-interface-your-next-user-doesn-t-have-hands'
sourceMarkdown: 'https://blog.niradler.com/the-third-interface-your-next-user-doesn-t-have-hands.md'
series: Chat First
seriesSlug: chat-first
cover: /media/the-third-interface-your-next-user-doesn-t-have-hands/cover.jpg
coverAlt: 'The Third Interface: Your Next User Doesn''t Have Hands'
---
# The Third Interface: Your Next User Doesn't Have Hands

For as long as software has existed, we've been building two doors into our systems. Door one: the **UI**, a carefully designed surface where humans point, click, and occasionally rage-quit. Door two: the **API**, a structured contract where machines exchange JSON and get work done without a single pixel rendered.

These two paradigms served us well. But something happened in the last eighteen months that neither was designed for: a third kind of consumer showed up. Not a human navigating your dashboard. Not a script calling your REST endpoint with a hardcoded bearer token. Something in between, an *agent*, that reasons, improvises, discovers capabilities on the fly, and decides what to do next based on context it gathered three tool calls ago.

And we are, collectively, building for it all wrong.

## The Two Doors (and Why They're Not Enough)

**UI-first** solved friction for humans. You obsess over information hierarchy, button placement, loading states. The assumption: your user has eyes, a cursor, and the ability to look at something confusing and figure it out through visual context clues.

**API-first** enabled programmatic access. You define schemas, version endpoints, write docs, publish SDKs. The assumption: the consumer is a developer who reads your documentation, writes integration code once, and maintains it.

Both share a hidden assumption: **someone already knows what your system can do before they use it**. The human read the onboarding flow. The developer read the API docs.

Agents don't do either of those things. An agent lands in your system like a new employee on day one, except this employee can read every document in the company in 200 milliseconds but can't find the bathroom unless someone labeled the door clearly.

## The Third Door Is Already Wide Open

The agent interface isn't one technology. It's an entire surface area that emerged in parallel across protocols, runtimes, CLIs, and sandboxes, all converging on the same idea: software needs a machine-native entry point that isn't just "the API with a prompt wrapper."

**Protocols.** MCP went from an Anthropic side project in late 2024 to an industry standard governed by the Linux Foundation, adopted by OpenAI, Google, Microsoft, and AWS, pulling nearly 100 million monthly SDK downloads. Meanwhile, researchers are already pushing past it. The ANX protocol out of Hangzhou combines CLI, skills, and MCP into a unified agent-native framework, reporting 47-55% token reduction over MCP-based skill approaches alone. The protocol layer is maturing fast.

**Skills and tool registries.** Agents don't just call endpoints. They discover *capabilities*. OpenAI's updated Agents SDK introduced progressive disclosure via skills, custom instructions via `AGENTS.md` files, and standardized tool primitives. The pattern is the same everywhere: give agents a structured way to understand what your system can do, what parameters it expects, and when to use each capability. Skills are the new API docs, except the reader isn't human.

**CLIs.** The command line became the agent's native habitat almost by accident. Claude Code, Codex CLI, Gemini CLI, Aider, Goose: these aren't IDE plugins. They're agent runtimes that happen to let humans watch. The CLI is structured, scriptable, parseable, and composable. It turns out that everything we built for power users over the last 30 years is exactly what agents need. Consistent `--help` output, JSON response formats, composable subcommands: this is agent UX.

**Sandboxes.** When agents write and execute code, they need somewhere safe to do it. This went from a niche concern to a full market in under a year. E2B, Daytona, Blaxel, Cloudflare Dynamic Workers, Together Code Sandbox, OpenAI's sandbox agents: all shipping microVM or isolate-based infrastructure where agents get filesystems, shell access, and mounted data rooms. Cloudflare's approach is particularly telling. Their MCP server exposes the entire Cloudflare API through just two tools, `search` and `execute`, because agents write code against a typed API inside a sandbox instead of navigating hundreds of individual tool definitions.

The infrastructure exists. The question is whether your product is legible to the things using it.

## What Agents Actually Need

Most teams think "building for agents" means exposing their existing API with a good system prompt. That's like thinking "building for mobile" meant making the desktop site smaller.

**Discoverability over documentation.** Agents don't browse your developer portal. They receive a list of tools with names, descriptions, and parameter schemas, then decide what to call based on how well those descriptions match the user's intent. Your tool descriptions aren't metadata. They're your entire UX. If your tool is called `batchProcessResourceModification` with a description that says "Processes resources," you've built the agent equivalent of a button labeled "Click Here" that navigates to a 404.

**Composability over completeness.** APIs mirror your internal domain model: Users, Invoices, clean RESTful nouns. Agents don't care about your domain model. They care about *tasks*. Don't expose your object model. Expose your capability surface. Think verbs, not nouns.

**Structured errors over status codes.** When your API returns `422`, a developer reads the message, checks the docs, fixes the request. An agent needs to understand exactly what went wrong and what to try differently, in a structured format, not prose. A `suggestion` field in your error response isn't for humans. It's a hint that saves a retry and a reasoning cycle.

**Guardrails as a feature.** Agents will try things humans never would, not out of malice, but out of optimization. An agent asked to "clean up staging" might decide the most efficient path is to delete everything and re-provision. Technically correct. Operationally catastrophic. OpenAI's sandbox architecture makes this explicit: the harness (approvals, audit logs, recovery) never trusts the sandbox (file ops, code execution). Your agent interface needs the same separation. Define what the agent can do. Define what it must ask about first. Make the boundary machine-readable.

**Context windows are the new rate limits.** Every tool description, every schema, every response payload competes for space in the agent's context window. If your MCP server exposes 200 tools with verbose descriptions, you've burned thousands of tokens before the agent does anything useful. Fewer, smarter tools beat a sprawling catalog every time.
