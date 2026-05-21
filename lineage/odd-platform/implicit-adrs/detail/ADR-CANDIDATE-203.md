## ADR-CANDIDATE-203 — Dual conflict-semantics for tag-directory creation — operator/UI route is fail-on-duplicate, Collector ingestion route is upsert-shaped silent-idempotent

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (load-bearing — the split is visible across two named service methods with deliberately divergent conflict handling)
**Axes present**: controllers, services, repositories
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-08 (Management & Administration — Tags tab), P-10 (Integrations & Ingestion — the Collector tag-create path)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__createTag.md:implicit_adrs.[0]` ("Bulk-create is the operator-explicit, fail-on-duplicate API shape — `createTag` accepts `BulkTagFormData`, `.collectList()`s it, and delegates to `bulkCreate`, whose inherited repository body has NO `ON CONFLICT` clause. The dual-method design (fail-on-duplicate `bulkCreate` for the UI/API route vs upsert-shaped `getOrInjectTagByName` for the Collector route) is a deliberate split.")

**Decision statement**: ODD's `tag` directory has TWO creation paths with deliberately divergent conflict semantics, and the divergence IS the architectural statement. (1) The operator / UI / API route — `POST /api/tags` → `TagController.createTag` → `TagService.bulkCreate` → inherited `ReactiveAbstractCRUDRepository.bulkCreate` — issues a single multi-row `insertManyReturning` INSERT with **NO `ON CONFLICT` clause**. A name that collides with a non-deleted directory row hits the partial unique index `tag_name_unique` and surfaces as `UniqueConstraintException("Tag with this name already exists")` — i.e. **fail-on-duplicate**. (2) The Collector ingestion route — `getOrInjectTagByName` / `getOrCreateTagsByName` — is **upsert-shaped / silent-idempotent**: a re-pushed tag name resolves to the existing directory row rather than erroring. The decision encodes "an operator deliberately creating a tag should get a clear error when they pick an existing name; an ingestion pipeline re-pushing the same tag every scrape should be replay-safe and silent." The two methods are co-located in `TagServiceImpl` and the maintainer-authored split is the contract.

**Evidence**:
- `createTag.md` says: "the inherited repository method has no `ON CONFLICT` clause (`ReactiveAbstractCRUDRepository.java:114-126`). This is the deliberate counterpart to the upsert-shaped `getOrInjectTagByName` (`TagServiceImpl.java:88-94`) used by the Collector path."
- `createTag.md` resource_boundaries says: "`createTag` is fail-on-duplicate — replaying the same payload after a successful create raises `UniqueConstraintException` on every already-created name... (Contrast the Collector path's `getOrInjectTagByName`, which IS replay-safe via `ON CONFLICT ... DO UPDATE`.)"

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — two named service methods (`bulkCreate` and `getOrInjectTagByName`) with structurally different conflict handling; one raises a typed user-facing exception, the other uses `ON CONFLICT ... DO UPDATE`. The maintainer wrote both. The intent is inferred from the consistent pairing, not from a comment (confidence MEDIUM on the intent — no in-file comment explicitly defends "fail-on-duplicate for the UI route").
2. *Structural impact?* YES — affects the API contract (the UI gets a 4xx, the Collector path never does), the idempotency / replay-safety model (the ingestion path is replay-safe by design; the UI path is not), and the directory-growth semantics (operator creates are explicit, ingestion creates are incidental).
3. *Refactoring or structural?* STRUCTURAL — switching `createTag` to upsert (or `getOrInjectTagByName` to fail-on-duplicate) would change the contract every UI client and every Collector relies on.
→ ADR-CANDIDATE.

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-065** (tag auto-create-on-miss is spec-acknowledged) — the auto-create side-channel uses the upsert-shaped `getOrCreateTagsByName`; this ADR explains WHY the auto-create path is silent-idempotent (it shares the ingestion route's conflict semantics).
- **ADR-CANDIDATE-071** (centralised DB-error translation) — the `UniqueConstraintException` the fail-on-duplicate path raises is mapped to an HTTP-friendly 4xx by `ExceptionUtils`, the same translation layer.

**Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-487-family does not apply; the relevant co-surfaced gap is the in-batch / cross-batch duplicate-atomicity question (probe P-026 — does a `createTag` bulk INSERT with a self-duplicate roll back wholly or partially) and the TOCTOU race on `getOrCreateTagsByName` (REFACTOR-223 family's `toctou_between_list_by_names_and_bulk_create` facet). The ADR captures the deliberate semantic; the atomicity-under-concurrency question is a probe, not part of the decision.

**Proposed action**: Promote to `adrs/drafts/tag-directory-dual-conflict-semantics.md`. Document: (a) the two routes and their conflict handling; (b) the replay-safety consequence (ingestion path is replay-safe, UI path is not — a UI client must treat a 4xx as "some/all names already exist"); (c) the cross-link to ADR-CANDIDATE-065 (the auto-create side-channel inherits the ingestion route's semantics); (d) the open atomicity question (P-026) as a known unverified corner.

**Severity rationale**: MEDIUM — pattern-shaping API-contract decision. A future maintainer proposing "make tag creation idempotent" or "make ingestion fail loudly on duplicates" needs to know the current split is deliberate, not an oversight.

---
