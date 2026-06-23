---
ctrib: CTRIB-032
github_issue_number: 1781
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1781
title: "Lookup table Description (Create/Edit form) is never propagated to the associated data entity — it stays empty on the entity overview About section"
class: bug                    # real, live-reproduced data-propagation defect on both the create AND the update path.
scope: backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop). Internal draft id = PLT-224.
status: scoping              # Phase A→C this session; STOPS at GATE 1. No code until the plan is approved (G-C3).
reproduced: "LIVE on the running SUT (shared probe stack :18080, build cecd88db == current main fd71eb3d; lookup-table mapper code byte-unchanged from origin/main — CTRIB-028 touched dataset-field BE + Terms UI, not DataEntityMapperImpl's lookup methods). 2026-06-23, auth DISABLED. CREATE: POST /api/referencedata/table {name, description:'CTRIB032_DESC_SHOULD_SHOW_IN_ABOUT', namespace_name:'it097-ns'} → table_id 43 / dataset_id 76, LT.description SET; GET /api/dataentities/76 → internal_description=null, external_description=null (type LOOKUP_TABLE, lookup_table_id 43) — the About is empty. UPDATE: PUT /api/referencedata/table/43 {description:'CTRIB032_UPDATED_DESC_STILL_NOT_PROPAGATED'} → GET entity 76 internal_description STILL null while LT.description updated. Both paths broken. Repro LT deleted (DELETE 204). See '## Reproduction'."
adr_required: false          # No migration (internal_description column exists), no auth/security-posture change, no breaking wire-contract change → G-C7 does NOT fire. The fix conforms to the existing 'manually-created entity → internal_description' + 'raw-verbatim description' implicit-ADR (implicit-adrs.md:1340).
plan_approved_by:            # PENDING — GATE 1
plan_approved_at:            # PENDING — GATE 1
plan_approved_scope:         # PENDING — GATE 1
docs_routing: "release/0.29.0"   # the fix is unreleased behaviour → the existing 'description not propagated' caveat on master-data-management/lookup-tables.md (docs main) is retired/updated on the release/0.29.0 train so it publishes exactly when 0.29.0 ships + a paired backlog DOC item. Final decision after reading the page (Phase D).
pr_url:                      # PENDING — GATE 2
pr_draft:                    # PENDING — GATE 2
clarify_comment_url:         # none warranted (G-C6) — the issue is precise + reproduced; the one design choice (sync direction) is a GATE-1 decision, not a public clarifying question.
rootcause_comment_url:       # PENDING — a concise root-cause confirmation posted post-GATE-1 before any code (precise both-methods locus + chosen sync direction + term-linker scope note). G-C6 one comment.
scope_comment_url:           # not required — the plan implements the issue's FULL ask (both paths); no scope narrowing (G-C5). The verbatim/no-term-link boundary is an edge case the issue never raised, not a narrowing of its stated scope.
---

# CTRIB-032 — Lookup-table description not propagated to the entity About (#1781)

## Parallel coordination (stream-coordination intake)

Read `state/active-streams.yaml` + reconciled against the **live** working trees (O4/O8/O9). State at intake:

