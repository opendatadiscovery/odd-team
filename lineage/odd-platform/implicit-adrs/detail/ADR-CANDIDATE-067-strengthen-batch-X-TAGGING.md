## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-067 — tag-mutation surface confirms the `@ReactiveTransactional` boundary asymmetry, with a single-step-delegation nuance from `createTag`)

**The seven tag-surface sidecars confirm the `@ReactiveTransactional` boundary asymmetry — list-shaped reads stay OUTSIDE the TX; multi-step per-resource writes are INSIDE the TX — and `createTag` adds a sharpening nuance.**

Reads outside TX:
- `getPopularTagList.md:resource_boundaries` — "no `@ReactiveTransactional` wraps `listMostPopular` (`TagServiceImpl.java:72-77` has no annotation)". `getPopularTagList` is a pure SELECT-only read; the page total and items are computed by two separate SELECTs with no transactional envelope — a benign read-skew is accepted.

Multi-step writes inside TX:
- `deleteTag.md:implicit_adrs[2]` — "The delete chain is one atomic transaction — `@ReactiveTransactional` wraps the load, the two hard deletes, the soft delete, and the FTS refresh." (`TagServiceImpl.java:58`)
- `updateTag.md` — `TagServiceImpl.update` carries `@ReactiveTransactional`; the fetch + guard + apply + persist + triple-FTS-refresh are one atomic unit. (`TagServiceImpl.java:44-55`)
- `createTermTagsRelations.md:invariants` — "`TermServiceImpl.upsertTags` carries `@ReactiveTransactional` (`TermServiceImpl.java:253`); the delete phase, the directory `bulkCreate`, the relation insert, and the search-vector refresh all run inside ONE DB transaction."
- `updateDatasetFieldTags.md:invariants` — "`DatasetFieldServiceImpl.updateDatasetFieldTags` is annotated `@ReactiveTransactional` (`DatasetFieldServiceImpl.java:118`); the delete, the directory auto-create, the relation re-insert, the search-vector refresh, the `data_entity_filled` toggle, and the final re-read all run inside one DB transaction."

**Sharpening nuance from `createTag`**: `createTag.md:implicit_adrs[2]` — "The transactional boundary lives at the repository's inherited `bulkCreate`, not at the controller or service method — `TagServiceImpl.bulkCreate` is a SINGLE-STEP delegation, so it carries no `@ReactiveTransactional`; the multi-row INSERT's atomicity comes from `ReactiveAbstractCRUDRepository.bulkCreate`'s own annotation (`:113`)." This refines the ADR's rule: the convention is "**multi-statement** orchestration carries the annotation; **single-step** delegations do not — they inherit the TX from the single repository call they make." `createTag` → `TagServiceImpl.bulkCreate` is single-step, so the annotation's ABSENCE at the service tier is the convention applied correctly, NOT an omission. The TX boundary is precise: it sits at the lowest layer that actually does multiple statements.

**Support count**: extended by 7 tag-surface sidecars (1 read + 4 multi-step writes + the `createTag` single-step nuance + the `tag` openapi-tag node's contract-level corroboration).

**Severity unchanged**: MEDIUM.

---
