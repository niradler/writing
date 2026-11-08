---
title: Postgres Already Is Your Backend
description: 'AI agents are unreasonably good at writing SQL. They get specific error messages, fix their own mistakes in one retry, and can introspect query performance…'
publishedAt: '2026-05-04T20:56:57.324Z'
updatedAt: '2026-05-04T20:56:57.324Z'
tags: []
sourceUrl: 'https://blog.niradler.com/postgres-already-is-your-backend'
originalUrl: 'https://blog.niradler.com/postgres-already-is-your-backend'
sourceMarkdown: 'https://blog.niradler.com/postgres-already-is-your-backend.md'
cover: /media/postgres-already-is-your-backend/cover.jpg
coverAlt: Postgres Already Is Your Backend
---
# Postgres Already Is Your Backend

AI agents are unreasonably good at writing SQL. They get specific error messages, fix their own mistakes in one retry, and can introspect query performance with EXPLAIN ANALYZE before you even ask. No other programming interface gives an agent that kind of feedback loop. So when you learn that PostgreSQL extensions now cover GraphQL APIs, job queues, cron scheduling, JWT auth, and HTTP webhooks, all through SQL, a question starts forming: what if the entire backend was just a Postgres database that an agent could build and operate?

That's not hypothetical. Supabase runs 1.5 million databases this way. Most of them power full production applications with auth, APIs, background jobs, and access control. The application server? There isn't one. It's PostgreSQL all the way down. And the extension ecosystem has quietly matured to the point where this approach isn't a prototype or a hack. It's a real architecture, and it happens to be the one AI agents are best equipped to work with.

## The Extension Stack

