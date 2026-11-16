import argparse, glob, json, re, subprocess
from datetime import datetime
from pathlib import Path

p = argparse.ArgumentParser(description="Collect time, tokens, cost, tool use and test results for every run")
p.add_argument("--root", default="/tmp/agent-race2")
a = p.parse_args()
root = Path(a.root)

TERRA = {"short": (1.00, 0.05, 1.25, 5.00), "long": (2.00, 0.10, 2.50, 7.50)}
ts = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))


def claude(run):
    events = [json.loads(l) for l in (run / "agent.jsonl").read_text().splitlines() if l.strip()]
    results = [e for e in events if e.get("type") == "result"]
    result = results[-1]
    tools = [c["name"] for e in events if e.get("type") == "assistant" for c in e["message"]["content"] if c["type"] == "tool_use"]
    u = {k: sum(r["usage"][k] for r in results) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens")}
    return {
        "session_id": result["session_id"],
        "agent_seconds": round(sum(r["duration_ms"] for r in results) / 1000, 1),
        "turns": sum(r["num_turns"] for r in results),
        "result_events": len(results),
        "tool_calls": len(tools),
        "tools": {t: tools.count(t) for t in sorted(set(tools))},
        "tokens": {
            "input": u["input_tokens"],
            "cache_read": u["cache_read_input_tokens"],
            "cache_write": u["cache_creation_input_tokens"],
            "output": u["output_tokens"],
        },
        "cost_usd": round(max(r["total_cost_usd"] for r in results), 4),
        "cost_source": "Claude Code total_cost_usd",
        "models": sorted(result.get("modelUsage", {})),
        "stop": result.get("subtype"),
    }


def codex(run):
    events = [json.loads(l) for l in (run / "agent.jsonl").read_text().splitlines() if l.strip()]
    thread = next(e["thread_id"] for e in events if e.get("type") == "thread.started")
    rollout = Path(glob.glob(str(root / f"home/.codex/sessions/*/*/*/*{thread}.jsonl"))[0])
    lines = [json.loads(l) for l in rollout.read_text().splitlines() if l.strip()]
    prev = {"input_tokens": 0, "cached_input_tokens": 0, "cache_write_input_tokens": 0, "output_tokens": 0, "reasoning_output_tokens": 0}
    cost = 0.0
    requests = 0
    long_requests = 0
    for e in lines:
        info = (e.get("payload") or {}).get("info") if (e.get("payload") or {}).get("type") == "token_count" else None
        if not info:
            continue
        total = info["total_token_usage"]
        delta = {k: total.get(k, 0) - prev[k] for k in prev}
        if not any(delta.values()):
            continue
        prev = {k: total.get(k, 0) for k in prev}
        requests += 1
        tier = "long" if info["last_token_usage"]["input_tokens"] > 272_000 else "short"
        long_requests += tier == "long"
        inp, cached, write, out = TERRA[tier]
        uncached = delta["input_tokens"] - delta["cached_input_tokens"] - delta["cache_write_input_tokens"]
        cost += (uncached * inp + delta["cached_input_tokens"] * cached + delta["cache_write_input_tokens"] * write + delta["output_tokens"] * out) / 1e6
    items = [e["item"] for e in events if e.get("type") == "item.completed"]
    kinds = [i["type"] for i in items if i["type"] not in ("agent_message", "reasoning")]
    stamps = [ts(e["timestamp"]) for e in lines if "timestamp" in e]
    return {
        "session_id": thread,
        "rollout": str(rollout),
        "agent_seconds": round((max(stamps) - min(stamps)).total_seconds(), 1),
        "turns": requests,
        "tool_calls": len(kinds),
        "tools": {t: kinds.count(t) for t in sorted(set(kinds))},
        "tokens": {
            "input": prev["input_tokens"] - prev["cached_input_tokens"] - prev["cache_write_input_tokens"],
            "cache_read": prev["cached_input_tokens"],
            "cache_write": prev["cache_write_input_tokens"],
            "output": prev["output_tokens"],
            "reasoning_in_output": prev["reasoning_output_tokens"],
        },
        "cost_usd": round(cost, 4),
        "cost_source": f"tokens x OpenAI list price, {long_requests} of {requests} requests in the >272K tier",
        "models": ["gpt-6.1-terra"],
    }


def diffstat(patch):
    files = {}
    current = None
    for line in patch.splitlines():
        m = re.match(r"^\+\+\+ b/(\S+)", line)
        if m:
            current = m.group(1)
            files[current] = [0, 0]
        elif current and line.startswith("+") and not line.startswith("+++"):
            files[current][0] += 1
        elif current and line.startswith("-") and not line.startswith("---"):
            files[current][1] += 1
    src = {f: v for f, v in files.items() if not f.startswith("tests/")}
    return {
        "files": sorted(files),
        "source_lines_changed": sum(a + d for a, d in src.values()),
        "test_lines_added": sum(a for f, (a, d) in files.items() if f.startswith("tests/")),
    }


rows = []
for run in sorted((root / "runs").glob("*/*-[0-9]*")):
    if not (run / "timing.json").exists():
        continue
    timing = json.loads((run / "timing.json").read_text())
    row = {"task": timing.get("task"), "arm": timing["arm"], "run": timing["run"], "wall_seconds": timing["wall_seconds"], "exit": timing["exit"]}
    row.update(claude(run) if timing["arm"].startswith("cc-") else codex(run))
    ev = run / "eval-src/eval.json"
    if ev.exists():
        full = json.loads((run / "eval/eval.json").read_text())
        row["with_agent_tests"] = {"fail_to_pass": f"{full['fail_to_pass']['passed']}/{full['fail_to_pass']['total']}",
                                   "pass_to_pass": f"{full['pass_to_pass']['passed']}/{full['pass_to_pass']['total']}"}
        e = json.loads(ev.read_text())
        row.update(resolved=e["resolved"], fail_to_pass=f"{e['fail_to_pass']['passed']}/{e['fail_to_pass']['total']}",
                   pass_to_pass=f"{e['pass_to_pass']['passed']}/{e['pass_to_pass']['total']}")
        row["diff"] = diffstat((run / "eval/agent.patch").read_text())
        verdicts = json.loads((root / "screen/verdicts.json").read_text()).get(timing.get("task"), {})
        specified = {n: s for n, s in e["fail_to_pass"]["results"].items() if verdicts.get(n, {}).get("verdict") != "unspecified"}
        row["specified_fail_to_pass"] = f"{sum(s == 'pass' for s in specified.values())}/{len(specified)}"
        row["resolved_specified"] = all(s == "pass" for s in specified.values()) and e["pass_to_pass"]["passed"] == e["pass_to_pass"]["total"]
    rows.append(row)

(root / "results.json").write_text(json.dumps(rows, indent=1))
for r in rows:
    print(json.dumps({k: r.get(k) for k in ("task", "arm", "run", "wall_seconds", "agent_seconds", "turns", "tool_calls", "cost_usd", "resolved", "fail_to_pass", "specified_fail_to_pass", "resolved_specified", "pass_to_pass")}))
