## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-008 — the `tag` openapi-tag node is the third PRIMARY-SOURCE confirmation of URL-prefix tag scoping)

**The `tag` openapi-tag sidecar is a direct, primary-source confirmation of the URL-prefix-scoping + single-tag-per-operation convention** — the third openapi-tag node after `alert` and `dataEntity`.

- `tag.md:implicit_adrs[0]` — "OpenAPI tags in this spec follow URL-prefix scoping — a tag's operations all share a `/api/<plural-noun>` URL prefix. The `tag` tag scopes only `/api/tags*` operations; the per-entity tag-ASSIGNMENT operations under `/api/dataentities/{id}/tags`, `/api/terms/{id}/tags`, `/api/datasetfields/{id}/tags` are tagged with the PARENT resource, not `tag`. This produces a resource-shaped `TagApi` interface owning directory-vocabulary CRUD only." (intent_anchor: "Consistent URL-prefix-to-tag mapping across the entire `tags:` block — every tag in the spec follows the same `/api/<noun>` rule")
- `tag.md:implicit_adrs[2]` — "Each operation is tagged with EXACTLY ONE tag (single-element `tags: [tag]` arrays on all four operations). The spec never exercises OpenAPI's multi-tag capability, committing the generator to a 1:1 operation-to-`*Api`-interface mapping." (`openapi.yaml:359-360, 378-379, 406-407, 422-423`)
- `tag.md:implicit_adrs[1]` — "Tags are declared as bare `name:` entries — no `description`, no `externalDocs`... all 34 entries are `- name: <tagname>` with no further fields." (corroborates the bare-name-tags facet of the convention)
- `tag.md:implicit_adrs[3]` — "Authorization is wholly out-of-band of the OpenAPI contract — no `security:` block, no `securitySchemes`." (corroborates ADR-CANDIDATE-013 — the contract-is-shape-not-access-control finding — from a third tag.)

**Architectural refinement**: `tag` is a notably CLEAN case of the convention — a small, single-resource tag (4 operations, all `/api/tags*`, all `tags: [tag]`) with NO mega-tag tension (unlike `dataEntity`'s 40 operations). The boundary the convention draws is sharp: the four directory-CRUD operations are `tag`-tagged; the three per-entity tag-ASSIGNMENT operations are tagged with their parent resource (`dataEntity` / `term` / `datasetField`). This is the convention's intended outcome — `TagApi` owns directory-vocabulary CRUD only.

**Support count**: 2 → 4 sidecars (`alert` + `dataEntity` + `tag` openapi-tag nodes; the `tag` node also re-confirms the bare-`name:` and auth-out-of-band facets, so it strengthens three of the convention's sub-claims at once).

**Severity unchanged**: MEDIUM.

---
