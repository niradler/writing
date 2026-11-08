---
title: Coding Agents Are Reshaping the SDLC
description: 'Imagine a developer handing five tasks to coding agents before starting their own work. Each agent needs code, an isolated environment, and somewhere to…'
publishedAt: '2026-11-04T22:44:01.703Z'
updatedAt: '2026-11-04T22:44:01.725Z'
tags: []
sourceUrl: 'https://blog.niradler.com/coding-agents-are-reshaping-the-sdlc'
originalUrl: 'https://blog.niradler.com/coding-agents-are-reshaping-the-sdlc'
sourceMarkdown: 'https://blog.niradler.com/coding-agents-are-reshaping-the-sdlc.md'
cover: /media/coding-agents-are-reshaping-the-sdlc/cover.png
coverAlt: Coding Agents Are Reshaping the SDLC
---
# Coding Agents Are Reshaping the SDLC

Imagine a developer handing five tasks to coding agents before starting their own work. Each agent needs code, an isolated environment, and somewhere to submit a change. Every push may start several CI jobs. By the time the developer returns to review, the system has already done far more work than the five edits suggest.

Repeat that across an engineering organization, and **the cost of parallel development spreads through the entire software development lifecycle**. Repository access, environment setup, builds, tests, reviews, and merging all have to absorb the extra activity.

That is the movement behind the recent source-control announcements from OpenAI, Cursor, and Anthropic. Coding agents are changing how often development workflows run, how many run at once, and how long their environments live. Git sits in the middle of those workflows, so its surrounding infrastructure is being redesigned along with them.

I expect most developers to keep using Git for years. The more consequential change is how much of the work around a commit moves into services built for coding agents.

## Parallel coding puts pressure on the whole workflow

A long-lived developer environment amortizes its setup cost. The repository is already there, dependencies are installed, and build caches survive between tasks. A disposable agent environment may repeat that preparation for a change that takes only minutes to write.

As concurrency grows, that repetition becomes an infrastructure problem. More clients fetch overlapping code. More branches receive updates. More CI jobs inspect the same revisions. Repository size matters too: repeating a small checkout and repeating a huge monorepo checkout produce very different bills.

**Producing more patches also creates more work downstream.** Tests have to run, reviewers have to understand the changes, and merge systems have to reconcile them with a moving main branch. Faster code generation can expose whichever stage was previously hidden behind the time it took to write the code.

This changes what we should optimize. Clone latency is one useful measurement, but the result we care about is how quickly a change can move from an assigned task to tested, reviewed, integrated software.

## Source control is changing at several layers

The current projects illustrate different places to intervene. Some preserve the Git interface and rebuild the server. Others reduce how much state a client needs or expose source-control operations directly through APIs. These approaches can coexist because they address different costs in the same workflow.