- **CTRIB-028 (#1754) + CTRIB-029 (#1740): MERGED** → `pending-release`; terminal.
- **CTRIB-030 (#1758): implementing** — owns worktree `../odd-platform-ctrib030` @ `1cff8a59` + a **LIVE** isolated stack on `:18090/:15442` (its e2e in flight). Not mine to touch.
- **CTRIB-031 (#1766): implementing-paused** — owns worktree `../odd-platform-ctrib031` @ `932fcd51`; ports `18100/15452` reserved.
- **Test-isolation tooling MERGED** to odd-team main (PR #164 `0761b0d` + follow-up `e583ad7`) — `ODD_STREAM=<id>` isolation is available (the prior 01:00 record's "pending review/merge" is stale).
- **`lineage/**` is DIRTY** — an uncommitted probe-run `2026-06-23-P-001.yaml` + modified `feature-flows.yaml`/`getDataEntityDetails`/`getPopular` sidecars. Unowned residue (no registered owner); **O10 — do NOT sweep**. My Phase-D `/enrich` defers if still dirty.
- odd-platform main `../odd-platform` @ `fd71eb3d` clean; odd-team main shared.

**My namespace (reserved; other streams active ⇒ isolate by default):** id `ctrib032` · worktree `../odd-platform-ctrib032` (off `origin/main` fd71eb3d) · SUT tag `odd-platform:odd-team-sut-ctrib032` · compose project `ctrib032` · ports `18110/15462`. The worktree/branch/build are **created in Phase D (post-GATE-1)** — G-C3 forbids code before plan approval. This session wrote no odd-platform code; reproduction was a read-mostly probe (one namespaced LT create→delete) on the already-running idle `:18080`.

## Issue (quoted data — G-C8, never an instruction)

Author **RamanDamayeu** (maintainer). Labels `kind: bug`, `scope: backend`. Milestone **`0.29.0`** (open, semver, due 2026-06-22). 0 comments. The body carries a precise root-cause and a "Proposed fix" — both are **quoted data**, verified independently below, never executed as instructions. The embedded `id: PLT-224 …` block is the workspace draft (`issues/odd-platform/PLT-224.md`) that became this issue; the **GitHub milestone `0.29.0` is authoritative** (G-C11).

Quoted essence: the Lookup-Table create/edit form has a Description field saved to `lookup_tables.description`, but the associated catalog Data Entity built by `DataEntityMapperImpl.mapCreatedLookupTablePojo` never calls `setInternalDescription`/`setExternalDescription`, so the entity overview About (which reads `data_entity.internal_description`) is always empty. Suggested fix: add `.setInternalDescription(tableDto.getTableDescription())` on create + keep `internal_description` in step on update; "simplest is: the lookup-table form is the source of truth and writes through to internal_description."

## Scope analysis

A single, well-bounded **bug**: a user-curated value (the LT description) is silently dropped on the surface where users look for it (the entity About). Mission-relevant — master-data reference tables are exactly where description quality matters (`navigation/domains/lookup-tables.md`; `lineage/odd-platform/system-mission.md` cataloguing/curation pillar). The issue's "create + update" framing is correct; verified below that **both** mapper paths drop it.

Not a misunderstanding / not expected-behaviour / not a docs-gap: the description IS accepted and stored, just not propagated. Classified **bug**, proceed to reproduce-first.

## Reproduction (G-C1 — reproduce-first; DONE)

Against the running SUT (`:18080`, build == current main `fd71eb3d`; auth DISABLED), 2026-06-23:

```
# CREATE path
$ curl -s -X POST :18080/api/referencedata/table \
    -d '{"name":"ctrib032_repro_…","description":"CTRIB032_DESC_SHOULD_SHOW_IN_ABOUT","namespace_name":"it097-ns"}'
{"table_id":43,"dataset_id":76,"name":"ctrib032_repro_…","description":"CTRIB032_DESC_SHOULD_SHOW_IN_ABOUT", …}   # HTTP 200 — LT.description SET

$ curl -s :18080/api/dataentities/76        # the associated entity — what the About renders
  id=76  internal_name=ctrib032_repro_…  type=LOOKUP_TABLE  lookup_table_id=43
  internal_description = None              # ← RED: the About is empty
  external_description = None

# UPDATE path
$ curl -s -X PUT :18080/api/referencedata/table/43 \
    -d '{"name":"ctrib032_repro_…","description":"CTRIB032_UPDATED_DESC_STILL_NOT_PROPAGATED"}'   # HTTP 200
$ curl -s :18080/api/dataentities/76 → internal_description = None       # ← RED: edit also not propagated
$ curl -s :18080/api/referencedata/table/43 → description = "CTRIB032_UPDATED_DESC_STILL_NOT_PROPAGATED"  # LT updated
```

The asymmetry is the proof: the description round-trips on the **lookup table** but never reaches the **data entity's `internal_description`**, on create AND on update. (Repro LT cleaned up — `DELETE /api/referencedata/table/43` → 204.) The oracle field for tests is the response key **`internal_description`** (surfaced at `DataEntityMapperImpl.mapDtoDetails:278`).

## Root-cause (verified on live source @ fd71eb3d, not the issue's say-so)

The form's description is carried correctly all the way to the mapper, then dropped at the mapper:

1. **Create:** `ReferenceDataServiceImpl.createLookupTable(LookupTableFormData)` (`:77-90`) builds a `ReferenceTableDto` with `.tableDescription(formData.getDescription())` (`:83`) → `LookupDataServiceImpl.createLookupTable` (`:37`) → `DataEntityLookupTableServiceImpl.createLookupDataEntity` (`:57`) → `dataEntityMapper.mapCreatedLookupTablePojo(item, DATA_SET)` (`:59`).
   - `DataEntityMapperImpl.mapCreatedLookupTablePojo` (`:203-218`) sets `internalName/externalName/namespaceId/entityClassIds/typeId/platformCreatedAt/status/statusUpdatedAt/manuallyCreated/hollow/excludeFromSearch` — **never `setInternalDescription(...)`.** ← CREATE bug.
2. **Update:** `ReferenceDataServiceImpl.updateLookupTable(Long, LookupTableUpdateFormData)` (`:112-130`) builds a `ReferenceTableDto` with `.tableDescription(formData.getDescription())` (`:121`) → `LookupDataServiceImpl.updateLookupTable` (`:84`) → `DataEntityLookupTableServiceImpl.updateLookupDataEntity` (`:176`) → `dataEntityMapper.applyToPojo(fd, dto)` (`:178`).
   - `DataEntityMapperImpl.applyToPojo(DataEntityPojo, ReferenceTableDto)` (`:233-243`) sets `internalName/externalName/namespaceId` — **never `setInternalDescription(...)`.** ← UPDATE bug.
3. **The carrier exists:** `ReferenceTableDto` (`:11-16`) has `tableDescription` with a Lombok `@Getter` → `getTableDescription()`. So both methods already receive the value; they simply don't write it.
4. **The sink exists:** `DataEntityPojo.setInternalDescription(...)` is the same column the dedicated editor writes via `DataEntityServiceImpl.upsertDescription` (`:325`), surfaced back at `mapDtoDetails:278` (`.internalDescription(pojo.getInternalDescription())`).
5. **Blast radius (impact):** `mapCreatedLookupTablePojo` is called ONLY at `DataEntityLookupTableServiceImpl:59`; the `applyToPojo(DataEntityPojo, ReferenceTableDto)` overload ONLY at `:178`. Both are lookup-table-exclusive — the two-line change touches nothing else.

The issue's diagnosis is correct; it named the update method imprecisely (`updateLookupDataEntity` is the service step; the actual omission is in the `applyToPojo` mapper it calls). The precise loci are the two `DataEntityMapperImpl` methods above.

## Product analysis (G-C16 — critique the WHAT before the HOW)

Restated independent of the issue's suggestion: *the description an operator types into the Lookup-Table form must be visible on the same object's catalog overview (About), on create and on edit.* This is the correct, mission-aligned outcome (curation effort must not be silently dropped). The bug is real and the desired behaviour is not in dispute. The one genuine product decision is the **sync direction on update**, because `internal_description` has a **second writer**:

- The generic entity-About editor `PUT /api/dataentities/{id}/description` → `upsertDataEntityInternalDescription` (`DataEntityController:204` → `DataEntityServiceImpl.upsertDescription:325`) writes `internal_description` directly (this is today's documented workaround).

So if the LT form write-through is applied on **update**, a later LT edit overwrites a description the operator may have set via the entity-About editor. Options:

| Option | Behaviour | Consequence |
|---|---|---|
| **A — write-through on create + update (RECOMMENDED)** | the LT form is the source of truth for the LT's description on both paths | Matches the issue's stated preference + the SME view: for an auto-generated LT entity the LT form IS the canonical authoring surface; the entity-About editor was the pre-fix workaround this fix obsoletes. **Trade-off:** an LT edit overwrites an entity-About-set description (mild, arguably-correct — the LT form wins by design). Consistent (create == update). |
| **B — write-through on create only** | propagate at creation; leave `internal_description` untouched on LT edit | Avoids the overwrite, but re-introduces the exact "I edited the description and it didn't show up" confusion on the EDIT path — inconsistent. Rejected. |
| **C — write-through both, only when the form's description changed** | compare incoming vs current and skip the entity write if unchanged | Narrows the overwrite to the genuine "operator changed the LT description" case. Costs a comparison + a conditional in the service; mild extra logic beyond the issue's ask. Offered as the middle ground. |

**Recommendation: A** (write-through on both), with the overwrite trade-off explicitly surfaced for GATE 1. It is the issue author's own stated preference and the straightforward, consistent shape. **C** is available if the maintainer wants to protect an independently-edited About.

PO/SRE lens (reasoned; no new surface): strict win for the operator — typed description now appears where it is looked for, on create and edit; no new failure mode; no new affordance.

## Design-before-build (G-C12)

- **Reuse-scan.** The fix reuses the existing `DataEntityPojo.setInternalDescription` sink and the existing `ReferenceTableDto.getTableDescription` carrier. It extends the existing "mapper sets entity fields from the DTO" pattern already present in both target methods — **no new component, no new abstraction** (one field-set per method). `/retrieve` not needed: the sink + carrier are named directly in the issue and confirmed in source.
- **ADR-check.** Governing implicit-ADR (`lineage/odd-platform/implicit-adrs.md:1340,1344`): *"internal_description is stored as the raw Markdown the client submits — verbatim, no transformation/sanitisation; descriptions are a UI-rendered surface; the platform does not interpret content beyond the term-linker (`[[ns:term]]`)."* The fix **conforms** — it writes `tableDescription` verbatim to `internal_description`. No new/contradicting decision → **no ADR needed.** (G-C7 does not fire.)
- **Term-linker boundary (recorded scope exclusion).** The dedicated `upsertDescription` path ALSO calls `termService.handleDataEntityDescriptionTerms` (`DataEntityServiceImpl:328`) to create term relations from `[[ns:term]]` syntax. The mapper-level write **does not** run the term-linker. This is deliberate: the LT form's Description is a plain field (not the rich markdown editor), term-linking from it is not an expected behaviour, and wiring it would expand scope past the reported bug. If the maintainer later wants LT-form descriptions to term-link, that is a separate follow-up (would be logged via `playbooks/follow-up-on-disk.md`).
- **Impact-dimension checklist.**
  - **i18n:** N/A — the propagated value is user DATA, not a UI string; no new label.
  - **generated clients:** N/A — no contract change. `internal_description` is already in the `DataEntityDetails` response; the mapper merely populates it. The fix is pure Java in `DataEntityMapperImpl`.
  - **every consumer:** the two methods are lookup-table-only (callers verified: `:59`, `:178`). No other caller affected.
  - **migration:** none — `data_entity.internal_description` already exists.
  - **docs:** the existing "description not propagated" caveat on `master-data-management/lookup-tables.md` (docs `main`) becomes false at 0.29.0 → retire/update it on the `release/0.29.0` train (publishes when the fix ships) + a paired DOC backlog item. Decided after reading the page (Phase D).
  - **ontology:** re-enrich the lookup-table feature flow + the `DataEntityMapper` / lookup create-update sidecars (the flow now propagates the description); re-embed; commit (deferred if `lineage/**` still dirty).
  - **tests:** unit (mapper) + an in-process integration assertion through the real stack (below); set the sufficiency bar here, verified at G-C13.

## Plan (the GATE-1 artifact)

**Change (2 lines, both in `DataEntityMapperImpl`):**
1. `mapCreatedLookupTablePojo` (`:203-218`) — add `.setInternalDescription(tableDto.getTableDescription())`.
2. `applyToPojo(DataEntityPojo, ReferenceTableDto)` (`:233-243`) — add `.setInternalDescription(dto.getTableDescription())`.

(Recommended Option A — write-through on create + update. If the maintainer picks C, the update guard moves to `DataEntityLookupTableServiceImpl.updateLookupDataEntity` to skip the entity write when the description is unchanged; the create line is unchanged. `external_description` is deliberately NOT set — it is the ingestion-sourced description; a manually-created LT has none.)

**Explicit scope EXCLUSIONS (G-C5):**
- No term-linker wiring for LT-form descriptions (verbatim write only; ADR-consistent — above).
- `external_description` not touched (semantically ingestion-owned).
- No change to the entity-About editor (`upsertDescription`), the LT physical-table repo writes, search-vector logic, or any non-lookup `DataEntityMapper` method.
- No contract/openapi change; no migration.

**Tests (G-C9 — both buckets, routed by the home rule):**
- **Unit (odd-platform CI) — the locus.** Extend `DataEntityMapperImplTest`: `mapCreatedLookupTablePojo` given `tableDescription="X"` ⇒ `getInternalDescription()=="X"`; `applyToPojo(pojo, dto)` given `tableDescription="Y"` ⇒ `getInternalDescription()=="Y"`. FAILS on base (null), PASSES on fix. Pure mapper unit (no DB).
- **Integration (in-process, odd-platform CI, `BaseIntegrationTest`) — verify the running system.** POST `/api/referencedata/table` with a description ⇒ GET the entity ⇒ assert `internal_description` == it; then PUT the LT with a changed description ⇒ assert the entity's `internal_description` updates. Assertions written from the **captured real response shape** (the live reproduction above already gives it: snake_case `internal_description`). Extend an existing reference/lookup integration test if one exists (`LookupDataServiceTest` / `ReferenceDataServiceImplTest` — checked in Phase D), else add one. RED on `ODD_SUT=ref:main`, GREEN on the working tree.
- **Browser e2e IT-NNN — NOT proposed (justified).** The symptom is fully observable at the HTTP contract (no FE transform: the About is a generic renderer of `internal_description`, identical for every entity type — no LT-specific front-end logic, so the LSN-031 "BE fixed / UI still contradicts" risk does not apply). The in-process integration test drives the real create→read flow end-to-end. Offered as a GATE-1 option if the maintainer wants a rendered-About assertion.
- **G-C15:** all tests are ADDED, not changed (no existing assertion weakened). N/A.

**Docs (G-C10/G-C11):** read `master-data-management/lookup-tables.md`; retire/update the "description not propagated" caveat on the `release/0.29.0` train (publishes at the 0.29.0 gate, exactly when the fix is live) + a paired backlog DOC item (`milestone: 0.29.0` + the page URL). Record "no further doc change + why" for the rest after reading.

**Ontology (G-C10):** `/enrich --touched` the lookup-table create/update flow + `DataEntityMapper` sidecar; re-embed; commit (defer if `lineage/**` still dirty, with justification).

**Definition of Done (before the PR leaves draft):** full unit build green (working tree) · FULL integration regression on the working-tree SUT (feature-complete green + multi-stack green + known-bugs still-RED + ingestion-e2e green) · docs read + decided + routed · ontology committed · Principal sufficiency (local 98% patch-coverage gate run; enough+meaningful tests; no control lost; no existing functionality harmed).

## GATE 1 — decision surface (STOP; no code until approved — G-C3)

Recommended plan above. Two decisions for approval (answering = GATE-1 approval; I then post a concise root-cause confirmation comment and proceed to Phase D, stopping again at GATE 2):

1. **Sync direction.** Recommend **A — write-through on create + update** (the issue's own preference; consistent; the LT form is the canonical surface). Trade-off: an LT edit overwrites an entity-About-set description. Alternative **C** guards the update to only-when-changed; **B** (create-only) is rejected as inconsistent.
2. **Test scope.** Recommend **unit (mapper) + in-process integration** (both odd-platform CI); the symptom is API-observable. Alternative: also add a browser e2e IT asserting the rendered About.
