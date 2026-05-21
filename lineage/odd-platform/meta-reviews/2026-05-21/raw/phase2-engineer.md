---
panel_run: 2026-05-21
phase: 2
expert: panel-engineer
axis: Depth
commit_anchor: ede5d277
prompt_version: panel-engineer/0.1.0
---

# Phase 2 — Engineer (Depth) cross-examination memo

As the panel's second independent tracer (Rule 3), I re-traced 3 of the Adversary's 8
ground-truth claims against `REPO_ROOT_ABS` source — the headline COVERED-WRONG plus one
COVERED-CORRECT and one MISSED-SILENT — and re-derived the manifest figure my own ENG-F1 cited.

## reverification_of_adversary

- claim: SC-5 / ADV-F1 — collector token RNG. Adversary: COVERED-WRONG.
  verdict: **agree**.
  evidence: `TokenGeneratorImpl.java:39,49` call the *static* `RandomStringUtils.randomAlphanumeric(40)`
  (not `secure().nextAlphanumeric`). `gradle/libs.versions.toml:10` pins `apache-lang = '3.18.0'`.
  Authoritative Apache sources (WebFetch 2026-05-21): the 3.18.0 `RandomStringUtils` source routes
  the deprecated static methods through `secure()` (`SECURE_SUPPLIER = RandomUtils::secure`); the
  RELEASE-NOTES record 3.18.0 — "Reimplement RandomUtils and RandomStringUtils on top of
  `SecureRandom#getInstanceStrong()`". At the pinned 3.18.0 the static method **is** a CSPRNG.
  The ontology's "delegates to `ThreadLocalRandom` in commons-lang 3.16+, NOT `SecureRandom`"
  (`F-020.yaml:359`, `concepts/index.yaml:2290,4922`) is factually inverted. The inverted claim
  is verbatim in all three artefact tiers the Adversary cited — propagation confirmed.

- claim: SC-2 — `LineageDepth.of()` uncapped. Adversary: COVERED-CORRECT.
  verdict: **agree**. `LineageDepth.java:12-14` — `of(int)` returns `new LineageDepth(depth,false)`,
  no `Math.min`/clamp; `empty()` (16-18) stores `-1`. Ground truth exact.

- claim: SC-1 — `internal_description` 255→unbounded migration. Adversary: MISSED-SILENT.
  verdict: **agree**. `V0_0_1__init.sql:161` declares `varchar(255)`; `V0_0_85` runs
  `ALTER COLUMN internal_description TYPE varchar`. Real user-observable widening, not surfaced.

Re-traced 3 / 8; 3 agree, 0 disagree. The two independent tracers do **not** diverge — the
Adversary did not share the methodology's blind spot on these claims.

## corroborate

- **ADV-F1 (HIGH) — corroborated** on independent evidence above. This is the run's strongest
  consensus finding: a HIGH-severity *inverted* security claim, propagated into `concepts.yaml`,
  contradicting the project's own older sidecars (`IngestionDataEntitiesFilter.md`). It is exactly
  the Failure-mode-4 trap (correct pattern name, wrong consequence) my agent contract names.
- **ADV-F2 (MEDIUM) — corroborated.** The version-pin discipline gap is real and is a Depth
  concern: a depth claim about library runtime behaviour is unverifiable without the resolved
  version. Note the existing `understanding/...HousekeepingTTLProperties.md` does version-aware
  Spring reasoning well — the gap is library-behaviour claims specifically.

## severity_adjust

None. ADV-F1 HIGH is correctly calibrated — confirmed inverted, confirmed propagated.

## new_finding_triggered

- **ENG-F1's cited manifest figure is stale.** My Phase-1 ENG-F1 quoted "stress section in 3 of
  146 sidecars". `manifest.yaml:37` says `sidecars_with_stress_section: 3`; live
  `grep -rl stress_findings: understanding/` returns **8**. The skeptic's SKE-F1 (stale manifest)
  is independently confirmed. Direction is benign — 8/147 = 5.4%, not 2.1% — so ENG-F1's
  conclusion (deep channel is a canary, far below target condition 1's 90% denominator) and its
  HIGH severity are **unchanged**; only the cited number corrects upward. The Chair should carry
  5.4%, not 2.1%, and SKE-F1 should be a consensus finding.

## position_held

ENG-F2 / ENG-F4 held — the Adversary's coverage probes did not touch reactive-context
propagation or the open probe loop; no peer evidence moves them. Depth axis stays AMBER 7.
