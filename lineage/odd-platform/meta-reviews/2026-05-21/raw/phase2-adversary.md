---
panel_run: 2026-05-21
phase: 2
expert: panel-adversary
---

# Phase 2 — Adversary cross-examination memo

## corroborate
- finding: "ENG-F3"
  basis: "Verified independently. ActivityHandler.md:32 reads 'Three of the 27 enum values are NOT covered' then lists TEN distinct values (DATA_ENTITY_OVERVIEW/METADATA/SCHEMA/RELATION_UPDATED, CUSTOM_METADATA_CREATED/UPDATED/DELETED, OPEN/RESOLVED_ALERT_RECEIVED). A bare arithmetic contradiction in a stress-complete / confidence HIGH sidecar — exactly the trust-eroding class my axis cares about. lsn-candidate routing is right."
- finding: "SKE-F3 / ENG-F2 / SKE-F2 cluster"
  basis: "coverage.py live (run by me, 2026-05-21): 8 stress sidecars, 53 questions, 90.6% verified, PROBE-VERIFIED=0, 5.4% adoption. The 2 'PROBE-VERIFIED' text hits in sidecars are aspirational prose, not confidence labels — probe loop is genuinely open. Conditions 1 and 6 unmet, confirmed."
- finding: "MET-F5"
  basis: "ls coherence/ → NOT FOUND, confirmed. entity-index.yaml absent; sweep is grep-only."
- finding: "ECO-F3"
  basis: "refactoring-scopes 240 indexed / 518 detail (278 orphans); implicit-adrs 75 / 198 (123 orphans). Exact match."

## dispute
- finding: "PRA-F1"
  basis: "Disputed at severity HIGH. The practitioner asserts feature-flows/index.yaml (326 KB) 'exceeds the read-tool's 256 KB limit' and is 'not loadable as a unit.' I read it directly this run with no error; the economist read it whole too (ECO-F4). No hard 256 KB Read limit is in play. The real defect is navigation friction, not a load-stop. ECO-F1 (test-map/index.yaml, 1.26 MB) is the genuine blocker. Recommend PRA-F1 → MEDIUM, reframed 'index-size friction', not double-counted against ECO-F1."

## severity_adjust
- finding: "SKE-F1"
  change: "MEDIUM→HIGH"
  basis: "The stale manifest (3 stress sidecars / 25 questions / 88%; live is 8 / 53 / 90.6%) is not benign lag. Three of six experts (MET-F3, ECO-F2 basis, PRA-F5) reasoned off the stale 3-sidecar figure. A manifest that mis-feeds the panel measuring the target is a panel-integrity defect, not a MEDIUM housekeeping note. Finding direction holds for all three; their cited inputs are wrong."

## new_finding_triggered
- title: "The SC-5 inverted-RNG COVERED-WRONG has propagated into concepts/index.yaml — and ECO-F2 shows that catalog is frozen at sidecar_count 55, so the wrong claim has no refresh path to be corrected"
  severity: HIGH
  evidence: "concepts/index.yaml:2289-2290,4922 ('ThreadLocalRandom-backed'); concepts/index.yaml sidecar_count: 55 vs 147 enriched (ECO-F2). My ADV-F1 ground truth: commons-lang3 3.18.0 → SecureRandom."

## position_held
- "ADV-F1 (HIGH — inverted token-RNG claim across 3 artefact tiers) and ADV-F2 (MEDIUM — version-unpinned library-behaviour claims) stand unchanged after reading all five peer reports; no peer tested the RNG mechanism, so it is uncorroborated but undisputed."
