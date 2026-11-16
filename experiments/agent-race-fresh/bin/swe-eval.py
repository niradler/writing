import argparse, json, re, subprocess, sys
from pathlib import Path

p = argparse.ArgumentParser(description="Score a Django tree against a SWE-bench instance's hidden tests")
p.add_argument("--tree", required=True)
p.add_argument("--instance", required=True)
p.add_argument("--out", required=True)
a = p.parse_args()

tree = Path(a.tree).resolve()
inst = json.loads(Path(a.instance).read_text())
out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
git = lambda *args, **kw: subprocess.run(["git", "-C", str(tree), *args], capture_output=True, text=True, **kw)

if not (out / "agent.patch").exists():
    (out / "agent.patch").write_text(git("diff", "HEAD", "--", ".", ":(exclude).venv").stdout)
test_files = re.findall(r"^\+\+\+ b/(\S+)", inst["test_patch"], re.M)
existing = [f for f in test_files if (tree / f).exists() and git("ls-files", "--error-unmatch", f).returncode == 0]
if existing:
    git("checkout", "HEAD", "--", *existing)
applied = git("apply", "-", input=inst["test_patch"])
if applied.returncode:
    sys.exit(f"test patch failed: {applied.stderr}")

modules = inst.get("test_modules") or sorted({f[len("tests/"):-len(".py")].replace("/", ".") for f in test_files if f.startswith("tests/") and f.endswith(".py")})
run = subprocess.run(
    [str(tree / ".venv/bin/python"), "runtests.py", "--verbosity", "2", "--parallel", "1", *modules],
    cwd=tree / "tests", capture_output=True, text=True, timeout=1800,
)
log = run.stdout + run.stderr
(out / "test.log").write_text(log)

status = {}
for line in log.splitlines():
    m = re.match(r"^(.*?) \.\.\. (ok|FAIL|ERROR|skipped.*|expected failure|unexpected success)$", line)
    if not m:
        continue
    name = re.sub(r"^(\w+) \(([\w.]+)\.\1\)$", r"\1 (\2)", m.group(1).strip())
    status[name] = "pass" if m.group(2) in ("ok", "expected failure") or m.group(2).startswith("skipped") else "fail"

for m in re.finditer(r"^(?:FAIL|ERROR): (\w+) \(([\w.]+?)(?:\.\1)?\)", log, re.M):
    status[f"{m.group(1)} ({m.group(2)})"] = "fail"

def score(names):
    res = {n: status.get(n, "missing") for n in names}
    return {"passed": sum(v == "pass" for v in res.values()), "total": len(names), "results": res}

f2p = score(json.loads(inst["FAIL_TO_PASS"]))
p2p = score(json.loads(inst["PASS_TO_PASS"]))
result = {
    "instance": inst["instance_id"],
    "resolved": f2p["passed"] == f2p["total"] and p2p["passed"] == p2p["total"],
    "fail_to_pass": f2p,
    "pass_to_pass": p2p,
}
(out / "eval.json").write_text(json.dumps(result, indent=1))
print(json.dumps({k: (v if not isinstance(v, dict) else f"{v['passed']}/{v['total']}") for k, v in result.items()}))
