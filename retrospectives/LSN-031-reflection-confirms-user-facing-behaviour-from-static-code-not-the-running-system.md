---
id: LSN-031
title: Top-down feature reflection confirms USER-FACING behaviour from static code, never the running system - FE/BE contradiction and on-screen self-contradiction are structurally invisible (PLT-176)
date: 2026-06-09
domain: ontology / feature-anchored-synthesis / issue-reporting
severity: high
gates_informed:
  - .claude/agents/feature-reflector.md (Rule 12 - a user-facing verdict whose truth is a property of the running assembled system requires execution, not a static chain trace)
  - playbooks/user-facing-verification.md (new - the issue-side dynamic-verification gate; generalises live-site-verification from docs to code)
  - issues/README.md (required `## User-facing impact` section, verified-not-inferred; ASCII-only bodies)
  - APPROACH.md section 15 (the static-vs-running gap; probe-needed scope widened)
status: closed
---

# LSN-031: top-down reflection confirms user-facing behaviour from static code, never the running system (PLT-176)

## What happened

PLT-176 (Activity Feed tag+owner filter fan-out) was authored from the F-021 feature reflection. The reflection's contradiction became the issue draft, and the draft asserted a USER-FACING symptom - "the feed renders each duplicate as a separate row" - reasoned purely from the back-end query (the un-`DISTINCT`'d LEFT JOINs in `ReactiveActivityRepositoryImpl`).

The maintainer set up a local stack and drove the actual feature. The static symptom was FALSE in every user-facing particular:

- The list endpoint returns 20 rows (5 distinct x 2 tags x 2 owners), but the FRONT END de-duplicates by id - so the user sees **5 cards, not 20 duplicated rows**. The claimed symptom does not exist on screen.
- The COUNT endpoint (`GET /api/activity/counts`) runs the same fan-out joins with `selectCount()` and reports `total_count=20`.
- So the real user-facing symptom is an ON-SCREEN SELF-CONTRADICTION: the "All 20" tab badge disagrees with the 5 events listed beneath it. And the count endpoint - a SEPARATE node, not in F-021's list chain - carries the more visible half of the bug, which the draft did not mention at all.

The draft's fix scope was wrong as a direct consequence: it proposed `DISTINCT` on the list query only; a list-only fix leaves the count badge wrong.

Every fact above was found by the maintainer RUNNING the feature. The ontology - including its designated product-owner / user-facing layer - never ran it, and shipped a confident, wrong, user-facing claim into a reportable issue. Worse: the maintainer spent real time trying to reproduce a symptom (duplicate rows) that the methodology had invented and that does not occur.

## Why it slipped

Structural, not personal - and it is LSN-020's blind spot, on the SAME feature (F-021).

### The reflection layer "reflects from the screen" in its prose but is contractually forbidden from looking at the screen

LSN-020 created Layer 4b (the `feature-reflector`) precisely to ask "what does the feature PROMISE the user, and does the chain DELIVER it?" Its contract aspires to the screen - Rule 2: a hypothesis is "something an operator could verify by clicking through the UI"; Rule 9: "reflect as a senior product owner, from the screen." But its VALIDATION mechanism is static:

- **Rule 8 - "you do NOT re-read the source code directly ... you do not Read source files directly."** The reflector consumes static sidecars; it never runs the system.
- **Rule 3 - `confirmed`/`contradicted` verdicts are traced "through the implementation chain"** (the sidecars = code). The only dynamic path, `probe-needed`, is scoped to "cache staleness window, race condition, multi-user concurrent behaviour."

So a `confirmed` or `contradicted` verdict on a user-facing hypothesis means "the code, read statically, appears to do this." It wears user-facing language but is a code-truth claim. The gap between "what the back-end code does" and "what the user sees" - the front end's transform of the back-end response, and the consistency BETWEEN endpoints rendered on one screen - is exactly where the running system diverges from the static trace, and it is precisely what the contract cannot see.

### Two failure classes the static reflection cannot reach

1. **Front-end/back-end contradiction.** The back-end query fans out to 20 rows; the front end de-dupes to 5. No back-end sidecar, and no front-end sidecar read in isolation, surfaces "the user sees 5 while the count says 20" - that is a property of the ASSEMBLED RUNNING system (FE composed over BE). The reflection traced the BE chain and reported the BE row count as the user-facing symptom.

2. **Cross-node on-screen consistency.** The "All 20" badge comes from `getActivityCounts`, a node NOT in F-021's list-feed chain. The reflection's hypotheses were generated and validated against the list chain; the count endpoint's matching fan-out - the most visible symptom - was outside the reflection's frame. On the running screen the two sit side by side and contradict each other; in the static ontology they are separate nodes that never meet.

### Why LSN-020 did not prevent it

LSN-020 fixed "we have no top-down reflection" by adding the reflector. But the reflector it added validates the same way the bottom-up layers do - by tracing static sidecars - so it inherited the static blindness one level up. LSN-020 closed "we don't ask the user-facing question"; it did NOT close "we never run the feature to answer it." LSN-020's forcing question ("when `userIds=[42]` is passed, does the response contain rows where user 42 performed the action?") is answerable by reading the SQL. The forcing question here ("when the user filters by tag and owner, does the count badge match the list on screen?") is NOT answerable by reading any single chain - only by running it.

