---
title: 'MCP Conductor: The Advantages of Equipping Your Agent with Code Execution Powers'
description: 'TL;DR: MCP Conductor gives AI models a secure Deno sandbox to run TypeScript/JavaScript code with three powerful integration options: call MCP servers via…'
publishedAt: '2025-11-11T18:58:36.096Z'
updatedAt: '2025-11-11T18:58:36.096Z'
tags:
  - mcp
  - mcp-server
  - agentic-ai
  - agentic-ai-development
  - anthropic
  - code
sourceUrl: 'https://blog.niradler.com/mcp-conductor-the-advantages-of-equipping-your-agent-with-code-execution-powers'
originalUrl: 'https://blog.niradler.com/mcp-conductor-the-advantages-of-equipping-your-agent-with-code-execution-powers'
sourceMarkdown: 'https://blog.niradler.com/mcp-conductor-the-advantages-of-equipping-your-agent-with-code-execution-powers.md'
cover: /media/mcp-conductor-the-advantages-of-equipping-your-agent-with-code-execution-powers/cover.png
coverAlt: 'MCP Conductor: The Advantages of Equipping Your Agent with Code Execution Powers'
---
# MCP Conductor: The Advantages of Equipping Your Agent with Code Execution Powers

**TL;DR:** MCP Conductor gives AI models a secure Deno sandbox to run TypeScript/JavaScript code with three powerful integration options: call MCP servers via `mcpFactory`, shell out to CLI tools (if permitted), or import npm/JSR packages directly.

This flexibility lets you orchestrate for example GitHub via MCP server, GitHub CLI, AND the Octokit SDK in a single execution, choosing the right tool for each subtask while keeping the model's context clean.

---

## The Problem: When Direct Tool Calls Hit Their Limits

The Model Context Protocol excels at giving AI models structured access to external systems. Want to query GitHub? Use the GitHub MCP server. Need to process files? Use the filesystem MCP server. This works beautifully until it doesn't.

**Token waste from intermediate data.** Fetch a 50KB document to extract three numbers? The entire document flows through the model's context. Query an API that returns 200 results when you need 5? All 200 results consume tokens.

**Sequential execution bottlenecks.** Need data from three APIs? Make three separate MCP tool calls, waiting for each to complete before starting the next even when they're independent operations.

**Limited data transformation.** MCP servers return raw data. If you need to filter, aggregate, or transform it, the model must either do it in-context (expensive) or make additional tool calls (slow).

**Rigid interfaces.** Sometimes the MCP server doesn't expose exactly what you need. Maybe you need a complex Git operation that requires multiple commands, or you want to use a specific npm package that's perfect for the job.

Consider automating a GitHub workflow:

1. Check open PRs (MCP tool call → 10,000 tokens of PR data)
    
2. For each PR, check CI status (5 more MCP calls → 15,000 tokens)
    
3. Filter to PRs with passing CI (model does this in context)
    
4. Generate a summary report (more context processing)
    

Total: 30,000+ tokens, 3-4 seconds of sequential execution, and the model is drowning in raw API responses.

---

## Solution: Execute Code, Not Just Tools

MCP Conductor provides a single MCP tool `run_deno_code` that executes TypeScript/JavaScript in a secure Deno sandbox. But here's what makes it powerful: **it gives you three ways to integrate with external systems, and you can mix them freely:**

### 1\. Call MCP Servers via `mcpFactory` (Reuse the Ecosystem)

Want to use existing MCP servers? The global `mcpFactory` object is auto-injected into your code:

```typescript
// Connect to GitHub MCP server
const github = await mcpFactory.load('github');

// Call its tools directly from code
const prs = await github.callTool('list_pull_requests', {
  repo: 'myorg/myrepo',
  state: 'open'
});

// Process in execution environment - no tokens wasted
const passingPRs = prs.filter(pr => pr.ci_status === 'passing');

// Only final result returns to model
return { count: passingPRs.length, titles: passingPRs.map(pr => pr.title) };
```

**Benefit:** Leverage the entire MCP ecosystem (100+ community servers) while processing data efficiently.

### 2\. Shell Out to CLI Tools (Maximum Flexibility)

Sometimes CLI tools are the best interface. With `--allow-run` permission, spawn subprocesses directly:

