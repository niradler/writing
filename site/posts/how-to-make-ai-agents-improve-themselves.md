---
title: 'How We Make AI Agents Improve Themselves'
description: 'The loop we use at Komodor to improve our incident-investigation agents: record and grade runs, let a coach propose one change, keep it only if it beats measured noise on cases it never saw, shadow it, promote it. A real run, ten practices with evidence from other agent factories, and what is still hard.'
publishedAt: '2026-11-22T12:00:00.000Z'
updatedAt: '2026-11-23T12:00:00.000Z'
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
# How We Make AI Agents Improve Themselves

At [Komodor](https://komodor.com) we build agents that investigate production incidents. This year we worked on getting those agents to improve themselves, without someone reading every run and rewriting the prompt by hand.

Producing a new version of an agent is cheap now. Someone edits the prompt, adds a skill or swaps in a cheaper model, or a coding agent opens the PR. Knowing whether that version does the job better is where the time goes. The loop below answers that automatically and keeps only the changes that hold up.

Other teams are building the same kind of machine for software. [Dan Shapiro's five levels](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/) end at a "dark factory" that turns specs into code nobody reads, and [StrongDM](https://factory.strongdm.ai/) runs a team that works that way, checking the output against scenarios kept outside the codebase. In November OpenAI described a [Performance Factory](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/) in which Codex agents root-cause ChatGPT latency regressions and propose the fixes. Our loop applies the same idea to the agents themselves.

## The loop

![Animated loop: production runs, grade, datasets, coach, candidate, replay, shadow, promote. Three candidates go around; two land inside the noise band at replay and drop into reverted, the third beats the noise and is promoted](/media/how-to-make-ai-agents-improve-themselves/loop.svg)

1. Run: we record every run, with its input, tool calls, answer, tokens and time.
2. Grade: an evaluator scores each run against the outcome and writes down why. Engineers grade too, as a side effect of their work: approving, editing or rejecting the agent's conclusion is a label, and an edited answer becomes ground truth.
3. Collect: graded runs go into versioned datasets. A recording keeps the original tool results, so replaying it touches no real cluster. Public benchmarks sit alongside as an outside reference.
4. Propose: a coach agent reads the failures and the grader's notes and proposes a change: a prompt edit, a skill, a narrower tool scope, a different model. It never gets the expected answers. The grader's notes can still give them away, so every proposal goes through a leak check, and anything that echoes a specific case waits for a person to clear it.
5. Prove: the change becomes a new revision; the running agent is never edited in place. The revision is replayed on the dataset several times and compared with a baseline whose noise we measured before the experiment started. It is kept only if the gain is larger than that noise and no other metric crosses its limit.
6. Shadow: a kept revision runs next to production on live traffic. Callers only ever get production's answer, and a judge grades both without knowing which is which.
7. Promote: the winner becomes production, sometimes through a gradual live split first. The previous version stays as the fallback.

New production runs feed step 1 again.

## One loop, start to finish

This is a real run on our Kubernetes root-cause agent, on the Cloud-OpsBench benchmark. The agent ran on Haiku 4.5, the coach on Opus, and a third model applied the coach's changes to the agent's code and prompt.

The goal was speed: mean seconds per investigation. Before the first run we wrote down two limits, that accuracy and cost could not get worse by more than their measured noise. The cases were split into 25 for training, 25 for validation and 5 for a test set we looked at once, at the end.

Measuring the baseline showed where the time went. Wrong answers averaged 132 seconds and right ones 69. When the agent got lost it kept investigating, and it wrote long shell loops that ran into the two-minute tool timeout.

A first coach kept one round out of four. Its kept version lost 3 correct runs on the training set, inside the limit, and it had also deleted two instructions from the prompt that the benchmark never exercises. A person caught those in review and put them back. The first baseline had sent free-text requests, so we re-ran it with the request format production uses, and started a second coach revised so it may only remove an instruction when it has evidence the instruction hurts.

The second coach's first round was kept and the next two were reverted. One of the reverted rounds capped every investigation at 150 seconds. Runs got shorter, and accuracy dropped on 7 cases while improving on 1, because the cap cut hard investigations off before they reached the cause. The accuracy limit rejected that round.

The kept version against the same baseline, two runs per case:

| Set | Mean time | Correct runs |
| --- | --- | --- |
| Train, 25 cases | 89 s → 59 s | 37 → 41 |
| Validation, 25 cases | 71 s → 52 s | 48 → 48 |
| Test, 5 cases, read once | 103 s → 64 s | 7 of 10 → 7 of 10 |

Cost per run fell 37-46% across the three sets; on the test set it went from $0.286 to $0.154.

The test set on its own is too small to say anything about accuracy, since ten runs can't tell 7 correct from 8. The evidence that accuracy held comes from train and validation: across those 50 cases, 5 gained correct runs and 2 lost some. On the test set, one case went from 1 correct run to 2, one went from 2 to 1, and one failed every time before and after, while every case got faster on average. The timings come from recorded tool output, so they measure model turns and tool calls, and say nothing about real kubectl latency.

If you want to run a small version of the whole cycle on a laptop, [komodorio/hello-world-continual-learning](https://github.com/komodorio/hello-world-continual-learning) has a teacher, a student, a grader and a coach working on four support tickets.

## Where people fit

![Animated: four agents each circle their own improvement loop; cost-agent stops and raises a coral flag because two metrics trade, while rca-agent, triage-agent and review-agent keep running](/media/how-to-make-ai-agents-improve-themselves/one-loop-asks-for-help.svg)

When the factory improves agents, engineers stop approving changes and build what the changes are judged by: the expected answers, the noise measurement, the held-out set, the limits on cost and time. Once that is solid, the loop can run from proposal to promotion without a person, except in the cases below. A change that beats the noise on cases it never trained on, with every other metric inside its limit, gets promoted, and anything else gets reverted.

The loop should also say when it can't decide, and pause only the agent that is stuck:

| The loop asks for help when | Because |
| --- | --- |
| Two metrics trade: more accurate, but more expensive per run | That trade is a business decision |
| The model judge disagrees with human labels on the same runs | The grader can't be trusted until someone looks |
| A gain on training cases doesn't show up on held-out cases | It is probably fitting the benchmark |
| Round after round lands inside the noise | It needs more data or a different goal |
| Live traffic has no expected answers, only a model judge | There is nothing solid to promote against |
| The budget is spent | Someone agreed to that number |

Write down which steps need a person and automate everything else. OpenAI's Performance Factory does this with a workflow configuration that lists the steps needing an engineer. A person sets the goal, limits and budget once, then reads the changelog and answers flags.

## What we think works

1. Grade the outcome item by item. Write the outcome as one sentence a domain expert would agree with, turn it into a checklist, and score each item separately, because an average lets a friendly tone cover for a wrong decision. Anthropic's [guide to agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) gives the same advice and recommends grading what the agent produced over the path it took.
2. Start from real runs and real failures. Record traces, treat every approval, edit or rejection by a person as a label, and keep every failure as a regression case. Anthropic suggests starting with 20-50 tasks drawn from real failures. OpenAI evaluates its Performance Factory agents by backtesting them on past incidents.
3. Measure the noise before changing anything. Run the baseline more than once on the same cases and keep a change only if its gain is larger than that spread. One pass tells you little: an agent that succeeds 75% of the time on a task gets all three of three tries right only about 42% of the time (Anthropic's example).
4. Keep a held-out set the loop never sees, and read it once. StrongDM keeps its scenarios outside the codebase for the same reason, so agents can't pass by writing tests that [simply assert true](https://simonwillison.net/2026/Feb/7/software-factory/). Make it large enough: in the run above, five test cases were too few to tell 7 correct runs from 8.
5. Separate who proposes from who grades, and have something argue against the result. Google's [agent quality flywheel](https://developers.googleblog.com/driving-the-agent-quality-flywheel-from-your-coding-agent/) never lets the optimizer grade its own fix, and OpenAI runs a separate Codex session whose only job is to disprove each diagnosis.
6. Check the grader against people, and check what the coach can learn from it. A model judge drifts, and its written reasons can reveal the expected answer to anything learning from them. That is why the Propose step runs a leak check. Compare the judge with human verdicts on a sample, and trust changes in its score more than its absolute numbers.
7. Score the agent the way the outside world would. If a benchmark counts a timeout as a failure, count it too; we once dropped timeouts as infrastructure errors and our numbers looked better than they were. Score the agent itself over a proxy: we have watched validation loss improve while the agent got worse.
8. Keep the agent in git and change one thing per revision. Prompt, skills, tools and model all live in version control, so every change can be diffed, replayed, shadowed and rolled back. Warp lists configuration kept outside git as a common reason [self-improvement loops fail](https://www.warp.dev/articles/self-improvement-loop-software-factory).
9. Shadow before going live, with side effects off: a shadow agent must never restart a pod or post a second Slack message.

## What is still hard

![Animated: seven coaching rounds drop onto a chart with a gray noise band measured before round 1; rounds 2 and 5 land above it and are kept, the other five land inside it and are reverted](/media/how-to-make-ai-agents-improve-themselves/noise-band.svg)

In the speed run, most rounds produced nothing: across the two coaches, two of seven were kept. The others were correctly thrown away, and we still paid for them. OpenAI reports its own limits: when it hand-graded 100 of its agents' root causes, 70 were accurate, and the agents' fixes were sometimes more complicated than needed.

Replay depends on recorded tool output. If the agent tries something new halfway through an investigation, it runs past the end of the recording. The grader is a model, so we compare it with human verdicts before trusting its scores, and hiding which version wrote an answer doesn't make the judgment correct.

Gains can stay on the training cases. When we fine-tuned a model on its own corrected sessions, the gain barely showed on cases it had not trained on.

Which of last week's changes to your agents could you show made them better?
