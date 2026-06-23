---
ctrib: CTRIB-032
github_issue_number: 1781
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1781
title: "Lookup table Description (Create/Edit form) is never propagated to the associated data entity — it stays empty on the entity overview About section"
class: bug                    # real, live-reproduced data-propagation defect on both the create AND the update path.
scope: backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop). Internal draft id = PLT-224.
status: review-ready         # /review ACCEPTED 2026-06-23 (session review-ctrib032). pr-draft → review-ready. Human GATE-2 (approve+merge PR #1802) → pending-release; 0.29.0 release-review owns done (doc live-site DOC-480 + ontology /enrich + DOC-483 caveat-count reconciliation all scheduled there).
reproduced: "LIVE on the running SUT (shared probe stack :18080, build cecd88db == current main fd71eb3d; lookup-table mapper code byte-unchanged from origin/main — CTRIB-028 touched dataset-field BE + Terms UI, not DataEntityMapperImpl's lookup methods). 2026-06-23, auth DISABLED. CREATE: POST /api/referencedata/table {name, description:'CTRIB032_DESC_SHOULD_SHOW_IN_ABOUT', namespace_name:'it097-ns'} → table_id 43 / dataset_id 76, LT.description SET; GET /api/dataentities/76 → internal_description=null, external_description=null (type LOOKUP_TABLE, lookup_table_id 43) — the About is empty. UPDATE: PUT /api/referencedata/table/43 {description:'CTRIB032_UPDATED_DESC_STILL_NOT_PROPAGATED'} → GET entity 76 internal_description STILL null while LT.description updated. Both paths broken. Repro LT deleted (DELETE 204). See '## Reproduction'."
adr_required: false          # No migration (internal_description column exists), no auth/security-posture change, no breaking wire-contract change → G-C7 does NOT fire. The fix conforms to the existing 'manually-created entity → internal_description' + 'raw-verbatim description' implicit-ADR (implicit-adrs.md:1340).
plan_approved_by: RamanDamayeu
plan_approved_at: "2026-06-23"
plan_approved_scope: "Propagate lookup_tables.description → Data Entity external_description on create (DataEntityMapperImpl.mapCreatedLookupTablePojo) + update (applyToPojo). LT form UNCHANGED (backward-compatible — keeps its Description field); internal_description untouched (no clobber); the overview already renders external_description (OverviewDescription.tsx:25). Tests: unit (DataEntityMapperImplTest) + in-process integration + a browser e2e IT. Deprecation signal = docs note + tracked follow-up (NO global UI banner — ExternalDescription is a global component). Docs on the release/0.29.0 train. Approved via AskUserQuestion rounds 1-3, 2026-06-23."
docs_routing: "release/0.29.0"   # the fix is unreleased behaviour → the existing 'description not propagated' caveat on master-data-management/lookup-tables.md (docs main) is retired/updated on the release/0.29.0 train so it publishes exactly when 0.29.0 ships + a paired backlog DOC item. Final decision after reading the page (Phase D).
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1802"   # DRAFT PR (odd-contributor[bot]), Closes #1781, base main, head contrib/CTRIB-032-lookuptable-description-propagation @ ff7d58a7
pr_draft: true               # draft → the bot cannot self-approve/merge (G-C4); a human maintainer approves + merges
clarify_comment_url:         # none warranted (G-C6) — the issue is precise + reproduced; the one design choice (sync direction) is a GATE-1 decision, not a public clarifying question.
rootcause_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1781#issuecomment-4777553889"   # folded root-cause + reframing (G-C6 one comment), posted post-GATE-1 before any code as odd-contributor[bot] (HTTP 201)
scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1781#issuecomment-4777553889"        # same comment — it reframes the issue's proposed write-through-to-internal into the external_description approach (G-C5)
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

---

## GATE 1 — maintainer response + RE-PLAN (round 2, 2026-06-23)

The maintainer **rejected the issue's own write-through fix** — the textbook G-C16 case (the bug is real; the issue's *solution* is product-wrong). Decision (verbatim): *"I don't want we have duplicates in data input — if it's easier to just remove possibility to add description of LT in the lookup table create/edit — it's fine — let's leave only one way how to edit description of a lookup table — via Data Entity overview. There should be possibility to use live links to terms."* Plus: Test scope = **also add a browser e2e IT**; Issue comment = **post a concise confirmation**.