```typescript
// Use GitHub CLI for complex operations
const ghProcess = new Deno.Command('gh', {
  args: ['pr', 'list', '--json', 'number,title,state', '--limit', '100'],
  stdout: 'piped'
});

const { stdout } = await ghProcess.output();
const prs = JSON.parse(new TextDecoder().decode(stdout));

// Use git CLI for repository operations
const gitLog = new Deno.Command('git', {
  args: ['log', '--oneline', '-10'],
  stdout: 'piped'
});

const commits = new TextDecoder().decode((await gitLog.output()).stdout);

return { prs: prs.length, recentCommits: commits };
```

**Benefit:** Full access to mature CLI tools and their rich feature sets.

### 3\. Import npm/JSR Packages (Direct API Access)

Need fine-grained control or want to use specialized packages? Import them directly:

```typescript
import { Octokit } from 'npm:@octokit/rest@^20';

const octokit = new Octokit({ auth: Deno.env.get('GITHUB_TOKEN') });

// Use full Octokit SDK
const { data: prs } = await octokit.pulls.list({
  owner: 'myorg',
  repo: 'myrepo',
  state: 'open',
  per_page: 100
});

// Complex filtering and transformation
const analysis = prs
  .filter(pr => pr.draft === false)
  .reduce((acc, pr) => {
    acc[pr.user.login] = (acc[pr.user.login] || 0) + 1;
    return acc;
  }, {});

return { totalPRs: prs.length, prsByAuthor: analysis };
```

**Benefit:** Direct SDK access with full TypeScript support and comprehensive APIs.

---

## The Power of Three Options: A Real Example

Here's what makes MCP Conductor powerful **you can mix all three approaches** in a single execution:

```typescript
// Use MCP server for discovery (good for structured MCP operations)
const github = await mcpFactory.load('github');
const repos = await github.callTool('list_repositories', { 
  org: 'myorg' 
});

// Use CLI for complex git operations (best tool for the job)
for (const repo of repos.slice(0, 5)) {
  const clone = new Deno.Command('git', {
    args: ['clone', '--depth', '1', repo.clone_url, `/tmp/${repo.name}`],
  });
  await clone.output();
}

// Use npm package for analysis (specialized functionality)
import { analyze } from 'npm:code-complexity@^2';

const results = [];
for (const repo of repos.slice(0, 5)) {
  const stats = await analyze(`/tmp/${repo.name}`);
  results.push({ repo: repo.name, complexity: stats.average });
}

// Return only the summary
return results.sort((a, b) => b.complexity - a.complexity);
```

**Why this matters:** You choose the best tool for each subtask:

* MCP server for structured operations
    
* CLI for mature tooling
    
* npm packages for specialized logic
    
* Process everything in the sandbox
    
* Return only what the model needs
    

---

## How It Actually Works

### 1\. Configuration

Configure MCP Conductor in your MCP client (Cursor, Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "mcp-conductor": {
      "command": "deno",
      "args": ["run", "--allow-read", "--allow-write", "--allow-net", 
               "--allow-env", "--allow-run=deno", "jsr:@conductor/mcp", "stdio"],
      "env": {
        "MCP_CONDUCTOR_WORKSPACE": "${userHome}/.mcp-conductor/workspace",
        "MCP_CONDUCTOR_RUN_ARGS": "allow-read=/workspace,allow-write=/workspace,allow-net,allow-run=gh,git",
        "MCP_CONDUCTOR_MCP_CONFIG": "${userHome}/.mcp-conductor/mcp.json"
      }
    }
  }
}
```

### 2\. Optional: Configure MCP Servers for Proxy

Create `~/.mcp-conductor/mcp.json` to expose MCP servers to executed code:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    }
  }
}
```

### 3\. Model Writes Code

The model uses the `run_deno_code` tool:

```json
{
  "tool": "run_deno_code",
  "arguments": {
    "deno_code": "const github = await mcpFactory.load('github');\nconst prs = await github.callTool('list_pull_requests', { repo: 'myrepo' });\nreturn prs.filter(pr => pr.state === 'open').length;",
    "timeout": 30000
  }
}
```

### 4\. Secure Execution

Conductor spawns a **fresh Deno subprocess** for each execution:

<figure class="media" data-align="center">
<img src="/media/mcp-conductor-the-advantages-of-equipping-your-agent-with-code-execution-powers/ce968db6-4a3c-491b-8b69-39dee0aba91e.png" alt="Conductor spawning a fresh Deno subprocess for a code execution" loading="lazy" decoding="async" data-align="center">
</figure>