### The contamination is the whole issue-draft corpus

PLT-176 is one instance of a class. Every code-issue draft (~200 PLT, plus COL/SPEC) was produced the same way: a reflection contradiction or a scan finding, validated against static code, written up with a `Why it matters` reasoned from the back end - none driven against the running system. So every draft's user-facing claim is static-unverified, and an unknown fraction carry the same FE/BE or cross-node error PLT-176 did. This is not a reason to distrust the code-level findings (the fan-out IS real; PLT-176 is a real bug) - it is a reason to treat every USER-FACING claim as unverified until the feature is driven.

## Rule that emerged

### Rule A (feature-reflector - new Rule 12): a user-facing verdict whose truth is a property of the running system requires execution, not a static trace

A hypothesis whose observable is a property of the RUNNING assembled system - what the rendered UI shows (the front end's transform of a back-end response), or the consistency between two endpoints displayed on one screen - CANNOT be issued as `confirmed` or `contradicted` from a static chain trace. It is `probe-needed`, and the probe drives the feature (hit the endpoint AND inspect what the front end renders / what a sibling endpoint returns). `probe-needed` is widened from "timing / concurrency" to **"anything whose truth is a property of the running assembled system, including FE-transform-of-BE and cross-endpoint on-screen consistency."** A static trace may yield at most `static_suggests: X (unverified)` - never a user-facing `confirmed`/`contradicted` a triager can promote to a filable issue. The reflector additionally checks, for any feature with a UI hop, whether a sibling endpoint feeding the SAME screen (a count/badge/summary alongside a list) shares the data path - and reflects on their on-screen consistency as a first-class hypothesis.

### Rule B (issue-reporting gate - playbooks/user-facing-verification.md): no code-bug user-facing claim is filable without dynamic verification

Generalises the docs Gate 8 (`live-site-verification`) from documentation to code. Before a code-issue draft leaves `draft`, its `## User-facing impact` must be either (a) OBSERVED on the running system - drive the UI / hit the endpoint / read the front-end component that transforms the response - with the observation cited, or (b) explicitly marked `user_facing_verified: false` with the concrete reason it cannot be run locally (e.g. RBAC unobservable under `auth.type=DISABLED`; a 202-returning receiver not available). A static-derived user-facing claim presented as fact is the defect, not the absence of a repro.

### Corpus remediation (the whole draft set, not the 10)

1. Every existing code-issue draft is treated as `user_facing_verified: false` until driven - the honest state of a statically-authored corpus.
2. The gate (Rule B) blocks `draft -> filed` without verification, so no more unverified user-facing claims ship.
3. Verify ON FILE, highest-priority batch first (the pilot 10). We do NOT speculatively re-drive all ~200 - that violates cost discipline (APPROACH section 9); we drive a draft when it is about to be filed, or when its feature is already on screen during other work.
4. Rule A stops NEW drafts being born statically-"confirmed": user-facing verdicts now route to `probe-needed` and are driven before they become bug-candidates.

## Forcing question

> "When the user opens the Activity feed and filters by tag and owner, does the count badge match the list on the screen? The reflection said the feed shows duplicate rows. The running UI shows a count of 20 over a list of 5. Which layer ran the feature to find out - and if none did, why did a user-facing claim ship into a reportable issue as fact?"

The rev-5 reflector had no path to drive the feature; every user-facing verdict was a static trace wearing user-facing language. The rev-6 reflector (Rule 12) routes any running-system observable to `probe-needed`; the issue gate (Rule B) refuses to file a user-facing claim that was never observed.

## References

- `issues/odd-platform/PLT-176.md` - the corrected draft (now carries a verified `## User-facing impact`: count/list contradiction, FE de-dup, count-query fix scope).
- Live evidence (2026-06-09, local stack, one entity with 2 tags + 2 owners, `tag_ids=1,2 & owner_ids=1,2`): `GET /api/activity` -> 20 rows / 5 distinct ids; `GET /api/activity/counts` -> `total_count: 20`; UI -> 5 cards under an "All 20" badge.
- `ReactiveActivityRepositoryImpl.java:237-241` (the per-filter LEFT JOINs), `:290-294` (list query, no `DISTINCT`), `:145-163` / `:166-184` / `:187-206` (the three count methods, `selectCount()` over the same fan-out, no `DISTINCT`).
- `.claude/agents/feature-reflector.md` Rule 3 / Rule 8 / Rule 9 - the static-validation contract that produced the wrong user-facing claim.
- `LSN-020` - created Layer 4b (top-down reflection) for this same feature (F-021); this LSN is its blind spot (reflection without execution).
- `LSN-017` - per-node scan cannot see cross-layer effects; the FE/BE contradiction is that effect one level higher (FE composed over BE on the running screen).
- `playbooks/live-site-verification.md` - the documentation analogue this issue-side gate generalises.
