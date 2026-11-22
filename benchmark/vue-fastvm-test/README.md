# Telnyx Meet Vue FastVM benchmark

This directory defines the immutable workload input for Hive's second external coding benchmark.
The task is a real framework migration: rewrite the legacy Next.js/React Telnyx Meet sample as a
Nuxt 3/Vue 3 application while preserving its supported meeting behavior and server-side secret
boundary.

The files in this directory are the workload contract, not an implementation plan. Hive must inspect
the repository, discover the architecture and behavior, derive dependency and conflict graphs,
allocate FastVM agents, compare candidates, integrate accepted changes, and return replayable
evidence. Hand-writing the implementation tickets here would bypass the part of Hive being tested.

## Frozen input

- Repository: `https://github.com/isaacakakpo1/telnyx-meet`
- Upstream reference: `https://github.com/team-telnyx/telnyx-meet`
- Base commit: `4831bd27ef10fb12542b9a187853b94e6b559bea`
- Target branch: `vue-fastvm-benchmark`
- Product target: Nuxt 3, Vue 3, TypeScript, Composition API
- Authority: work only in the fork and target branch; never push to upstream or either repository's
  `main` branch

The machine-readable mission is in [`mission-brief.json`](mission-brief.json). Observable gates are
in [`acceptance-gates.json`](acceptance-gates.json). Changing either digest creates a new benchmark
version rather than silently moving the finish line.

## Behavior boundary

The source application is more than a set of React components. It includes:

- landing, room discovery, room join, and pre-join media preview;
- secure server routes for room listing, room lookup, join-token generation, token refresh, and
  dial-out;
- Telnyx Video SDK initialization and room lifecycle events;
- camera, microphone, device selection, screen share, audio output, virtual background, and
  diagnostics controls;
- participant grids, active-speaker ordering, presentation layout, mixed audio, chat, invitations,
  WebRTC statistics, network metrics, reconnect behavior, notifications, and error states;
- query-controlled optional features and PWA assets.

The Vue rewrite must preserve supported behavior rather than merely reproduce the visible landing
page. Known source defects may be repaired when a regression test demonstrates the intended
behavior; they must not be silently copied or silently omitted.

## Fairness boundary

The same base commit, mission digest, visible gates, sealed hidden gates, budget, and observation
window must be used for the Hive run and the single-agent AFK baseline. The primary score remains
merged green pull requests per hour and per dollar. Secondary evidence includes changed lines,
planning/model/CI time, conflicts, retries, abandoned candidates, and final feature coverage.

Real Telnyx credentials, production rooms, and external calls are not required. Automated tests must
use a deterministic SDK and HTTP boundary. A small operator-owned manual smoke test may be run later
with separate credentials, but it is not allowed to replace automated acceptance evidence.

## Evidence expected from Hive

1. Repository discovery plus generated task, dependency, file-conflict, and symbol-ownership graphs.
2. Every assignment, runtime, sandbox, lease, intended write set, model duration, cost, and outcome.
3. Candidate comparisons and the evidence used to select, combine, retry, or abandon each route.
4. Build, type, lint, unit, component, end-to-end, review, integration, and conflict evidence.
5. A replayable event ledger and an empty FastVM fleet after cleanup.
6. Pull requests targeting `vue-fastvm-benchmark`, with no mutation of upstream or `main`.

