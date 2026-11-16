import argparse, json, os, shutil, subprocess, time
from datetime import datetime, timezone
from pathlib import Path

ARMS = ("cc-told", "cc-blind", "codex-told", "codex-blind")
COMPETITION = (
    "\n\nThis is a competition. Three other AI coding agents are working on this exact issue at the same time, "
    "each in its own copy of the repository. When all of you finish, your result will be scored against theirs "
    "on correctness (a hidden test suite), code quality (blind review), time taken, and token cost."
)

p = argparse.ArgumentParser(description="Run one competitor on the SWE-bench instance in a fresh tree")
p.add_argument("--arm", choices=ARMS, required=True)
p.add_argument("--run", type=int, required=True)
p.add_argument("--task", required=True)
p.add_argument("--root", default="/tmp/agent-race2")
p.add_argument("--timeout-min", type=int, default=90)
a = p.parse_args()

root = Path(a.root)
home = root / "home"
task = root / "tasks" / a.task
inst = json.loads((task / "instance.json").read_text())
out = root / "runs" / a.task / f"{a.arm}-{a.run}"
if out.exists():
    raise SystemExit(f"{out} exists")
repo = out / "repo"
shutil.copytree(task / "base", repo, symlinks=True, ignore=shutil.ignore_patterns(".venv"))
subprocess.run(["uv", "venv", "-q", "-p", inst.get("python", "3.11"), ".venv"], cwd=repo, check=True)
subprocess.run(["uv", "pip", "install", "-q", "-p", ".venv/bin/python", "-e", "."], cwd=repo, check=True)

prompt = (
    f"<issue>\n{inst['problem_statement'].strip()}\n</issue>\n\n"
    "The repository in the current directory is Django. Resolve the issue above by changing non-test files. "
    "A Python virtualenv with this Django checkout installed in editable mode is at .venv. "
    "Run tests from the tests/ directory with: ../.venv/bin/python runtests.py <test_module>. "
    "Do not access the internet. Work autonomously until you consider the issue resolved; nobody is available to answer questions."
)
if a.arm.endswith("-told"):
    prompt += COMPETITION
(out / "prompt.txt").write_text(prompt)

env = dict(os.environ, GIT_CONFIG_GLOBAL=str(home / ".gitconfig"))
if a.arm.startswith("cc-"):
    cmd = [
        "claude", "-p", prompt, "--setting-sources", "project", "--strict-mcp-config",
        "--model", "sonnet", "--effort", "high", "--permission-mode", "bypassPermissions",
        "--disallowedTools", "WebFetch", "WebSearch",
        "--output-format", "stream-json", "--verbose", "--max-budget-usd", "25",
    ]
else:
    env.update(HOME=str(home), CODEX_HOME=str(home / ".codex"))
    cmd = [
        "codex", "exec", "--skip-git-repo-check", "-m", "gpt-6.1-terra",
        "-c", "model_reasoning_effort=high", "-c", 'web_search="disabled"', "-c", "features.apps=false",
        "--dangerously-bypass-approvals-and-sandbox", "--json", "-o", str(out / "last-message.txt"), "-",
    ]
(out / "cmd.json").write_text(json.dumps(cmd[:2] + ["<prompt>" if c == prompt else c for c in cmd[2:]]))

started = datetime.now(timezone.utc)
t0 = time.monotonic()
with open(out / "agent.jsonl", "w") as so, open(out / "agent.err", "w") as se:
    try:
        rc = subprocess.run(cmd, cwd=repo, env=env, input=None if a.arm.startswith("cc-") else prompt.encode(), stdin=subprocess.DEVNULL if a.arm.startswith("cc-") else None, stdout=so, stderr=se, timeout=a.timeout_min * 60).returncode
    except subprocess.TimeoutExpired:
        rc = "timeout"
wall = time.monotonic() - t0
(out / "timing.json").write_text(json.dumps({
    "task": a.task, "arm": a.arm, "run": a.run, "started": started.isoformat(),
    "ended": datetime.now(timezone.utc).isoformat(), "wall_seconds": round(wall, 1), "exit": rc,
}))
print(json.dumps({"task": a.task, "arm": a.arm, "run": a.run, "wall_seconds": round(wall, 1), "exit": rc}))
