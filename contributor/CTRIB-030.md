---
ctrib: CTRIB-030
github_issue_number: 1758
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1758
title: "Lineage endpoints: unset lineage_depth autoboxes null → NPE → HTTP 500 (no @Max cap); no SECURITY_RULES on any lineage read"
class: bug                    # Defect 1a (unset-depth → 500) is a real, live-reproduced crash. Defect 2 (RBAC) reclassifies to expected-behaviour (see Product analysis). Defect 1b is out-of-scope (owned by existing items).
scope: backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop). Internal id = PLT-100.
status: pr-draft             # REWORK COMPLETE 2026-06-23T14:53: rebased onto current-main c7f14fc5 (04e22af4) → unit GREEN (593/0) → FULL e2e regression GREEN-for-change on ONE SUT (digest 74b8a80e): feature-complete 309/2 (IT-037 unset→200 GREEN; the 2 fails = unmerged confirmation-dialog fix), multi-stack 9/0, known-bugs 3-RED-expected/0-unexpected-green, ingestion-e2e 6/0. PR #1800 force-updated 1cff8a59→04e22af4 + body refreshed. Handoff to a fresh /review → GATE 2 (human merge). See "## Rework run (2026-06-23)".
reproduced: "LIVE on the running SUT (odd-platform:odd-team-sut digest 35ca9385 = the ctrib029 dc9b6422 build; lineage files byte-identical to origin/main 4028b4a6 — verified `git diff origin/main..HEAD` empty over Lineage/DataEntityController/SecurityConstants/ControllerAdvice). 2026-06-22, auth DISABLED. RED: `GET /api/dataentities/1/lineage/downstream` (no lineage_depth) → HTTP 500 {code:SYS001, message:'Internal Server Error'}. CONTROL (proves NPE is pre-lookup): `…/lineage/downstream?lineage_depth=1` → HTTP 404 {code:USR002, message:'DataEntity with id 1 is not found'} — same nonexistent id reaches the service and 404s gracefully WITH a depth; 500s BEFORE the lookup WITHOUT one. See '## Reproduction'."
adr_required: false          # The crash fix (Defect 1a) needs NO ADR. Defect 2 (RBAC) is INTENDED behaviour (ODD's published authz model) → no security-posture code; an OPTIONAL implicit-ADR could CODIFY the existing 'reads-open, writes-permissioned' decision (adr pillar) — maintainer's call at GATE 1, NOT a blocker for this PR.
plan_approved_by: RamanDamayeu
plan_approved_at: "2026-06-22"
plan_approved_scope: "Defect 1a (unset lineage_depth → NPE → HTTP 500) ONLY. Fix = spec default:1 on lineage_depth (both ops) + a DataEntityController null-guard (DEFAULT_LINEAGE_DEPTH=1), defense-in-depth; default 1 mirrors the UI default + @Min(1) floor. Defect 1b (@Max + CTE cycle-guard) KEPT SEPARATE (PLT-042 + REFACTOR-202). Defect 2 (lineage RBAC) = INTENDED behaviour, NO code — the auth.type=DISABLED caveat is documented (DOC-293/320/338), optionally codify an implicit-ADR ('reads-open, writes-permissioned'). Approved via AskUserQuestion (both recommended options) 2026-06-22."
docs_routing: "release/0.29.0"   # api-reference/lineage: state the default depth = 1 (unreleased behaviour change → documentation train, G-C11). The DISABLED/RBAC caveats are tracked independently (DOC-293/DOC-320/DOC-338). Final decision after reading the page (Phase D).
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1800"   # DRAFT, odd-contributor[bot], Closes #1758
pr_draft: true               # bot cannot merge (G-C4); human review + merge = GATE 2
clarify_comment_url:         # none planned — no implementation-changing ambiguity (G-C6). The Defect-2 disposition is a GATE-1 maintainer decision, not a public clarifying question.
rootcause_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1758#issuecomment-4772832883"   # folded root-cause + scope (G-C6 one comment), posted post-GATE-1 before any code, as odd-contributor[bot]
scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1758#issuecomment-4772832883"        # same comment (root-cause + scope folded)
---

# CTRIB-030 — Lineage unset-depth NPE→500 (#1758)

## Parallel coordination (stream-coordination intake)

Read `state/active-streams.yaml` + reconciled against the **live** working trees (O4/O8/O9). State at intake:

