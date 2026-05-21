## STRENGTHENS — batch X-TAGGING (2026-05-21) — `createTag` + `updateTag` controller-method PRIMARY SOURCES; the openapi-tag node confirms the spec-internal copy-paste defect on `updateTag`

DOC-GAP-074 (the class-wide 201-vs-200 OpenAPI/implementation drift) already named Tag in its Batch-Z append (the openapi-spec sidecar enumerated `Tag createTag + updateTag (openapi.yaml:372 + 400)` among the 9+ endpoint-level instances). Batch X-TAGGING (directed tagging-coverage batch) supplies the **controller-METHOD-tier** primary sources for the two Tag instances, plus the openapi-tag node's confirmation that `updateTag`'s 201 is a spec-internal copy-paste defect (201 + "successfully updated" on a PUT).

### New `surfaced_by` (batch X-TAGGING)

- `odd-platform__java__TagController__controller-method__createTag.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"OpenAPI declares `'201'` for `createTag` (`openapi.yaml:372`); the controller returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:27`). Spec-vs-code status-code drift."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE for the POST createTag instance)**
- `odd-platform__java__TagController__controller-method__createTag.md:bugs_limitations_corner_cases.[0]` (MEDIUM per sidecar) — verbatim: *"Status-code drift on `createTag` — the controller returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:27`); the OpenAPI operation declares `'201'` (`openapi.yaml:372`)... Same drift class as `updateTag` (`openapi.yaml:400`) and `TermController.createTerm` (batch-U)."*
- `odd-platform__java__TagController__controller-method__updateTag.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"OpenAPI declares `'201'` for `updateTag`'s success response; the controller returns 200 via `ResponseEntity::ok` (`TagController.java:51`). Status-code drift."* **(NEW batch X-TAGGING — controller-METHOD PRIMARY SOURCE for the PUT updateTag instance)**
- `odd-platform__java__TagController__controller-method__updateTag.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar) — verbatim: *"Status-code drift on `updateTag` — controller returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:51`); OpenAPI declares 201... Same drift class as `createTag` and `TermController.createTerm`."*
- `odd-platform__openapi__tags__openapi-tag__tag.md:bugs_limitations_corner_cases.[2]` (MEDIUM per sidecar) — verbatim: *"Status-code drift on `createTag` and `updateTag`. Both operations declare `'201'` under `responses:` (`openapi.yaml:372, 400`); `TagController` returns `200` via `ResponseEntity::ok` (`TagController.java:27, 51`). A consumer generating a strict client from the spec expects `201` and may treat the actual `200` as an unexpected status. Same drift class as `TermController.createTerm`."* **(NEW batch X-TAGGING — openapi-tag-tier PRIMARY SOURCE — confirms BOTH Tag instances at the spec tag-grouping level)**
- `odd-platform__openapi__tags__openapi-tag__tag.md:invariants.[5]` — the invariant naming the drift: *"`createTag` and `updateTag` declare `'201'` (`openapi.yaml:372, 400`); the `TagController` implementation returns `200` via `ResponseEntity::ok` (`TagController.java:27, 51`) — a spec-vs-implementation status-code drift on both write operations."*

### The `updateTag` instance is the PUT-update-anomalous-201 sub-class

Consistent with DOC-GAP-074's batch-P framing (the PUT-update instances are structurally distinct from the POST-create instances): `updateTag` is a **PUT** operation. Its `openapi.yaml:400` declaration of `'201'` is the ANOMALOUS side — a PUT-update should declare `200` (or `204`), not `201` (the POST-creation status). The openapi-spec batch-Z append already enumerated `openapi.yaml:400` (`updateTag`) among the five spec-internal copy-paste defects (201 + "successfully updated" description on a PUT). This batch's `updateTag` controller-method sidecar confirms the IMPLEMENTATION returns the canonical `200` — so for `updateTag`, the **spec is wrong** (anomalous 201) and the **implementation is right** (canonical 200). For `createTag` (POST), the conventional reading is the inverse — the spec's 201 is canonical-REST and the implementation's 200 drifts.

The directional-fix recommendation from DOC-GAP-074's batch-Z append is unchanged and now anchored at the controller-method tier for the two Tag operations:
- `createTag` (POST): align impl → spec — change `ResponseEntity::ok` to `ResponseEntity.status(HttpStatus.CREATED).body(...)`.
- `updateTag` (PUT): align spec → impl — change `openapi.yaml:400` `'201'` → `'200'` and the description "successfully updated" stays.

### No new finding minted

The Tag 201-vs-200 drift is fully within DOC-GAP-074's class-wide scope (already 9+ endpoints, Tag already named). Per Rule 4 this batch STRENGTHENS DOC-GAP-074 with the controller-method primary sources rather than minting a Tag-specific finding. No doc-site page-level surface — the spec/codegen mismatch is the only consumer-visible drift; severity stays MEDIUM at the class level.

### Cross-reference additions

- **DOC-GAP-209** (TermController status-code drift) — sibling instance; DOC-GAP-209 explicitly names `TagController.createTag — returns 200` in its sister-controllers enumeration. This batch supplies the Tag-side controller-method primary source that DOC-GAP-209 cross-referenced.
- **DOC-GAP-099 META** (OpenAPI authoring-quality cluster) — the status-code-drift failure shape; DOC-GAP-074 is its primary source.

### Coherence note (Rule 6)

Cross-registry sweep this batch: `implicit-adrs/index.md` and `test-map/index.yaml` carry the `TagController` status-code entries; `feature-flows/index.yaml` F-018 references the 201-vs-200 drift class. NO registry asserts the controller returns 201 or the spec declares 200. The four other registries are consistent with DOC-GAP-074's framing. This batch STRENGTHENS; it does not contradict. `coherence_strengthens: 1` for this entry.
