- **REFACTOR-206** (NEW 2026-05-12F): Title auto-create via `createOwnership` has no allowlist — the platform's title vocabulary accumulates arbitrary user-submitted strings (typos, free-text descriptions, language variants) without an enum constraint
  - **Category**: missing-validation
  - **Surfaced by**: `odd-platform__java__DataEntityController__controller-method__createOwnership.md:bugs_limitations_corner_cases.[1]`
  - **Statement**: Same pattern as REFACTOR-199 but for Title: any caller-supplied `title_name` not in the `title` directory becomes a fresh row via `TitleService.getOrCreate(name)` (`TitleServiceImpl.java:19-22`). There is no allowlist of valid titles (no "Steward / Owner / Reviewer" enum), no length / character-set / pattern constraint on `title_name` (`components.yaml:450-451` declares only `type: string`), and no audit event for Title-directory growth (no `@ActivityLog` on `TitleServiceImpl.getOrCreate`). Operators expecting a fixed vocabulary of titles ("Owner", "Steward", "Reviewer") discover that the directory has accumulated arbitrary strings — typos, language variants, free-text descriptions — submitted via this endpoint across the lifetime of the deployment.
  - **Evidence**: `OwnershipServiceImpl.java:53` (`titleService.getOrCreate(formData.getTitleName())`) + `TitleServiceImpl.java:19-22` (`getOrCreate` calls `create` on miss) + `components.yaml:450-451` (`title_name: type: string` only)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-049 (identity-decoupled Owner directory CRUD) frames the directory-CRUD-vs-user-claim split for Owner; the same maintainer pattern should apply to Title but doesn't.
  - **Proposed remedy**: Add a `Title.kind` enum (Owner / Steward / Reviewer / Custom) with a closed list of standard kinds + a custom-allowlist mechanism for operators who need bespoke titles. Validate at the endpoint boundary; reject unknown kinds. Alternative: add a soft constraint (max length, character set) on `title_name` to prevent the worst free-text accumulation.
  - **Severity rationale**: MEDIUM — vocabulary-sprawl operational gap; not a security issue but a long-term data-quality erosion.
  - **Suggested backlog grouping**: `Owner / Title directory hygiene`

## STRENGTHENS — OwnershipServiceImpl (batch K, PRIMARY-SOURCE confirmation at OwnershipServiceImpl.java:53)

**Direct primary-source confirmation at the service layer**. The batch-F sidecar framed this from the controller-method side; the batch-K OwnershipServiceImpl sidecar confirms the SERVICE-LAYER primary anchor at line 53 — and adds a verifiable NEW fact: **grep `TITLE_CREATE` against `<odd-platform-repo>/odd-platform-api/src/main/java` returns zero matches**. There is NO `TITLE_CREATE` permission in the codebase at all (compare REFACTOR-199 where `OWNER_CREATE` exists but is bypassed). The absence of the permission itself IS the doc gap; there is no admin-managed directory for Title — every Title row originates from a `getOrCreate` side-channel.

**New batch-K evidence**:
- `OwnershipServiceImpl.md:bugs_limitations_corner_cases.[1]` (MEDIUM): "REFACTOR-206 (sibling): no allowlist on `title_name` — the Title directory grows with arbitrary caller-supplied strings. Line 53 calls `titleService.getOrCreate(formData.getTitleName())`. `TitleServiceImpl.getOrCreate` at lines 19-22 has no allowlist, no enum, no `@Pattern`, no `@Size`, no length cap. Any non-existing name becomes a new Title row. There is no `TITLE_CREATE` permission (verified: grep `TITLE_CREATE` against `<odd-platform-repo>/odd-platform-api/src/main/java` returns zero matches)."
- `OwnershipServiceImpl.md:doc_drift_findings.[1]`: "The title auto-create-on-miss side effect (REFACTOR-206) is undocumented. No live doc page describes that the Title directory grows via `titleService.getOrCreate(formData.getTitleName())` at line 53. ... There is no Titles-management documentation surface analogous to the Owners page."

**Architectural framing**: ADR-CANDIDATE-112 (NEW batch K — principal-independent owner_name / self-grant decoupling) is the architectural framing that includes Title side-by-side with Owner — both are caller-supplied verbatim, both auto-create on miss, both bypass dedicated `*_CREATE` permissions. The fix triage for REFACTOR-206 is the SAME as for REFACTOR-199: either preserve the ADR + doc-disclose OR change the ADR + add permission checks.

**Cross-batch triangulation**:
- batch-F (DataEntityController.createOwnership): controller-side framing — same finding from the controller layer
- batch-K (OwnershipServiceImpl PRIMARY ANCHOR): service-side primary source + NEW fact "no TITLE_CREATE permission exists" + doc-drift confirmation that no Titles-management docs page exists

**Severity unchanged**: MEDIUM. The fix path is informed by ADR-CANDIDATE-112's framing. Cross-link with REFACTOR-199 (same shape, Owner side) and REFACTOR-223 (same shape, Tag side via TAGS_UPDATE).

---