**Adopted product direction:** ONE editing surface for an LT's description — the **Data Entity overview "About"** editor (`upsertDescription`) — and **remove** the Description input from the Lookup-Table create/edit form. This is *better* than write-through: it removes the duplicate data-input surface AND **gains term-linking** — the About editor runs `termService.handleDataEntityDescriptionTerms` unconditionally (`DataEntityServiceImpl:328`, entity-type-agnostic, so LT entities term-link), whereas the LT form's Markdown field wrote `lookup_tables.description` and never term-linked. The original 2-line mapper write-through plan above is **superseded** (kept for the audit trail).

### Re-scoped change (design-before-build, round 2)

- **FE (the core change, all variants):**
  - `LookupTableForm.tsx` — remove the `description` Markdown-editor `Controller` (`:94-116`) + its default (`:43`). The form keeps name + namespace.
  - `LookupTables/LookupTablesListItem.tsx` — remove the `item.description` cell (`:36`).
  - `LookupTables/LookupTablesList.tsx` — remove the "Description" header cell (`:51-53`) + redistribute the column `$flex` widths.
  - **Reuse, not new:** the single editor already exists (the entity-About `Markdown` description editor + `upsertDescription`); we delete a duplicate, we build nothing. i18n: the `Description`/`lookup table` keys are shared (entity About etc.) — **not** removed, just unreferenced here; no locale churn.
- **Existing-data + contract = the two G-C7-class decisions (below).** Removing the form field orphans any existing `lookup_tables.description` from the UI unless it is **backfilled** into the entity `internal_description` (a one-time Liquibase migration). Optionally the now-unused `description` is stripped from the contract (`LookupTableFormData`/`LookupTableUpdateFormData`/`LookupTable` in `components.yaml:3893/3906/3967`) + BE plumbing (`LookupTableMapper:44/52/62`, `ReferenceTableDto.tableDescription`, `ReferenceDataServiceImpl:83/121`) + regenerate. The `lookup_tables.description` **column is NOT dropped** (a destructive migration; left vestigial).
- **G-C7:** a data-backfill migration and/or a wire-contract change ALWAYS need explicit sign-off before code → the single re-GATE-1 question below.

