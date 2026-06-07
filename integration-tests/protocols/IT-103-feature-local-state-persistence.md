---
id: IT-103
title: "DQ dashboard filters reconstruct from the URL but reset on a plain navigate-away"
gates:
  validates: [F-104]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:feature-local-state-persistence.spec.ts"
plan_ref: I9
status: ready
---

# IT-103 — Feature-Local State Persistence (jotai per-Provider) (F-104)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Data Quality dashboard (`/data-quality`) scopes its filter state in a per-feature jotai
`<Provider>` (`DataQualityStore.ts:11-22`), so the slice is created fresh-empty on every mount.
The URL search-param channel (`DataQualityFilters.tsx:28-54`) is the ONLY cross-mount
persistence: it hydrates the atom from the URL on mount and writes filters back as JSON. This
protocol confirms the URL reconstruction (UC-002 / H-002) and CHARACTERIZES the navigate-away
reset (UC-001 / H-001, contradicted — the jotai store resets where the Redux-backed majority of
the SPA persists). If the reset pin FLIPS RED, the four jotai areas now persist across
navigation (a paradigm change). Source: feature-flow + reflection F-104; `components/DataQuality/*`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED).
- **Seed data**: NONE — a selected filter chip renders its `{name}` straight from the atom
  (`SelectedFilterOption.tsx:18`), reconstructed from the URL JSON, with no API lookup (probe-
  verified). Ids in the IT-103 range (21030/21031), `it103_` names, so nothing collides.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- SPA shell: `curl -sL -o /dev/null -w '%{http_code}' http://localhost:18080/data-quality` → `200`.

## 4. Run protocol
1. SUCCESS (UC-002): open `/data-quality?deNamespaceIds=[{"id":21030,"name":"it103_table_ns"}]`
   `&namespaceIds=[{"id":21031,"name":"it103_test_ns"}]`; wait for the Filters panel; observe
   BOTH the table-side and test-side namespace chips rehydrate from the URL.
2. CORNER PIN (UC-001): open `/data-quality?deNamespaceIds=[{"id":21030,"name":"it103_table_ns"}]`
   (chip present); click the Directory toolbar tab, then the Data Quality toolbar tab (lands on
   BARE `/data-quality`, no query); observe the chip is GONE (the jotai store reset on unmount).

**Automated rail**: `integration-tests/run-suite.sh IT-103` (Playwright `e2e/specs/feature-local-state-persistence.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** both URL-encoded namespace chips render on the dashboard (lossless across
  the table + test sides). (FAIL: a chip missing → the URL hydration is broken.)
- **CORNER PIN (PASS today):** after a navigate-away that did not carry the filter URL, the chip
  is absent (visible count 0). RED ⇒ the filter slice now persists across navigation — the
  jotai-per-Provider paradigm changed; re-verdict F-104 H-001.

## 6. Result log
- 2026-06-07 — authored; DataQualityFilters URL round-trip + jotai reset ground-truthed (chip
  renders from URL JSON, no seed); 2/2 green via run-suite.sh IT-103 (see run-log/).