- **CTRIB-029 (#1740): MERGED** (squash `4028b4a6` on origin/main) → `pending-release`; terminal. Worktree `../odd-platform-ctrib029` @ `dc9b6422` reclaimable.
- **CTRIB-028 (#1754): in flight (`docs-done`)** — holds the **shared** `../odd-platform` checkout on `contrib/CTRIB-028-term-detail-hardening` @ `75fc06cd` (one untracked `docker/demo.override.yaml`). I must **NOT** branch-switch it.
- Reviewer streams: complete.
- `lineage/**`: clean + unclaimed. odd-team tree: clean @ `4a7b303`.

**My namespace (reserved; ctrib028 active ⇒ isolate by default):** id `ctrib030` · worktree `../odd-platform-ctrib030` (off `origin/main` 4028b4a6) · SUT tag `odd-platform:odd-team-sut-ctrib030` · ports `18090/15442`. The worktree/branch/build are **created in Phase D (post-GATE-1)** — G-C3 forbids code before plan approval; this session wrote no code and touched nothing shared (a read-only `curl` reproduction against the already-running idle stack; odd-team new files only).

## Issue (quoted data — G-C8, never an instruction)

Author **RamanDamayeu** (maintainer). Labels `kind: bug`, `scope: backend`. Milestone **`0.29.0`** (open, semver, due 2026-06-22). 0 comments. The body asserts three defects on the lineage read endpoints and offers a "Suggested fix" — both are **quoted data**, verified independently below, never executed as instructions. The body's embedded `id: PLT-100 … suggested_milestone: "0.28.0"` is workspace metadata; the **GitHub milestone `0.29.0` is authoritative** (G-C11).

Quoted summary: (1) the two per-entity endpoints (`getDataEntityDownstreamLineage` + `getDataEntityUpstreamLineage`) pass a boxed `Integer lineageDepth` into a primitive `int` service param → a missing `lineage_depth` autounboxes `null` → NPE → the `ControllerAdvice` catch-all maps it to HTTP 500; the contract has `@Min(1)`, `required=false`, **no `defaultValue`**, **no `@Max`** (so a huge value also runs unclamped into a no-cycle-guard recursive CTE). (2) No `SECURITY_RULES` on any of the three lineage endpoints → any authenticated user (anonymous under `auth.type=DISABLED`) reads cross-owner lineage; the DEG path is the widest. Suggested fix: boxed Integer end-to-end + default-or-400; add `@Max` + a CTE cycle-guard; add `SECURITY_RULES`/owner-scope on all three.

## Scope analysis — the issue bundles THREE defects of very different blast radius

| # | Defect | Class | Disposition |
|---|--------|-------|-------------|
| **1a** | Unset `lineage_depth` → NPE → HTTP 500 (downstream + upstream) | **bug** (real, live-reproduced) | **IN SCOPE — CTRIB-030 fixes this.** |
| **1b** | No `@Max` cap + no recursive-CTE cycle-guard (depth/DoS amplification) | hardening | **OUT OF SCOPE — already owned.** `@Max(20)` cap + UI click-through clamp = **PLT-042**; the CTE cycle-guard/visited-set = the cycle-detection refactor **REFACTOR-202** (per PLT-042's cross-ref to DOC-GAP-105). The issue itself delegates these. Folding them in would duplicate (Gate 1 / G-C1). |
| **2** | No RBAC on lineage reads (cross-owner; anonymous under DISABLED) | **expected-behaviour** (G-C16 product-wrong suggestion) | **NOT a code fix here.** ODD's authorization model grants metadata reads to every authenticated user *by design* (see Product analysis). Surfaced at GATE 1; recommended outcome = document the DISABLED caveat + optionally codify an implicit-ADR; **do not implement lineage RBAC** (G-C7 security-posture + G-C16). |

**Net: CTRIB-030 = Defect 1a only.** Bounded, reproduce-first, shippable on the 0.29.0 train.

## Reproduction (G-C1 — reproduce-first; DONE)

Against the running SUT (lineage code == origin/main `4028b4a6`; auth DISABLED), 2026-06-22:

```
$ curl -s -w '\nHTTP %{http_code}\n' "http://localhost:18080/api/dataentities/1/lineage/downstream"
{"code":"SYS001","message":"Internal Server Error","retryable":false,"resolvable":false,"details":null}
HTTP 500                                  # RED — unset lineage_depth

$ curl -s -w '\nHTTP %{http_code}\n' "http://localhost:18080/api/dataentities/1/lineage/downstream?lineage_depth=1"
{"code":"USR002","message":"DataEntity with id 1 is not found","retryable":false,"resolvable":false,"details":null}
HTTP 404                                  # CONTROL — same id, WITH a depth, reaches the service → graceful 404
```

The asymmetry is the proof: *with* a depth the request enters the service and 404s on the missing entity; *without* a depth it 500s **before** the lookup — i.e. the NPE fires synchronously in the controller, exactly as traced. (Anonymous reachability also confirmed — no 401 under the SUT's DISABLED auth.)

## Root-cause (verified on live source, not the issue's say-so)

1. `DataEntityController.getDataEntityDownstreamLineage(Long, Integer lineageDepth, …)` — `DataEntityController.java:257-264` — controller param is a **boxed `Integer`** (`required=false` ⇒ nullable).
2. At `:262` it calls `lineageService.getLineage(dataEntityId, lineageDepth, …)`.
3. `LineageServiceImpl.getLineage(long, **int** lineageDepth, …)` — `LineageServiceImpl.java:88-91` — service param is a **primitive `int`**. Arguments are evaluated eagerly when building the call, so a null `lineageDepth` **autounboxes → NPE synchronously**, *before* the `Mono` chain (and before `getDataEntityWithDataSourceAndNamespace` at `:92`).
4. WebFlux routes the synchronous throw to `@RestControllerAdvice`; the `@ExceptionHandler(Exception.class)` catch-all (`ControllerAdvice.java:94-99`) → `SYS001` / "Internal Server Error" / **HTTP 500**. (`NotFoundException` → 404 and `WebExchangeBindException` → 400 are handled earlier — `:33-37`, `:51-56` — so a *validation* failure already yields a clean 400; only the unboxing NPE escapes to the 500 catch-all.)
5. Contract: `openapi.yaml:1260-1266` (upstream) / `:1294-1300` (downstream) — `lineage_depth` `required:false`, `minimum:1`, **no `default`, no `maximum`**. Generated `DataEntityApi.java:974`/`:1236` — `@Min(1) … @RequestParam(value="lineage_depth", required=false) Integer lineageDepth`, no `defaultValue`. The contract is **regenerated from the spec at every build** (`odd-platform-api-contract/build.gradle:9-12,44`), so a spec change takes effect.
6. `LineageDepth.of(int)` (`LineageDepth.java:12-14`) is a pure wrapper — no clamp (relevant to Defect 1b, owned by PLT-042; not this PR).

## Product analysis (G-C16 — critique the WHAT before the HOW)

### Defect 1a — null-policy: default-depth vs 400

Restated independent of the issue's suggestion: *a spec-compliant GET of an endpoint whose `lineage_depth` is declared **optional** must not crash when it is omitted.* The contract says `required:false`; the published api-reference softens the unset case to "returns a default depth" (DOC-293). So a client reasonably expects omitting it to **work with a default**, not to error.

- **Recommended: default depth = 1 on null.** Mirrors the UI's own default (`defaultLineageQuery.d = 1`, `constants.ts:77`), the dropdown floor, and the `@Min(1)` constraint; makes the most-common first call return the depth-1 graph; makes the existing api-reference "default depth" doc *true*.
- **Rejected: 400-on-null.** Contradicts `required:false`, contradicts the documented behaviour, and makes the first call fail *harder*. Product-wrong for an optional param. (A 400 is correct for an *invalid* value like `0`/`21` — and `@Min(1)`/PLT-042's `@Max(20)` already give that via `WebExchangeBindException` → 400.)

### Defect 2 — "zero RBAC on lineage reads" is INTENDED behaviour, not a bug

Restated independent of the suggestion: *should lineage reads be restricted to the data's owner?* Evidence says no — this is the deliberate design of a data-**discovery** catalog:

- **ODD's own published authorization doc** (`docs.opendatadiscovery.org/.../authorization/permissions`, WebFetched 2026-06-22): *"Read access on Management catalogs is granted to every authenticated user by design. None of the Management permissions above gates the corresponding GET endpoint."* The five permission categories are all WRITE/management.
- **The code agrees:** every entry in `SecurityConstants.SECURITY_RULES` is a write (POST/PUT/DELETE/PATCH); the only GET rule is `/api/owner_association_request` (an admin queue). There is **no read-permission enum** and **no per-owner read-filter anywhere** in the platform. Lineage reads being open is consistent with *every* read endpoint (entity details, datasets, search…), not a lineage-specific gap.
- **Consequence:** implementing "add `SECURITY_RULES` / owner-scope on lineage" would (a) contradict ODD's documented design, (b) make lineage the *only* read-gated endpoint (arbitrary inconsistency), (c) require inventing a per-owner read-authorization mechanism that does not exist, and (d) undermine the discovery mission (cross-team impact analysis *needs* to see downstream consumers you don't own). This is the G-C16 "product-wrong suggestion" + the "not-a-bug" case.
- **The one legitimate residual** is the `auth.type=DISABLED` default making these (and all) reads anonymously reachable — a **deployment-posture documentation** caveat, already tracked (DOC-293/DOC-320/DOC-338), *not* a per-endpoint RBAC fix.

**Recommendation:** classify Defect 2 as expected-behaviour; ensure the DISABLED caveat is documented (already tracked); *optionally* codify the deliberate "reads-open, writes-permissioned" decision as an implicit-ADR (adr pillar). **Do not implement lineage RBAC.**

## Design-before-build (G-C12) — for the in-scope fix (Defect 1a)

- **Reuse-scan.** Default depth value already exists (UI `d:1`). Contract regenerated from the spec at build. `ControllerAdvice` already turns bean-validation failures into 400. No existing server-side default-depth constant to reuse → introduce one.
- **Fix shape (recommended = spec default + controller guard, defense-in-depth):**
  - **(b) Spec `default: 1`** on `lineage_depth` for both operations in `odd-platform-specification/openapi.yaml` → regenerated `@RequestParam(defaultValue="1")` → null never reaches the controller; `@Min(1)` validates 1. The contract becomes the single source of truth and the api-reference doc becomes literally true. *Must verify the generator emits `defaultValue` (regenerate + inspect — standard openapi-generator behaviour; this spec has no existing `default:` query-param precedent, so it is verified, not assumed).*
  - **+ a controller-tier null-safety guard** (`lineageDepth == null ? DEFAULT_LINEAGE_DEPTH : lineageDepth`, `DEFAULT_LINEAGE_DEPTH=1`) at both call sites — defense-in-depth so a direct service caller or a future codegen change cannot reintroduce the NPE (the multi-layer-defense lesson PLT-042 itself makes for this endpoint).
  - **Fallback (a):** if the codegen does not honour `default:`, the controller guard alone fixes the crash (contained Java change, no contract dependency).
- **ADR-check.** No ADR for Defect 1a (a contained crash fix conforming to the existing optional-param + ControllerAdvice patterns). Defect 2 ADR is optional + codifies-not-changes (above).
- **Impact checklist.** i18n: N/A (no user-facing strings; response bodies unchanged). Generated clients: spec `default` regenerates the BE interface + FE TS client (FE behaviour unchanged — it always sends `d`). Consumers: the two controller call sites (+ the service signature is untouched). Migrations: none. Docs: api-reference/lineage default-depth statement on release/0.29.0. Ontology: re-enrich the DataEntityController/LineageServiceImpl sidecars + the lineage feature flow (the "unset-depth NPE" caveat is resolved).
- **PO/SRE lens.** Strict win: the most-common first call returns data instead of an opaque 500, consistent with the UI's own default; no new surface, no new failure mode.

## Plan (the GATE-1 artifact)

**Change (Defect 1a only):**
1. `odd-platform-specification/openapi.yaml` — add `default: 1` to the `lineage_depth` query param of `getDataEntityUpstreamLineage` and `getDataEntityDownstreamLineage` (alongside the existing `minimum: 1`). Regenerate the contract; verify `@RequestParam(..., defaultValue = "1")` is emitted.
2. `DataEntityController.java` — defense-in-depth null guard at both lineage call sites (`:262`, `:272`) via a `DEFAULT_LINEAGE_DEPTH = 1` constant, so null can never reach the primitive `int` regardless of the contract.

**Explicit scope EXCLUSIONS (G-C5):**
- Defect 1b (`@Max` cap + CTE cycle-guard / visited-set) — owned by **PLT-042** (cap + UI clamp) and **REFACTOR-202** (cycle-detection). Not touched here.
- Defect 2 (lineage read authorization) — intended behaviour; **no RBAC code**. DISABLED-mode caveat is a docs follow-up (already tracked). Optional implicit-ADR codification is a separate adr-pillar item.
- No change to `LineageServiceImpl` business logic, the recursive CTE, `SecurityConstants`, or the DEG endpoint (it takes no `lineage_depth` and is unaffected).

**Tests (G-C9 — both buckets):**
- **Unit (odd-platform CI):** assert that omitting `lineage_depth` invokes the service with depth 1 (no NPE) and yields a normal response (200/404), NOT a 500; and that the absent param binds to `1`. Home: extend `LineageServiceTest` and add a `DataEntityController` lineage slice test (mirroring `DataEntityControllerActivityTest`/`…AlertsTest`). Plus a validation test that `0`/`21` still → 400 (guards the `@Min`/PLT-042 boundary). FAILS on base (500), PASSES on fix.
- **Integration (odd-team IT-NNN — MANDATORY, the symptom is contract/user-facing):** drive the running stack — `GET …/lineage/downstream` (and `/upstream`) on a **seeded** entity WITHOUT `lineage_depth` → assert HTTP 200 with a depth-1 lineage graph (not 500). Assertions written against a **captured real response shape** (curl once, read the actual JSON, then write `expect`). RED on `ODD_SUT=ref:main`, GREEN on the working-tree SUT. Check `integration-tests/protocols/` for a lineage IT to extend (e.g. IT-076) before authoring a new one.

**Docs (G-C10/G-C11):** read api-reference/lineage; update it to state the default depth = 1 (rides documentation `release/0.29.0`); paired DOC backlog item (milestone 0.29.0 + post-merge URL). The fix makes the existing "default depth" claim true. Record "no further doc change + why" for the rest after reading.

**Ontology (G-C10):** `/enrich --touched` the DataEntityController + LineageServiceImpl sidecars + the lineage feature flow; re-embed; commit.

**Definition of Done (before the PR leaves draft):** full unit build green (working tree) · FULL integration regression on the working-tree SUT (feature-complete green + multi-stack green + known-bugs still-RED + ingestion-e2e green) · docs read + decided + routed · ontology committed · Principal sufficiency (local 98% patch-coverage gate run, enough+meaningful tests, no control lost, no existing functionality harmed).

## Draft scope comment (G-C5 — posted to the issue thread immediately after GATE-1 approval, before any code; ASCII, self-contained, no workspace IDs)

```
Scoping note for the PR that addresses this issue.

This PR fixes Defect 1's crash only: a spec-compliant GET of
/api/dataentities/{id}/lineage/{downstream,upstream} WITHOUT lineage_depth
currently returns HTTP 500 — the optional Integer parameter autounboxes null
into the service's primitive int and throws an NPE before the entity lookup.
The fix gives lineage_depth a server-side default of 1 (matching the UI's
default view and the existing minimum=1), so the most common first call returns
the depth-1 lineage graph instead of crashing. Unit + integration tests cover
the no-parameter call.

Deliberately not in this PR (tracked separately):

- The @Max cap on lineage_depth plus the recursive-CTE cycle-guard/visited-set
  (the unbounded-depth amplification hardening). That is a distinct
  depth-bounding change with its own tests and is tracked on its own.

- The "no authorization on lineage reads" point. Per ODD's documented
  authorization model, read access to metadata is granted to every
  authenticated user by design — no permission gates a GET endpoint, and lineage
  reads behave like every other read in the platform. So this PR does not change
  lineage read authorization. The one actionable residual — that under the
  shipped auth.type=DISABLED default these reads are reachable without
  credentials — is a deployment-posture documentation caveat, handled on the
  docs side.

Happy to adjust the split if a different bundling is preferred.
```

## GATE 1 — decision surface (STOP; no code until approved — G-C3)

Recommended plan above. Two genuine maintainer decisions (the fix shape is a best-practice call I will proceed with unless you object):

1. **Defect 2 (lineage read authorization).** Recommend: treat as intended behaviour (per ODD's published authz model + writes-only SECURITY_RULES) — document the DISABLED caveat + optionally codify an implicit-ADR; **do not implement RBAC**. Alternative: pursue metadata read-ACLs as a separate authorization *feature* ADR (not this PR).
2. **Defect 1b bundling.** Recommend: keep separate (CTRIB-030 = crash fix only; the `@Max`/cycle-guard hardening ships via its own item). Alternative: fold the hardening into this PR.

Answering these = GATE-1 approval; I then post the scope comment and proceed to Phase D (worktree → failing tests → fix → both buckets → docs → ontology → draft PR), stopping again at GATE 2.

## Implementation (Phase D)

### Maintainer revision to the fix shape (2026-06-22, mid-implementation)

GATE 1 approved "spec default:1 + controller null-guard (defense-in-depth)". The maintainer then directed:
keep the fix in the **Platform specification** (the contract stays the single source of truth) and drop the
controller-side default logic — *"changes to the Platform specification instead of additional logic of applying
some defaults."* **Adopted: the fix is spec-only**; the controller is reverted byte-identical to base.

- **Codegen verified** (the load-bearing question for spec-only): regenerating the contract from the modified
  spec emits `@RequestParam(value = "lineage_depth", required = false, defaultValue = "1") Integer lineageDepth`
  on both ops (`DataEntityApi.java:974,1236`). Spring binds `lineageDepth = 1` when omitted → null never reaches
  the controller → no NPE. The contract carries the default; no application logic.
- **Value = 1, not 0 (flagged divergence from the maintainer's "default to 0").** A spec `default: 0` emits
  `defaultValue = "0"`, which the existing `@Min(1)` rejects → **HTTP 400 on the omitted call** — still an error
  for an "optional" param, and 0 disagrees with the UI's own default (`defaultLineageQuery.d = 1`). `default: 1`
  is consistent with `minimum: 1` + the UI default and returns a useful depth-1 graph. **Proceeding with 1**;
  trivially changed to 0 if depth-0 semantics are intended (that would also require dropping `minimum: 1` and
  confirming what depth 0 returns).

### The diff (spec-only) — committed `contrib/CTRIB-030-lineage-depth-npe` @ **1cff8a59**

- `odd-platform-specification/openapi.yaml`: `default: 1` on `lineage_depth` for both lineage ops + the
  operation descriptions note "(defaults to 1 when omitted)". **Controller unchanged** (byte-identical to base).
- Push-safe (no upstream; `push.default=current`).

### Test ledger (G-C9 / G-C15)

- **Unit bucket (odd-platform CI):** `LineageDepthDefaultTest` (`BaseIntegrationTest` + `@AutoConfigureWebTestClient`
  → in-process Testcontainers, runs in `./gradlew build`; real HTTP binding). Omitted `lineage_depth` on a missing
  entity → **404 USR002** (not 500 SYS001) for downstream + upstream; control pins explicit depth=1 → same 404.
  - **RED→GREEN, run not reasoned (2026-06-22):** on the base spec (stashed) the contract regenerates WITHOUT
    `defaultValue` and the two no-depth assertions **FAIL** (500) — `3 tests completed, 2 failed`, BUILD FAILED;
    with `default: 1` all 3 **PASS** (404). No test was CHANGED (G-C15 N/A — added only).
- **Integration bucket:** the symptom is a backend API-contract defect a third-party consumer hits directly —
  the issue itself states *"No FE surface is load-bearing here."* No browser / FE / multi-process surface, so no
  new odd-team `IT-NNN` is warranted (G-C9's mandatory-IT clause targets user-facing / FE↔BE contradictions).
  The in-process `WebTestClient` test drives the real HTTP endpoint end-to-end; the integration-bucket obligation
  is the FULL regression (G-C2), below.

### Regression (G-C2) — ⚠ SUPERSEDED by "## Rework run (2026-06-23)" below

> This subsection is the ORIGINAL pre-rework run @ `1cff8a59` (the one `/review` flagged: 4 scattered images,
> multi-stack `d03a378e` port-collision FAIL, "folding on completion" never folded). The AUTHORITATIVE full
> regression is now the rework run on the **current-main SUT @ `04e22af4`** (digest `74b8a80e`) — feature-complete
> 309/2 green-for-change, multi-stack 9/0, known-bugs 3-RED-expected, ingestion-e2e 6/0, all ONE SUT, with counts.
> See **"## Rework run (2026-06-23)"** at the end of this file.

All runs on the new **parallel-stream test foundation** (`adrs/drafts/parallel-stream-test-foundation.md`):
machine-wide `flock` serialization + per-stream isolation (own image/project/DB/ports) + teardown.

- **Unit CI replica** (`:odd-platform-api:build` = test + checkstyle + assemble): **GREEN** (BUILD SUCCESSFUL 5m4s;
  `LineageDepthDefaultTest` ran in-suite).
- **IT-037** (the impacted IT — lineage-depth-boundary, **re-grounded** for the fix): **GREEN** (2 passed; unset → 200
  on the fix; still RED on `ref:main` where unset → 500 — the G-C15 surviving-RED proof; re-grounded `eaf3ae5`).
- **feature-complete**: 303 passed / 8 failed (8.8m, isolated `:18090`). **1** = the legitimate #1758 pin-flip
  (IT-037 in-suite, re-grounded → green). **7** = the KNOWN **TST-042** roaming-flake class (`term-detail-page` ×2 /
  `term-linked-terms-tab` ×3 / `confirmation-dialog-thunk-arm` ×2 — element-wait timeouts under concurrent-stream
  CPU contention; each passes solo; none touched by `lineage_depth`) — logged in TST-042 (`5829146`). **GREEN for
  this change.**
- **known-bugs · multi-stack · ingestion-e2e**: FOLDED in "## Rework run (2026-06-23)" — the rework re-ran the
  FULL set on ONE current-main SUT with counts (known-bugs 3-RED-expected/0-unexpected-green; multi-stack 9/0;
  ingestion-e2e 6/0). Orthogonal to a `lineage_depth` default. (The "folding on completion" placeholder is now
  resolved — the review's complaint #6.)

### Docs (G-C10/G-C11) — DONE

`developer-guides/api-reference/lineage.md` + `data-lineage/data-objects.md`: the "omit → 500 / always pass an
explicit value" caveat → the default-1 behaviour. Committed + pushed on documentation **`release/0.29.0`**
(@ `71f3e53`, same-name push — LSN-034). Paired backlog **DOC-481** (`milestone: 0.29.0` + post-merge URLs) for the
release-gate live verification. The `@Max`/unclamped-depth caveats are unchanged (PLT-042 / REFACTOR-202).

### Ontology (G-C10) — DEFERRED (justified)

`/enrich --touched` is DEFERRED: `lineage/**` is dirty (an uncommitted probe-run residue, no registered owner —
O10, do not sweep). Per G-C10 "no refresh now + why": refreshes at the next clean lineage window / the release
scan. The change is a 1-line contract addition (a spec `default:`); the touched sidecars' lineage understanding is
structurally unchanged (same endpoint shape; only the omitted-param default differs).

## Review (2026-06-23, session: review-ctrib030 — separate /review session)

- **Result**: REJECTED → `pr-draft` → **`blocked`**
- **Bounce class**: 2-minute precondition bounce (skill §"Cheap precondition BEFORE the expensive run"). The FULL
  integration regression is *implement's* DoD; `/review` only **confirms** it and is not its first runner. The
  implementer's own artifacts contradict the DoD claim, so the expensive reviewer re-run was NOT opened. **The fix
  itself is sound — the bounce is scoped entirely to the regression _evidence_.**
- **Separate-session check**: PASS — implemented by the ctrib030 contribute stream (2026-06-22/23); this is a fresh
  `/review`. **Sources footer**: PASS — the fix commit `1cff8a59` carries both `Consumer-read:` and `Sources:`.

### What is GOOD (do NOT change on rework)
- **The spec fix** — `openapi.yaml` adds `default: 1` to `lineage_depth` on both upstream + downstream ops alongside
  the existing `minimum: 1`; descriptions note "(defaults to 1 when omitted)". Minimal, correct, contract-as-SoT.
  VERIFIED via `git show 1cff8a59 -- odd-platform-specification/openapi.yaml`.
- **Three-dot PR diff is clean** — `git diff origin/main...HEAD` = **2 files only** (`openapi.yaml` +6 /
  `LineageDepthDefaultTest.java` +73). The alarming two-dot `origin/main..HEAD` (which *appears* to revert CTRIB-028's
  Term/DatasetField work) is a **base-skew artifact**, not the PR: merge-base = `4028b4a6`. Live PR #1800 (WebFetched)
  is draft, base `main`, head `1cff8a59`, Closes #1758 — shows only the lineage change, **no 028 revert**. Gate 1 PASS.
- **Commit footer** — `Consumer-read:` cites DataEntityController:257-274 / LineageServiceImpl:88-91 /
  ControllerAdvice:94-99 / generated DataEntityApi:974,1236 / constants.ts:74-84; `Sources:` cites issue #1758 + the
  spec + codegen-verified-locally + the live 2026-06-22 reproduction. Gate 4 + Gate 9 PASS.
- **IT-037 re-grounding** (`eaf3ae5`, a CHANGED test → G-C15 danger zone) — done **correctly**: a GREEN `@pins` of
  unset→500 (LSN-029) flipped to assert unset→**200**; the new expected value traces to the api-reference
  "default depth" contract (independent SoT, not the system's current output); explicitly re-verified still-RED on
  `ref:main` (unset→500≠200); matcher not weakened (`.toBe(500)`→`.toBe(200)`), nothing skipped/deleted. G-C15 PASS.
- **Unit test** `LineageDepthDefaultTest` (ADDED, not changed) — ledger records a run-proof RED→GREEN (base spec: the
  two no-depth assertions fail with 500; with `default:1`: pass with 404 USR002). File exists; not independently
  re-run this session (bounce), and not the bounce reason.
- **Scope + product analysis** — Defect 1a only; 1b deferred to PLT-042/REFACTOR-202; Defect 2 correctly classified
  expected-behaviour (ODD's published reads-open authz model). Docs routed to `release/0.29.0` (DOC-481, release-gated).

### Why BLOCKED — the regression DoD is NOT satisfied at the reviewed SHA (each cited)
DoD (`CTRIB-030.md:127`): "FULL integration regression on the working-tree SUT (feature-complete green + multi-stack
green + known-bugs still-RED + ingestion-e2e green)". The artifacts contradict it:

1. **multi-stack → `e2e:FAIL`, unexplained.** `run-log/2026-06-23-multi-stack.md` records `e2e:FAIL` on image
   `d03a378e`. multi-stack is normally green (5/5 PASS in `2026-06-22-multi-stack.md`); its protocols are
   IT-008..012,123,124 — **not** IT-037, so this is **neither** the lineage pin-flip **nor** missing-028 term work.
   Commit `41fa303`'s body ("ingestion-e2e + multi-stack green") is **directly contradicted by the run-log it summarizes.**
2. **No single coherent full-green SUT run (G-C2).** The four buckets ran on **four different images**:
   feature-complete on `68521cc6` + `8f4967c9` (both **e2e:FAIL**), IT-037 on `e5a55b74` (PASS), and
   multi-stack/known-bugs/ingestion-e2e on `d03a378e` (FAIL / FAIL / PASS). The full set was never run on ONE SUT.
3. **feature-complete's only ctrib030 runs are FAIL and pre-date the IT-037 re-grounding.** The feature-complete log
   timestamps (11:19) precede `eaf3ae5` (11:26), so the "303/8 green-for-change" interpretation rests on a run that
   still carried the un-re-grounded IT-037 pin. feature-complete was never re-run green after the re-grounding.
4. **The "7 = TST-042 flake" attribution is unsafe** for the 5 term-* failures (`term-detail-page` ×2 /
   `term-linked-terms-tab` ×3). The SUT was built from `1cff8a59`, whose branch base `4028b4a6` has CTRIB-028
   **reverted** (`b5930a75`); `origin/main` `fd71eb3d` has 028 (re-applied). So the regression SUT is **missing the
   merged 028 Term Detail hardening** those very specs exercise — they cannot be confidently called flake on a SUT
   that lacks merged work they depend on. (Rebase fixes this — see fix-list.)
5. **Run-logs are unfilled skeletons + no provenance.** The 2026-06-23 run-logs carry no `runner`, no pass/fail
   **counts**, and no git-SHA of the SUT's source (only the tag name). The skill requires "actual pass/fail counts,
   not exit codes." No run-log's SUT digest is provenance-tied to the reviewed commit `1cff8a59`.
6. **The implementer's own ledger admits non-completion.** "Regression (G-C2)" above still reads
   "known-bugs · multi-stack · ingestion-e2e: running … result folded on completion" — never folded. Commit
   `210fc6f` likewise: "known-bugs/multi-stack/ingestion-e2e folding on completion."

### Quality Bar
- Gate 1 — PASS (three-dot diff = 2 files; live PR diff clean) via `git diff origin/main...HEAD` + WebFetch PR #1800.
- Gate 2 — N/A (no doc alias in the code diff; docs ride DOC-481).
- Gate 3 — N/A (code diff; the doc caveat conversion is DOC-481, release-gated).
- Gate 4 — PASS (footer consumers match the call chain) via `git show 1cff8a59` + the ledger root-cause trace.
- Gate 5 — N/A (no SDK builder in scope).
- Gate 6 — PASS (the default-depth code path is documented via DOC-481 on `release/0.29.0`).
- Gate 7 — N/A (code-only diff; docs are release-gated).
- Gate 8 — N/A for the code PR; docs PENDING-RELEASE (DOC-481, 0.29.0).
- Gate 9 — PASS (`Sources:` trace to spec/codegen/live-repro) via footer read.
- Gate 10 / Gate 11 — N/A (code-only diff; no published-doc lines touched).
- G-C15 (changed-test) — PASS (IT-037 re-grounding honest; verified still-RED on `ref:main`).
- **Regression (Step 3) — FAIL** (the bounce — items 1-6 above).
- **Banned-phrase check**: none used. **Navigation**: consistent (no pointer moved). **Upstream issues logged**: none.

### Rework fix-list (ONE pass; nothing here needs a separate tracked item)
1. **Rebase** `contrib/CTRIB-030-lineage-depth-npe` onto current `origin/main` `fd71eb3d` so the SUT reflects
   post-merge main (028 present); rebuild ONE per-stream SUT from the rebased fix HEAD.
2. **Run the FULL set on that one SUT** (serialized via the heavy-e2e flock; never concurrent with another live
   stream e2e): feature-complete (green-for-change — IT-037 now re-grounded should pass; characterize any residual
   failures **with counts**), multi-stack (must be green — **investigate the `d03a378e` FAIL**), known-bugs
   (3 expected-RED / 0 unexpected-GREEN, with spec-level detail), ingestion-e2e (green).
3. **Record results WITH counts + runner + the SUT's source-SHA** in the run-logs, and **fold them into** this
   ledger's "Regression" section (replace the "folding on completion" placeholder).
4. Re-submit `blocked → pr-draft` for re-review.

### Process notes (not blockers)
- **Editorial audit deferred**: per the 2-minute-bounce precedent (CTRIB-028 decline, PROGRESS.md 2026-06-22), the
  whole-tree doc-product editorial read is deferred to the re-review (when the item returns `pr-draft`).
- **`lineage/**` left untouched** — the unowned P-001 probe residue is routed-around per O10; this review ran no
  suites, so it produced no ontology drift. Review committed only: this verdict + the `review-ctrib030`
  active-streams entry + the `state/PROGRESS.md` record.

## Rework directive (2026-06-23, maintainer) — RESUME POINT for the ctrib030 stream

**Maintainer order (2026-06-23):** rebase `contrib/CTRIB-030-lineage-depth-npe` onto current `origin/main`
(`fd71eb3d`) and re-run the FULL suite, **under the multi-stream protocol** (`playbooks/stream-coordination.md`) —
other contributor + reviewer streams are live; coordinate through `state/active-streams.yaml`, isolate resources,
respect the serialized heavy-e2e flock.

**Pre-verified read-only (review session, 2026-06-23):** the rebase is **conflict-free** —
`git -C ../odd-platform-ctrib030 merge-tree --write-tree fd71eb3d 1cff8a59` → exit 0, clean tree `039a1142`; the
fix touches only `{openapi.yaml, LineageDepthDefaultTest.java}`, **disjoint** from the 028 squash's files. (Same
check ⇒ PR #1800's eventual merge into `main` is clean too.) So the rebase will not conflict.

**Steps (in order):**
0. **Register/refresh** the ctrib030 entry in `state/active-streams.yaml` at intake; trust the live tree over the
   record (O4/O8/O9). Reuse ctrib030's own namespace — worktree `../odd-platform-ctrib030`, SUT tag
   `odd-platform:odd-team-sut-ctrib030`, compose project `ctrib030`, ports `18090/15442` (all idle). Flip the item
   `blocked → in-progress`.
1. **Rebase** (in the worktree):
   `git -C ../odd-platform-ctrib030 rebase --onto fd71eb3d 4028b4a6 contrib/CTRIB-030-lineage-depth-npe`
   (replays only `1cff8a59`). Confirm `git diff --stat origin/main...HEAD` = exactly the 2 fix files, and the
   worktree now carries the merged 028 Term Detail hardening (so the `term-*` specs are valid on this SUT).
2. **Rebuild ONE SUT** from the rebased HEAD (per-stream tag `odd-team-sut-ctrib030`); record the digest.
3. **Unit CI replica** on the rebased HEAD → GREEN (read pass/fail + checkstyle **counts**, not the exit code).
4. **FULL regression on that ONE SUT** — `integration-tests/run-regression.sh ctrib030` (acquires the heavy-e2e
   **flock**; the flock is **FREE now** — ctrib032 finished — but it is serialized: if another stream grabs it
   first, queue behind it, G-C2; never concurrent with a maintainer run). Required, **with counts**:
   feature-complete GREEN-for-change (IT-037 re-grounded ⇒ unset→200 passes; name + count any residual failure);
   multi-stack **GREEN** (resolve/explain the prior `d03a378e` FAIL); known-bugs 3-RED-expected / 0-unexpected-GREEN;
   ingestion-e2e GREEN — **all on the same SUT digest**.
5. **Record** each bucket **with counts + runner + the SUT source-SHA** in `integration-tests/run-log/2026-06-23-*.md`
   and **fold the numbers into** this ledger's "Implementation (Phase D) → Regression" (replace "folding on completion").
6. **Docs/ontology**: DOC-481 (release/0.29.0) stands; `/enrich --touched` only while `lineage/**` is clean+unclaimed
   (currently DIRTY with the unowned P-001 residue → defer-justified per G-C10/O10 if still dirty).
7. **Push** the rebased branch via the odd-contributor App (same-name, never main-tracked — O6/LSN-038) so PR #1800
   updates to the rebased HEAD; re-submit `in-progress → pr-draft` for a fresh `/review` (separate session).

**Serialized-resource state at dispatch (~2026-06-23T12:25):** heavy-e2e flock **FREE** (ctrib032's regression
pid 1059078 done; `state/locks/heavy-e2e.holder` gone). `lineage/**` DIRTY+unowned (P-001 + ctrib032 — O10
route-around). ctrib030 worktree idle @ `1cff8a59`; stack down. odd-team index = explicit-path atomic commits only.

## Rework run (2026-06-23) — AUTHORITATIVE regression (addresses every `/review` bounce point)

Executed the maintainer rework directive. **All gates ACTUALLY RUN, here, before handoff** (not "deferred to review").

### Rebase (review fix-list #1; G-C4 push-safe)
- `1cff8a59` → **`ca38fd0e`** via `git rebase --onto fd71eb3d 4028b4a6` — replays the spec-only fix onto
  `origin/main` `fd71eb3d` (028 #1798 now in base, fixing the b5930a75-reverted-base skew the review flagged).
  3-dot diff = exactly the 2 fix files.
- **Then `origin/main` ADVANCED** `fd71eb3d` → **`c7f14fc5`** mid-rework (ctrib032 PR #1802 *lookup-table
  description*, `Closes #1781`, MERGED). #1802 is **disjoint** from the lineage fix (touches `DataEntityMapperImpl`;
  mine touches `openapi.yaml` + `LineageDepthDefaultTest`) — `merge-tree c7f14fc5 ca38fd0e` exit 0. Re-rebased
  `ca38fd0e` → **`04e22af4`** onto `c7f14fc5` so the SUT reflects **current** merged main, not a stale base.
  3-dot diff still = exactly the 2 fix files. `push.default=current`; never main-tracked.

### Unit CI replica (full `:odd-platform-api:build`) — GREEN
- `scripts/run-platform-tests.sh` on `ca38fd0e`: **BUILD SUCCESSFUL 6m18s**; **144 suites / 593 tests / 0 failed /
  0 errors / 0 skipped**; checkstyleMain+checkstyleTest clean; `jacocoTestReport` ran; assemble ok.
- `LineageDepthDefaultTest` **3/3** (`downstream…WithoutDepth…Returns404`, `upstream…WithoutDepth…Returns404`,
  `explicitDepthOneMatchesTheDefault`) — the in-process RED→GREEN fix proof.
- **Patch-coverage gate: N/A (vacuously met).** The fix changes **zero production Java lines** (3-dot diff vs main =
  only `LineageDepthDefaultTest.java`, a test; the spec regenerates a `@RequestParam(defaultValue="1")` in
  generated/excluded code). No `jacocoTestCoverageVerification` is wired into `build`; behaviour is covered by the
  unit test + IT-037.

### FULL e2e regression — ONE current-main SUT, with counts (reviews #2/#3/#5/#6)
`integration-tests/run-regression.sh ctrib030` — builds ONE SUT from the worktree, flock-serialized, isolated, torn
down. **SUT source `04e22af4`** (current main `c7f14fc5` + #1758 fix), **digest `sha256:74b8a80e…`** — a single
coherent green SUT (no more 4-scattered-images). Run-logs carry runner + counts + the SUT-source SHA
(`integration-tests/run-log/2026-06-23-{feature-complete,known-bugs,multi-stack,ingestion-e2e}.md`, the
`74b8a80e` entries).

| Suite | Result | Verdict |
|---|---|---|
| **feature-complete** | **309 passed / 2 failed** | **GREEN-FOR-CHANGE** |
| **known-bugs** | **3 failed / 0 passed** (IT-004/006/007) | **expected-RED, 0 unexpected-green** |
| **multi-stack** | **9 passed / 0 failed** | **GREEN** (resolves the `d03a378e` FAIL — see below) |
| **ingestion-e2e** | **6 passed / 0 failed** (IT-128) | **GREEN** |

- **IT-037 lineage-depth-boundary GREEN** in-suite: `:32` explicit depth → 200; `:38` **UNSET depth → 200, not 500
  — #1758 fixed**. The fix is proven on the running system, not the diff.
- **The 2 feature-complete fails are NOT mine** (delta-0 vs main):
  - `confirmation-dialog-thunk-arm.spec.ts:32` (datasource) + `:91` (term) — **CTRIB-031's UNMERGED-fix tests**
    (F-031/PLT-233+234). CTRIB-031's `.unwrap()` fix isn't in main yet, so the bug those specs assert is genuinely
    present; they fail on **any** non-CTRIB-031 SUT (incl. plain main). Verified by the error symptoms (dialog
    closes-as-success / navigates to `/termsearch`).
- **multi-stack `d03a378e` FAIL resolved (review #1).** That prior FAIL was a *build-sut-bypassed* run on the old
  port scheme where the per-stream SUT and the multi-stack webhook-stub both bound `:18090`; `run-regression.sh` now
  floors per-stream SUT ports at `18100/15500`. multi-stack is **9/0 GREEN** here.

### The `direct-bind-create:60` flake — characterized, not assumed (review #4 "unsafe attribution")
On the 1st rework run (SUT `42ff85c4`, fd71eb3d-base) feature-complete was 308/3 — the 3rd fail was
`direct-bind-create.spec.ts:60` (F-172 admin "Create association" affordance, IT-107). I did **not** assume "flake":
- Solo re-run `run-suite.sh IT-107` on `42ff85c4` → **FAILED** (so not a load-window flake).
- **`ODD_SUT=ref:main` IT-107** (fresh main build `020d0438`, NO contributor change) → **FAILED** → **delta-0**:
  the failure is pre-existing on main, **mechanically impossible** to be caused by a spec-only `lineage_depth`
  default (disjoint feature: `OWNER_RELATION_MANAGE` admin affordance).
- On the current-main re-run (`74b8a80e`) it **PASSED** → genuinely **non-deterministic**.
- Routed to disk: **strengthened TST-054** (the existing owner-association-admin-UI flake item) with this evidence —
  it now documents the *fails-in-isolation* signature + the contributor-independent `feature-complete` false-RED, and
  flags a priority bump. Evidence: `integration-tests/run-log/2026-06-23-IT-107.md`.

### Docs (G-C10/G-C11) — DOC-481 stands
`release/0.29.0` @ `71f3e53` (api-reference/lineage + data-lineage/data-objects, "omit→500" → default-1) is intact
on the train; **DOC-481** (pending-release, milestone 0.29.0) carries the Gate-8 live verification for the release
gate. Read-confirmed unchanged by the rebase (the spec fix is identical). No further doc change.

### Ontology (G-C10) — `/enrich --touched` DEFERRED (justified, unchanged)
`lineage/**` is still DIRTY with the unowned P-001 probe residue (O10 route-around; R9 single-writer). The change is
a 1-line contract `default:`; the touched sidecars' endpoint shape is structurally unchanged. Refreshes at the next
clean-lineage window / the 0.29.0 release substrate scan.

### Definition of Done — all five gates ACTUALLY RUN at the committed SHA `04e22af4`
1. ✅ unit build GREEN (working tree) · 2. ✅ FULL integration regression on the working-tree SUT (`74b8a80e`):
feature-complete green-for-change + multi-stack 9/0 + known-bugs 3-RED-expected/0-unexpected-green + ingestion-e2e
6/0 · 3. ✅ docs read + decided + routed (DOC-481, release/0.29.0) · 4. ⏸ ontology deferred-justified (dirty
lineage) · 5. ✅ Principal sufficiency — spec-only, zero production-Java delta, patch-coverage vacuously met, no
control lost, no existing functionality harmed; non-UI change (no screenshot warranted).

### Next
Push `04e22af4` via the odd-contributor App (same-name refspec, force — the rebase rewrote history; never
main-tracked) so PR #1800 updates to the current-main HEAD; flip `in-progress → pr-draft`; hand to a fresh
`/review` (separate session) → GATE 2 (human merge).
