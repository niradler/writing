import argparse, csv, io, json, re, shutil, subprocess, tarfile, urllib.request
from pathlib import Path

p = argparse.ArgumentParser(description="Build a SWE-bench-style instance from a Django fix commit")
p.add_argument("--repo", required=True)
p.add_argument("--commit", required=True)
p.add_argument("--ticket", type=int, required=True)
p.add_argument("--out", required=True)
p.add_argument("--python", default="3.12")
a = p.parse_args()

repo = Path(a.repo).resolve()
out = Path(a.out).resolve()
if out.exists():
    raise SystemExit(f"{out} exists")
git = lambda *args: subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout
fix = git("rev-parse", a.commit).strip()
base = git("rev-parse", f"{fix}^").strip()
patch = git("diff", base, fix, "--", "django/")
test_patch = git("diff", base, fix, "--", "tests/")

raw = urllib.request.urlopen(f"https://code.djangoproject.com/ticket/{a.ticket}?format=tab").read().decode("utf-8-sig")
ticket = next(csv.DictReader(io.StringIO(raw), delimiter="\t"))
problem = f"{ticket['summary'].strip()}\n\n{ticket['description'].strip()}"


def checkout(dest):
    dest.mkdir(parents=True)
    archive = subprocess.run(["git", "-C", str(repo), "archive", base], capture_output=True, check=True).stdout
    tarfile.open(fileobj=io.BytesIO(archive)).extractall(dest, filter="data")
    run = lambda *c: subprocess.run(c, cwd=dest, check=True, capture_output=True)
    run("git", "init", "-q")
    run("git", "add", "-A")
    run("git", "-c", "user.name=base", "-c", "user.email=base@example.com", "commit", "-q", "-m", f"Django at {base[:10]}")
    (dest / ".git/info/exclude").write_text(".venv\n")
    run("uv", "venv", "-q", "-p", a.python, ".venv")
    run("uv", "pip", "install", "-q", "-p", ".venv/bin/python", "-e", ".")


def statuses(tree, patches):
    for pt in patches:
        subprocess.run(["git", "apply", "-"], cwd=tree, input=pt, text=True, check=True)
    modules = sorted({f[len("tests/"):-3].replace("/", ".") for f in re.findall(r"^\+\+\+ b/(\S+)", test_patch, re.M) if re.search(r"/tests?(_\w+)?\.py$|/test_\w+\.py$", f)})
    r = subprocess.run([str(tree / ".venv/bin/python"), "runtests.py", "--verbosity", "2", "--parallel", "1", *modules], cwd=tree / "tests", capture_output=True, text=True, timeout=1800)
    log = r.stdout + r.stderr
    st = {}
    for line in log.splitlines():
        m = re.match(r"^(.*?) \.\.\. (ok|FAIL|ERROR|skipped.*|expected failure|unexpected success)$", line)
        if m:
            name = re.sub(r"^(\w+) \(([\w.]+)\.\1\)$", r"\1 (\2)", m.group(1).strip())
            st[name] = "pass" if m.group(2) in ("ok", "expected failure") or m.group(2).startswith("skipped") else "fail"
    for m in re.finditer(r"^(?:FAIL|ERROR): (\w+) \(([\w.]+?)(?:\.\1)?\)", log, re.M):
        st[f"{m.group(1)} ({m.group(2)})"] = "fail"
    return st, modules


out.mkdir(parents=True)
checkout(out / "base")
work = out / "_check"
shutil.copytree(out / "base", work / "before", symlinks=True)
shutil.copytree(out / "base", work / "after", symlinks=True)
for t in ("before", "after"):
    tree = work / t
    shutil.rmtree(tree / ".venv")
    subprocess.run(["uv", "venv", "-q", "-p", a.python, ".venv"], cwd=tree, check=True)
    subprocess.run(["uv", "pip", "install", "-q", "-p", ".venv/bin/python", "-e", "."], cwd=tree, check=True)
before, modules = statuses(work / "before", [test_patch])
after, _ = statuses(work / "after", [test_patch, patch])
f2p = sorted(n for n, s in after.items() if s == "pass" and before.get(n) != "pass")
p2p = sorted(n for n, s in after.items() if s == "pass" and before.get(n) == "pass")
broken = sorted(n for n, s in after.items() if s != "pass")
instance = {
    "instance_id": f"django__django-ticket-{a.ticket}",
    "repo": "django/django",
    "ticket": a.ticket,
    "ticket_url": f"https://code.djangoproject.com/ticket/{a.ticket}",
    "fix_commit": fix,
    "base_commit": base,
    "python": a.python,
    "test_modules": modules,
    "problem_statement": problem,
    "patch": patch,
    "test_patch": test_patch,
    "FAIL_TO_PASS": json.dumps(f2p),
    "PASS_TO_PASS": json.dumps(p2p),
}
(out / "instance.json").write_text(json.dumps(instance, indent=1))
shutil.rmtree(work)
print(json.dumps({"instance": instance["instance_id"], "base": base[:10], "modules": modules, "fail_to_pass": len(f2p), "pass_to_pass": len(p2p), "failing_after_fix": broken[:5]}))