**Key security features:**

* Zero permissions by default
    
* Admin-controlled via `MCP_CONDUCTOR_RUN_ARGS`
    
* Fresh process per execution (no state leakage)
    
* `--no-prompt` flag prevents permission escalation
    
* `--cached-only` by default (no dynamic package fetching)
    

### 5\. Return Results

Only the final expression/return value goes back to the model:

```typescript
// Execution processes 50KB of data internally
// Model receives 200 bytes of summary
{
  "content": [
    {
      "type": "text", 
      "text": "Execution successful\nReturn value: {\"openPRs\": 12, \"passingCI\": 8}"
    }
  ]
}
```

---

## Why This Approach Works

### 1\. Maximum Flexibility

You're not locked into one integration method:

**Scenario: GitHub Automation**

* Use GitHub MCP server for straightforward operations
    
* Use GitHub CLI for complex git workflows
    
* Use Octokit SDK when you need fine-grained API control
    
* Mix them in the same execution as needed
    

### 2\. Token Efficiency

Process data in the execution environment, not in the model's context:

**Before (Direct MCP calls):**

* Fetch 50KB document → 50KB in context
    
* Extract 3 metrics → Model does this (more tokens)
    
* **Total:** ~15,000 tokens
    

**After (Code execution):**

* Fetch + process in sandbox → 3 metrics returned
    
* **Total:** ~500 tokens
    

### 3\. Parallel Execution (Your Code, Your Control)

```typescript
// Model writes parallel execution logic
const [repos, issues, prs] = await Promise.all([
  github.callTool('list_repositories', { org: 'myorg' }),
  github.callTool('search_issues', { query: 'is:open' }),
  github.callTool('list_pull_requests', { state: 'open' })
]);

// 3x faster than sequential MCP calls
return { repoCount: repos.length, openIssues: issues.length, openPRs: prs.length };
```

### 4\. Rich npm/JSR Ecosystem

Any package is available (if you grant `--allow-net` or pre-cache it):

```typescript
// Data processing
import { parse } from 'npm:csv-parse@^5';
import { z } from 'npm:zod@^3';

// API clients
import { Octokit } from 'npm:@octokit/rest';
import Stripe from 'npm:stripe@^14';

// Utilities
import { format } from 'npm:date-fns@^3';
import * as path from 'jsr:@std/path';
```

---

## Security Model: Admin Control, Not Model Control

**Critical design choice:** The model writes code, but **admins control all permissions** via environment variables.

### Admin-Configured Permissions

```json
{
  "env": {
    "MCP_CONDUCTOR_RUN_ARGS": "allow-read=/workspace,allow-write=/workspace,allow-net=api.github.com,allow-run=gh,git"
  }
}
```

### Two-Process Isolation

**Server Process** (Trusted):

* Full permissions to manage workspace
    
* Install dependencies
    
* Spawn sandbox subprocesses
    

**User Code Subprocess** (Untrusted):

* Only admin-granted permissions
    
* Fresh process (no state leakage)
    
* Crashes don't affect server
    
* Auto-killed after timeout
    

### Security by Default

Every execution runs with:

* `--no-prompt` - Fails fast, no permission dialogs
    
* `--cached-only` - No dynamic package fetching (unless admin allows)
    
* `--no-remote` - Blocks remote imports
    
* Zero permissions + only admin-granted ones
    

---

## Real-World Example: The GitHub Automation Workflow

Let's see all three integration methods working together:

