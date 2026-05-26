## STRENGTHENS — Batch ZE (TitleController class-level — the READ-side directory surface confirms the side-effect-only mutation pattern)

**TitleController class-level enrichment adds the READ-SIDE primary source for REFACTOR-206's side-effect-only mutation pattern.** Where batch F + batch K surfaced the WRITE side (`OwnershipServiceImpl.create/update` calling `titleService.getOrCreate`), batch ZE now adds the READ-side primary source: the TitleController IS the directory's read surface, AND it is structurally read-only (no POST/PUT/DELETE on `/api/titles`). The architectural pattern is now end-to-end triangulated: READ via TitleController; WRITE via OwnershipServiceImpl side-effect only.

**New surfaced_by entry**:
- `odd-platform__java__TitleController__controller-class__TitleController.md:implicit_adrs.[0]` (HIGH) — "**Title directory mutated only as a side effect of OwnershipServiceImpl** — the controller exposes ONLY `getTitleList` (no POST/PUT/DELETE). The write path is `TitleService.getOrCreate` called from `OwnershipServiceImpl.create/update` (per batch-K sidecar). The directory is therefore a derived dimension that follows ownership grants, not an independently managed catalogue." — evidence: TitleController.java:14-24 + TitleService.java:7-11 (only `list` and `getOrCreate` exist) + grep `titleRepository.create\\(` returns ONLY `TitleServiceImpl.java:21` and test fixtures
- `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**Title directory has no length / pattern / allowlist constraint at the schema or service** — `title.name varchar(128)` per `V0_0_3__add_ownership.sql:4`. No `@Pattern`, no `@Size`, no enum check, no normalisation (case-folding, trimming, deduping by lowercase). The directory accumulates `'data steward'`, `'Data Steward'`, `'DATA STEWARD'`, `' Data Steward '` (leading space), `'data-steward'`, `'data_steward'` as DISTINCT rows the moment two operators type slightly different forms into the autocomplete."

**Cross-batch refinement** (batch ZE adds the missing architectural framing):

The original REFACTOR-206 (batch F) framing was "Title auto-create has no allowlist" — focused on the WRITE side gap. Batch K's STRENGTHEN added the SERVICE-LAYER primary source + the verifiable NEW fact that "no TITLE_CREATE permission exists in the codebase."

**Batch ZE now adds the READ-side primary source AND surfaces a new ARCHITECTURAL framing**: the controller is structurally read-only by deliberate design (per ADR-CANDIDATE-212 NEW — directory dimension tables mutated only as side-effect; Title is the canonical instance). This is NOT just a "missing endpoint" — it's a DELIBERATE absence:

- **OpenAPI contract**: `TitleApi` (`openapi.yaml:323-340`) yields a SINGLE GET operation. The spec is contract-first; the absence of POST/PUT/DELETE is a deliberate spec-level decision.
- **Soft-delete machinery is PROVISIONED but UNREACHABLE**: `ReactiveTitleRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository`; the `delete(id)` machinery exists but has ZERO production callers (grep `titleRepository.delete\\(` returns only test fixtures). The decision is "forward-looking provision, present-day side-effect-only mutation."
- **No TITLE_CREATE permission exists** (confirmed by Batch K's grep — zero matches in `<odd-platform-repo>/odd-platform-api/src/main/java`).

**The new architectural framing means**: any maintainer who wants to "close the side door" by adding TITLE_CREATE permission + POST endpoint would be ADDING a competing write surface. The ADR-CANDIDATE-212 NEW codification of the side-effect-only stance means closing the side door requires a deliberate ADR supersede, not a quiet endpoint addition.

**Additionally, batch ZE adds REFACTOR-624 NEW as the COMPOUND finding**: the case-sensitivity policy-leak class. The compound:
- REFACTOR-206 (this entry): auto-create writes verbatim values into the directory
- REFACTOR-624 NEW: the directory has no case-normalisation; Policy conditions on `dataEntity:owner:title == 'X'` silently miss cased-variants

The two together constitute the full silent-policy-leak class: every cased-variant typed into the autocomplete becomes a distinct directory row → Policy evaluator misses variants → operator's GRANT intent silently leaks. REFACTOR-206's "no allowlist" framing is the WRITE-side gap; REFACTOR-624's "no normalisation" framing is the READ-side gap; both need fixing for the full closure.

**Triangulation count**: REFACTOR-206 now triangulates across **3 batches** (F + K + ZE) covering: controller-method WRITE side (Batch F), service-layer PRIMARY ANCHOR (Batch K), controller-class READ-side + architectural framing (Batch ZE). The pattern is end-to-end triangulated and architecturally framed via ADR-CANDIDATE-212 NEW.

**Severity unchanged at MEDIUM** — vocabulary-sprawl operational gap; the compound with REFACTOR-624 NEW (case-sensitivity policy-leak) is the operator-actionable severity-elevation candidate; the maintainer triages whether to MEDIUM-cluster the two or elevate the compound to HIGH.

**The maintainer's prescription** (per the existing detail file + ADR-CANDIDATE-212 NEW): the choice between "preserve the side-effect-only stance and DOC-disclose" (option 1, current stance) vs "close the side door by adding admin CRUD" (option 2, structural change requiring ADR supersede). The compound with REFACTOR-624 means option 1 ALSO requires adding case-normalisation at the service layer; the doc-disclose alone is insufficient.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-212 NEW (the architectural framing); REFACTOR-624 NEW (the case-sensitivity compound); REFACTOR-199 (Owner side, sibling shape with the same side-door class).
- SUPERSEDES: none.
- CONFLICTS: none.

---