### Tests (round 2)
- **FE unit (vitest, odd-platform-ui):** `LookupTableForm` no longer renders/sends a description field; submit payload omits it. (Worktree FE-dev-env setup — `npm ci` + codegen — is a Phase-D logistics item; cf. CTRIB-031's FE-env note.)
- **Browser e2e IT-NNN (maintainer-requested, odd-team `integration-tests/`):** create an LT → the LT form has **no** Description field; open the LT entity overview → set the About description **with a `[[ns:term]]` live link** → assert it renders on the About *and* the term link resolves. Check `integration-tests/protocols/` for an existing lookup-table / data-entity-About IT to extend first. RED on `ODD_SUT=ref:main` (form still has the field), GREEN on the working tree.
- **BE (full-removal variant only):** update `ReferenceDataServiceImplTest`/`LookupDataServiceTest`/`DataEntityMapperImplTest` references to the removed `description`/`tableDescription`. (FE-only variant: BE tests unchanged.)
- **Backfill (if approved):** a migration test / a before-after data assertion that an existing LT description lands in the entity `internal_description`.
- Full regression (G-C2) on the working-tree SUT regardless.

### Docs (round 2, G-C10/G-C11)
The existing caveat on `master-data-management/lookup-tables.md` (docs `main`) said "description not propagated; use the entity-About workaround." After this change the *workaround becomes the official single way* — update the page (on the `release/0.29.0` train) to: drop the bug caveat; document that an LT's description is authored on the **Data Entity overview About** (with term-link support), not on the create/edit form. Paired backlog DOC item (`milestone: 0.29.0` + URL).

### Issue comment (round 2 — approved by the maintainer; posted post-GATE-1, before code)
Concise root-cause + **reframing** confirmation (mandatory now per G-C5 — the plan reframes the issue's stated fix): bug confirmed (description never reached the entity); rather than duplicate the description across two inputs, the PR removes the LT-form Description field so the **Data Entity overview About** is the single editor (which also supports `[[term]]` live links); existing descriptions are [backfilled per the decision]. Closes #1781.

### The one remaining decision (re-GATE-1)
Removal depth × existing-data handling — both G-C7-class (migration / contract). Recommended: **FE-only removal + backfill existing descriptions** (smallest code change, no breaking contract change, preserves curation; strip the dead contract field later as a logged REFACTOR follow-up).

---

## GATE 1 — maintainer refinement + FINAL plan (round 3, 2026-06-23)

The maintainer refined again to an **elegant, backward-compatible model** (verbatim): *"leave the description of lookups as well to not have issues with backward incompatibility. But we will treat lookup table description as an **external description** for Data Entity… we use ODD Platform to store real data in a form of lookup and we 'auto' ingest these entities into the catalog as Data Entities, from that point of view once we change description of lookup table we see it in Data Entity as an external description… Data Entity will have 2 descriptions: as Data Entity (internal for catalog) and as Lookup (external for catalog). We could put a deprecation warning for the external description with the notification that only internal description will be left in future releases."*

**Both prior approaches are SUPERSEDED** (kept for audit): the issue's write-through-to-internal (round 0/1 — clobbers the About) and the remove-the-field (round 2 — backward-incompatible + needs a migration). **Final model:** the lookup table is a *source* auto-ingested into the catalog, so its description is the **source-provided** description → the Data Entity's **`external_description`** (the exact semantic of that field). `internal_description` stays the catalog user's manual description (the About editor, with term links). Two descriptions coexist — a normal ODD pattern for ingested entities.

### KEY load-bearing finding (verified in FE) — the fix is small + safe
The entity overview **already renders `external_description`**: `OverviewDescription.tsx:25` renders `<ExternalDescription />` directly below `<InternalDescription />`; `ExternalDescription.tsx:11-17` reads `getDataEntityExternalDescription(dataEntityId)` and shows it as read-only Markdown **when non-empty** (else renders nothing). The details API already returns it (`mapDtoDetails:279` → `.externalDescription`). **So propagating the LT description to `external_description` surfaces it on the overview with NO new FE display work.** (The empty-state `null` return is why nothing shows today — `external_description` is null for manually-created LTs.)

### Final change (the genuinely small, backward-compatible fix)
**BE — 2 lines in `DataEntityMapperImpl`, targeting `external_description` (not internal):**
1. `mapCreatedLookupTablePojo` (`:203-218`, create) — add `.setExternalDescription(tableDto.getTableDescription())`.
2. `applyToPojo(DataEntityPojo, ReferenceTableDto)` (`:233-243`, update) — add `.setExternalDescription(dto.getTableDescription())`.

**Why this is correct + safe:**
- The LT form is **unchanged** (keeps its Description field → `lookup_tables.description`); editing it updates the LT (as today) AND now the entity's `external_description` (synced) — exactly "we see this change in associated Lookup table instantly." Backward-compatible: no contract change, no FE removal, no migration.
- **No clobber** (the round-0 problem): `external_description` ≠ `internal_description`. The About editor (internal, term-linkable) is independent; a catalog curator's manual description is never overwritten by an LT edit.
- **Term-link requirement satisfied** by the unchanged internal/About editor (`upsertDescription` → `handleDataEntityDescriptionTerms`, type-agnostic, `DataEntityServiceImpl:328`). The external (LT) description renders read-only on the overview.
- `external_description` for a manually-created LT has no other writer (ingestion never touches manual LTs) → the LT description fully owns it; no conflict.

**Scope EXCLUSIONS (G-C5):** no LT-form change; no contract/openapi change; no migration; `internal_description` untouched; no change to non-LT mapper paths or the global `ExternalDescription` component's behaviour.

### Tests (final)
- **Unit (odd-platform CI):** `DataEntityMapperImplTest` — both methods set `external_description` from `tableDescription`. RED→GREEN.
- **Integration (in-process `BaseIntegrationTest`, odd-platform CI):** POST/PUT `/referencedata/table` with a description → GET entity → assert `external_description` == it AND `internal_description` stays independent. From the captured real shape (snake_case `external_description`).
- **Browser e2e IT (maintainer-requested):** create an LT with a description → entity overview shows it (as the external description, read-only); set the About (internal) description with a `[[ns:term]]` link → it renders as a live link. Extend an existing data-entity-overview IT if present.
- Full regression (G-C2) on the working-tree SUT.

### Docs (final, release/0.29.0)
Rewrite the `master-data-management/lookup-tables.md` caveat: the LT description now appears on the entity overview **as the external description**; the editable catalog description is the entity-About (internal); note the future consolidation. Paired DOC item.

### The one open item (deprecation signal scope)
"A deprecation warning for the external description, future = internal-only." The overview `ExternalDescription` component is **global** (every ingested entity) — a UI banner there is a platform-wide statement, almost certainly out of scope for this fix. Options below; the core fix (BE propagation) is locked either way.

**GATE-1 FINAL decision (2026-06-23, RamanDamayeu):** Removal shape question superseded by the external-description model; deprecation signal = **docs note + tracked follow-up** (no global UI banner). Test scope = unit + browser e2e. Comment = posted. → proceed to Phase D.

---

## Implementation (Phase D)

### The fix — committed `contrib/CTRIB-032-lookuptable-description-propagation` @ **ff7d58a7**
Two lines in `DataEntityMapperImpl` (`*MapperImpl*` — jacoco-excluded by repo config):
- `mapCreatedLookupTablePojo` (`:211`): `.setExternalDescription(tableDto.getTableDescription())`.
- `applyToPojo(DataEntityPojo, ReferenceTableDto)` (`:247`): `.setExternalDescription(dto.getTableDescription())`.
LT form + contract + DB schema unchanged (backward-compatible); `internal_description` untouched (no clobber); push-safe (no upstream, `push.default=current`).

### Test ledger (G-C9 / G-C15)
- **Unit (odd-platform CI) — DataEntityMapperImplTest, ADDED 2 tests (G-C15 N/A — no test changed):**
  - `mapCreatedLookupTablePojo_setsExternalDescriptionFromTableDescription` + `applyToPojo_referenceTable_updatesExternalDescriptionAndKeepsInternalDescription` (the second also asserts `internal_description` is NOT clobbered).
  - **RED→GREEN, RUN not reasoned:** base worktree → `14 tests completed, 2 failed` (`expected "ISO 3166…" but was null`); with the fix → JUnit XML `tests=14 failures=0 errors=0`, both new tests present + passing (11:19). checkstyle clean both runs.
- **Integration (odd-team IT-140 — browser e2e, maintainer-requested):** `integration-tests/protocols/IT-140-lookup-description-on-overview.md` + `e2e/specs/lookup-description-on-overview.spec.ts` (drives the REAL create/update API → asserts the description renders on the entity Overview as the external description; + an edit-updates case + a no-description negative).
  - **GREEN — RUN, not reasoned (2026-06-23, flock-serialized stream ctrib032):** on the working-tree SUT (built from `ff7d58a7`, digest `52d3f79d`) IT-140 = **3/3 PASS** (create renders · edit updates · no-description negative). Run-log `integration-tests/run-log/2026-06-23-IT-140.md`.
  - **RED proof (`ODD_SUT=main` @ fd71eb3d) — confirmed:** IT-140 = create ✘ + edit ✘ (RED — `external_description` null on base → not rendered) + no-description negative ✓. The e2e genuinely catches #1781 (RED on base, GREEN on the fix) — not a tautology (CTRIB-023/G-C15 discipline).

### Definition of Done — status
1. **Full unit build (working tree) — ✅ GREEN.** `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build` = test + checkstyle + assemble + ALL Testcontainers integration tests) → `BUILD SUCCESSFUL in 7m 18s`, 0 failures (the log "FAILED" hits are `io.r2dbc PARAM` test-data binds, not test results).
2. **FULL integration regression (working-tree SUT @ ff7d58a7, digest 52d3f79d) — ✅ GREEN (no regression from this change).** Ran flock-serialized via `run-regression.sh ctrib032` (isolated tag `odd-team-sut-ctrib032`, ports 18110/15462), read as actual pass/fail (not exit codes):
   - **IT-140** (the fix) — **e2e:PASS 3/3.**
   - **multi-stack** — **e2e:PASS.**  ·  **ingestion-e2e** — **e2e:PASS (6/6).**
   - **known-bugs** — **e2e:FAIL = EXPECTED RED** (3 failed: IT-007 attachment-durability/LSN-001, IT-006 error-boundary, IT-004 quality-dashboard-unknown-status). All pre-existing known-bug pins; **none related to this change → no unexpected GREEN** (no known bug was accidentally fixed).
   - **feature-complete** — **308 passed, 3 failed; the 3 are NOT this change.** They assert OTHER streams' UNMERGED fixes, absent from this branch (off `origin/main` fd71eb3d): `confirmation-dialog-thunk-arm.spec.ts:32,91` (CTRIB-031 / #1766 PLT-233+234) and `lineage-depth-boundary.spec.ts:38` (CTRIB-030 / #1758). **Proof of zero delta:** `git diff origin/main..HEAD --name-only` = only `DataEntityMapperImpl.java` + `DataEntityMapperImplTest.java` (touches neither failing spec nor any lineage/confirmation-dialog code); + the empirical `ODD_SUT=main` @ fd71eb3d baseline run reproduced the SAME 3 feature-complete failures (confirmed — delta = 0). The change introduces zero new feature-complete failures.
3. **Docs read + decided + routed + ON THE TRAIN — ✅.** `master-data-management/lookup-tables.md` caveat rewritten (warning→info: LT description = entity external description; internal stays catalog-curated + term-linkable; future-consolidation note). **Verified on `origin/release/0.29.0` @ `9e35fcb`** (pushed — `Everything up-to-date`; the info-note is present on origin; carried with the train alongside CTRIB-029 `a7b19a8` + CTRIB-030 `71f3e53`). Publishes at the 0.29.0 release gate. Paired `backlog/docs/DOC-480.md` (pending-release).
4. **Ontology — ⏳ PENDING.** `/enrich --touched` the lookup create/update flow + `DataEntityMapper` sidecar. **Deferred (G-C10 justified):** `lineage/**` is DIRTY+unowned (the P-001 probe residue) — no `/enrich` into a dirty tree (R9/O10). Runs once `lineage/**` is clean+unclaimed.
5. **Principal sufficiency (G-C13) — ✅.** Enough+meaningful tests (create + update + no-clobber unit; e2e for the user-facing path, 3/3 GREEN). Patch coverage: the changed file is `*MapperImpl*` → **jacoco-excluded by repo config** (build.gradle:185), so the CI changed-files gate does not measure it (consistent with prior merged `*MapperImpl*` changes, e.g. #1755); the changed lines are nonetheless exercised by the two passing unit tests. No control lost (2 additive lines, no signature/abstraction change). **"What did I make worse" — nothing:** the full regression on the fix SUT is green with zero delta vs baseline (the only non-passes are pre-existing known-bug pins + other streams' unmerged-fix tests, neither touched by this change — see gate 2).

### Follow-ups logged on disk
- `backlog/docs/DOC-480.md` — the release-train doc change (pending-release, 0.29.0).
- `issues/odd-platform/PLT-240.md` — the future single-description consolidation direction (the deprecation-signal follow-up).
- `issues/odd-platform/PLT-224.md` — backfilled to #1781 (the draft that became this issue).

---

## Review (2026-06-23, session: review-ctrib032)

- **Result: ACCEPTED** → `pr-draft` → `review-ready`. The human GATE-2 (approve + merge DRAFT PR #1802) owns `done`; on merge the item becomes `pending-release` and the **0.29.0 release-review** (`playbooks/release-review.md`) owns the final flip after the doc live-site (DOC-480) **and** the ontology refresh land at the release gate.
- Separate session (implement = the `ctrib032` contributor stream; this = `review-ctrib032`). Read-only on all target repos; ran **NO** `/enrich` / probe → `lineage/**` left exactly as found (the unowned P-001 residue untouched, O10). No heavy suite re-run — see **Regression**.
- **Reviewed SHA:** odd-platform `contrib/CTRIB-032-lookuptable-description-propagation` @ **`ff7d58a7`** (worktree `../odd-platform-ctrib032`); docs `release/0.29.0` @ **`9e35fcb`**.

### Cheap precondition (the 2-minute bounce) — NOT triggered
The only deferred DoD gate is the ontology `/enrich` (gate 4) — a **G-C10-justified** deferral (lineage dirty+unowned), NOT the FULL-regression gate. The FULL regression **was** run at the reviewed commit: every e2e bucket carries a run-log at SUT digest **`52d3f79d`** (== the `ff7d58a7` build). So the regression is here to be *confirmed*, not first-run → full review proceeds. (Contrast CTRIB-030, correctly bounced: it had no coherent single-SUT full-green run.)

### Acceptance criteria — contributor 1–17, all PASS
- [x] 1 Code-after-plan-approval — PASS: GATE-1 approved by RamanDamayeu over 3 AskUserQuestion rounds; worktree/branch created post-approval (`active-streams` ctrib032). `git log` author/dates consistent.
- [x] 2 Reproduction logged — PASS: live create+update RED on `:18080` (== main `fd71eb3d`), both paths `external_description=null` (item `## Reproduction`).
- [x] 3 Diff bounded by plan — PASS: `git diff origin/main..HEAD --name-only` = exactly `DataEntityMapperImpl.java` + `DataEntityMapperImplTest.java`. Zero scope creep.
- [x] 4 Unit injects the failing condition — PASS: both added tests assert `external_description == tableDescription`; RED on base (`expected … but was null`, 2 failed), GREEN on fix.
- [x] 5 Pins re-grounded — N/A: no `@pins`; all tests ADDED.
- [x] 6 Docs decision stated + routed — PASS: page **read**; the warning caveat → info note on `release/0.29.0` @ `9e35fcb` (verified `git show`); DOC-480 (pending-release).
- [~] 7 Ontology committed — **DEFERRED (scheduled, not dropped)** — see G-C10 below. Consistent with CTRIB-028/029's accepted bar.
- [x] 8 Ends review-ready, never self-done — PASS (this flip).
- [x] 9 Architectural change carries an ADR first — N/A: `adr_required:false` correct (no migration, no auth/posture, no contract change).
- [x] 10 Prompt injection discarded — N/A: no injection in #1781.
- [x] 11 Definition of Done met before draft-exit — PASS for code/test/docs; ontology deferred-scheduled (G-C10). PR is still `draft`; the refresh lands at the release scan before `done`.
- [x] 12 Milestone gate — PASS: `0.29.0` open + semver (verified live on #1781).
- [x] 13 Design before build — PASS: reuse-scan (existing `setExternalDescription` sink + `getTableDescription` carrier), ADR-check (conforms to `implicit-adrs.md:1340` verbatim-description), full impact checklist, PO/SRE lens — all in the plan.
- [x] 14 Principal sufficiency — PASS: create+update+no-clobber unit + a real-flow e2e; `*MapperImpl*` is jacoco-excluded by repo config (consistent w/ prior merged `*MapperImpl*` PRs); no control lost (2 additive lines).
- [x] 15 Private-advisory disclosure — N/A: public issue.
- [x] 16 Test-change integrity — N/A: all tests ADDED; the diff weakens no existing assertion.
- [x] 17 Change-request product analysis — PASS (exemplary): the issue's bug is real but its write-through-to-internal fix was product-wrong; reframed to `external_description` across 3 GATE-1 rounds, reframe comment public.

### Quality Bar
- **Gate 1 — PASS** (no duplicates): reuses the existing sink + carrier; IT-140 protocol checks for an existing lookup-About IT before authoring (`integration-tests/protocols/IT-140-*.md` §Cross-references). via read of the diff + protocol.
- **Gate 2 — N/A**: external/internal description are existing ODD concepts; no new alias introduced. via read of `lookup-tables.md`.
- **Gate 3 — PASS**: the deliberate two-description trade-off + future-consolidation is captured in the docs info-note; the no-clobber invariant in the unit test. via `git show 9e35fcb` + the unit diff.
- **Gate 4 — PASS** (consumer-read footer verified): the commit `Consumer-read:` footer cites `ReferenceTableDto`, `ReferenceDataServiceImpl:83,121`, `DataEntityLookupTableServiceImpl:59,178`, `DataEntityMapperImpl:279`, `DataEntityServiceImpl:325`, the UI Overview pair — each matches the data-flow trace; the change is a pure mapper write (no `@Value` consumer in scope). via `git log --format=full` + diff.
- **Gate 5 — N/A**: no SDK builder in scope. via diff.
- **Gate 6 — PASS** (bidirectional): the new code path (LT description → `external_description` → overview render) is documented (info-note + DOC-480); the user-visible behavior change has doc coverage. via cross-read code↔doc.
- **Gate 7 — PASS / N/A**: existing-page edit; no SUMMARY/IA change needed (SUMMARY `master-data-management/lookup-tables.md` unchanged). via `grep SUMMARY.md`.
- **Gate 8 — PENDING-RELEASE (0.29.0)**: branch-verifiable sub-checks pass — the change is on `origin/release/0.29.0` @ `9e35fcb`, valid GitBook hint syntax, no banned workspace term on the published lines, no new links. Live-site verification scheduled at the 0.29.0 release gate; URL recorded in DOC-480 (`https://docs.opendatadiscovery.org/master-data-management/lookup-tables`). via `git show` + Gate-11 grep.
- **Gate 9 — PASS** (provenance): legacy `Consumer-read:` footer present (factual item, footer required — satisfied); every code claim traced to source; docs claims trace to the fix. via diff + root-cause walk.
- **Gate 10 — PASS** (content-type homing): a behavior fix + a caveat update homed on the correct page; footer is consumer-trace, not embedded API/config reference. via read.
- **Gate 11 — PASS** (audience isolation): the published info-note carries no `Cornerstone`/`Gate N`/`LSN`/`CTRIB`/`feature-flow`/`Quality Bar` term — clean operator language. via grep of `9e35fcb`.

### Contributor gates G-C1…G-C16
G-C1 reproduce-first **PASS** · G-C2 verify-running-system **PASS (confirmed — see below)** · G-C3 GATE-1 **PASS** · G-C4 GATE-2 human-merge **PASS (verified live)** · G-C5 bounded + public reframe **PASS (verified live)** · G-C6 one-question clarify **PASS (none warranted)** · G-C7 hard-stops **N/A** · G-C8 issue-as-data **PASS** · G-C9 both buckets **PASS** · G-C10 ontology+docs **docs PASS / ontology DEFERRED-scheduled** · G-C11 milestone **PASS** · G-C12 design-before-build **PASS** · G-C13 sufficiency **PASS** · G-C14 advisory **N/A** · G-C15 test-change integrity **N/A (all added)** · G-C16 product analysis **PASS (exemplary)**.

- **G-C4 verified live (WebFetch PR #1802):** open + **Draft**, author **`odd-contributor[bot]`**, base `main` ← head `contrib/CTRIB-032-…`, body "Closes #1781", "At least 1 approving review is required to merge" with **no approval** (RamanDamayeu awaiting). The bot cannot self-approve → the merge guarantee holds.
- **G-C5 reframe comment verified live (GitHub API `…/issues/1781/comments`):** id **`4777553889`**, author `odd-contributor[bot]`, body opens *"Thanks for the detailed report and reproduction — confirmed on a current `main` build (auth disabled): …"* and reframes the fix to the entity's external description. The issue thread reflects the actual (reframed) PR scope.

### Regression — CONFIRMED via single-digest corroboration; own heavy re-run deferred (G-C2)
All four e2e buckets ran on the **single coherent SUT digest `52d3f79d`** (the `ff7d58a7` build), read as actual outcomes from the run-logs (not exit codes):
- **IT-140** (the fix) @ `52d3f79d` = **e2e:PASS 3/3** — and IT-140 is **RED on base** (`d751b3e9`, create+edit ✘) → this image demonstrably **contains the fix** (closes the CTRIB-029 no-fix-image risk).
- **multi-stack** @ `52d3f79d` = **PASS**; **ingestion-e2e** @ `52d3f79d` = **PASS**; **known-bugs** @ `52d3f79d` = **FAIL = expected-RED** (IT-004/006/007 pins; no unexpected GREEN).
- **feature-complete** @ `52d3f79d` = FAIL on **3 test cases across 2 specs** — `confirmation-dialog-thunk-arm` (CTRIB-031, unmerged) + `lineage-depth-boundary` (CTRIB-030, unmerged). **Delta-0 corroborated three ways:** (a) the diff is provably 2 files (a lookup-table mapper cannot touch confirmation-dialog/lineage specs); (b) the base SUT (`d751b3e9`, `ODD_SUT=main`) reproduced the same feature-complete FAIL; (c) the only failed-spec Playwright artifacts on disk are `confirmation-dialog-thunk-*` — **no lookup/mapper/dataentity failure artifact exists**. (feature-complete's protocol list runs IT-001…IT-139; IT-140 is separate, so this change adds zero feature-complete tests.)
- **Unit build:** the 2 added tests are confirmed correct + additive + RED-on-base by reading; the full `:odd-platform-api:build` green is the item's measured run.
- **Own heavy re-run deferred — stated reason (G-C2 + proportionality):** a Gradle daemon is live (PID 951970) → a maintainer build may be active, and G-C2 forbids a heavy run concurrent with a possible maintainer run; the fix image is no longer tagged (`odd-team-sut-ctrib032` now points at the base `d751b3e9`) so a re-run needs a full rebuild (~40+ min). Given the provable 2-file isolation + the fix-presence proof + the single-digest corroboration + the base reproduction, the marginal value of a rebuild+re-run is ~nil. Maintainer may request a belt-and-suspenders re-run; nothing in the evidence warrants it.

### G-C10 ontology — DEFERRED, scheduled (not dropped)
`/enrich --touched` the `DataEntityMapper` sidecar + lookup create/update flow is **PENDING** because `lineage/**` is dirty with **unowned P-001 probe residue** (R9 single-writer / O10 — do not `/enrich` into a dirty tree, do not sweep another activity's work). This is the **same justified deferral CTRIB-028 and CTRIB-029 were accepted with**, and CTRIB-032 is release-gated (`0.29.0`): the **0.29.0 release-review check 5** does a full substrate re-scan (`lineage-extractor scan --full`) that refreshes this sidecar at the released tag. Tracked there; it must land before `pending-release` → `done`.

### Regressions / Navigation / Banned-phrase
- **Regressions:** none introduced (delta-0, corroborated above).
- **Navigation:** consistent — `navigation/domains/lookup-tables.md` still names the mapper chain; no pointer shifted (pure 2-line mapper edit).
- **Banned-phrase check:** none used.
- **Outbound URL sweep:** 3 live fetches — PR #1802 (verified draft/bot/approval-gate), `…/issues/1781/comments` API (verified reframe comment id 4777553889), issue #1781 page (open, milestone 0.29.0). 0 mismatches.

### Doc-product editorial audit (`playbooks/doc-product-editorial-read.md`)
- **Coverage this run:** `master-data-management/**` (the touched subtree) read end-to-end on the train. Rotation: `data-glossary/**` covered by review-ctrib028; this run adds `master-data-management/**`; the remaining published tree is queued for the next `/review`.
- **Findings:**
  - **DOC-483** (low, internal-contradiction) — `lookup-tables.md` "Known operator caveats" intro says *"Six behaviours…"* but the `release/0.29.0` page renders **5** hint blocks (the 30-row-truncation + rename-no-activity caveats live on docs `main` but not on the train — base-skew; a 3-way merge at the release gate restores them, at which point the count must be reconciled). Source: `documentation/docs/master-data-management/lookup-tables.md:164`. Not introduced by `9e35fcb` (it converted, not removed). Logged — does not block this flip.

### Notes
- The fix is the correct, minimal, backward-compatible shape: 2 additive `.setExternalDescription(...)` lines, LT form + contract + schema unchanged, `internal_description` never clobbered (unit-asserted), overview renders it with zero FE work (`OverviewDescription`→`ExternalDescription`). VERIFIED via the diff + IT-140 + `git show 9e35fcb`.
- The release-gate carries three scheduled obligations for this item: DOC-480 live-site verification; the ontology `/enrich`/substrate refresh; and the lookup-tables.md caveat-count reconciliation (DOC-483) at the train→main merge. All recorded.