```typescript
/**
 * Task: Generate a weekly team report from GitHub
 * - List all PRs merged this week (MCP server - simple structured call)
 * - Clone repos to analyze code quality (CLI - best tool for git operations)
 * - Calculate complexity metrics (npm package - specialized analysis)
 */

// 1. Use MCP server for structured GitHub operations
const github = await mcpFactory.load('github');

const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const mergedPRs = await github.callTool('search_pull_requests', {
  query: `is:pr is:merged merged:>${oneWeekAgo}`,
  repo: 'myorg/myrepo'
});

// 2. Use CLI for git operations (better than MCP for complex git workflows)
const cloneDir = '/workspace/analysis';
const gitClone = new Deno.Command('git', {
  args: ['clone', '--depth', '1', 'https://github.com/myorg/myrepo.git', cloneDir],
  stdout: 'piped',
  stderr: 'piped'
});
await gitClone.output();

// 3. Use npm package for specialized analysis
import { analyze } from 'npm:code-complexity-analyzer@^2';
import { format } from 'npm:date-fns@^3';

const complexity = await analyze(cloneDir);

// 4. Generate report (all processing happens in sandbox)
const report = {
  week: format(new Date(), 'MMM dd, yyyy'),
  prsAnalyzed: mergedPRs.length,
  averageComplexity: complexity.average,
  highComplexityFiles: complexity.files
    .filter(f => f.score > 10)
    .map(f => f.path),
  topContributors: Object.entries(
    mergedPRs.reduce((acc, pr) => {
      acc[pr.author] = (acc[pr.author] || 0) + 1;
      return acc;
    }, {})
  )
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
};

// 5. Only the summary returns to the model (not raw PR data, git output, or analysis details)
return report;
```

**Token savings:**

* Without Conductor: ~50,000 tokens (all PR data, git output, analysis results in context)
    
* With Conductor: ~800 tokens (just the summary report)
    

**Execution time:**

* Without Conductor: ~8 seconds (sequential MCP calls)
    
* With Conductor: ~3 seconds (parallel execution in sandbox)
    

---

### Security Considerations

* Admin must carefully configure permissions
    
* Code execution always carries risk (even in sandboxes)
    
* Monitor executions and set reasonable timeouts
    
* Use `--cached-only` in production (no dynamic package fetching)
    
* Never use `--allow-all`
    

---

## Getting Started

### 1\. Install (No Installation Needed!)

MCP Conductor is available on JSR:

```json
{
  "mcpServers": {
    "mcp-conductor": {
      "command": "deno",
      "args": [
        "run", "--allow-read", "--allow-write", "--allow-net", 
        "--allow-env", "--allow-run=deno",
        "jsr:@conductor/mcp@^0.1", "stdio"
      ]
    }
  }
}
```

### 2\. Configure Permissions

Set admin-controlled permissions:

```json
{
  "env": {
    "MCP_CONDUCTOR_WORKSPACE": "${userHome}/.mcp-conductor/workspace",
    "MCP_CONDUCTOR_RUN_ARGS": "allow-read=/workspace,allow-write=/workspace,allow-net,allow-run=gh,git"
  }
}
```

### 3\. Optional: Configure MCP Servers

Create `~/.mcp-conductor/mcp-config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "..." }
    }
  }
}
```

### 4\. Start Using

The model can now execute code with all three integration options available.

---

## Conclusion

MCP Conductor provides a **secure Deno sandbox** accessible via MCP's `run_deno_code` tool. What makes it powerful isn't complex orchestration or content-addressed storage it's **flexibility**:

**Three ways to integrate:**

1. Call MCP servers via `mcpFactory` (reuse ecosystem)
    
2. Shell out to CLI tools (use mature tooling)
    
3. Import npm/JSR packages (specialized functionality)
    

**Mix them freely:**

* Use GitHub MCP server for simple queries
    
* Use GitHub CLI for complex git operations
    
* Use Octokit SDK for fine-grained API control
    
* All in one execution, choosing the best tool for each subtask
    
**Security Considerations**

- Admin must carefully configure permissions

- Code execution always carries risk (even in sandboxes)

- Monitor executions and set reasonable timeouts

- Use `--cached-only` in production (no dynamic package fetching)

- Never use `--allow-all`

---

## Sources & Further Reading

1. **Anthropic Engineering: "Code execution with MCP: building more efficient AI agents"**  
    [anthropic.com/engineering/code-execution-with-mcp](https://www.anthropic.com/engineering/code-execution-with-mcp)  
    Introduces the pattern of code-based MCP orchestration for token efficiency.
    
2. **Pydantic:** `mcp-run-python`  
    [github.com/pydantic/mcp-run-python](https://github.com/pydantic/mcp-run-python)  
    Two-process security model for sandboxed code execution.
    
3. **MCP Conductor Repository**  
    [github.com/niradler/mcp-conductor](https://github.com/niradler/mcp-conductor)  
    Full documentation, examples, and security guidelines.
    
4. **Deno Security Model**  
    [docs.deno.com/runtime/fundamentals/security](https://docs.deno.com/runtime/fundamentals/security)  
    Capability-based permission system documentation.
