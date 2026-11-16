import argparse, json, random
from pathlib import Path

p = argparse.ArgumentParser(description="Build an anonymized review packet from every evaluated run")
p.add_argument("--root", default="/tmp/agent-race")
p.add_argument("--seed", type=int, default=15957)
a = p.parse_args()
root = Path(a.root)
inst = json.loads((root / "swe/instance.json").read_text())

runs = sorted(r for r in (root / "runs").glob("*-[0-9]*") if (r / "eval/agent.patch").exists())
letters = [chr(ord("A") + i) for i in range(len(runs))]
random.Random(a.seed).shuffle(runs)
key = {l: r.name for l, r in zip(letters, runs)}

parts = [
    "You are reviewing candidate patches for one Django issue. The patches were written by different automated agents; "
    "you are not told which. Correctness is measured separately by hidden tests, so do not run anything. Judge code quality only.\n",
    f"## Issue\n\n{inst['problem_statement'].strip()}\n",
    "## Patch merged upstream (reference only, not the only acceptable design)\n\n```diff\n" + inst["patch"] + "```\n",
    "## Rubric\n\nScore each patch 1-10 on each criterion:\n"
    "- design: does the approach fit Django's architecture and solve the problem at the right layer\n"
    "- robustness: edge cases (negative or open-ended slices, step slices, ordering, databases without window functions, to_attr vs cache)\n"
    "- scope: changes only what the issue needs; no unrelated edits, debug leftovers, or dead code\n"
    "- readability: names, structure, consistency with surrounding code\n"
    "- tests: quality and coverage of any tests the patch adds (1 if none)\n\n"
    "Then give an overall 1-10 and one sentence of justification per patch.\n",
    'Reply with JSON only: {"<letter>": {"design": n, "robustness": n, "scope": n, "readability": n, "tests": n, "overall": n, "why": "..."}, ...}\n',
]
for letter, run in zip(letters, runs):
    parts.append(f"## Patch {letter}\n\n```diff\n{(run / 'eval/agent.patch').read_text()}```\n")

out = root / "judge"
out.mkdir(exist_ok=True)
(out / "packet.md").write_text("\n".join(parts))
(out / "key.json").write_text(json.dumps(key, indent=1))
print(f"{len(runs)} patches -> {out / 'packet.md'} ({len((out / 'packet.md').read_text())} chars)")
