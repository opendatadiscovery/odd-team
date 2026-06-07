---
id: IT-076
title: "Lineage Compact/Full toggle renders the canvas distinctly and round-trips via ?full="
gates:
  validates: [F-186]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:lineage-view-mode-toggle.spec.ts"
plan_ref: I6
status: ready
---

# IT-076 — Lineage Canvas Compact/Full View-Mode Toggle (F-186)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Hierarchy lineage canvas exposes a Compact/Full AppTabs control (`LineageControls.tsx`, default
`full=true`). The two modes render the node DETAIL distinctly: with an externalName, FULL renders the
"Space" + "Source" attribute rows (+ the data source name); COMPACT drops them (Info.tsx falls through to
null for the detail block). The node title renders in both. The choice round-trips through the `?full=` URL
param (shareable / survives reload). If FAIL, either the toggle does not change the node render (F-186 H-003/
H-009) or the URL param is not honoured on load (H-001). Source: feature-flow F-186.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Shared stack reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (own ids `2076x`, namespace `//e2e-it076/`, names `it076_*`; idempotent — spec's
  `seedHierarchyLineage()`): a non-DEG Hierarchy lineage — data_source `20760` WITH a namespace (so the
  FULL "Space" row has content); entity `20761` (class `{1}`); upstream parent `20762`; lineage edge
  `parent → entity`. Non-DEG → routes to HierarchyLineage (the subtree whose Compact/Full re-renders).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s http://localhost:18080/api/dataentities/20761/lineage/upstream?lineage_depth=1` → 200 with
  the parent node.
- Render probe: `/dataentities/20761/lineage?d=1&full=true` shows "Source"; `?d=1&full=false` does not.
  (NB: a bare `?full=false` WITHOUT `d` trips the separate unset-lineage_depth 500 — F-054-UC-5 / F-055 —
  so deep-links use the complete `?d=1&full=...` the real toggle always emits.)

## 4. Run protocol
1. H-003/H-009 (toggle): open `/dataentities/20761/lineage` (FULL by default); assert the node + its
   "Source" row render; click the **Compact** tab; assert the "Source" row is gone (count 0) and the title
   still renders.
2. H-001 (URL round-trip): open `/dataentities/20761/lineage?d=1&full=false`; assert the node renders and
   the "Source" row is absent (Compact honoured on load).

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1
npx playwright test specs/lineage-view-mode-toggle.spec.ts --reporter=line`.

## 5. What it checks — assertions
- **H-003/H-009 (PASS):** FULL shows the node "Source" detail row; after clicking Compact the "Source" row
  count is 0 while the node title persists. (FAIL: the toggle did not change the render → modes not distinct.)
- **H-001 (PASS):** a `?d=1&full=false` deep-link opens in Compact (no "Source" row). (FAIL: the URL param
  not honoured → the choice does not round-trip.)

## 6. Result log
- 2026-06-07 — authored; stack_commit `dd52f520`; runner AI (Claude). Outcome PASS (2/2). Evidence:
  empirically verified FULL→"Source"×3/"Space"×3/source-name visible; COMPACT→all 0 with title persisting;
  URL flips to `?...&full=false`; `?d=1&full=false` deep-link opens Compact (curl + browser probe before
  asserting). Used the complete `?d=1&full=...` deep-link the toggle emits to avoid the unrelated
  unset-lineage_depth 500.
