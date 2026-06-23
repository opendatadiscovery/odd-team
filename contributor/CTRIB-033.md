---
ctrib: CTRIB-033
github_issue_number: 1769
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1769
title: "Reference Data API contract gaps — (a) name-normalisation collision returns raw 500 not 409; (b) PATCH column endpoint discards the path table-id and mutates the wrong table"
class: bug                    # two distinct, live-reproduced contract defects in the Reference Data (Lookup Tables) WRITE API, same subsystem.
scope: backend
milestone: "0.29.0"           # open + semver (due 2026-06-27) → G-C11 PASSES (no hard stop). Internal draft id = PLT-146.
status: review-ready          # /review (review-ctrib033, SEPARATE session) ACCEPTED 2026-06-23 → pr-draft → review-ready. Reviewer's OWN unit (BUILD SUCCESSFUL 6m40s + 13 new tests green) + FULL e2e regression on a fresh SUT from ref:0cc89f79 (fc 311/2 all-non-mine, ms 9/0, kb 3-RED-expected, ie 6/0; IT-050 4/4) + IT-050 RED proof on the unfixed base (1/3) all confirm GREEN-for-change. Human GATE-2 (approve+merge PR #1804) → pending-release; the 0.29.0 release-review owns done. PLT-243 (security) surfaced for GATE 2.
reproduced: "LIVE on a throwaway isolated stack (ctrib033repro on :18130/:15472, image odd-platform:odd-team-sut digest cecd88db — CTRIB-028's confirmation build; CTRIB-028 never touched ReferenceData, so its ReferenceData bytes == current main fd71eb3d), auth DISABLED, 2026-06-23. (a) COLLISION: POST /api/referencedata/table {name:'ctrib033 dup'} → 200; POST {name:'ctrib033_dup'} (normalises to the same physical n_1__ctrib033_dup) → HTTP 500 {\"code\":\"SYS001\",\"message\":\"Internal Server Error\"}. (b) CROSS-TABLE PATCH: created table A(id 2) + B(id 3), added column bcol(field_id 4) to B; GET /table/2/columns/4 (B's column via A) → 400 {\"code\":\"USR001\",\"message\":\"bcol doesn't belong to ctrib033 table b\"} (read guard works); PATCH /table/2/columns/4 {name:'bcol_renamed_via_A'} → HTTP 200 + table B's column renamed to bcol_renamed_via_A while table A stayed [id]. Both defects confirmed. Stack torn down (down -v). See '## Reproduction'."
adr_required: false           # G-C7 does NOT fire. No migration (no schema change). No auth/security-posture change (RBAC unchanged; the fix MIRRORS the existing read-path belongs-to guard — it adds no SecurityRule/filter/token-flow/default). No breaking wire-contract change: the spec enumerates only success responses for every referencedata endpoint (error codes undeclared); the read path already returns an undeclared 400, so the write paths returning 400 is contract-consistent, and the create returning 400 instead of 500 is strictly better. No ADR governs this area (checked implicit-adrs.md).
plan_approved_by: RamanDamayeu
plan_approved_at: "2026-06-23"
plan_approved_scope: "Fix BOTH filed defects + the destructive DELETE-column twin. (a) createLookupTable: add ReactiveLookupTableRepository.existsByTableName + a uniqueness pre-check → UniqueConstraintException (400 USR003, NOT 409 — platform convention, Q1). (b) updateLookupTableField: thread lookupTableId into the service + mirror the read-path belongs-to guard (BadUserRequestException, 400). (b-twin) deleteLookupTableField: same signature change + same guard (Q2 — destructive twin, drops a column off the wrong table). EXCLUSIONS: no OpenAPI/migration/auth change; no ControllerAdvice mapping change; updateLookupTable rename-collision → follow-up PLT-242 (logged). Tests: unit (collision + PATCH-guard + DELETE-guard, Mockito mirroring the read-guard test) + re-ground IT-050 UC-007/UC-010 RED→GREEN (LSN-029/G-C15) + a DELETE-cross-table assertion. Approved via AskUserQuestion, 2026-06-23."
docs_routing: "release/0.29.0"   # REQUIRED correction: api-reference/reference-data.md published a caveat documenting defect (b) ("the platform never checks that the column belongs to the named table") — my fix makes it FALSE. Corrected on release/0.29.0 @ 4dddcb7 (defect-b para fixed; the SEPARATE permission-gate path-mismatch caveat KEPT — PLT-243; collision-400 noted). Paired DOC-484. lookup-tables.md unchanged (its RBAC-global caveat is orthogonal). Page READ (G-C10).
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1804"   # DRAFT PR (odd-contributor[bot]), Closes #1769, base main, head contrib/CTRIB-033-referencedata-write-contract @ 0cc89f79
pr_draft: true                # draft → the bot is the author and cannot self-approve; main branch protection requires ≥1 approving review (mergeable_state:blocked) — G-C4
clarify_comment_url:          # none warranted (G-C6) — the issue is precise + maintainer-verified; the two open decisions (error code, scope of the twins) are GATE-1 decisions, not public clarifying questions.
rootcause_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1769#issuecomment-4780877046"   # folded root-cause + scope (G-C6 one comment), posted post-GATE-1 before any code as odd-contributor[bot] (HTTP 201)
scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1769#issuecomment-4780877046"        # same comment — it states the 400-not-409 reframe + the DELETE-twin scope expansion + the rename-collision follow-up (G-C5)
follow_ups: "PLT-242 (issues/odd-platform/PLT-242.md) — updateLookupTable rename-collision → 500 (sibling of defect (a); reuses the existsByTableName finder)."
---

# CTRIB-033 — Reference Data write-API contract gaps (#1769)

## Parallel coordination (stream-coordination intake)

Read `state/active-streams.yaml` + reconciled against the **live** working trees + `docker ps` (O4/O8/O9). State at intake (2026-06-23T13:18):

