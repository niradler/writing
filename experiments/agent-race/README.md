# Agent race: Claude Code vs Codex on django__django-15957

Data and scripts for the post [I Told a Coding Agent It Was in a Competition](https://blog.niradler.com/claude-code-vs-codex-swe-bench-competition).

| Path | Contents |
| --- | --- |
| `instance.json` | The SWE-bench Verified instance: issue, base commit, hidden tests, upstream fix |
| `results.json` | Per-run time, tokens, cost, tool calls, hidden-test results, diff size |
| `runs/<competitor>-<round>/` | `prompt.txt`, `cmd.json`, `timing.json`, `agent.jsonl.gz` (the CLI's event stream), `eval/agent.patch`, `eval/test.log`, `eval/eval.json`; Codex runs also have `codex-token-counts.jsonl` |
| `judge/` | The anonymized review packet, the letter-to-run key, and both judges' raw scores |
| `bin/` | The runner, scorer, collector, judge-packet builder and chart renderer |

## Reproduce

The scripts work in `/tmp/agent-race` (override with `--root`).

1. Django at the base commit, with a virtualenv, in `/tmp/agent-race/swe/base`:
   ```bash
   mkdir -p /tmp/agent-race/swe/base && cd /tmp/agent-race/swe/base
   git init -q && git remote add origin https://github.com/django/django.git
   git fetch -q --depth 1 origin f387d024fc75569d2a4a338bfda76cc2f328f627 && git checkout -q FETCH_HEAD && git remote remove origin
   echo .venv >> .git/info/exclude
   cp <this folder>/instance.json /tmp/agent-race/swe/instance.json
   ```
2. A clean home for Codex and a neutral git identity:
   ```bash
   mkdir -p /tmp/agent-race/home/.codex && cp ~/.codex/auth.json /tmp/agent-race/home/.codex/
   printf '[user]\n\tname = racer\n\temail = racer@example.com\n' > /tmp/agent-race/home/.gitconfig
   ```
3. One round, all three competitors at once:
   ```bash
   cd /tmp/agent-race
   for arm in cc-told cc-blind codex-told; do python3 bin/race-run.py --arm $arm --run 1 & done; wait
   ```
4. Score, collect, judge, chart:
   ```bash
   for r in runs/*-1; do python3 bin/swe-eval.py --tree $r/repo --instance swe/instance.json --out $r/eval; done
   python3 bin/collect.py
   python3 bin/judge-packet.py
   uv run --no-project --with matplotlib python bin/charts.py --experiment /tmp/agent-race --out charts
   ```

Requires Claude Code 2.1.280+, Codex CLI 0.167.0+, `uv`, and Python 3.11 available to `uv`.
