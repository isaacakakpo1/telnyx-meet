# Run 1 report — Telnyx Meet to Nuxt/Vue

Date: 2026-11-22

## Result so far

This run has produced a green Nuxt 3 shell and a faithful Vue landing slice on the isolated
`vue-fastvm-benchmark` branch. It has **not** completed the whole rewrite, so it is not counted as a
successful repository migration or a green pull request yet.

The accepted slice contains:

- the Nuxt 3, Vue 3 and TypeScript shell;
- the global application header;
- the landing page and its `/rooms` navigation contract;
- the error page;
- executable Vue component tests;
- passing lint, typecheck, unit-test and production-build gates.

The source Next.js application and `main` branch remain untouched.

## Honest swarm score

| Wave | Live workers | Wall time | Autonomous completions | Result |
| --- | ---: | ---: | ---: | --- |
| Coarse Qwen implementation | 3 | 1,800.777 s | 0 | Timed out; reconciliation patches captured |
| Micro Qwen implementation | 4 | 722.357 s | 0 | Timed out; four candidate patches captured |
| DeepSeek test repairs | 2 sequential | 706.770 s total | 0 | One salvageable edit; one provider failure |
| MiniMax test-harness repair | 1 | 237.991 s | 0 | Salvageable test patch; runtime marked failed |
| GLM header repair | 1 | 347.926 s | 0 | Provider failure; no patch |
| MiniMax header repair | 1 | 365.433 s | 0 | Salvageable 987-byte patch; runtime timed out |

The accepted landing work therefore counts as an **operator-reviewed salvage**, not an autonomous
Hive completion. The action-route candidate was rejected rather than being promoted merely because
it contained code.

## Local gate timings

With dependencies already installed in an isolated Node 22 container, the accepted slice takes
approximately:

| Gate | Time |
| --- | ---: |
| ESLint | 0.57 s |
| Nuxt typecheck | 2.40 s |
| Focused Vitest suite | 0.33 s process time; 12 ms test time |
| Nuxt production build | 3.61 s |

The build system is therefore not the dominant cost in this Vue run. Model-backed inspection and
editing consumed roughly 238–365 seconds for the small repair contracts and 720 seconds for each
micro implementation contract.

## Findings

1. **Contracts were still too broad.** The coarse wave caused long inspection and oversized patches.
2. **Generated output polluted scope checks.** `.nuxt`, `.output` and legacy `.next` files must be
   quarantined before diff, lint and ownership evaluation.
3. **Dependency context was incomplete.** The landing task depended on the Nuxt shell but its read
   set did not include `app.vue`, allowing the candidate to create a second header.
4. **A timeout can still contain useful work.** Hive needs separate states for autonomous success,
   failed-with-no-artifact and timed-out-with-reviewable-artifact.
5. **Workers provide too little progress evidence.** Receipts remained at `provider_started`; the
   operator could not see first mutation, current command or why the worker was still running.
6. **Workers do not stop when the contract is already satisfied.** Small repairs continued for
   minutes after the required files existed.
7. **Visual review remains necessary.** Tests passed while the error page still duplicated the
   global header. The screenshot review found it before integration.
8. **Stale build output can create fake failures.** The first integrated lint run reported more than
   4,000 errors from the legacy `.next` directory; removing generated output made every source gate
   green.

## Required Hive changes before the next wave

- build a clean-source allowlist and automatic generated-output quarantine;
- inherit dependency read context when compiling downstream task contracts;
- emit heartbeat, first-mutation, command and last-progress timestamps;
- stop early once acceptance commands pass and the authorized diff is stable;
- classify salvageable timeout artifacts separately from completed work;
- enforce scope continuously, not only at final reconciliation;
- record install, model, first mutation, test, build, conflict, review and integration durations as
  separate metrics.

## Next benchmark

After these runtime changes, run two comparisons:

1. continue the remaining Telnyx Meet Vue migration using smaller contracts; and
2. run a deliberately small React project as a fast control.

The React control will show whether latency comes from Hive/model orchestration or from a particular
repository and build system. The same frozen brief, clean-room policy, evidence schema and green-PR
definition must be used for a fair comparison.