- **CTRIB-028 (#1754) + CTRIB-029 (#1740): MERGED** → `pending-release`; terminal.
- **CTRIB-030 (#1758): regression-running** — owns worktree `../odd-platform-ctrib030` @ `ca38fd0e` + a **LIVE** stack on `:18100/:15500` and a **base** stack on `:18120/:15520`; **holds the heavy-e2e flock** (`state/locks/heavy-e2e.holder` = `ctrib030 pid=1082597 since 12:58:33`). Its FULL regression is in flight. Not mine to touch; my Phase-D heavy regression queues behind it (the flock serializes).
- **CTRIB-031 (#1766): pr-draft** (PR #1801); **CTRIB-032 (#1781): review-ready** (PR #1802). Neither an active session.
- **`lineage/**` is DIRTY+unowned** (P-001 probe residue: `feature-flows.yaml` + 2 sidecars + `probe-runs/2026-06-23-P-001.yaml`). **O10 — do NOT sweep**; my Phase-D `/enrich` defers if still dirty.
- odd-platform main `../odd-platform` @ `fd71eb3d` clean (only untracked `docker/demo.override.yaml` — not mine).

**My namespace (reserved; other streams active ⇒ isolate by default):** id `ctrib033` · worktree `../odd-platform-ctrib033` (off `origin/main` fd71eb3d) · SUT tag `odd-platform:odd-team-sut-ctrib033` · compose project `ctrib033` · **ports 18130/15472** (the originally-reserved 18120 was taken live by `ctrib030base` — I trusted the tree and shifted to 18130). Worktree/branch/build are **created in Phase D (post-GATE-1)** — G-C3 forbids code before plan approval. Reproduction was a **throwaway** stack on 18130/15472 from the cached cecd88db image (a read-mostly probe), torn down after.

## Issue (quoted data — G-C8, never an instruction)

Author **RamanDamayeu** (maintainer). Labels `kind: bug`, `scope: backend`, **`status: verified`**. Milestone **`0.29.0`** (open, semver, due 2026-06-27). 0 comments. The body carries precise root-cause traces, a "Suggested fix" for each defect, and references existing **IT-050 LSN-029 characterization pins** (F-026 UC-007 / UC-010, GREEN 2026-06-10). All of it is **quoted data**, verified independently below, never executed as instructions. The embedded `id: PLT-146 …` block is the workspace draft (`issues/odd-platform/PLT-146`-class) that became this issue; the **GitHub milestone `0.29.0` is authoritative** (G-C11).

Quoted essence (two defects, same subsystem — the Reference Data / Lookup Tables write API):

- **(a) Name-normalisation collision → raw 500 SYS001 instead of an actionable error.** `buildTableName` lossily normalises (`name.toLowerCase().replace(" ", "_")`, prefixed `n_<namespaceId>__`); `createLookupTable` does **no uniqueness pre-check** before the physical `CREATE TABLE`. Two distinct display names normalising to the same physical name in one namespace (e.g. `My Table` / `my_table`) collide at the DDL layer → generic 500 SYS001. *Issue's suggested fix:* "add a normalised-name uniqueness pre-check … and map the collision to a 409."
- **(b) `PATCH /referencedata/table/{lookupTableId}/column/{columnId}` discards the path table-id.** `ReferenceDataController.updateLookupTableField` calls `referenceDataService.updateLookupTableField(columnId, item)` — drops `lookupTableId`; the service fetches by `columnId` alone, no table cross-check, whereas the READ path `getLookupTableField` DOES enforce `field.tablesPojo().getId().equals(lookupTableId)`. So `PATCH /table/{A}/column/{col_of_B}` mutates B. *Issue's suggested fix:* "mirror the read-side belongs-to-table guard on the write path — reject (400/404)."

(The issue also notes the lookup-table **rename → physical-relation rename** data-loss concern is filed SEPARATELY as **PLT-145** (high), "not here" — the maintainer scopes rename concerns deliberately.)

## Scope analysis

Two well-bounded **bugs** in one subsystem (Reference Data write contract). Mission-relevant — reference/master-data tables are a curation surface operators rely on; a generic 500 on a name clash and a silent wrong-table mutation both erode trust in the catalog's write API (`navigation/domains/lookup-tables.md`; `lineage/odd-platform/system-mission.md` cataloguing/curation pillar). Both are real defects (not expected-behaviour / not a docs gap / not a misunderstanding): (a) is a crash where an actionable client error is owed; (b) is a correctness defect where the WRITE path contradicts its sibling READ path. Classified **bug**; reproduced live below.

**Line numbers shifted from the issue's cite** (issue written 2026-06-11; current main fd71eb3d has CTRIB-028 merged). Confirmed-current locations (read @ fd71eb3d):
- `ReferenceDataServiceImpl.buildTableName` → **:197-200**; `createLookupTable` → **:76-90** (no pre-check).
- `ReferenceDataController.updateLookupTableField` → **:131-141** (the dropping call `updateLookupTableField(columnId, item)` at **:139**); service `updateLookupTableField(columnId,…)` → **:132-149**.
- the read-path guard `getLookupTableField` → **:61-74** (`throw new BadUserRequestException("%s doesn't belong to %s", …)`).

### Two UNFILED scope-twins found while reading (G-C5 decisions for GATE 1)

1. **`deleteLookupTableField` is the byte-identical, DESTRUCTIVE twin of defect (b).** Controller `deleteLookupTableField(lookupTableId, columnId)` (**:160-165**) calls `referenceDataService.deleteLookupTableField(columnId)` (**:167-173**) — same dropped path-id, no cross-check. So `DELETE /table/{A}/column/{col_of_B}` **drops a column off the WRONG table B's physical relation** — worse than the rename (data loss, not just a wrong rename). Same root cause, same one-line guard. **Recommend folding into this PR.**
2. **`updateLookupTable` rename reuses `buildTableName` (**:120**) → the same collision-500 risk** as defect (a) when renaming table A to a name colliding with table B. **Recommend a follow-up PLT** (different method/flow; the maintainer separates rename concerns per PLT-145; needs self-exclusion logic).

Row write-paths (`updateLookupTableRow`, `deleteLookupTableRow`) fetch the table by the path `lookupTableId` first → **safe** (confirmed at :151-180). Only the two **column** write-paths have the asymmetry.

## Reproduction (G-C1 — reproduce-first; DONE)

Against a throwaway isolated stack (`:18130`, image `odd-platform:odd-team-sut` digest `cecd88db` = current-main ReferenceData; CTRIB-028 never touched ReferenceData), auth DISABLED, namespace `ctrib033_ns` (id 1), 2026-06-23. My own live observation — not the issue's.

```
### (a) NAME-NORMALISATION COLLISION → 500
POST /api/referencedata/table {"name":"ctrib033 dup","description":"first","namespace_name":"ctrib033_ns"}
  → HTTP 200  (physical n_1__ctrib033_dup created)
POST /api/referencedata/table {"name":"ctrib033_dup","description":"collides","namespace_name":"ctrib033_ns"}
  → HTTP 500  {"code":"SYS001","message":"Internal Server Error","retryable":false,"resolvable":false}
  # "ctrib033 dup" and "ctrib033_dup" both normalise to n_1__ctrib033_dup → DDL collision → raw 500.

### (b) CROSS-TABLE COLUMN PATCH → 200 + WRONG TABLE MUTATED
# setup: table A (id 2), table B (id 3); add column bcol (field_id 4) to B.
GET   /api/referencedata/table/3/columns/4   (B's column via B)  → HTTP 200  (sanity)
GET   /api/referencedata/table/2/columns/4   (B's column via A)  → HTTP 400  {"code":"USR001","message":"bcol doesn't belong to ctrib033 table b","resolvable":true}   # READ guard WORKS
PATCH /api/referencedata/table/2/columns/4 {"name":"bcol_renamed_via_A"}  (B's column via A) → HTTP 200   # THE BUG: path table-id A=2 ignored
  → table B (id 3) columns now: ['id', 'bcol_renamed_via_A']     # B was mutated
  → table A (id 2) columns still: ['id']                          # A untouched — caller addressed A, mutated B
```

The asymmetry is unmistakable: the READ path 400s ("doesn't belong to"), the WRITE path 200s and mutates the wrong table. The read guard's exact shape (400 `BadUserRequestException`, message `"%s doesn't belong to %s"`) is the pattern the fix mirrors onto the write paths.

## Root cause

- **(a)** `createLookupTable` (`ReferenceDataServiceImpl:76-90`) builds a physical table name via the lossy `buildTableName` and issues the physical `CREATE TABLE` with **no uniqueness pre-check**. The duplicate physical-relation create fails at the DDL layer (a Postgres SQLState class-42 "relation already exists", NOT a class-23 integrity-constraint violation), so `ExceptionUtils.translateDatabaseException` (which only translates class-23 → `UniqueConstraintException`) does not catch it; it falls through to the generic `Exception` handler → 500 SYS001 (`ControllerAdvice:94-99`).
- **(b)** `ReferenceDataController.updateLookupTableField` (`:131-141`) receives both `lookupTableId` and `columnId` but passes only `columnId` to the service (`:139`); `ReferenceDataServiceImpl.updateLookupTableField(columnId,…)` (`:132-149`) fetches the column by id alone and never checks it belongs to the path table — unlike the sibling READ path `getLookupTableField` (`:61-74`), which does. The write path is asymmetric and unguarded. `deleteLookupTableField` has the identical defect.

## Change-request product analysis (G-C16 — critique the WHAT before the HOW)

**User-observable problem, restated independent of the issue's suggested fix:**
- (a) A cataloguer creating a lookup table whose name normalises to one that already exists in the namespace gets a generic *"Internal Server Error"* — no signal that it's a name clash, no way to know what to change. They need a clear, actionable client error ("a table with this name already exists").
- (b) A caller (or automation) addressing table A's column endpoint with a column-id that actually belongs to table B silently mutates B — a wrong-resource write. They need the write rejected, exactly as the read already is.

**SME / Product-Owner reasoning (reasoned inline — the authoritative norm is in-repo, stronger than any external convention):** the issue *suggests* HTTP **409** for (a), but **the platform's own established convention for a uniqueness collision is `UniqueConstraintException` → HTTP 400, code `USR003`** (`ControllerAdvice:39-43`; used for namespace/term/owner/tag/data-source/role/policy/… collisions, each with an "X with this name already exists" message in `ExceptionUtils.formatMessage`). The user-facing requirement — *an actionable 4xx that says "already exists"* — is satisfied by 400 USR003, and consistency with every other collision in the API is a stronger signal than textbook REST semantics. Adopting 409 would force either (i) changing the GLOBAL `ControllerAdvice` mapping (which would flip the status of every existing uniqueness check platform-wide — a cross-cutting posture change, out of scope and risky) or (ii) a one-off 409 inconsistent with the rest of the API. For (b), the read path already returns 400 USR001 `"doesn't belong to"` — mirroring it verbatim is the obviously-correct shape (no product ambiguity).

**Options & recommendation:** see **GATE 1** below. Recommendation: (a) → **400 USR003** (platform convention) with a clear "already exists in this namespace" message; (b) → mirror the read guard (400) on the PATCH path **and** its destructive DELETE twin; rename-collision → follow-up PLT. Divergence from the issue's "409" + the scope of the twins are surfaced as the GATE-1 decision (not silently absorbed).

## Design before build (G-C12 — reuse / ADR / impact / lens)

1. **Reuse-scan (no new parallel components):**
   - (a) reuse the existing **`UniqueConstraintException`** (→ 400 USR003) — no new exception type, no new error code. The only new artefact is a finder: **add `Mono<Boolean> existsByTableName(String tableName)` to `ReactiveLookupTableRepository` (+Impl)** — one-sentence justification: no existing finder queries by physical table name (the repo has `getTableById`/`getTableWithFieldsById`/`countByState`/`findByState`), and the collision key IS the physical `table_name`. jOOQ `selectOne()/fetchExists` on `LOOKUP_TABLES.TABLE_NAME` (the `LOOKUP_TABLES` table is already imported in the Impl).
   - (b) reuse the EXISTING read-path guard **verbatim** (`columnDto.tablesPojo().getId().equals(lookupTableId)` → `BadUserRequestException("%s doesn't belong to %s", columnPojo().getColumnName(), tablesPojo().getName())`). Pass `lookupTableId` into the service; no new component.
2. **ADR-check:** read `lineage/odd-platform/implicit-adrs.md` — **no ADR governs the ReferenceData write-contract / uniqueness area.** The fix CONFORMS to two established patterns (UniqueConstraintException→400 USR003; the read-path belongs-to guard). **No new ADR; G-C7 does not fire** (no migration, no auth-posture change, no breaking wire-contract). (Adjacent known scopes, NOT mine: REFACTOR-193 — the spec declares 201 for PATCH/PUT while the controller returns 200; REFACTOR-194 — LOOKUP_TABLE permission-enum drift. The fix does not touch or worsen either.)
3. **Impact-dimension checklist:**
   - **i18n** — **N/A** (not deferred): the error messages are server-side API strings (English), exactly like every existing `UniqueConstraintException` message and the read-guard's "doesn't belong to". No UI locale catalogs involved.
   - **generated clients** — **none**: NO OpenAPI change (error responses are undeclared platform-wide; success codes unchanged). The `ReferenceDataService` signature change is internal Java; the controller already receives both path params; FE/BE clients are unaffected.
   - **every consumer** — `ReferenceDataService` is consumed ONLY by `ReferenceDataController` (+ the unit test) — grep-confirmed. `updateLookupTableField`/`deleteLookupTableField` are called only by the controller. `LookupDataService.deleteLookupTableField(dto)` is a separate lower-level method (takes a DTO) — unaffected.
   - **migration** — **none** (no schema change).
   - **docs + ontology** — the `master-data-management/lookup-tables.md` API surface section may note the error behaviour (decide in Phase D after READING it — G-C10); F-026 facets/feature-flow + the ReferenceData sidecars re-enriched (`/enrich --touched`, Phase D).
   - **tests** — see ledger below. Sufficiency: every new/changed service method gets a Mockito unit test mirroring the existing read-guard test; IT-050 UC-007/UC-010 re-grounded RED→GREEN (+ a DELETE-twin assertion if (b)-twin is approved).
4. **Product-Owner/SRE lens:** bug-shaped; reasoned inline in the G-C16 section. The one product decision (400 vs 409) is the GATE-1 question. No UI surface → no rendered-pixel step (design-before-build step 5 N/A).

## Plan (GATE 1 artifact)

**Recommended change (pending GATE-1 confirmation of the two decisions below):**

**Defect (a) — collision → actionable 400 USR003:**
- `ReactiveLookupTableRepository` + `…Impl`: add `Mono<Boolean> existsByTableName(String tableName)` (jOOQ exists on `LOOKUP_TABLES.TABLE_NAME`).
- `ReferenceDataServiceImpl.createLookupTable`: after resolving the namespace + computing `buildTableName`, pre-check `existsByTableName(tableName)`; if present → `Mono.error(new UniqueConstraintException("Lookup table with this name already exists in this namespace"))`; else proceed unchanged. (→ 400 USR003 via `ControllerAdvice`.)

**Defect (b) — PATCH belongs-to guard (+ the DELETE twin, if approved):**
- `ReferenceDataService` + `…Impl`: change `updateLookupTableField(columnId,…)` → `updateLookupTableField(lookupTableId, columnId,…)`; after the existing `getLookupTableDefinitionById(columnId)` fetch, add the read-path guard (mismatch → `BadUserRequestException("%s doesn't belong to %s", …)`); rest unchanged.
- `ReferenceDataController.updateLookupTableField`: pass `lookupTableId` through (`:139`).
- **(twin, if approved)** same signature+guard for `deleteLookupTableField(lookupTableId, columnId)` + controller pass-through (`:163`).

**Explicit scope EXCLUSIONS (G-C5):**
- **NO** OpenAPI / wire-contract change (status codes for success paths unchanged; error codes already undeclared).
- **NO** migration, **NO** schema change, **NO** RBAC/auth change.
- **NO** change to the global `ControllerAdvice` mapping (so 409 is explicitly out — see decision Q1).
- **NO** fix of `updateLookupTable` rename-collision in this PR → **logged as a follow-up PLT** (`playbooks/follow-up-on-disk.md`).
- **NO** touching the row write-paths (already safe), search, or the REFACTOR-193/194 hygiene gaps.

**Test ledger (planned):**
| Bucket | Test | RED-on-base proof |
|---|---|---|
| unit (odd-platform CI) | `ReferenceDataServiceImplTest.createLookupTable_normalisedNameCollision_errorsUniqueConstraint` (mock `existsByTableName`→true) | new method asserts new behaviour |
| unit | `updateLookupTableField_columnBelongsToDifferentTable_errorsBadRequest` (mirror the existing read-guard test) | fails to compile/asserts on base (no guard) |
| unit | `deleteLookupTableField_columnBelongsToDifferentTable_errorsBadRequest` (if twin approved) | — |
| integration (odd-team IT-050) | **re-ground UC-007** (LSN-029/G-C15): assert 400 `USR003` (was: pin GREEN on 500). SoT for the new value = platform convention (`ControllerAdvice:39-43` + `ErrorCode.UNIQUE_CONSTRAINT`). | RED on `ODD_SUT=ref:main` (base returns 500) |
| integration (IT-050) | **re-ground UC-010**: assert 400 + table B's column **NOT** renamed (was: pin GREEN on 200 + renamed). SoT = the read-guard contract + a captured real response. | RED on `ref:main` (base returns 200 + renames) |
| integration (IT-050) | (if twin) a DELETE-cross-table assertion: 400 + B's column NOT dropped | RED on base (base 204 + drops) |

Per G-C15, each re-grounded pin's new expected value traces to an independent SoT (the platform's documented error convention + a captured real response — never the system's current buggy output), the assertion is not weakened, and the RED survives on `ref:main`. The IT-050 protocol `.md` §UC-007/§UC-010 + §5 PASS/FAIL get updated to the post-fix expectations (the spec already anticipates this flip).

**Docs (Phase D):** READ `documentation/.../master-data-management/lookup-tables.md`; if it documents the error/contract behaviour, update on the **release/0.29.0** train (unreleased behaviour) + a paired DOC item; else record "no doc change + why". **Ontology (Phase D):** `/enrich --touched` the ReferenceData sidecars + F-026 feature-flow facets (`build_table_name_lossy_normalisation_collision_500`, `update_column_path_param_discarded_cross_table_jump`), committed — only while `lineage/**` is clean+unclaimed, else a justified deferral.

## GATE 1 — the decisions for the maintainer

Two implementation-changing decisions (everything else follows best practice / the established pattern):

- **Q1 — error code for defect (a):** the issue suggests **409**; the platform convention is **400 USR003** (`UniqueConstraintException`, used for every other uniqueness collision). *Recommend 400 USR003* (consistency + actionable, no cross-cutting `ControllerAdvice` change).
- **Q2 — scope:** *Recommend* fixing the two FILED defects **plus** the destructive DELETE-column twin of (b) (same root cause, 1-line guard, prevents wrong-table column DROP), and logging the `updateLookupTable` rename-collision as a follow-up PLT. Alternatives: filed-only (a+b PATCH); or all-in (a+b+delete+rename).

A drafted scope/root-cause comment for the issue thread (posted immediately after approval, before any code — G-C5/G-C6) lives in `## Drafted scope comment` below; its final wording adapts to the chosen Q1/Q2.

## Drafted scope comment (post-GATE-1, before code — public; no workspace-internal IDs)

> Drafted for the RECOMMENDED Q1=400/Q2=(a+b+delete-twin) path; final wording adapts to the GATE-1 decision. Posted to the issue thread via the bot, then mirrored to `rootcause_comment_url`/`scope_comment_url`.

```
Confirmed both defects by reproducing them live on current `main` (auth DISABLED):

(a) Two display names that normalise to the same physical table name in one namespace
    (e.g. "My Table" / "my_table") collide at the physical CREATE TABLE and surface a
    generic 500 (SYS001) — there is no uniqueness pre-check in createLookupTable.
(b) PATCH /referencedata/table/{lookupTableId}/column/{columnId} ignores the path
    lookupTableId: addressing table A with a column-id that belongs to table B renames
    B's column and returns 200, while the sibling READ path correctly rejects it with a
    "doesn't belong to" 400.

Planned fix (one PR):
- (a) Add a normalised-name uniqueness pre-check in createLookupTable and return an
  actionable 400 "already exists in this namespace". Note: this returns 400 (the code
  this platform already uses for every other uniqueness collision — namespaces, terms,
  owners, tags, …) rather than the 409 the report suggested, to stay consistent with the
  rest of the API; a one-off 409 here would diverge from that convention.
- (b) Mirror the read-side column-belongs-to-table guard on the write path so a
  mismatched column-id is rejected (400) instead of mutating the wrong table.

Also folding in: DELETE /referencedata/table/{lookupTableId}/column/{columnId} has the
identical dropped-path-id defect and is *destructive* (it drops a column from the wrong
table), so it gets the same guard in this PR.

Out of scope here (tracked separately): the rename path (updateLookupTable) reuses the
same name-builder and shares the collision risk; it will be addressed as a separate
follow-up to keep this change focused on the two reported defects + the delete twin.
```

## Phase D progress (implement + test + docs + ontology)

**Base reconciled (live drift):** while working, `origin/main` advanced `fd71eb3d → e481cefd` (CTRIB-032 #1802 + CTRIB-030 #1800 merged). The diff touches only `DataEntityMapperImpl` + `openapi.yaml` (lineage_depth) + tests — **zero ReferenceData write-API code**, so the reproduction base + fix base are unaffected. The worktree is correctly based on the latest `e481cefd`, conflict-free.

**Code — COMMITTED @ `0cc89f79`** on `contrib/CTRIB-033-referencedata-write-contract` (worktree `../odd-platform-ctrib033`, same-name-tracked, never main — `@{u}` errors / push.default=current). 8 files (5 src + 3 test):
- (a) `ReactiveLookupTableRepository[Impl].existsByTableName` (new finder); `createLookupTable` pre-check → `UniqueConstraintException` (400 USR003).
- (b) `ReferenceDataService`/`Impl`/`Controller`: `updateLookupTableField` + `deleteLookupTableField` now take `lookupTableId` + the read-path belongs-to guard (400 `BadUserRequestException`).

**Unit (G-C2 unit bucket) — GREEN on the working tree.** `scripts/run-platform-tests.sh` (full `:odd-platform-api:build` = test + checkstyle + assemble): **BUILD SUCCESSFUL** (the second run incl. the new controller + repo tests). Suites: `ReferenceDataServiceImplTest` 10/10 (collision + both guards, reject + pass), `ReferenceDataControllerTest` 2/2 (controller forwards both path ids), `ReactiveLookupTableRepositoryImplTest` 1/1 (existsByTableName vs real Postgres). 0 failures, 0 skips.
- **Local patch-coverage gate (G-C13) — MET.** Changed measured lines covered: controller L139/L163 COVERED (ci=9/6); service createLookupTable pre-check + both guards COVERED. `ReactiveLookupTableRepositoryImpl` is jacoco-EXCLUDED (`**/repository/**`, `odd-platform-api/build.gradle:187`) → not measured (the repo test still validates it). Gate = Madrapps `min-coverage-changed-files: 98` (diff-line); checked locally, not in CI.

**Integration (G-C2 integration bucket) — IT-050 re-grounded (LSN-029/G-C15); FULL regression RUNNING.**
- Re-grounded `integration-tests/e2e/specs/lookup-tables-rdm.spec.ts` + the protocol SoT `protocols/IT-050-lookup-tables-rdm.md` IN SYNC: **UC-007** 500→**400 USR003** + "already exists"; **UC-010** 200+renamed→**400** + B untouched; **UC-011 NEW** (DELETE twin) → 400 + B's column survives. New expected values trace to the platform-convention SoT (`ControllerAdvice` + `ErrorCode.UNIQUE_CONSTRAINT`) + the read-guard contract — never the system's current output; tightened not weakened; **RED survives on pre-fix main**.
- **FULL regression LAUNCHED:** `integration-tests/run-regression.sh ctrib033` (flock was FREE — ctrib030's run finished; isolated ctrib033 namespace; builds SUT from the committed worktree `0cc89f79`; tears down). Suites: feature-complete + multi-stack + known-bugs + ingestion-e2e. **[counts pending — running; recorded on completion.]**
- **RED proof (pending):** `ODD_SUT=ref:main run-suite.sh IT-050` → the re-grounded cases must FAIL on `e481cefd`. The live reproduction above already shows the base returns 500 / 200+renamed (which the re-grounded `expect(400)` rejects).

**Docs (G-C10/G-C11) — DONE + routed (release/0.29.0).** READ `api-reference/reference-data.md` → it **published a caveat documenting defect (b)** which my fix makes FALSE → REQUIRED correction. Corrected on the **release/0.29.0** train @ `4dddcb7` (pushed, same-name): defect-(b) para removed (fixed), column rows note the new 400, create row notes the collision-400; the **separate** permission-gate path-mismatch caveat KEPT (still true — PLT-243). Paired **DOC-484** (`pending-release`, post-release Gate-8). `lookup-tables.md` unchanged (its RBAC-global caveat is orthogonal).

**Ontology (G-C10) — DEFERRED (justified).** `lineage/**` is DIRTY+unowned (P-001 residue; R9/O10 — never `/enrich` into a dirty/unowned tree). The F-026 facets (now FIXED) re-enrich when `lineage/**` is clean+unclaimed (next substrate scan / 0.29.0 release scan) — same accepted bar as CTRIB-028/029/032.

**Follow-ups logged on disk (G-C5 / follow-up-on-disk):**
- **PLT-242** — `updateLookupTable` rename-collision → 500 (sibling of defect (a); reuses `existsByTableName`).
- **PLT-243** — **SECURITY (high):** the column PATCH/DELETE permission gate never fires (SecurityRule on singular `/column/` vs the plural `/columns/` route → endpoints are authentication-only). Confirmed at `SecurityConstants.java:337,341`. Out of #1769's scope + a G-C7 posture change → NOT fixed here; **surfaced at GATE 2**. My fix mitigates the cross-table vector but does not restore this gate.

**Definition of Done (five gates):** 1. unit build GREEN ✓ · 2. FULL integration regression GREEN-for-change ✓ (counts below) + RED proof ✓ · 3. docs read + corrected + routed ✓ · 4. ontology deferred-justified ✓ · 5. Principal sufficiency ✓ (counts below). All five checked as actually-run before handoff.

## Phase E — FULL regression + RED proof + draft PR (G-C2 complete)

**SUT:** built from the committed worktree `0cc89f79` (digest `a44613f0…`) via `run-regression.sh ctrib033` (flock-serialized, isolated, torn down). Counts read from the run-logs / Playwright summaries (not exit codes — G-C2).

| Suite | Result | Notes |
|---|---|---|
| **feature-complete** | **310 passed / 3 failed** — GREEN for this change | The 3 failures are NOT this change (delta-0; all non-ReferenceData): 2 = a separate **unmerged** FE PR's `confirmation-dialog-thunk-arm` tests (CTRIB-031 / #1801, not in this SUT); 1 = `owner-association-triage:78` = **TST-054 known flake** (recurring across the 06-07…06-21 run-logs; timed out at 1.0m). **IT-050's 4 cases all GREEN** (UC-001/007/010/011). |
| **multi-stack** | **9 / 0 GREEN** | |
| **known-bugs** | **3 expected-RED** (attachment LSN-001/PLT-086, error-boundary F-042, quality-dashboard PLT-052) | the known set; **no unexpected GREEN** (no pin flipped). |
| **ingestion-e2e** | **6 / 0 GREEN** | |

**RED proof (G-C15 surviving-RED) — `ODD_SUT=ref:main run-suite.sh IT-050` on `e481cefd` (pre-fix base; SUT digest `3885c4af…`):** **1 passed / 3 failed** — ✓ UC-001 (the feature works on base); ✘ UC-007 (base 500s, not 400), ✘ UC-010 (base 200s + renames B), ✘ UC-011 (base 204s + drops B's column). The re-grounded cases FAIL on the buggy base and PASS on the fix → they assert *more* truth and do **not** hide the bug (not green-on-both). `run-log/2026-06-23-IT-050.md` (outcome e2e:FAIL = the expected RED).

**Principal sufficiency (G-C13):** enough + meaningful tests — both buckets, both branches of each guard (reject + proceed), the collision (reject + proceed), and the RED-on-base proof; the local patch-coverage gate is met (changed measured lines covered; repo impl jacoco-excluded); no control lost (the fix mirrors the read-path guard + reuses the platform uniqueness convention — no new abstraction); no existing functionality harmed (the FULL regression is delta-0 for this change); no auth-posture / wire-contract change.

**Draft PR — DRAFT #1804** ([link](https://github.com/opendatadiscovery/odd-platform/pull/1804)): `Closes #1769`, head `contrib/CTRIB-033-referencedata-write-contract` @ `0cc89f79`, base `main`, `draft:true`, author `odd-contributor[bot]`, `mergeable_state:blocked` (G-C4 merge gate verified — the bot cannot self-approve; ≥1 maintainer approval required). Branch pushed via the App with an explicit same-name refspec — `main` untouched (LSN-038). PR body: `contributor/CTRIB-033-pr-body.md` (no workspace-internal IDs; the security follow-up referenced as "a separate, already-documented permission-gate issue").

**Handoff (GATE 2):** run `/review` in a **separate session** (it flips `pr-draft → review-ready` + re-confirms the gates), then a human approves + merges #1804 → `pending-release` (the 0.29.0 release-review owns the `done` flip: docs-train publish + Gate-8 live-site DOC-484 + the deferred `/enrich` at the release substrate scan). **Surface to the maintainer: PLT-243 (security — the column-write permission gate never fires) — decide whether to schedule it for 0.29.0 or later.**

## Review (2026-06-23, session: review-ctrib033)

- **Result: ACCEPTED → `pr-draft` → `review-ready`.** Separate `/review` session (implement was a prior session — commits 4b03a23 / 5206383 / c3174d6). Human GATE-2 (approve + merge PR #1804) owns the `pending-release` flip; the 0.29.0 release-review owns `done`.
- **Live reconcile (O4/O8/O9):** origin/main advanced `fd71eb3d → e481cefd → 56480919` (CTRIB-031 #1801 merged mid-review — FE-only). PR #1804 live: draft, author `odd-contributor[bot]`, head `0cc89f79`, base main, 8 files +236/-15 (matches the diff exactly). Reviewed commit `0cc89f79`, worktree `../odd-platform-ctrib033` clean.

### Cheap precondition (2-minute bounce) — NOT triggered
DoD claims full completion (no "NOT RUN"/"deferred" for the test gates); integration run-logs exist with a coherent single SUT digest (`a44613f0`) across all four fix-buckets + the RED-proof base (`3885c4af`). Proceeded to the full confirmation.
- **Observation (non-blocking):** the implementer's five run-logs were *skeletons* — `runner:`/`evidence:` unfilled, **no pass/fail counts** in the log files (counts were only in this ledger). Coherent (single SUT + expected outcome flags), so not a bounce — but counts belong in the run-log. Filled with my own measured counts this session.

### Acceptance criteria (GATE-1-approved scope) — all delivered
- [x] (a) collision → **400 USR003** (not 409) via `existsByTableName` pre-check — PASS (`ReferenceDataServiceImpl:88-93`; IT-050 UC-007 GREEN-on-fix / RED-on-base)
- [x] (b) PATCH column belongs-to guard (400) — PASS (`:143-147`, mirrors read-guard `:67-71` verbatim; IT-050 UC-010 GREEN/RED)
- [x] (b-twin) DELETE column belongs-to guard (400) — PASS (`:183-187`; IT-050 UC-011 GREEN/RED)
- [x] Exclusions held (no openapi/migration/auth/ControllerAdvice change) — PASS (diff = exactly the 8 scoped files, +236/-15)
- [x] rename-collision deferred → PLT-242 on disk — PASS

### Quality Bar
- **Gate 1 — PASS** (no duplicate: reuses `UniqueConstraintException` + the read-path guard; only new artefact `existsByTableName`, justified)
- **Gate 4 — PASS** (`Consumer-read:`/`Sources:` footer verified — `ReferenceDataController` is the sole consumer of the changed service methods via grep; `UniqueConstraintException→400 USR003` + `BadUserRequestException→400` confirmed in `ControllerAdvice:27-41` + `ErrorCode` (USR001/USR003); `getLookupTableField` read-guard mirrored verbatim)
- **Gate 5 — N/A** (no SDK builder in scope)
- **Gate 8 — PENDING-RELEASE (0.29.0)** (docs corrected on `documentation@release/0.29.0` @4dddcb7, DOC-484; live-site verification scheduled at the 0.29.0 release gate)
- **Gate 9 — PASS** (footer sources verified: openapi.yaml endpoint shapes; ControllerAdvice/ErrorCode mappings; read-guard; reproduction re-confirmed by my RED proof)
- **Gate 10 — N/A** (code change; docs change is correctly homed on the API-reference page)
- **Gate 11 — PASS** (mechanical banned-term grep on `reference-data.md` CLEAN — operator language only)
- **G-C1 reproduce-first — PASS** (documented reproduction; independently re-confirmed by my RED proof: base 500 / 200+mutate / 204+drop)
- **G-C2 verify-running-system, FULL regression both buckets — PASS (reviewer's OWN runs):**
  - Unit (CI replica `:odd-platform-api:build` on 0cc89f79): **BUILD SUCCESSFUL 6m40s** + checkstyleMain/Test; JUnit XML — `ReferenceDataServiceImplTest` 10/10, `ReferenceDataControllerTest` 2/2, `ReactiveLookupTableRepositoryImplTest` 1/1, 0 failures.
  - Integration (SUT `odd-team-sut-review-ctrib033` digest `652c0e81` ← `ref:0cc89f79`): **feature-complete 311/2**, **multi-stack 9/0**, **known-bugs 3-RED-expected/0-unexpected-green**, **ingestion-e2e 6/0**. The 2 fc fails = `confirmation-dialog-thunk-arm.spec.ts:32,:91` (CTRIB-031 #1801's fix, absent from this SUT — delta-0; #1801 now in main → pass post-rebase). **IT-050 all 4 GREEN.**
- **G-C3 — PASS** (`plan_approved_by: RamanDamayeu`, GATE 1, AskUserQuestion)
- **G-C4 — PASS** (structural: draft + `odd-contributor[bot]` author; a human must approve+merge). *Note: PR API now reports `mergeable_state: clean` (was `blocked`) — draft + bot-cannot-self-approve still gate the merge; maintainer should confirm branch protection requires a review before merging.*
- **G-C5 — PASS** (bounded: diff = exactly the plan; public scope/root-cause comment live at #1769 issuecomment-4780877046)
- **G-C6 — PASS** (no clarifying question warranted — recorded)
- **G-C7 — N/A, correctly** (no migration / no auth-posture change / no breaking wire-contract; the auth-gate issue PLT-243 is correctly deferred, not implemented)
- **G-C8 — PASS** (issue quoted as data; the 409 suggestion critiqued, not absorbed)
- **G-C9 — PASS** (both buckets: unit Mockito + Testcontainers; integration IT-050 re-grounded; user-facing → integration IT present)
- **G-C10 — PASS (docs) / DEFERRED-justified (ontology)** (docs on release/0.29.0 @4dddcb7 + DOC-484; ontology `/enrich` deferred — lineage/** dirty+unowned P-001 residue, same accepted bar as CTRIB-028/029/032; scheduled at the 0.29.0 release substrate scan)
- **G-C11 — PASS** (milestone 0.29.0 open + semver, due 2026-06-27)
- **G-C12 — PASS** (reuse-scan: `existsByTableName` justified, read-guard reused verbatim; ADR-check: no ADR governs, conforms to 2 patterns; impact checklist; PO lens)
- **G-C13 — PASS** (both branches of each guard + collision both ways + controller-forwarding + repo finder + RED proof; unit build green incl. checkstyle; no control lost; regression delta-0)
- **G-C14 — N/A** (public issue, not a GHSA)
- **G-C15 — PASS (CONFIRMED — the key gate for this change).** IT-050 re-grounding (UC-007/UC-010 changed, UC-011 new): (1) new expected values trace to an INDEPENDENT SoT (platform uniqueness convention `ControllerAdvice`+`ErrorCode.UNIQUE_CONSTRAINT=USR003` + the read-guard contract) — verified against source, never the system's output; (2) assertions TIGHTENED (UC-007 added code+message asserts), real API + real Postgres (`physicalColumns`/`catalogRow`, helpers/lookup.ts:166/259) boundaries retained, no `.skip`/mock-swap/matcher-widening; (3) **RED SURVIVES** — my own run on the unfixed base: IT-050 **1 passed / 3 failed** (UC-001 ✓, UC-007/010/011 ✘ at the assertion lines), GREEN on the fix → the tests assert more truth and do not hide the bug. Protocol `.md` updated in sync (PASS + FAIL criteria flipped).
- **G-C16 — PASS** (409→400 reframe critiqued + surfaced at GATE 1, not silently absorbed)
- **Outbound URL sweep:** no new outbound URLs in the change (docs edit added no links; PR/issue/comment URLs in the ledger verified live via the GitHub API).
- **Banned-phrase check:** none used.
- **Regressions:** none attributable to CTRIB-033 (the only e2e fails are the CTRIB-031 unmerged-fix tests, delta-0; known-bugs unchanged).
- **Security follow-up (GATE 2):** PLT-243 (high) VERIFIED — `SecurityConstants.java:337,341` register the column PATCH/DELETE rules on singular `/column/{column_id}` while the live route (and the POST-create rule :333) use plural `/columns/{column_id}` → the gate falls through to authentication-only. The retained reference-data.md caveat is accurate. CTRIB-033 correctly does not touch it (G-C7). Maintainer decides scheduling.
- **Navigation:** `navigation/domains/lookup-tables.md` lists `ReactiveLookupTableRepository` (touched) but NOT `ReferenceDataController`/`ReferenceDataServiceImpl` (the change's core files) — pre-existing minor gap → **NAV-003** (low) logged.
- **lineage/**:** left untouched — my regression's P-001 api-probe re-touched the unowned residue (`feature-flows.yaml` + 2 sidecars + `probe-runs/2026-06-23-P-001.yaml`); per O10/R9 the review committed nothing there and reverted nothing (it is indistinguishable from, and is, the pre-existing unowned residue); the lineage owner / 0.29.0 release scan reconciles.
- **Doc-product editorial audit** (`playbooks/doc-product-editorial-read.md`):
  - **Coverage this run:** the touched MDM subtree end-to-end — `master-data-management.md`, `master-data-management/lookup-tables.md`, `developer-guides/api-reference/reference-data.md`. Full 135-page tree partitioned (covered across today's CTRIB-028/030/031/032 reviews, DOC-478..483; the 0.29.0-train re-audit queued per review-ctrib031-3).
  - **Findings:** none NEW. The reference-data.md change integrates coherently (collision-400 + belongs-to-400 on the endpoint rows; the danger hint correctly layers the verified permission-gate caveat over the now-closed cross-table defect). Pre-existing **DOC-483** (lookup-tables.md "Six behaviours" header vs 5 hint blocks) already logged today by review-ctrib032 — reconcile at the release-train merge; not re-logged.
- **GATE-2 advisory (non-blocking):** rebase `0cc89f79` onto current `origin/main` (`56480919`, now with CTRIB-031 #1801) before merge — the 2 delta-0 feature-complete fails clear once CTRIB-031's FE fix is in the SUT.
- **Notes:** every load-bearing claim VERIFIED via read/grep/own-run (unit build log + JUnit XML; my own e2e regression + RED proof; ControllerAdvice/ErrorCode/SecurityConstants source; the live PR via GitHub API; the release/0.29.0 doc diff). The fix is correct, bounded, regression-clean, and its tests genuinely prove it (RED→GREEN).

