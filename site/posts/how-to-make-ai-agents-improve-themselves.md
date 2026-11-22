---
title: 'How to Make AI Agents Improve Themselves: Build the Loop, Not the Changes'
description: 'A self-improving agent is a loop: record runs, grade them, propose one change, prove it beyond noise on a hold-out, shadow it, promote it. The human job moves from approving changes to building the validation, and a good loop says when it needs help.'
publishedAt: '2026-11-22T12:00:00.000Z'
updatedAt: '2026-11-22T12:00:00.000Z'
tags:
  - ai-agents
  - evals
  - continual-learning
  - llm
  - komodor
sourceUrl: 'https://blog.niradler.com/how-to-make-ai-agents-improve-themselves'
originalUrl: 'https://blog.niradler.com/how-to-make-ai-agents-improve-themselves'
cover: /media/how-to-make-ai-agents-improve-themselves/cover.png
coverAlt: 'A glowing teal loop track with measurement gates: most agent cores are rejected down chutes into a dim pit, and one core leaves the loop on an exit track glowing coral'
---
# How to Make AI Agents Improve Themselves: Build the Loop, Not the Changes

I work on agents that investigate production incidents at [Komodor](https://komodor.com). Most of my time this year went into one question: how do you make an agent improve itself, without a person reading every run and rewriting the prompt?

Writing a new version of an agent is cheap now. A prompt edit, a new skill, a cheaper model, a coding agent opening the PR. Knowing whether that version is better at the job is the expensive part. A self-improving agent is a loop that answers that question on its own, round after round, and keeps only the changes that prove themselves.

The idea is in the air. Software factories ([Dan Shapiro's five levels](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/), [StrongDM's team that doesn't review its own code](https://factory.strongdm.ai/)) turn specs into code and validate it against hold-out scenarios. Three days ago OpenAI described a [Performance Factory](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/) where Codex agents root-cause ChatGPT latency regressions and propose the fixes. Both use agents to improve software. This post points the same machinery at the agent itself.

## The loop

![Animated loop: production runs, grade, datasets, coach, candidate, replay, shadow, promote. Three candidates go around; two land inside the noise band at replay and drop into reverted, the third beats the noise and is promoted](/media/how-to-make-ai-agents-improve-themselves/loop.svg)

1. **Run.** Record every run: the input, the tool calls, the answer, tokens and time.
2. **Grade.** An evaluator scores every run against the outcome, with a written reason. People grade too, without extra work: when an engineer approves, edits or rejects the agent's conclusion, that is a label, and the edited answer is ground truth.
3. **Collect.** Graded runs become versioned datasets. Recordings keep the original tool results, so a replay touches nothing real. Public benchmarks sit next to them as an outside yardstick.
4. **Propose.** A coach agent reads the failures and the grader's reasons and proposes one change: a prompt edit, a skill, a narrower tool scope, a different model. It never sees the answer key. A coding agent can drive the same step from outside.
5. **Prove.** The change becomes a new revision, never an edit to the running agent. It replays on the dataset several times against a baseline whose noise was measured before the experiment started. It is kept only if the gain clears the noise and no other metric breaks its limit.
6. **Shadow.** The kept revision runs beside production on live traffic. The caller only hears production. A blinded judge grades both answers.
7. **Promote.** The winner becomes production, optionally through a sticky live split first. Promotion is a recorded revision, and the previous version stays as the fallback.

The new production runs feed step 1, and the next round starts.

## Two loops we ran

These are from our own agents, not a toy. In both, the student agent ran on a cheaper model, a coach agent on Opus proposed the changes, and a separate model applied them (once, by hand).

### Making an RCA agent faster on Cloud-OpsBench

The agent investigates Kubernetes incidents. The objective was speed: mean seconds per investigation, with two limits written down before the first run - accuracy must not drop beyond its noise, cost must not rise beyond its noise. The student was Haiku 4.5. The cases were split into train, validation and a test tier nobody looked at until the end.

The coach read the baseline's transcripts and described the student like a coach describes an athlete: it runs in two speeds, and the slow runs are mostly the wrong ones; once it is lost it keeps investigating instead of stopping; it speculates past a cause it already found; it writes long shell loops that hit the two-minute tool timeout.

The first coach ran four rounds. One was kept (-39% time on train, -46% on validation, cost -43%), three were reverted, and the loop stopped itself because two rounds in a row landed inside the noise band. A second coach, started from a baseline re-run under the production request shape, kept one round of three. Then the test tier, read once:

| Test tier (5 cases, 2 runs each) | Baseline | Champion |
| -------------------------------- | -------- | -------- |
| Mean time per investigation | 103 s | 64 s (-38%) |
| Cost per run | $0.286 | $0.154 (-46%) |
| Tool calls | 30.7 | 22.3 |
| Correct runs | 7/10 | 7/10 |

Same accuracy, a bit more than a third faster, a bit less than half the cost. Five test cases is small, and the speed is measured on recorded tool results, so it counts model turns and tool calls, not real cluster latency.

### Catching an accuracy gain that wasn't real

The second loop tried to make a bare Claude Code agent with a one-line prompt more accurate, on 31 incident cases captured from its own runs, each with an expected outcome.

Before changing anything we ran the baseline twice. It scored 20/31 and 21/31, and 5 cases flipped between the runs. That put the smallest detectable gain at 14 points. Most teams skip this step and would have promoted anything above 1.

- **Round 1: reverted.** The coach added an RCA procedure and an answer template. Accuracy moved 1.6 points, inside the band. Time dropped 23%, beyond its band, and the loop still reverted it: speed was not the objective.
- **Round 2: kept, then caught.** A better coach proposed a decision record at the top of the answer. Accuracy jumped 19 points, beyond the band. On 16 fresh cases written by an agent that knew nothing about the coach, it was +16 points: same direction, but inside that smaller set's noise, a sign test at p ≈ 0.38. Reading the transcripts explained why. The grader's partial-credit reasons described the expected answer's shape, and the coach had learned the grader, not the job.
- **Round 3: reverted.** We cut the coach off from the grader and gave it a critic that never sees the expected answer. Nothing leaked, accuracy stayed inside the band, and cost rose 37-55%. Reverted.

![Animated bars: on the 31 cases the coach saw, +19 points beats a 14 point noise band; on 16 fresh cases, +16 points stays inside a 20 point band](/media/how-to-make-ai-agents-improve-themselves/seen-vs-fresh.svg)

The real finding was not a better agent. The benchmark graded rules the agent's one-line prompt never told it, so the next step was to write the agent's job contract down and measure a new baseline. A loop that cannot get better is often telling you the test is wrong.

If you want to watch the whole cycle on your laptop, the smallest version is public: [komodorio/hello-world-continual-learning](https://github.com/komodorio/hello-world-continual-learning), a teacher, a student, a grader and a coach on four support tickets.

## The human builds the loop, not the changes

![Animated: four agents each circle their own improvement loop; cost-agent stops and raises a coral flag because two metrics trade, while rca-agent, triage-agent and review-agent keep running](/media/how-to-make-ai-agents-improve-themselves/one-loop-asks-for-help.svg)

In a software factory the engineer stops writing code and starts writing specs. In a self-improving loop the engineer stops approving changes and starts building the validation: the answer keys, the noise band, the hold-out, the limits on cost and time. That is the real work.

Once the validation is consistent, the loop can run fully automatic, from proposal to promotion. Gain above the noise band on a hold-out it never trained on, every other metric inside its limit: promote. Otherwise revert and try the next change.

A good loop also knows when it needs help, and asks for exactly that while everything else keeps running:

| The loop raises a hand when | Why it can't decide alone |
| --------------------------- | ------------------------- |
| Two metrics trade: more accurate, but more expensive per run | The trade is a business call |
| The model judge disagrees with human labels on the same runs | The grader is no longer trusted |
| A gain on training cases does not show on the hold-out | It is probably overfitting the answer key |
| Rounds keep landing inside the noise band | It needs more data or a different objective |
| Live traffic has no answer key, only a model judge | Nothing ground-truth to promote against |
| The budget is spent | Someone agreed to a number |

One flagged agent waits for an answer. The others keep improving. The human sets the objective, the limits and the budget once, reads the changelog, and answers the flags.

## What makes it work

1. **Write the outcome first.** One sentence a domain expert would sign, turned into a checklist scored item by item. Averaging a correct decision with a friendly tone lets a wrong answer pass.
2. **Take labels from work people already do.** Approvals and edits beat a labeling project nobody staffs.
3. **Measure the noise before you improve anything.** Run the same agent twice on the same cases and look at the spread. Five of 31 cases flipping between two identical runs is normal. Without the band you promote luck.
4. **Keep a hold-out you read once.** A coach can learn the grader instead of the job. Our 19-point gain shrank into the noise on fresh cases.
5. **Score the agent, not a proxy.** We watched validation loss improve while the agent's score dropped below the base model.
6. **Score like upstream does.** If a benchmark counts a timeout as a failure, so do you. Dropping timeouts as "infra" made our numbers look better than they were.
7. **Change one thing, as a revision.** Every change is a new version you can diff, replay, shadow and roll back.
8. **Make something try to disprove the result.** A blind judge, and a hold-out the coach never sees. Whatever proposes the change never grades it.
9. **Shadow before live, with side effects off.** A shadow agent must not restart a pod or post to Slack twice.
10. **Spend human time on the validation, then let go.**

## The hard part

![Animated: seven coaching rounds drop onto a chart with a gray noise band measured before round 1; rounds 2 and 5 land above it and are kept, the other five land inside it and are reverted](/media/how-to-make-ai-agents-improve-themselves/noise-band.svg)

Most of the loop produces nothing. Across the two coaches on Cloud-OpsBench, two rounds of seven were kept. The rest were correctly thrown away, and still paid for.

Replay needs recorded tool results, and an agent that does something new mid-investigation runs off the end of the recording. The grader is a model, so compare it with human verdicts before trusting its numbers. A blind judge hides the author; it does not make the judgment right.

A fully automatic loop on a benchmark will overfit that benchmark. When we trained a model on its own corrected sessions, the gain sat on the cases it trained on, and the rest barely moved. The hold-out is the only thing standing between "automatic" and "automatically wrong".

What is the outcome your agents are hired for, and how many of last week's changes to them could you prove made it better?
