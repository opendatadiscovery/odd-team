---
ctrib: CTRIB-030
github_issue_number: 1758
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1758
title: "Lineage endpoints: unset lineage_depth autoboxes null → NPE → HTTP 500 (no @Max cap); no SECURITY_RULES on any lineage read"
class: bug                    # Defect 1a (unset-depth → 500) is a real, live-reproduced crash. Defect 2 (RBAC) reclassifies to expected-behaviour (see Product analysis). Defect 1b is out-of-scope (owned by existing items).
scope: backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop). Internal id = PLT-100.
status: planned              # Phase A–C complete; STOPPED at GATE 1 (plan approval). No code written (G-C3).
reproduced: "LIVE on the running SUT (odd-platform:odd-team-sut digest 35ca9385 = the ctrib029 dc9b6422 build; lineage files byte-identical to origin/main 4028b4a6 — verified `git diff origin/main..HEAD` empty over Lineage/DataEntityController/SecurityConstants/ControllerAdvice). 2026-06-22, auth DISABLED. RED: `GET /api/dataentities/1/lineage/downstream` (no lineage_depth) → HTTP 500 {code:SYS001, message:'Internal Server Error'}. CONTROL (proves NPE is pre-lookup): `…/lineage/downstream?lineage_depth=1` → HTTP 404 {code:USR002, message:'DataEntity with id 1 is not found'} — same nonexistent id reaches the service and 404s gracefully WITH a depth; 500s BEFORE the lookup WITHOUT one. See '## Reproduction'."
adr_required: false          # The crash fix (Defect 1a) needs NO ADR. Defect 2 (RBAC) is INTENDED behaviour (ODD's published authz model) → no security-posture code; an OPTIONAL implicit-ADR could CODIFY the existing 'reads-open, writes-permissioned' decision (adr pillar) — maintainer's call at GATE 1, NOT a blocker for this PR.
plan_approved_by:            # PENDING — GATE 1
plan_approved_at:            # PENDING — GATE 1
plan_approved_scope:         # PENDING — GATE 1 (see '## GATE 1 — decision surface')
docs_routing: "release/0.29.0"   # api-reference/lineage: state the default depth = 1 (unreleased behaviour change → documentation train, G-C11). The DISABLED/RBAC caveats are tracked independently (DOC-293/DOC-320/DOC-338). Final decision after reading the page (Phase D).
pr_url:                      # PENDING — GATE 2
pr_draft:                    # PENDING — GATE 2
clarify_comment_url:         # none planned — no implementation-changing ambiguity (G-C6). The Defect-2 disposition is a GATE-1 maintainer decision, not a public clarifying question.
rootcause_comment_url:       # PENDING — folded into the scope comment, posted post-GATE-1
scope_comment_url:           # PENDING — G-C5 mandatory (this PR narrows the issue); drafted below, posted immediately after GATE-1 approval, before any code
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
