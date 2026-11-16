import argparse, json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

p = argparse.ArgumentParser(description="Render the fresh-ticket race charts from results.json and the judge scores")
p.add_argument("--experiment", default="experiments/agent-race-fresh")
p.add_argument("--out", required=True)
a = p.parse_args()
exp = Path(a.experiment)
out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)

ARMS = {
    "cc-told": ("Claude Code, told", "#2a78d6"),
    "cc-blind": ("Claude Code, not told", "#8fb8ea"),
    "codex-told": ("Codex, told", "#1baf7a"),
    "codex-blind": ("Codex, not told", "#8fd9bd"),
}
TASKS = {
    "37330": "Annotation transform crash",
    "37361": "Chained permission renames",
    "37263": "Admin search over-matching",
}
SURFACE, INK, MUTED, GRID = "#fafafa", "#0b0b0b", "#52514e", "#e4e3df"
plt.rcParams.update({
    "font.family": ["IBM Plex Sans", "Helvetica Neue", "Arial", "sans-serif"],
    "font.size": 12, "text.color": INK, "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.edgecolor": GRID, "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
})


def frac(s):
    n, d = s.split("/")
    return int(n) / int(d)


rows = json.loads((exp / "results.json").read_text())

fig, ax = plt.subplots(figsize=(10, 5.6), dpi=160)
for arm, (label, color) in ARMS.items():
    for r in (r for r in rows if r["arm"] == arm):
        ax.scatter(r["wall_seconds"] / 60, r["cost_usd"], s=110, zorder=3, linewidths=2, color=color)
ax.set_yscale("log")
ax.set_xlim(0, 14)
ax.set_ylim(0.02, 3)
ax.set_yticks([0.025, 0.05, 0.1, 0.25, 0.5, 1, 2])
ax.set_yticklabels(["$0.025", "$0.05", "$0.10", "$0.25", "$0.50", "$1", "$2"])
ax.set_xlabel("Wall-clock time (minutes)")
ax.set_ylabel("Cost per run (USD, log scale)")
ax.grid(True, color=GRID, linewidth=1, zorder=0)
for side in ("top", "right"):
    ax.spines[side].set_visible(False)
ax.set_title("24 runs on three fresh Django tickets: time vs cost", loc="left", fontsize=15, pad=12)
ax.legend(
    handles=[plt.Line2D([], [], marker="o", linestyle="", markersize=10, color=c, label=l) for l, c in ARMS.values()],
    loc="center right", frameon=False,
)
fig.tight_layout()
fig.savefig(out / "fresh-time-vs-cost.png")

fig, axes = plt.subplots(1, 3, figsize=(12, 4.6), dpi=160, sharey=True)
for ax, (task, title) in zip(axes, TASKS.items()):
    for x, (arm, (label, color)) in enumerate(ARMS.items()):
        values = [frac(r["specified_fail_to_pass"]) for r in rows if r["arm"] == arm and r["task"] == task]
        ax.bar(x, sum(values) / len(values), width=0.65, color=color, zorder=2)
        ax.scatter([x] * len(values), values, s=36, color=INK, zorder=3, linewidths=0)
    ax.set_title(f"{title} (#{task})", loc="left", fontsize=12)
    ax.set_xticks(range(len(ARMS)))
    ax.set_xticklabels(["CC\ntold", "CC\nnot told", "Codex\ntold", "Codex\nnot told"], fontsize=10)
    ax.set_ylim(0, 1.08)
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1])
    ax.set_yticklabels(["0%", "25%", "50%", "75%", "100%"])
    ax.grid(True, axis="y", color=GRID, linewidth=1, zorder=0)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
axes[0].set_ylabel("Hidden tests passed")
fig.text(0.01, 0.01, "Share of the hidden tests the issue text specifies. Bars are the mean of two runs; dots are individual runs.", color=MUTED, fontsize=10)
fig.tight_layout(rect=(0, 0.05, 1, 1))
fig.savefig(out / "fresh-tests-by-ticket.png")
print(sorted(p.name for p in out.glob("*.png")))