The reference point here is [supabase/postgres](https://github.com/supabase/postgres), which packages a curated set of extensions into a single Postgres distribution. You don't have to use Supabase's hosted platform to benefit from this. The image is open source, and the extensions work on any Postgres instance. But looking at what they've bundled tells you exactly what a "Postgres as backend" stack looks like in practice.

**pg\_graphql** turns your database schema into a GraphQL API automatically. You define your tables, your foreign keys, your constraints, and pg\_graphql reflects them as a fully queryable GraphQL endpoint. No resolvers, no schema stitching, no code generation step. Add a column, and the API updates. It handles filtering, pagination, ordering, and relationships out of the box. If you've ever spent three days writing boilerplate CRUD resolvers in a Node.js backend, this will feel like cheating. And because the entire schema is defined in SQL, an agent can create tables, add relationships, and immediately test the resulting API through the same database connection.

For REST, there's **PostgREST**, which does the same thing over HTTP. Define a table, get a REST API. It respects your Row Level Security policies, so authorization is handled at the database layer. The API is surprisingly complete: you get bulk inserts, upserts, resource embedding for joins, and content negotiation. It's been in production at serious scale for years.

**pg\_cron** gives you cron scheduling inside PostgreSQL. Schedule a function to run every night at 2 AM, every five minutes, every Monday. The syntax is standard cron. The jobs execute as SQL, which means they can do anything your database can do: aggregate data, clean up old records, refresh materialized views, call external services through pg\_net. No separate scheduler service, no Lambda functions, no Kubernetes CronJobs. An agent can set up a scheduled job with a single `SELECT cron.schedule()` call, verify it's registered, and monitor its execution, all without leaving SQL.

**pgmq** is a message queue built as a Postgres extension, originally created by Tembo. It gives you exactly what you'd use Redis or RabbitMQ for: publish messages, consume them, handle visibility timeouts, dead letter queues. The difference is that your queue lives in the same database as your data, participates in the same transactions, and doesn't require a separate infrastructure component. For most applications that aren't processing millions of messages per second, this is more than enough.

**pg\_net** lets Postgres make HTTP requests. This is the piece that closes the loop. Your database can now call external APIs, send webhooks, trigger serverless functions. Combine it with pg\_cron and you have a fully autonomous system that can poll APIs, process data, and push results without any application code running anywhere.

## Auth Without an Auth Service

The most underappreciated part of the Postgres-as-backend approach is how naturally it handles authorization. Row Level Security (RLS) is a built-in Postgres feature, not an extension, that lets you define access policies directly on tables. When you write `CREATE POLICY user_data ON profiles USING (auth.uid() = user_id)`, you're telling Postgres: no matter how someone queries this table, they only see their own rows. This isn't application-level filtering that someone might forget to add. It's enforced at the storage engine level.

Pair RLS with **pgjwt**, which can generate and verify JSON Web Tokens inside PostgreSQL, and you have a complete auth flow. The JWT contains the user's role and ID, Postgres verifies it on every request, and RLS policies use that identity to filter data. PostgREST and pg\_graphql both pass the JWT through, so your API layer is stateless and your authorization logic lives exactly where your data lives.

This is the kind of architecture that would normally require an Express server, a Passport.js configuration, a middleware chain, and a few hundred lines of authorization code scattered across your route handlers. Here it's a few SQL statements. Statements that an agent can write, test, and iterate on with immediate feedback about whether the policy does what it should.

## Why This Is an Agent-Native Architecture

The deeper you look at this stack, the more you realize it's not just convenient for AI agents. It's structurally ideal.

SQL has an exceptionally tight feedback loop. An agent writes a query, runs it, and immediately knows if it worked. The error messages are specific and actionable: "column 'user\_naem' does not exist" tells the agent exactly what to fix. Compare this to debugging a REST API integration where the failure mode might be a silent 200 response with unexpected data. An agent working with SQL can self-correct in a single retry. It reads the error, fixes the typo or adjusts the join, and tries again. Most queries converge on the correct result within one or two iterations.

Then there's `EXPLAIN ANALYZE`. An agent can not only write a query but immediately evaluate its performance, see the query plan, identify sequential scans, and rewrite for efficiency. This kind of introspection is rare in programming interfaces. You don't get an equivalent of "here's exactly how your code will execute and how long each step takes" in most languages. With Postgres, it's one command away.

The extension ecosystem multiplies this advantage. An agent that can write SQL can also create RLS policies, schedule cron jobs, enqueue messages, define GraphQL schemas, and set up webhooks. All through the same interface. All with the same feedback loop. All correctable in the same way. You're not asking the agent to context-switch between a Terraform config, a YAML deployment manifest, a JavaScript middleware function, and a SQL migration. It's SQL the whole way through.

This matters because the bottleneck with AI agents isn't intelligence, it's interface friction. Every time an agent has to switch between tools, formats, or paradigms, error rates go up. A Postgres-native backend compresses the entire surface area into one language that agents already handle well.

## What This Actually Looks Like

Picture a SaaS application. Users sign up, manage projects, get daily email digests, and can query their data through a dashboard. In a traditional stack, you'd need an API server (Express, FastAPI, Rails), a background job processor (Sidekiq, Celery, Bull), a message queue (Redis, SQS), an auth service (Auth0, Clerk, or hand-rolled), and a cron scheduler (CloudWatch Events, Kubernetes CronJobs).

With the Postgres extension stack, your migration files *are* your backend. You write `CREATE TABLE` for your schema. `CREATE POLICY` for your auth rules. `SELECT cron.schedule()` for your daily digest job. A `pgmq` queue for async processing. pg\_graphql for your dashboard API. pg\_net to call your email provider. The "application code" is SQL, and it lives in version-controlled migration files.

Now point an AI agent at that database. It can scaffold the schema, write the security policies, set up the background jobs, and test everything, all in one session, all in one language. Try doing that across Express, Redis, Auth0, and CloudWatch.

Is this right for every application? No. If you're building a real-time multiplayer game or processing video streams, you need application servers. But for the vast majority of web applications, the ones that are fundamentally CRUD with some business logic and background processing, the Postgres extension ecosystem covers more ground than most developers realize.
