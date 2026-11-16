# Agent race, round two: three Django tickets fixed after both models' training cutoffs

Data and scripts for the second round of [I Told Coding Agents They Were in a Competition](https://blog.niradler.com/claude-code-vs-codex-swe-bench-competition). Round one is in [`../agent-race`](../agent-race).

| Path                                       | Contents                                                                                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks/<ticket>/instance.json`             | The SWE-bench-style instance built from the fix commit: issue, base commit, hidden tests, upstream fix                                                                                                |
| `controls/<ticket>/{nofix,gold}/eval.json` | The scorer on the unfixed checkout and on the upstream fix                                                                                                                                            |
| `screen/`                                  | Which hidden tests the issue text specifies, judged per test                                                                                                                                          |
| `results.json`                             | Per-run time, tokens, cost, tool calls, hidden-test results (source-only and with the agent's own tests), diff size                                                                                   |
| `runs/<ticket>/<competitor>-<round>/`      | `prompt.txt`, `cmd.json`, `timing.json`, `agent.jsonl.gz`, `eval/` (scored with the agent's test edits), `eval-src/` (scored on source changes only); Codex runs also have `codex-token-counts.jsonl` |
| `judge/<ticket>/`                          | The anonymized review packet, the letter-to-run key, and both judges' raw scores                                                                                                                      |
| `bin/`                                     | Instance builder, runner, scorer, collector, judge-packet builder, chart renderer                                                                                                                     |

## Setup and metrics

Both CLIs load your personal configuration by default. Each run strips it:

|                                         | Claude Code 2.1.280                                                  | Codex CLI 0.167.0                                                          |
| --------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Command                                 | `claude -p --model sonnet --effort high --output-format stream-json` | `codex exec -m gpt-6.1-terra -c model_reasoning_effort=high --json`        |
| My instructions, skills, hooks, plugins | Off: `--setting-sources project`                                     | Off: a separate empty `HOME` and `CODEX_HOME` holding only the login file  |
| MCP servers and app connectors          | Off: `--strict-mcp-config`                                           | Off: `-c features.apps=false` (otherwise about 240 ChatGPT app tools load) |
| Web access                              | Off: `--disallowedTools WebFetch WebSearch`                          | Off: `-c web_search="disabled"`                                            |
| Permissions                             | `--permission-mode bypassPermissions`                                | `--dangerously-bypass-approvals-and-sandbox`                               |

One gotcha: `codex exec` was killed with SIGKILL within 0.2 seconds when the round-one issue text was passed as a command-line argument. Passing the same prompt on stdin (`codex exec -`) works.

| Metric          | Source                                                                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness     | The fix commit's tests, run after the agent finished. Before any agent ran, every unfixed checkout scored 0 on them and every upstream fix passed all of them.                                                                                                                         |
| Wall-clock time | The runner's clock around the agent process, cross-checked with Claude Code's `duration_ms` and the timestamps in Codex's session log.                                                                                                                                                 |
| Tokens and cost | Claude Code: the `usage` block and `total_cost_usd` from its `result` event. Codex: the `token_count` events in its session log, times OpenAI's list price.                                                                                                                            |
| Quality         | Patches renamed to letters in random order and scored by Claude Opus 5.5 and by GPT-6.1 Sol in Codex (read-only sandbox) on design, robustness, scope, readability, tests, and an overall 1–10. Judges saw the upstream fix as a reference and were told other designs are acceptable. |

## Reproduce

The scripts work in `/tmp/agent-race2` (override with `--root`).

1. Clone Django and build the three instances:
   ```bash
   mkdir -p /tmp/agent-race2 && cp -r <this folder>/bin /tmp/agent-race2/bin && cd /tmp/agent-race2
   git clone -q --filter=blob:none https://github.com/django/django.git django-main
   python3 bin/make-instance.py --repo django-main --commit 8e3dec67c4 --ticket 37330 --out tasks/37330
   python3 bin/make-instance.py --repo django-main --commit 7847227a3f --ticket 37361 --out tasks/37361
   python3 bin/make-instance.py --repo django-main --commit fe81969e83 --ticket 37263 --out tasks/37263
   cp -r <this folder>/screen /tmp/agent-race2/screen
   ```
2. A clean home for Codex and a neutral git identity:
   ```bash
   mkdir -p /tmp/agent-race2/home/.codex && cp ~/.codex/auth.json /tmp/agent-race2/home/.codex/
   printf '[user]\n\tname = racer\n\temail = racer@example.com\n' > /tmp/agent-race2/home/.gitconfig
   ```
3. All 24 runs, scored with the agents' test edits: `bin/race-all.sh`
4. Source-only scores, metrics, judge packets, charts:
   ```bash
   for d in runs/*/*; do t=$(basename $(dirname $d)); git -C $d/repo checkout -q HEAD -- tests/ && git -C $d/repo clean -fdq tests/ && python3 bin/swe-eval.py --tree $d/repo --instance tasks/$t/instance.json --out $d/eval-src; done
   python3 bin/collect.py
   for t in 37330 37361 37263; do python3 bin/judge-packet.py --task $t; done
   uv run --no-project --with matplotlib python bin/charts.py --experiment /tmp/agent-race2 --out charts
   ```

`eval/agent.patch` comes from `git diff HEAD`, which leaves out new files. For the three runs that created a test migration, the file was appended to the patch by hand before judging.

Requires Claude Code 2.1.280+, Codex CLI 0.167.0+, `uv`, and Python 3.12 available to `uv`.
