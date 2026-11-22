# Run 1 report — Telnyx Meet to Nuxt/Vue

Date: 2026-11-22

## Result so far

This run has produced a green Nuxt 3 shell, a faithful Vue landing slice, and the first Nuxt
server route slice on the isolated
`vue-fastvm-benchmark` branch. It has **not** completed the whole rewrite, so it is not counted as a
successful repository migration or a green pull request yet.

The accepted slice contains:

- the Nuxt 3, Vue 3 and TypeScript shell;
- the global application header;
- the landing page and its `/rooms` navigation contract;
- the error page;
- the room-list and room-detail server routes, including bounded upstream errors and room-id
  validation;
- the client-token, refresh-token and dial-out mutation routes;
- the responsive room-list page and reusable pagination component;
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
| Bounded MiniMax API/UI fanout | 3 | 480.052 s | 0 | Three workers reached reconciliation; artifact export failed |
| DeepSeek room API | 1 | 433.357 s | 0 | Candidate finished in 406.673 s; scope rejection; 15,949-byte patch captured |
| DeepSeek room UI + mutation APIs | 2 parallel | 585.441 s | 2 | Both candidates completed in scope; fleet returned to zero |

The accepted landing work therefore counts as an **operator-reviewed salvage**, not an autonomous
Hive completion. The accepted room API is also an operator-reviewed salvage: Hive correctly rejected
the candidate because it wrote generated Nuxt output and changed the test-discovery configuration
outside its contract. The operator reviewed the five-file reconciliation patch, accepted the four
route/test files, and separately accepted the Vitest discovery fix because existing `.spec.ts` tests
were otherwise silently omitted. Rejected candidates were not promoted merely because they contained
code.

The final two-worker wave is the first one that counts as autonomous Hive completion. The mutation
API worker finished in 388.955 seconds and the room-list worker in 584.218 seconds. Overall wall time
was 585.441 seconds, compared with 973.173 seconds if the two worker durations were serialized. The
operator then reviewed the candidates, removed redundant keyboard handlers from native buttons, and
deduplicated the test-only SFC compiler helper before integration. Those review edits are reported
separately rather than being attributed to the workers.

## Local gate timings

With dependencies already installed in an isolated Node 22 container, the accepted slice takes
approximately:

| Gate | Time |
| --- | ---: |
| ESLint | 0.57 s |
| Nuxt typecheck | 2.40 s |
| Focused Vitest suite | 0.33 s process time; 12 ms test time |
| Nuxt production build | 3.61 s |

After adding the room API slice, the integrated host run completed 18 tests across two files in about
one second; ESLint completed in 0.61 seconds, Nuxt typecheck in 1.93 seconds, and the production build
in 2.30 seconds. The host currently runs Node 24 while the repository requires Node 22, so local
verification used Yarn's `--ignore-engines` flag. FastVM workers continue to use the benchmark's
pinned Node 22 toolchain.

After the two-worker wave and review fixes, the integrated host run completed 62 tests across five
files in 1.04 seconds; ESLint completed in 0.65 seconds, Nuxt typecheck in 2.40 seconds, and the
production build in 2.95 seconds. Desktop and 390px mobile screenshots were also reviewed.

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
9. **Reconciliation must force-stage only its explicit allowlist.** Git still refused the export when
   an ignored `node_modules` directory existed, even though generated paths were excluded. The
   controller now uses forced staging together with explicit generated-output exclusions; 590 Hive
   tests pass after the fix.
10. **Test discovery is part of the migration contract.** The inherited Vitest configuration matched
    `.test.ts` only while accepted Vue tests used `.spec.ts`. The suite appeared green while omitting
    tests. Discovery now includes both forms and runs 18 tests.
11. **Provider latency still dominates.** The DeepSeek worker produced a coherent, fully tested room
    API, but model-backed work took 406.673 seconds while all local gates together took only a few
    seconds.
12. **Parallel work helps when ownership is clean.** The room UI and mutation APIs had disjoint write
    sets, completed independently, and saved about 388 seconds versus serial execution.
13. **Native controls should keep native semantics.** The pagination candidate added Enter and Space
    handlers to native buttons. In a real browser those handlers can run in addition to the native
    click and advance twice. Review removed them; executable tests alone did not expose the issue.
14. **Not every green gate may share one working directory concurrently.** Vitest briefly failed
    while Nuxt typecheck/build recreated `.nuxt/tsconfig.json`. Gate scheduling must model generated
    directory ownership or give mutating gates isolated worktrees.

## Required Hive changes before the next wave

- build a clean-source allowlist and automatic generated-output quarantine;
- inherit dependency read context when compiling downstream task contracts;
- emit heartbeat, first-mutation, command and last-progress timestamps;
- stop early once acceptance commands pass and the authorized diff is stable;
- classify salvageable timeout artifacts separately from completed work;
- enforce scope continuously, not only at final reconciliation;
- record install, model, first mutation, test, build, conflict, review and integration durations as
  separate metrics.
- prevent generated and ignored build output from entering the signed guest candidate in the first
  place, rather than filtering it only during reconciliation;
- validate that every committed test file matches the configured test-discovery patterns.

## Next benchmark

After these runtime changes, run two comparisons:

1. continue the remaining Telnyx Meet Vue migration using smaller contracts; and
2. run a deliberately small React project as a fast control.

The React control will show whether latency comes from Hive/model orchestration or from a particular
repository and build system. The same frozen brief, clean-room policy, evidence schema and green-PR
definition must be used for a fair comparison.
