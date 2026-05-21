## REFACTOR-498 — `getPopularTagList` page/size degenerate inputs reach PostgreSQL unvalidated — `page=0`/`page=-1` produce a negative OFFSET, `size=-1` a negative LIMIT, a null Integer NPEs on unboxing; all surface as 500, not a clean 4xx

**Severity**: LOW
**Category**: error-mapping
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging — Catalog Overview "Top tags" read), P-11 (Platform API & Developer Surface)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__getPopularTagList.md:bugs_limitations_corner_cases[4]` ("`page`/`size` degenerate inputs reach PostgreSQL un-validated.")
- `odd-platform__java__TagController__controller-method__getPopularTagList.md:stress_findings.tunables` (the `page` + `size` tunable analysis — PROBE-NEEDED P-029)
- `odd-platform__openapi__tags__openapi-tag__tag.md:stress_findings.tunables` (the spec-side gap — `PageParam`/`SizeParam` declare no `minimum`)

**Statement**: `getPopularTagList`'s `page` and `size` query parameters reach PostgreSQL with no validation. `page=0` produces SQL OFFSET `(0-1)*size = -size` → PostgreSQL rejects a negative OFFSET (SQL state 22023). `page=-1` → OFFSET `-2*size` → same. `size=-1` → `LIMIT -1` → PostgreSQL rejects a negative LIMIT. A literal `null` querystring for `page`/`size` reaches the service signature `int page, int size` (`TagServiceImpl.java:73-74`, primitive `int`) and throws `NullPointerException` on unboxing at the service-call boundary. None of these is guarded in the controller, the service, or the repository. The operator-visible result is an HTTP 500, not a clean 4xx. The OpenAPI `PageParam` / `SizeParam` components declare `type: int32, required: true` with NO `minimum`, `maximum`, or `default` (`components.yaml:4213-4229`) — so the negative cases are CONTRACT-VALID per the schema; the spec does not even let a strict client catch them at binding time. Probe P-029 pins the exact surfaced HTTP statuses.

**Evidence**: `TagController.java:37-42` (no `@Min`/`@Valid` on `page`/`size`) + `TagServiceImpl.java:73-74` (primitive `int` params — null Integer unboxes to NPE) + `ReactiveTagRepositoryImpl.java:148` (the `(page-1)*size` OFFSET arithmetic + the `LIMIT size`) + `components.yaml:4213-4229` (`PageParam`/`SizeParam` — `int32, required, no minimum/maximum`) + `lineage/odd-platform/probes/P-029.yaml`.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. There is no comment, doc, or ADR defending "degenerate page/size inputs deliberately surface as 500". The OpenAPI schema simply omits `minimum`/`maximum`, and the controller omits bean-validation — missing input-validation, a feature not yet added.
2. *Structural impact?* NO — adding `minimum: 1` to `PageParam`/`SizeParam` (the generator turns it into `@Min(1)`, enforced at binding → a clean 400) is validation within the existing structure.
3. *Refactoring or structural?* REFACTORING — add the schema `minimum` constraints + optionally a controller-tier guard.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: none specific — generic input-validation / clean-error-response best practice. The `tag` openapi-tag sidecar's own recommendation is the implied prescription: "The spec SHOULD declare `minimum: 1` to make the negative case a contract violation rather than a runtime 500." This is the same shape as the unbounded-`size` / negative-OFFSET gaps that exist on other paginated endpoints across the platform.

**Proposed remedy**: Add `minimum: 1` to `PageParam` and `SizeParam` in `components.yaml` (the OpenAPI generator turns these into `@Min(1)` bean-validation annotations, so a degenerate value is rejected with a clean HTTP 400 at the binding layer before the controller body runs). This is the single highest-value fix — it converts every negative/zero page/size 500 across EVERY consumer of `PageParam`/`SizeParam` into a 400. Optionally add a `maximum` to `SizeParam` to also bound the unbounded-`size` aggregation cost. Promote probe P-029 to a test asserting `page=0` / `size=-1` / missing-param return 400, not 500.

**Severity rationale**: LOW — an error-mapping hygiene gap. Degenerate inputs surface as an opaque 500 instead of a descriptive 4xx; the practical impact is a poor error experience for a malformed request, not data-loss or a security issue. LOW is the honest level — but the fix (`minimum: 1` on the shared `PageParam`/`SizeParam`) is cheap and improves every paginated endpoint at once.

**Suggested backlog grouping**: "Tag mutation hardening" / OpenAPI contract-hardening sprint — the `minimum: 1` change on the shared `PageParam`/`SizeParam` components is a one-line, platform-wide improvement; pair with REFACTOR-493 (no tag-name validation) as the tag-surface input-validation batch.

---