**OpenAI's Pando** preserves Git clients and protocols while redesigning the backend for concurrent writes and high read throughput. It coordinates updates per reference, allowing unrelated branches to advance independently, and reuses stored packfiles across fetches. The consistency tradeoff is explicit: reading several branches does not guarantee a snapshot from one moment across the repository. OpenAI reports nearly five times lower median push latency in production and nearly a petabyte of Git data delivered daily. These are reported results for its own workload. [Read OpenAI's architecture](https://openai.com/index/scaling-git-at-openai/).

<figure class="media" data-align="center">
<img src="/media/coding-agents-are-reshaping-the-sdlc/e4aeeb62-badc-421d-9a8f-bf00143e56ab.png" alt="Diagram titled OpenAI Pando: coding agents write packfiles into shared storage that a regional cache serves to other agents and CI jobs" loading="lazy" decoding="async" data-align="center">
</figure>

**Cursor's Origin and Continuity** also preserve Git workflows, with a different storage and coordination design. Origin is the Git service, while Continuity uses a write-ahead log in S3-compatible storage as the source of truth and treats local repositories as reconstructable caches. Cursor describes published pushes as linearizable, with replicas checking the authoritative index before serving reads. It also performs compaction centrally so replicas can download the resulting packs instead of repeating that computation. [Read Cursor's architecture](https://cursor.com/blog/git-at-any-scale).

<figure class="media" data-align="center">
<img src="/media/coding-agents-are-reshaping-the-sdlc/dd82dc0c-3095-41ae-8122-27b7315e0970.png" alt="Diagram titled Cursor Origin / Continuity: a Git service writes a durable log to S3-compatible storage and repository replicas serve fetches" loading="lazy" decoding="async" data-align="center">
</figure>

**Anthropic's Scion** changes both sides of the relationship. Anthropic replaced Git for its internal monorepo after reaching an unusual workload: more than 30,000 merged changes per day by September 2026 and roughly 25 million daily CI checkouts. Scion moves operations such as history queries, commit creation, merges, and rebases to the server. Clients keep bounded caches and materialize the files they need, while some tools use APIs without a working copy. Anthropic credits earlier systems including Google's Piper and Meta's Sapling. [Read Anthropic's design](https://www.anthropic.com/research/redesigning-source-control).\

<figure class="media" data-align="center">
<img src="/media/coding-agents-are-reshaping-the-sdlc/3bd60d02-0803-4385-8020-5beb0c8719da.png" alt="Diagram titled Anthropic Scion: clients request needed files from a source-control service that runs history, blame, commit, merge, and rebase" loading="lazy" decoding="async" data-align="center">
</figure>

**Gion** explores a lighter client against existing Git hosts. It retrieves repository objects on demand, shares a cache across processes, and supports selective workspaces and writes through the Git protocol. It is an example of making repository access more selective without requiring an organization to replace its source-control server. [Explore Gion](https://github.com/baz-scm/gion).

**OpenAI's planned acquisition of Pierre**, announced November 4, brings code storage and review tools closer to the coding-agent platform. Pierre's Trees and Diffs libraries already power file browsing and change review in Codex, and OpenAI says it intends to bring Code Storage functionality into Codex. The deal remains subject to closing conditions. My reading is that source control is becoming a larger part of the agent platform's product surface, although the announcement does not establish how Pierre's technology and Pando will fit together. [Read the acquisition announcement](https://openai.com/index/openai-to-acquire-pierre/).

Taken together, these examples show a shift in where development work happens. **A local repository is becoming one way to access source control, alongside services that can answer questions and manage changes directly.** A job that needs a diff can request a diff. A tool investigating a regression can query history. A coding agent may need a working directory to build and test, while another task can finish through an API.

That flexibility has consequences. Moving operations to a service can reduce duplicated client work, but it also makes availability, permissions, and consistency part of every dependent workflow. An agent proposing a patch needs to know which revision it read and whether the target changed before its write was accepted.

## Scale the path from task to merged code

Most teams should start with the bottleneck they can measure. Git already provides [shallow and partial clones](https://git-scm.com/docs/git-clone), sparse checkouts, and [worktrees](https://git-scm.com/docs/git-worktree). Persistent mirrors and reusable environments can also reduce repeated preparation. The value of a new system depends on what remains expensive after applying the options that fit the workload.

The benchmark I want is **a hundred coding agents completing a hundred useful tasks**. Include reading, editing, dependency setup, testing, pushing, reviewing, and integration. Measure time, failures, resource consumption, and operational effort across the whole path.

That evaluation should include overlapping changes and stale bases. Independent branches can advance quickly while still competing to land on the same main branch. Efficient repository access does not resolve conflicting edits, provide test capacity, or make a large review easier to understand.

This is why source control belongs in the broader SDLC discussion. The useful unit of progress is a change that survives validation and reaches the product. Platforms that connect repository access, execution, testing, and review have an opportunity to reduce the gaps between those stages, provided they keep changes traceable and developers in control.

My bet is that Git will remain a familiar interface while more of its surrounding workflow becomes programmable infrastructure for coding agents. The implementation will vary by organization, but the objective is shared: making parallel development productive all the way through delivery.

**The next scaling problem is getting all that code safely through the SDLC.**
