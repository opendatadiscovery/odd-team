# ADR-CANDIDATE-212 — Directory dimension tables are mutated ONLY as a side-effect of feature-domain mutations; the read surface is exposed but the WRITE surface is intentionally absent (`Title` is the canonical instance)

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-09 Security & Access Control, P-04 Data Discovery]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__TitleController__controller-class__TitleController.md:implicit_adrs.[0]` (HIGH) — "**Title directory mutated only as a side effect of OwnershipServiceImpl** — the controller exposes ONLY `getTitleList` (no POST/PUT/DELETE). The write path is `TitleService.getOrCreate` called from `OwnershipServiceImpl.create/update` (per batch-K sidecar). The directory is therefore a derived dimension that follows ownership grants, not an independently managed catalogue." — evidence: TitleController.java:14-24 + TitleService.java:7-11 (only `list` and `getOrCreate` exist) + grep `titleRepository.create\\(` returns ONLY `TitleServiceImpl.java:21` and test fixtures. — intent_anchor: TitleApi yields a single GET operation per `openapi.yaml:323-340` — the contract itself encodes the read-only stance.
- `odd-platform__java__TitleController__controller-class__TitleController.md:concepts.operations.[1]` — "(Out-of-band sibling) `titleService.getOrCreate(name)` — the AUTO-CREATE side-effect path called by `OwnershipServiceImpl`; reads via `getByName` then inserts if missing"
- Cross-link batch K `OwnershipServiceImpl` (REFACTOR-206 PRIMARY ANCHOR) confirming the service-layer side-effect path

**Decision statement**: A subset of dimension tables in `odd-platform-api` are mutated EXCLUSIVELY as a side-effect of feature-domain mutations on a different aggregate. The READ surface IS exposed via a single thin `*Controller` that exposes `GET /api/{plural}` only; the WRITE surface (`POST`, `PUT`, `DELETE`) is INTENTIONALLY ABSENT from both the controller AND the `*Api` OpenAPI interface. Mutations land via a `*Service.getOrCreate(name)` call invoked from the parent aggregate's write path (e.g. `OwnershipServiceImpl.create` → `titleService.getOrCreate(formData.getTitleName())`). The maintainer's deliberate decision: directory growth is INDUCED by usage, never managed by an admin. `Title` is the canonical instance (verified across two sidecars: TitleController class-level + OwnershipServiceImpl method-level); `Tag`, `Owner`, and `Namespace` share the SAME side-effect-create shape via different parent aggregates (Tag via `DATA_ENTITY_TAGS_UPDATE`, Owner via `createOwnership`, Namespace via `POST /api/datasources` per REFACTOR-584) — but differ in that those DO expose admin write endpoints alongside the side-effect path. `Title` is the PUREST instance: no admin endpoint exists at all.

**Wisdom test**: PASS. Three intent anchors:
1. **OpenAPI contract** — `TitleApi` exposes a single GET operation; the spec is contract-first per ADR-CANDIDATE-189; the absence of a `POST /api/titles` is a deliberate spec-level choice, not a forgotten endpoint.
2. **Soft-delete machinery exists but is unreachable** — `ReactiveTitleRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository`; the `delete(id)` machinery is PROVISIONED but has zero production callers (grep confirms only test fixtures). The decision is "forward-looking provision, present-day side-effect-only mutation."
3. **No `TITLE_CREATE` permission exists in the codebase** (per REFACTOR-206 STRENGTHEN — grep `TITLE_CREATE` against `<odd-platform-repo>/odd-platform-api/src/main/java` returns zero matches). The absence of the permission itself IS the architectural statement.

Structural impact (alters the directory-management model across the entire platform: 4+ dimensions follow some flavour of this pattern; `Title` is the purest); alternative ("add admin CRUD endpoints for Title") is a structural change to the directory-management contract, not refactoring within the existing shape.

**Existing ADR**: composes with **ADR-CANDIDATE-049** (Owner directory CRUD is identity-decoupled — has admin endpoints + the side-effect path) and **ADR-CANDIDATE-112** (principal-independent owner_name / self-grant decoupling — the parent architectural framing for the directory-side-door pattern). This ADR is the **PUREST instance** of the side-effect-only-mutation stance: where Owner has BOTH admin CRUD + side-effect-create, Title has ONLY side-effect-create. The split between Owner-style (admin + side-door) and Title-style (side-door-only) is itself architecturally significant — different operational governance models for different dimension tables.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-206 (no allowlist on title_name → vocabulary sprawl; the side-effect path's downside)
- REFACTOR-624 NEW (no length/pattern/case-normalization → silent policy-leak when policies condition on `dataEntity:owner:title == 'X'`)
- REFACTOR-623 NEW (TitleController size unbounded + page=0 boundary)
- DOC-GAP — no live doc page documents what a Title is or how the directory is populated

**Proposed action**: Promote to `adrs/drafts/directory-side-effect-mutation.md` (new ADR). Document:
1. The four dimensions (Title / Tag / Owner / Namespace) and where each sits on the spectrum (admin-only / admin+side-door / side-door-only).
2. The operator-visible consequence: typing a brand-new value in any `*Autocomplete` mints a directory row.
3. The Policy-condition coupling: `dataEntity:owner:title == 'X'` reads work against a directory the operator never explicitly populated.
4. The maintainer's choice between "lock down directory CRUD" (close the side door, force admin via dedicated endpoints) vs "doc-disclose the pattern" (preserve the UX but warn operators).

**Severity rationale**: HIGH — load-bearing architectural decision affecting four feature surfaces and the Policy condition model. A future refactor that adds a `POST /api/titles` admin endpoint without first triaging the existing side-effect path would create two competing write surfaces with race conditions. The ADR encodes the deliberate choice the platform has made (side-door only) so subsequent maintenance preserves the contract.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-049 (Owner directory CRUD identity-decoupled — sibling decision); ADR-CANDIDATE-112 (principal-independent self-grant decoupling — parent framing); REFACTOR-206 (the gap-side consequence of this ADR).
- SUPERSEDES: none.
- CONFLICTS: none.

---
