#!/bin/bash
set -u
cd /tmp/agent-race2
for run in 1 2; do
  for task in 37330 37361 37263; do
    for arm in cc-told cc-blind codex-told codex-blind; do
      python3 bin/race-run.py --task $task --arm $arm --run $run > logs/$task-$arm-$run.log 2>&1 &
    done
    wait
    for arm in cc-told cc-blind codex-told codex-blind; do
      python3 bin/swe-eval.py --tree runs/$task/$arm-$run/repo --instance tasks/$task/instance.json --out runs/$task/$arm-$run/eval >> logs/eval.log 2>&1
    done
    echo "done $task round $run $(date +%T)" >> logs/progress.log
  done
done
echo ALL_DONE >> logs/progress.log
