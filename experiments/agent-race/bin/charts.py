import argparse, json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

p = argparse.ArgumentParser(description="Render the agent-race charts from results.json and the judge scores")
p.add_argument("--experiment", default="experiments/agent-race")
p.add_argument("--out", required=True)
a = p.parse_args()
exp = Path(a.experiment)
out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)

ARMS = {
    "cc-told": ("Claude Code + Sonnet 5, told", "#2a78d6"),
    "cc-blind": ("Claude Code + Sonnet 5, not told", "#eb6834"),
    "codex-told": ("Codex + GPT-6.1 Terra, told", "#1baf7a"),
}
SURFACE, INK, MUTED, GRID = "#fafafa", "#0b0b0b", "#52514e", "#e4e3df"
plt.rcParams.update({
    "font.family": ["IBM Plex Sans", "Helvetica Neue", "Arial", "sans-serif"],
    "font.size": 12, "text.color": INK, "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.edgecolor": GRID, "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
})

rows = json.loads((exp / "results.json").read_text())
key = json.loads((exp / "judge/key.json").read_text())
judges = [json.loads((exp / f"judge/{j}.json").read_text()) for j in ("opus", "codex")]
quality = {run: sum(j[letter]["overall"] for j in judges) / len(judges) for letter, run in key.items()}

fig, ax = plt.subplots(figsize=(10, 5.6), dpi=160)
for arm, (label, color) in ARMS.items():
    runs = [r for r in rows if r["arm"] == arm]
    for i, r in enumerate(runs):
        ax.scatter(
            r["wall_seconds"] / 60, r["cost_usd"], s=110, zorder=3, linewidths=2,
            facecolors=color if r["resolved"] else SURFACE, edgecolors=color,
        )
ax.set_yscale("log")
ax.set_xlim(0, 20)
ax.set_ylim(0.04, 8)
ax.set_yticks([0.05, 0.1, 0.25, 0.5, 1, 2.5, 5])
ax.set_yticklabels(["$0.05", "$0.10", "$0.25", "$0.50", "$1", "$2.50", "$5"])
ax.set_xlabel("Wall-clock time (minutes)")
ax.set_ylabel("Cost per run (USD, log scale)")
ax.grid(True, color=GRID, linewidth=1, zorder=0)
for side in ("top", "right"):
    ax.spines[side].set_visible(False)
ax.set_title("Nine runs on django__django-15957: time vs cost", loc="left", fontsize=15, pad=28)
ax.text(0, 1.02, "Filled = resolved (all hidden tests pass). Hollow = not resolved.", transform=ax.transAxes, color=MUTED, fontsize=11)
ax.legend(
    handles=[plt.Line2D([], [], marker="o", linestyle="", markersize=10, color=c, label=l) for l, c in ARMS.values()],
    loc="lower right", frameon=False,
)
fig.tight_layout()
fig.savefig(out / "time-vs-cost.png")

fig, axes = plt.subplots(1, 3, figsize=(12, 4.6), dpi=160)
panels = [
    ("Wall-clock time (min)", lambda r: r["wall_seconds"] / 60, "{:.1f}"),
    ("Cost per run (USD)", lambda r: r["cost_usd"], "${:.2f}"),
    ("Blind review, overall (1-10)", lambda r: quality[f"{r['arm']}-{r['run']}"], "{:.1f}"),
]
for ax, (title, metric, fmt) in zip(axes, panels):
    for x, (arm, (label, color)) in enumerate(ARMS.items()):
        values = [metric(r) for r in rows if r["arm"] == arm]
        mean = sum(values) / len(values)
        ax.bar(x, mean, width=0.6, color=color, zorder=2)
        ax.scatter([x] * len(values), values, s=36, color=INK, zorder=3, linewidths=0)
    top = max(metric(r) for r in rows) * 1.25
    ax.set_ylim(0, top)
    for x, arm in enumerate(ARMS):
        values = [metric(r) for r in rows if r["arm"] == arm]
        ax.text(x, max(values) + top * 0.04, fmt.format(sum(values) / len(values)), ha="center", va="bottom", fontsize=11, color=INK)
    ax.set_title(title, loc="left", fontsize=13)
    ax.set_xticks(range(3))
    ax.set_xticklabels(["CC told", "CC not told", "Codex told"])
    ax.grid(True, axis="y", color=GRID, linewidth=1, zorder=0)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
fig.text(0.01, 0.01, "Bars are the mean of three runs; dots are individual runs. Review score averages an Opus 5.5 judge and a GPT-6.1 Sol judge.", color=MUTED, fontsize=10)
fig.tight_layout(rect=(0, 0.05, 1, 1))
fig.savefig(out / "means-by-competitor.png")
print(sorted(p.name for p in out.glob("*.png")))
