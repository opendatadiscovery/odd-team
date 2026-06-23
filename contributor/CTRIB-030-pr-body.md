# Default lineage_depth to 1 in the contract so an omitted value no longer NPEs

Closes #1758

## Problem

A spec-compliant `GET /api/dataentities/{id}/lineage/downstream` (or `/upstream`) **without** `lineage_depth` returns **HTTP 500**. The parameter is declared optional, so it binds to a nullable `Integer`; the controller forwards it into `LineageServiceImpl.getLineage(long, int, …)`, whose depth argument is a **primitive `int`**. An omitted value autounboxes `null` → `NullPointerException`, thrown synchronously *before* the entity lookup, which the catch-all `@ExceptionHandler(Exception.class)` re-brands `SYS001` / HTTP 500. The most common first call against the endpoint (no depth) fails with an opaque server error.

Reproduced live (same non-existent id):
- `GET …/lineage/downstream` (no `lineage_depth`) → `500 {"code":"SYS001"}`
- `GET …/lineage/downstream?lineage_depth=1` → `404 {"code":"USR002"}` (reaches the service, 404s gracefully)

## Fix — in the contract, not in controller logic

The source of truth for the contract is the **Platform specification**, so the fix lives there: `odd-platform-specification/openapi.yaml` declares `default: 1` on `lineage_depth` for both per-entity lineage operations. The generator emits `@RequestParam(value = "lineage_depth", required = false, defaultValue = "1")`, so an omitted value binds to `1` and never reaches the service as `null`. No controller-side default logic is added — the contract carries the default.

`1` matches the UI's own default lineage view (`defaultLineageQuery.d = 1`) and the existing `minimum: 1`. (A default of `0` was considered and rejected: it conflicts with `minimum: 1`, so `@Min(1)` would reject the bound `0` and return HTTP 400 on the omitted call.)

## Tests

`LineageDepthDefaultTest` (`BaseIntegrationTest` + `@AutoConfigureWebTestClient`, real HTTP binding) — an omitted `lineage_depth` on a missing entity returns **404 USR002**, not **500 SYS001**, for both downstream and upstream; a control pins explicit `lineage_depth=1` to the same 404. Proven RED→GREEN by running it: on the base spec (no default) the two no-depth assertions fail (500); with `default: 1` all pass (404).

Integration (e2e): the existing lineage-depth-boundary contract test, which pinned the unset → 500 bug, is re-grounded to assert unset → **200** (the default-depth graph). It passes on the fix and still fails on `main` (unset → 500), so it regresses the fix rather than masking it.

## Regression

Rebased onto current `main`; the full set was then re-run on **one** isolated, serialized SUT built from this branch (machine-wide flock + per-stream isolation + teardown):
- Unit CI replica (`:odd-platform-api:build` = test + checkstyle + assemble): **green** — 593 tests, 0 failures; `LineageDepthDefaultTest` 3/3.
- `feature-complete`: **309 passed / 2 failed**, green for this change. The lineage-depth-boundary e2e is **green** (unset → 200). The 2 failures belong to an unrelated confirmation-dialog UI fix that is not yet on `main` — its two tests assert the fixed behaviour, so they fail on this branch's base; they fail identically on plain `main` and are not touched by this lineage change.
- `multi-stack`: **9 / 0 green**. `ingestion-e2e`: **6 / 0 green**. `known-bugs`: the known-bug pins stayed **RED as expected** (no un-flipped fix).

All four suites ran on the same SUT digest, built from this branch on top of current `main`.

## Scope

This PR is the crash fix only. Deliberately out of scope, tracked separately:
- The `@Max` cap + recursive-CTE cycle-guard (the unbounded-depth amplification hardening) — a distinct depth-bounding change.
- The lineage read-authorization question — per ODD's documented authorization model, metadata read access is granted to every authenticated user by design (no permission gates a GET endpoint), so this is not changed here; the `auth.type=DISABLED` anonymous-reachability point is a deployment-posture documentation caveat.

Milestone: 0.29.0
Docs: documentation@release/0.29.0 — the per-entity lineage pages' "omitting lineage_depth returns HTTP 500 / always pass an explicit value" caveat is updated to the new default-1 behaviour; publishes with the 0.29.0 release.
